# Context Studio

A **Context Management IDE** — a tool for non-technical *Context Owners* (business
analysts, compliance officers) to author and authorize the definitive knowledge
state that feeds autonomous AI agents. Beautiful, wiki-like UI on top; strict,
code-level Git version control underneath, fully hidden from the user.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and the four-module plan.

## What's built

All four modules are implemented end-to-end against a real on-disk Git repo:

**Module 1 — Abstracted version control.** `GitService` is the only code that
touches Git: editing transparently creates a draft branch; approving squash-merges
every autosave into one semantic commit on `main` and deletes the branch.

**Module 2 — Context PR review screen** (`/pr/pr-001`):
- **Semantic Diff** — block-level add/edit/remove rendered like a collaborative
  wiki (no red/green line gutters), with word-level emphasis inside edits.
- **Attribution Gutter** — hover any line to see who wrote it (human or agent),
  when, and which change request introduced it.
- **Blast Radius** — which autonomous agents are affected, severity-ranked; the
  highest severity gates the merge button.
- **Approval routing** — required reviewers, decisions, squash-merge on approval.
- **Agent API** — `POST /api/context/pr/agent-submit` lets agents open CPRs.

**Module 3 — Dual-mode editor** (`/edit/policies/refunds.md`):
- Markdown **write / preview** editor; edits autosave to a hidden draft PR and
  "Propose change" opens a CPR.
- Live **attribution gutter** in preview.
- Export to **`llms.txt`** and a **`.fcontext`** manifest for AI consumption.

**Module 4 — Freshness & governance** (`/governance`):
- Every block tracks `fresh | stale | expired | conflicted`.
- A background **TTL worker** flags blocks past their review window and
  auto-opens a review ticket routed to the Context Owner.
- A change-request **dashboard** at `/` lists all CPRs with a governance snapshot.

**Module 5 — Workspace binding** (`/setup`):
- meva binds to an **external** context store (local path or git remote) and
  keeps only a disposable working copy — it never owns the files. Layout + agent
  mapping come from a versioned `.contextstudio.yml`.

**Module 6 — Distribution** (`/distribution`):
- On merge, renders per-agent slices (least privilege), signs a content-addressed
  bundle (ed25519), and publishes it to a channel. `clients/agent-sync.mjs` pulls,
  verifies signature + digests against a pinned key, and atomically swaps.

**Module 7 — Auth & permissions** (`/login`):
- Token sessions for human reviewers (no passwords) + hashed agent API keys.
  The acting reviewer comes from the session; agents can't be impersonated.

**Module 8 — Evals-as-publish-gate** (on the CPR screen):
- Context-regression evals in `.contextstudio.yml`; failing evals block approval.

## Prerequisites

- Node ≥ 20, `pnpm`, and a `git` binary on PATH (the backend shells out to real Git).

## Setup & run

```bash
pnpm bootstrap   # install + generate Prisma client + apply migrations + seed
pnpm dev         # server :4000, web :3000
```

> Note: the one-shot command is `pnpm bootstrap`, **not** `pnpm setup` —
> `setup` is a reserved pnpm built-in (it configures `PNPM_HOME`).

Then open **http://localhost:3000** (dashboard) or **/pr/pr-001** (review screen).

<details><summary>…or run the steps individually</summary>

```bash
pnpm install
pnpm --filter @context-studio/server prisma:generate
pnpm --filter @context-studio/server exec prisma migrate deploy
pnpm seed
pnpm dev
```
</details>

## Test

```bash
pnpm --filter @context-studio/server test   # semantic-diff engine unit tests
```

## Layout

```
apps/web      Next.js 14 (App Router) — the UI, speaks domain language only
apps/server   Express + simple-git + Prisma — the abstracted version-control backend
packages/types  Shared domain types for both apps
```
