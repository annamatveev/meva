# bravo API reference

Base URL: `http://localhost:4000` (the `apps/server` backend). All routes are
under `/api/context`. Requests/responses are JSON unless noted.

## Auth model

- **Human session** — a Bearer token from login/SSO:
  `Authorization: Bearer <session-token>`. The acting user (and their role) is
  derived from the token; you can't act as someone else.
- **Agent API key** — for `agent-submit` only:
  `Authorization: Bearer <agent-api-key>`.
- **Roles**: `owner` (everything), `reviewer` (propose + approve), `viewer`
  (read-only). Reads are open; writes/merges are gated by role.

## Error shape

Non-2xx responses are `{ "error": string, "code"?: string }`. Codes:

| Code | HTTP | Meaning |
|------|------|---------|
| `NO_WORKSPACE` | 409 | No workspace configured yet. |
| `AUTH_REQUIRED` | 401 | Sign-in required for this action. |
| `FORBIDDEN` | 403 | Your role can't perform this action. |
| `AGENT_KEY_REQUIRED` | 401 | Valid agent API key required. |
| `BLAST_ACK_REQUIRED` | 409 | High blast-radius change needs acknowledgement to merge. |
| `EVALS_FAILED` | 409 | Context-regression evals fail; can't approve. |

---

## Health

### `GET /health`
→ `200 { "ok": true }`

---

## Auth — `/api/context/auth`

### `GET /auth/config`
Which login methods are available. → `AuthConfig`
```json
{ "googleEnabled": false, "pickUserEnabled": true }
```

### `GET /auth/users`
Selectable identities for the pick-user login (dev fallback). `403` if disabled.
→ `SessionUser[]`

### `POST /auth/login`
Dev/local login (no passwords). `403` if disabled.
Body: `{ "authorId": string }` → `LoginResponse { token, user }`

### `GET /auth/me`  · _Bearer_
Resolve the current session. → `{ "user": SessionUser }` | `401`

### `GET /auth/google/login`
Redirects (`302`) to Google consent. `404` if SSO not configured.

### `GET /auth/google/callback?code&state`
OAuth callback. Redirects (`302`) to `WEB_BASE_URL/auth/callback#token=<token>`.

---

## Workspace — `/api/context/workspace`

### `GET /workspace`
Current binding. → `WorkspaceInfo` (`{ configured: false, ... }` if unbound).

### `POST /workspace`  · _Bearer · owner_
Bind to an external context store.
Body: `ConfigureWorkspaceBody` →
```json
{ "sourceType": "local" | "remote", "location": "string",
  "identityName": "string", "identityEmail": "string" }
```
→ `WorkspaceInfo` | `401` `403` | `422` (couldn't bind).

---

## Context PRs — `/api/context/pr`

### `GET /pr`
List all change requests. → `ContextPrSummary[]`

### `GET /pr/:id`
Full change request for the review screen. → `ContextPR` | `404`

### `GET /pr/:id/evals`
Run the context-regression evals for the proposed change. → `EvalReport`

### `POST /pr/:id/approve`  · _Bearer · reviewer (on this PR)_
Record a decision; the last required approval squash-merges + publishes.
Body: `ApprovalRequestBody` →
```json
{ "action": "approve" | "request_changes" | "reject",
  "comment"?: "string", "blastRadiusAcknowledged"?: boolean }
```
→ `{ "pr": ContextPR, "merged": boolean }`
| `401` | `403` (not a reviewer / wrong role) | `404`
| `409 BLAST_ACK_REQUIRED` | `409 EVALS_FAILED`

### `POST /pr/agent-submit`  · _Bearer = agent API key_
Lets an autonomous agent open a change request. Identity comes from the key.
Body: `AgentSubmitRequestBody` →
```json
{ "documentPath": "string", "title": "string",
  "description": "string", "proposedContent": "string" }
```
→ `201 { "prId": "string", "status": "in_review" }`
| `401 AGENT_KEY_REQUIRED` | `403`

---

## Governance — `/api/context/governance`

### `GET /governance/freshness`
Block freshness overview. → `FreshnessOverview`

### `GET /governance/tickets`
Open review tickets. → `ReviewTicket[]`

---

## Editing — `/api/context/doc`

### `GET /doc/view?path=<docPath>&as=<authorId>`
Document content + per-block attribution + the user's open draft (if any).
→ `DocumentView` | `404`

### `POST /doc/autosave`  · _Bearer · reviewer+_
Transparent autosave to a hidden draft branch. (Author is the session user.)
Body: `{ "documentPath": "string", "content": "string", "authorId": "string" }`
→ `AutosaveResponse { draftPrId, savedAt }`

### `POST /doc/propose`  · _Bearer · reviewer+_
Promote a draft into an in-review Context PR.
Body: `{ "draftPrId": "string", "title": "string", "description": "string" }`
→ `{ "prId": "string" }`

---

## Export — `/api/context/export`

### `GET /export/llms.txt` → `text/plain`
Concatenated agent-friendly context from the authoritative state.

### `GET /export/fcontext` → JSON (`FcontextManifest`)
Per-block manifest with attribution + freshness.

### `GET /export/ledger.csv` → `text/csv`
The change-request ledger (id, title, status, origin, author, document,
blastSeverity, affectedAgents, updatedAt).

---

## Distribution — `/api/context/distribution`

### `GET /distribution`
Current published bundle status. → `DistributionStatus`

### `POST /distribution/publish`  · _Bearer · owner_
Re-render + sign + publish per-agent slices. → `DistributionStatus`

---

## Types

```ts
type AuthorKind = "human" | "agent";
interface Author { id: string; kind: AuthorKind; name: string; role?: string; }

type AccessRole = "owner" | "reviewer" | "viewer";
interface SessionUser { id: string; name: string; role?: string; accessRole: AccessRole; }
interface AuthConfig { googleEnabled: boolean; pickUserEnabled: boolean; }
interface LoginResponse { token: string; user: SessionUser; }

type PrStatus = "draft" | "in_review" | "changes_requested" | "approved" | "merged" | "rejected";
type PrOrigin = "ui" | "agent";
type BlastSeverity = "low" | "medium" | "high";
type ReviewDecision = "pending" | "approved" | "changes_requested";
type FreshnessState = "fresh" | "stale" | "expired" | "conflicted";

type BlockChangeKind = "added" | "removed" | "modified" | "unchanged";
interface InlineSegment { text: string; emphasis?: "added" | "removed"; }
interface Attribution { author: Author; mergedAt: string; prId: string; prTitle: string; }

interface SemanticDiffBlock {
  id: string; kind: BlockChangeKind;
  blockType: "heading" | "paragraph" | "listItem" | "code" | "quote";
  depth?: number; before?: string; after?: string;
  segments?: InlineSegment[]; attribution?: Attribution;
}
interface SemanticDiff {
  documentPath: string; blocks: SemanticDiffBlock[];
  summary: { added: number; removed: number; modified: number };
}

interface AffectedAgent { id: string; name: string; purpose: string; severity: BlastSeverity; reason: string; }
interface BlastRadius { agents: AffectedAgent[]; maxSeverity: BlastSeverity; }

interface Reviewer { author: Author; decision: ReviewDecision; required: boolean; decidedAt?: string; }
interface ContextPR {
  id: string; title: string; description: string; status: PrStatus; origin: PrOrigin;
  author: Author; documentPath: string; createdAt: string; updatedAt: string;
  reviewers: Reviewer[]; diff: SemanticDiff; blastRadius: BlastRadius;
}
interface ContextPrSummary {
  id: string; title: string; status: PrStatus; origin: PrOrigin; author: Author;
  documentPath: string; updatedAt: string; blastMaxSeverity: BlastSeverity; affectedAgents: number;
}

interface BlockFreshness {
  documentPath: string; blockKey: string; text: string;
  state: FreshnessState; lastReviewedAt: string; ttlDays: number; staleAt: string;
}
interface FreshnessOverview { counts: Record<FreshnessState, number>; attention: BlockFreshness[]; total: number; }
interface ReviewTicket {
  id: string; documentPath: string; blockKey: string; blockText: string;
  reason: string; state: "open" | "resolved"; createdAt: string; assignee?: Author;
}

interface DocumentView {
  documentPath: string; content: string;
  attributions: Array<{ blockKey: string; attribution?: Attribution }>;
  draftPrId?: string;
}
interface AutosaveResponse { draftPrId: string; savedAt: string; }

interface EvalResult { id: string; agentId: string; question?: string; passed: boolean; missing: string[]; forbidden: string[]; }
interface EvalReport { passed: boolean; results: EvalResult[]; }

interface DistributionAgentSlice { agentId: string; agentName: string; documents: string[]; files: number; bytes: number; }
interface DistributionStatus { published: boolean; version?: string; generatedAt?: string; publicKeyPem?: string; agents: DistributionAgentSlice[]; }

interface WorkspaceInfo {
  configured: boolean; sourceType?: "local" | "remote"; location?: string;
  identityName?: string; identityEmail?: string;
  documents: string[]; agents: Array<{ id: string; name: string }>;
}
```
