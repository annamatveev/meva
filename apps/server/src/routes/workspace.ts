/**
 * Workspace routes (Module 5).
 *
 *   GET  /api/context/workspace  — current binding (or { configured: false })
 *   POST /api/context/workspace  — bind to an external context store
 */

import { Router } from "express";
import { z } from "zod";
import type { WorkspaceInfo } from "@context-studio/types";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";

export function createWorkspaceRouter(wm: WorkspaceManager): Router {
  const router = Router();

  const toInfo = (): WorkspaceInfo => {
    const ctx = wm.current();
    if (!ctx) return { configured: false, documents: [], agents: [] };
    return {
      configured: true,
      sourceType: ctx.sourceType,
      location: ctx.location,
      identityName: ctx.identity.name,
      identityEmail: ctx.identity.email,
      documents: ctx.documents,
      agents: ctx.agents.map((a) => ({ id: a.id, name: a.name })),
    };
  };

  router.get("/", (_req, res) => res.json(toInfo()));

  const configureSchema = z.object({
    sourceType: z.enum(["local", "remote"]),
    location: z.string().min(1),
    identityName: z.string().min(1),
    identityEmail: z.string().email(),
  });

  router.post("/", async (req, res) => {
    const parsed = configureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      await wm.configure(parsed.data);
      res.json(toInfo());
    } catch (err) {
      console.error(err);
      res.status(422).json({
        error: `Could not bind to "${parsed.data.location}": ${(err as Error).message}`,
      });
    }
  });

  return router;
}
