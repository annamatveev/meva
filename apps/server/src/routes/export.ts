/**
 * Export routes (Module 3) — machine-readable context for AI consumption.
 *
 *   GET /api/context/export/llms.txt — concatenated agent-friendly text
 *   GET /api/context/export/fcontext — .fcontext manifest (JSON)
 */

import { Router } from "express";
import { ExportService } from "../services/ExportService.js";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";

export function createExportRouter(wm: WorkspaceManager): Router {
  const router = Router();

  router.get("/llms.txt", async (_req, res) => {
    const ctx = wm.current();
    if (!ctx) {
      res.status(409).json({ error: "No workspace configured." });
      return;
    }
    try {
      res.type("text/plain").send(await new ExportService(ctx.git).buildLlmsTxt());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build llms.txt." });
    }
  });

  router.get("/fcontext", async (_req, res) => {
    const ctx = wm.current();
    if (!ctx) {
      res.status(409).json({ error: "No workspace configured." });
      return;
    }
    try {
      res.json(await new ExportService(ctx.git).buildFcontext());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build .fcontext manifest." });
    }
  });

  return router;
}
