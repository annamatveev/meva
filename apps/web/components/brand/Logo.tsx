/**
 * bravo logo — a "brain vault": a small knowledge-graph node cluster inside a
 * rounded vault tile. Line art in the current text color (themes), with one
 * accent node. Suggests connected knowledge held in a vault.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg border-2 border-brand text-brand"
      style={{ width: size, height: size }}
      aria-label="bravo"
    >
      <svg
        width={Math.round(size * 0.66)}
        height={Math.round(size * 0.66)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* edges */}
        <path d="M8 7L6 14M8 7l8 1M6 14l6 3M16 8l-4 9M16 8l2 6M18 14l-6 3" opacity="0.7" />
        {/* nodes */}
        <circle cx="8" cy="7" r="1.8" fill="currentColor" />
        <circle cx="16" cy="8" r="1.8" fill="currentColor" />
        <circle cx="6" cy="14" r="1.6" fill="currentColor" />
        <circle cx="18" cy="14" r="1.6" fill="currentColor" />
        <circle cx="12" cy="17" r="2.1" fill="var(--accent)" stroke="var(--accent)" />
      </svg>
    </span>
  );
}
