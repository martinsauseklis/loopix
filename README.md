# loopix

An in-app, git-backed feedback loop you drop into a Node project. Users **right-click anything → report a bug** (location captured automatically); an AI agent **triages** it (read-only) and **fixes** it on a git branch; a human **approves** at an in-app merge gate. loopix is essentially a *UI for git, visible in your app* — report → branch → diff → review → merge.

> **Status: Phase 0** (single-repo). Multi-repo routing and GitLab MR integration are designed but not yet built — see [Roadmap](#roadmap). Not yet published to npm; consumed locally via a dev-link script.

## Packages

| Package | What it is |
|---|---|
| `@loopix/core` | Report schema/types, the `ReportStore` interface + `FileReportStore`, config/flags + service-registry types. Framework-agnostic. |
| `@loopix/nextjs` | The host SDK: capture UI (`LoopixProvider` + context menu + modal), the operator `LoopixDashboard`, server **route factories**, and the edge-safe **proxy gate**. |
| `@loopix/agent` | The triage/fix engine + the **`loopix` CLI**. Drives Claude Code headless (`claude -p`); the fix runs in an isolated git worktree and never touches your working tree. |

## How it works

```
user right-click → report  ──▶  POST /api/loop/report  ──▶  ReportStore (.loop/reports.jsonl)
                                                                 │  status: new
   loopix triage  ──▶  Haiku, READ-ONLY  ──▶  diagnosis            │  → triaged
   loopix fix     ──▶  Sonnet, edit in a worktree → branch         │  → fix_ready
   /loop/admin    ──▶  human reviews the diff → Approve & merge    │  → merged → ships
```

The report lifecycle: `new → triaging → triaged → fixing → fix_ready → merged` (plus `rejected`, and `triage_failed`/`fix_failed` → **Retry**).

---

## Requirements

- Next.js 15+ (built/verified on Next 16).
- For the agent: the **`claude` CLI installed and authenticated** (`claude -p` is how it runs). No `ANTHROPIC_API_KEY` needed if you're logged into Claude Code; if one is set, it's used (and billed) instead.

## Install

Once published this will be `npm install @loopix/nextjs @loopix/agent`. Today, from the loopix monorepo:

```bash
cd loopix && pnpm install && pnpm -r build
```

Then dev-link the built packages into your app as real dirs (symlinks force Next's `turbopack.root` to widen, which breaks `@swc/helpers`):

```bash
# from your app (e.g. ../latbook)
bash scripts/link-loopix.sh   # copies dist + creates the `loopix` bin; re-run after rebuilding loopix
```

---

## Wire it into a Next.js app (App Router)

### 1. Config — `src/loopix.config.ts` (server-only; carries the store)

```ts
import path from "node:path";
import { FileReportStore, type LoopixServerConfig } from "@loopix/nextjs/server";

export const loopixConfig: LoopixServerConfig = {
  flags: { enabled: true, capture: true, dashboard: true, agent: false },
  store: new FileReportStore(path.join(process.cwd(), ".loop", "reports.jsonl")),
  services: [{ id: "web", kind: "nextjs", owns: "the frontend" }],
  // adminToken defaults to process.env.LOOPIX_ADMIN_TOKEN
  // killSwitch?: () => boolean | Promise<boolean>   // runtime emergency stop
};
```

### 2. Capture — mount the provider once in `app/layout.tsx`

```tsx
import { LoopixProvider } from "@loopix/nextjs";
// ...
<body>
  {children}
  <LoopixProvider />          {/* props: enabled?, capture?, reportPath? (default /api/loop/report) */}
</body>
```

### 3. Routes — re-export the factories

```ts
// app/api/loop/report/route.ts            (public ingest — NOT gated)
import { createReportRoute } from "@loopix/nextjs/server";
import { loopixConfig } from "@/loopix.config";
export const dynamic = "force-dynamic";
export const POST = createReportRoute(loopixConfig);
```

```ts
// app/api/loop/admin/reports/route.ts                         → createReportsListRoute → export const GET
// app/api/loop/admin/reports/[id]/merge/route.ts              → createMergeRoute       → export const POST
// app/api/loop/admin/reports/[id]/reject/route.ts             → createRejectRoute      → export const POST
// app/api/loop/admin/reports/[id]/retry/route.ts              → createRetryRoute       → export const POST
```

### 4. Dashboard — `app/loop/admin/page.tsx`

```tsx
import { LoopixDashboard } from "@loopix/nextjs";
export default function Page() {
  return <LoopixDashboard />;   // prompts for the admin token, stored in the browser
}
```

### 5. Gate — `proxy.ts` (Next 16; on Next ≤15 this is `middleware.ts`)

Next needs a *named* `proxy` function and a *literal* matcher:

```ts
import type { NextRequest } from "next/server";
import { loopixProxy } from "@loopix/nextjs/server";

const gate = loopixProxy();
export function proxy(request: NextRequest) {
  return gate(request);
}
export const config = { matcher: "/api/loop/admin/:path*" };
```

### 6. Set the admin token

```bash
# .env.local
LOOPIX_ADMIN_TOKEN=$(openssl rand -hex 16)
```

That's the whole integration — one config + five thin route files + a provider. Removing loopix is deleting them.

---

## Run the agent (CLI)

The `loopix` bin reads `.loop/reports.jsonl` in the current repo by default.

```bash
loopix triage --once    # claim the oldest `new` report → diagnose (Haiku, read-only) → triaged
loopix triage           # poll continuously
loopix fix              # fix a triaged + autoFixable report on a branch → fix_ready (never merges)
loopix fix --id <id>    # fix a specific report

# flags: --repo <dir>  --reports <path>  --model <haiku|sonnet|opus>
```

Then open **`/loop/admin`**, review the proposed diff, and click **Approve & merge** (fast-forwards/merges the fix branch into your base and flips the report to `merged`). Transient failures auto-retry; a dead-ended report shows a **Retry** button.

> The merge gate requires you to be on the report's base branch with a clean working tree.

---

## Disabling loopix

"Disable" is per-capability, with fail-safe defaults:

| Flag (`flags.*`) | Default | Effect |
|---|---|---|
| `enabled` | `true` | master switch |
| `capture` | `true` | the right-click intake |
| `dashboard` | `true` | the operator UI |
| `agent` | **`false`** | autonomous triage/fix — **opt-in** |

- **Runtime kill switch:** `killSwitch: () => true` (fail-closed) stops ingest + agent without a redeploy.
- **Build-time off:** `NEXT_PUBLIC_LOOPIX=off` makes `<LoopixProvider>` render nothing (no capture client code).
- **Safe default = capture-only:** collect reports, no autonomous changes, until you trust the loop.

---

## Local development (this monorepo)

```bash
pnpm install
pnpm -r build       # builds @loopix/core, @loopix/agent, @loopix/nextjs
pnpm typecheck
```

`@loopix/nextjs` is a **dual ESM+CJS** build (so Next 16 SSR resolves it without ESM-interop breakage) with a `"use client"` banner on the client entry. After any rebuild, re-run your app's `scripts/link-loopix.sh`.

## Roadmap

- **Journey breadcrumbs (his idea, 2026-09-16).** Record the steps a user took to get here and send them
  with the report. Today a report carries *where* they clicked; this adds *how they arrived*, which is the
  difference between "the button did nothing" and a reproducible path. It helps all three jobs: reporting
  (nothing to describe), triage (a real repro instead of a guess — the two `fix_failed` reports on 2026-09-16
  both died on a mismatch between report and code), and features (you can see the workaround people invented).
  The schema already reserves the slot: `ReportBundle.buffer` (`core/src/types.ts:31`, "rolling breadcrumb buffer").

  **Design constraints, decided up front — this is the feature that can leak an entire session:**
  - A **rolling in-memory ring buffer** (last ~30 events), sent ONLY when a report is filed. Never streamed,
    never persisted for users who report nothing.
  - **Structured events, not a recording**: `{t, type, route, selector, textLabel}` where type is a closed
    enum (`nav`, `click`, `input`, `submit`, `error`). No screenshots, no DOM snapshots, no session replay.
  - **Never the values people type.** An `input` event records *that* a field changed and which one —
    `hasValue: true`, `length: 12` — never the string. Same rule for URLs with tokens or ids in them.
  - **Opt-out honoured**: anything under `[data-loopix-ignore]` produces no breadcrumbs either.
  - The buffer is **untrusted data** downstream, exactly like the message: delimited in the triage prompt,
    never instructions.

- **Phase 1 — multi-repo.** Populate `services[]`; triage routes a report to the owning service; the agent clones/worktrees *that* repo and runs its build/test. (A frontend complaint can be fixed in a backend repo.)
- **Phase 2 — forge + prod.** A Node reporter SDK for backends; the merge gate becomes an approved **GitLab MR → CI build → deploy**; a Postgres `ReportStore`; the agent runs out-of-band in CI; deploy-SHA + correlation IDs on reports.
