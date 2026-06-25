"use client";

import ReportContextMenu from "./ReportContextMenu";

// The single integration seam. Mount once (e.g. in the root layout). Renders
// the capture context menu when enabled; renders nothing when disabled, so the
// host can turn loopix off in one place. `NEXT_PUBLIC_LOOPIX=off` is the
// build-time master kill (the body is dead-code-eliminated).
export function LoopixProvider({
  enabled = true,
  capture = true,
  reportPath = "/api/loop/report",
}: {
  enabled?: boolean;
  capture?: boolean;
  reportPath?: string;
}) {
  if (process.env.NEXT_PUBLIC_LOOPIX === "off") return null;
  if (!enabled || !capture) return null;
  return <ReportContextMenu reportPath={reportPath} />;
}
