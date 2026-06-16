import { getFreshnessOverview, listTickets } from "@/lib/api";
import { AuthorBadge, FreshnessPill, relativeTime } from "@/components/cpr/ui";
import { Hint } from "@/components/ui/Tooltip";

const STATE_HINTS: Record<string, string> = {
  Fresh: "Reviewed recently, within its review window. Trusted.",
  Stale: "Past its review window — probably fine, but no one has confirmed it lately.",
  Expired: "Long past its window — shouldn't be trusted until re-confirmed.",
  Conflicted: "Two or more open change requests edit this same block; needs resolution.",
};

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  let freshness;
  let tickets;
  try {
    [freshness, tickets] = await Promise.all([getFreshnessOverview(), listTickets()]);
  } catch {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">Couldn’t reach the backend</h1>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Start the server and reload.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Governance
          <Hint>
            An expiry date on knowledge. Each block of context moves through fresh → stale →
            expired as its review window lapses; a background worker auto-opens a review ticket so
            nobody has to remember to check.
          </Hint>
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Every context block has a freshness lifecycle. A background worker flags blocks past their
          review window and opens a ticket automatically — no one has to remember to check.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Fresh" value={freshness.counts.fresh} tone="text-emerald-700 dark:text-emerald-300" />
        <Stat label="Stale" value={freshness.counts.stale} tone="text-amber-700 dark:text-amber-300" />
        <Stat label="Expired" value={freshness.counts.expired} tone="text-rose-700 dark:text-rose-300" />
        <Stat label="Conflicted" value={freshness.counts.conflicted} tone="text-fuchsia-700 dark:text-fuchsia-300" />
      </div>

      {/* Open review tickets */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">
          Open review tickets ({tickets.length})
        </h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {tickets.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">
              No open tickets — all context is within its review window.
            </div>
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.reason}</div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {t.documentPath} — “{t.blockText}”
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {t.assignee && (
                      <>
                        <span>routed to</span>
                        <AuthorBadge author={t.assignee} />
                      </>
                    )}
                    <span>{relativeTime(t.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Blocks needing attention */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">
          Blocks needing attention ({freshness.attention.length} of {freshness.total})
        </h2>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {freshness.attention.length === 0 ? (
            <div className="px-5 py-6 text-sm text-muted">Everything is fresh.</div>
          ) : (
            freshness.attention.map((b) => (
              <div key={`${b.documentPath}:${b.blockKey}`} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm">{b.text}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {b.documentPath} · review window {b.ttlDays}d · last reviewed{" "}
                    {relativeTime(b.lastReviewedAt)}
                  </div>
                </div>
                <FreshnessPill state={b.state} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
      <div className="flex items-center gap-1 text-xs text-muted">
        {label} blocks
        {STATE_HINTS[label] && <Hint side="top">{STATE_HINTS[label]}</Hint>}
      </div>
    </div>
  );
}
