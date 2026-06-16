/**
 * ExportService — emits the authoritative context (main branch) into the
 * machine-readable formats agents consume (Module 3).
 *
 *   - llms.txt: a single concatenated, agent-friendly text file.
 *   - .fcontext: a directory manifest (JSON) pairing each block with its
 *     attribution and freshness, so downstream tooling can reason about trust.
 */

import { db } from "../lib/db.js";
import { GitService, MAIN_BRANCH } from "./GitService.js";
import { blockKey, computeSemanticDiff } from "./SemanticDiffService.js";

export interface FcontextManifest {
  generatedAt: string;
  source: "context-studio";
  documents: Array<{
    path: string;
    blocks: Array<{
      text: string;
      blockType: string;
      freshness?: string;
      author?: { name: string; kind: string };
      sourcePrId?: string;
    }>;
  }>;
}

export class ExportService {
  constructor(private readonly git: GitService) {}

  /** Build a single llms.txt from every document on main. */
  async buildLlmsTxt(): Promise<string> {
    const docs = await this.git.listDocuments(MAIN_BRANCH);
    const stamp = new Date().toISOString();
    const parts: string[] = [
      "# Context Studio export",
      `# Generated ${stamp} from the authoritative (main) context state.`,
      "",
    ];
    for (const path of docs) {
      const content = await this.git.readDocument(MAIN_BRANCH, path);
      parts.push(`## ${path}`, "", content.trim(), "");
    }
    return parts.join("\n");
  }

  /** Build a .fcontext manifest with attribution + freshness per block. */
  async buildFcontext(): Promise<FcontextManifest> {
    const docs = await this.git.listDocuments(MAIN_BRANCH);
    const documents: FcontextManifest["documents"] = [];

    for (const path of docs) {
      const content = await this.git.readDocument(MAIN_BRANCH, path);
      const blocks = computeSemanticDiff(path, "", content).blocks;

      const attrib = await db.attributionEntry.findMany({
        where: { documentPath: path },
        include: { author: true },
      });
      const attribByKey = new Map(attrib.map((a) => [a.blockKey, a]));
      const fresh = await db.blockFreshness.findMany({ where: { documentPath: path } });
      const freshByKey = new Map(fresh.map((f) => [f.blockKey, f]));

      documents.push({
        path,
        blocks: blocks.map((b) => {
          const text = b.after ?? "";
          const key = blockKey(text);
          const a = attribByKey.get(key);
          const f = freshByKey.get(key);
          return {
            text,
            blockType: b.blockType,
            freshness: f?.state,
            author: a ? { name: a.author.name, kind: a.author.kind } : undefined,
            sourcePrId: a?.prId,
          };
        }),
      });
    }

    return { generatedAt: new Date().toISOString(), source: "context-studio", documents };
  }
}
