import cors from "cors";
import express from "express";
import { PORT } from "./lib/config.js";
import { createPrRouter } from "./routes/pr.js";
import { createGovernanceRouter } from "./routes/governance.js";
import { createDocRouter } from "./routes/doc.js";
import { createExportRouter } from "./routes/export.js";
import { createWorkspaceRouter } from "./routes/workspace.js";
import { createDistributionRouter } from "./routes/distribution.js";
import { createHealthRouter } from "./routes/health.js";
import { createInsightsRouter } from "./routes/insights.js";
import { createSuggestionsRouter } from "./routes/suggestions.js";
import { createEvalsRouter } from "./routes/evals.js";
import { createHistoryRouter } from "./routes/history.js";
import { createAuthRouter } from "./routes/auth.js";
import { WorkspaceManager } from "./services/WorkspaceManager.js";
import { SigningService } from "./services/SigningService.js";
import { AuthService } from "./services/AuthService.js";
import { startFreshnessWorker } from "./worker.js";

async function main() {
  // The workspace binds bravo to an external context store. Until configured,
  // domain routes return 409 and the UI shows the setup wizard.
  const wm = new WorkspaceManager();
  await wm.init();
  const signing = new SigningService();
  const auth = new AuthService();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/context/auth", createAuthRouter(auth));
  app.use("/api/context/workspace", createWorkspaceRouter(wm, auth));
  app.use("/api/context/pr", createPrRouter(wm, signing, auth));
  app.use("/api/context/governance", createGovernanceRouter(wm));
  app.use("/api/context/doc", createDocRouter(wm, auth));
  app.use("/api/context/export", createExportRouter(wm));
  app.use("/api/context/distribution", createDistributionRouter(wm, signing, auth));
  app.use("/api/context/health", createHealthRouter(wm));
  app.use("/api/context/insights", createInsightsRouter(wm));
  app.use("/api/context/suggestions", createSuggestionsRouter(wm));
  app.use("/api/context/evals", createEvalsRouter(wm));
  app.use("/api/context/history", createHistoryRouter(wm));

  app.listen(PORT, () => {
    console.log(`[context-studio] server listening on http://localhost:${PORT}`);
    const ctx = wm.current();
    console.log(
      ctx
        ? `[context-studio] workspace: ${ctx.sourceType} @ ${ctx.location}`
        : "[context-studio] no workspace configured — open the setup wizard",
    );
  });

  // Module 4: the TTL worker flags stale context and opens review tickets,
  // operating against whatever workspace is currently bound.
  startFreshnessWorker(wm);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
