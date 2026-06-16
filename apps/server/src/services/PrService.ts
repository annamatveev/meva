/**
 * PrService — orchestrates a Context PR from its three sources of truth:
 *   - Git (content of main vs the draft branch) via GitService
 *   - the semantic diff engine (SemanticDiffService)
 *   - SQLite metadata (reviewers, blast radius, attribution) via Prisma
 *
 * Routes stay thin; all domain assembly lives here.
 */

import type {
  AffectedAgent,
  ApprovalAction,
  Attribution,
  BlastRadius,
  BlastSeverity,
  ContextPR,
  ContextPrSummary,
  PrStatus,
  Reviewer,
  SemanticDiffBlock,
} from "@context-studio/types";
import { db } from "../lib/db.js";
import { DEFAULT_TTL_DAYS } from "../lib/config.js";
import { GitService, MAIN_BRANCH } from "./GitService.js";
import { blockKey, computeSemanticDiff } from "./SemanticDiffService.js";

const SEVERITY_RANK: Record<BlastSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export class PrNotFoundError extends Error {}
export class MergeBlockedError extends Error {}

export class PrService {
  constructor(private readonly git: GitService) {}

  /** Compact list for the change-request dashboard. */
  async listContextPrs(): Promise<ContextPrSummary[]> {
    const prs = await db.pr.findMany({
      include: { author: true, blastEntries: true },
      orderBy: { updatedAt: "desc" },
    });
    return prs.map((pr): ContextPrSummary => {
      const blast = this.toBlastRadius(pr.blastEntries);
      return {
        id: pr.id,
        title: pr.title,
        status: pr.status as PrStatus,
        origin: pr.origin as "ui" | "agent",
        author: {
          id: pr.author.id,
          kind: pr.author.kind as "human" | "agent",
          name: pr.author.name,
          role: pr.author.role ?? undefined,
        },
        documentPath: pr.documentPath,
        updatedAt: pr.updatedAt.toISOString(),
        blastMaxSeverity: blast.maxSeverity,
        affectedAgents: blast.agents.length,
      };
    });
  }

  /** Build the full domain object the CPR review screen renders. */
  async getContextPr(prId: string): Promise<ContextPR> {
    const pr = await db.pr.findUnique({
      where: { id: prId },
      include: {
        author: true,
        reviewers: { include: { author: true } },
        blastEntries: true,
      },
    });
    if (!pr) throw new PrNotFoundError(`PR ${prId} not found`);

    // Content on main (the authoritative state) vs the proposed draft branch.
    const before = await this.git.readDocument(MAIN_BRANCH, pr.documentPath);
    const after = pr.status === "merged"
      ? before
      : await this.git.readDocument(pr.draftBranch, pr.documentPath);

    const diff = computeSemanticDiff(pr.documentPath, before, after);
    await this.attachAttribution(pr.documentPath, diff.blocks, {
      prId: pr.id,
      prTitle: pr.title,
      authorName: pr.author.name,
      authorKind: pr.author.kind as "human" | "agent",
      authorId: pr.author.id,
    });

    const blastRadius = this.toBlastRadius(pr.blastEntries);

    return {
      id: pr.id,
      title: pr.title,
      description: pr.description,
      status: pr.status as PrStatus,
      origin: pr.origin as "ui" | "agent",
      author: {
        id: pr.author.id,
        kind: pr.author.kind as "human" | "agent",
        name: pr.author.name,
        role: pr.author.role ?? undefined,
      },
      documentPath: pr.documentPath,
      createdAt: pr.createdAt.toISOString(),
      updatedAt: pr.updatedAt.toISOString(),
      reviewers: pr.reviewers.map(
        (r): Reviewer => ({
          author: {
            id: r.author.id,
            kind: r.author.kind as "human" | "agent",
            name: r.author.name,
            role: r.author.role ?? undefined,
          },
          decision: r.decision as Reviewer["decision"],
          required: r.required,
          decidedAt: r.decidedAt?.toISOString(),
        }),
      ),
      diff,
      blastRadius,
    };
  }

  /**
   * Attach attribution to each block. Unchanged blocks resolve to whoever last
   * merged them (the attribution index); added/modified blocks are attributed
   * to the current PR's author as a *pending* attribution.
   */
  private async attachAttribution(
    documentPath: string,
    blocks: SemanticDiffBlock[],
    current: {
      prId: string;
      prTitle: string;
      authorName: string;
      authorKind: "human" | "agent";
      authorId: string;
    },
  ): Promise<void> {
    const index = await db.attributionEntry.findMany({
      where: { documentPath },
      include: { author: true },
    });
    const byKey = new Map(index.map((e) => [e.blockKey, e]));

    for (const block of blocks) {
      const text = block.after ?? block.before ?? "";
      if (block.kind === "added" || block.kind === "modified") {
        block.attribution = {
          author: {
            id: current.authorId,
            kind: current.authorKind,
            name: current.authorName,
          },
          mergedAt: new Date().toISOString(),
          prId: current.prId,
          prTitle: `${current.prTitle} (proposed)`,
        };
      } else {
        const hit = byKey.get(blockKey(text));
        if (hit) {
          block.attribution = {
            author: {
              id: hit.author.id,
              kind: hit.author.kind as "human" | "agent",
              name: hit.author.name,
            },
            mergedAt: hit.mergedAt.toISOString(),
            prId: hit.prId,
            prTitle: hit.prTitle,
          } satisfies Attribution;
        }
      }
    }
  }

  private toBlastRadius(
    entries: Array<{
      agentId: string;
      agentName: string;
      purpose: string;
      severity: string;
      reason: string;
    }>,
  ): BlastRadius {
    const agents: AffectedAgent[] = entries
      .map((e) => ({
        id: e.agentId,
        name: e.agentName,
        purpose: e.purpose,
        severity: e.severity as BlastSeverity,
        reason: e.reason,
      }))
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

    const maxSeverity = agents.reduce<BlastSeverity>((max, a) => {
      return SEVERITY_RANK[a.severity] > SEVERITY_RANK[max] ? a.severity : max;
    }, "low");

    return { agents, maxSeverity };
  }

  /**
   * Record a reviewer's decision and, when the merge gate is satisfied,
   * squash-merge the draft into main and finalize the attribution index.
   */
  async applyApproval(params: {
    prId: string;
    reviewerId: string;
    action: ApprovalAction;
    blastRadiusAcknowledged?: boolean;
  }): Promise<{ pr: ContextPR; merged: boolean }> {
    const { prId, reviewerId, action, blastRadiusAcknowledged } = params;

    const pr = await db.pr.findUnique({
      where: { id: prId },
      include: { author: true, reviewers: true, blastEntries: true },
    });
    if (!pr) throw new PrNotFoundError(`PR ${prId} not found`);

    if (action === "reject") {
      await this.git.discardDraft(prId);
      await db.pr.update({ where: { id: prId }, data: { status: "rejected" } });
      return { pr: await this.getContextPr(prId), merged: false };
    }

    const decision = action === "approve" ? "approved" : "changes_requested";
    await db.reviewer.updateMany({
      where: { prId, authorId: reviewerId },
      data: { decision, decidedAt: new Date() },
    });

    const reviewers = await db.reviewer.findMany({ where: { prId } });
    const requiredApproved = reviewers
      .filter((r) => r.required)
      .every((r) => r.decision === "approved");
    const anyChangesRequested = reviewers.some(
      (r) => r.decision === "changes_requested",
    );

    const blast = this.toBlastRadius(pr.blastEntries);
    const needsAck = blast.maxSeverity === "high";

    let merged = false;
    let nextStatus: PrStatus = anyChangesRequested
      ? "changes_requested"
      : requiredApproved
        ? "approved"
        : "in_review";

    if (action === "approve" && requiredApproved && !anyChangesRequested) {
      if (needsAck && !blastRadiusAcknowledged) {
        throw new MergeBlockedError(
          "High blast-radius change requires explicit acknowledgement before merge.",
        );
      }
      // Squash all autosaves into one semantic commit on main.
      await this.git.squashMergeDraft({
        prId,
        semanticMessage: `${pr.title}\n\n${pr.description}`,
        author: {
          id: pr.author.id,
          kind: pr.author.kind as "human" | "agent",
          name: pr.author.name,
        },
      });
      await this.finalizeAttribution(pr.id, pr.documentPath, pr.title, pr.authorId);
      nextStatus = "merged";
      merged = true;
    }

    await db.pr.update({ where: { id: prId }, data: { status: nextStatus } });
    return { pr: await this.getContextPr(prId), merged };
  }

  /** After merge, rewrite the attribution index for every block now on main. */
  private async finalizeAttribution(
    prId: string,
    documentPath: string,
    prTitle: string,
    authorId: string,
  ): Promise<void> {
    const merged = await this.git.readDocument(MAIN_BRANCH, documentPath);
    const diff = computeSemanticDiff(documentPath, "", merged); // all "added"
    const now = new Date();

    const staleAt = new Date(now.getTime() + DEFAULT_TTL_DAYS * 86_400_000);

    for (const block of diff.blocks) {
      const text = block.after ?? "";
      const key = blockKey(text);
      // Upsert-by-(documentPath, blockKey): newest merge wins authorship.
      await db.attributionEntry.deleteMany({
        where: { documentPath, blockKey: key },
      });
      await db.attributionEntry.create({
        data: {
          documentPath,
          blockKey: key,
          mergedAt: now,
          prId,
          prTitle,
          authorId,
        },
      });

      // A merged block is freshly reviewed; (re)start its TTL clock.
      await db.blockFreshness.upsert({
        where: { documentPath_blockKey: { documentPath, blockKey: key } },
        update: {
          text: text.slice(0, 240),
          state: "fresh",
          lastReviewedAt: now,
          ttlDays: DEFAULT_TTL_DAYS,
          staleAt,
        },
        create: {
          documentPath,
          blockKey: key,
          text: text.slice(0, 240),
          state: "fresh",
          lastReviewedAt: now,
          ttlDays: DEFAULT_TTL_DAYS,
          staleAt,
        },
      });

      // Any open stale/conflict ticket for this block is now resolved.
      await db.reviewTicket.updateMany({
        where: { documentPath, blockKey: key, state: "open" },
        data: { state: "resolved" },
      });
    }
  }
}
