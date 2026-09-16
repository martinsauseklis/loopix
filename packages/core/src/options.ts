import type { ReportStore } from "./store";

// Per-capability toggles. The point: "disable" is not one switch.
export type LoopixFlags = {
  enabled?: boolean; // master
  capture?: boolean; // the intake UI
  dashboard?: boolean; // the operator UI
  agent?: boolean; // autonomous triage/fix
  /** When true, a merge is refused unless review.state === "approved".
   *  The gate becomes a named person's decision, not "whoever clicked". */
  requireReview?: boolean;
};

// A service/repo in the fleet. Phase 0 runs with a single implicit host repo;
// Phase 1 populates these so reports route to the owning repo.
export type ServiceConfig = {
  id: string;
  repo?: string; // git remote/url; default = host repo (cwd)
  kind?: string; // "nextjs" | "node" | "python" | ...
  build?: string;
  test?: string;
  owns?: string; // responsibility description — used by triage to route
  forge?: { type: "gitlab" | "github"; projectId?: string };
};

// Server-side config (carries the store + secrets — never goes to the client).
export type LoopixServerConfig = {
  /** Who is reporting, from the HOST's session (Keycloak, NextAuth, whatever).
   *  loopix deliberately has no auth of its own: it must work in any app, and
   *  a widget should never hold your identity provider's secrets. */
  identify?: (request: Request) => Promise<{ sub: string } | null> | { sub: string } | null;
  flags?: LoopixFlags;
  store: ReportStore;
  services?: ServiceConfig[];
  adminToken?: string; // defaults to env LOOPIX_ADMIN_TOKEN
  killSwitch?: () => boolean | Promise<boolean>; // runtime emergency stop
};

// Client-safe config (flags only — passed to the capture provider).
export type LoopixClientConfig = {
  enabled?: boolean;
  capture?: boolean;
};

export const DEFAULT_FLAGS: Required<LoopixFlags> = {
  enabled: true,
  capture: true,
  dashboard: true,
  agent: false, // OFF by default — autonomy is opt-in
  requireReview: false, // opt-in: teams that need a lead's sign-off turn this on
};

export function resolveFlags(flags?: LoopixFlags): Required<LoopixFlags> {
  return { ...DEFAULT_FLAGS, ...(flags ?? {}) };
}
