/**
 * Outbound webhook notifications (Module 9 — "Connections").
 *
 * Fire-and-forget POST to a configured webhook on key events. If the URL is a
 * Slack incoming webhook, send Slack's `{ text }` shape; otherwise send a
 * structured JSON event (with a human `text` summary) that any endpoint can
 * consume. No external SDK, no credentials beyond the URL.
 */

import { WEBHOOK_URL } from "./config.js";

export type NotifyEvent =
  | { kind: "pr_opened"; prId: string; title: string; author: string; origin: "ui" | "agent" }
  | { kind: "pr_merged"; prId: string; title: string }
  | { kind: "ticket_opened"; documentPath: string; reason: string };

function summarize(e: NotifyEvent): string {
  switch (e.kind) {
    case "pr_opened":
      return `📝 Context PR opened: “${e.title}” (${e.prId}) by ${e.author}${e.origin === "agent" ? " — via agent" : ""}`;
    case "pr_merged":
      return `✅ Context PR merged: “${e.title}” (${e.prId}) — published to agents`;
    case "ticket_opened":
      return `⏰ Review ticket: ${e.documentPath} — ${e.reason}`;
  }
}

/** Best-effort: never throws, never blocks the request path (call with void). */
export async function notify(event: NotifyEvent): Promise<void> {
  if (!WEBHOOK_URL) return;
  const text = summarize(event);
  const isSlack = /hooks\.slack\.com/.test(WEBHOOK_URL);
  const body = isSlack ? { text } : { text, ...event };
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[notify] webhook failed:", err);
  }
}
