"use client";

import { useEffect, useState } from "react";
import type { EvalReport } from "@context-studio/types";
import { getEvals } from "@/lib/api";

/**
 * Evals panel — runs the context-regression suite against the proposed change
 * and shows pass/fail. Failing evals block approval (the server enforces it).
 */
export function EvalsPanel({ prId }: { prId: string }) {
  const [report, setReport] = useState<EvalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvals(prId).then(setReport).catch((e) => setError(String(e.message ?? e)));
  }, [prId]);

  if (error) {
    return (
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Evals</h2>
        <p className="mt-1 text-sm text-rose-600">{error}</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Evals</h2>
        <p className="mt-1 text-sm text-muted">Running…</p>
      </section>
    );
  }

  if (report.results.length === 0) {
    return (
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Evals</h2>
        <p className="mt-1 text-sm text-muted">No evals defined for this workspace.</p>
      </section>
    );
  }

  const failed = report.results.filter((r) => !r.passed).length;

  return (
    <section
      className={`rounded-xl border p-4 shadow-sm ${
        report.passed ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden>{report.passed ? "✓" : "⚠️"}</span> Context evals
        </h2>
        <span className="text-xs font-medium">
          {report.passed ? "all passing" : `${failed} failing — blocks merge`}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {report.results.map((r) => (
          <li key={r.id} className="rounded-lg border border-black/5 bg-white/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{r.question ?? r.id}</span>
              <span className={`text-xs font-semibold ${r.passed ? "text-emerald-700" : "text-rose-700"}`}>
                {r.passed ? "pass" : "fail"}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted">{r.agentId}</div>
            {r.missing.length > 0 && (
              <div className="mt-1 text-xs text-rose-700">
                missing: {r.missing.map((m) => `“${m}”`).join(", ")}
              </div>
            )}
            {r.forbidden.length > 0 && (
              <div className="mt-1 text-xs text-rose-700">
                must not contain: {r.forbidden.map((m) => `“${m}”`).join(", ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
