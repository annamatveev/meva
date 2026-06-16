/**
 * WorkspaceManager — binds Context Studio to an external context store
 * (Module 5). meva stores only the *connection* (location + identity), never
 * the canonical files; it holds at most a disposable working copy.
 *
 * Supports two source types:
 *   - "local"  → operate on a directory path directly (meva runs next to the
 *     files; zero second copy).
 *   - "remote" → clone a git remote into a scratch workdir and push approved
 *     `main` back on merge.
 *
 * The document layout + agent mapping are discovered from a versioned
 * `.contextstudio.yml` at the repo root, so the mapping travels with the
 * content. Falls back to the built-in agent registry when absent.
 */

import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { RegisteredAgent, WorkspaceSourceType } from "@context-studio/types";
import { db } from "../lib/db.js";
import { SERVER_ROOT } from "../lib/config.js";
import { BUILTIN_AGENTS } from "../lib/agents.js";
import { GitService, MAIN_BRANCH } from "./GitService.js";

const CONFIG_FILE = ".contextstudio.yml";

export interface WorkspaceContext {
  sourceType: WorkspaceSourceType;
  location: string;
  identity: { name: string; email: string };
  git: GitService;
  documents: string[];
  agents: RegisteredAgent[];
}

export class WorkspaceManager {
  private ctx: WorkspaceContext | null = null;

  /** Load and initialize the active workspace from the DB, if one exists. */
  async init(): Promise<void> {
    const ws = await db.workspace.findUnique({ where: { id: "default" } });
    if (ws) {
      try {
        this.ctx = await this.build({
          sourceType: ws.sourceType as WorkspaceSourceType,
          location: ws.location,
          identityName: ws.identityName,
          identityEmail: ws.identityEmail,
        });
      } catch (err) {
        console.error("[workspace] failed to initialize active workspace:", err);
        this.ctx = null;
      }
    }
  }

  current(): WorkspaceContext | null {
    return this.ctx;
  }

  /** Persist + (re)initialize the active workspace. */
  async configure(input: {
    sourceType: WorkspaceSourceType;
    location: string;
    identityName: string;
    identityEmail: string;
  }): Promise<WorkspaceContext> {
    const ctx = await this.build(input);
    await db.workspace.upsert({
      where: { id: "default" },
      update: { ...input },
      create: { id: "default", ...input },
    });
    this.ctx = ctx;
    return ctx;
  }

  /** Push approved main back to the canonical store (remote workspaces only). */
  async publishCurrent(): Promise<void> {
    if (this.ctx?.sourceType === "remote") await this.ctx.git.pushMain();
  }

  /** Re-read the document + agent mapping (e.g. after a merge changed it). */
  async refreshDiscovery(): Promise<void> {
    if (this.ctx) {
      const { documents, agents } = await this.discover(this.ctx.git);
      this.ctx.documents = documents;
      this.ctx.agents = agents;
    }
  }

  private async build(input: {
    sourceType: WorkspaceSourceType;
    location: string;
    identityName: string;
    identityEmail: string;
  }): Promise<WorkspaceContext> {
    const repoDir =
      input.sourceType === "local"
        ? path.resolve(input.location)
        : path.resolve(SERVER_ROOT, ".workspaces", "default");

    const git = new GitService(repoDir);
    if (input.sourceType === "remote") {
      await git.ensureClonedFrom(input.location);
    } else {
      await git.ensureRepo();
    }

    const { documents, agents } = await this.discover(git);
    return {
      sourceType: input.sourceType,
      location: input.location,
      identity: { name: input.identityName, email: input.identityEmail },
      git,
      documents,
      agents,
    };
  }

  /** Read .contextstudio.yml; fall back to tracked files + built-in agents. */
  private async discover(
    git: GitService,
  ): Promise<{ documents: string[]; agents: RegisteredAgent[] }> {
    const raw = await git.readDocument(MAIN_BRANCH, CONFIG_FILE);
    if (raw) {
      try {
        const parsed = parseYaml(raw) as {
          documents?: string[];
          agents?: RegisteredAgent[];
        };
        const documents = parsed.documents?.length
          ? parsed.documents
          : await git.listDocuments();
        const agents = parsed.agents?.length ? parsed.agents : BUILTIN_AGENTS;
        return { documents, agents };
      } catch (err) {
        console.error(`[workspace] invalid ${CONFIG_FILE}, using fallbacks:`, err);
      }
    }
    const documents = (await git.listDocuments()).filter((p) => p !== CONFIG_FILE);
    return { documents, agents: BUILTIN_AGENTS };
  }
}
