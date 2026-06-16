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
  ContextPR,
  ContextPrSummary,
  DistributionStatus,
  DocumentView,
  EvalReport,
  FreshnessOverview,
  LoginResponse,
  ReviewTicket,
  SessionUser,
  WorkspaceInfo,
} from "@context-studio/types";

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
  sourceType: "local",
  location: "/srv/context (demo)",
  identityName: "Dana Levi",
  identityEmail: "dana@context.studio",
  documents: [DOC],
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

const EVALS: EvalReport = {
  passed: true,
  results: [
    { id: "standard-window-present", agentId: "agent-refunds", question: "What is the standard refund window?", passed: true, missing: [], forbidden: [] },
    { id: "escalation-path-present", agentId: "agent-support", question: "Where do disputed refunds go?", passed: true, missing: [], forbidden: [] },
    { id: "payment-method-rule-present", agentId: "agent-billing", question: "How are refunds issued?", passed: true, missing: [], forbidden: [] },
  ],
};

/** Demo implementations matching the api client signatures. */
export const demo = {
  getContextPr: async (id: string): Promise<ContextPR | null> => (id === "pr-001" ? PR_001 : null),
  listContextPrs: async (): Promise<ContextPrSummary[]> => [PR_AGENT, summarize(PR_001), PR_000],
  getFreshnessOverview: async (): Promise<FreshnessOverview> => FRESHNESS,
  listTickets: async (): Promise<ReviewTicket[]> => TICKETS,
  getDistribution: async (): Promise<DistributionStatus> => DISTRIBUTION,
  publishDistribution: async (): Promise<DistributionStatus> => ({ ...DISTRIBUTION, generatedAt: now }),
  getWorkspace: async (): Promise<WorkspaceInfo> => WORKSPACE,
  configureWorkspace: async () => ({ ok: true as const, data: WORKSPACE }),
  getDocumentView: async (): Promise<DocumentView> => ({
    documentPath: DOC,
    content: DOC_CONTENT,
    attributions: [],
    draftPrId: undefined,
  }),
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
