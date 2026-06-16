"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Attribution, Confidence, DocumentView } from "@context-studio/types";
import { autosaveDoc, exportUrls, proposeChange } from "@/lib/api";
import { authHeaders, getSession } from "@/lib/auth";
import { parseBlocks, blockKey } from "@/lib/blocks";
import { relativeTime } from "@/components/cpr/ui";
import { SourceChip } from "@/components/ui/SourceChip";

type Mode = "write" | "review";
type SaveState = "idle" | "saving" | "saved" | "error";
type AnnoStyle = "mark" | "strike" | "replace";

interface Anno {
  id: string;
  blockIdx: number;
  quote: string;
  label: string;
  emoji?: string;
  color: string;
  style: AnnoStyle;
  note?: string;
  replacement?: string;
}

const C = { indigo: "#5b54e8", rose: "#d2483b", amber: "#e8893b" };

// plannotator-style annotation presets.
const PRESETS: Array<{ label: string; emoji: string; color: string }> = [
  { label: "Clarify this", emoji: "❓", color: "#e0a93b" },
  { label: "Missing info", emoji: "🧩", color: "#9b5cf6" },
  { label: "Verify this", emoji: "🔍", color: "#e8893b" },
  { label: "Give an example", emoji: "🧪", color: "#4f6bed" },
  { label: "Match existing patterns", emoji: "🧭", color: "#12a8a0" },
  { label: "Consider alternatives", emoji: "🔁", color: "#e0518f" },
  { label: "Ensure no regression", emoji: "🛡️", color: "#e8893b" },
  { label: "Out of scope", emoji: "🚫", color: "#d2483b" },
  { label: "Needs review", emoji: "✅", color: "#4f6bed" },
  { label: "Nice approach", emoji: "👍", color: "#1f9d57" },
];

const CONF: Record<Confidence, { rail: string; label: string; cls: string }> = {
  human: { rail: "border-emerald-500", label: "Human-written — trusted", cls: "text-emerald-600 dark:text-emerald-400" },
  agent_approved: { rail: "border-brand", label: "AI-written · human-approved", cls: "text-brand" },
  agent_unverified: { rail: "border-amber-500", label: "AI-written · unverified", cls: "text-amber-600 dark:text-amber-400" },
};

let counter = 0;
const nextId = () => `a${++counter}`;
function rgba(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function markStyle(a: Anno): React.CSSProperties {
  if (a.style === "strike")
    return { textDecoration: "line-through", textDecorationColor: a.color, background: rgba(a.color, 0.12), borderRadius: 3, padding: "0 2px" };
  if (a.style === "replace") return { background: rgba(a.color, 0.2), borderRadius: 3, padding: "0 2px" };
  return { background: rgba(a.color, 0.16), borderBottom: `2px solid ${a.color}`, borderRadius: 3, padding: "0 1px" };
}

export function Editor({
  doc,
  files,
  currentPath,
}: {
  doc: DocumentView;
  files: Array<{ path: string; kind: string }>;
  currentPath: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(doc.content);
  const [mode, setMode] = useState<Mode>("review");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [draftPrId, setDraftPrId] = useState<string | undefined>(doc.draftPrId);
  const [showPropose, setShowPropose] = useState(false);

  const [annos, setAnnos] = useState<Anno[]>([]);
  const [sel, setSel] = useState<{ blockIdx: number; quote: string; x: number; y: number } | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [composing, setComposing] = useState<{ blockIdx: number; quote: string; mode: "comment" | "replace" } | null>(null);
  const [draftText, setDraftText] = useState("");

  const docRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = content !== doc.content;
  const blocks = parseBlocks(content);

  const attribByKey = useMemo(
    () => new Map(doc.attributions.map((a) => [a.blockKey, a.attribution])),
    [doc.attributions],
  );

  const save = useCallback(
    async (text: string) => {
      setSaveState("saving");
      try {
        const res = await autosaveDoc(
          { documentPath: doc.documentPath, content: text, authorId: getSession()?.user.id ?? "user-dana" },
          authHeaders(),
        );
        setDraftPrId(res.draftPrId);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [doc.documentPath],
  );

  useEffect(() => {
    if (content === doc.content) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(content), 900);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, doc.content, save]);

  function onMouseUp() {
    const s = window.getSelection();
    const quote = s?.toString().trim() ?? "";
    if (!quote || !s || s.rangeCount === 0) {
      if (!composing) {
        setSel(null);
        setShowPresets(false);
      }
      return;
    }
    let node: Node | null = s.anchorNode;
    let el = node instanceof Element ? node : node?.parentElement ?? null;
    while (el && !(el as HTMLElement).dataset?.bi) el = el.parentElement;
    if (!el || !docRef.current?.contains(el)) return;
    const blockIdx = Number((el as HTMLElement).dataset.bi);
    const rect = s.getRangeAt(0).getBoundingClientRect();
    setSel({ blockIdx, quote, x: rect.left + rect.width / 2, y: rect.top });
    setShowPresets(false);
  }

  const add = (a: Omit<Anno, "id">) => {
    setAnnos((x) => [...x, { ...a, id: nextId() }]);
    setSel(null);
    setShowPresets(false);
    window.getSelection()?.removeAllRanges();
  };

  function commitComposing() {
    if (!composing || !draftText.trim()) return;
    add(
      composing.mode === "comment"
        ? { blockIdx: composing.blockIdx, quote: composing.quote, label: "Comment", color: C.indigo, style: "mark", note: draftText.trim() }
        : { blockIdx: composing.blockIdx, quote: composing.quote, label: "Replace", color: C.amber, style: "replace", replacement: draftText.trim() },
    );
    setComposing(null);
    setDraftText("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-sm text-muted">{currentPath}</h1>
          <p className="text-xs text-muted">
            Review surface — select any text to annotate. Edits autosave privately until you propose them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveBadge state={saveState} dirty={dirty} />
          <ExportMenu />
          <button
            disabled={!draftPrId}
            onClick={() => setShowPropose(true)}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            Propose change
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[13rem_1fr]">
        <FileBrowser files={files} current={currentPath} />

        <div className="space-y-3">
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
            {(["review", "write"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 capitalize ${mode === m ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
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
              className="h-[28rem] w-full resize-y rounded-xl border border-line bg-surface p-4 font-mono text-sm leading-relaxed text-ink shadow-card focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          ) : (
            <>
              <div ref={docRef} onMouseUp={onMouseUp} className="rounded-2xl border border-line bg-surface px-7 py-6 shadow-card">
                <article className="max-w-[68ch] space-y-1 leading-[1.75] text-[15px]">
                  {blocks.map((b, i) => (
                    <Block key={i} idx={i} block={b} annos={annos.filter((a) => a.blockIdx === i)} attribution={attribByKey.get(blockKey(b.text))} />
                  ))}
                </article>
              </div>
              <Legend />
              <Annotations annos={annos} onRemove={(id) => setAnnos((x) => x.filter((y) => y.id !== id))} />
            </>
          )}
        </div>
      </div>

      {/* Floating select toolbar */}
      {sel && !composing && (
        <div className="fixed z-40 -translate-x-1/2 -translate-y-full" style={{ left: sel.x, top: sel.y - 8 }}>
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1 text-sm shadow-lg">
            <IconBtn title="Delete" onClick={() => add({ blockIdx: sel.blockIdx, quote: sel.quote, label: "Delete", color: C.rose, style: "strike" })}>🗑️</IconBtn>
            <IconBtn title="Comment" onClick={() => { setComposing({ blockIdx: sel.blockIdx, quote: sel.quote, mode: "comment" }); setDraftText(""); setSel(null); }}>💬</IconBtn>
            <IconBtn title="Replace" onClick={() => { setComposing({ blockIdx: sel.blockIdx, quote: sel.quote, mode: "replace" }); setDraftText(""); setSel(null); }}>✏️</IconBtn>
            <IconBtn title="Quick annotations" active={showPresets} onClick={() => setShowPresets((v) => !v)}>⚡</IconBtn>
          </div>
          {showPresets && (
            <div className="mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-line bg-surface p-1 text-sm shadow-lg">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add({ blockIdx: sel.blockIdx, quote: sel.quote, label: p.label, emoji: p.emoji, color: p.color, style: "mark" })}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-hover"
                >
                  <span>{p.emoji}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setComposing(null)}>
          <div className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">{composing.mode === "comment" ? "Comment" : "Replace"}</div>
            <div className="rounded-lg bg-surface2 px-3 py-2 text-xs italic text-muted">“{composing.quote}”</div>
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={composing.mode === "comment" ? "Add a comment…" : "Write the replacement text…"}
              className="h-24 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setComposing(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={commitComposing} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">Add annotation</button>
            </div>
          </div>
        </div>
      )}

      {showPropose && draftPrId && (
        <ProposeDialog
          draftPrId={draftPrId}
          annotationCount={annos.length}
          onClose={() => setShowPropose(false)}
          onProposed={(prId) => router.push(`/pr/${prId}`)}
        />
      )}
    </div>
  );
}

function IconBtn({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-base hover:bg-hover ${active ? "bg-brand/15 ring-1 ring-brand/40" : ""}`}
    >
      {children}
    </button>
  );
}

function FileBrowser({ files, current }: { files: Array<{ path: string; kind: string }>; current: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, Array<{ path: string; kind: string }>>();
    for (const f of files) {
      const arr = m.get(f.kind) ?? [];
      arr.push(f);
      m.set(f.kind, arr);
    }
    return [...m.entries()];
  }, [files]);

  return (
    <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Files</div>
      {groups.map(([kind, list]) => (
        <div key={kind} className="space-y-1">
          <SourceChip kind={kind} />
          <div className="space-y-0.5">
            {list.map((f) => {
              const active = f.path === current;
              const name = f.path.split("/").slice(1).join("/") || f.path;
              return (
                <Link
                  key={f.path}
                  href={`/edit/${f.path}`}
                  className={`block truncate rounded-md px-2 py-1 text-sm transition ${active ? "bg-brand/10 font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink"}`}
                  title={f.path}
                >
                  {name}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-emerald-500" /> Human-written — trusted</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-brand" /> AI · human-approved</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-1 rounded bg-amber-500" /> AI · unverified</span>
    </div>
  );
}

function SaveBadge({ state, dirty }: { state: SaveState; dirty: boolean }) {
  if (state === "saving") return <span className="text-xs text-muted">Saving…</span>;
  if (state === "error") return <span className="text-xs text-rose-600">Save failed</span>;
  if (state === "saved") return <span className="text-xs text-emerald-600">Draft saved</span>;
  return <span className="text-xs text-muted">{dirty ? "Unsaved" : "Up to date"}</span>;
}

function Block({
  idx,
  block,
  annos,
  attribution,
}: {
  idx: number;
  block: ReturnType<typeof parseBlocks>[number];
  annos: Anno[];
  attribution?: Attribution;
}) {
  const [hover, setHover] = useState(false);
  const conf = attribution?.confidence;
  const meta = conf ? CONF[conf] : null;
  const inner = annotate(block.text, annos);

  const content =
    block.blockType === "heading" ? (
      <span className={(block.depth ?? 1) <= 1 ? "text-2xl font-semibold" : "text-lg font-semibold"}>{inner}</span>
    ) : block.blockType === "listItem" ? (
      <span className="flex gap-2"><span className="select-none text-muted">•</span><span>{inner}</span></span>
    ) : block.blockType === "code" ? (
      <pre className="overflow-x-auto rounded-lg bg-slate-900/90 p-3 text-sm text-slate-100">{block.text}</pre>
    ) : (
      <span className="text-ink/90">{inner}</span>
    );

  return (
    <div
      data-bi={idx}
      className={`relative border-l-2 py-1 pl-3 ${meta?.rail ?? "border-transparent"}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {content}
      {hover && attribution && meta && (
        <div className="absolute left-3 z-10 mt-1 w-72 rounded-lg border border-line bg-surface p-2.5 text-xs shadow-lg">
          <div className={`font-medium ${meta.cls}`}>{meta.label}</div>
          <div className="mt-1 text-muted">{attribution.author.name} · {relativeTime(attribution.mergedAt)}</div>
        </div>
      )}
    </div>
  );
}

function annotate(text: string, annos: Anno[]): React.ReactNode {
  if (annos.length === 0) return text;
  const ranges = annos
    .map((a) => ({ a, start: text.indexOf(a.quote) }))
    .filter((r) => r.start >= 0)
    .sort((x, y) => x.start - y.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const { a, start } of ranges) {
    if (start < cursor) continue;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark key={a.id} title={`${a.emoji ?? ""} ${a.label}${a.note ? `: ${a.note}` : ""}${a.replacement ? ` → ${a.replacement}` : ""}`} style={markStyle(a)} className="text-ink">
        {a.quote}
      </mark>,
    );
    cursor = start + a.quote.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function Annotations({ annos, onRemove }: { annos: Anno[]; onRemove: (id: string) => void }) {
  if (annos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
        Select text to annotate — delete, comment, replace, or pick a quick annotation (⚡).
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Annotations · {annos.length}</div>
      {annos.map((a) => (
        <div key={a.id} className="rounded-xl border border-line bg-surface p-3 shadow-card">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
              {a.emoji} {a.label}
            </span>
            <button onClick={() => onRemove(a.id)} className="text-xs text-muted hover:text-ink" aria-label="Remove annotation">✕</button>
          </div>
          <div className="mt-1 truncate text-xs italic text-muted">“{a.quote}”</div>
          {a.note && <div className="mt-1 text-sm">{a.note}</div>}
          {a.replacement && <div className="mt-1 text-sm">→ <span className="rounded bg-amber-500/15 px-1">{a.replacement}</span></div>}
        </div>
      ))}
    </div>
  );
}

function ExportMenu() {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-surface px-1 py-1 text-xs">
      <span className="px-1 text-muted">Export</span>
      <a href={exportUrls.llmsTxt} target="_blank" className="rounded px-1.5 py-0.5 hover:bg-surface2">llms.txt</a>
      <a href={exportUrls.fcontext} target="_blank" className="rounded px-1.5 py-0.5 hover:bg-surface2">.fcontext</a>
    </div>
  );
}

function ProposeDialog({
  draftPrId,
  annotationCount,
  onClose,
  onProposed,
}: {
  draftPrId: string;
  annotationCount: number;
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
      const { prId } = await proposeChange({ draftPrId, title, description }, authHeaders());
      onProposed(prId);
    } catch {
      setError("Failed to propose the change.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Propose change</h2>
        <p className="text-sm text-muted">
          Opens a Context PR for review{annotationCount ? ` with ${annotationCount} annotation${annotationCount === 1 ? "" : "s"}` : ""}.
        </p>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Clarify refund eligibility)" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this change?" className="h-24 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={submit} disabled={busy} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? "Opening…" : "Open Context PR"}
          </button>
        </div>
      </div>
    </div>
  );
}
