/**
 * meva-context — load a published context slice into your agent (Module 9).
 *
 * After `agent-sync.mjs` has pulled + verified a bundle into a directory, this
 * reads that slice and hands it to whatever framework your agent runs in.
 * Zero dependencies — works with the OpenAI/Anthropic SDKs, LangChain,
 * LlamaIndex, Mastra, the Vercel AI SDK, or anything that takes a system prompt.
 *
 *   import { mevaSystemMessage } from "./meva-context.mjs";
 *   const sys = await mevaSystemMessage("/srv/agents/refunds/context");
 *
 *   // OpenAI / Anthropic / Vercel AI SDK:
 *   messages: [sys, { role: "user", content: question }]
 *
 *   // LangChain:
 *   new SystemMessage(sys.content)
 */

import { promises as fs } from "node:fs";
import path from "node:path";

/** Read the synced slice: its llms.txt text and the bundle version stamp. */
export async function loadMevaContext(dir) {
  const text = await fs.readFile(path.join(dir, "llms.txt"), "utf8");
  let version = null;
  try {
    version = (await fs.readFile(path.join(dir, ".version"), "utf8")).split("\n")[0].trim();
  } catch {
    /* no version stamp */
  }
  return { text, version };
}

/** A ready-to-use system message that grounds an agent in the context. */
export async function mevaSystemMessage(dir) {
  const { text, version } = await loadMevaContext(dir);
  return {
    role: "system",
    content:
      `You operate on the following authoritative, human-approved context ` +
      `(meva bundle ${version ?? "unknown"}). Treat it as ground truth; if it ` +
      `doesn't cover something, say so rather than guessing.\n\n${text}`,
  };
}
