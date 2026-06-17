"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthConfig, SessionUser } from "@context-studio/types";
import { getAuthConfig, getUsers, googleLoginUrl, login } from "@/lib/api";
import { setSession } from "@/lib/auth";
import { AuthorBadge } from "@/components/cpr/ui";
import { SectionLabel } from "@/components/ui/SectionLabel";

export default function LoginPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (cfg.pickUserEnabled) getUsers().then(setUsers).catch(() => {});
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  async function pick(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await login(id);
      setSession({ token: res.token, user: res.user });
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2">
        <SectionLabel n={0}>Sign in</SectionLabel>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to bravo</h1>
        <p className="text-sm text-muted">Sign in to review and authorize context changes.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      )}

      {config?.googleEnabled && (
        <a
          href={googleLoginUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Continue with Google
        </a>
      )}

      {config?.googleEnabled && config?.pickUserEnabled && (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-line" /> or · local / dev
          <span className="h-px flex-1 bg-line" />
        </div>
      )}

      {config?.pickUserEnabled && (
        <div>
          <p className="mb-2 text-xs text-muted">
            Pick-user login (no passwords) — a stand-in for SSO in local/dev. The server derives
            who you are from the issued token.
          </p>
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {users.length === 0 ? (
              <div className="px-5 py-6 text-sm text-muted">No users found.</div>
            ) : (
              users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pick(u.id)}
                  disabled={busy !== null}
                  className="flex w-full items-center justify-between px-5 py-3 text-left transition hover:bg-hover disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <AuthorBadge author={{ id: u.id, kind: "human", name: u.name, role: u.role }} />
                    <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      {u.accessRole}
                    </span>
                  </div>
                  <span className="text-sm text-brand">
                    {busy === u.id ? "Signing in…" : "Sign in →"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {config && !config.googleEnabled && !config.pickUserEnabled && (
        <p className="text-sm text-muted">No sign-in method is configured on the server.</p>
      )}
    </div>
  );
}
