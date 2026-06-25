"use client";

import { useCallback, useEffect, useState } from "react";
import type { LoopReport } from "@loopix/core";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  triaging: "bg-gray-100 text-gray-700",
  triaged: "bg-blue-100 text-blue-700",
  fixing: "bg-amber-100 text-amber-800",
  fix_ready: "bg-purple-100 text-purple-800",
  merged: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  triage_failed: "bg-red-100 text-red-700",
  fix_failed: "bg-red-100 text-red-700",
  noise: "bg-gray-100 text-gray-500",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

export function LoopixDashboard({ basePath = "/api/loop/admin" }: { basePath?: string }) {
  const [reports, setReports] = useState<LoopReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [needAuth, setNeedAuth] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("loopix_token") ?? "");
    setReady(true);
  }, []);

  const load = useCallback(
    async (tok: string) => {
      try {
        const res = await fetch(`${basePath}/reports`, {
          cache: "no-store",
          headers: { "x-loopix-token": tok },
        });
        if (res.status === 401 || res.status === 503) {
          const d = await res.json().catch(() => ({}));
          setNeedAuth(true);
          setError(d.error ?? "unauthorized");
          return;
        }
        const data = await res.json();
        setReports(data.reports ?? []);
        setNeedAuth(false);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [basePath],
  );

  useEffect(() => {
    if (ready) load(token);
  }, [ready, token, load]);

  function saveToken() {
    localStorage.setItem("loopix_token", tokenInput);
    setToken(tokenInput);
    setNeedAuth(false);
  }

  async function act(id: string, action: "merge" | "reject" | "retry") {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch(`${basePath}/reports/${id}/${action}`, {
        method: "POST",
        headers: { "x-loopix-token": token },
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "failed");
      await load(token);
    } catch (e) {
      setError(`${action} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  if (needAuth) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-1 text-xl font-bold">loopix — admin</h1>
        <p className="mb-4 text-sm text-gray-500">{error ?? "Enter the loopix admin token."}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveToken();
          }}
          className="flex gap-2"
        >
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="LOOPIX_ADMIN_TOKEN"
            className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm outline-none focus:border-blue-400 dark:border-white/15 dark:bg-neutral-800"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

  const counts = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">loopix</h1>
        <button onClick={() => load(token)} className="text-sm text-blue-600 hover:underline">
          refresh
        </button>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        {reports.length} reports ·{" "}
        {Object.entries(counts)
          .map(([k, v]) => `${v} ${k}`)
          .join(" · ")}
      </p>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-col gap-3">
        {reports.length === 0 && (
          <p className="text-sm text-gray-400">
            No reports yet. Right-click something on the app and report a bug.
          </p>
        )}
        {reports.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="mb-1 flex items-center gap-2">
              <Badge status={r.status} />
              {r.report.severity && <Badge status={r.report.severity} />}
              <span className="font-mono text-xs text-gray-400">{r.id.slice(0, 8)}</span>
              <span className="ml-auto text-xs text-gray-400">{r.context.route}</span>
            </div>

            {r.report.message && <p className="text-sm">“{r.report.message}”</p>}
            <p className="mt-0.5 text-xs text-gray-500">
              {r.context.componentStack[0] ?? `<${r.context.tag}>`}
              {r.context.text ? ` · ${r.context.text}` : ""}
            </p>

            {r.diagnosis?.summary && (
              <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/5">
                <span className="font-medium">{r.diagnosis.category}</span>
                {r.diagnosis.reproducible !== undefined &&
                  ` · reproducible: ${String(r.diagnosis.reproducible)}`}
                {r.diagnosis.autoFixable !== undefined &&
                  ` · autoFixable: ${String(r.diagnosis.autoFixable)}`}
                <div className="mt-1 text-gray-600 dark:text-gray-400">{r.diagnosis.summary}</div>
              </div>
            )}

            {r.status === "fix_ready" && r.fix && (
              <div className="mt-3">
                <div className="mb-1 text-xs text-gray-500">
                  proposed fix on <span className="font-mono">{r.fix.branch}</span>
                  {r.fix.tscPass !== undefined && ` · typecheck ${r.fix.tscPass ? "✓" : "✗"}`}
                </div>
                {r.fix.diff && (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-950 p-3 text-xs leading-relaxed text-gray-200">
                    {r.fix.diff}
                  </pre>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => act(r.id, "merge")}
                    disabled={busy !== null}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {busy === r.id + "merge" ? "Merging…" : "Approve & merge"}
                  </button>
                  <button
                    onClick={() => act(r.id, "reject")}
                    disabled={busy !== null}
                    className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-black/5 disabled:opacity-60 dark:border-white/15 dark:text-gray-300"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {(r.status === "triage_failed" || r.status === "fix_failed") && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm dark:bg-red-950/30">
                {(() => {
                  const kind = r.triageFailureKind ?? r.fix?.failureKind;
                  const err = r.triageError ?? r.fix?.error;
                  return (
                    <>
                      <div className="font-medium text-red-700 dark:text-red-400">
                        {r.status === "triage_failed" ? "Triage failed" : "Fix failed"}
                        {kind ? ` · ${kind}` : ""}
                      </div>
                      {kind === "usage_limit" && (
                        <div className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                          Usage limit reached — wait for your limit to reset, then retry.
                        </div>
                      )}
                      {err && <div className="mt-1 truncate font-mono text-xs text-red-500/80">{err}</div>}
                    </>
                  );
                })()}
                <button
                  onClick={() => act(r.id, "retry")}
                  disabled={busy !== null}
                  className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy === r.id + "retry" ? "Re-queuing…" : "Retry"}
                </button>
              </div>
            )}

            {r.status === "merged" && r.merge?.commit && (
              <p className="mt-2 text-xs text-green-700">merged as {r.merge.commit.slice(0, 8)}</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
