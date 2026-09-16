// loopix's own stylesheet, shipped as a string.
//
// Why a string and not a .css file: this UI is an overlay dropped onto someone
// else's app. It must not require the host to run Tailwind, configure a
// bundler, or import anything — the SDK injects this once at mount. It is also
// the form a shadow root needs later, so this file is the prerequisite for
// real isolation rather than a detour.
//
// Rules for anything added here:
//  * every class is prefixed `lpx-`, so it can never collide with the host;
//  * the root sets `all: initial` — a host's `button {}` or `* { box-sizing }`
//    must not reach in;
//  * colours come from `--lpx-*` variables, so a host CAN theme it on purpose
//    (variables are the one thing we want crossing the boundary);
//  * no `!important`: specificity is handled by scoping under `.lpx-root`.

export const LOOPIX_CSS = `
.lpx-root {
  all: initial;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;

  /* DELIBERATELY NOT THEMED BY THE HOST.
     loopix is a tool layered on top of someone else's product, and a user must
     never think it is part of the app they are using. So it wears dark
     developer-tool chrome in every host, light or dark — the same reason the
     browser's own devtools do not adopt the page's colours. The only thing a
     host can change is --lpx-accent, if it really wants to. */
  --lpx-bg: #15151b;
  --lpx-bg-raise: #1d1d26;
  --lpx-fg: #ecedf2;
  --lpx-muted: #9b9bab;
  --lpx-line: rgba(255,255,255,.10);
  --lpx-line-soft: rgba(255,255,255,.06);
  --lpx-surface: rgba(255,255,255,.04);
  --lpx-accent: #a78bfa;            /* violet: rare in product UI, reads as "tooling" */
  --lpx-accent-fg: #14101f;
  --lpx-danger: #f87171;
  --lpx-ok: #4ade80;
  --lpx-ok-bg: rgba(74,222,128,.14);
  --lpx-mark: #fb7185;
  --lpx-shadow: 0 24px 60px -12px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08);
  --lpx-radius: 14px;
  --lpx-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

/* every descendant resets the few properties a host is most likely to set */
.lpx-root *, .lpx-root *::before, .lpx-root *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
}

/* ── overlay ─────────────────────────────────────────────── */
.lpx-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;        /* above host modals, below the browser's own UI */
  display: flex;
  justify-content: center;
  padding: 16px;
  background: rgba(0,0,0,.45);
}
.lpx-overlay[data-place="top"] { align-items: flex-start; }
.lpx-overlay[data-place="bottom"] { align-items: flex-end; }
.lpx-overlay[data-place="center"] { align-items: center; }

/* ── the reported spot ───────────────────────────────────── */
.lpx-mark-box {
  position: fixed;
  pointer-events: none;
  border-radius: 4px;
  outline: 2px solid var(--lpx-mark);
  outline-offset: 2px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,.12);   /* lifts it out of the dim */
}
.lpx-mark-dot, .lpx-mark-ping {
  position: fixed;
  pointer-events: none;
  width: 12px; height: 12px;
  border-radius: 999px;
  background: var(--lpx-mark);
}
.lpx-mark-dot { border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
.lpx-mark-ping { animation: lpx-ping 1.1s cubic-bezier(0,0,.2,1) infinite; }
@keyframes lpx-ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .lpx-mark-ping { animation: none; } }

/* ── dialog ──────────────────────────────────────────────── */
.lpx-card {
  width: 100%;
  max-width: 28rem;
  overflow: hidden;
  border-radius: var(--lpx-radius);
  background: var(--lpx-bg);
  color: var(--lpx-fg);
  box-shadow: var(--lpx-shadow);
  /* a thin lit edge: reads as a pane floating ABOVE the page, not a card in it */
  border: 1px solid var(--lpx-line);
}

/* ── the wordmark: this is a tool, and it says so ────────── */
.lpx-brand {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 20px;
  background: var(--lpx-bg-raise);
  border-bottom: 1px solid var(--lpx-line-soft);
}
.lpx-brand-dot {
  width: 8px; height: 8px; border-radius: 999px;
  background: var(--lpx-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--lpx-accent) 25%, transparent);
}
.lpx-brand-name {
  font-family: var(--lpx-mono);
  font-size: .8125rem; font-weight: 600; letter-spacing: .02em;
  color: var(--lpx-fg);
}
.lpx-brand-tag {
  margin-left: auto;
  font-family: var(--lpx-mono);
  font-size: .625rem; letter-spacing: .12em; text-transform: uppercase;
  color: var(--lpx-muted);
}
.lpx-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--lpx-line-soft);
}
.lpx-title { font-size: .9375rem; font-weight: 600; }
.lpx-sub { margin-top: 2px; font-size: .75rem; color: var(--lpx-muted); }
.lpx-body { display: grid; gap: 16px; padding: 16px 20px; }
.lpx-foot {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--lpx-line-soft);
  background: var(--lpx-surface);
}

.lpx-where {
  border-radius: 8px;
  background: var(--lpx-surface);
  padding: 10px 12px;
  font-size: .875rem;
}
.lpx-where-label {
  font-family: var(--lpx-mono);
  font-size: .6875rem; font-weight: 500; letter-spacing: .06em;
  text-transform: uppercase; color: var(--lpx-muted);
}
.lpx-where-name { margin-top: 2px; font-weight: 500; }
.lpx-where-path {
  margin-top: 4px; font-size: .75rem; color: var(--lpx-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── the two doors ───────────────────────────────────────── */
.lpx-choices { display: flex; gap: 8px; }
.lpx-choice {
  flex: 1; cursor: pointer;
  border: 1px solid var(--lpx-line);
  border-radius: 8px;
  padding: 8px 12px;
  transition: border-color .12s, background .12s;
}
.lpx-choice:hover { border-color: var(--lpx-accent); }
.lpx-choice[aria-pressed="true"] {
  border-color: var(--lpx-accent);
  background: color-mix(in srgb, var(--lpx-accent) 10%, transparent);
}
.lpx-choice-t { display: block; font-size: .875rem; font-weight: 500; }
.lpx-choice-h { display: block; font-size: .75rem; color: var(--lpx-muted); }

.lpx-label { display: block; margin-bottom: 4px; font-size: .875rem; font-weight: 500; }
.lpx-optional { font-weight: 400; color: var(--lpx-muted); }
.lpx-textarea {
  width: 100%; resize: none;
  border: 1px solid var(--lpx-line);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: .875rem;
  background: var(--lpx-bg);
  color: var(--lpx-fg);
  outline: none;
}
.lpx-textarea:focus { border-color: var(--lpx-accent); }

.lpx-pills { display: flex; gap: 8px; }
.lpx-pill {
  cursor: pointer;
  border: 1px solid var(--lpx-line);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: .875rem;
}
.lpx-pill[aria-pressed="true"] {
  border-color: var(--lpx-danger);
  background: var(--lpx-danger);
  color: #fff;
}

/* ── buttons ─────────────────────────────────────────────── */
.lpx-btn {
  cursor: pointer;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: .875rem;
  font-weight: 500;
  min-height: 40px;
  transition: opacity .12s, background .12s;
}
.lpx-btn:disabled { opacity: .55; cursor: default; }
.lpx-btn-primary { background: var(--lpx-accent); color: var(--lpx-accent-fg); }
.lpx-btn-ghost { color: var(--lpx-muted); }
.lpx-btn-ghost:hover { color: var(--lpx-fg); }
.lpx-icon-btn {
  cursor: pointer; border-radius: 8px; padding: 4px;
  color: var(--lpx-muted); line-height: 0;
}
.lpx-icon-btn:hover { color: var(--lpx-fg); }
.lpx-root :focus-visible { outline: 2px solid var(--lpx-accent); outline-offset: 2px; }

/* ── sent ────────────────────────────────────────────────── */
.lpx-sent { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 24px; text-align: center; }
.lpx-sent * { text-align: center; }
.lpx-check {
  display: flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 999px;
  background: var(--lpx-ok-bg); color: var(--lpx-ok);
}
.lpx-sent-t { font-weight: 500; }
.lpx-sent-s { font-size: .875rem; color: var(--lpx-muted); }
.lpx-error { font-size: .875rem; color: var(--lpx-danger); }
`;
