// Server-only entry: route factories + the proxy gate. Imports node:fs/git, so
// never pull this into a client component — use "@loopix/nextjs" for that.
export { createReportRoute } from "./report-route";
export {
  createReportsListRoute,
  createMergeRoute,
  createRejectRoute,
  createRetryRoute,
  createRevertRoute,
} from "./admin-routes";
export { loopixProxy } from "./proxy";

// Re-export the storage adapter + types so the host configures everything from
// one import.
export {
  FileReportStore,
  resolveFlags,
  type ReportStore,
  type LoopixServerConfig,
  type LoopixFlags,
  type ServiceConfig,
  type LoopReport,
} from "@loopix/core";
