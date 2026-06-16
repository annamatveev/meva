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

### 5. Workspace binding — `apps/server/src/services/WorkspaceManager.ts`
- meva does not own the context. It binds to an **external store** via a saved
  `Workspace` (location + identity); it holds at most a disposable working copy.
- Two source types: **local** (operate on a directory path in place) or
  **remote** (clone a git remote into a scratch workdir, push approved `main`
  back on merge).
- The document layout + agent mapping are discovered from a versioned
  `.contextstudio.yml` at the repo root (built-in fallback when absent).
- First-run setup wizard at `apps/web/app/setup`; all domain routes resolve Git
  per-request from the active workspace and return 409 until one is configured.

### 6. Distribution — `apps/server/src/services/DistributionService.ts`
- On merge (or on demand) renders a **per-agent slice** (llms.txt + .fcontext)
  containing only the documents each agent is authorized for (least privilege,
  from `.contextstudio.yml` `reads`, else keyword-matched).
- Writes a **content-addressed, ed25519-signed** bundle to a distribution
  channel, swapped in atomically (`SigningService`, `DIST_DIR`).
- `clients/agent-sync.mjs` is the consumer: pull → verify signature against a
  *pinned* public key → verify every file digest → atomic swap. Verification
  failure leaves the agent's last-good context untouched. (Tamper-tested.)
- Surfaced at `apps/web/app/distribution`.

### 7. Auth & permissions — `apps/server/src/services/AuthService.ts`
- **Human sessions**: a signed (HMAC) bearer token issued at login (pick-user
  stands in for SSO; no passwords). The acting reviewer is derived from the
  token — you can only act as yourself, and only if you're a reviewer on the PR.
- **Agent API keys**: random key shown once, stored only as sha256; required on
  `agent-submit`, so agents can't be impersonated.
- Reads stay open (LAN-trusted); writes/merges are gated. Login at
  `apps/web/app/login`; session in client `lib/auth.ts`.

### 8. Evals-as-publish-gate — `apps/server/src/services/EvalService.ts`
- Context-regression evals (versioned in `.contextstudio.yml` `evals`): each
  case asserts an agent's *resulting* context still contains the facts it needs
  (`expectContains`) and none it must not (`expectNotContains`).
- Evaluated against the PR's proposed state (changed doc from the draft branch).
  **Failing evals block approval** (409 `EVALS_FAILED`); `request_changes` /
  `reject` stay allowed.
- Deterministic by design — the seam where real LLM-behavior evals plug in.
  Surfaced on the CPR screen (`EvalsPanel`); `GET /api/context/pr/:id/evals`.

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
