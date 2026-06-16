/**
 * Seed script: builds a runnable demo end-to-end.
 *
 *   1. Initializes .context-repo/ as a real Git repo with a baseline policy
 *      committed to main (authored by a human Context Owner).
 *   2. Writes the attribution index for the baseline blocks.
 *   3. Opens a sample Context PR (pr-001) on a transparent draft branch with a
 *      proposed edit, plus its reviewers and computed blast radius.
 *
 * Idempotent-ish: wipes the SQLite rows and the on-disk repo first.
 */

import { promises as fs } from "node:fs";
import type { Author as DomainAuthor } from "@context-studio/types";
import { db } from "./lib/db.js";
import { CONTEXT_REPO_DIR } from "./lib/config.js";
import { computeBlastEntries } from "./lib/agents.js";
import { GitService, MAIN_BRANCH } from "./services/GitService.js";
import { blockKey, computeSemanticDiff } from "./services/SemanticDiffService.js";

const DOC_PATH = "policies/refunds.md";

const OWNER: DomainAuthor = {
  id: "user-dana",
  kind: "human",
  name: "Dana Levi",
  role: "Compliance Officer",
};

const REVIEWER_2: DomainAuthor = {
  id: "user-amir",
  kind: "human",
  name: "Amir Cohen",
  role: "Head of Support",
};

const REFUND_AGENT: DomainAuthor = {
  id: "agent-refunds",
  kind: "agent",
  name: "Refund Resolution Agent",
  role: "Autonomous agent",
};

const BASELINE = `# Refund Policy

Customers may request a refund through the support portal or by email.

## Refund Windows

Standard purchases are refundable within 30 days of delivery.

Digital goods are refundable within 14 days of purchase.

## Eligibility

Items must be unused and in original packaging to qualify for a refund.

Refunds are issued to the original payment method within 5 business days.

## Escalation

Disputed refunds are escalated to a human Support lead for review.
`;

// Proposed change (pr-001): tighten the digital window, add a workaround clause,
// and extend the escalation rule. Authored by the human owner via the UI.
const PROPOSED = `# Refund Policy

Customers may request a refund through the support portal or by email.

## Refund Windows

Standard purchases are refundable within 30 days of delivery.

Digital goods are refundable within 7 days of purchase, provided the license has not been activated.

## Eligibility

Items must be unused and in original packaging to qualify for a refund.

Refunds are issued to the original payment method within 5 business days.

## Escalation

Disputed refunds are escalated to a human Support lead for review.

Refunds above $500 require a second approver before they are issued.
`;

async function resetDb() {
  // Order matters for FK constraints.
  await db.reviewTicket.deleteMany();
  await db.blockFreshness.deleteMany();
  await db.attributionEntry.deleteMany();
  await db.blastEntry.deleteMany();
  await db.reviewer.deleteMany();
  await db.pr.deleteMany();
  await db.author.deleteMany();
}

async function main() {
  console.log("[seed] resetting database…");
  await resetDb();

  console.log("[seed] resetting on-disk context repo…");
  await fs.rm(CONTEXT_REPO_DIR, { recursive: true, force: true });

  const git = new GitService(CONTEXT_REPO_DIR);
  await git.ensureRepo();

  // --- Authors ----------------------------------------------------------
  for (const a of [OWNER, REVIEWER_2, REFUND_AGENT]) {
    await db.author.create({
      data: { id: a.id, kind: a.kind, name: a.name, role: a.role ?? null },
    });
  }

  // --- Baseline policy committed to main (pr-000, already merged) -------
  console.log("[seed] committing baseline policy to main…");
  await git.commitOnMain({
    docPath: DOC_PATH,
    content: BASELINE,
    author: OWNER,
    message: "Establish refund policy\n\nInitial authoritative refund policy.",
  });

  await db.pr.create({
    data: {
      id: "pr-000",
      title: "Establish refund policy",
      description: "Initial authoritative refund policy.",
      status: "merged",
      origin: "ui",
      documentPath: DOC_PATH,
      draftBranch: "draft/pr-000",
      authorId: OWNER.id,
    },
  });

  // Attribution index + freshness for every baseline block → pr-000 / Dana.
  // Most blocks are fresh; two are intentionally aged so the TTL worker
  // immediately demonstrates stale/expired transitions and ticket creation.
  const TTL_DAYS = 90;
  const FRESH = new Date("2026-04-02T10:00:00Z"); // staleAt ~2026-07-01 → fresh
  const STALE = new Date("2026-03-08T10:00:00Z"); // staleAt ~2026-06-06 → stale
  const EXPIRED = new Date("2026-01-27T10:00:00Z"); // staleAt+grace past → expired

  const baselineDiff = computeSemanticDiff(DOC_PATH, "", BASELINE);
  for (const block of baselineDiff.blocks) {
    const text = block.after ?? "";
    const key = blockKey(text);

    await db.attributionEntry.create({
      data: {
        documentPath: DOC_PATH,
        blockKey: key,
        mergedAt: FRESH,
        prId: "pr-000",
        prTitle: "Establish refund policy",
        authorId: OWNER.id,
      },
    });

    const reviewedAt = text.includes("Digital goods")
      ? STALE
      : text.includes("5 business days")
        ? EXPIRED
        : FRESH;
    const staleAt = new Date(reviewedAt.getTime() + TTL_DAYS * 86_400_000);

    await db.blockFreshness.create({
      data: {
        documentPath: DOC_PATH,
        blockKey: key,
        text: text.slice(0, 240),
        state: "fresh", // the worker recomputes from staleAt on its first tick
        lastReviewedAt: reviewedAt,
        ttlDays: TTL_DAYS,
        staleAt,
      },
    });
  }

  // --- Sample open Context PR (pr-001) ----------------------------------
  console.log("[seed] opening sample Context PR pr-001 on a draft branch…");
  const { branch } = await git.autosaveDraft({
    prId: "pr-001",
    docPath: DOC_PATH,
    content: PROPOSED,
    author: OWNER,
  });

  const prDiff = computeSemanticDiff(
    DOC_PATH,
    await git.readDocument(MAIN_BRANCH, DOC_PATH),
    PROPOSED,
  );
  const blast = computeBlastEntries(prDiff);

  await db.pr.create({
    data: {
      id: "pr-001",
      title: "Tighten digital refund window and add high-value approval",
      description:
        "Reduce the digital-goods refund window from 14 to 7 days (license-activation caveat) and require a second approver for refunds over $500.",
      status: "in_review",
      origin: "ui",
      documentPath: DOC_PATH,
      draftBranch: branch,
      authorId: OWNER.id,
      reviewers: {
        create: [
          { authorId: OWNER.id, decision: "pending", required: true },
          { authorId: REVIEWER_2.id, decision: "pending", required: true },
        ],
      },
      blastEntries: { create: blast },
    },
  });

  console.log("[seed] done.");
  console.log("  Sample CPR: pr-001");
  console.log(`  Blast radius: ${blast.length} agent(s) affected`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("[seed] failed:", err);
  await db.$disconnect();
  process.exit(1);
});
