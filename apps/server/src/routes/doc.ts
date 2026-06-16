/**
 * Document editing routes (Module 3).
 *
 *   GET  /api/context/doc/view?path=&as=   — content + attribution + open draft
 *   POST /api/context/doc/autosave         — transparent autosave to a draft PR
 *   POST /api/context/doc/propose          — promote draft to an in-review CPR
 */

import { Router } from "express";
import { z } from "zod";
import {
  DocNotFoundError,
  DocService,
  DraftNotFoundError,
} from "../services/DocService.js";
import type { GitService } from "../services/GitService.js";

export function createDocRouter(git: GitService): Router {
  const router = Router();
  const docs = new DocService(git);

  router.get("/view", async (req, res) => {
    const path = String(req.query.path ?? "");
    const as = String(req.query.as ?? "user-dana");
    if (!path) {
      res.status(400).json({ error: "Missing ?path" });
      return;
    }
    try {
      res.json(await docs.getDocumentView(path, as));
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
    const parsed = autosaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      res.json(await docs.autosave(parsed.data));
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
    const parsed = proposeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      res.json(await docs.propose(parsed.data));
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
