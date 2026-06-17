"use client";

import { useEffect, useMemo, useState } from "react";
import type { EvalDefinition, SourceKind } from "@context-studio/types";
import { getEvalDefinitions, updateEvalDefinition } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SourceChip } from "@/components/ui/SourceChip";

type Def = EvalDefinition & { local?: boolean };

const SOURCE_ORDER = (k: SourceKind) => ({ context: 0, skills: 1, memory: 2 } as Record<string, number>)[k] ?? 9;

let localCounter = 0;

export function EvalsConfig() {
  const [defs, setDefs] = useState<Def[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEvalDefinitions()
      .then((c) => setDefs(c.definitions))
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoaded(true));
  }, []);

  const sources = useMemo(
    () => [...new Set(defs.map((d) => d.source))].sort((a, b) => SOURCE_ORDER(a) - SOURCE_ORDER(b)),
    [defs],
  );
  const requiredCount = defs.filter((d) => d.required).length;

  const toggle = (id: string) => {
    let next = false;
    setDefs((ds) => ds.map((d) => (d.id === id ? ((next = !d.required), { ...d, required: next }) : d)));
    void updateEvalDefinition(id, { required: next }, authHeaders());
  };
  const rename = (id: string, name: string) => setDefs((ds) => ds.map((d) => (d.id === id ? { ...d, name } : d)));
  const remove = (id: string) => setDefs((ds) => ds.filter((d) => d.id !== id));
  const addCheck = (source: SourceKind) =>
    setDefs((ds) => [...ds, { id: `local-${++localCounter}`, source, name: "", question: "", required: true, lastStatus: "unknown", local: true }]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <SectionLabel n={1}>Quality</SectionLabel>
          <h1 className="text-3xl font-semibold tracking-tight">Merge gates</h1>
          <p className="max-w-prose text-sm text-muted">
            Per-source checks that must pass before a change to that source can merge. They aren’t context-only —
            each source (context, skills, memory, or a custom type) carries its own. Required checks block the merge;
            optional ones just warn.
          </p>
        </div>
        <span className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted">
          <span className="font-semibold text-ink">{requiredCount}</span> required · {sources.length} sources
        </span>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-800 dark:text-amber-200">
          Couldn’t load evals: {error}
        </div>
      ) : !loaded ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted shadow-card">Loading…</div>
      ) : (
        sources.map((source) => (
          <section key={source} className="space-y-2">
            <SourceChip kind={source} />
            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              {defs
                .filter((d) => d.source === source)
                .map((d) => (
                  <EvalRow key={d.id} def={d} onToggle={() => toggle(d.id)} onRename={(n) => rename(d.id, n)} onRemove={() => remove(d.id)} />
                ))}
              <button
                onClick={() => addCheck(source)}
                className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-sm text-brand transition hover:bg-hover"
              >
                + Add check
              </button>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function EvalRow({
  def,
  onToggle,
  onRename,
  onRemove,
}: {
  def: Def;
  onToggle: () => void;
  onRename: (n: string) => void;
  onRemove: () => void;
}) {
  const assertions = [
    ...(def.expectContains ?? []).map((p) => ({ kind: "must" as const, text: p })),
    ...(def.expectNotContains ?? []).map((p) => ({ kind: "mustnot" as const, text: p })),
  ];
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Toggle on={def.required} onClick={onToggle} label="Required to merge" />
      <div className="min-w-0 flex-1">
        {def.local ? (
          <input
            autoFocus
            value={def.name}
            onChange={(e) => onRename(e.target.value)}
            placeholder="Check name (e.g. “Refund window is stated”)"
            className="w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        ) : (
          <div className="truncate text-sm font-medium">{def.name}</div>
        )}
        {def.question && <div className="truncate text-xs text-muted">“{def.question}”</div>}
        {assertions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {assertions.map((a, i) => (
              <span
                key={i}
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  a.kind === "must"
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                }`}
                title={a.kind === "must" ? "Must contain" : "Must not contain"}
              >
                {a.kind === "must" ? "contains" : "excludes"}: {a.text}
              </span>
            ))}
          </div>
        )}
      </div>
      <StatusBadge status={def.lastStatus} required={def.required} />
      {def.local && (
        <button onClick={onRemove} className="shrink-0 text-muted hover:text-ink" aria-label="Remove check">✕</button>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={on ? "Required to merge — click to make optional" : "Optional — click to require for merge"}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-surface2"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`} />
    </button>
  );
}

function StatusBadge({ status, required }: { status?: "pass" | "fail" | "unknown"; required: boolean }) {
  if (status === "pass")
    return <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">pass</span>;
  if (status === "fail")
    return (
      <span className={`shrink-0 text-xs font-semibold ${required ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-300"}`}>
        fail{required ? " · blocks" : ""}
      </span>
    );
  return <span className="shrink-0 text-xs text-muted">not run</span>;
}
