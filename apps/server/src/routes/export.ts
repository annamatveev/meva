/**
 * Export routes (Module 3 + CSV connection).
 *
 *   GET /api/context/export/llms.txt   — concatenated agent-friendly text
 *   GET /api/context/export/fcontext   — .fcontext manifest (JSON)
 *   GET /api/context/export/ledger.csv — the change-request ledger as CSV
 */

import { Router, type Response } from "express";
import { ExportService } from "../services/ExportService.js";
import { PrService } from "../services/PrService.js";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";

function requireWorkspace(wm: WorkspaceManager, res: Response) {
  const ctx = wm.current();
  if (!ctx) {
    res.status(409).json({ error: "No workspace configured." });
    return null;
  }
  return ctx;
}

/** Quote a CSV cell and escape embedded quotes. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function createExportRouter(wm: WorkspaceManager): Router {
  const router = Router();

  router.get("/llms.txt", async (_req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    try {
      res.type("text/plain").send(await new ExportService(ctx.git).buildLlmsTxt());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build llms.txt." });
    }
  });

  router.get("/fcontext", async (_req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    try {
      res.json(await new ExportService(ctx.git).buildFcontext());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build .fcontext manifest." });
    }
  });

  router.get("/ledger.csv", async (_req, res) => {
    const ctx = requireWorkspace(wm, res);
    if (!ctx) return;
    try {
      const prs = await new PrService(ctx.git).listContextPrs();
      const header = [
        "id",
        "title",
        "status",
        "origin",
        "author",
        "document",
        "blastSeverity",
        "affectedAgents",
        "updatedAt",
      ];
      const rows = prs.map((p) => [
        p.id,
        p.title,
        p.status,
        p.origin,
        p.author.name,
        p.documentPath,
        p.blastMaxSeverity,
        p.affectedAgents,
        p.updatedAt,
      ]);
      const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
      res
        .type("text/csv")
        .set("Content-Disposition", "attachment; filename=meva-ledger.csv")
        .send(csv);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to build ledger CSV." });
    }
  });

  return router;
}
