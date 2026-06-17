import Link from "next/link";
import { redirect } from "next/navigation";
import { getHealth, getInsights, getWorkspace, listContextPrs } from "@/lib/api";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { HealthMap } from "@/components/dashboard/HealthMap";
import { FirstRunRedirect } from "@/components/onboarding/FirstRunRedirect";

export const dynamic = process.env.STATIC_EXPORT === "1" ? "force-static" : "force-dynamic";

export default async function Dashboard() {
  let needsSetup = false;
  try {
    needsSetup = !(await getWorkspace()).configured;
  } catch {
    /* fall through */
  }
  if (needsSetup) redirect("/setup");

  let health;
  let insights;
  let prs;
  try {
    [health, insights, prs] = await Promise.all([
      getHealth(),
      getInsights(),
      listContextPrs(),
    ]);
  } catch {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Couldn’t reach the backend</h1>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Start it with <code>pnpm dev:server</code>, then reload.</p>
      </div>
    );
  }

  const openCRs = prs.filter((p) => !["merged", "rejected"].includes(p.status)).length;

  return (
    <div className="space-y-8">
      <FirstRunRedirect />

      <div className="space-y-2">
        <SectionLabel n={1}>Dashboard</SectionLabel>
        <h1 className="text-3xl font-semibold tracking-tight">Agent knowledge health</h1>
        <p className="max-w-prose text-sm text-muted">
          A read on what your agents lean on, what they ignore, and what they can’t find.
          {health.sample && <span className="text-accent"> Sample data — live with the MCP read-proxy.</span>}
        </p>
      </div>

      {/* top-line KPIs — kept distinct from the File health view below */}
      <div className="grid max-w-md grid-cols-2 gap-3">
        <StatTile label={`Reads · ${health.periodDays}d`} value={health.totalReads.toLocaleString()} tone="text-brand" />
        <StatTile label="Open change requests" value={openCRs} tone="text-emerald-700 dark:text-emerald-300" href="/inbox?filter=change_request" />
      </div>

      {/* File health — status of every file + where the gaps are. */}
      <section className="space-y-3">
        <SectionLabel n={2}>File health</SectionLabel>
        <HealthMap files={insights.files} missing={health.missing} />
      </section>
    </div>
  );
}

function StatTile({ label, value, tone, href }: { label: string; value: number | string; tone: string; href?: string }) {
  const body = (
    <>
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="flex items-center justify-between text-xs text-muted">
        {label} {href && <span className="text-brand">→</span>}
      </div>
    </>
  );
  const cls = "rounded-xl border border-line bg-surface p-4 shadow-card";
  return href ? (
    <Link href={href} className={`${cls} block transition hover:border-brand/40 hover:bg-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

