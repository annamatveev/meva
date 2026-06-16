/**
 * EvalService — the regression gate on context changes (Module 8).
 *
 * For a proposed change (a PR's draft branch), it evaluates each eval case
 * against the agent's *resulting* context: the document set the agent reads,
 * with the PR's document swapped to its proposed version. A case passes when
 * every `expectContains` phrase is present and no `expectNotContains` phrase is.
 *
 * Deterministic on purpose — this is the seam where real LLM-behavior evals
 * would plug in. Failing evals block the merge.
 */

import type { EvalReport, EvalResult } from "@context-studio/types";
import { db } from "../lib/db.js";
import { MAIN_BRANCH } from "./GitService.js";
import type { WorkspaceContext } from "./WorkspaceManager.js";

export class EvalService {
  constructor(private readonly ctx: WorkspaceContext) {}

  async runForPr(prId: string): Promise<EvalReport> {
    const pr = await db.pr.findUnique({ where: { id: prId } });
    if (!pr) return { passed: true, results: [] };

    // Resolve a document to its PROPOSED content: the changed doc comes from the
    // draft branch, everything else from main.
    const resolve = async (doc: string): Promise<string> =>
      doc === pr.documentPath
        ? this.ctx.git.readDocument(pr.draftBranch, doc)
        : this.ctx.git.readDocument(MAIN_BRANCH, doc);

    const results: EvalResult[] = [];
    for (const ev of this.ctx.evals) {
      const agent = this.ctx.agents.find((a) => a.id === ev.agentId);
      const docs = agent?.reads ?? [];
      const haystack = (await Promise.all(docs.map(resolve))).join("\n").toLowerCase();

      const missing = (ev.expectContains ?? []).filter(
        (p) => !haystack.includes(p.toLowerCase()),
      );
      const forbidden = (ev.expectNotContains ?? []).filter((p) =>
        haystack.includes(p.toLowerCase()),
      );
      results.push({
        id: ev.id,
        agentId: ev.agentId,
        question: ev.question,
        passed: missing.length === 0 && forbidden.length === 0,
        missing,
        forbidden,
      });
    }

    return { passed: results.every((r) => r.passed), results };
  }
}
