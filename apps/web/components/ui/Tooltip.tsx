import type { ReactNode } from "react";

type Side = "top" | "bottom";

const POS: Record<Side, string> = {
  bottom: "left-1/2 top-full mt-2 -translate-x-1/2",
  top: "left-1/2 bottom-full mb-2 -translate-x-1/2",
};

/**
 * Lightweight CSS tooltip (no JS state, works in server + client components).
 * Reveals on hover and keyboard focus of the wrapped trigger.
 */
export function Tooltip({
  label,
  children,
  side = "bottom",
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: Side;
  className?: string;
}) {
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-max max-w-[16rem] whitespace-normal rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-muted opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${POS[side]}`}
      >
        {label}
      </span>
    </span>
  );
}

/** A small circled "i" that reveals an explanation on hover/focus. */
export function Hint({ children, side = "bottom" }: { children: ReactNode; side?: Side }) {
  return (
    <Tooltip label={children} side={side}>
      <span
        tabIndex={0}
        aria-label="More information"
        className="inline-flex h-[15px] w-[15px] cursor-help items-center justify-center rounded-full border border-line text-[10px] font-semibold leading-none text-muted transition hover:border-brand hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        i
      </span>
    </Tooltip>
  );
}
