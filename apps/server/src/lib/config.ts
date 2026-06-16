import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/server root (two levels up from src/lib).
export const SERVER_ROOT = path.resolve(__dirname, "..", "..");

export const PORT = Number(process.env.PORT ?? 4000);

export const CONTEXT_REPO_DIR = path.resolve(
  SERVER_ROOT,
  process.env.CONTEXT_REPO_DIR ?? ".context-repo",
);

// --- Freshness / governance (Module 4) -----------------------------------

/** Default Time-To-Live for a context block before it is flagged stale. */
export const DEFAULT_TTL_DAYS = Number(process.env.CONTEXT_TTL_DAYS ?? 90);

/** Grace period after going stale before a block is considered expired. */
export const EXPIRED_GRACE_DAYS = Number(process.env.CONTEXT_EXPIRED_GRACE_DAYS ?? 30);

/** How often the TTL worker re-evaluates freshness (ms). */
export const WORKER_INTERVAL_MS = Number(process.env.CONTEXT_WORKER_INTERVAL_MS ?? 20_000);

// --- Distribution / signing (Module 6) -----------------------------------

/** Where signed per-agent context bundles are published (the channel). */
export const DIST_DIR = path.resolve(
  SERVER_ROOT,
  process.env.CONTEXT_DIST_DIR ?? ".dist",
);

/** Where the ed25519 signing keypair is stored (private key, gitignored). */
export const SIGNING_DIR = path.resolve(
  SERVER_ROOT,
  process.env.CONTEXT_SIGNING_DIR ?? ".signing",
);

// --- Notifications (Module 9) --------------------------------------------

/** Optional outbound webhook for events. A Slack incoming-webhook URL works. */
export const WEBHOOK_URL = process.env.CONTEXT_WEBHOOK_URL ?? "";
