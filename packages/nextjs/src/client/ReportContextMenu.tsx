"use client";

import { useCallback, useEffect, useState } from "react";
import type { ElementContext } from "@loopix/core";
import { describeElement } from "./capture";
import ReportModal from "./ReportModal";

// Where the user actually right-clicked, in viewport coordinates. Kept so the
// modal can show the exact spot — otherwise the page dims and people lose
// track of what they were reporting.
type ClickPoint = { x: number; y: number };

export default function ReportContextMenu({ reportPath }: { reportPath: string }) {
  const [reporting, setReporting] = useState<ElementContext | null>(null);
  const [point, setPoint] = useState<ClickPoint | null>(null);

  const close = useCallback(() => {
    setReporting(null);
    setPoint(null);
  }, []);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if ((e.target as Element)?.closest?.("[data-loopix-menu]")) return;
      e.preventDefault();
      // Straight to the modal: it now asks bug-or-feature, which is the only
      // choice the intermediate menu ever offered.
      setPoint({ x: e.clientX, y: e.clientY });
      setReporting(describeElement(e.target as Element));
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  return (
    <>
      {reporting && (
        <ReportModal
          context={reporting}
          point={point}
          onClose={close}
          reportPath={reportPath}
        />
      )}
    </>
  );
}
