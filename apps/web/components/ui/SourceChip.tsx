/** A small colour-coded chip for a source/document kind (context/skills/memory/…). */
const KNOWN = ["context", "skills", "memory"];

export function SourceChip({ kind, className = "" }: { kind: string; className?: string }) {
  const color = `var(--type-${KNOWN.includes(kind) ? kind : "default"})`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-surface2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted ${className}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {kind}
    </span>
  );
}
