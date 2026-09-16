// The loopix report schema — the contract between capture SDKs and the loop.
// Framework-agnostic: no DOM/React imports here.

export type Severity = "minor" | "annoying" | "blocking";

export type ClientEnv = {
  /** Release the user was actually running — the first question on any ticket. */
  appVersion: string | null;
  browser: string;        // "Chrome 141"
  os: string;             // "Windows 11"
  device: "desktop" | "mobile" | "tablet";
  touch: boolean;
  viewport: string;       // "1280x800" — what they saw
  screen: string;         // "2560x1440" — what they have
  dpr: number;            // retina/scaling bugs
  orientation: "portrait" | "landscape";
  language: string;       // "lv-LV"
  timezone: string;       // correlates with server logs
  colorScheme: "light" | "dark";
  reducedMotion: boolean;
  online: boolean;
  connection: string | null; // "4g" | "slow-2g" — "it's stuck loading"
  /** Random per-tab id. Not a user id, not stored — lets several reports from
   *  one session be recognised as one story. */
  sessionId: string;
};

export type ClientError = {
  ts: string;
  message: string;
  source: "error" | "unhandledrejection" | "http";
  /** First frames only — enough to locate, short enough to read. */
  stack?: string;
  /** For source:"http" — the failing path and status. Never the body. */
  path?: string;
  status?: number;
};
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
  /** What the user was running. Every field is a number, boolean or short
   *  closed-vocabulary string — never user content. This is what turns
   *  "doesn't work" into "Safari 17 on iOS, 390px wide, offline". */
  client?: ClientEnv;
  /** Script errors seen in this tab before the report, newest last. Message and
   *  stack only — the highest-signal field for triage after the message itself. */
  errors?: ClientError[];
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
  client?: ClientEnv;
  errors?: ClientError[];
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
