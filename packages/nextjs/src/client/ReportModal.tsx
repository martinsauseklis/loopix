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
      data-loopix-ignore
      className="lpx-root lpx-overlay"
      data-place={place}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* The spot being reported. The overlay dims the page, so without this the
          user loses the thing they just clicked. Box = the element,
          dot = the exact point. Both sit above the dim and ignore the pointer. */}
      {point && (
        <>
          <div
            aria-hidden
            className="lpx-mark-box"
            style={{
              left: context.rect.x,
              top: context.rect.y,
              width: context.rect.w,
              height: context.rect.h,
            }}
          />
          <span aria-hidden className="lpx-mark-ping" style={{ left: point.x - 6, top: point.y - 6 }} />
          <span aria-hidden className="lpx-mark-dot" style={{ left: point.x - 6, top: point.y - 6 }} />
        </>
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Report a problem"
        className="lpx-card"
      >
        <div className="lpx-brand">
          <span className="lpx-brand-dot" aria-hidden />
          <span className="lpx-brand-name">loopix</span>
          <span className="lpx-brand-tag">feedback tool</span>
        </div>
        {sent ? (
          <div className="lpx-sent">
            <div className="lpx-check">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="24"
                height="24"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p className="lpx-sent-t">Thanks — report sent</p>
            <p className="lpx-sent-s">
              We captured where you clicked. We&apos;ll take it from here.
            </p>
          </div>
        ) : (
          <>
            <div className="lpx-head">
              <div>
                <h2 className="lpx-title">Report a problem</h2>
                <p className="lpx-sub">We already know where you clicked — a message is optional.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="lpx-icon-btn">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="lpx-body">
              <div className="lpx-where">
                <div className="lpx-where-label">Reporting</div>
                <div className="lpx-where-name">{whereLabel(context)}</div>
                <div className="lpx-where-path">
                  {context.route} · {context.selector}
                </div>
              </div>

              <div className="lpx-choices">
                {INTENTS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={intent === o.value}
                    onClick={() => setIntent(o.value)}
                    className="lpx-choice"
                  >
                    <span className="lpx-choice-t">{o.label}</span>
                    <span className="lpx-choice-h">{o.hint}</span>
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="loopix-report-message" className="lpx-label">
                  {intent === "bug" ? "What went wrong?" : "What should it do?"}{" "}
                  <span className="lpx-optional">(optional)</span>
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
                  className="lpx-textarea"
                />
              </div>

              <div hidden={intent !== "bug"}>
                <div className="lpx-label">
                  How bad is it? <span className="lpx-optional">(optional)</span>
                </div>
                <div className="lpx-pills">
                  {SEVERITIES.map((sv) => (
                    <button
                      key={sv.value}
                      type="button"
                      aria-pressed={severity === sv.value}
                      onClick={() => setSeverity(severity === sv.value ? null : sv.value)}
                      className="lpx-pill"
                    >
                      {sv.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lpx-foot">
              <p className="lpx-error" role={error ? "alert" : undefined}>
                {error}
              </p>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="lpx-btn lpx-btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="lpx-btn lpx-btn-primary"
              >
                {submitting ? "Sending…" : "Send report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
