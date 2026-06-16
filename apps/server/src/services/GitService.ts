/**
 * GitService — the ONLY module in Context Studio that knows Git exists.
 *
 * It wraps `simple-git` and exposes domain-shaped operations. Everything above
 * it (routes, UI) speaks in Context PRs and documents, never branches/commits.
 *
 * Module 1 (Abstracted Version Control Backend) lives here:
 *   - editing a document transparently creates a `draft/<pr>` branch;
 *   - approving squash-merges all autosaves into one semantic commit on main
 *     and deletes the draft branch.
 */

import { promises as fs, mkdirSync } from "node:fs";
import path from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import type { Author } from "@context-studio/types";

export const MAIN_BRANCH = "main";

function draftBranchName(prId: string): string {
  return `draft/${prId}`;
}

function gitIdentity(author: Author): { name: string; email: string } {
  const slug = author.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  // Agents get a clearly-marked, namespaced identity in the Git history.
  const domain = author.kind === "agent" ? "agents.context.studio" : "context.studio";
  return { name: author.name, email: `${slug}@${domain}` };
}

export class GitService {
  private readonly git: SimpleGit;

  constructor(private readonly repoDir: string) {
    // simple-git refuses to construct against a non-existent directory.
    mkdirSync(repoDir, { recursive: true });
    this.git = simpleGit({ baseDir: repoDir });
  }

  /** Create the repo on disk with an empty `main` if it does not yet exist. */
  async ensureRepo(): Promise<void> {
    await fs.mkdir(this.repoDir, { recursive: true });
    // Check whether THIS directory is its own repo root. Plain checkIsRepo()
    // would walk up and falsely match an enclosing repo (the monorepo itself),
    // since .context-repo lives inside it.
    const isRepoRoot = await this.git.checkIsRepo("root" as any).catch(() => false);
    if (isRepoRoot) return;

    // `-b main` makes the initial branch deterministic regardless of the host's
    // git `init.defaultBranch`. Fall back to a plain init on older git.
    try {
      await this.git.raw(["init", "-b", MAIN_BRANCH]);
    } catch {
      await this.git.init();
    }
    await this.git.addConfig("user.name", "Context Studio");
    await this.git.addConfig("user.email", "system@context.studio");
    // Empty root commit so branching always has a base. (raw avoids simple-git's
    // undefined-files pitfall, which silently produces no commit.)
    await this.git.raw([
      "commit",
      "--allow-empty",
      "-m",
      "chore: initialize context repository",
    ]);
    // Normalize the branch name to main even if init fell back to master.
    const current = (await this.git.branch()).current;
    if (current && current !== MAIN_BRANCH) {
      await this.git.raw(["branch", "-M", MAIN_BRANCH]);
    }
  }

  private async ensureOnBranch(branch: string): Promise<void> {
    const current = (await this.git.branch()).current;
    if (current !== branch) await this.git.checkout(branch);
  }

  /**
   * Commit a document directly onto main. Used by seeding/bootstrap to establish
   * the authoritative baseline; normal edits go through autosaveDraft + merge.
   */
  async commitOnMain(params: {
    docPath: string;
    content: string;
    author: Author;
    message: string;
  }): Promise<{ commit: string }> {
    const { docPath, content, author, message } = params;
    await this.ensureOnBranch(MAIN_BRANCH);

    const abs = path.join(this.repoDir, docPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    await this.git.add(docPath);

    const id = gitIdentity(author);
    await this.git.commit(message, [docPath], {
      "--author": `${id.name} <${id.email}>`,
    });
    const head = await this.git.revparse(["HEAD"]);
    return { commit: head.trim() };
  }

  /** Read a document's content at a given branch. Returns "" if absent. */
  async readDocument(branch: string, docPath: string): Promise<string> {
    try {
      return await this.git.show([`${branch}:${docPath}`]);
    } catch {
      return "";
    }
  }

  /** Clone a remote into this working dir (no-op if already a repo here). */
  async ensureClonedFrom(remoteUrl: string): Promise<void> {
    const isRepoRoot = await this.git.checkIsRepo("root" as any).catch(() => false);
    if (isRepoRoot) {
      await this.git.fetch().catch(() => {});
      return;
    }
    await this.git.raw(["clone", remoteUrl, "."]);
    await this.git.addConfig("user.name", "Context Studio");
    await this.git.addConfig("user.email", "system@context.studio");
    await this.ensureOnBranch(MAIN_BRANCH);
  }

  /** Push the approved main back to the canonical remote (remote workspaces). */
  async pushMain(): Promise<void> {
    await this.git.push(["origin", MAIN_BRANCH]);
  }

  /** List every document path tracked on a branch (default main). */
  async listDocuments(branch: string = MAIN_BRANCH): Promise<string[]> {
    try {
      const out = await this.git.raw(["ls-tree", "-r", "--name-only", branch]);
      return out.split("\n").map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Transparent autosave: ensure the PR's draft branch exists (creating it from
   * main on first edit — the equivalent of `git checkout -b`), write the new
   * content, and commit it as an incremental autosave. The user just sees
   * "saved".
   */
  async autosaveDraft(params: {
    prId: string;
    docPath: string;
    content: string;
    author: Author;
  }): Promise<{ branch: string }> {
    const { prId, docPath, content, author } = params;
    const branch = draftBranchName(prId);

    const branches = await this.git.branchLocal();
    if (branches.all.includes(branch)) {
      await this.git.checkout(branch);
    } else {
      // First edit on this PR: create the draft branch off main, invisibly.
      await this.git.checkoutBranch(branch, MAIN_BRANCH);
    }

    const abs = path.join(this.repoDir, docPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    await this.git.add(docPath);

    const id = gitIdentity(author);
    await this.git.commit(`autosave: ${docPath}`, [docPath], {
      "--author": `${id.name} <${id.email}>`,
      "--allow-empty": null,
    });

    await this.ensureOnBranch(MAIN_BRANCH);
    return { branch };
  }

  /**
   * Squash-and-merge: collapse every autosave on the draft branch into ONE
   * semantic commit on main, then delete the draft branch. This is the
   * approval path for Module 1.
   */
  async squashMergeDraft(params: {
    prId: string;
    semanticMessage: string;
    author: Author;
  }): Promise<{ commit: string }> {
    const { prId, semanticMessage, author } = params;
    const branch = draftBranchName(prId);

    await this.ensureOnBranch(MAIN_BRANCH);
    // --squash stages the net change without recording the draft's history.
    await this.git.merge(["--squash", branch]);

    const id = gitIdentity(author);
    // 2-arg form (message, options) — avoids the undefined-files pitfall.
    await this.git.commit(semanticMessage, {
      "--author": `${id.name} <${id.email}>`,
    });
    const head = await this.git.revparse(["HEAD"]);

    // The temporary branch has served its purpose — remove it.
    await this.git.deleteLocalBranch(branch, true);
    return { commit: head.trim() };
  }

  /** Discard a draft branch without merging (PR rejected). */
  async discardDraft(prId: string): Promise<void> {
    const branch = draftBranchName(prId);
    await this.ensureOnBranch(MAIN_BRANCH);
    const branches = await this.git.branchLocal();
    if (branches.all.includes(branch)) {
      await this.git.deleteLocalBranch(branch, true);
    }
  }

  /** Short commit log for a document on main — feeds the attribution index. */
  async documentHistory(
    docPath: string,
  ): Promise<Array<{ hash: string; message: string; author: string; date: string }>> {
    const log = await this.git.log({ file: docPath });
    return log.all.map((c) => ({
      hash: c.hash,
      message: c.message,
      author: c.author_name,
      date: c.date,
    }));
  }
}
