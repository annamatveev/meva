/**
 * Context PR routes.
 *
 *   GET  /api/context/pr                — list CPRs (dashboard)
 *   GET  /api/context/pr/:id            — full CPR for the review screen
 *   POST /api/context/pr/:id/approve    — approval routing + squash-merge
 *   POST /api/context/pr/agent-submit   — autonomous agents open a CPR
 *
 * Git access is resolved per-request from the active workspace.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import type { AgentSubmitResponse } from "@context-studio/types";
import { db } from "../lib/db.js";
import { computeBlastEntries } from "../lib/agents.js";
import { MAIN_BRANCH } from "../services/GitService.js";
import {
  MergeBlockedError,
  PrNotFoundError,
  PrService,
} from "../services/PrService.js";
import { computeSemanticDiff } from "../services/SemanticDiffService.js";
import { EvalService } from "../services/EvalService.js";
import { DistributionService } from "../services/DistributionService.js";
import type { SigningService } from "../services/SigningService.js";
import { AuthService, bearer } from "../services/AuthService.js";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";

/** Resolve the active workspace or send 409 — null means "handled, stop". */
function requireWorkspace(wm: WorkspaceManager, res: Response) {
  const ctx = wm.current();
  if (!ctx) {
    res.status(409).json({ error: "No workspace configured.", code: "NO_WORKSPACE" });
    return null;
  }
  return ctx;
}

export function createPrRouter(
  wm: WorkspaceManager,
  signing: SigningService,
  auth: AuthService,
): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    try {
      res.json(await new PrService(ctx.git).listContextPrs());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to list Context PRs." });
    }
  });

  router.get("/:id", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    try {
      res.json(await new PrService(ctx.git).getContextPr(req.params.id));
    } catch (err) {
      if (err instanceof PrNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Failed to load Context PR." });
    }
  });

  // Run the regression evals for a PR's proposed change (read-only).
  router.get("/:id/evals", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    try {
      res.json(await new EvalService(ctx).runForPr(req.params.id));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to run evals." });
    }
  });

  const approvalSchema = z.object({
    action: z.enum(["approve", "request_changes", "reject"]),
    comment: z.string().optional(),
    blastRadiusAcknowledged: z.boolean().optional(),
  });

  router.post("/:id/approve", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;

    // The acting reviewer is derived from the session — you can only act as
    // yourself, never via a reviewerId in the body.
    const reviewerId = await auth.verifySession(bearer(req.headers.authorization), Date.now());
    if (!reviewerId) {
      res.status(401).json({ error: "Sign in to review." });
      return;
    }
    const onPr = await db.reviewer.findFirst({
      where: { prId: req.params.id, authorId: reviewerId },
    });
    if (!onPr) {
      res.status(403).json({ error: "You are not a reviewer on this change request." });
      return;
    }

    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    // Evals gate: a change cannot be approved while its context-regression
    // evals fail. (request_changes / reject are always allowed.)
    if (parsed.data.action === "approve") {
      const report = await new EvalService(ctx).runForPr(req.params.id);
      if (!report.passed) {
        res.status(409).json({
          error: "Context evals failed — resolve regressions before approving.",
          code: "EVALS_FAILED",
          report,
        });
        return;
      }
    }

    try {
      const result = await new PrService(ctx.git).applyApproval({
        prId: req.params.id,
        reviewerId,
        action: parsed.data.action,
        blastRadiusAcknowledged: parsed.data.blastRadiusAcknowledged,
      });
      if (result.merged) {
        await wm.publishCurrent(); // push approved main back to the canonical store
        await wm.refreshDiscovery();
        // Re-publish signed per-agent slices to the distribution channel.
        try {
          await new DistributionService(ctx, signing).publish(new Date().toISOString());
        } catch (pubErr) {
          console.error("[distribution] publish after merge failed:", pubErr);
        }
      }
      res.json(result);
    } catch (err) {
      if (err instanceof PrNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof MergeBlockedError) {
        res.status(409).json({ error: err.message, code: "BLAST_ACK_REQUIRED" });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Failed to apply approval." });
    }
  });

  const agentSubmitSchema = z.object({
    documentPath: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    proposedContent: z.string(),
  });

  router.post("/agent-submit", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;

    // The agent's identity comes from its API key, never the request body —
    // a caller can't claim to be an agent it doesn't hold the key for.
    const agentId = await auth.authenticateAgent(bearer(req.headers.authorization));
    if (!agentId) {
      res.status(401).json({ error: "Valid agent API key required.", code: "AGENT_KEY_REQUIRED" });
      return;
    }
    const agent = await db.author.findUnique({ where: { id: agentId } });
    if (!agent || agent.kind !== "agent") {
      res.status(403).json({ error: "API key is not bound to a known agent." });
      return;
    }

    const parsed = agentSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const prId = `pr-agent-${Date.now().toString(36)}`;

    try {
      const { branch } = await ctx.git.autosaveDraft({
        prId,
        docPath: body.documentPath,
        content: body.proposedContent,
        author: { id: agent.id, kind: "agent", name: agent.name },
      });

      const before = await ctx.git.readDocument(MAIN_BRANCH, body.documentPath);
      const diff = computeSemanticDiff(body.documentPath, before, body.proposedContent);
      const blast = computeBlastEntries(diff, ctx.agents);

      const owner = await db.author.findFirst({ where: { kind: "human" } });

      await db.pr.create({
        data: {
          id: prId,
          title: body.title,
          description: body.description,
          status: "in_review",
          origin: "agent",
          documentPath: body.documentPath,
          draftBranch: branch,
          authorId: agent.id,
          reviewers: owner
            ? { create: [{ authorId: owner.id, decision: "pending", required: true }] }
            : undefined,
          blastEntries: { create: blast },
        },
      });

      const response: AgentSubmitResponse = { prId, status: "in_review" };
      res.status(201).json(response);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to submit agent Context PR." });
    }
  });

  return router;
}
