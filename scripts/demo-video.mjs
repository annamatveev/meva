/**
 * meva demo recorder — drives the live demo and records a short, punchy
 * walkthrough video (~10s) for the landing page. Smooth guide-cursor,
 * controlled pacing, repeatable, always in sync with the app.
 *
 * Setup (one time):
 *   npm i -D playwright            # already a devDependency
 *   npx playwright install chromium
 *
 * Run:
 *   node scripts/demo-video.mjs                                   # live Pages demo
 *   DEMO_URL=http://localhost:3000 node scripts/demo-video.mjs    # local demo
 *   PACE=0.8 node scripts/demo-video.mjs                          # 20% faster
 *
 * Output: scripts/out/meva-demo.webm  (+ meva-demo.mp4, hard-capped at MAX_SECONDS).
 * Embed: <video src="/meva-demo.mp4" autoplay muted loop playsinline>
 */

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");
const BASE = (process.env.DEMO_URL ?? "https://annamatveev.github.io/meva").replace(/\/$/, "");
const PACE = Number(process.env.PACE ?? 0.8); // global timing multiplier (<1 = faster)
const MAX_SECONDS = Number(process.env.MAX_SECONDS ?? 10); // hard cap on the mp4

const WIDTH = 1280;
const HEIGHT = 800;

const wait = (page, ms) => page.waitForTimeout(Math.round(ms * PACE));

async function ensureCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById("__cursor")) return;
    const c = document.createElement("div");
    c.id = "__cursor";
    Object.assign(c.style, {
      position: "fixed", width: "18px", height: "18px", borderRadius: "50%",
      background: "rgba(76,99,182,0.9)", boxShadow: "0 0 0 5px rgba(76,99,182,0.22)",
      zIndex: "99999", pointerEvents: "none", transform: "translate(-50%,-50%)",
      left: "50%", top: "42%", opacity: "0",
      transition: "left .35s cubic-bezier(.22,.61,.36,1), top .35s cubic-bezier(.22,.61,.36,1), opacity .2s",
    });
    document.body.appendChild(c);
  });
}

async function glide(page, locator) {
  const box = await locator.first().boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(({ x, y }) => {
    const c = document.getElementById("__cursor");
    if (c) { c.style.opacity = "1"; c.style.left = x + "px"; c.style.top = y + "px"; }
  }, { x, y });
  await wait(page, 380);
}

async function scrollTo(page, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
  await wait(page, 550);
}

async function step(page, locator, { hover = false, click = false, dwell = 600 } = {}) {
  await ensureCursor(page);
  const loc = locator.first();
  try {
    await loc.scrollIntoViewIfNeeded();
    await glide(page, loc);
    if (hover) await loc.hover();
    if (click) await loc.click();
    await wait(page, dwell);
  } catch (e) {
    console.warn("  (skipped:", e.message.split("\n")[0], ")");
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();
  console.log("Recording ~", MAX_SECONDS, "s walkthrough of", BASE);

  // Story: the queue & health → review a change (diff, who's affected, checks)
  // → approve → it's published, signed, to your agents.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ensureCursor(page);
  await wait(page, 850);

  // 1. Context health snapshot (fresh / stale / expired)
  await step(page, page.getByText("Context health", { exact: false }), { dwell: 750 });

  // 2. Open a change request
  await step(page, page.getByText("Tighten digital refund window", { exact: false }), { click: true, dwell: 250 });
  await page.waitForLoadState("networkidle");
  await ensureCursor(page);
  await wait(page, 450);

  // 3. The semantic diff — hover the edited line to reveal who wrote it
  await step(page, page.getByText("Digital goods are refundable", { exact: false }), { hover: true, dwell: 1100 });

  // 4. Blast radius — which agents this change affects
  await step(page, page.getByText("Blast radius", { exact: false }), { hover: true, dwell: 950 });

  // 5. Evals — automated checks that gate the merge
  await step(page, page.getByText("Context evals", { exact: false }), { hover: true, dwell: 850 });

  // 6. Acknowledge + approve
  try {
    const ack = page.getByRole("checkbox").first();
    if (await ack.isVisible()) { await glide(page, ack); await ack.check(); }
  } catch {}
  await step(page, page.getByRole("button", { name: /Approve/ }), { click: true, dwell: 850 });

  // 7. Published — signed, per-agent bundle
  await step(page, page.getByRole("link", { name: "Distribution" }), { click: true, dwell: 250 });
  await page.waitForLoadState("networkidle");
  await ensureCursor(page);
  await wait(page, 1500);

  await context.close();
  await browser.close();

  const files = (await fs.readdir(OUT)).filter((f) => f.endsWith(".webm"));
  const latest = files.map((f) => path.join(OUT, f)).sort()[files.length - 1];
  const webm = path.join(OUT, "meva-demo.webm");
  if (latest && latest !== webm) await fs.rename(latest, webm);
  console.log("done:", webm);

  // Convert + hard-cap at MAX_SECONDS so the landing clip is never longer.
  const mp4 = path.join(OUT, "meva-demo.mp4");
  const ff = spawnSync("ffmpeg", [
    "-y", "-i", webm, "-t", String(MAX_SECONDS), "-vf", "scale=1280:-2",
    "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-an",
    "-movflags", "+faststart", mp4,
  ], { stdio: "inherit" });
  if (ff.status === 0) console.log(`done: ${mp4} (<= ${MAX_SECONDS}s)`);
  else console.log("ffmpeg not found - convert/trim the .webm manually (target <= " + MAX_SECONDS + "s).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
