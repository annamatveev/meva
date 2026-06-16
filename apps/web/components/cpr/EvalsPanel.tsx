"use client";

import { useEffect, useState } from "react";
import type { EvalReport } from "@context-studio/types";
import { getEvals } from "@/lib/api";
import { Hint } from "@/components/ui/Tooltip";

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
      <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Evals</h2>
        <p className="mt-1 text-sm text-rose-600">{error}</p>
      </section>
    );
  }

  if (!report) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Evals</h2>
        <p className="mt-1 text-sm text-muted">Running…</p>
      </section>
    );
  }

  if (report.results.length === 0) {
    return (
      <section className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Evals</h2>
        <p className="mt-1 text-sm text-muted">No evals defined for this workspace.</p>
      </section>
    );
  }

  const failed = report.results.filter((r) => !r.passed).length;

  return (
    <section
      className={`rounded-xl border p-4 shadow-sm ${
        report.passed ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden>{report.passed ? "✓" : "⚠️"}</span> Context evals
          <Hint side="top">
            Automated checks that this change doesn’t drop facts your agents rely on. If any
            check fails, the change can’t be approved until it’s fixed.
          </Hint>
        </h2>
        <span className="text-xs font-medium">
          {report.passed ? "all passing" : `${failed} failing — blocks merge`}
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {report.results.map((r) => (
          <li key={r.id} className="rounded-lg border border-line bg-surface/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{r.question ?? r.id}</span>
              <span className={`text-xs font-semibold ${r.passed ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                {r.passed ? "pass" : "fail"}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted">{r.agentId}</div>
            {r.missing.length > 0 && (
              <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                missing: {r.missing.map((m) => `“${m}”`).join(", ")}
              </div>
            )}
            {r.forbidden.length > 0 && (
              <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                must not contain: {r.forbidden.map((m) => `“${m}”`).join(", ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
