import cors from "cors";
import express from "express";
import { CONTEXT_REPO_DIR, PORT } from "./lib/config.js";
import { createPrRouter } from "./routes/pr.js";
import { createGovernanceRouter } from "./routes/governance.js";
import { createDocRouter } from "./routes/doc.js";
import { createExportRouter } from "./routes/export.js";
import { GitService } from "./services/GitService.js";
import { FreshnessService } from "./services/FreshnessService.js";
import { startFreshnessWorker } from "./worker.js";

async function main() {
  const git = new GitService(CONTEXT_REPO_DIR);
  await git.ensureRepo();

  const freshness = new FreshnessService(git);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/context/pr", createPrRouter(git));
  app.use("/api/context/governance", createGovernanceRouter(freshness));
  app.use("/api/context/doc", createDocRouter(git));
  app.use("/api/context/export", createExportRouter(git));

  app.listen(PORT, () => {
    console.log(`[context-studio] server listening on http://localhost:${PORT}`);
    console.log(`[context-studio] context repo: ${CONTEXT_REPO_DIR}`);
  });

  // Module 4: the TTL worker flags stale context and opens review tickets.
  startFreshnessWorker(freshness);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
