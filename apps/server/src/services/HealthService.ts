/**
 * HealthService — the agent "health" overview behind the main dashboard.
 *
 * Phase 1: returns a representative SAMPLE derived from the workspace's
 * documents (so the dashboard is meaningful before any live traffic). Phase 2
 * replaces this with real read/miss/intent data recorded by the MCP read-proxy
 * and the agent feedback API. `sample: true` flags that it's not yet live.
 */

import type { HealthOverview, KnowledgeArea, SourceKind } from "@context-studio/types";
import type { WorkspaceContext } from "./WorkspaceManager.js";
import { MAIN_BRANCH } from "./GitService.js";
import { parseBlocks } from "./SemanticDiffService.js";

export class HealthService {
  constructor(private readonly ctx: WorkspaceContext) {}

  async overview(): Promise<HealthOverview> {
    const kindOf = (doc: string): SourceKind => {
      const s = this.ctx.sources.find((src) => doc.includes(src.kind));
      return s?.kind ?? this.ctx.sources[0]?.kind ?? "context";
    };

    // Build "areas" from the headings of each document.
    const areas: KnowledgeArea[] = [];
    for (const doc of this.ctx.documents) {
      const content = await this.ctx.git.readDocument(MAIN_BRANCH, doc);
      const headings = parseBlocks(content).filter((b) => b.blockType === "heading");
      headings.forEach((h, i) => {
        // Deterministic pseudo-usage so the sample is stable across reloads.
        const reads = pseudoReads(`${doc}#${h.text}`);
        areas.push({
          path: `${doc} › ${h.text}`,
          kind: kindOf(doc),
          reads,
          lastReadAt: reads > 0 ? daysAgo((i % 5) + 1) : undefined,
        });
      });
    }

    const sorted = [...areas].sort((a, b) => b.reads - a.reads);
    const hot = sorted.filter((a) => a.reads > 0).slice(0, 6);
    const cold = sorted.filter((a) => a.reads === 0).slice(0, 6);
    const totalReads = areas.reduce((s, a) => s + a.reads, 0);

    const missing = SAMPLE_MISSING;
    const totalMisses = missing.reduce((s, m) => s + m.misses, 0);

    // Deterministic sample trend (reads/day) so the sparkline is stable.
    const trend = Array.from({ length: 14 }, (_, i) => 30 + ((i * 37 + totalReads) % 60));

    return { periodDays: 30, totalReads, totalMisses, sample: true, trend, hot, cold, missing };
  }
}

function pseudoReads(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const v = h % 100;
  if (v < 25) return 0; // ~quarter are never read
  return v;
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

const SAMPLE_MISSING = [
  { query: "international / cross-border refunds", intent: "Answer a customer about an EU order", misses: 14, lastAskedAt: daysAgo(1) },
  { query: "subscription cancellation & proration", intent: "Cancel a monthly plan mid-cycle", misses: 9, lastAskedAt: daysAgo(2) },
  { query: "chargeback handling steps", intent: "Respond to a disputed charge", misses: 5, lastAskedAt: daysAgo(4) },
];
