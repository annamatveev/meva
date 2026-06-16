/**
 * TTL worker — the background process behind Module 4.
 *
 * Re-evaluates block freshness on an interval, transitioning blocks
 * fresh → stale → expired (and conflicted), and auto-opening review tickets.
 * Operates against whatever workspace is currently bound; no-ops when none is.
 * In production this would be a cron / queue job; here it's an in-process timer
 * so the prototype is self-contained.
 */

import { WORKER_INTERVAL_MS } from "./lib/config.js";
import { FreshnessService } from "./services/FreshnessService.js";
import type { WorkspaceManager } from "./services/WorkspaceManager.js";

export function startFreshnessWorker(wm: WorkspaceManager): () => void {
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap runs
    const ctx = wm.current();
    if (!ctx) return; // no workspace bound yet
    running = true;
    try {
      const { transitioned, ticketsOpened } = await new FreshnessService(ctx.git).evaluate();
      if (transitioned || ticketsOpened) {
        console.log(
          `[worker] freshness: ${transitioned} block(s) transitioned, ${ticketsOpened} ticket(s) opened`,
        );
      }
    } catch (err) {
      console.error("[worker] freshness evaluation failed:", err);
    } finally {
      running = false;
    }
  };

  void tick(); // run once at startup
  const handle = setInterval(tick, WORKER_INTERVAL_MS);
  handle.unref?.();
  return () => clearInterval(handle);
}
