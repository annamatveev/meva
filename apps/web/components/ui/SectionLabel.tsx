/**
 * Editorial "§ NN — LABEL" eyebrow, in the style of the reference design:
 * uppercase monospace, wide tracking, a brand-tinted section mark.
 */
export function SectionLabel({ n, children }: { n: number; children: React.ReactNode }) {
  const num = String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
      <span className="text-brand dark:text-accent">§&nbsp;{num}</span>
      <span className="h-px w-6 bg-line" aria-hidden />
      <span>{children}</span>
    </div>
  );
}
