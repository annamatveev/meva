/**
 * meva logo — a vault / safe mark ("Memory Vault"). Line art in the current
 * text color (so it themes), with a gold dial center.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg border-2 border-brand text-brand"
      style={{ width: size, height: size }}
      aria-label="meva"
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* dial */}
        <circle cx="11" cy="12" r="6.5" />
        {/* spokes */}
        <path d="M11 5.5v2M11 16.5v2M4.5 12h2M15.5 12h2" />
        {/* hub */}
        <circle cx="11" cy="12" r="1.4" fill="var(--accent)" stroke="var(--accent)" />
        {/* handle */}
        <path d="M18 9.5v5" stroke="var(--accent)" />
      </svg>
    </span>
  );
}
