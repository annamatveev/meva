"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BUILTIN_SOURCE_KINDS,
  type WorkspaceInfo,
  type WorkspaceSourceType,
} from "@context-studio/types";
import { configureWorkspace } from "@/lib/api";
import { authHeaders } from "@/lib/auth";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SourceChip } from "@/components/ui/SourceChip";

interface Row {
  kind: string;
  sourceType: WorkspaceSourceType;
  location: string;
}

export function SetupWizard({ initial }: { initial: WorkspaceInfo }) {
  const router = useRouter();
  const [identityName, setIdentityName] = useState(initial.identityName ?? "");
  const [identityEmail, setIdentityEmail] = useState(initial.identityEmail ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial.sources.length
      ? initial.sources.map((s) => ({ kind: s.kind, sourceType: s.sourceType, location: s.location }))
      : [{ kind: "context", sourceType: "local", location: "" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { kind: "skills", sourceType: "local", location: "" }]);
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  async function submit() {
    setError(null);
    if (!identityName.trim() || !identityEmail.trim() || rows.some((r) => !r.kind.trim() || !r.location.trim())) {
      setError("Fill in your identity and every source's type + location.");
      return;
    }
    setBusy(true);
    const res = await configureWorkspace({ identityName, identityEmail, sources: rows }, authHeaders());
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <SectionLabel n={0}>Workspace</SectionLabel>
        <h1 className="text-2xl font-semibold tracking-tight">Connect your sources</h1>
        <p className="max-w-prose text-sm text-muted">
          A workspace holds the typed Markdown your agent reads — context, skills, memory, or
          anything you define. Each type can live in its own repo, or share a unified one. bravo
          keeps only the connection, never a permanent copy.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-card">
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[8rem_7rem_1fr_auto] items-center gap-2">
              <div className="flex items-center gap-1.5">
                <SourceChip kind={r.kind} />
                <input
                  list="kinds"
                  value={r.kind}
                  onChange={(e) => update(i, { kind: e.target.value })}
                  className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
                />
              </div>
              <select
                value={r.sourceType}
                onChange={(e) => update(i, { sourceType: e.target.value as WorkspaceSourceType })}
                className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs"
              >
                <option value="local">local path</option>
                <option value="remote">git remote</option>
              </select>
              <input
                value={r.location}
                onChange={(e) => update(i, { location: e.target.value })}
                placeholder={r.sourceType === "local" ? "/srv/agent/skills" : "git@host:agent/skills.git"}
                className="w-full rounded-md border border-line bg-surface px-2 py-1.5 font-mono text-xs"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                aria-label="Remove source"
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-hover disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
          <datalist id="kinds">
            {BUILTIN_SOURCE_KINDS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>
          <button onClick={addRow} className="text-xs font-medium text-brand hover:underline">
            + Add a source
          </button>
        </div>

        <div className="h-px bg-line" />

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-muted">
            Your name
            <input
              value={identityName}
              onChange={(e) => setIdentityName(e.target.value)}
              placeholder="Dana Levi"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Your email
            <input
              value={identityEmail}
              onChange={(e) => setIdentityEmail(e.target.value)}
              placeholder="dana@acme.com"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
        </div>

        <p className="text-xs text-muted">
          Layout and agent mapping are read from a versioned <code>.bravo.yml</code> in the
          context source. A <code>context</code> source backs editing; others are tracked too.
        </p>

        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect workspace"}
        </button>
      </div>
    </div>
  );
}
