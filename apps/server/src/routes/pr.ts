/**
 * Context PR routes.
 *
 *   GET  /api/context/pr/:id            — full CPR for the review screen
 *   POST /api/context/pr/:id/approve    — approval routing + squash-merge
 *   POST /api/context/pr/agent-submit   — autonomous agents open a CPR
 */

import { Router } from "express";
import { z } from "zod";
import type { AgentSubmitResponse } from "@context-studio/types";
import { db } from "../lib/db.js";
import { computeBlastEntries } from "../lib/agents.js";
import { GitService, MAIN_BRANCH } from "../services/GitService.js";
import {
  MergeBlockedError,
  PrNotFoundError,
  PrService,
} from "../services/PrService.js";
import { computeSemanticDiff } from "../services/SemanticDiffService.js";

export function createPrRouter(git: GitService): Router {
  const router = Router();
  const prs = new PrService(git);

  // --- List CPRs (dashboard) --------------------------------------------
  router.get("/", async (_req, res) => {
    try {
      res.json(await prs.listContextPrs());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to list Context PRs." });
    }
  });

  // --- Read a CPR --------------------------------------------------------
  router.get("/:id", async (req, res) => {
    try {
      const pr = await prs.getContextPr(req.params.id);
      res.json(pr);
    } catch (err) {
      if (err instanceof PrNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Failed to load Context PR." });
    }
  });

  // --- Approval routing --------------------------------------------------
  const approvalSchema = z.object({
    reviewerId: z.string().min(1),
    action: z.enum(["approve", "request_changes", "reject"]),
    comment: z.string().optional(),
    blastRadiusAcknowledged: z.boolean().optional(),
  });

  router.post("/:id/approve", async (req, res) => {
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const result = await prs.applyApproval({
        prId: req.params.id,
        ...parsed.data,
      });
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

  // --- Agents open a Context PR programmatically -------------------------
  const agentSubmitSchema = z.object({
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    documentPath: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    proposedContent: z.string(),
  });

  router.post("/agent-submit", async (req, res) => {
    const parsed = agentSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const prId = `pr-agent-${Date.now().toString(36)}`;

    try {
      // The agent's identity is recorded as a first-class author.
      await db.author.upsert({
        where: { id: body.agentId },
        update: { name: body.agentName },
        create: {
          id: body.agentId,
          kind: "agent",
          name: body.agentName,
          role: "Autonomous agent",
        },
      });

      // Transparent Git: create the draft branch + autosave the proposal.
      const { branch } = await git.autosaveDraft({
        prId,
        docPath: body.documentPath,
        content: body.proposedContent,
        author: { id: body.agentId, kind: "agent", name: body.agentName },
      });

      // Compute blast radius from the proposed change.
      const before = await git.readDocument(MAIN_BRANCH, body.documentPath);
      const diff = computeSemanticDiff(body.documentPath, before, body.proposedContent);
      const blast = computeBlastEntries(diff);

      // Default reviewer: the human Context Owner must sign off on agent PRs.
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
