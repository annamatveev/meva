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

export function createPrRouter(wm: WorkspaceManager): Router {
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

  const approvalSchema = z.object({
    reviewerId: z.string().min(1),
    action: z.enum(["approve", "request_changes", "reject"]),
    comment: z.string().optional(),
    blastRadiusAcknowledged: z.boolean().optional(),
  });

  router.post("/:id/approve", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const result = await new PrService(ctx.git).applyApproval({
        prId: req.params.id,
        ...parsed.data,
      });
      if (result.merged) {
        await wm.publishCurrent(); // push approved main back to the canonical store
        await wm.refreshDiscovery();
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
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    documentPath: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    proposedContent: z.string(),
  });

  router.post("/agent-submit", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    const parsed = agentSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const prId = `pr-agent-${Date.now().toString(36)}`;

    try {
      await db.author.upsert({
        where: { id: body.agentId },
        update: { name: body.agentName },
        create: { id: body.agentId, kind: "agent", name: body.agentName, role: "Autonomous agent" },
      });

      const { branch } = await ctx.git.autosaveDraft({
        prId,
        docPath: body.documentPath,
        content: body.proposedContent,
        author: { id: body.agentId, kind: "agent", name: body.agentName },
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
          authorId: body.agentId,
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
