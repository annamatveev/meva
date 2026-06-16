"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Attribution, DocumentView } from "@context-studio/types";
import { autosaveDoc, exportUrls, proposeChange } from "@/lib/api";
import { parseBlocks, blockKey } from "@/lib/blocks";
import { AuthorBadge, relativeTime } from "@/components/cpr/ui";

type Mode = "write" | "preview";
type SaveState = "idle" | "saving" | "saved" | "error";

const ACTING_USER = "user-dana"; // prototype: the signed-in Context Owner

export function Editor({ doc }: { doc: DocumentView }) {
  const router = useRouter();
  const [content, setContent] = useState(doc.content);
  const [mode, setMode] = useState<Mode>("preview");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [draftPrId, setDraftPrId] = useState<string | undefined>(doc.draftPrId);
  const [showPropose, setShowPropose] = useState(false);

  const attribByKey = new Map(
    doc.attributions.map((a) => [a.blockKey, a.attribution] as const),
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = content !== doc.content;

  const save = useCallback(async (text: string) => {
    setSaveState("saving");
    try {
      const res = await autosaveDoc({
        documentPath: doc.documentPath,
        content: text,
        authorId: ACTING_USER,
      });
      setDraftPrId(res.draftPrId);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [doc.documentPath]);

  // Debounced transparent autosave — the user just types.
  useEffect(() => {
    if (content === doc.content) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(content), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, doc.content, save]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{doc.documentPath}</h1>
          <p className="text-xs text-muted">
            Drafting as <span className="font-medium">Dana Levi</span>. Edits autosave privately
            until you propose them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveBadge state={saveState} dirty={dirty} />
          <ExportMenu />
          <button
            disabled={!draftPrId || !dirty && saveState !== "saved"}
            onClick={() => setShowPropose(true)}
            className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Propose change
          </button>
        </div>
      </div>

      {/* Dual-mode toggle */}
      <div className="inline-flex rounded-lg border border-black/10 bg-white p-0.5 text-sm">
        {(["write", "preview"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 capitalize ${
              mode === m ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "write" ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
          className="h-[28rem] w-full resize-y rounded-xl border border-black/10 bg-white p-4 font-mono text-sm leading-relaxed text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
      ) : (
        <Preview content={content} attribByKey={attribByKey} />
      )}

      {showPropose && draftPrId && (
        <ProposeDialog
          draftPrId={draftPrId}
          onClose={() => setShowPropose(false)}
          onProposed={(prId) => router.push(`/pr/${prId}`)}
        />
      )}
    </div>
  );
}

function SaveBadge({ state, dirty }: { state: SaveState; dirty: boolean }) {
  if (state === "saving") return <span className="text-xs text-muted">Saving…</span>;
  if (state === "error") return <span className="text-xs text-rose-600">Save failed</span>;
  if (state === "saved") return <span className="text-xs text-emerald-600">Draft saved</span>;
  return <span className="text-xs text-muted">{dirty ? "Unsaved" : "Up to date"}</span>;
}

/** Preview with an Attribution Gutter — hover a block to see who wrote it. */
function Preview({
  content,
  attribByKey,
}: {
  content: string;
  attribByKey: Map<string, Attribution | undefined>;
}) {
  const blocks = parseBlocks(content);
  return (
    <div className="rounded-xl border border-black/5 bg-white p-2 shadow-sm">
      {blocks.map((b, i) => {
        const key = blockKey(b.text);
        const attribution = attribByKey.get(key);
        return (
          <BlockRow key={`${key}-${i}`} block={b} attribution={attribution} />
        );
      })}
      <p className="border-t border-black/5 px-3 py-2 text-xs text-muted">
        Hover any line for its attribution. New or edited lines are unattributed until merged.
      </p>
    </div>
  );
}

function BlockRow({
  block,
  attribution,
}: {
  block: ReturnType<typeof parseBlocks>[number];
  attribution?: Attribution;
}) {
  const [hover, setHover] = useState(false);
  const inner =
    block.blockType === "heading" ? (
      <div className={(block.depth ?? 1) <= 1 ? "text-lg font-semibold" : "font-semibold"}>
        {block.text}
      </div>
    ) : block.blockType === "listItem" ? (
      <div className="flex gap-2">
        <span className="select-none text-muted">•</span>
        <span>{block.text}</span>
      </div>
    ) : (
      <p className="leading-relaxed">{block.text}</p>
    );

  return (
    <div
      className="relative flex items-start gap-2 rounded-md px-3 py-1.5 hover:bg-black/[0.02]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          attribution ? "bg-slate-300" : "bg-emerald-400"
        }`}
        aria-hidden
      />
      <div className="flex-1">{inner}</div>
      {hover && (
        <div className="absolute right-3 top-1 z-10 w-72 rounded-lg border border-black/10 bg-white p-3 text-xs shadow-lg">
          {attribution ? (
            <>
              <div className="mb-1 flex items-center gap-1.5 text-muted">
                <span>Authored by</span>
                <AuthorBadge author={attribution.author} />
              </div>
              <div className="text-muted">Merged {relativeTime(attribution.mergedAt)}</div>
              <a href={`/pr/${attribution.prId}`} className="mt-1 inline-block font-medium text-indigo-600 hover:underline">
                {attribution.prTitle} ({attribution.prId}) →
              </a>
            </>
          ) : (
            <span className="text-emerald-700">New / edited — unattributed until merged.</span>
          )}
        </div>
      )}
    </div>
  );
}

function ExportMenu() {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-black/10 bg-white px-1 py-1 text-xs">
      <span className="px-1 text-muted">Export</span>
      <a href={exportUrls.llmsTxt} target="_blank" className="rounded px-1.5 py-0.5 hover:bg-black/5">
        llms.txt
      </a>
      <a href={exportUrls.fcontext} target="_blank" className="rounded px-1.5 py-0.5 hover:bg-black/5">
        .fcontext
      </a>
    </div>
  );
}

function ProposeDialog({
  draftPrId,
  onClose,
  onProposed,
}: {
  draftPrId: string;
  onClose: () => void;
  onProposed: (prId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !description.trim()) {
      setError("Add a title and a short rationale.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { prId } = await proposeChange({ draftPrId, title, description });
      onProposed(prId);
    } catch {
      setError("Failed to propose the change.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Propose change</h2>
        <p className="text-sm text-muted">
          This opens a Context PR for review. Your autosaves stay private until then.
        </p>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Clarify refund eligibility)"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why this change?"
          className="h-24 w-full resize-none rounded-lg border border-black/10 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Opening…" : "Open Context PR"}
          </button>
        </div>
      </div>
    </div>
  );
}
