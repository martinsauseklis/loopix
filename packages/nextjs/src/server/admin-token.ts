// Edge-safe admin token check (no node:crypto — runs in the Proxy runtime).

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false; // length isn't secret
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function tokenFromRequest(req: Request): string {
  const header = req.headers.get("x-loopix-token");
  if (header) return header;
  const cookie = req.headers.get("cookie");
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === "loopix_token") return decodeURIComponent(v.join("="));
    }
  }
  return "";
}

export type TokenStatus = "ok" | "unconfigured" | "unauthorized";

export function adminTokenStatus(req: Request, expected: string | undefined): TokenStatus {
  if (!expected) return "unconfigured"; // fail-closed
  return constantTimeEqual(tokenFromRequest(req), expected) ? "ok" : "unauthorized";
}
