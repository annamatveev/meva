import Link from "next/link";
import type { FileInsight, MissingArea } from "@context-studio/types";

/**
 * File health — a dashboard, not a chart. A one-line summary + a distribution
 * bar + a ranked status list (worst first), so it's scannable and every row is
 * an action (click to open the file). Unanswered asks sit alongside.
 */

function risk(f: FileInsight): number {
  return (
    (f.flags.includes("conflict") ? 3 : 0) +
    (f.flags.includes("unverified") ? 2 : 0) +
    (f.flags.includes("stale") ? 2 : 0) +
    Math.min(f.openRequests, 3)
  );
}
function reason(f: FileInsight): string {
  if (f.flags.includes("conflict")) return f.reads >= 150 ? "Conflicts in a heavily-read file" : "Conflicts with another file";
  if (f.flags.includes("unverified")) return f.reads >= 150 ? "Unreviewed AI text agents lean on" : "Contains unreviewed AI text";
  if (f.flags.includes("stale")) return "Past its review window";
  if (f.flags.includes("never_read")) return "Never read — candidate to remove";
  if (f.flags.includes("rarely_read")) return "Rarely read — candidate to trim";
  return "Healthy — relied-on, no issues";
}

type Status = "at_risk" | "review" | "trim" | "healthy";
const STATUS: Record<Status, { label: string; color: string; rank: number }> = {
  at_risk: { label: "At risk", color: "#be185d", rank: 0 },
  review: { label: "Review", color: "#bf8700", rank: 1 },
  trim: { label: "Rarely read", color: "#64748b", rank: 2 },
  healthy: { label: "Healthy", color: "#10b981", rank: 3 },
};
const ORDER: Status[] = ["at_risk", "review", "trim", "healthy"];

function statusOf(f: FileInsight): Status {
  const rk = risk(f);
  if (rk > 0 && f.reads >= 150) return "at_risk";
  if (rk > 0) return "review";
  if (f.flags.includes("never_read") || f.flags.includes("rarely_read")) return "trim";
  return "healthy";
}
const shortName = (path: string) => path.split("/").slice(1).join("/") || path;

export function HealthMap({ files, missing }: { files: FileInsight[]; missing: MissingArea[] }) {
  const ranked = [...files].sort((a, b) => {
    const r = STATUS[statusOf(a)].rank - STATUS[statusOf(b)].rank;
    return r !== 0 ? r : b.reads - a.reads;
  });
  const counts: Record<Status, number> = { at_risk: 0, review: 0, trim: 0, healthy: 0 };
  for (const f of files) counts[statusOf(f)]++;
  const total = files.length || 1;
  const needAttention = counts.at_risk + counts.review;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_19rem]">
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
        {/* headline */}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm">
            <span className="text-2xl font-semibold" style={{ color: needAttention ? "#be185d" : "#10b981" }}>{needAttention}</span>
            <span className="text-muted"> of {files.length} files need attention</span>
          </div>
          <span className="text-xs text-muted">sorted worst-first · click a file to open</span>
        </div>

        {/* distribution bar */}
        <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface2">
          {ORDER.map((s) =>
            counts[s] > 0 ? (
              <div key={s} title={`${counts[s]} ${STATUS[s].label}`} style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS[s].color }} />
            ) : null,
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          {ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].color }} />
              {STATUS[s].label}
              <span className="font-medium text-ink">{counts[s]}</span>
            </span>
          ))}
        </div>

        {/* ranked status list */}
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {ranked.map((f) => {
            const st = STATUS[statusOf(f)];
            return (
              <li key={f.path}>
                <Link href={`/edit/${f.path}`} className="flex items-center gap-3 py-2.5 transition hover:bg-hover">
                  <span
                    className="w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold"
                    style={{ background: `${st.color}1f`, color: st.color }}
                  >
                    {st.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{shortName(f.path)}</span>
                    <span className="block truncate text-xs text-muted">{reason(f)}</span>
                  </span>
                  {f.openRequests > 0 && (
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "rgba(9,105,218,0.12)", color: "#0969da" }}>
                      {f.openRequests} open
                    </span>
                  )}
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted">{f.reads.toLocaleString()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-card lg:self-start">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Top gaps · unanswered asks</div>
        <ul className="space-y-1.5">
          {missing.length === 0 && <li className="text-xs text-muted">No unanswered asks.</li>}
          {missing.slice(0, 5).map((mm) => (
            <li key={mm.query} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">{mm.query}</span>
              <span className="shrink-0 font-medium text-rose-600 dark:text-rose-300">{mm.misses}× missed</span>
            </li>
          ))}
        </ul>
        <Link
          href="/inbox?filter=missing"
          className="mt-2 block border-t border-line pt-2 text-xs font-medium text-brand hover:underline"
        >
          View all unanswered asks →
        </Link>
      </div>
    </div>
  );
}
