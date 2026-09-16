# Installing loopix into an existing Next.js app

Written from doing it: `../loopix-demo` is the working reference. If anything here
disagrees with that app, the app is right.

**Assumes:** Next 15+ App Router · a git repo (fixes land on branches) · the
`claude` CLI installed and logged in. **No Tailwind needed** — loopix ships its
own stylesheet.

---

## 1. Get the packages in (~2 min)

Not published to npm yet, so copy the built files in as real directories.
Symlinks widen Next's turbopack root and break `@swc/helpers`.

```bash
cd /path/to/loopix && pnpm install && pnpm -r build     # once
cp ../loopix/scripts/link-loopix.sh .                    # into YOUR app
bash link-loopix.sh /path/to/loopix                      # re-run after every loopix rebuild
```

⚠ **Re-run it after every loopix rebuild, then restart the dev server and the
watchers.** Next caches server modules and the watchers hold their code in
memory — a stale copy is the single most confusing failure here.

## 2. Five files in your app

**`src/loopix.config.ts`** — server-only; it carries the store, so never import
it from a client component.

```ts
import path from "node:path";
import { FileReportStore, type LoopixServerConfig } from "@loopix/nextjs/server";

export const loopixConfig: LoopixServerConfig = {
  flags: {
    enabled: true,
    capture: true,
    dashboard: true,
    agent: false,          // the CLI does the work; this gates in-app autonomy
    requireReview: false,  // true = no merge without a named person's approval
  },
  store: new FileReportStore(path.join(process.cwd(), ".loop", "reports.jsonl")),
  services: [{ id: "web", kind: "nextjs", owns: "the frontend" }],
  // adminToken defaults to process.env.LOOPIX_ADMIN_TOKEN
};
```

**`app/layout.tsx`** — mount once.

```tsx
import { LoopixProvider } from "@loopix/nextjs";
// …
<body>
  {children}
  <LoopixProvider appVersion={process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"} />
</body>
```

`appVersion` is worth wiring properly: "which build?" is the first question on
every ticket, and only the host knows the answer.

**The routes** — one line each:

```
app/api/loop/report/route.ts                    → createReportRoute      → POST
app/api/loop/admin/reports/route.ts             → createReportsListRoute → GET
app/api/loop/admin/reports/[id]/merge/route.ts  → createMergeRoute       → POST
app/api/loop/admin/reports/[id]/reject/route.ts → createRejectRoute      → POST
app/api/loop/admin/reports/[id]/retry/route.ts  → createRetryRoute       → POST
app/api/loop/admin/reports/[id]/revert/route.ts → createRevertRoute      → POST
app/api/loop/admin/reports/[id]/review/route.ts → createReviewRoute      → POST
```

```ts
import { createMergeRoute } from "@loopix/nextjs/server";
import { loopixConfig } from "@/loopix.config";
export const dynamic = "force-dynamic";
export const POST = createMergeRoute(loopixConfig);
```

**`proxy.ts`** (Next 16; `middleware.ts` on 15) — Next needs a **named**
function and a **literal** matcher. A computed matcher is ignored silently,
which would leave the admin API ungated.

```ts
import type { NextRequest } from "next/server";
import { loopixProxy } from "@loopix/nextjs/server";
const gate = loopixProxy();
export function proxy(request: NextRequest) { return gate(request); }
export const config = { matcher: "/api/loop/admin/:path*" };
```

**`app/loop/admin/page.tsx`** — `<LoopixDashboard />`, nothing else.

## 3. Environment

```bash
# .env.local  (git-ignored, chmod 600)
LOOPIX_ADMIN_TOKEN=$(openssl rand -base64 24)
NEXT_PUBLIC_BUILD_SHA=$(git rev-parse --short HEAD)
```

Add `.loop/` to `.gitignore` — reports are data, not source.

**No `ANTHROPIC_API_KEY`**: with none set, the agent runs through the `claude`
CLI on your Claude Code login. If one IS set it is used, and billed.

## 4. Run the agent

```bash
node node_modules/@loopix/agent/dist/cli.js triage        # watches, polls every 4s
node node_modules/@loopix/agent/dist/cli.js fix --id <id> # one report
```

`fix` with no `--id` only picks reports triage marked `autoFixable`. Name the id
to force one through.

## 5. Check it works

1. Right-click anything → the loopix dialog (dark chrome, `loopix` wordmark).
2. Send a report → a line appears in `.loop/reports.jsonl` with status `new`.
3. Triage claims it within ~4s → `triaged`, with a diagnosis.
4. `fix` → a `loop/fix-…` branch, your working tree untouched.
5. `/loop/admin` with the token → approve → merged.
6. `curl -s localhost:3000/api/loop/admin/reports` with **no** token → **401**.

If step 6 returns anything else, the proxy matcher is wrong — fix that before
anything else.
