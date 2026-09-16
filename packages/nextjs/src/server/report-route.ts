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
  const intent = str(report.intent, 20);

  // The client block arrives from the browser, so it is re-validated here like
  // everything else: each field clamped, each enum checked, nothing trusted.
  const c = isObj(body.client) ? (body.client as Record<string, unknown>) : null;
  const client = c
    ? {
        appVersion: str(c.appVersion, 80),
        browser: str(c.browser, 60) ?? "unknown",
        os: str(c.os, 60) ?? "unknown",
        device: (["desktop", "mobile", "tablet"].includes(String(c.device))
          ? String(c.device)
          : "desktop") as "desktop" | "mobile" | "tablet",
        touch: c.touch === true,
        viewport: str(c.viewport, 40) ?? "",
        screen: str(c.screen, 40) ?? "",
        dpr: Number.isFinite(Number(c.dpr)) ? Number(c.dpr) : 1,
        orientation: (c.orientation === "portrait" ? "portrait" : "landscape") as
          | "portrait"
          | "landscape",
        language: str(c.language, 20) ?? "",
        timezone: str(c.timezone, 60) ?? "",
        colorScheme: (c.colorScheme === "dark" ? "dark" : "light") as "light" | "dark",
        reducedMotion: c.reducedMotion === true,
        online: c.online !== false,
        connection: str(c.connection, 20),
        sessionId: str(c.sessionId, 40) ?? "",
      }
    : undefined;

  // The trail is user-path data from the browser: clamp every field, check the
  // type against the closed set, cap the length.
  const TYPES = ["nav", "click", "input", "submit", "http", "console"];
  const buffer = Array.isArray(body.buffer)
    ? (body.buffer as unknown[]).slice(-40).map((b) => {
        const o = isObj(b) ? (b as Record<string, unknown>) : {};
        return {
          ts: str(o.ts, 40) ?? "",
          type: (TYPES.includes(String(o.type)) ? String(o.type) : "click") as
            | "nav" | "click" | "input" | "submit" | "http" | "console",
          detail: str(o.detail, 200) ?? "",
          label: str(o.label, 200) ?? undefined,
          status: Number.isFinite(Number(o.status)) ? Number(o.status) : undefined,
          ms: Number.isFinite(Number(o.ms)) ? Number(o.ms) : undefined,
        };
      })
    : undefined;

  // Errors: message/stack are developer strings, but they can quote user input,
  // so they are clamped hard and capped in number.
  const errors = Array.isArray(body.errors)
    ? (body.errors as unknown[]).slice(-8).map((e) => {
        const o = isObj(e) ? (e as Record<string, unknown>) : {};
        return {
          ts: str(o.ts, 40) ?? "",
          source: (["error", "unhandledrejection", "http"].includes(String(o.source))
            ? String(o.source)
            : "error") as "error" | "unhandledrejection" | "http",
          message: str(o.message, 300) ?? "",
          stack: str(o.stack, 600) ?? undefined,
          path: str(o.path, 300) ?? undefined,
          status: Number.isFinite(Number(o.status)) ? Number(o.status) : undefined,
        };
      })
    : undefined;

  return {
    report: {
      message: str(report.message, MAX_MESSAGE),
      severity: sev && SEVERITIES.includes(sev) ? sev : null,
      intent: intent === "feature" ? ("feature" as const) : ("bug" as const),
    },
    client,
    errors,
    buffer,
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

    // Identity comes from the host's own session, never from the payload:
    // anything the browser sends about who it is, is a claim, not a fact.
    let reporterSub: string | undefined;
    try {
      reporterSub = (await config.identify?.(request))?.sub;
    } catch {
      // An identity lookup that fails must not lose the report — an anonymous
      // report is worth more than no report.
    }

    const record: LoopReport = {
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      status: "new",
      serviceId: config.services?.[0]?.id,
      reporterSub,
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
