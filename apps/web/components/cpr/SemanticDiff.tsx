import type { SemanticDiff as Diff } from "@context-studio/types";
import { SemanticDiffBlock } from "./SemanticDiffBlock";
import { Hint } from "@/components/ui/Tooltip";

/**
 * Semantic Diff viewer — block-level changes rendered like a collaborative
 * wiki. No line numbers, no red/green gutters; a calm left rail and inline
 * emphasis carry the meaning. Hovering any block reveals its attribution.
 */
export function SemanticDiff({ diff }: { diff: Diff }) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            Proposed changes
            <Hint>
              Changes shown by logical block — added, edited, or removed — like a wiki, not a
              code diff. Edited text highlights the exact words that changed.
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

      <div className="divide-y divide-line px-2 py-2">
        {diff.blocks.map((block) => (
          <SemanticDiffBlock key={block.id} block={block} />
        ))}
      </div>

      <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
        Hover any line to see who wrote it and which change request introduced it.
      </p>
    </section>
  );
}
