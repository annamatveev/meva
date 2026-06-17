"use client";

import { useEffect, useState } from "react";

const KEY = "cs.welcome.dismissed";

const STEPS = [
  { n: 1, title: "Edit", body: "Draft a change in the Library. Edits autosave privately." },
  { n: 2, title: "Propose", body: "Open a Context PR — a reviewable change request." },
  { n: 3, title: "Review", body: "See the semantic diff, who/what it affects, and automated checks." },
  { n: 4, title: "Approve", body: "Required reviewers sign off; the change merges." },
  { n: 5, title: "Publish", body: "Signed, per-agent context is published for agents to pull." },
];

export function WelcomeGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.06]" aria-hidden />
      <button
        onClick={dismiss}
        aria-label="Dismiss guide"
        className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs text-muted transition hover:bg-hover hover:text-ink"
      >
        Got it ✕
      </button>

      <h2 className="text-base font-semibold">Welcome to bravo</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        bravo is where you author and approve the context that feeds your AI agents — with full
        version history underneath, but no Git knowledge required. Every change flows through
        these steps:
      </p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-5">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-xl border border-line bg-surface2 p-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
              {s.n}
            </div>
            <div className="mt-2 text-sm font-medium">{s.title}</div>
            <div className="mt-0.5 text-xs text-muted">{s.body}</div>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-muted">
        Agents can also propose changes themselves (via the API) — but only a human can approve
        them. Hover the <span className="font-semibold">ⓘ</span> icons anywhere to learn what each
        part does.
      </p>
    </section>
  );
}
