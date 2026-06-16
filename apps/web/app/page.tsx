import Link from "next/link";
import { redirect } from "next/navigation";
import type { FreshnessState } from "@context-studio/types";
import { getFreshnessOverview, getHealth, getWorkspace, listContextPrs, listTickets } from "@/lib/api";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { FirstRunRedirect } from "@/components/onboarding/FirstRunRedirect";

export const dynamic = process.env.STATIC_EXPORT === "1" ? "force-static" : "force-dynamic";

const KIND_COLOR = (k: string) =>
  ["context", "skills", "memory"].includes(k) ? `var(--type-${k})` : "var(--type-default)";

const FRESH_COLOR: Record<FreshnessState, string> = {
  fresh: "#10b981",
  stale: "#f59e0b",
  expired: "#f43f5e",
  conflicted: "#d946ef",
};

export default async function Dashboard() {
  let needsSetup = false;
  try {
    needsSetup = !(await getWorkspace()).configured;
  } catch {
    /* fall through */
  }
  if (needsSetup) redirect("/setup");

  let health;
  let freshness;
  let prs;
  let tickets;
  try {
    [health, freshness, prs, tickets] = await Promise.all([
      getHealth(),
      getFreshnessOverview(),
      listContextPrs(),
      listTickets(),
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
  const neverRead = health.cold.filter((c) => c.reads === 0).length;
  const queueCount = openCRs + tickets.length + health.missing.length + neverRead;

  const byKind = new Map<string, number>();
  for (const a of [...health.hot, ...health.cold]) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + a.reads);
  const kindBars = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, reads]) => ({ label: kind, value: reads, color: KIND_COLOR(kind) }));

  const freshSegments = (["fresh", "stale", "expired", "conflicted"] as FreshnessState[]).map((s) => ({
    label: s,
    value: freshness.counts[s],
    color: FRESH_COLOR[s],
  }));

  const topRead = health.hot.slice(0, 5).map((a) => ({
    label: a.path.split(" › ").pop() ?? a.path,
    value: a.reads,
    color: "var(--brand)",
  }));

  return (
    <div className="space-y-8">
      <FirstRunRedirect />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <SectionLabel n={1}>Dashboard</SectionLabel>
          <h1 className="text-3xl font-semibold tracking-tight">Agent knowledge health</h1>
          <p className="max-w-prose text-sm text-muted">
            A read on what your agents lean on, what they ignore, and what they can’t find.
            {health.sample && <span className="text-accent"> Sample data — live with the MCP read-proxy.</span>}
          </p>
        </div>
        <Link href="/inbox" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
          Inbox · {queueCount} →
        </Link>
      </div>

      {/* drill-in stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label={`Reads · ${health.periodDays}d`} value={health.totalReads.toLocaleString()} tone="text-brand" />
        <StatTile label="Unanswered asks" value={health.totalMisses} tone="text-rose-700 dark:text-rose-300" href="/inbox?filter=missing" />
        <StatTile label="Never-read areas" value={neverRead} tone="text-amber-700 dark:text-amber-300" href="/inbox?filter=unread" />
        <StatTile label="Open change requests" value={openCRs} tone="text-emerald-700 dark:text-emerald-300" href="/inbox?filter=change_request" />
      </div>

      {/* charts */}
      <section className="space-y-3">
        <SectionLabel n={2}>At a glance</SectionLabel>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card title={`Reads · last ${health.trend.length}d`}>
            <Sparkline values={health.trend} />
            <div className="mt-2 text-xs text-muted">{health.totalReads.toLocaleString()} total · trending up</div>
          </Card>
          <Card title="Freshness">
            <div className="flex items-center gap-4">
              <Donut segments={freshSegments} />
              <ul className="space-y-1 text-xs">
                {freshSegments.map((s) => (
                  <li key={s.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="capitalize text-muted">{s.label}</span>
                    <span className="font-medium">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card title="Reads by type">
            <Bars items={kindBars} />
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel n={3}>Most read</SectionLabel>
        <Card title="">
          <Bars items={topRead} />
        </Card>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      {title && <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted">{title}</div>}
      {children}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 240;
  const h = 48;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 6) - 3}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Donut({ segments }: { segments: Array<{ value: number; color: string }> }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 30;
  const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 shrink-0" aria-hidden>
      <g transform="rotate(-90 40 40)">
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={i} cx="40" cy="40" r={R} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} />
          );
          off += len;
          return el;
        })}
      </g>
    </svg>
  );
}

function Bars({ items }: { items: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label}>
          <div className="flex items-center justify-between text-xs">
            <span className="truncate capitalize text-muted">{i.label}</span>
            <span className="font-medium">{i.value.toLocaleString()}</span>
          </div>
          <div className="mt-0.5 h-2 rounded-full bg-surface2">
            <div className="h-2 rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
