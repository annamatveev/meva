/**
 * Governance routes (Module 4).
 *
 *   GET /api/context/governance/freshness — block freshness overview
 *   GET /api/context/governance/tickets   — open review tickets
 */

import { Router } from "express";
import { FreshnessService } from "../services/FreshnessService.js";
import type { WorkspaceManager } from "../services/WorkspaceManager.js";

export function createGovernanceRouter(wm: WorkspaceManager): Router {
  const router = Router();

  router.get("/freshness", async (_req, res) => {
    const ctx = wm.current();
    if (!ctx) {
      res.status(409).json({ error: "No workspace configured.", code: "NO_WORKSPACE" });
      return;
    }
    try {
      res.json(await new FreshnessService(ctx.git).getOverview());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load freshness overview." });
    }
  });

  router.get("/tickets", async (_req, res) => {
    const ctx = wm.current();
    if (!ctx) {
      res.status(409).json({ error: "No workspace configured.", code: "NO_WORKSPACE" });
      return;
    }
    try {
      res.json(await new FreshnessService(ctx.git).listTickets());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load review tickets." });
    }
  });

  return router;
}
