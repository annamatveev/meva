"use client";

import { useEffect, useState } from "react";
import type { DistributionStatus } from "@context-studio/types";
import { getDistribution, publishDistribution } from "@/lib/api";
import { Hint } from "@/components/ui/Tooltip";

export function DistributionPanel() {
  const [status, setStatus] = useState<DistributionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDistribution().then(setStatus).catch((e) => setError(String(e.message ?? e)));
  }, []);

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await publishDistribution());
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            Distribution
            <Hint>
              How approved context reaches your agents. Each agent gets only the documents it’s
              authorized for, signed so the agent can verify it wasn’t tampered with before using it.
            </Hint>
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Approved context is published as a signed, per-agent bundle. Agents pull it,
            verify the ed25519 signature and every file digest, then atomically swap their
            local context — least privilege, tamper-evident.
          </p>
        </div>
        <button
          onClick={publish}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish now"}
        </button>
      </div>

      {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

      {!status?.published ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted shadow-sm">
          Nothing published yet. Approving a Context PR publishes automatically, or click
          “Publish now”.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 text-sm shadow-sm">
            <div>
              <div className="text-xs text-muted">Bundle version</div>
              <div className="font-mono">{status.version}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Published</div>
              <div>{status.generatedAt && new Date(status.generatedAt).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              <span aria-hidden>🔏</span> ed25519 signed
            </div>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">
              Per-agent slices ({status.agents.length})
            </h2>
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              {status.agents.map((a) => (
                <div key={a.agentId} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{a.agentName}</div>
                    <div className="text-xs text-muted">
                      {a.documents.length} doc{a.documents.length === 1 ? "" : "s"}:{" "}
                      {a.documents.join(", ") || "— none authorized —"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted">
                    {a.files} file{a.files === 1 ? "" : "s"} · {a.bytes} B
                  </div>
                </div>
              ))}
            </div>
          </section>

          {status.publicKeyPem && (
            <details className="rounded-xl border border-line bg-surface p-4 text-sm shadow-sm">
              <summary className="cursor-pointer font-medium">
                Public key (pin this on agent hosts)
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900/90 p-3 text-xs text-slate-100">
                {status.publicKeyPem.trim()}
              </pre>
              <p className="mt-2 text-xs text-muted">
                Agents verify bundles with a pinned copy of this key (passed to{" "}
                <code>clients/agent-sync.mjs --pubkey</code>), never the one shipped in the bundle.
              </p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
