import type { LoopixServerConfig } from "@loopix/core";
import { git, FIX_BRANCH_RE } from "./git";

type Ctx = { params: Promise<{ id: string }> };

// All admin routes are gated by the proxy over /api/loop/admin/* — no per-route
// token check. Phase 0 operates on the host repo (process.cwd()); Phase 1 will
// route by report.serviceId to the owning repo.

export function createReportsListRoute(_config: LoopixServerConfig) {
  const config = _config;
  return async function GET(): Promise<Response> {
    const reports = (await config.store.list()).reverse();
    return Response.json({ reports });
  };
}

export function createMergeRoute(config: LoopixServerConfig) {
  return async function POST(_req: Request, { params }: Ctx): Promise<Response> {
    const { id } = await params;
    const r = await config.store.get(id);
    if (!r) return Response.json({ ok: false, error: "report not found" }, { status: 404 });
    if (r.status !== "fix_ready") {
      return Response.json({ ok: false, error: `report is "${r.status}", not "fix_ready"` }, { status: 409 });
    }
    const branch = r.fix?.branch;
    const base = r.fix?.base;
    if (!branch || !base || !FIX_BRANCH_RE.test(branch)) {
      return Response.json({ ok: false, error: "report has no valid fix branch" }, { status: 400 });
    }
    const repo = process.cwd();
    try {
      const current = (await git(["rev-parse", "--abbrev-ref", "HEAD"], repo)).stdout.trim();
      if (current !== base) {
        return Response.json(
          { ok: false, error: `checkout "${base}" before merging (currently on "${current}")` },
          { status: 409 },
        );
      }
      const dirty = (await git(["status", "--porcelain"], repo)).stdout.trim();
      if (dirty) {
        return Response.json({ ok: false, error: "working tree not clean — commit or stash first" }, { status: 409 });
      }
      const id8 = id.slice(0, 8);
      try {
        await git(["merge", "--no-ff", "-m", `loop: merge fix for report ${id8} (${branch})`, branch], repo);
      } catch {
        try {
          await git(["merge", "--abort"], repo);
        } catch {
          /* nothing to abort */
        }
        return Response.json(
          { ok: false, error: "merge conflict — fix branch needs manual rebase/resolution" },
          { status: 409 },
        );
      }
      const commit = (await git(["rev-parse", "HEAD"], repo)).stdout.trim();
      await config.store.patch(id, { status: "merged", merge: { at: new Date().toISOString(), commit } });
      return Response.json({ ok: true, commit });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json({ ok: false, error: msg.slice(0, 600) }, { status: 500 });
    }
  };
}

export function createRejectRoute(config: LoopixServerConfig) {
  return async function POST(_req: Request, { params }: Ctx): Promise<Response> {
    const { id } = await params;
    const r = await config.store.get(id);
    if (!r) return Response.json({ ok: false, error: "report not found" }, { status: 404 });
    const branch = r.fix?.branch;
    if (branch && FIX_BRANCH_RE.test(branch)) {
      try {
        await git(["branch", "-D", branch], process.cwd());
      } catch {
        /* branch may already be gone */
      }
    }
    await config.store.patch(id, { status: "rejected", rejectedAt: new Date().toISOString() });
    return Response.json({ ok: true });
  };
}

const RETRY_TO: Record<string, string | undefined> = {
  triage_failed: "new",
  fix_failed: "triaged",
};

export function createRetryRoute(config: LoopixServerConfig) {
  return async function POST(_req: Request, { params }: Ctx): Promise<Response> {
    const { id } = await params;
    const r = await config.store.get(id);
    if (!r) return Response.json({ ok: false, error: "report not found" }, { status: 404 });
    const next = RETRY_TO[r.status];
    if (!next) {
      return Response.json({ ok: false, error: `status "${r.status}" is not retryable` }, { status: 409 });
    }
    const fields: Record<string, unknown> = { status: next };
    if (r.status === "triage_failed") {
      fields.triageError = undefined;
      fields.triageFailureKind = undefined;
    } else if (r.status === "fix_failed") {
      fields.fix = undefined;
    }
    await config.store.patch(id, fields);
    return Response.json({ ok: true, status: next });
  };
}
