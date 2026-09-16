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

  --lpx-bg: #ffffff;
  --lpx-fg: #111827;
  --lpx-muted: #6b7280;
  --lpx-line: rgba(0,0,0,.10);
  --lpx-line-soft: rgba(0,0,0,.06);
  --lpx-surface: #f9fafb;
  --lpx-accent: #2563eb;
  --lpx-accent-fg: #ffffff;
  --lpx-danger: #dc2626;
  --lpx-ok: #16a34a;
  --lpx-ok-bg: #dcfce7;
  --lpx-mark: #ef4444;
  --lpx-shadow: 0 20px 40px -12px rgba(0,0,0,.35);
  --lpx-radius: 12px;
}
@media (prefers-color-scheme: dark) {
  .lpx-root {
    --lpx-bg: #171717;
    --lpx-fg: #f3f4f6;
    --lpx-muted: #9ca3af;
    --lpx-line: rgba(255,255,255,.12);
    --lpx-line-soft: rgba(255,255,255,.07);
    --lpx-surface: rgba(255,255,255,.05);
    --lpx-accent: #60a5fa;
    --lpx-accent-fg: #0b1120;
    --lpx-ok: #4ade80;
    --lpx-ok-bg: rgba(22,163,74,.20);
  }
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
}
.lpx-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--lpx-line-soft);
}
.lpx-title { font-size: 1rem; font-weight: 600; }
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
