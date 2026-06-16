/**
 * Governance routes (Module 4).
 *
 *   GET /api/context/governance/freshness — block freshness overview
 *   GET /api/context/governance/tickets   — open review tickets
 */

import { Router } from "express";
import type { FreshnessService } from "../services/FreshnessService.js";

export function createGovernanceRouter(freshness: FreshnessService): Router {
  const router = Router();

  router.get("/freshness", async (_req, res) => {
    try {
      res.json(await freshness.getOverview());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load freshness overview." });
    }
  });

  router.get("/tickets", async (_req, res) => {
    try {
      res.json(await freshness.listTickets());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load review tickets." });
    }
  });

  return router;
}
