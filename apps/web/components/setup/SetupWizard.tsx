"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceInfo, WorkspaceSourceType } from "@context-studio/types";
import { configureWorkspace } from "@/lib/api";

export function SetupWizard({ initial }: { initial: WorkspaceInfo }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<WorkspaceSourceType>(
    initial.sourceType ?? "local",
  );
  const [location, setLocation] = useState(initial.location ?? "");
  const [identityName, setIdentityName] = useState(initial.identityName ?? "");
  const [identityEmail, setIdentityEmail] = useState(initial.identityEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!location.trim() || !identityName.trim() || !identityEmail.trim()) {
      setError("Fill in every field.");
      return;
    }
    setBusy(true);
    const res = await configureWorkspace({ sourceType, location, identityName, identityEmail });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect your context</h1>
        <p className="mt-1 text-sm text-muted">
          Point Context Studio at where your agent context lives. meva stores only this
          connection — never a permanent copy of your files.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border border-black/5 bg-white p-5 shadow-sm">
        {/* Source type */}
        <div>
          <label className="text-xs font-medium text-muted">Where does the context live?</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <SourceCard
              active={sourceType === "local"}
              onClick={() => setSourceType("local")}
              title="Local path"
              body="A directory meva can reach directly (meva runs next to the files)."
            />
            <SourceCard
              active={sourceType === "remote"}
              onClick={() => setSourceType("remote")}
              title="Git remote"
              body="An SSH/HTTPS git URL. meva keeps a disposable working clone."
            />
          </div>
        </div>

        <Field
          label={sourceType === "local" ? "Directory path" : "Git remote URL"}
          value={location}
          onChange={setLocation}
          placeholder={
            sourceType === "local"
              ? "/srv/context  (or ./apps/server/.context-repo)"
              : "git@192.168.0.173:context.git"
          }
          mono
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Your name" value={identityName} onChange={setIdentityName} placeholder="Dana Levi" />
          <Field
            label="Your email"
            value={identityEmail}
            onChange={setIdentityEmail}
            placeholder="dana@context.studio"
          />
        </div>

        <p className="text-xs text-muted">
          The layout and agent mapping are read from a <code>.contextstudio.yml</code> committed
          in that repo, so they stay versioned with your content.
        </p>

        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Connecting…" : "Connect workspace"}
        </button>
      </div>
    </div>
  );
}

function SourceCard({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition ${
        active ? "border-ink bg-black/[0.03]" : "border-black/10 hover:border-black/20"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={`h-2 w-2 rounded-full ${active ? "bg-ink" : "bg-slate-300"}`} aria-hidden />
        {title}
      </div>
      <p className="mt-1 text-xs text-muted">{body}</p>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
