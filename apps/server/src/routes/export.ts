/**
 * Export routes (Module 3) — machine-readable context for AI consumption.
 *
 *   GET /api/context/export/llms.txt — concatenated agent-friendly text
 *   GET /api/context/export/fcontext — .fcontext manifest (JSON)
 */

import { Router } from "express";
import { ExportService } from "../services/ExportService.js";
import type { GitService } from "../services/GitService.js";

export function createExportRouter(git: GitService): Router {
  const router = Router();
  const exporter = new ExportService(git);

  router.get("/llms.txt", async (_req, res) => {
    try {
      const text = await exporter.buildLlmsTxt();
      res.type("text/plain").send(text);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build llms.txt." });
    }
  });

  router.get("/fcontext", async (_req, res) => {
    try {
      res.json(await exporter.buildFcontext());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build .fcontext manifest." });
    }
  });

  return router;
}
