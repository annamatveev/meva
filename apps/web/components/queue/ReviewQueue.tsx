"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";

export type QueueKind = "change_request" | "ticket" | "missing" | "unread";

export interface QueueItem {
  kind: QueueKind;
  title: string;
  meta: string;
  href: string;
  action: string;
  severity?: "low" | "medium" | "high";
}

const KIND: Record<QueueKind, { label: string; dot: string }> = {
  change_request: { label: "Change request", dot: "var(--brand)" },
  ticket: { label: "Review ticket", dot: "#d9a441" },
  missing: { label: "Missing data", dot: "#d2483b" },
  unread: { label: "Unread", dot: "var(--type-default)" },
};

const FILTERS: Array<{ key: QueueKind | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "change_request", label: "Change requests" },
  { key: "ticket", label: "Review tickets" },
  { key: "missing", label: "Missing data" },
  { key: "unread", label: "Unread" },
];

export function ReviewQueue({ items }: { items: QueueItem[] }) {
  const [filter, setFilter] = useState<QueueKind | "all">("all");
  const [view, setView] = useState<"list" | "focus">("list");
  const [idx, setIdx] = useState(0);

  // Honor a ?filter=… deep-link from the dashboard (works in static export).
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filter");
    if (f && ["change_request", "ticket", "missing", "unread"].includes(f)) {
      setFilter(f as QueueKind);
    }
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const it of items) c[it.kind] = (c[it.kind] ?? 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  const setF = (f: QueueKind | "all") => {
    setFilter(f);
    setIdx(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <SectionLabel n={1}>Inbox</SectionLabel>
          <h1 className="text-3xl font-semibold tracking-tight">Everything that needs you</h1>
          <p className="max-w-prose text-sm text-muted">
            One place to triage — change requests to approve, stale blocks to review, gaps to fill,
            and knowledge nobody reads. Filter, then work through them.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
          {(["list", "focus"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize ${view === v ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* filter chips */}
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
          Nothing here — queue’s clear. 🎉
        </div>
      ) : view === "list" ? (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {filtered.map((it, i) => (
            <Row key={`${it.kind}-${i}`} item={it} />
          ))}
        </div>
      ) : (
        <Focus
          items={filtered}
          idx={Math.min(idx, filtered.length - 1)}
          onPrev={() => setIdx((n) => Math.max(0, n - 1))}
          onNext={() => setIdx((n) => Math.min(filtered.length - 1, n + 1))}
        />
      )}
    </div>
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
  return (
    <Link href={item.href} className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-hover">
      <div className="min-w-0">
        <KindBadge kind={item.kind} />
        <div className="mt-0.5 truncate text-sm font-medium">{item.title}</div>
        <div className="truncate text-xs text-muted">{item.meta}</div>
      </div>
      <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-brand">
        {item.action} →
      </span>
    </Link>
  );
}

function Focus({
  items,
  idx,
  onPrev,
  onNext,
}: {
  items: QueueItem[];
  idx: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const it = items[idx];
  if (!it) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span className="font-mono text-xs">
          {idx + 1} / {items.length}
        </span>
        <div className="flex gap-2">
          <button onClick={onPrev} disabled={idx === 0} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
            ← Prev
          </button>
          <button onClick={onNext} disabled={idx === items.length - 1} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">
            Next →
          </button>
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
        <KindBadge kind={it.kind} />
        <h2 className="mt-2 text-xl font-semibold">{it.title}</h2>
        <p className="mt-1 text-sm text-muted">{it.meta}</p>
        <Link
          href={it.href}
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {it.action} →
        </Link>
      </div>
    </div>
  );
}
