"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { relativeTime } from "@/components/cpr/ui";

export type QueueKind = "change_request" | "conflict" | "suggestion" | "ticket" | "missing" | "unread";
export type Importance = "low" | "medium" | "high";

export interface QueueItem {
  kind: QueueKind;
  title: string;
  meta: string;
  href: string;
  action: string;
  /** Who opened / raised it — for the owner filter. */
  owner?: string;
  importance?: Importance;
  /** ISO timestamp — for date sort + range filter. */
  date?: string;
  /** Expanded detail — what the issue actually is. */
  body?: string;
  /** The specific line/quote the issue is about, if any. */
  quote?: string;
  /** Where to go to act — the file(s), the other file in a conflict, etc. */
  links?: Array<{ label: string; href: string }>;
}

const KIND: Record<QueueKind, { label: string; dot: string }> = {
  change_request: { label: "Change request", dot: "var(--brand)" },
  conflict: { label: "Conflict", dot: "#d946ef" },
  suggestion: { label: "Suggestion", dot: "#0a7ea4" },
  ticket: { label: "Review ticket", dot: "#d9a441" },
  missing: { label: "Missing data", dot: "#d2483b" },
  unread: { label: "Unread", dot: "var(--type-default)" },
};

const FILTERS: Array<{ key: QueueKind | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "change_request", label: "Change requests" },
  { key: "conflict", label: "Conflicts" },
  { key: "suggestion", label: "Suggestions" },
  { key: "ticket", label: "Review tickets" },
  { key: "missing", label: "Missing data" },
  { key: "unread", label: "Unread" },
];

const FILTER_KEYS = ["change_request", "conflict", "suggestion", "ticket", "missing", "unread"];

const IMP_RANK: Record<Importance, number> = { high: 3, medium: 2, low: 1 };
const IMP_COLOR: Record<Importance, string> = { high: "#cf222e", medium: "#bf8700", low: "#57606a" };

type Sort = "newest" | "oldest" | "importance" | "title";
type DateRange = "all" | "24h" | "7d" | "30d";
const RANGE_MS: Record<Exclude<DateRange, "all">, number> = {
  "24h": 86_400_000,
  "7d": 7 * 86_400_000,
  "30d": 30 * 86_400_000,
};

export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const [filter, setFilter] = useState<QueueKind | "all">("all");

  // Advanced filters + sort.
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("all");
  const [importance, setImportance] = useState<Importance | "all">("all");
  const [range, setRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<Sort>("importance");

  // Honor a ?filter=… deep-link from the dashboard (works in static export).
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f && FILTER_KEYS.includes(f)) setFilter(f as QueueKind);
  }, []);

  const owners = useMemo(
    () => [...new Set(items.map((i) => i.owner).filter((o): o is string => !!o))].sort(),
    [items],
  );

  // Everything except the kind chip — so chip counts reflect active filters.
  const advFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return items.filter((it) => {
      if (q && !`${it.title} ${it.meta}`.toLowerCase().includes(q)) return false;
      if (owner !== "all" && it.owner !== owner) return false;
      if (importance !== "all" && it.importance !== importance) return false;
      if (range !== "all") {
        if (!it.date) return false;
        if (now - new Date(it.date).getTime() > RANGE_MS[range]) return false;
      }
      return true;
    });
  }, [items, query, owner, importance, range]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: advFiltered.length };
    for (const it of advFiltered) c[it.kind] = (c[it.kind] ?? 0) + 1;
    return c;
  }, [advFiltered]);

  const filtered = useMemo(() => {
    const arr = filter === "all" ? advFiltered : advFiltered.filter((i) => i.kind === filter);
    const ts = (i: QueueItem) => (i.date ? new Date(i.date).getTime() : 0);
    const rank = (i: QueueItem) => (i.importance ? IMP_RANK[i.importance] : 0);
    return [...arr].sort((a, b) => {
      if (sort === "newest") return ts(b) - ts(a);
      if (sort === "oldest") return ts(a) - ts(b);
      if (sort === "title") return a.title.localeCompare(b.title);
      return rank(b) - rank(a) || ts(b) - ts(a); // importance
    });
  }, [advFiltered, filter, sort]);

  const advActive = query !== "" || owner !== "all" || importance !== "all" || range !== "all";
  const clearAdv = () => {
    setQuery("");
    setOwner("all");
    setImportance("all");
    setRange("all");
  };
  const setF = (f: QueueKind | "all") => setFilter(f);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionLabel n={1}>Inbox</SectionLabel>
        <h1 className="text-3xl font-semibold tracking-tight">Everything that needs you</h1>
        <p className="max-w-prose text-sm text-muted">
          One place to triage — change requests to approve, conflicts and suggestions to resolve, gaps to fill,
          and knowledge nobody reads. Search, filter, sort, then work through them.
        </p>
      </div>

      {/* Advanced filters + sort */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 shadow-card">
        <div className="relative min-w-[12rem] flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or content…"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <Select label="Owner" value={owner} onChange={setOwner}>
          <option value="all">Any owner</option>
          {owners.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
        <Select label="Importance" value={importance} onChange={(v) => setImportance(v as Importance | "all")}>
          <option value="all">Any importance</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select label="Date" value={range} onChange={(v) => setRange(v as DateRange)}>
          <option value="all">Any time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Select label="Sort" value={sort} onChange={(v) => setSort(v as Sort)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="importance">Importance</option>
            <option value="title">Title (A–Z)</option>
          </Select>
          {advActive && (
            <button onClick={clearAdv} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:text-ink">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* kind chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setF(f.key)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              filter === f.key
                ? "border-brand bg-brand/10 text-ink"
                : "border-line text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            {f.label}
            <span className="ml-1.5 font-mono text-xs text-muted">{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted shadow-card">
          {items.length === 0 ? "Nothing here — queue’s clear. 🎉" : "No items match these filters."}
        </div>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {filtered.map((it, i) => (
            <Row key={`${it.kind}-${i}`} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
      >
        {children}
      </select>
    </label>
  );
}

function ImportanceBadge({ importance }: { importance: Importance }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize"
      style={{ background: hexA(IMP_COLOR[importance], 0.12), color: IMP_COLOR[importance] }}
    >
      {importance}
    </span>
  );
}

function KindBadge({ kind }: { kind: QueueKind }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: KIND[kind].dot }} />
      {KIND[kind].label}
    </span>
  );
}

function Row({ item }: { item: QueueItem }) {
  const [open, setOpen] = useState(false);
  const links = item.links?.length ? item.links : [{ label: item.action, href: item.href }];
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="group flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-hover">
        <div className="min-w-0 flex-1">
          <KindBadge kind={item.kind} />
          <div className="mt-0.5 truncate text-sm font-medium">{item.title}</div>
          <div className="truncate text-xs text-muted">{item.meta}</div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
          {item.importance && <ImportanceBadge importance={item.importance} />}
          <span className="text-[11px] text-muted">
            {item.owner ? `${item.owner}` : ""}
            {item.owner && item.date ? " · " : ""}
            {item.date ? relativeTime(item.date) : ""}
          </span>
        </div>
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line text-muted transition group-hover:bg-hover group-hover:text-ink ${open ? "rotate-180 bg-hover text-ink" : ""}`}
          aria-hidden
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line bg-surface2/40 px-5 py-3">
          {item.body && <p className="text-sm text-ink/90">{item.body}</p>}
          {item.quote && (
            <blockquote className="border-l-2 border-brand/40 pl-3 text-xs italic text-muted">{item.quote}</blockquote>
          )}
          <div className="flex flex-wrap gap-2">
            {links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-hover"
              >
                {l.label} →
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function hexA(hex: string, a: number) {
  if (hex.startsWith("var")) return hex;
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
