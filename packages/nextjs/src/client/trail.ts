// The journey: what the user did, and what the app did back, in one ordered
// list. A report then answers "what steps?" without anyone typing them.
//
// Three rules decide every line below:
//   1. Nothing is sent unless a report is filed. This is a ring in memory.
//   2. Never a value a human typed, and never a query string — either can hold
//      a name, an email or a token.
//   3. Everything is a short closed-vocabulary string or a number, so user
//      content has no field to leak through.

import type { Breadcrumb } from "@loopix/core";

const MAX = 40; // ~ the last minute of activity; enough to see the sequence
const trail: Breadcrumb[] = [];
let installed = false;

/** loopix's own traffic is not part of the user's journey — and a dashboard
 *  polling every 2s would evict every real step from the ring. */
function isOwnTraffic(path: string): boolean {
  return path.startsWith("/api/loop/");
}

function push(c: Breadcrumb) {
  trail.push(c);
  if (trail.length > MAX) trail.shift();
}

/** Path only. A query string is dropped whole rather than trimmed — it is the
 *  single most likely place for a token or an email to hide. */
function pathOf(raw: string): string {
  try {
    return new URL(raw, location.href).pathname.slice(0, 200);
  } catch {
    return "?";
  }
}

/** Console args can quote anything, so they are flattened to short strings and
 *  scrubbed of the two shapes that are almost always personal. */
function redact(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[token]")
    .slice(0, 200);
}

function labelOf(el: Element): string {
  const t = (el.textContent ?? "").trim().replace(/\s+/g, " ");
  return t ? t.slice(0, 40) : (el.getAttribute("aria-label") ?? "").slice(0, 40);
}

function selectorOf(el: Element): string {
  const id = el.id ? `#${el.id}` : "";
  const cls = typeof el.className === "string" && el.className
    ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
    : "";
  return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 80);
}

/** Install once, as early as possible: the useful crumbs happen before anyone
 *  decides to complain. Idempotent — React mounts twice in dev. */
export function installTrail(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const at = () => new Date().toISOString();
  push({ ts: at(), type: "nav", detail: location.pathname });

  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element)?.closest?.("button,a,[role=button],input,label,li");
      if (!el || el.closest("[data-loopix-menu],[data-loopix-ignore]")) return;
      push({ ts: at(), type: "click", detail: selectorOf(el), label: labelOf(el) });
    },
    true,
  );

  // WHICH field changed, never WHAT was typed.
  document.addEventListener(
    "change",
    (e) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.closest?.("[data-loopix-ignore]")) return;
      const len = typeof el.value === "string" ? el.value.length : 0;
      push({ ts: at(), type: "input", detail: selectorOf(el), label: `${len} chars` });
    },
    true,
  );

  document.addEventListener(
    "submit",
    (e) => push({ ts: at(), type: "submit", detail: selectorOf(e.target as Element) }),
    true,
  );

  // Client-side route changes: Next navigates without a page load, so
  // popstate alone misses most of them.
  const origPush = history.pushState;
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const r = origPush.apply(this, args);
    push({ ts: at(), type: "nav", detail: location.pathname });
    return r;
  };
  window.addEventListener("popstate", () =>
    push({ ts: at(), type: "nav", detail: location.pathname }),
  );

  // Requests: both outcomes. "POST /api/x → 200, then nothing happened" is a
  // different bug from "POST /api/x → 500".
  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const started = performance.now();
    const raw = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
    const method =
      (args[1]?.method ?? (typeof args[0] === "object" ? (args[0] as Request).method : "GET")) ||
      "GET";
    try {
      const res = await origFetch.apply(this, args);
      if (isOwnTraffic(pathOf(raw))) return res;
      push({
        ts: at(),
        type: "http",
        detail: `${method.toUpperCase()} ${pathOf(raw)}`,
        status: res.status,
        ms: Math.round(performance.now() - started),
      });
      return res;
    } catch (err) {
      if (isOwnTraffic(pathOf(raw))) throw err;
      push({
        ts: at(),
        type: "http",
        detail: `${method.toUpperCase()} ${pathOf(raw)}`,
        label: "network failure",
        ms: Math.round(performance.now() - started),
      });
      throw err;
    }
  };

  // console.error / console.warn only. console.log is where apps dump whole
  // objects of user data, and it is rarely what explains a bug.
  for (const level of ["error", "warn"] as const) {
    const orig = console[level];
    console[level] = function (...args: unknown[]) {
      push({
        ts: at(),
        type: "console",
        detail: level,
        label: redact(args.map((a) => (typeof a === "string" ? a : typeof a)).join(" ")),
      });
      orig.apply(console, args);
    };
  }
}

export function recentTrail(): Breadcrumb[] {
  return trail.slice();
}
