# Demo page (public, no backend)

A self-contained demo of the bravo UI. With `NEXT_PUBLIC_DEMO=1`, the web app
serves **sample data** and **simulates writes** instead of calling the backend —
no server, no git, no database. Nothing persists; every reload resets. Safe to
host publicly or embed next to the landing page.

A "Demo" banner is shown and a demo **Owner** is auto-signed-in, so every
capability (review, approve, publish, edit) is visible without a login step.

## Run locally

```bash
NEXT_PUBLIC_DEMO=1 pnpm --filter @context-studio/web dev
# → http://localhost:3000  (no server needed)
```

## Deploy to GitHub Pages (free, automated)

A workflow (`.github/workflows/deploy-demo.yml`) builds a **static export** and
publishes it to Pages on every push to `main`.

One-time setup:
1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main` (or run the workflow manually from the Actions tab).
3. The demo goes live at **`https://<owner>.github.io/bravo/`**
   (for this repo: `https://annamatveev.github.io/bravo/`).

How it's built: `STATIC_EXPORT=1 NEXT_PUBLIC_DEMO=1 NEXT_PUBLIC_BASE_PATH=/bravo
pnpm --filter @context-studio/web build` → `apps/web/out/`. The `basePath` is
`/bravo` because a project repo is served from a subpath. If you rename the repo
or use a custom domain, update `NEXT_PUBLIC_BASE_PATH` in the workflow (set it
to empty for a custom domain / user-root page).

To preview the static export locally:

```bash
STATIC_EXPORT=1 NEXT_PUBLIC_DEMO=1 NEXT_PUBLIC_BASE_PATH=/bravo \
  pnpm --filter @context-studio/web build
npx serve apps/web/out   # then open http://localhost:3000/bravo/
```

## Or deploy to Vercel

The demo is also just the Next.js app with `NEXT_PUBLIC_DEMO=1` (no `basePath`
needed): import the repo, set root to `apps/web`, add that env var, deploy.

(Because demo mode never calls the backend, the usual constraint — the server
needs git + a disk — doesn't apply here. That's only for the *real* app.)

## Record a walkthrough video (for the landing page)

`scripts/demo-video.mjs` drives the demo with Playwright and records a clean,
guided walkthrough (smooth guide-cursor, controlled pacing) — repeatable and
always in sync with the app.

```bash
npm i -D playwright
npx playwright install chromium
node scripts/demo-video.mjs                 # records the live Pages demo
# DEMO_URL=http://localhost:3000 node scripts/demo-video.mjs   # local demo
```

Output: `scripts/out/bravo-demo.webm` (+ `bravo-demo.mp4` if `ffmpeg` is
installed). Embed on the landing with:

```html
<video src="/bravo-demo.mp4" autoplay muted loop playsinline></video>
```

## What's mocked

Reads return fixtures (a sample refund-policy CPR with a semantic diff + blast
radius, the governance overview + tickets, a published distribution bundle,
evals). Writes (approve / propose / publish / configure) resolve as simulated
success — they don't persist. Export/download links are inert in demo.
