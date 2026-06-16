"use client";

import { useRef, useState } from "react";
import type { SemanticDiff as Diff } from "@context-studio/types";
import { SemanticDiffBlock } from "./SemanticDiffBlock";
import { Hint } from "@/components/ui/Tooltip";

/**
 * Semantic Diff viewer — block-level changes rendered like a collaborative
 * wiki. No line numbers, no red/green gutters; a calm left rail and inline
 * emphasis carry the meaning. Hovering any block reveals its attribution.
 *
 * This is the *reviewing* surface (unlike the Editor, which is for authoring):
 * select any text in a proposed change to leave structured review feedback —
 * Clarify, Verify, Out of scope, Nice approach, etc. The notes collect into a
 * thread per block and are sent back to the author when you Request changes.
 */

// Plannotator-style review presets. `note: true` opens a free-text box first.
const PRESETS: Array<{ key: string; label: string; emoji: string; color: string; note?: boolean }> = [
  { key: "clarify", label: "Clarify this", emoji: "🔍", color: "#bf8700", note: true },
  { key: "verify", label: "Verify this", emoji: "✅", color: "#0969da" },
  { key: "example", label: "Give an example", emoji: "💡", color: "#8250df" },
  { key: "patterns", label: "Match existing patterns", emoji: "🧩", color: "#0a7ea4" },
  { key: "alternatives", label: "Consider alternatives", emoji: "🔀", color: "#bc4c00", note: true },
  { key: "regression", label: "Ensure no regression", emoji: "🛡️", color: "#cf222e" },
  { key: "scope", label: "Out of scope", emoji: "🚫", color: "#57606a" },
  { key: "review", label: "Needs review", emoji: "👀", color: "#9a6700" },
  { key: "nice", label: "Nice approach", emoji: "👍", color: "#1a7f37" },
  { key: "comment", label: "Comment", emoji: "💬", color: "#0969da", note: true },
];

interface ReviewComment {
  id: string;
  blockId: string;
  quote: string;
  label: string;
  emoji: string;
  color: string;
  note?: string;
}

let counter = 0;
const nextId = () => `rc${++counter}`;

export function SemanticDiff({ diff }: { diff: Diff }) {
  const docRef = useRef<HTMLDivElement | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [sel, setSel] = useState<{ blockId: string; quote: string; x: number; y: number } | null>(null);
  const [composing, setComposing] = useState<{ blockId: string; quote: string; preset: (typeof PRESETS)[number] } | null>(null);
  const [draft, setDraft] = useState("");

  function onMouseUp() {
    const s = window.getSelection();
    const quote = s?.toString().trim() ?? "";
    if (!quote || !s || s.rangeCount === 0) {
      setSel(null);
      return;
    }
    let node: Node | null = s.anchorNode;
    let el = node instanceof Element ? node : node?.parentElement ?? null;
    while (el && !(el as HTMLElement).dataset?.bi) el = el.parentElement;
    if (!el || !docRef.current?.contains(el)) return;
    const blockId = (el as HTMLElement).dataset.bi!;
    const rect = s.getRangeAt(0).getBoundingClientRect();
    setSel({ blockId, quote, x: rect.left + rect.width / 2, y: rect.top });
  }

  function pick(preset: (typeof PRESETS)[number]) {
    if (!sel) return;
    if (preset.note) {
      setComposing({ blockId: sel.blockId, quote: sel.quote, preset });
      setDraft("");
      setSel(null);
      return;
    }
    addComment(sel.blockId, sel.quote, preset);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  function addComment(blockId: string, quote: string, preset: (typeof PRESETS)[number], note?: string) {
    setComments((c) => [...c, { id: nextId(), blockId, quote, label: preset.label, emoji: preset.emoji, color: preset.color, note }]);
  }

  function commitComposing() {
    if (!composing) return;
    addComment(composing.blockId, composing.quote, composing.preset, draft.trim() || undefined);
    setComposing(null);
    setDraft("");
    window.getSelection()?.removeAllRanges();
  }

  const remove = (id: string) => setComments((c) => c.filter((x) => x.id !== id));

  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            Proposed changes
            <Hint>
              Changes shown by logical block — added, edited, or removed — like a wiki, not a
              code diff. Edited text highlights the exact words that changed. Select any text to
              leave review feedback.
            </Hint>
          </h2>
          <span className="text-xs text-muted">{diff.documentPath}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="text-added-accent">+{diff.summary.added} added</span>
          <span className="text-modified-accent">~{diff.summary.modified} edited</span>
          <span className="text-removed-accent">−{diff.summary.removed} removed</span>
        </div>
      </div>

      <div ref={docRef} onMouseUp={onMouseUp} className="divide-y divide-line px-2 py-2">
        {diff.blocks.map((block) => {
          const blockComments = comments.filter((c) => c.blockId === block.id);
          return (
            <div key={block.id} data-bi={block.id} className="relative">
              <SemanticDiffBlock block={block} />
              {blockComments.length > 0 && (
                <ul className="ml-4 mb-2 space-y-1.5 border-l-2 border-line pl-3">
                  {blockComments.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 rounded-lg bg-surface2 px-2.5 py-1.5 text-xs">
                      <span
                        className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 font-medium"
                        style={{ background: hexA(c.color, 0.14), color: c.color }}
                      >
                        {c.emoji} {c.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate italic text-muted">“{c.quote}”</span>
                        {c.note && <span className="mt-0.5 block text-ink">{c.note}</span>}
                      </span>
                      <button onClick={() => remove(c.id)} className="shrink-0 text-muted hover:text-ink" aria-label="Remove comment">✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {comments.length > 0 ? (
        <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-xs">
          <span className="font-medium text-ink">
            {comments.length} review comment{comments.length === 1 ? "" : "s"}
          </span>
          <span className="text-muted">Sent back to the author when you Request changes.</span>
        </div>
      ) : (
        <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
          Hover any line to see who wrote it. Select text to leave review feedback.
        </p>
      )}

      {/* Floating review-preset toolbar */}
      {sel && !composing && (
        <div className="fixed z-40 -translate-x-1/2 -translate-y-full" style={{ left: sel.x, top: sel.y - 8 }}>
          <div className="flex max-w-[22rem] flex-wrap items-center gap-1 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                title={p.label}
                className="rounded-md px-2 py-1 text-xs font-medium hover:bg-hover"
                style={{ color: p.color }}
              >
                {p.emoji} {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Free-text composer for presets that want a note */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setComposing(null)}>
          <div className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: composing.preset.color }}>
              {composing.preset.emoji} {composing.preset.label}
            </div>
            <div className="rounded-lg bg-surface2 px-3 py-2 text-xs italic text-muted">“{composing.quote}”</div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add feedback for the author…"
              className="h-24 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setComposing(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={commitComposing} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">Add comment</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
