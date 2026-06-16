# Context Studio — Architecture

A **Context Management IDE**: a tool for non-technical *Context Owners* (business
analysts, compliance officers) to author and authorize the definitive knowledge
state that feeds autonomous AI agents. It presents a calm, wiki-like UI while
maintaining strict, code-level version control underneath.

## The thesis: an abstraction boundary

```
   ┌──────────────────────────────────────────────────────────┐
   │  apps/web  (Next.js)   — speaks the DOMAIN language only   │
   │  "open a change request", "approve", "this looks stale"    │
   └───────────────────────────┬──────────────────────────────┘
                               │  HTTP, domain verbs (no Git words)
   ┌───────────────────────────▼──────────────────────────────┐
   │  apps/server (Express)                                     │
   │   GitService            — the ONLY code that touches Git   │
   │   SemanticDiffService   — text → logical blocks            │
   │   Prisma/SQLite         — metadata Git can't model         │
   └───────────────────────────┬──────────────────────────────┘
                               │  simple-git
   ┌───────────────────────────▼──────────────────────────────┐
   │  .context-repo/  — a real Git repo on disk (source of      │
   │                    truth for context *content*)            │
   └──────────────────────────────────────────────────────────┘
```

The product only works if the UI never leaks Git. Branches, commits and
squash-merges are an implementation detail of `GitService`. Everything above it
talks about *Context PRs*, *blocks*, *freshness*, and *agents*.

## Source-of-truth split

- **Git** owns context *content* and its history (the authoritative text).
- **SQLite/Prisma** owns *metadata* Git models poorly: PR lifecycle state,
  reviewer routing, the attribution index, the freshness/TTL state machine, and
  the agent → context "blast radius" mappings.

## The four modules

### 1. Abstracted Version Control Backend — `apps/server/src/services/GitService.ts`
Translates UI verbs into raw Git:
- editing a document → `git checkout -b draft/<pr>` transparently (autosave branch);
- approving a draft → **squash-merge** all autosaves into one semantic commit on
  `main`, then delete the draft branch.

### 2. Context Pull Request (CPR) UI — `apps/web/app/pr/[id]`
- **Semantic Diff** viewer: block-level add/modify/remove, wiki-style, no red/green soup.
- **Blast Radius** warning: which agents are affected, severity-ranked, gates the merge.
- **Approval routing**: required reviewers, decisions, merge button.
- `POST /api/context/pr/agent-submit`: lets autonomous agents open CPRs when they
  discover workarounds or edge cases.

### 3. Dual-Mode Editor & Attribution Gutter — `apps/web/app/edit/[...path]`
- Markdown editor with a **write / preview** toggle for drafting policies.
- Editing is transparent: autosave opens/updates a hidden `draft` Context PR via
  `DocService` + `GitService`; "Propose change" promotes it to `in_review`.
- **Attribution Gutter**: hover a block → who wrote it (human/agent), when, and
  the CPR that merged it. A non-technical `git blame`.
- Export to machine-readable `llms.txt` and a `.fcontext` manifest
  (`ExportService`), pairing each block with its attribution and freshness.

### 4. Freshness & Governance State Machine — `apps/server/src/services/FreshnessService.ts`
- Every block tracks `fresh | stale | expired | conflicted` in `BlockFreshness`.
- A background **TTL worker** (`worker.ts`) flags blocks past their configurable
  review window and auto-opens a review ticket routed to the Context Owner.
- Blocks touched by two or more open CPRs are marked `conflicted`.
- Surfaced at `apps/web/app/governance`.

## Tech stack

| Layer    | Choice                                            |
|----------|---------------------------------------------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind |
| Backend  | Node.js + Express + TypeScript                    |
| Git      | `simple-git` (wraps the real `git` binary)        |
| Database | SQLite + Prisma                                   |
| Shared   | `packages/types` — domain types for both apps     |

## Build & run

```bash
pnpm install
pnpm --filter @context-studio/server prisma:generate
pnpm seed          # initializes .context-repo/ as a real Git repo + sample CPR
pnpm dev           # server on :4000, web on :3000
```

Then:
- `/` — change-request dashboard
- `/pr/pr-001` — CPR review screen (Semantic Diff, Blast Radius, approval)
- `/edit/policies/refunds.md` — dual-mode editor + attribution gutter + export
- `/governance` — freshness state machine + auto-opened review tickets

## Current status

All four modules are implemented end-to-end against a seeded sample backed by a
real on-disk Git repo: the abstracted version-control backend (1), the CPR review
screen (2), the dual-mode editor with attribution + export (3), and the freshness
governance state machine with its TTL worker (4).
