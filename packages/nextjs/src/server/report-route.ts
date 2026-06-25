import { randomUUID } from "node:crypto";
import { resolveFlags, type LoopixServerConfig, type LoopReport } from "@loopix/core";

// Untrusted browser input → re-validated and size-capped here.
const MAX_BYTES = 64 * 1024;
const MAX_MESSAGE = 2000;
const MAX_STR = 1000;
const MAX_ARR = 32;

const SEVERITIES = ["minor", "annoying", "blocking"] as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = MAX_STR): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const strArr = (v: unknown, max = MAX_STR): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, MAX_ARR).map((x) => x.slice(0, max))
    : [];
const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);

function sanitize(body: unknown) {
  if (!isObj(body)) return null;
  const ctx = isObj(body.context) ? body.context : {};
  const report = isObj(body.report) ? body.report : {};
  const page = isObj(body.page) ? body.page : {};
  const rect = isObj(ctx.rect) ? ctx.rect : {};

  const dataset: Record<string, string> = {};
  if (isObj(ctx.dataset)) {
    for (const [k, v] of Object.entries(ctx.dataset).slice(0, MAX_ARR)) {
      if (typeof v === "string") dataset[k.slice(0, 64)] = v.slice(0, MAX_STR);
    }
  }
  const sev = str(report.severity) as (typeof SEVERITIES)[number] | null;

  return {
    report: {
      message: str(report.message, MAX_MESSAGE),
      severity: sev && SEVERITIES.includes(sev) ? sev : null,
    },
    context: {
      selector: str(ctx.selector) ?? "",
      tag: str(ctx.tag, 40) ?? "",
      id: str(ctx.id, 200),
      classes: strArr(ctx.classes, 200),
      text: str(ctx.text, 200),
      dataset,
      rect: { x: int(rect.x), y: int(rect.y), w: int(rect.w), h: int(rect.h) },
      componentStack: strArr(ctx.componentStack, 100),
      route: str(ctx.route, 500) ?? "",
    },
    page: {
      url: str(page.url, 2000) ?? undefined,
      userAgent: str(page.userAgent, 500) ?? undefined,
      viewport: str(page.viewport, 40) ?? undefined,
    },
    clientTs: str(body.ts, 40),
  };
}

// Factory for the public ingest handler: `export const POST = createReportRoute(config)`.
export function createReportRoute(config: LoopixServerConfig) {
  return async function POST(request: Request): Promise<Response> {
    const flags = resolveFlags(config.flags);
    if (!flags.enabled || !flags.capture) {
      return Response.json({ ok: false, error: "loopix capture disabled" }, { status: 404 });
    }
    if (config.killSwitch && (await config.killSwitch())) {
      return Response.json({ ok: false, error: "loopix paused" }, { status: 503 });
    }

    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return Response.json({ ok: false, error: "payload too large" }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(buf));
    } catch {
      return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
    }
    const clean = sanitize(body);
    if (!clean) return Response.json({ ok: false, error: "invalid report" }, { status: 400 });

    const record: LoopReport = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      status: "new",
      serviceId: config.services?.[0]?.id,
      ...clean,
    };

    try {
      await config.store.append(record);
    } catch (err) {
      console.error("[loopix] failed to persist report", err);
      return Response.json({ ok: false, error: "storage error" }, { status: 500 });
    }
    return Response.json({ ok: true, id: record.id }, { status: 201 });
  };
}
