/**
 * Context Studio — shared domain types.
 *
 * This package is the single source of truth for the domain language spoken by
 * BOTH the UI (apps/web) and the abstracted version-control backend (apps/server).
 *
 * Design rule: these types describe the *domain* (Context Owners, Context PRs,
 * blocks, agents). They deliberately contain NO Git vocabulary — branches,
 * commits and squash-merges live entirely behind the server's GitService. The
 * UI must never learn that Git exists.
 */

// ---------------------------------------------------------------------------
// Actors
// ---------------------------------------------------------------------------

/** Who authored a piece of context — a person, or an autonomous AI agent. */
export type AuthorKind = "human" | "agent";

export interface Author {
  id: string;
  kind: AuthorKind;
  /** Display name, e.g. "Dana Levi" or "Reconciliation Agent v3". */
  name: string;
  /** Optional avatar / role hint for the UI. */
  role?: string;
}

// ---------------------------------------------------------------------------
// Freshness & governance state machine (Module 4)
// ---------------------------------------------------------------------------

/**
 * Lifecycle state of a single context block.
 *
 *  fresh      — within its TTL, trusted.
 *  stale      — past its TTL; a review ticket has been opened automatically.
 *  expired    — long past TTL; should not be served to agents until reviewed.
 *  conflicted — two unmerged CPRs touch the same block, or a merge raced.
 */
export type FreshnessState = "fresh" | "stale" | "expired" | "conflicted";

export interface FreshnessInfo {
  state: FreshnessState;
  /** ISO timestamp of the last authoritative change to this block. */
  lastReviewedAt: string;
  /** Configurable Time-To-Live in days before the block is flagged stale. */
  ttlDays: number;
  /** ISO timestamp at which this block tips into `stale`. */
  staleAt: string;
}

// ---------------------------------------------------------------------------
// Semantic diff (Module 2 — the CPR review screen)
// ---------------------------------------------------------------------------

/**
 * How a logical block changed in a proposed Context PR.
 * Intentionally NOT line-based — we diff whole logical blocks (paragraphs,
 * list items, headings) so the UI reads like a collaborative wiki, not `git diff`.
 */
export type BlockChangeKind = "added" | "removed" | "modified" | "unchanged";

/** A word-level segment used to render emphasis inside a `modified` block. */
export interface InlineSegment {
  text: string;
  /** "added" / "removed" emphasis within an otherwise-modified block. */
  emphasis?: "added" | "removed";
}

export interface SemanticDiffBlock {
  /** Stable id for the logical block (hash of its anchor heading + ordinal). */
  id: string;
  kind: BlockChangeKind;
  /** Markdown block type, used purely for rendering affordances. */
  blockType: "heading" | "paragraph" | "listItem" | "code" | "quote";
  /** Heading depth when blockType === "heading". */
  depth?: number;
  /** Previous text (present for "removed" and "modified"). */
  before?: string;
  /** New text (present for "added" and "modified"). */
  after?: string;
  /** Word-level segmentation of `after`, present only for "modified" blocks. */
  segments?: InlineSegment[];
  /** Attribution for the resulting text, surfaced in the Attribution Gutter. */
  attribution?: Attribution;
}

export interface SemanticDiff {
  /** The document this diff applies to (path under the context root). */
  documentPath: string;
  blocks: SemanticDiffBlock[];
  summary: {
    added: number;
    removed: number;
    modified: number;
  };
}

// ---------------------------------------------------------------------------
// Attribution gutter (Module 3 — non-technical `git blame`)
// ---------------------------------------------------------------------------

export interface Attribution {
  author: Author;
  /** ISO timestamp the text was merged into the authoritative state. */
  mergedAt: string;
  /** The Context PR that introduced this text. */
  prId: string;
  prTitle: string;
}

// ---------------------------------------------------------------------------
// Blast radius (Module 2 — which agents are affected by a change)
// ---------------------------------------------------------------------------

export type BlastSeverity = "low" | "medium" | "high";

export interface AffectedAgent {
  id: string;
  name: string;
  /** What the agent does, shown in the warning card. */
  purpose: string;
  /** How strongly this change touches the agent's relied-upon context. */
  severity: BlastSeverity;
  /** Human-readable reason, e.g. "Reads §Refund Windows which is modified." */
  reason: string;
}

export interface BlastRadius {
  agents: AffectedAgent[];
  /** Highest severity across all affected agents — drives the merge gate. */
  maxSeverity: BlastSeverity;
}

// ---------------------------------------------------------------------------
// Context Pull Request (Module 2)
// ---------------------------------------------------------------------------

export type PrStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "merged"
  | "rejected";

export type ReviewDecision = "pending" | "approved" | "changes_requested";

export interface Reviewer {
  author: Author;
  decision: ReviewDecision;
  /** Whether this reviewer's approval is required to merge. */
  required: boolean;
  decidedAt?: string;
}

/** Origin of the PR — opened by a person in the UI, or by an agent via API. */
export type PrOrigin = "ui" | "agent";

export interface ContextPR {
  id: string;
  title: string;
  /** Free-text rationale ("why this change"). */
  description: string;
  status: PrStatus;
  origin: PrOrigin;
  author: Author;
  documentPath: string;
  createdAt: string;
  updatedAt: string;
  reviewers: Reviewer[];
  diff: SemanticDiff;
  blastRadius: BlastRadius;
}

// ---------------------------------------------------------------------------
// API request/response contracts
// ---------------------------------------------------------------------------

/** Body for POST /api/context/pr/agent-submit (Module 2). */
export interface AgentSubmitRequestBody {
  agentId: string;
  agentName: string;
  documentPath: string;
  title: string;
  description: string;
  /** The full proposed new Markdown content for the document. */
  proposedContent: string;
}

export interface AgentSubmitResponse {
  prId: string;
  status: PrStatus;
}

/** Compact PR record for the change-request dashboard list. */
export interface ContextPrSummary {
  id: string;
  title: string;
  status: PrStatus;
  origin: PrOrigin;
  author: Author;
  documentPath: string;
  updatedAt: string;
  blastMaxSeverity: BlastSeverity;
  affectedAgents: number;
}

// ---------------------------------------------------------------------------
// Freshness & governance (Module 4)
// ---------------------------------------------------------------------------

/** Per-block freshness record tracked by the governance state machine. */
export interface BlockFreshness {
  documentPath: string;
  blockKey: string;
  /** Short preview of the block text, for governance lists. */
  text: string;
  state: FreshnessState;
  lastReviewedAt: string;
  ttlDays: number;
  staleAt: string;
}

export interface FreshnessOverview {
  counts: Record<FreshnessState, number>;
  /** Blocks needing attention (stale / expired / conflicted), worst first. */
  attention: BlockFreshness[];
  total: number;
}

export type TicketState = "open" | "resolved";

/** A review ticket auto-opened when a block goes stale (or conflicted). */
export interface ReviewTicket {
  id: string;
  documentPath: string;
  blockKey: string;
  blockText: string;
  reason: string;
  state: TicketState;
  createdAt: string;
  /** The Context Owner the ticket is routed to, if assigned. */
  assignee?: Author;
}

// ---------------------------------------------------------------------------
// Auth (Module 7 — identity & permissions)
// ---------------------------------------------------------------------------

/** Permission role assigned to a human (distinct from the display `role` title). */
export type AccessRole = "owner" | "reviewer" | "viewer";

export type Permission =
  | "propose"
  | "approve"
  | "publish"
  | "configureWorkspace"
  | "manageRoles";

const ROLE_PERMISSIONS: Record<AccessRole, Permission[]> = {
  owner: ["propose", "approve", "publish", "configureWorkspace", "manageRoles"],
  reviewer: ["propose", "approve"],
  viewer: [],
};

/** Single source of truth for who can do what — shared by server + UI. */
export function can(role: AccessRole | undefined, permission: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].includes(permission);
}

/** The authenticated human acting in the UI. */
export interface SessionUser {
  id: string;
  name: string;
  /** Display title (e.g. "Compliance Officer"). */
  role?: string;
  /** Permission role. */
  accessRole: AccessRole;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

/** Whether Google SSO is configured on the server (drives the login screen). */
export interface AuthConfig {
  googleEnabled: boolean;
  /** Local pick-user login available (dev / no-SSO fallback). */
  pickUserEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Workspace (Module 5 — binding to an external context store)
// ---------------------------------------------------------------------------

export type WorkspaceSourceType = "local" | "remote";

/**
 * The kind of Markdown a source holds. Built-ins are context / skills / memory,
 * but it's open — any custom type is allowed. Drives colour-coding in the UI.
 */
export type SourceKind = "context" | "skills" | "memory" | (string & {});

export const BUILTIN_SOURCE_KINDS: SourceKind[] = ["context", "skills", "memory"];

/** One typed source in a workspace — its own repo, or a shared/unified one. */
export interface WorkspaceSource {
  id: string;
  kind: SourceKind;
  sourceType: WorkspaceSourceType;
  /** Local path or git remote. Sources may share a location (unified repo). */
  location: string;
}

/** A registered agent + its context subscription (from .contextstudio.yml). */
export interface RegisteredAgent {
  id: string;
  name: string;
  purpose: string;
  /** Lowercase keywords; a changed block matching any → this agent is affected. */
  watches: string[];
  baseSeverity: BlastSeverity;
  /**
   * Documents this agent is authorized to receive (least privilege). When
   * omitted, distribution falls back to documents whose content matches the
   * agent's `watches` keywords.
   */
  reads?: string[];
}

// ---------------------------------------------------------------------------
// Evals (Module 8 — regression gate on context changes)
// ---------------------------------------------------------------------------

/**
 * A context-regression test for an agent. Asserts the agent's resulting context
 * still supports an answer: it must contain every `expectContains` phrase and
 * none of `expectNotContains`. (Deterministic; the seam where real LLM-behavior
 * evals would plug in.)
 */
export interface EvalCase {
  id: string;
  agentId: string;
  question?: string;
  expectContains?: string[];
  expectNotContains?: string[];
}

export interface EvalResult {
  id: string;
  agentId: string;
  question?: string;
  passed: boolean;
  /** expectContains phrases that were missing from the proposed context. */
  missing: string[];
  /** expectNotContains phrases that were present (should not be). */
  forbidden: string[];
}

export interface EvalReport {
  passed: boolean;
  results: EvalResult[];
}

// ---------------------------------------------------------------------------
// Distribution (Module 6 — publishing signed per-agent slices)
// ---------------------------------------------------------------------------

export interface DistributionAgentSlice {
  agentId: string;
  agentName: string;
  documents: string[];
  files: number;
  bytes: number;
}

export interface DistributionStatus {
  published: boolean;
  /** Content-hash version of the current published bundle. */
  version?: string;
  generatedAt?: string;
  /** ed25519 public key (PEM) agents pin to verify the bundle signature. */
  publicKeyPem?: string;
  agents: DistributionAgentSlice[];
}

/** The active workspace, as surfaced to the UI. */
export interface WorkspaceInfo {
  configured: boolean;
  identityName?: string;
  identityEmail?: string;
  /** Typed sources (context / skills / memory / custom), each a repo. */
  sources: WorkspaceSource[];
  /** Discovered document paths across the bound stores. */
  documents: string[];
  /** Discovered agents (from .bravo.yml, else built-in fallback). */
  agents: Array<{ id: string; name: string }>;
}

export interface ConfigureWorkspaceBody {
  identityName: string;
  identityEmail: string;
  /** At least one source. The first (or a `context` one) backs current editing. */
  sources: Array<{ kind: SourceKind; sourceType: WorkspaceSourceType; location: string }>;
}

// ---------------------------------------------------------------------------
// Editing (Module 3)
// ---------------------------------------------------------------------------

/** Live document view for the dual-mode editor (content + per-block attribution). */
export interface DocumentView {
  documentPath: string;
  /** Current authoritative (main) content. */
  content: string;
  /** Attribution per logical block, aligned to the rendered blocks. */
  attributions: Array<{ blockKey: string; attribution?: Attribution }>;
  /** Draft PR currently open for this document by the acting user, if any. */
  draftPrId?: string;
}

export interface AutosaveRequestBody {
  documentPath: string;
  content: string;
  authorId: string;
}

export interface AutosaveResponse {
  draftPrId: string;
  savedAt: string;
}

export interface ProposeRequestBody {
  draftPrId: string;
  title: string;
  description: string;
}

export type ApprovalAction = "approve" | "request_changes" | "reject";

export interface ApprovalRequestBody {
  reviewerId: string;
  action: ApprovalAction;
  comment?: string;
  /** Reviewer must acknowledge a high-severity blast radius to merge. */
  blastRadiusAcknowledged?: boolean;
}

export interface ApprovalResponse {
  pr: ContextPR;
  /** Set when the approval triggered a squash-merge. */
  merged: boolean;
}
