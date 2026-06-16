/**
 * Demo mode (Module 11).
 *
 * When NEXT_PUBLIC_DEMO=1 the web app serves canned sample data and simulates
 * writes instead of calling the backend — so it runs with no server, no git,
 * no database. Safe to host statically / publicly: nothing persists, every
 * reload resets. The api client short-circuits to these functions.
 */

import type {
  AuthConfig,
  Confidence,
  ContextPR,
  ContextPrSummary,
  DistributionStatus,
  DocumentView,
  EvalReport,
  HealthOverview,
  FreshnessOverview,
  LoginResponse,
  ReviewTicket,
  SessionUser,
  SourceKind,
  WorkspaceInfo,
} from "@context-studio/types";

import { blockKey, parseBlocks } from "./blocks";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

const now = "2026-06-16T10:00:00.000Z";
const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

const OWNER: SessionUser = { id: "user-dana", name: "Dana Levi", role: "Compliance Officer", accessRole: "owner" };
const REVIEWER: SessionUser = { id: "user-amir", name: "Amir Cohen", role: "Head of Support", accessRole: "reviewer" };
const OWNER_AUTHOR = { id: OWNER.id, kind: "human" as const, name: OWNER.name, role: OWNER.role };

const DOC = "policies/refunds.md";

const attribution = (prId: string, prTitle: string, who: SessionUser) => ({
  author: { id: who.id, kind: "human" as const, name: who.name },
  mergedAt: ago(75),
  prId,
  prTitle,
});

const PR_001: ContextPR = {
  id: "pr-001",
  title: "Tighten digital refund window and add high-value approval",
  description:
    "Reduce the digital-goods refund window from 14 to 7 days (license-activation caveat) and require a second approver for refunds over $500.",
  status: "in_review",
  origin: "ui",
  author: { id: OWNER.id, kind: "human", name: OWNER.name, role: OWNER.role },
  documentPath: DOC,
  createdAt: ago(2),
  updatedAt: ago(1),
  reviewers: [
    { author: { id: OWNER.id, kind: "human", name: OWNER.name }, decision: "pending", required: true },
    { author: { id: REVIEWER.id, kind: "human", name: REVIEWER.name }, decision: "pending", required: true },
  ],
  diff: {
    documentPath: DOC,
    summary: { added: 1, removed: 0, modified: 1 },
    blocks: [
      { id: "b1", kind: "unchanged", blockType: "heading", depth: 1, after: "Refund Policy", attribution: attribution("pr-000", "Establish refund policy", OWNER) },
      { id: "b2", kind: "unchanged", blockType: "paragraph", after: "Customers may request a refund through the support portal or by email." },
      { id: "b3", kind: "unchanged", blockType: "heading", depth: 2, after: "Refund Windows" },
      { id: "b4", kind: "unchanged", blockType: "paragraph", after: "Standard purchases are refundable within 30 days of delivery." },
      {
        id: "b5",
        kind: "modified",
        blockType: "paragraph",
        before: "Digital goods are refundable within 14 days of purchase.",
        after: "Digital goods are refundable within 7 days of purchase, provided the license has not been activated.",
        segments: [
          { text: "Digital goods are refundable within " },
          { text: "14", emphasis: "removed" },
          { text: "7", emphasis: "added" },
          { text: " days of " },
          { text: "purchase.", emphasis: "removed" },
          { text: "purchase, provided the license has not been activated.", emphasis: "added" },
        ],
      },
      { id: "b6", kind: "unchanged", blockType: "heading", depth: 2, after: "Eligibility" },
      { id: "b7", kind: "unchanged", blockType: "paragraph", after: "Items must be unused and in original packaging to qualify for a refund." },
      { id: "b8", kind: "added", blockType: "paragraph", after: "Refunds above $500 require a second approver before they are issued." },
    ],
  },
  blastRadius: {
    maxSeverity: "high",
    agents: [
      {
        id: "agent-refunds",
        name: "Refund Resolution Agent",
        purpose: "Decides customer refund eligibility and amounts.",
        severity: "high",
        reason: 'Relies on context mentioning "refund", "window", which this change touches.',
      },
    ],
  },
};

const PR_AGENT: ContextPrSummary = {
  id: "pr-agent-x1",
  title: "Document store-credit fallback for failed card refunds",
  status: "in_review",
  origin: "agent",
  author: { id: "agent-refunds", kind: "agent", name: "Refund Resolution Agent" },
  documentPath: DOC,
  updatedAt: ago(0.2),
  blastMaxSeverity: "medium",
  affectedAgents: 2,
};

const PR_000: ContextPrSummary = {
  id: "pr-000",
  title: "Establish refund policy",
  status: "merged",
  origin: "ui",
  author: { id: OWNER.id, kind: "human", name: OWNER.name },
  documentPath: DOC,
  updatedAt: ago(75),
  blastMaxSeverity: "low",
  affectedAgents: 0,
};

// Full CPRs for the other dashboard rows, so their pages render (static export
// must pre-render every linked PR — there's no server to render on demand).
const PR_AGENT_FULL: ContextPR = {
  id: "pr-agent-x1",
  title: PR_AGENT.title,
  description:
    "The agent found that when a card refund fails, support issues store credit — proposing to document the fallback.",
  status: "in_review",
  origin: "agent",
  author: { id: "agent-refunds", kind: "agent", name: "Refund Resolution Agent" },
  documentPath: DOC,
  createdAt: ago(0.2),
  updatedAt: ago(0.2),
  reviewers: [
    { author: { id: OWNER.id, kind: "human", name: OWNER.name }, decision: "pending", required: true },
  ],
  diff: {
    documentPath: DOC,
    summary: { added: 1, removed: 0, modified: 0 },
    blocks: [
      { id: "a1", kind: "unchanged", blockType: "paragraph", after: "Refunds are issued to the original payment method within 5 business days." },
      { id: "a2", kind: "added", blockType: "paragraph", after: "If the card refund fails, support issues store credit of equal value." },
    ],
  },
  blastRadius: {
    maxSeverity: "medium",
    agents: [
      { id: "agent-refunds", name: "Refund Resolution Agent", purpose: "Decides customer refund eligibility and amounts.", severity: "medium", reason: "Adds refund-failure handling." },
      { id: "agent-billing", name: "Billing Reconciliation Agent", purpose: "Reconciles invoices and applies credits.", severity: "medium", reason: "Mentions store credit." },
    ],
  },
};

const PR_000_FULL: ContextPR = {
  id: "pr-000",
  title: "Establish refund policy",
  description: "Initial authoritative refund policy.",
  status: "merged",
  origin: "ui",
  author: { id: OWNER.id, kind: "human", name: OWNER.name, role: OWNER.role },
  documentPath: DOC,
  createdAt: ago(75),
  updatedAt: ago(75),
  reviewers: [
    { author: { id: OWNER.id, kind: "human", name: OWNER.name }, decision: "approved", required: true, decidedAt: ago(75) },
  ],
  diff: {
    documentPath: DOC,
    summary: { added: 0, removed: 0, modified: 0 },
    blocks: [
      { id: "z1", kind: "unchanged", blockType: "heading", depth: 1, after: "Refund Policy" },
      { id: "z2", kind: "unchanged", blockType: "paragraph", after: "Customers may request a refund through the support portal or by email." },
      { id: "z3", kind: "unchanged", blockType: "heading", depth: 2, after: "Refund Windows" },
      { id: "z4", kind: "unchanged", blockType: "paragraph", after: "Standard purchases are refundable within 30 days of delivery." },
    ],
  },
  blastRadius: { maxSeverity: "low", agents: [] },
};

/** Every PR id the demo can link to — must all be pre-rendered for Pages. */
export const DEMO_PR_IDS = ["pr-001", "pr-agent-x1", "pr-000"];

const FRESHNESS: FreshnessOverview = {
  total: 10,
  counts: { fresh: 8, stale: 1, expired: 1, conflicted: 0 },
  attention: [
    { documentPath: DOC, blockKey: "refunds are issued…", text: "Refunds are issued to the original payment method within 5 business days.", state: "expired", lastReviewedAt: ago(140), ttlDays: 90, staleAt: ago(50) },
    { documentPath: DOC, blockKey: "digital goods…", text: "Digital goods are refundable within 14 days of purchase.", state: "stale", lastReviewedAt: ago(100), ttlDays: 90, staleAt: ago(10) },
  ],
};

const TICKETS: ReviewTicket[] = [
  { id: "t1", documentPath: DOC, blockKey: "refunds are issued…", blockText: "Refunds are issued to the original payment method within 5 business days.", reason: "Block is past its 90-day review window.", state: "open", createdAt: ago(3), assignee: OWNER_AUTHOR },
  { id: "t2", documentPath: DOC, blockKey: "digital goods…", blockText: "Digital goods are refundable within 14 days of purchase.", reason: "Block is past its 90-day review window.", state: "open", createdAt: ago(1), assignee: OWNER_AUTHOR },
];

const DISTRIBUTION: DistributionStatus = {
  published: true,
  version: "9fba0411301e56a5",
  generatedAt: ago(1),
  publicKeyPem: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA<demo-ed25519-public-key>\n-----END PUBLIC KEY-----",
  agents: [
    { agentId: "agent-refunds", agentName: "Refund Resolution Agent", documents: [DOC], files: 2, bytes: 3618 },
    { agentId: "agent-billing", agentName: "Billing Reconciliation Agent", documents: [DOC], files: 2, bytes: 3618 },
    { agentId: "agent-support", agentName: "Tier-1 Support Agent", documents: [DOC], files: 2, bytes: 3618 },
    { agentId: "agent-compliance", agentName: "Compliance Audit Agent", documents: [DOC], files: 2, bytes: 3618 },
  ],
};

const WORKSPACE: WorkspaceInfo = {
  configured: true,
  identityName: "Dana Levi",
  identityEmail: "dana@context.studio",
  sources: [
    { id: "s0", kind: "context", sourceType: "remote", location: "git@git.acme.internal:agents/support-context.git" },
    { id: "s1", kind: "skills", sourceType: "remote", location: "git@git.acme.internal:agents/support-skills.git" },
    { id: "s2", kind: "memory", sourceType: "local", location: "/srv/agents/support/memory" },
  ],
  documents: [
    "policies/refunds.md",
    "policies/shipping.md",
    "skills/issue-refund.md",
    "skills/lookup-order.md",
    "memory/known-edge-cases.md",
  ],
  files: [
    { path: "policies/refunds.md", kind: "context" },
    { path: "policies/shipping.md", kind: "context" },
    { path: "skills/issue-refund.md", kind: "skills" },
    { path: "skills/lookup-order.md", kind: "skills" },
    { path: "memory/known-edge-cases.md", kind: "memory" },
  ],
  agents: [
    { id: "agent-refunds", name: "Refund Resolution Agent" },
    { id: "agent-billing", name: "Billing Reconciliation Agent" },
    { id: "agent-support", name: "Tier-1 Support Agent" },
    { id: "agent-compliance", name: "Compliance Audit Agent" },
  ],
};

const DOC_CONTENT = `# Refund Policy

Customers may request a refund through the support portal or by email.

## Refund Windows

Standard purchases are refundable within 30 days of delivery.

Digital goods are refundable within 14 days of purchase.

## Eligibility

Items must be unused and in original packaging to qualify for a refund.

Refunds are issued to the original payment method within 5 business days.

## Escalation

Disputed refunds are escalated to a human Support lead for review.
`;

// Files across the typed sources. `marks` records agent-authored blocks and
// their confidence; everything else is human-written (trusted).
type AgentConfidence = "agent_approved" | "agent_unverified";
const DOCS: Record<string, { kind: SourceKind; content: string; marks?: Record<string, AgentConfidence> }> = {
  "policies/refunds.md": {
    kind: "context",
    content: DOC_CONTENT,
    marks: { "Digital goods are refundable within 14 days of purchase.": "agent_approved" },
  },
  "policies/shipping.md": {
    kind: "context",
    content: `# Shipping Policy

Orders ship within 2 business days of payment.

Standard delivery takes 3–5 business days.

International orders may take 10–14 business days and can incur customs fees.
`,
    marks: { "International orders may take 10–14 business days and can incur customs fees.": "agent_unverified" },
  },
  "skills/issue-refund.md": {
    kind: "skills",
    content: `# Issue a refund

## Steps

Look up the order by customer email or order ID.

Confirm eligibility against the refund policy.

Issue the refund to the original payment method.
`,
    marks: { "Confirm eligibility against the refund policy.": "agent_approved" },
  },
  "skills/lookup-order.md": {
    kind: "skills",
    content: `# Look up an order

## Steps

Search by customer email, then narrow by order ID or date.
`,
  },
  "memory/known-edge-cases.md": {
    kind: "memory",
    content: `# Known edge cases

Gift-card purchases are non-refundable.

Bundled items must be returned together to qualify.
`,
    marks: { "Bundled items must be returned together to qualify.": "agent_unverified" },
  },
};

export const DEMO_DOC_PATHS = Object.keys(DOCS);

const EVALS: EvalReport = {
  passed: true,
  results: [
    { id: "standard-window-present", agentId: "agent-refunds", question: "What is the standard refund window?", passed: true, missing: [], forbidden: [] },
    { id: "escalation-path-present", agentId: "agent-support", question: "Where do disputed refunds go?", passed: true, missing: [], forbidden: [] },
    { id: "payment-method-rule-present", agentId: "agent-billing", question: "How are refunds issued?", passed: true, missing: [], forbidden: [] },
  ],
};

const HEALTH: HealthOverview = {
  periodDays: 30,
  totalReads: 1284,
  totalMisses: 41,
  sample: true,
  trend: [28, 34, 31, 40, 38, 52, 47, 55, 49, 63, 58, 71, 66, 74],
  hot: [
    { path: "policies/refunds.md › Refund Windows", kind: "context", reads: 372, lastReadAt: ago(0.2), freshness: "fresh" },
    { path: "policies/refunds.md › Eligibility", kind: "context", reads: 248, lastReadAt: ago(0.5), freshness: "fresh" },
    { path: "skills/issue-refund.md › Steps", kind: "skills", reads: 197, lastReadAt: ago(0.3), freshness: "fresh" },
    { path: "policies/refunds.md › Refund Policy", kind: "context", reads: 140, lastReadAt: ago(1), freshness: "stale" },
    { path: "skills/lookup-order.md › Steps", kind: "skills", reads: 96, lastReadAt: ago(1) },
  ],
  cold: [
    { path: "policies/refunds.md › Escalation", kind: "context", reads: 0, freshness: "expired" },
    { path: "memory/known-edge-cases.md › Gift cards", kind: "memory", reads: 0 },
    { path: "skills/escalate-to-human.md › Steps", kind: "skills", reads: 0 },
    { path: "policies/refunds.md › Original packaging", kind: "context", reads: 2, lastReadAt: ago(12) },
  ],
  missing: [
    { query: "international / cross-border refunds", intent: "Answer a customer about an EU order", misses: 14, lastAskedAt: ago(0.4) },
    { query: "subscription cancellation & proration", intent: "Cancel a monthly plan mid-cycle", misses: 9, lastAskedAt: ago(1) },
    { query: "chargeback handling steps", intent: "Respond to a disputed charge", misses: 5, lastAskedAt: ago(3) },
  ],
};

/** Demo implementations matching the api client signatures. */
export const demo = {
  getHealth: async (): Promise<HealthOverview> => HEALTH,
  getContextPr: async (id: string): Promise<ContextPR | null> =>
    id === "pr-001" ? PR_001 : id === "pr-agent-x1" ? PR_AGENT_FULL : id === "pr-000" ? PR_000_FULL : null,
  listContextPrs: async (): Promise<ContextPrSummary[]> => [PR_AGENT, summarize(PR_001), PR_000],
  getFreshnessOverview: async (): Promise<FreshnessOverview> => FRESHNESS,
  listTickets: async (): Promise<ReviewTicket[]> => TICKETS,
  getDistribution: async (): Promise<DistributionStatus> => DISTRIBUTION,
  publishDistribution: async (): Promise<DistributionStatus> => ({ ...DISTRIBUTION, generatedAt: now }),
  getWorkspace: async (): Promise<WorkspaceInfo> => WORKSPACE,
  configureWorkspace: async () => ({ ok: true as const, data: WORKSPACE }),
  getDocumentView: async (path: string): Promise<DocumentView> => {
    const entry = DOCS[path] ?? DOCS["policies/refunds.md"]!;
    const attributions = parseBlocks(entry.content).map((b) => {
      const conf: Confidence = entry.marks?.[b.text] ?? "human";
      const isAgent = conf !== "human";
      return {
        blockKey: blockKey(b.text),
        attribution: {
          author: isAgent
            ? { id: "agent-refunds", kind: "agent" as const, name: "Refund Resolution Agent" }
            : { id: OWNER.id, kind: "human" as const, name: OWNER.name },
          mergedAt: ago(conf === "agent_unverified" ? 0.3 : isAgent ? 8 : 25),
          prId: isAgent ? "pr-agent-x1" : "pr-000",
          prTitle: isAgent ? "Agent: store-credit fallback" : "Establish policy",
          confidence: conf,
        },
      };
    });
    return { documentPath: path, content: entry.content, attributions, draftPrId: undefined };
  },
  autosaveDoc: async () => ({ draftPrId: "pr-demo-draft", savedAt: now }),
  proposeChange: async () => ({ prId: "pr-demo-draft" }),
  getEvals: async (): Promise<EvalReport> => EVALS,
  submitApproval: async () => ({ ok: true as const, data: { pr: { ...PR_001, status: "merged" as const }, merged: true } }),
  getAuthConfig: async (): Promise<AuthConfig> => ({ googleEnabled: false, pickUserEnabled: true }),
  getUsers: async (): Promise<SessionUser[]> => [OWNER, REVIEWER],
  getMe: async (): Promise<SessionUser> => OWNER,
  login: async (id: string): Promise<LoginResponse> => ({
    token: "demo-token",
    user: id === REVIEWER.id ? REVIEWER : OWNER,
  }),
  ownerSession: { token: "demo-token", user: OWNER },
};

function summarize(pr: ContextPR): ContextPrSummary {
  return {
    id: pr.id,
    title: pr.title,
    status: pr.status,
    origin: pr.origin,
    author: pr.author,
    documentPath: pr.documentPath,
    updatedAt: pr.updatedAt,
    blastMaxSeverity: pr.blastRadius.maxSeverity,
    affectedAgents: pr.blastRadius.agents.length,
  };
}
