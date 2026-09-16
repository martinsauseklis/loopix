"use client";

import { useEffect, useRef, useState } from "react";
import type { ElementContext, Intent, Severity } from "@loopix/core";
import { buildReport, whereLabel } from "./capture";

// Two doors, asked first: a defect, or something that does not exist yet.
// Without this the fixer is told a feature request is "user error" and refuses.
const INTENTS: { value: Intent; label: string; hint: string }[] = [
  { value: "bug", label: "Something's broken", hint: "It doesn't do what it should" },
  { value: "feature", label: "I want something new", hint: "Describe what it should do" },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "minor", label: "Minor" },
  { value: "annoying", label: "Annoying" },
  { value: "blocking", label: "Blocking" },
];

export default function ReportModal({
  context,
  point,
  onClose,
  reportPath,
  appVersion,
}: {
  context: ElementContext;
  /** Exact viewport coords of the right-click, so the user can still see the
   *  spot they are reporting once the overlay dims the page. */
  point?: { x: number; y: number } | null;
  onClose: () => void;
  reportPath: string;
  appVersion?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [intent, setIntent] = useState<Intent>("bug");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Which half the dialog sits in. Default: opposite half from the click, so
  // the marker is never behind it. Re-checked after layout for tall dialogs.
  const [place, setPlace] = useState<"center" | "top" | "bottom">(() => {
    if (!point || typeof window === "undefined") return "center";
    return point.y > window.innerHeight / 2 ? "top" : "bottom";
  });

  // A tall dialog can still reach into the other half — measure once it exists
  // and flip if it actually covers the marker.
  useEffect(() => {
    if (!point) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const covered =
      point.x >= r.left - 12 && point.x <= r.right + 12 &&
      point.y >= r.top - 12 && point.y <= r.bottom + 12;
    if (covered) setPlace(point.y > window.innerHeight / 2 ? "top" : "bottom");
  }, [point, place]);

  useEffect(() => {
    textareaRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const bundle = buildReport(context, {
      message: message.trim() || null,
      // Severity only means something for a defect.
      severity: intent === "bug" ? severity : null,
      intent,
      appVersion,
    });
    try {
      const res = await fetch(reportPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(bundle),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setSent(true);
      setTimeout(onClose, 1100);
    } catch {
      setError("Couldn't send the report. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className={
        "fixed inset-0 z-[10000] flex justify-center bg-black/40 p-4 " +
        (place === "top" ? "items-start" : place === "bottom" ? "items-end" : "items-center")
      }
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The spot being reported. The overlay dims the page, so without this the
          user loses the thing they just clicked. Outline = the element,
          dot = the exact point. Both sit ABOVE the dim, ignore the pointer. */}
      {point && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed rounded ring-2 ring-red-400 ring-offset-2 ring-offset-transparent"
            style={{
              left: context.rect.x,
              top: context.rect.y,
              width: context.rect.w,
              height: context.rect.h,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.12)", // lifts it out of the dim
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none fixed block h-3 w-3 animate-ping rounded-full bg-red-500"
            style={{ left: point.x - 6, top: point.y - 6 }}
          />
          <span
            aria-hidden
            className="pointer-events-none fixed block h-3 w-3 rounded-full border-2 border-white bg-red-500 shadow"
            style={{ left: point.x - 6, top: point.y - 6 }}
          />
        </>
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report a problem"
        className="w-full max-w-md overflow-hidden rounded-xl bg-white text-gray-900 shadow-2xl dark:bg-neutral-900 dark:text-gray-100"
      >
        {sent ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="font-medium">Thanks — report sent</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We captured where you clicked. We&apos;ll take it from here.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 border-b border-black/5 px-5 py-4 dark:border-white/5">
              <div>
                <h2 className="text-base font-semibold">Report a problem</h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  We already know where you clicked — a message is optional.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded p-1 text-gray-400 transition hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm dark:bg-white/5">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Reporting</div>
                <div className="mt-0.5 font-medium">{whereLabel(context)}</div>
                <div className="mt-1 truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                  {context.route} · {context.selector}
                </div>
              </div>

              <div className="flex gap-2">
                {INTENTS.map((o) => {
                  const active = intent === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setIntent(o.value)}
                      className={
                        "flex-1 rounded-lg border px-3 py-2 text-left text-sm transition " +
                        (active
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                          : "border-black/10 hover:border-blue-300 dark:border-white/15")
                      }
                    >
                      <span className="block font-medium">{o.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">{o.hint}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label htmlFor="loopix-report-message" className="mb-1 block text-sm font-medium">
                  {intent === "bug" ? "What went wrong?" : "What should it do?"}{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="loopix-report-message"
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder={
                    intent === "bug"
                      ? "e.g. clicking this did nothing / it shows the wrong total…"
                      : "e.g. add a Clear all button / let me reorder the list…"
                  }
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-white/10 dark:bg-neutral-800 dark:focus:ring-red-900/40"
                />
              </div>

              <div hidden={intent !== "bug"}>
                <div className="mb-1.5 text-sm font-medium">
                  How bad is it? <span className="font-normal text-gray-400">(optional)</span>
                </div>
                <div className="flex gap-2">
                  {SEVERITIES.map((s) => {
                    const active = severity === s.value;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(active ? null : s.value)}
                        className={
                          "rounded-full border px-3 py-1 text-sm transition " +
                          (active
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-black/10 hover:border-red-300 dark:border-white/15")
                        }
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-black/5 px-5 py-3 dark:border-white/5">
              <p className="text-sm text-red-600 dark:text-red-400" role={error ? "alert" : undefined}>
                {error}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-black/5 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send report"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
