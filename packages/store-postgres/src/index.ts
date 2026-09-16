// A ReportStore backed by Postgres, storing each report as a JSONB document.
//
// TWO DELIBERATE CHOICES
//
// 1. NO DATABASE DRIVER DEPENDENCY. The host passes in anything with
//    `query(sql, params) => { rows }` — node-postgres Pool, a Neon client, a
//    connection from an existing pool. loopix never picks your driver, your
//    pooling, your TLS or your secret handling, and adds nothing to your
//    lockfile. (Also loopix's own rule: no dependency the host did not ask for.)
//
// 2. DOCUMENT + GENERATED COLUMNS. The report is one JSONB blob, so the schema
//    never chases the report shape. The three things we actually filter on —
//    project, status, reporter — are GENERATED columns read out of the JSON, so
//    they are indexable without being duplicated or able to drift from it.

import type { LoopReport, ReportStore } from "@loopix/core";

/** Anything that can run a parameterised query. `pg.Pool` satisfies it as-is. */
export interface SqlClient {
  query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/**
 * Run once per database. Safe to run repeatedly.
 *
 * `events` is append-only and is where "what changed, by whom" lives. The
 * report row is the current state; the events are the history. Patching a row
 * in place — which the file store does — throws the previous state away, and
 * "who approved this?" then has no answer.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS loopix_reports (
  project_id  text GENERATED ALWAYS AS (doc->>'projectId') STORED,
  id          text PRIMARY KEY,
  doc         jsonb NOT NULL,
  status      text GENERATED ALWAYS AS (doc->>'status') STORED,
  reporter    text GENERATED ALWAYS AS (doc->>'reporterSub') STORED,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loopix_reports_project_created
  ON loopix_reports (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loopix_reports_project_status
  ON loopix_reports (project_id, status);
-- "show me what I reported" — the only per-person query the UI needs.
CREATE INDEX IF NOT EXISTS loopix_reports_reporter
  ON loopix_reports (project_id, reporter, created_at DESC);

CREATE TABLE IF NOT EXISTS loopix_events (
  seq        bigserial PRIMARY KEY,
  project_id text NOT NULL,
  report_id  text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  -- who did it: an opaque subject id from the host's own auth (Keycloak "sub"),
  -- or "agent" / "system". Never a name or an email — resolve those at display
  -- time so a bug tracker does not quietly become a store of personal data.
  actor      text,
  type       text NOT NULL,
  detail     jsonb
);
CREATE INDEX IF NOT EXISTS loopix_events_report ON loopix_events (report_id, seq);
`;

export async function migrate(sql: SqlClient): Promise<void> {
  await sql.query(SCHEMA_SQL);
}

export type PostgresStoreOptions = {
  sql: SqlClient;
  /** Identifies this app's reports in a shared database. REQUIRED — a default
   *  here would silently mix two projects' reports together. */
  projectId: string;
};

export class PostgresReportStore implements ReportStore {
  private readonly sql: SqlClient;
  private readonly projectId: string;

  constructor(opts: PostgresStoreOptions) {
    if (!opts.projectId) throw new Error("loopix: projectId is required");
    this.sql = opts.sql;
    this.projectId = opts.projectId;
  }

  /** Stamped into the document so the generated column can index it, and so a
   *  row is self-describing if it is ever exported on its own. */
  private stamp(r: LoopReport): LoopReport & { projectId: string } {
    return { ...r, projectId: this.projectId };
  }

  async append(record: LoopReport): Promise<void> {
    await this.sql.query(
      `INSERT INTO loopix_reports (id, doc) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [record.id, JSON.stringify(this.stamp(record))],
    );
    await this.event(record.id, "created", { status: record.status }, record.reporterSub);
  }

  /** Newest last, matching FileReportStore so callers behave identically. */
  async list(): Promise<LoopReport[]> {
    const { rows } = await this.sql.query(
      `SELECT doc FROM loopix_reports WHERE project_id = $1 ORDER BY created_at ASC`,
      [this.projectId],
    );
    return rows.map((r) => r.doc as LoopReport);
  }

  async get(id: string): Promise<LoopReport | null> {
    const { rows } = await this.sql.query(
      `SELECT doc FROM loopix_reports WHERE project_id = $1 AND id = $2`,
      [this.projectId, id],
    );
    return (rows[0]?.doc as LoopReport) ?? null;
  }

  /**
   * Shallow merge, done inside the database. `doc || $3` is Postgres' own JSONB
   * merge, so two writers cannot lose each other's change the way read-modify-
   * write in application code does — which is exactly how a triage watcher and
   * a human clicking approve would collide.
   */
  async patch(id: string, fields: Record<string, unknown>): Promise<LoopReport | null> {
    const { rows } = await this.sql.query(
      `UPDATE loopix_reports
          SET doc = doc || $3::jsonb, updated_at = now()
        WHERE project_id = $1 AND id = $2
        RETURNING doc`,
      [this.projectId, id, JSON.stringify(fields)],
    );
    const doc = (rows[0]?.doc as LoopReport) ?? null;
    if (doc) {
      const actor =
        (fields.review as { by?: string } | undefined)?.by ??
        (typeof fields.status === "string" ? "agent" : undefined);
      await this.event(id, "patched", fields, actor);
    }
    return doc;
  }

  /** Append to the history. Never updated, never deleted. */
  async event(
    reportId: string,
    type: string,
    detail?: Record<string, unknown>,
    actor?: string,
  ): Promise<void> {
    await this.sql.query(
      `INSERT INTO loopix_events (project_id, report_id, actor, type, detail)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [this.projectId, reportId, actor ?? null, type, JSON.stringify(detail ?? {})],
    );
  }

  /** The changelog for one report: what happened, when, by whom. */
  async history(reportId: string): Promise<
    { at: string; actor: string | null; type: string; detail: Record<string, unknown> }[]
  > {
    const { rows } = await this.sql.query(
      `SELECT at, actor, type, detail FROM loopix_events
        WHERE project_id = $1 AND report_id = $2 ORDER BY seq ASC`,
      [this.projectId, reportId],
    );
    return rows as never;
  }

  /** "Show me what I reported." The host passes the subject id from its own
   *  session — this method never decides who is asking. */
  async byReporter(sub: string): Promise<LoopReport[]> {
    const { rows } = await this.sql.query(
      `SELECT doc FROM loopix_reports
        WHERE project_id = $1 AND reporter = $2 ORDER BY created_at DESC`,
      [this.projectId, sub],
    );
    return rows.map((r) => r.doc as LoopReport);
  }
}
