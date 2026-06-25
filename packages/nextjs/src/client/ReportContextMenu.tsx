"use client";

import { useCallback, useEffect, useState } from "react";
import type { ElementContext } from "@loopix/core";
import { describeElement } from "./capture";
import ReportModal from "./ReportModal";

type MenuState = { x: number; y: number; target: Element };

const MENU_W = 220;
const MENU_H = 96;

export default function ReportContextMenu({ reportPath }: { reportPath: string }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [reporting, setReporting] = useState<ElementContext | null>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      if ((e.target as Element)?.closest?.("[data-loopix-menu]")) return;
      e.preventDefault();
      const target = e.target as Element;
      const x = Math.min(e.clientX, window.innerWidth - MENU_W - 8);
      const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8);
      setMenu({ x, y, target });
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

  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      if (!(e.target as Element)?.closest?.("[data-loopix-menu]")) close();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu, close]);

  function handleReport() {
    if (!menu) return;
    setReporting(describeElement(menu.target));
    close();
  }

  return (
    <>
      {reporting && (
        <ReportModal context={reporting} onClose={() => setReporting(null)} reportPath={reportPath} />
      )}
      {menu && <Menu menu={menu} onReport={handleReport} />}
    </>
  );
}

function Menu({ menu, onReport }: { menu: MenuState; onReport: () => void }) {
  return (
    <div
      data-loopix-menu
      role="menu"
      style={{ top: menu.y, left: menu.x, width: MENU_W }}
      className="fixed z-[9999] overflow-hidden rounded-lg border border-black/10 bg-white text-sm text-gray-900 shadow-xl dark:border-white/10 dark:bg-neutral-900 dark:text-gray-100"
    >
      <div className="border-b border-black/5 px-3 py-2 text-xs font-medium text-gray-500 dark:border-white/5 dark:text-gray-400">
        Found a problem here?
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={onReport}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="m8 2 1.88 1.88" />
          <path d="M14.12 3.88 16 2" />
          <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
          <path d="M12 20v-9" />
        </svg>
        Report a bug here
      </button>
    </div>
  );
}
