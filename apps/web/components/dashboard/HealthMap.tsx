import Link from "next/link";
import type { FileInsight, InsightFlag, MissingArea } from "@context-studio/types";

/**
 * Health map — the context owner's "what needs me" overview.
 *
 * Each dot is a file, placed by impact (how much agents read it, →) and risk
 * (conflicts / unverified AI / staleness / open requests, ↑). Top-right = fix
 * first; bottom-right = healthy & relied-on. Dots link to the file.
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
  const hot = f.reads >= 150;
  if (f.flags.includes("conflict")) return hot ? "Conflicts in a heavily-read file" : "Conflicts with another file";
  if (f.flags.includes("unverified")) return hot ? "Unreviewed AI text agents lean on" : "Contains unreviewed AI text";
  if (f.flags.includes("stale")) return "Past its review window";
  if (f.flags.includes("never_read")) return "Never read — candidate to remove";
  if (f.flags.includes("rarely_read")) return "Rarely read — candidate to trim";
  return "Healthy";
}
const shortName = (path: string) => path.split("/").slice(1).join("/") || path;

export function HealthMap({ files, missing }: { files: FileInsight[]; missing: MissingArea[] }) {
  const maxReads = Math.max(...files.map((f) => f.reads), 1);
  const maxRisk = Math.max(...files.map(risk), 1);
  // sqrt x-scale spreads out the many low-read files; y is linear risk.
  const xPct = (reads: number) => 7 + Math.sqrt(reads / maxReads) * 86;
  const yPct = (rk: number) => 9 + (rk / maxRisk) * 82;

  const attention = [...files]
    .filter((f) => risk(f) > 0 || f.flags.includes("rarely_read") || f.flags.includes("never_read"))
    .sort((a, b) => risk(b) * (b.reads + 1) - risk(a) * (a.reads + 1) || b.reads - a.reads)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_19rem]">
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Impact vs risk</span>
          <span className="text-[11px] text-muted">each dot = a file · click to open</span>
        </div>

        <div className="relative mt-2 h-72 w-full">
          {/* quadrant tints */}
          <div className="absolute left-1/2 top-0 h-1/2 w-1/2 rounded-tr-lg" style={{ background: "rgba(217,70,239,0.05)" }} />
          <div className="absolute left-0 top-0 h-1/2 w-1/2 rounded-tl-lg" style={{ background: "rgba(191,135,0,0.05)" }} />
          <div className="absolute bottom-0 right-0 h-1/2 w-1/2 rounded-br-lg" style={{ background: "rgba(16,185,129,0.05)" }} />
          {/* dividers */}
          <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-line" />
          <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-line" />
          {/* quadrant labels */}
          <span className="absolute left-2 top-1.5 text-[11px] font-medium text-muted">Review · low traffic</span>
          <span className="absolute right-2 top-1.5 text-[11px] font-medium" style={{ color: "#be185d" }}>Fix first ↗</span>
          <span className="absolute bottom-1.5 left-2 text-[11px] text-muted">Trim?</span>
          <span className="absolute bottom-1.5 right-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Healthy &amp; relied-on</span>
          {/* axis hint */}
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] text-muted">reads →</span>

          {/* bubbles */}
          {files.map((f) => {
            const d = dominant(f);
            return (
              <Link
                key={f.path}
                href={`/edit/${f.path}`}
                title={`${f.path} — ${f.reads.toLocaleString()} reads · ${reason(f)}`}
                className="group absolute -translate-x-1/2 translate-y-1/2"
                style={{ left: `${xPct(f.reads)}%`, bottom: `${yPct(risk(f))}%` }}
              >
                <span
                  className="block h-3.5 w-3.5 rounded-full border-2 transition-transform group-hover:scale-150"
                  style={{ background: `${d.color}26`, borderColor: d.color }}
                />
                <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-ink/85 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {shortName(f.path)}
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
          {[...Object.values(FLAG_INFO), HEALTHY].map((i) => (
            <span key={i!.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: i!.color }} />
              {i!.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">Needs your attention</div>
          <ul className="space-y-1.5">
            {attention.length === 0 && <li className="text-xs text-muted">Everything looks healthy.</li>}
            {attention.map((f) => {
              const d = dominant(f);
              return (
                <li key={f.path}>
                  <Link href={`/edit/${f.path}`} className="block rounded-lg px-1 py-1 transition hover:bg-hover">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
                      <span className="truncate">{shortName(f.path)}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{f.reads.toLocaleString()} reads</span>
                    </div>
                    <div className="pl-3.5 text-xs text-muted">{reason(f)}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Top gaps · unanswered asks
          </div>
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
    </div>
  );
}
