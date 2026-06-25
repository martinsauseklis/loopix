// Client entry. Server-only helpers (route factories, proxy) live in
// "@loopix/nextjs/server" so the client bundle never pulls in node:fs / git.
export { LoopixProvider } from "./client/LoopixProvider";
export { LoopixDashboard } from "./client/LoopixDashboard";
export { describeElement, buildReport } from "./client/capture";
