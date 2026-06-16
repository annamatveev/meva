/**
 * Workspace routes.
 *
 *   GET  /api/context/workspace  — current binding (or { configured: false })
 *   POST /api/context/workspace  — bind to typed sources (owner)
 */

import { Router } from "express";
import { z } from "zod";
import type { WorkspaceInfo } from "@context-studio/types";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";
import type { AuthService } from "../services/AuthService.js";
import { requirePermission } from "./guard.js";

export function createWorkspaceRouter(wm: WorkspaceManager, auth: AuthService): Router {
  const router = Router();

  const toInfo = (): WorkspaceInfo => {
    const ctx = wm.current();
    if (!ctx) return { configured: false, sources: [], documents: [], agents: [] };
    return {
      configured: true,
      identityName: ctx.identity.name,
      identityEmail: ctx.identity.email,
      sources: ctx.sources,
      documents: ctx.documents,
      agents: ctx.agents.map((a) => ({ id: a.id, name: a.name })),
    };
  };

  router.get("/", (_req, res) => res.json(toInfo()));

  const configureSchema = z.object({
    identityName: z.string().min(1),
    identityEmail: z.string().email(),
    sources: z
      .array(
        z.object({
          kind: z.string().min(1),
          sourceType: z.enum(["local", "remote"]),
          location: z.string().min(1),
        }),
      )
      .min(1),
  });

  router.post("/", async (req, res) => {
    const me = await requirePermission(auth, req, res, "configureWorkspace");
    if (!me) return;
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
      res.status(422).json({ error: `Could not bind sources: ${(err as Error).message}` });
    }
  });

  return router;
}
