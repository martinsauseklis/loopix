// Injects loopix's stylesheet once per document.
//
// Kept separate from the components so the same CSS can later be handed to a
// shadow root instead of the document head — that swap is then a one-line
// change here, not a rewrite of the UI.

import { LOOPIX_CSS } from "./styles";

const TAG_ID = "loopix-styles";

export function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(TAG_ID)) return; // idempotent: React mounts twice in dev
  const el = document.createElement("style");
  el.id = TAG_ID;
  el.textContent = LOOPIX_CSS;
  // First child of <head>: the host's own stylesheet still wins on ties, which
  // is the polite default for a widget. Our scoping under .lpx-root means ties
  // are rare, and a host that really wants to restyle us should be able to.
  document.head.prepend(el);
}
