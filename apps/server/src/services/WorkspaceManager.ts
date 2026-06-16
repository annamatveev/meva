/**
 * WorkspaceManager — binds bravo to one or more typed sources (context / skills
 * / memory / custom), each its own repo or a shared one. bravo stores only the
 * connections (kind + location + identity), never the canonical files.
 *
 * The "primary" source (a `context` source, else the first) backs the current
 * editing/PR operations; all sources are tracked + surfaced. Per-type authoring
 * across every source lands with the MCP phase.
 *
 * Document layout + agent mapping are discovered from a versioned `.bravo.yml`
 * (or legacy `.contextstudio.yml`) at the primary repo root.
 */

import path from "node:path";
import { parse as parseYaml } from "yaml";
import type {
  EvalCase,
  RegisteredAgent,
  WorkspaceSource,
  WorkspaceSourceType,
} from "@context-studio/types";
import { db } from "../lib/db.js";
import { SERVER_ROOT } from "../lib/config.js";
import { BUILTIN_AGENTS } from "../lib/agents.js";
import { GitService, MAIN_BRANCH } from "./GitService.js";

const CONFIG_FILES = [".bravo.yml", ".contextstudio.yml"];

export interface WorkspaceContext {
  sourceType: WorkspaceSourceType; // primary
  location: string; // primary
  sources: WorkspaceSource[];
  identity: { name: string; email: string };
  git: GitService; // primary source's repo
  documents: string[];
  agents: RegisteredAgent[];
  evals: EvalCase[];
}

interface ConfigureInput {
  identityName: string;
  identityEmail: string;
  sources: Array<{ kind: string; sourceType: WorkspaceSourceType; location: string }>;
}

function pickPrimary<T extends { kind: string }>(sources: T[]): T {
  const primary = sources.find((s) => s.kind === "context") ?? sources[0];
  if (!primary) throw new Error("Workspace has no sources.");
  return primary;
}

export class WorkspaceManager {
  private ctx: WorkspaceContext | null = null;

  async init(): Promise<void> {
    const ws = await db.workspace.findUnique({
      where: { id: "default" },
      include: { sources: true },
    });
    if (!ws) return;
    const sources = ws.sources.length
      ? ws.sources.map((s) => ({ id: s.id, kind: s.kind, sourceType: s.sourceType as WorkspaceSourceType, location: s.location }))
      : [{ id: "primary", kind: "context", sourceType: ws.sourceType as WorkspaceSourceType, location: ws.location }];
    try {
      this.ctx = await this.build(
        { name: ws.identityName, email: ws.identityEmail },
        sources,
      );
    } catch (err) {
      console.error("[workspace] failed to initialize active workspace:", err);
      this.ctx = null;
    }
  }

  current(): WorkspaceContext | null {
    return this.ctx;
  }

  /** Persist + (re)initialize the active workspace. */
  async configure(input: ConfigureInput): Promise<WorkspaceContext> {
    if (!input.sources.length) throw new Error("At least one source is required.");
    const primary = pickPrimary(input.sources);

    const ctx = await this.build(
      { name: input.identityName, email: input.identityEmail },
      input.sources.map((s, i) => ({ id: `s${i}`, ...s })),
    );

    await db.workspace.upsert({
      where: { id: "default" },
      update: {
        sourceType: primary.sourceType,
        location: primary.location,
        identityName: input.identityName,
        identityEmail: input.identityEmail,
      },
      create: {
        id: "default",
        sourceType: primary.sourceType,
        location: primary.location,
        identityName: input.identityName,
        identityEmail: input.identityEmail,
      },
    });
    await db.workspaceSource.deleteMany({ where: { workspaceId: "default" } });
    await db.workspaceSource.createMany({
      data: input.sources.map((s) => ({
        kind: s.kind,
        sourceType: s.sourceType,
        location: s.location,
        workspaceId: "default",
      })),
    });

    this.ctx = ctx;
    return ctx;
  }

  async publishCurrent(): Promise<void> {
    if (this.ctx?.sourceType === "remote") await this.ctx.git.pushMain();
  }

  async refreshDiscovery(): Promise<void> {
    if (this.ctx) {
      const { documents, agents, evals } = await this.discover(this.ctx.git);
      this.ctx.documents = documents;
      this.ctx.agents = agents;
      this.ctx.evals = evals;
    }
  }

  private async build(
    identity: { name: string; email: string },
    sources: WorkspaceSource[],
  ): Promise<WorkspaceContext> {
    const primary = pickPrimary(sources);
    const repoDir =
      primary.sourceType === "local"
        ? path.resolve(primary.location)
        : path.resolve(SERVER_ROOT, ".workspaces", "default");

    const git = new GitService(repoDir);
    if (primary.sourceType === "remote") await git.ensureClonedFrom(primary.location);
    else await git.ensureRepo();

    const { documents, agents, evals } = await this.discover(git);
    return {
      sourceType: primary.sourceType,
      location: primary.location,
      sources,
      identity,
      git,
      documents,
      agents,
      evals,
    };
  }

  private async discover(
    git: GitService,
  ): Promise<{ documents: string[]; agents: RegisteredAgent[]; evals: EvalCase[] }> {
    for (const file of CONFIG_FILES) {
      const raw = await git.readDocument(MAIN_BRANCH, file);
      if (!raw) continue;
      try {
        const parsed = parseYaml(raw) as {
          documents?: string[];
          agents?: RegisteredAgent[];
          evals?: EvalCase[];
        };
        const documents = parsed.documents?.length ? parsed.documents : await git.listDocuments();
        const agents = parsed.agents?.length ? parsed.agents : BUILTIN_AGENTS;
        return { documents, agents, evals: parsed.evals ?? [] };
      } catch (err) {
        console.error(`[workspace] invalid ${file}, using fallbacks:`, err);
      }
    }
    const documents = (await git.listDocuments()).filter((p) => !CONFIG_FILES.includes(p));
    return { documents, agents: BUILTIN_AGENTS, evals: [] };
  }
}
