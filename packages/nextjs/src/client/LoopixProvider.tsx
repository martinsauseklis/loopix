"use client";

import { useEffect } from "react";
import ReportContextMenu from "./ReportContextMenu";
import { installErrorCapture } from "./env";
import { installTrail } from "./trail";
import { ensureStyles } from "./style-host";

// The single integration seam. Mount once (e.g. in the root layout). Renders
// the capture context menu when enabled; renders nothing when disabled, so the
// host can turn loopix off in one place. `NEXT_PUBLIC_LOOPIX=off` is the
// build-time master kill (the body is dead-code-eliminated).
export function LoopixProvider({
  enabled = true,
  capture = true,
  reportPath = "/api/loop/report",
  appVersion = null,
}: {
  enabled?: boolean;
  capture?: boolean;
  reportPath?: string;
  /** e.g. process.env.NEXT_PUBLIC_BUILD_SHA — "which build?" is the first
   *  question on every ticket, and only the host knows the answer. */
  appVersion?: string | null;
}) {
  // Listeners must be installed before anything breaks, not when the modal
  // opens — by then the error that caused the complaint is long gone.
  useEffect(() => {
    if (!enabled) return;
    ensureStyles();
    installErrorCapture();
    installTrail();
  }, [enabled]);

  if (process.env.NEXT_PUBLIC_LOOPIX === "off") return null;
  if (!enabled || !capture) return null;
  return <ReportContextMenu reportPath={reportPath} appVersion={appVersion} />;
}
