/**
 * Document editing routes (Module 3).
 *
 *   GET  /api/context/doc/view?path=&as=   — content + attribution + open draft
 *   POST /api/context/doc/autosave         — transparent autosave to a draft PR
 *   POST /api/context/doc/propose          — promote draft to an in-review CPR
 *
 * Git access is resolved per-request from the active workspace.
 */

import { Router, type Response } from "express";
import { z } from "zod";
import {
  DocNotFoundError,
  DocService,
  DraftNotFoundError,
} from "../services/DocService.js";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";

function requireWorkspace(wm: WorkspaceManager, res: Response) {
  const ctx = wm.current();
  if (!ctx) {
    res.status(409).json({ error: "No workspace configured.", code: "NO_WORKSPACE" });
    return null;
  }
  return ctx;
}

export function createDocRouter(wm: WorkspaceManager): Router {
  const router = Router();
  const service = (wmCtx: ReturnType<WorkspaceManager["current"]>) =>
    new DocService(wmCtx!.git, wmCtx!.agents);

  router.get("/view", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    const path = String(req.query.path ?? "");
    const as = String(req.query.as ?? "user-dana");
    if (!path) {
      res.status(400).json({ error: "Missing ?path" });
      return;
    }
    try {
      res.json(await service(ctx).getDocumentView(path, as));
    } catch (err) {
      if (err instanceof DocNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Failed to load document." });
    }
  });

  const autosaveSchema = z.object({
    documentPath: z.string().min(1),
    content: z.string(),
    authorId: z.string().min(1),
  });

  router.post("/autosave", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    const parsed = autosaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      res.json(await service(ctx).autosave(parsed.data));
    } catch (err) {
      if (err instanceof DraftNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Autosave failed." });
    }
  });

  const proposeSchema = z.object({
    draftPrId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
  });

  router.post("/propose", async (req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    const parsed = proposeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      res.json(await service(ctx).propose(parsed.data));
    } catch (err) {
      if (err instanceof DraftNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Failed to propose change." });
    }
  });

  return router;
}
