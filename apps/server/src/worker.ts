/**
 * TTL worker — the background process behind Module 4.
 *
 * Re-evaluates block freshness on an interval, transitioning blocks
 * fresh → stale → expired (and conflicted), and auto-opening review tickets.
 * In production this would be a cron / queue job; here it's an in-process timer
 * so the prototype is self-contained.
 */

import { WORKER_INTERVAL_MS } from "./lib/config.js";
import type { FreshnessService } from "./services/FreshnessService.js";

export function startFreshnessWorker(freshness: FreshnessService): () => void {
  let running = false;

  const tick = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const { transitioned, ticketsOpened } = await freshness.evaluate();
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
