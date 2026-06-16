/**
 * meva demo recorder — drives the live demo and records a clean walkthrough
 * video (no shaky cursor, controlled pacing) for the landing page.
 *
 * Setup (one time):
 *   npm i -D playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node scripts/demo-video.mjs                 # records the live Pages demo
 *   DEMO_URL=http://localhost:3000 node scripts/demo-video.mjs   # local demo
 *
 * Output: scripts/out/meva-demo.webm  (+ meva-demo.mp4 if ffmpeg is installed).
 * Embed the mp4 on the landing with <video autoplay muted loop playsinline>.
 */

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "out");
const BASE = (process.env.DEMO_URL ?? "https://annamatveev.github.io/meva").replace(/\/$/, "");

const WIDTH = 1280;
const HEIGHT = 800;

const wait = (page, ms) => page.waitForTimeout(ms);

// Inject a smooth guide cursor so viewers can follow the clicks.
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
      transition: "left .65s cubic-bezier(.22,.61,.36,1), top .65s cubic-bezier(.22,.61,.36,1), opacity .3s",
    });
    document.body.appendChild(c);
  });
}

async function glide(page, locator) {
  const box = await locator.first().boundingBox();
  if (!box) return null;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(({ x, y }) => {
    const c = document.getElementById("__cursor");
    if (c) { c.style.opacity = "1"; c.style.left = x + "px"; c.style.top = y + "px"; }
  }, { x, y });
  await wait(page, 750);
  return { x, y };
}

async function smoothScrollTo(page, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
  await wait(page, 1100);
}

async function step(page, locator, { hover = false, click = false } = {}) {
  await ensureCursor(page);
  const loc = locator.first();
  try {
    await loc.scrollIntoViewIfNeeded();
    await wait(page, 300);
    await glide(page, loc);
    if (hover) await loc.hover();
    if (click) await loc.click();
    await wait(page, 900);
  } catch (e) {
    console.warn("  (skipped a step:", e.message.split("\n")[0], ")");
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

  console.log("Recording walkthrough of", BASE);

  // 1. Dashboard
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ensureCursor(page);
  await wait(page, 2000);
  await smoothScrollTo(page, 220); // context-health stats
  await wait(page, 1200);

  // 2. Open a change request
  await step(page, page.getByText("Tighten digital refund window", { exact: false }), { click: true });
  await page.waitForLoadState("networkidle");
  await ensureCursor(page);
  await wait(page, 1500);

  // 3. The semantic diff — hover a line to reveal attribution
  await step(page, page.getByText("Digital goods are refundable", { exact: false }), { hover: true });
  await wait(page, 1800);
  await smoothScrollTo(page, 320);
  await wait(page, 1200);

  // 4. Blast radius + evals (the review aside)
  await step(page, page.getByText("Blast radius", { exact: false }), { hover: true });
  await wait(page, 1600);
  await step(page, page.getByText("Context evals", { exact: false }), { hover: true });
  await wait(page, 1600);

  // 5. Acknowledge + approve
  try {
    const ack = page.getByRole("checkbox").first();
    if (await ack.isVisible()) { await glide(page, ack); await ack.check(); await wait(page, 700); }
  } catch {}
  await step(page, page.getByRole("button", { name: /Approve/ }), { click: true });
  await wait(page, 1600);

  // 6. Governance
  await step(page, page.getByRole("link", { name: "Governance" }), { click: true });
  await page.waitForLoadState("networkidle");
  await ensureCursor(page);
  await wait(page, 1800);
  await smoothScrollTo(page, 260);
  await wait(page, 1600);

  // 7. Distribution
  await step(page, page.getByRole("link", { name: "Distribution" }), { click: true });
  await page.waitForLoadState("networkidle");
  await ensureCursor(page);
  await wait(page, 1800);
  await smoothScrollTo(page, 220);
  await wait(page, 1600);

  // 8. A beat of dark mode for flair
  await step(page, page.getByRole("button", { name: /Switch to dark theme/i }), { click: true });
  await wait(page, 2200);

  await context.close();
  await browser.close();

  // Find the produced webm and normalize the name.
  const files = (await fs.readdir(OUT)).filter((f) => f.endsWith(".webm"));
  const latest = files.map((f) => path.join(OUT, f)).sort()[files.length - 1];
  const webm = path.join(OUT, "meva-demo.webm");
  if (latest && latest !== webm) await fs.rename(latest, webm);
  console.log("✓ Recorded", webm);

  // Convert to mp4 if ffmpeg is available.
  const mp4 = path.join(OUT, "meva-demo.mp4");
  const ff = spawnSync("ffmpeg", [
    "-y", "-i", webm, "-vf", "scale=1280:-2",
    "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-an",
    "-movflags", "+faststart", mp4,
  ], { stdio: "inherit" });
  if (ff.status === 0) console.log("✓ Converted", mp4);
  else console.log("ffmpeg not found — embed the .webm, or convert it manually.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
