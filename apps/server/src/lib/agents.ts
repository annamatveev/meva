/**
 * Agent registry + blast-radius computation.
 *
 * In a real system this mapping comes from the agents' declared context
 * subscriptions (which `.fcontext` sections / `llms.txt` files they consume).
 * For the prototype it's a static registry keyed by section keywords.
 */

import type { BlastSeverity, RegisteredAgent, SemanticDiff } from "@context-studio/types";

/**
 * Built-in fallback registry, used when the bound workspace has no
 * `.contextstudio.yml` agent mapping. Real workspaces should declare their
 * agents in that file so the mapping is versioned with the content.
 */
export const BUILTIN_AGENTS: RegisteredAgent[] = [
  {
    id: "agent-refunds",
    name: "Refund Resolution Agent",
    purpose: "Decides customer refund eligibility and amounts.",
    watches: ["refund", "return", "window", "eligibility"],
    baseSeverity: "high",
  },
  {
    id: "agent-billing",
    name: "Billing Reconciliation Agent",
    purpose: "Reconciles invoices and applies credits.",
    watches: ["billing", "invoice", "credit", "charge", "fee"],
    baseSeverity: "medium",
  },
  {
    id: "agent-support",
    name: "Tier-1 Support Agent",
    purpose: "Answers customer questions from policy context.",
    watches: ["policy", "support", "contact", "hours", "escalation"],
    baseSeverity: "low",
  },
  {
    id: "agent-compliance",
    name: "Compliance Audit Agent",
    purpose: "Flags policy text that conflicts with regulation.",
    watches: ["compliance", "regulation", "gdpr", "retention", "consent"],
    baseSeverity: "high",
  },
];

const SEVERITY_RANK: Record<BlastSeverity, number> = { low: 0, medium: 1, high: 2 };

export interface ComputedBlastEntry {
  agentId: string;
  agentName: string;
  purpose: string;
  severity: BlastSeverity;
  reason: string;
}

/**
 * Determine which agents a proposed change affects by matching their watched
 * keywords against the text of changed (added / removed / modified) blocks.
 * `agents` comes from the bound workspace (.contextstudio.yml), or the built-in
 * fallback when none is declared.
 */
export function computeBlastEntries(
  diff: SemanticDiff,
  agents: RegisteredAgent[] = BUILTIN_AGENTS,
): ComputedBlastEntry[] {
  const changed = diff.blocks.filter((b) => b.kind !== "unchanged");
  const haystack = changed
    .map((b) => `${b.before ?? ""} ${b.after ?? ""}`.toLowerCase())
    .join(" ");

  const entries: ComputedBlastEntry[] = [];
  for (const agent of agents) {
    const matched = agent.watches.filter((w) => haystack.includes(w));
    if (matched.length === 0) continue;

    // More matched keywords + more changed blocks => bump severity one notch.
    let severity = agent.baseSeverity;
    if (matched.length >= 2 && changed.length >= 3 && severity !== "high") {
      severity = SEVERITY_RANK[severity] === 0 ? "medium" : "high";
    }

    entries.push({
      agentId: agent.id,
      agentName: agent.name,
      purpose: agent.purpose,
      severity,
      reason: `Relies on context mentioning "${matched.join('", "')}", which this change touches.`,
    });
  }
  return entries;
}
