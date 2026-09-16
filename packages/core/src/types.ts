// The loopix report schema — the contract between capture SDKs and the loop.
// Framework-agnostic: no DOM/React imports here.

export type Severity = "minor" | "annoying" | "blocking";
export type Intent = "bug" | "feature";

// Rich "where" context captured from a clicked element.
export type ElementContext = {
  selector: string;
  tag: string;
  id: string | null;
  classes: string[];
  text: string | null;
  dataset: Record<string, string>;
  rect: { x: number; y: number; w: number; h: number };
  componentStack: string[]; // nearest component names (minified in prod)
  route: string;
};

// What a capture SDK POSTs to the ingest endpoint.
export type ReportBundle = {
  schema: "1.0";
  kind: "user_report";
  ts: string;
  // `intent` says which door the user came through: a defect, or something
  // they want that does not exist yet. Triage and the fixer read it — without
  // it a feature request is diagnosed as 'user error' and never gets built.
  report: { message: string | null; severity: Severity | null; intent?: Intent };
  context: ElementContext;
  page: { url: string; userAgent: string; viewport: string };
  buffer: null; // reserved: rolling breadcrumb buffer
};

export type ReportStatus =
  | "new"
  | "triaging"
  | "triaged"
  | "fixing"
  | "fix_ready"
  | "merged"
  | "rejected"
  | "triage_failed"
  | "fix_failed";

export type Diagnosis = {
  summary?: string;
  category?: string; // bug | feature | confusion | noise
  reproducible?: boolean;
  suspectedCause?: string;
  suggestedFix?: string;
  filesInspected?: string[];
  autoFixable?: boolean;
  confidence?: number;
  targetServiceId?: string; // multi-repo routing (Phase 1)
  raw?: string;
};

// The stored, server-authoritative record. `status` is widened to string so
// callers can set transitional values without fighting the union.
export type LoopReport = {
  id: string;
  receivedAt: string;
  status: ReportStatus | string;
  serviceId?: string; // which service/repo this report belongs to
  // `intent` says which door the user came through: a defect, or something
  // they want that does not exist yet. Triage and the fixer read it — without
  // it a feature request is diagnosed as 'user error' and never gets built.
  report: { message: string | null; severity: Severity | null; intent?: Intent };
  context: ElementContext;
  page?: { url?: string; userAgent?: string; viewport?: string };
  clientTs?: string | null;
  diagnosis?: Diagnosis;
  triage?: {
    model?: string;
    session_id?: string;
    cost_usd?: number;
    denials?: number;
    at?: string;
  };
  triageError?: string;
  triageFailureKind?: string;
  fix?: {
    branch?: string;
    base?: string;
    model?: string;
    summary?: string;
    cost_usd?: number;
    session_id?: string;
    tscPass?: boolean;
    tscOut?: string | null;
    diff?: string;
    at?: string;
    error?: string;
    failureKind?: string;
  };
  merge?: { at?: string; commit?: string };
  rejectedAt?: string;
};

// Short human label for a clicked thing, e.g. `"Like" in PostCard`. Pure —
// shared by the dashboard and any server-side rendering.
export function whereLabel(ctx: ElementContext): string {
  const comp = ctx.componentStack[0];
  const snippet = ctx.text
    ? `“${ctx.text.slice(0, 40)}${ctx.text.length > 40 ? "…" : ""}”`
    : null;
  if (comp && snippet) return `${snippet} in ${comp}`;
  if (comp) return `<${ctx.tag}> in ${comp}`;
  if (snippet) return `<${ctx.tag}> ${snippet}`;
  return `<${ctx.tag}>`;
}
