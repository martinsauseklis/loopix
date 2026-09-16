// What the user was running, and what already went wrong in this tab.
// Rules (host CLAUDE.md): numbers, booleans and short closed-vocabulary
// strings only — never user content, never field values, never tokens.

import type { ClientEnv, ClientError } from "@loopix/core";

// Per-tab, random, thrown away on close. Lets two reports from one session be
// recognised as one story without identifying anybody.
const SESSION_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

// Newest last. Small on purpose: a ring this size costs nothing and still
// catches the error that caused the click the user is complaining about.
const MAX_ERRORS = 8;
const errors: ClientError[] = [];
let installed = false;

function push(e: ClientError) {
  errors.push(e);
  if (errors.length > MAX_ERRORS) errors.shift();
}

/** Called once by the provider. Idempotent — React may mount twice in dev. */
export function installErrorCapture(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (ev) => {
    push({
      ts: new Date().toISOString(),
      source: "error",
      message: String(ev.message ?? "").slice(0, 300),
      stack: ev.error?.stack?.split("\n").slice(0, 4).join("\n").slice(0, 600),
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason as { message?: string; stack?: string } | string;
    push({
      ts: new Date().toISOString(),
      source: "unhandledrejection",
      message: String(typeof r === "string" ? r : (r?.message ?? r)).slice(0, 300),
      stack:
        typeof r === "object" && r?.stack
          ? r.stack.split("\n").slice(0, 4).join("\n").slice(0, 600)
          : undefined,
    });
  });

  // Failed requests: PATH and STATUS only. A query string can carry a token or
  // an email, so it is dropped rather than trimmed.
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await originalFetch.apply(this, args);
    try {
      if (!res.ok) {
        const raw = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
        push({
          ts: new Date().toISOString(),
          source: "http",
          message: `${res.status} ${res.statusText}`.trim(),
          path: new URL(raw, location.href).pathname,
          status: res.status,
        });
      }
    } catch {
      /* instrumentation must never break the request it is watching */
    }
    return res;
  };
}

export function recentErrors(): ClientError[] {
  return errors.slice();
}

// UA parsing, deliberately shallow: enough for a ticket title, no dependency.
// Order matters — Edge and Opera both claim to be Chrome.
function browserOf(ua: string): string {
  const m =
    /(Edg|EdgA)\/([\d.]+)/.exec(ua) ??
    /(OPR|Opera)\/([\d.]+)/.exec(ua) ??
    /(Firefox)\/([\d.]+)/.exec(ua) ??
    /(Chrome)\/([\d.]+)/.exec(ua) ??
    /Version\/([\d.]+).*(Safari)/.exec(ua);
  if (!m) return "unknown";
  const name = m[1] === "Edg" || m[1] === "EdgA" ? "Edge" : m[1] === "OPR" ? "Opera" : m[2] === "Safari" ? "Safari" : m[1];
  const version = (m[2] === "Safari" ? m[1] : m[2])?.split(".")[0] ?? "";
  return `${name} ${version}`.trim();
}

function osOf(ua: string): string {
  if (/Windows NT 10/.test(ua)) return "Windows 10/11";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android ([\d.]+)/.test(ua)) return `Android ${/Android ([\d.]+)/.exec(ua)![1]}`;
  if (/(iPhone|iPad).*OS ([\d_]+)/.test(ua))
    return `iOS ${/OS ([\d_]+)/.exec(ua)![1].replace(/_/g, ".")}`;
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "unknown";
}

/**
 * @param appVersion the release the app is running (a git SHA or tag). The host
 * passes it in — the SDK cannot know it, and "which build?" is the first thing
 * anyone asks on a ticket.
 */
export function collectEnv(appVersion?: string | null): ClientEnv {
  const ua = navigator.userAgent;
  const mobile = /Mobi|Android|iPhone/.test(ua);
  const tablet = /iPad/.test(ua) || (/Android/.test(ua) && !/Mobi/.test(ua));
  const conn = (navigator as { connection?: { effectiveType?: string } }).connection;

  return {
    appVersion: appVersion ?? null,
    browser: browserOf(ua),
    os: osOf(ua),
    device: tablet ? "tablet" : mobile ? "mobile" : "desktop",
    touch: navigator.maxTouchPoints > 0,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    dpr: Math.round(window.devicePixelRatio * 100) / 100,
    orientation: window.innerWidth >= window.innerHeight ? "landscape" : "portrait",
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorScheme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    online: navigator.onLine,
    connection: conn?.effectiveType ?? null,
    sessionId: SESSION_ID,
  };
}
