"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Attribution, BlockInsight, Confidence, DocumentView } from "@context-studio/types";
import { autosaveDoc, proposeChange } from "@/lib/api";
import { authHeaders, getSession } from "@/lib/auth";
import { parseBlocks, blockKey, type ClientBlock } from "@/lib/blocks";
import { relativeTime } from "@/components/cpr/ui";
import { SourceChip } from "@/components/ui/SourceChip";

type Mode = "edit" | "source";
type SaveState = "idle" | "saving" | "saved" | "error";
type AnnoStyle = "mark" | "strike" | "replace";
type ComposeMode = "note" | "edit" | "add";

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

const C = { indigo: "#0969da", rose: "#cf222e", amber: "#bf8700" };

const CONF: Record<Confidence, { rail: string; dot: string; short: string; label: string; cls: string }> = {
  human: { rail: "border-emerald-500", dot: "#10b981", short: "Human", label: "Human-written — trusted", cls: "text-emerald-600 dark:text-emerald-400" },
  agent_approved: { rail: "border-brand", dot: "var(--brand)", short: "AI · approved", label: "AI-written · human-approved", cls: "text-brand" },
  agent_unverified: { rail: "border-amber-500", dot: "#f59e0b", short: "AI · unverified", label: "AI-written · not yet reviewed", cls: "text-amber-600 dark:text-amber-400" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Exact, locale-stable date (UTC) so it never mismatches between build and client. */
function fullDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

/** Serialize parsed blocks back to Markdown — used when inserting a new line. */
function serializeBlocks(blocks: ClientBlock[]): string {
  return (
    blocks
      .map((b) => {
        if (b.blockType === "heading") return `${"#".repeat(b.depth ?? 1)} ${b.text}`;
        if (b.blockType === "listItem") return `- ${b.text}`;
        if (b.blockType === "quote") return `> ${b.text}`;
        if (b.blockType === "code") return b.text;
        return b.text;
      })
      .join("\n\n") + "\n"
  );
}

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
  fileReads,
}: {
  doc: DocumentView;
  files: Array<{ path: string; kind: string }>;
  currentPath: string;
  /** File-level read count (reads are tracked per file, not per line). */
  fileReads?: number;
}) {
  const router = useRouter();
  const [content, setContent] = useState(doc.content);
  const [mode, setMode] = useState<Mode>("edit");
  const [, setSaveState] = useState<SaveState>("idle");
  const [draftPrId, setDraftPrId] = useState<string | undefined>(doc.draftPrId);
  const [showPropose, setShowPropose] = useState(false);
  const [showBlame, setShowBlame] = useState(false);

  const [annos, setAnnos] = useState<Anno[]>([]);
  const [sel, setSel] = useState<{ blockIdx: number; quote: string; x: number; y: number } | null>(null);
  const [composing, setComposing] = useState<{ blockIdx: number; quote: string; mode: ComposeMode } | null>(null);
  const [draftText, setDraftText] = useState("");

  const docRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocks = parseBlocks(content);

  const attribByKey = useMemo(
    () => new Map(doc.attributions.map((a) => [a.blockKey, a.attribution])),
    [doc.attributions],
  );
  const insightByKey = useMemo(
    () => new Map(doc.attributions.map((a) => [a.blockKey, a.insight])),
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
      if (!composing) setSel(null);
      return;
    }
    let node: Node | null = s.anchorNode;
    let el = node instanceof Element ? node : node?.parentElement ?? null;
    while (el && !(el as HTMLElement).dataset?.bi) el = el.parentElement;
    if (!el || !docRef.current?.contains(el)) return;
    const blockIdx = Number((el as HTMLElement).dataset.bi);
    const rect = s.getRangeAt(0).getBoundingClientRect();
    setSel({ blockIdx, quote, x: rect.left + rect.width / 2, y: rect.top });
  }

  const add = (a: Omit<Anno, "id">) => {
    setAnnos((x) => [...x, { ...a, id: nextId() }]);
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  // Ensure a draft exists (annotations alone don't change the text), then propose.
  async function openPropose() {
    if (!draftPrId) await save(content);
    setShowPropose(true);
  }

  function commitComposing() {
    if (!composing || !draftText.trim()) return;
    if (composing.mode === "add") {
      // "Add" is a real content insertion (autosaves), not a staged annotation.
      const bs = parseBlocks(content);
      bs.splice(composing.blockIdx + 1, 0, { blockType: "paragraph", text: draftText.trim() });
      setContent(serializeBlocks(bs));
    } else {
      add(
        composing.mode === "note"
          ? { blockIdx: composing.blockIdx, quote: composing.quote, label: "Note", color: C.indigo, style: "mark", note: draftText.trim() }
          : { blockIdx: composing.blockIdx, quote: composing.quote, label: "Edit", color: C.amber, style: "replace", replacement: draftText.trim() },
      );
    }
    setComposing(null);
    setDraftText("");
  }

  // Per-block actions (operate on the whole line), mirroring the selection toolbar.
  const blockEdit = (blockIdx: number, text: string) => { setComposing({ blockIdx, quote: text, mode: "edit" }); setDraftText(text); setSel(null); };
  const blockNote = (blockIdx: number, text: string) => { setComposing({ blockIdx, quote: text, mode: "note" }); setDraftText(""); setSel(null); };
  const blockDelete = (blockIdx: number, text: string) => add({ blockIdx, quote: text, label: "Delete", color: C.rose, style: "strike" });
  const blockAdd = (blockIdx: number) => { setComposing({ blockIdx, quote: "", mode: "add" }); setDraftText(""); setSel(null); };

  return (
    // Full-bleed: break out of the centered container so the IDE uses the whole width.
    <div className="mx-[calc(50%-50vw)] flex h-[calc(100dvh-11rem)] min-h-[26rem] w-[100vw] flex-col gap-3 px-4 sm:px-6">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-3">
        <h1 className="truncate font-mono text-sm font-medium text-ink">{currentPath}</h1>
        {typeof fileReads === "number" && (
          <span className="text-xs text-muted">{fileReads.toLocaleString()} reads · 30d</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
            {(["edit", "source"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 capitalize ${mode === m ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === "edit" && (
            <button
              onClick={() => setShowBlame((b) => !b)}
              aria-pressed={showBlame}
              title="Annotate every line with its author (git-blame style)"
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                showBlame ? "border-brand bg-brand/10 text-ink" : "border-line text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              Authors
            </button>
          )}
        </div>
      </div>

      {/* IDE panes — each column scrolls on its own; the page itself doesn't. */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Files + outline */}
        <aside className="hidden w-48 shrink-0 overflow-y-auto pr-1 md:block">
          <FileBrowser files={files} current={currentPath} />
          {mode === "edit" && (
            <div className="mt-5">
              <Outline blocks={blocks} />
            </div>
          )}
        </aside>

        {/* Document */}
        <div
          ref={docRef}
          onMouseUp={onMouseUp}
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface"
        >
          {mode === "source" ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-ink focus:outline-none"
            />
          ) : (
            <>
              <div className="shrink-0 border-b border-line px-4 py-2">
                <Legend />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <article className="text-[15px]">
                  {blocks.map((b, i) => (
                    <Block
                      key={i}
                      idx={i}
                      block={b}
                      annos={annos.filter((a) => a.blockIdx === i)}
                      attribution={attribByKey.get(blockKey(b.text))}
                      insight={insightByKey.get(blockKey(b.text))}
                      showBlame={showBlame}
                      onEdit={blockEdit}
                      onNote={blockNote}
                      onDelete={blockDelete}
                      onAdd={blockAdd}
                    />
                  ))}
                </article>
              </div>
            </>
          )}
        </div>

        {/* Annotations / proposed changes */}
        <aside className="hidden w-72 shrink-0 flex-col overflow-hidden lg:flex">
          <AnnotationsPanel
            annos={annos}
            draftPrId={draftPrId}
            onRemove={(id) => setAnnos((x) => x.filter((y) => y.id !== id))}
            onPropose={openPropose}
          />
        </aside>
      </div>

      {/* Floating select toolbar — same icon buttons as the per-line hover bar. */}
      {sel && !composing && (
        <div className="fixed z-40 -translate-x-1/2 -translate-y-full" style={{ left: sel.x, top: sel.y - 8 }}>
          <div className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-lg">
            <RowBtn title="Edit selection" onClick={() => { setComposing({ blockIdx: sel.blockIdx, quote: sel.quote, mode: "edit" }); setDraftText(sel.quote); setSel(null); }}><Icon name="edit" /></RowBtn>
            <RowBtn title="Note on selection" onClick={() => { setComposing({ blockIdx: sel.blockIdx, quote: sel.quote, mode: "note" }); setDraftText(""); setSel(null); }}><Icon name="note" /></RowBtn>
            <RowBtn title="Delete selection" danger onClick={() => add({ blockIdx: sel.blockIdx, quote: sel.quote, label: "Delete", color: C.rose, style: "strike" })}><Icon name="trash" /></RowBtn>
          </div>
        </div>
      )}

      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setComposing(null)}>
          <div className="w-full max-w-md space-y-3 rounded-xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold">
              {composing.mode === "note" ? "Note" : composing.mode === "add" ? "Add a line" : "Edit text"}
            </div>
            {composing.mode === "add" ? (
              <div className="rounded-lg bg-surface2 px-3 py-2 text-xs text-muted">Inserts a new line below the selected one.</div>
            ) : (
              <div className="rounded-lg bg-surface2 px-3 py-2 text-xs italic text-muted">“{composing.quote}”</div>
            )}
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={composing.mode === "note" ? "Add a note…" : composing.mode === "add" ? "New line to add…" : "Edit the selected text…"}
              className="h-24 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setComposing(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={commitComposing} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white">
                {composing.mode === "add" ? "Add line" : "Add annotation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPropose && draftPrId && (
        <ProposeDialog
          draftPrId={draftPrId}
          annos={annos}
          onClose={() => setShowPropose(false)}
          onProposed={(prId) => router.push(`/pr/${prId}`)}
        />
      )}
    </div>
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
    <aside className="space-y-3">
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

function Block({
  idx,
  block,
  annos,
  attribution,
  insight,
  showBlame,
  onEdit,
  onNote,
  onDelete,
  onAdd,
}: {
  idx: number;
  block: ClientBlock;
  annos: Anno[];
  attribution?: Attribution;
  insight?: BlockInsight;
  showBlame: boolean;
  onEdit: (idx: number, text: string) => void;
  onNote: (idx: number, text: string) => void;
  onDelete: (idx: number, text: string) => void;
  onAdd: (idx: number) => void;
}) {
  const conf = attribution?.confidence;
  const meta = conf ? CONF[conf] : null;
  const inner = annotate(block.text, annos);
  const isHeading = block.blockType === "heading";

  const content = isHeading ? (
    <span className={(block.depth ?? 1) <= 1 ? "text-2xl font-semibold" : "text-lg font-semibold"}>{inner}</span>
  ) : block.blockType === "listItem" ? (
    <span className="flex gap-2"><span className="select-none text-muted">•</span><span>{inner}</span></span>
  ) : block.blockType === "code" ? (
    <pre className="overflow-x-auto rounded-lg bg-slate-900/90 p-3 text-sm text-slate-100">{block.text}</pre>
  ) : (
    <span className="text-ink/90">{inner}</span>
  );

  // The blame annotation — shown for every line only when "Authors" is on.
  const who = meta
    ? conf === "agent_unverified"
      ? `${attribution!.author.name} · not yet reviewed`
      : `${attribution!.verifiedBy ?? attribution!.author.name} · ${relativeTime(attribution!.mergedAt)}`
    : null;
  const openReqs = insight?.openRequests ?? 0;

  return (
    <div
      id={`blk-${idx}`}
      className={`group relative grid border-l-2 py-2 pr-12 leading-[1.7] transition-colors hover:bg-hover/40 ${meta?.rail ?? "border-transparent"} ${
        showBlame ? "grid-cols-[7.5rem_minmax(0,1fr)] gap-2 pl-2.5" : "grid-cols-1 pl-3"
      }`}
    >
      {/* Blame gutter — author next to the rail; hover for the full provenance. */}
      {showBlame && (
        <aside className="min-w-0 pt-0.5 text-[11px] leading-snug">
          <span className="group/author relative inline-block max-w-full align-top">
            <span className={`block cursor-default truncate ${conf === "agent_unverified" ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
              {who ?? "unattributed"}
            </span>
            {attribution && meta && (
              <span className="absolute left-0 top-full z-30 hidden w-64 rounded-lg border border-line bg-surface p-2.5 text-xs shadow-lg group-hover/author:block">
                <span className={`flex items-center gap-1.5 font-medium ${meta.cls}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: meta.dot }} />
                  {conf === "agent_unverified" ? "AI edit · not yet reviewed" : conf === "agent_approved" ? "AI edit · human-approved" : "Manual edit · human"}
                </span>
                <span className="mt-1 block text-muted">
                  {conf === "agent_unverified"
                    ? `Written by ${attribution.author.name}`
                    : `Verified by ${attribution.verifiedBy ?? attribution.author.name}${attribution.author.kind === "agent" ? ` · written by ${attribution.author.name}` : ""}`}
                </span>
                <span className="mt-1 block text-muted">{fullDate(attribution.mergedAt)}</span>
                <Link href={`/pr/${attribution.prId}`} className="mt-1.5 block font-medium text-brand hover:underline">
                  {attribution.prTitle} ({attribution.prId}) →
                </Link>
              </span>
            )}
          </span>
        </aside>
      )}

      {/* The written content — selectable for partial edits. */}
      <div data-bi={idx} className="min-w-0">{content}</div>

      {/* Open-requests marker (fades on hover so the action bar can show). */}
      {openReqs > 0 && (
        <Link
          href="/inbox"
          title={`${openReqs} open request${openReqs === 1 ? "" : "s"} on this line`}
          className="absolute right-2 top-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-opacity group-hover:opacity-0"
          style={{ background: "rgba(9,105,218,0.12)", color: "#0969da" }}
        >
          {openReqs} open
        </Link>
      )}

      {/* On hover: line actions. */}
      <div className="absolute right-2 top-1.5 z-10 hidden items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-sm group-hover:flex">
        <RowBtn title="Add line below" onClick={() => onAdd(idx)}><Icon name="add" /></RowBtn>
        {!isHeading && <RowBtn title="Edit this line" onClick={() => onEdit(idx, block.text)}><Icon name="edit" /></RowBtn>}
        {!isHeading && <RowBtn title="Leave a note" onClick={() => onNote(idx, block.text)}><Icon name="note" /></RowBtn>}
        {!isHeading && <RowBtn title="Delete this line" danger onClick={() => onDelete(idx, block.text)}><Icon name="trash" /></RowBtn>}
      </div>
    </div>
  );
}

function RowBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-hover ${
        danger ? "hover:text-rose-600 dark:hover:text-rose-400" : "hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Clean, consistent stroke icons for the per-line action bar. */
function Icon({ name }: { name: "add" | "edit" | "note" | "trash" }) {
  const p = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "add")
    return (
      <svg {...p}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  if (name === "edit")
    return (
      <svg {...p}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  if (name === "note")
    return (
      <svg {...p}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  return (
    <svg {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function Outline({ blocks }: { blocks: ClientBlock[] }) {
  const headings = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.blockType === "heading");
  if (headings.length < 2) return null;
  return (
    <div className="space-y-1.5">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">On this page</div>
      <nav className="space-y-0.5 border-l border-line">
        {headings.map(({ b, i }) => (
          <button
            key={i}
            onClick={() => document.getElementById(`blk-${i}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className={`-ml-px block w-full truncate border-l-2 border-transparent py-0.5 text-left text-xs text-muted transition hover:border-brand hover:text-ink ${(b.depth ?? 1) >= 2 ? "pl-4" : "pl-2 font-medium"}`}
            title={b.text}
          >
            {b.text}
          </button>
        ))}
      </nav>
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

/** Right IDE column: the proposed changes, with Propose at the top. */
function AnnotationsPanel({
  annos,
  draftPrId,
  onRemove,
  onPropose,
}: {
  annos: Anno[];
  draftPrId?: string;
  onRemove: (id: string) => void;
  onPropose: () => void;
}) {
  const canPropose = annos.length > 0 || !!draftPrId;
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Annotations</span>
        <span className="rounded-full bg-surface2 px-1.5 py-0.5 text-[11px] text-muted">{annos.length}</span>
      </div>
      <button
        onClick={onPropose}
        disabled={!canPropose}
        className="mb-3 shrink-0 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
      >
        Propose change →
      </button>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {annos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            Hover a line or select text to edit, note, or delete. Proposed changes collect here, then propose them as one change request.
          </p>
        ) : (
          annos.map((a) => (
            <div key={a.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                  {a.label}
                </span>
                <button onClick={() => onRemove(a.id)} className="text-xs text-muted hover:text-ink" aria-label="Remove annotation">✕</button>
              </div>
              <div className="mt-1 truncate text-xs italic text-muted">“{a.quote}”</div>
              {a.note && <div className="mt-1 text-sm">{a.note}</div>}
              {a.replacement && <div className="mt-1 text-sm">→ <span className="rounded bg-amber-500/15 px-1">{a.replacement}</span></div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ProposeDialog({
  draftPrId,
  annos,
  onClose,
  onProposed,
}: {
  draftPrId: string;
  annos: Anno[];
  onClose: () => void;
  onProposed: (prId: string) => void;
}) {
  const summary = annos
    .map((a) => `- [${a.label}] “${a.quote}”${a.note ? `: ${a.note}` : ""}${a.replacement ? ` → ${a.replacement}` : ""}`)
    .join("\n");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(annos.length ? `Annotations:\n${summary}` : "");
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
          Opens a Context PR for review{annos.length ? ` with ${annos.length} annotation${annos.length === 1 ? "" : "s"}` : ""}.
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
