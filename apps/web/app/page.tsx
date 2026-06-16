import Link from "next/link";
import { getFreshnessOverview, listContextPrs } from "@/lib/api";
import { AuthorBadge, SeverityPill, StatusBadge, relativeTime } from "@/components/cpr/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let prs;
  let freshness;
  try {
    [prs, freshness] = await Promise.all([listContextPrs(), getFreshnessOverview()]);
  } catch {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">Couldn’t reach the backend</h1>
        <p className="mt-1 text-sm text-amber-800">
          Start it with <code>pnpm dev:server</code> (default http://localhost:4000), then reload.
        </p>
      </div>
    );
  }

  const open = prs.filter((p) => !["merged", "rejected"].includes(p.status));
  const closed = prs.filter((p) => ["merged", "rejected"].includes(p.status));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Change Requests</h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Review and authorize proposed changes to the context that feeds your autonomous agents.
          </p>
        </div>
        <Link
          href="/edit/policies/refunds.md"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          + Edit a policy
        </Link>
      </div>

      {/* Governance snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Fresh" value={freshness.counts.fresh} tone="text-emerald-700" />
        <Stat label="Stale" value={freshness.counts.stale} tone="text-amber-700" />
        <Stat label="Expired" value={freshness.counts.expired} tone="text-rose-700" />
        <Stat label="Conflicted" value={freshness.counts.conflicted} tone="text-fuchsia-700" />
      </div>

      <Section title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <Empty>No open change requests.</Empty>
        ) : (
          open.map((pr) => <PrRow key={pr.id} pr={pr} />)
        )}
      </Section>

      {closed.length > 0 && (
        <Section title={`Closed (${closed.length})`}>
          {closed.map((pr) => (
            <PrRow key={pr.id} pr={pr} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="text-xs text-muted">{label} blocks</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-6 text-sm text-muted">{children}</div>;
}

function PrRow({
  pr,
}: {
  pr: Awaited<ReturnType<typeof listContextPrs>>[number];
}) {
  return (
    <Link
      href={`/pr/${pr.id}`}
      className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-black/[0.02]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{pr.title}</span>
          {pr.origin === "agent" && (
            <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
              agent
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span className="font-mono">{pr.id}</span>
          <span aria-hidden>·</span>
          <span>{pr.documentPath}</span>
          <span aria-hidden>·</span>
          <span>updated {relativeTime(pr.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {pr.affectedAgents > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <SeverityPill severity={pr.blastMaxSeverity} />
            {pr.affectedAgents} agent{pr.affectedAgents === 1 ? "" : "s"}
          </span>
        )}
        <AuthorBadge author={pr.author} />
        <StatusBadge status={pr.status} />
      </div>
    </Link>
  );
}
