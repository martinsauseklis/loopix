// Classify a failure and retry transient ones with backoff.

export type FailureKind = "usage_limit" | "transient";

export function classifyError(message: unknown): FailureKind {
  const m = String(message ?? "").toLowerCase();
  if (
    /usage limit|limit reached|quota|429|too many requests|rate.?limit|resets at|upgrade to|insufficient/.test(m)
  ) {
    return "usage_limit";
  }
  return "transient";
}

export async function runWithRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; log?: (m: string) => void } = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 2500, log = () => {} } = opts;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const err = e as { message?: string; kind?: FailureKind };
      const kind = classifyError(err?.message ?? e);
      if (kind === "usage_limit") {
        err.kind = "usage_limit";
        throw e;
      }
      if (i < attempts) {
        const delay = baseDelayMs * i;
        log(
          `transient error (attempt ${i}/${attempts}), retrying in ${delay}ms: ${String(
            err?.message ?? e,
          ).slice(0, 140)}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  if (lastErr && typeof lastErr === "object") {
    (lastErr as { kind?: FailureKind }).kind = "transient";
  }
  throw lastErr;
}
