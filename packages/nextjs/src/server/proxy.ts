import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminTokenStatus } from "./admin-token";

// The recommended matcher for the operator API. The host must inline this as a
// string LITERAL — Next statically reads `config.matcher` and won't follow an
// imported const.
export const LOOPIX_ADMIN_MATCHER = "/api/loop/admin/:path*";

// Returns the gate function. The host's `proxy.ts` must export it as a named
// `proxy` function (Next 16 requires a statically-recognizable function export)
// and declare the matcher literal:
//
//   import { loopixProxy } from "@loopix/nextjs/server";
//   const gate = loopixProxy();
//   export function proxy(req: NextRequest) { return gate(req); }
//   export const config = { matcher: "/api/loop/admin/:path*" };
//
// Edge-safe (no node:fs). Token comes from LOOPIX_ADMIN_TOKEN unless passed.
export function loopixProxy(opts?: { adminToken?: string }) {
  return function proxy(request: NextRequest) {
    const expected = opts?.adminToken ?? process.env.LOOPIX_ADMIN_TOKEN;
    const status = adminTokenStatus(request, expected);
    if (status === "ok") return NextResponse.next();
    if (status === "unconfigured") {
      return NextResponse.json(
        { ok: false, error: "loopix admin not configured — set LOOPIX_ADMIN_TOKEN" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  };
}
