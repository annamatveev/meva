# Lovable prompt — clarify "how meva works" + the Git connection

Paste into the meva landing project. Keeps the design/voice; rewrites the
"§ 04 — The Flow" section and adds a short "How it connects to Git" block.

---

Keep the current design and voice (cream/green/gold, § eyebrows, mono labels,
grotesk headings). Only change copy. The "§ 04 — The Flow" section is unclear
about what actually happens and how meva relates to Git. Rewrite it, and add a
short "How it connects to Git" block, as follows.

Add a one-line mental model just under the § 04 heading:
"meva sits on top of a normal Git repository of Markdown files — that repo is
the source of truth. Every action below is a Git operation you never have to see."

Rewrite the five flow steps so each says what the user does AND what happens
under the hood:

§ 01 — Edit
Open a policy in a plain editor and type; saves happen automatically.
Under the hood: meva opens a private draft branch and commits each autosave.
You never touch Git.

§ 02 — Propose
Turn your draft into a Context PR — a reviewable change request with a clean,
block-level diff, the list of agents it affects, and automated checks. People
or agents can open one; only humans approve.

§ 03 — Review
Reviewers see a wiki-style semantic diff (not red/green code), a "blast radius"
of which agents rely on the changed text, and evals that block the merge if the
change drops facts an agent needs.

§ 04 — Approve
Required reviewers sign off. meva squashes all your autosaves into a single,
clean commit on the main branch and deletes the draft — one tidy, fully
attributed entry in the history.

§ 05 — Publish
meva renders a per-agent context bundle (only the documents each agent is
allowed to read), signs it (ed25519), and publishes it. Agents pull the bundle,
verify the signature, and swap it in — no changes to your agent code.

Then add a new block titled "How it connects to Git" (same § style, e.g.
§ 04b — UNDER THE HOOD):

"meva is a friendly layer over a real Git repo that stays on your infrastructure
— a local folder or a remote you already use. Each UI action maps to a Git
operation you never see:
 • editing  →  a draft branch
 • approving →  a squash-merge to main
 • history  →  the commit log
 • who wrote what  →  git blame
meva is the only thing that touches Git, so Context Owners get full version
control with no Git to learn. Your agents read the published bundle (plain
files), so the framework doesn't matter — it works the same for LangChain,
LlamaIndex, OpenAI, Anthropic, or anything that reads text."

Optionally render a tiny flow line in mono:
"You (edit · propose · approve) → meva → Git (branches · commits · main) →
signed bundle → your agents"

Do not invent features. Keep it accurate to: draft branch on edit, squash-merge
on approve, signed per-agent bundle on publish, agents pull + verify.
