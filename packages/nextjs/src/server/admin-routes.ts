import { resolveFlags, type LoopixServerConfig } from "@loopix/core";
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
    // When a project requires sign-off, the merge is a named person's decision.
    if (resolveFlags(config.flags).requireReview && r.review?.state !== "approved") {
      return Response.json(
        {
          ok: false,
          error: `review required — current state: ${r.review?.state ?? "pending"}`,
        },
        { status: 409 },
      );
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

/**
 * Undo a merged fix.
 *
 * `git revert -m 1 <merge>` — NOT `reset --hard`. Reset rewrites history: it
 * would throw away every fix merged after this one, and on a shared branch it
 * breaks everyone who already pulled. Revert adds a new commit that undoes
 * exactly this merge, so later fixes survive and the record of what happened
 * stays readable. Because every fix lands as its own --no-ff merge commit, the
 * undo is surgical.
 *
 * The report ends as "reverted", which is terminal: the watcher must not pick
 * it up and rebuild the thing a human just rejected.
 */
export function createRevertRoute(config: LoopixServerConfig) {
  return async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const r = await config.store.get(id);
    if (!r) return Response.json({ ok: false, error: "unknown report" }, { status: 404 });
    if (r.status !== "merged") {
      return Response.json(
        { ok: false, error: `only a merged fix can be reverted (status: ${r.status})` },
        { status: 409 },
      );
    }
    const commit = r.merge?.commit;
    if (!commit || !/^[0-9a-f]{7,40}$/.test(commit)) {
      return Response.json({ ok: false, error: "report has no merge commit" }, { status: 400 });
    }

    const repo = process.cwd();
    try {
      const dirty = (await git(["status", "--porcelain"], repo)).stdout.trim();
      if (dirty) {
        return Response.json(
          { ok: false, error: "working tree not clean — commit or stash first" },
          { status: 409 },
        );
      }
      try {
        // -m 1: undo relative to the first parent, i.e. the branch we merged into.
        await git(["revert", "--no-edit", "-m", "1", commit], repo);
      } catch {
        // A later change touching the same lines: leave the tree as it was and
        // hand it to a human rather than guessing.
        await git(["revert", "--abort"], repo).catch(() => {});
        return Response.json(
          { ok: false, error: "revert conflicts with later changes — needs a human" },
          { status: 409 },
        );
      }
      const revertCommit = (await git(["rev-parse", "HEAD"], repo)).stdout.trim();
      await config.store.patch(id, {
        status: "reverted",
        revert: { at: new Date().toISOString(), commit: revertCommit, undid: commit },
      });
      return Response.json({ ok: true, commit: revertCommit });
    } catch (err) {
      return Response.json({ ok: false, error: String(err).slice(0, 300) }, { status: 500 });
    }
  };
}

const REVIEW_STATES = ["pending", "in_review", "approved", "declined", "changes_requested"] as const;

/**
 * Set the human review state: claim it, approve it, decline it, send it back.
 * Separate from `status` on purpose — one says where the machine is, the other
 * says where the people are, and neither should have to wait for the other.
 */
export function createReviewRoute(config: LoopixServerConfig) {
  return async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    const r = await config.store.get(id);
    if (!r) return Response.json({ ok: false, error: "unknown report" }, { status: 404 });

    let body: { state?: string; by?: string; note?: string };
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
    }

    const state = String(body.state ?? "");
    if (!REVIEW_STATES.includes(state as (typeof REVIEW_STATES)[number])) {
      return Response.json(
        { ok: false, error: `state must be one of: ${REVIEW_STATES.join(", ")}` },
        { status: 400 },
      );
    }

    const review = {
      state: state as (typeof REVIEW_STATES)[number],
      // Identity comes from the host's own auth; loopix never invents one.
      by: typeof body.by === "string" ? body.by.slice(0, 80) : undefined,
      at: new Date().toISOString(),
      note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined,
    };
    await config.store.patch(id, { review });
    return Response.json({ ok: true, review });
  };
}
