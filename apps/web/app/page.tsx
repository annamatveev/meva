import Link from "next/link";
import { redirect } from "next/navigation";
import type { FileInsight, InsightFlag } from "@context-studio/types";
import { getHealth, getInsights, getWorkspace, listContextPrs } from "@/lib/api";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SourceChip } from "@/components/ui/SourceChip";
import { FirstRunRedirect } from "@/components/onboarding/FirstRunRedirect";

export const dynamic = process.env.STATIC_EXPORT === "1" ? "force-static" : "force-dynamic";

const KIND_COLOR = (k: string) =>
  ["context", "skills", "memory"].includes(k) ? `var(--type-${k})` : "var(--type-default)";

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
  const neverRead = health.cold.filter((c) => c.reads === 0).length;

  const byKind = new Map<string, number>();
  for (const f of insights.files) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + f.reads);
  const kindBars = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, reads]) => ({ label: kind, value: reads, color: KIND_COLOR(kind) }));

  // The "what to act on" prompts — each derived from the file insights.
  const firstUnverified = insights.files.find((f) => f.flags.includes("unverified"))?.path;
  const actCards = [
    { label: "Conflicts", value: insights.summary.conflicts, sub: "Files that disagree", href: "/inbox?filter=conflict", color: "#d946ef" },
    { label: "Unverified", value: insights.summary.unverified, sub: "AI text no human approved", href: firstUnverified ? `/edit/${firstUnverified}` : "/inbox", color: "#bf8700" },
    { label: "Stale", value: insights.summary.stale, sub: "Past their review window", href: "/inbox?filter=ticket", color: "#f59e0b" },
    { label: "Rarely read", value: insights.summary.rarelyRead, sub: "Candidates to trim", href: "/inbox?filter=unread", color: "#64748b" },
  ];

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card title={`Reads · last ${health.trend.length}d`}>
            <Sparkline values={health.trend} />
            <div className="mt-2 text-xs text-muted">{health.totalReads.toLocaleString()} total · trending up</div>
          </Card>
          <Card title="Reads by type">
            <Bars items={kindBars} />
          </Card>
        </div>
      </section>

      {/* What to act on — decision prompts derived from the file insights. */}
      <section className="space-y-3">
        <SectionLabel n={3}>What to act on</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {actCards.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-xl border border-line bg-surface p-4 shadow-card transition hover:border-brand/40 hover:bg-hover"
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                <span className="text-2xl font-semibold" style={{ color: c.value > 0 ? c.color : "var(--muted)" }}>
                  {c.value}
                </span>
              </div>
              <div className="mt-1 text-sm font-medium">{c.label}</div>
              <div className="flex items-center justify-between text-xs text-muted">
                {c.sub} <span className="text-brand">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Files — the read on every managed file, sortable by what matters. */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <SectionLabel n={4}>Files</SectionLabel>
          <span className="text-xs text-muted">
            {insights.files.length} files · reads over the last {insights.periodDays}d
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_8rem_12rem] items-center gap-4 border-b border-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted md:grid">
            <span>File</span>
            <span className="text-right">Reads</span>
            <span className="text-center">Trend</span>
            <span>Provenance</span>
            <span className="text-right">Signals</span>
          </div>
          <div className="divide-y divide-line">
            {insights.files.map((f) => (
              <FileRow key={f.path} f={f} />
            ))}
          </div>
        </div>
        <p className="px-1 text-xs text-muted">
          Provenance bar: <span className="text-emerald-600 dark:text-emerald-400">human</span> ·{" "}
          <span className="text-brand">AI-approved</span> ·{" "}
          <span className="text-amber-600 dark:text-amber-400">unverified</span>. Click a file to open it in the Library.
        </p>
      </section>
    </div>
  );
}

const FLAG: Record<InsightFlag, { label: string; color: string }> = {
  conflict: { label: "Conflict", color: "#d946ef" },
  unverified: { label: "Unverified", color: "#bf8700" },
  stale: { label: "Stale", color: "#f59e0b" },
  never_read: { label: "Never read", color: "#cf222e" },
  rarely_read: { label: "Rarely read", color: "#64748b" },
  open_requests: { label: "Open requests", color: "#0969da" },
  hot: { label: "Hot", color: "var(--brand)" },
};

function FileRow({ f }: { f: FileInsight }) {
  const name = f.path.split("/").slice(1).join("/") || f.path;
  // Signals are attention flags only: drop "hot" (good, not actionable — the
  // reads number already shows it) and "open_requests" (its own badge).
  const signals = f.flags.filter((fl) => fl !== "open_requests" && fl !== "hot");
  return (
    <Link
      href={`/edit/${f.path}`}
      className="grid grid-cols-1 items-center gap-3 px-4 py-3 transition hover:bg-hover md:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_8rem_12rem] md:gap-4"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <SourceChip kind={f.kind} />
          <span className="truncate text-sm font-medium">{name}</span>
        </div>
        {f.lastReadAt && (
          <div className="mt-0.5 text-[11px] text-muted">last read {relTime(f.lastReadAt)}</div>
        )}
      </div>

      <div className="text-sm font-semibold tabular-nums md:text-right">{f.reads.toLocaleString()}</div>

      <div className="flex justify-center">
        <MiniSpark values={f.trend} />
      </div>

      <ProvenanceBar lines={f.lines} />

      <div className="flex flex-wrap gap-1 md:justify-end">
        {f.openRequests > 0 && <Chip color="#0969da" label={`${f.openRequests} open`} />}
        {signals.map((fl) => (
          <Chip key={fl} color={FLAG[fl].color} label={FLAG[fl].label} />
        ))}
      </div>
    </Link>
  );
}

function Chip({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: hexA(color, 0.12), color }}
    >
      {label}
    </span>
  );
}

function MiniSpark({ values }: { values: number[] }) {
  const w = 64;
  const h = 20;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const flat = max === min;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${flat ? h / 2 : h - ((v - min) / (max - min)) * (h - 4) - 2}`)
    .join(" ");
  const up = values[values.length - 1]! >= values[0]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-5 w-16" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={flat ? "var(--muted)" : up ? "#10b981" : "#f43f5e"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProvenanceBar({ lines }: { lines: FileInsight["lines"] }) {
  const total = lines.total || 1;
  const seg = (n: number, color: string, key: string) =>
    n > 0 ? <div key={key} style={{ width: `${(n / total) * 100}%`, background: color }} /> : null;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface2" title={`${lines.human} human · ${lines.approved} AI-approved · ${lines.unverified} unverified`}>
      {seg(lines.human, "#10b981", "h")}
      {seg(lines.approved, "var(--brand)", "a")}
      {seg(lines.unverified, "#f59e0b", "u")}
    </div>
  );
}

function hexA(hex: string, a: number) {
  if (hex.startsWith("var")) return hex;
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d >= 1) return `${d}d ago`;
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}h ago`;
  return "just now";
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
