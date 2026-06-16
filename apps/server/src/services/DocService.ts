/**
 * DocService — the editing side of Module 3.
 *
 * Editing is transparent: the first autosave opens a hidden `draft` Context PR
 * (and its Git draft branch); subsequent autosaves commit to it. "Propose
 * change" promotes that draft to `in_review` with a computed blast radius.
 * The user never sees a branch or a commit.
 */

import type {
  Attribution,
  AutosaveResponse,
  DocumentView,
  RegisteredAgent,
} from "@context-studio/types";
import { db } from "../lib/db.js";
import { BUILTIN_AGENTS, computeBlastEntries } from "../lib/agents.js";
import { GitService, MAIN_BRANCH } from "./GitService.js";
import { blockKey, computeSemanticDiff } from "./SemanticDiffService.js";

export class DocNotFoundError extends Error {}
export class DraftNotFoundError extends Error {}

export class DocService {
  constructor(
    private readonly git: GitService,
    private readonly agents: RegisteredAgent[] = BUILTIN_AGENTS,
  ) {}

  /** Document content + per-block attribution + the user's open draft, if any. */
  async getDocumentView(documentPath: string, actingUserId: string): Promise<DocumentView> {
    const content = await this.git.readDocument(MAIN_BRANCH, documentPath);
    if (!content) throw new DocNotFoundError(`Document ${documentPath} not found`);

    const blocks = computeSemanticDiff(documentPath, "", content).blocks;
    const index = await db.attributionEntry.findMany({
      where: { documentPath },
      include: { author: true },
    });
    const byKey = new Map(index.map((e) => [e.blockKey, e]));

    const attributions = blocks.map((b) => {
      const key = blockKey(b.after ?? "");
      const hit = byKey.get(key);
      const attribution: Attribution | undefined = hit
        ? {
            author: {
              id: hit.author.id,
              kind: hit.author.kind as "human" | "agent",
              name: hit.author.name,
            },
            mergedAt: hit.mergedAt.toISOString(),
            prId: hit.prId,
            prTitle: hit.prTitle,
          }
        : undefined;
      return { blockKey: key, attribution };
    });

    const draft = await db.pr.findFirst({
      where: { documentPath, authorId: actingUserId, status: "draft" },
    });

    return { documentPath, content, attributions, draftPrId: draft?.id };
  }

  /** Transparent autosave — opens or reuses the user's draft PR for this doc. */
  async autosave(params: {
    documentPath: string;
    content: string;
    authorId: string;
  }): Promise<AutosaveResponse> {
    const { documentPath, content, authorId } = params;
    const author = await db.author.findUnique({ where: { id: authorId } });
    if (!author) throw new DraftNotFoundError(`Author ${authorId} not found`);

    let draft = await db.pr.findFirst({
      where: { documentPath, authorId, status: "draft" },
    });

    const prId = draft?.id ?? `pr-draft-${authorId}-${documentPath.replace(/[^a-z0-9]+/gi, "-")}`;

    const { branch } = await this.git.autosaveDraft({
      prId,
      docPath: documentPath,
      content,
      author: { id: author.id, kind: author.kind as "human" | "agent", name: author.name },
    });

    if (!draft) {
      draft = await db.pr.create({
        data: {
          id: prId,
          title: `Draft edits to ${documentPath}`,
          description: "Work in progress.",
          status: "draft",
          origin: "ui",
          documentPath,
          draftBranch: branch,
          authorId,
        },
      });
    } else {
      await db.pr.update({ where: { id: prId }, data: { updatedAt: new Date() } });
    }

    return { draftPrId: prId, savedAt: new Date().toISOString() };
  }

  /** Promote a draft to an in-review Context PR with a computed blast radius. */
  async propose(params: {
    draftPrId: string;
    title: string;
    description: string;
  }): Promise<{ prId: string }> {
    const { draftPrId, title, description } = params;
    const draft = await db.pr.findUnique({ where: { id: draftPrId } });
    if (!draft) throw new DraftNotFoundError(`Draft ${draftPrId} not found`);

    const before = await this.git.readDocument(MAIN_BRANCH, draft.documentPath);
    const after = await this.git.readDocument(draft.draftBranch, draft.documentPath);
    const diff = computeSemanticDiff(draft.documentPath, before, after);
    const blast = computeBlastEntries(diff, this.agents);

    const owner = await db.author.findFirst({
      where: { kind: "human", NOT: { id: draft.authorId } },
    });
    const fallbackOwner = owner ?? (await db.author.findFirst({ where: { kind: "human" } }));

    await db.pr.update({
      where: { id: draftPrId },
      data: {
        title,
        description,
        status: "in_review",
        blastEntries: { create: blast },
        reviewers: fallbackOwner
          ? { create: [{ authorId: fallbackOwner.id, decision: "pending", required: true }] }
          : undefined,
      },
    });

    return { prId: draftPrId };
  }
}
