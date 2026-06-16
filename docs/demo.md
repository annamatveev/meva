# Demo page (public, no backend)

A self-contained demo of the meva UI. With `NEXT_PUBLIC_DEMO=1`, the web app
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

## Deploy (free)

The demo is just the Next.js web app with one env var, so it deploys to any
Next host — **Vercel** is simplest (the Express backend is NOT deployed):

1. Import the repo in Vercel; set the project root to `apps/web`.
2. Add env var **`NEXT_PUBLIC_DEMO=1`**.
3. Deploy. Share the URL, or `<iframe>` it into the landing's "Live preview".

(Because demo mode never calls the backend, the usual constraint — the server
needs git + a disk — doesn't apply here. That's only for the *real* app.)

## What's mocked

Reads return fixtures (a sample refund-policy CPR with a semantic diff + blast
radius, the governance overview + tickets, a published distribution bundle,
evals). Writes (approve / propose / publish / configure) resolve as simulated
success — they don't persist. Export/download links are inert in demo.
