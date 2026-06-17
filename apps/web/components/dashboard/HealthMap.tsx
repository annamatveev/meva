import Link from "next/link";
import type { FileInsight, InsightFlag, MissingArea } from "@context-studio/types";

/**
 * Health — the context owner's "what do I do" overview. Files are sorted into
 * action buckets (fix first / review / trim / healthy) so it reads like a
 * triage board, not a chart. Unanswered asks (gaps) sit alongside.
 */

const FLAG_INFO: Partial<Record<InsightFlag, { color: string; label: string }>> = {
  conflict: { color: "#d946ef", label: "Conflict" },
  unverified: { color: "#bf8700", label: "Unverified AI" },
  stale: { color: "#f59e0b", label: "Stale" },
  never_read: { color: "#cf222e", label: "Never read" },
  rarely_read: { color: "#64748b", label: "Rarely read" },
};
const HEALTHY = { color: "#10b981", label: "Healthy" };

function risk(f: FileInsight): number {
  return (
    (f.flags.includes("conflict") ? 3 : 0) +
    (f.flags.includes("unverified") ? 2 : 0) +
    (f.flags.includes("stale") ? 2 : 0) +
    Math.min(f.openRequests, 3)
  );
}
const ORDER: InsightFlag[] = ["conflict", "unverified", "stale", "never_read", "rarely_read"];
function dominant(f: FileInsight) {
  for (const k of ORDER) if (f.flags.includes(k) && FLAG_INFO[k]) return FLAG_INFO[k]!;
  return HEALTHY;
}
function reason(f: FileInsight): string {
  if (f.flags.includes("conflict")) return f.reads >= 150 ? "Conflicts in a heavily-read file" : "Conflicts with another file";
  if (f.flags.includes("unverified")) return f.reads >= 150 ? "Unreviewed AI text agents lean on" : "Contains unreviewed AI text";
  if (f.flags.includes("stale")) return "Past its review window";
  if (f.flags.includes("never_read")) return "Never read — candidate to remove";
  if (f.flags.includes("rarely_read")) return "Rarely read — candidate to trim";
  return "No issues";
}
type Bucket = "fix" | "review" | "trim" | "healthy";
function bucketOf(f: FileInsight): Bucket {
  const rk = risk(f);
  if (rk > 0 && f.reads >= 150) return "fix";
  if (rk > 0) return "review";
  if (f.flags.includes("never_read") || f.flags.includes("rarely_read")) return "trim";
  return "healthy";
}
const shortName = (path: string) => path.split("/").slice(1).join("/") || path;

const BUCKETS: Array<{ key: Bucket; label: string; color: string; hint: string; empty: string }> = [
  { key: "fix", label: "Fix first", color: "#be185d", hint: "Risky and heavily read", empty: "Nothing urgent." },
  { key: "review", label: "Review", color: "#bf8700", hint: "Risky, lower traffic", empty: "Nothing to review." },
  { key: "trim", label: "Trim?", color: "#64748b", hint: "Rarely or never read", empty: "None." },
  { key: "healthy", label: "Healthy", color: "#10b981", hint: "Relied-on, no issues", empty: "—" },
];

export function HealthMap({ files, missing }: { files: FileInsight[]; missing: MissingArea[] }) {
  const byBucket: Record<Bucket, FileInsight[]> = { fix: [], review: [], trim: [], healthy: [] };
  for (const f of [...files].sort((a, b) => b.reads - a.reads)) byBucket[bucketOf(f)].push(f);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_19rem]">
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {BUCKETS.map((b) => (
            <div key={b.key} className="rounded-xl border border-line bg-surface p-3 shadow-card">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                <span className="text-sm font-semibold">{b.label}</span>
                <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[11px] font-medium text-muted">{byBucket[b.key].length}</span>
                <span className="ml-auto text-[11px] text-muted">{b.hint}</span>
              </div>
              {byBucket[b.key].length === 0 ? (
                <p className="px-1 py-1 text-xs text-muted">{b.empty}</p>
              ) : (
                <ul className="space-y-0.5">
                  {byBucket[b.key].map((f) => {
                    const d = dominant(f);
                    return (
                      <li key={f.path}>
                        <Link
                          href={`/edit/${f.path}`}
                          title={`${f.path} — ${f.reads.toLocaleString()} reads · ${reason(f)}`}
                          className="flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-hover"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{shortName(f.path)}</span>
                            {b.key !== "healthy" && <span className="block truncate text-[11px] text-muted">{reason(f)}</span>}
                          </span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted">{f.reads.toLocaleString()}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted">
          {[...Object.values(FLAG_INFO), HEALTHY].map((i) => (
            <span key={i!.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: i!.color }} />
              {i!.label}
            </span>
          ))}
        </div>
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
