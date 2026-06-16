import type { BlastRadius as Blast } from "@context-studio/types";
import { SeverityPill } from "./ui";
import { Hint } from "@/components/ui/Tooltip";

const HEADLINE: Record<Blast["maxSeverity"], { title: string; tone: string }> = {
  low: { title: "Low impact", tone: "border-emerald-500/30 bg-emerald-500/10" },
  medium: { title: "Review recommended", tone: "border-amber-500/30 bg-amber-500/10" },
  high: { title: "High impact — acknowledge before merging", tone: "border-rose-500/30 bg-rose-500/10" },
};

/**
 * Blast Radius warning — which autonomous agents this change touches, ranked by
 * severity. The highest severity gates the merge button in the approval panel.
 */
export function BlastRadius({ blast }: { blast: Blast }) {
  if (blast.agents.length === 0) {
    return (
      <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">No agents affected</h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          This change doesn’t touch context any registered agent relies on.
        </p>
      </section>
    );
  }

  const head = HEADLINE[blast.maxSeverity];

  return (
    <section className={`rounded-xl border p-4 ${head.tone}`}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden>⚠️</span> Blast radius — {head.title}
          <Hint>
            Which AI agents depend on the context this change touches. The highest severity here
            sets how much sign-off merging requires — a high-impact change must be acknowledged
            before it can merge.
          </Hint>
        </h2>
        <SeverityPill severity={blast.maxSeverity} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {blast.agents.length} agent{blast.agents.length === 1 ? "" : "s"} depend on context this
        change modifies:
      </p>

      <ul className="mt-3 space-y-2">
        {blast.agents.map((agent) => (
          <li
            key={agent.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface/70 p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{agent.name}</span>
                <SeverityPill severity={agent.severity} />
              </div>
              <div className="text-xs text-muted">{agent.purpose}</div>
              <div className="mt-1 text-xs text-muted">{agent.reason}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
