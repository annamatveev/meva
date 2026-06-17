"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SourceChip } from "@/components/ui/SourceChip";

const FLOW = [
  ["Edit", "Open a document; edits autosave to a private draft."],
  ["Propose", "Turn the draft into a reviewable change request."],
  ["Review", "Semantic diff, who/what it affects, automated checks."],
  ["Approve", "Required reviewers sign off; it merges."],
  ["Publish", "A signed, per-agent bundle is published for agents to pull."],
];

const PAGES: Array<[string, string, string]> = [
  ["Home · Health", "/", "What your agent reads, ignores, and couldn’t find."],
  ["Change Requests", "/changes", "Review and approve proposed edits."],
  ["Governance", "/governance", "Freshness/TTL and auto-opened review tickets."],
  ["Distribution", "/distribution", "Signed, per-agent bundles your agents pull."],
  ["Library", "/edit/policies/refunds.md", "Every file with its layers — who wrote it, usage, open requests. Draft a change and propose it."],
  ["Workspace", "/setup", "Connect your typed sources (context / skills / memory)."],
];

export default function Welcome() {
  const router = useRouter();
  const start = () => {
    try {
      localStorage.setItem("bravo.onboarded", "1");
    } catch {
      /* ignore */
    }
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-3">
        <SectionLabel n={0}>Welcome</SectionLabel>
        <h1 className="text-4xl font-semibold tracking-tight">
          bravo is a <span className="text-brand">Brain Vault</span> for your agents.
        </h1>
        <p className="max-w-prose text-base text-muted">
          It governs all the Markdown your AI agents read and constantly change — not just
          context, but skills, memory, anything. Non-technical owners author and approve it with
          full version history underneath, and <strong>no Git to learn</strong>.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SourceChip kind="context" />
          <SourceChip kind="skills" />
          <SourceChip kind="memory" />
          <SourceChip kind="+ your own" />
        </div>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <SectionLabel n={1}>Why it matters</SectionLabel>
        <p className="mt-2 text-lg font-medium">You can finally see your agent’s knowledge health.</p>
        <p className="mt-1 max-w-prose text-sm text-muted">
          A small MCP sits between the agent and your repos, so every read — and every <em>miss</em>
          — is recorded. The dashboard shows what the agent leans on, what it never touches, and
          what it looked for but couldn’t find. That last one tells you exactly what to write next.
        </p>
      </section>

      <section className="space-y-3">
        <SectionLabel n={2}>The flow</SectionLabel>
        <ol className="grid gap-2 sm:grid-cols-5">
          {FLOW.map(([title, body], i) => (
            <li key={title} className="rounded-xl border border-line bg-surface p-3 shadow-card">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {i + 1}
              </div>
              <div className="mt-2 text-sm font-medium">{title}</div>
              <div className="mt-0.5 text-xs text-muted">{body}</div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted">
          Agents can also propose changes themselves (via the API) — but only a human approves.
        </p>
      </section>

      <section className="space-y-3">
        <SectionLabel n={3}>Where to find things</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAGES.map(([title, href, body]) => (
            <Link
              key={href}
              href={href}
              className="group rounded-xl border border-line bg-surface p-4 shadow-card transition hover:border-brand/40 hover:bg-hover"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{title}</span>
                <span className="text-brand transition group-hover:translate-x-0.5">→</span>
              </div>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 border-t border-line pt-6">
        <button
          onClick={start}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          Go to the dashboard →
        </button>
        <span className="text-xs text-muted">You can reopen this from “How bravo works” anytime.</span>
      </div>
    </div>
  );
}
