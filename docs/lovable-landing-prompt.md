# Lovable prompt — correct the meva landing description

Paste the prompt below into the Lovable project for the meva landing page. It
keeps the current visual design and voice, and rewrites the copy so it matches
what the product actually does (and marks what's roadmap vs shipped).

---

Keep the existing visual design exactly as-is — the warm cream background, deep
forest-green panels, gold/ochre accent, bold grotesk headings, monospace
`§ NN — SECTION` eyebrows, pill tags, and the "Run it in thirty seconds. Own it
forever." colophon. Only change the **copy/description**, not the layout or palette.

Update the wording so it accurately describes the product:

**What meva is (use near the top):**
"meva is a Context Management IDE. Non-technical Context Owners — analysts,
compliance, support leads — author and approve the knowledge that feeds your AI
agents, with full version history underneath but no Git to learn."

**The core flow (one line each, as a numbered or § list):**
1. Edit a policy in a plain editor; edits autosave privately.
2. Propose a Context PR — a reviewable change request (people *or* agents can open one; only humans approve).
3. Review: a wiki-style semantic diff, a "blast radius" of which agents are affected, and automated evals that block regressions.
4. Approve: required reviewers sign off; the change squash-merges into the authoritative state.
5. Publish: a signed, per-agent context bundle is published; agents pull it, verify the signature, and swap it in.

**Rewrite the "§ 07 — Connections" section** so it reflects reality. Split the
pills into "Available now" and "On the roadmap":
- Available now: **CSV export**, **Webhooks**, **Slack** (incoming webhook),
  and **agent SDKs** — agents in LangChain, LlamaIndex, Mastra, the Vercel AI
  SDK, OpenAI, or Anthropic consume meva's published context via a signed bundle
  + a small loader (no rewrite).
- On the roadmap: **Google SSO**, **Okta**, **Email digests**.
Keep the headline "Drops into the stack your team already runs."

**Keep the §08 colophon** ("One container. Your data. Your reviewers. Apache-2.0,
no SaaS, no telemetry. The ledger is yours to keep.") and the
`docker pull ghcr.io/meva/studio` / "GET MEVA →" CTA — these match the product
(it's a single self-hosted container with all state local).

Do not invent features that don't exist; if unsure, prefer the roadmap column.
