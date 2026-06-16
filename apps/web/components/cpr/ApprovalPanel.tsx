"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApprovalAction, ContextPR, SessionUser } from "@context-studio/types";
import { submitApproval } from "@/lib/api";
import { authHeaders, getSession } from "@/lib/auth";
import { AuthorBadge } from "./ui";

const DECISION_MARK: Record<string, { icon: string; className: string; label: string }> = {
  approved: { icon: "✓", className: "text-emerald-600", label: "Approved" },
  changes_requested: { icon: "↻", className: "text-amber-600", label: "Changes requested" },
  pending: { icon: "•", className: "text-slate-400", label: "Pending" },
};

export function ApprovalPanel({ pr }: { pr: ContextPR }) {
  const router = useRouter();
  const requiredReviewers = pr.reviewers.filter((r) => r.required);

  // The acting reviewer is the signed-in user; the server enforces identity.
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    setUser(getSession()?.user ?? null);
  }, []);

  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<ApprovalAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHighBlast = pr.blastRadius.maxSeverity === "high";
  const isTerminal = pr.status === "merged" || pr.status === "rejected";
  const isReviewer = !!user && pr.reviewers.some((r) => r.author.id === user.id);

  const approvalsMet = useMemo(
    () => requiredReviewers.every((r) => r.decision === "approved"),
    [requiredReviewers],
  );

  // The merge gate: every required approval in, and (if high blast) acknowledged.
  const mergeGateOpen = approvalsMet && (!isHighBlast || acknowledged);

  async function act(action: ApprovalAction) {
    setError(null);
    setBusy(action);
    const res = await submitApproval(
      pr.id,
      { action, blastRadiusAcknowledged: acknowledged },
      authHeaders(),
    );
    setBusy(null);
    if (!res.ok) {
      setError(
        res.code === "BLAST_ACK_REQUIRED"
          ? "Acknowledge the high blast-radius warning to merge."
          : res.code === "EVALS_FAILED"
            ? "Context evals are failing — see the Evals panel. Resolve regressions before approving."
            : res.error,
      );
      return;
    }
    router.refresh();
  }

  if (isTerminal) {
    return (
      <section className="rounded-xl border border-black/5 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Approval</h2>
        <p className="mt-2 text-sm text-slate-600">
          This change request is{" "}
          <span className="font-medium">{pr.status === "merged" ? "merged" : "rejected"}</span>.
          {pr.status === "merged" &&
            " The autosaves were squashed into a single semantic change on the main context."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-black/5 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Approval routing</h2>

      {/* Reviewer roster */}
      <ul className="space-y-1.5">
        {pr.reviewers.map((r) => {
          const d = DECISION_MARK[r.decision] ?? DECISION_MARK.pending!;
          return (
            <li key={r.author.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <AuthorBadge author={r.author} />
                {r.required && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-muted">
                    required
                  </span>
                )}
              </div>
              <span className={`flex items-center gap-1 font-medium ${d.className}`}>
                <span aria-hidden>{d.icon}</span> {d.label}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="h-px bg-black/5" />

      {/* Session identity — the server enforces who can act */}
      {!user ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Sign in
          </Link>{" "}
          to review this change request.
        </p>
      ) : !isReviewer ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Signed in as <span className="font-medium">{user.name}</span> — you’re not a reviewer on
          this request, so you can’t act on it.
        </p>
      ) : (
        <p className="text-xs text-muted">
          Reviewing as <span className="font-medium text-ink">{user.name}</span>
        </p>
      )}

      {/* High blast-radius merge gate */}
      {isHighBlast && (
        <label className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            I understand this is a <strong>high blast-radius</strong> change and have reviewed the
            affected agents above.
          </span>
        </label>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      {/* Actions — only an actual reviewer can act */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => act("approve")}
          disabled={busy !== null || !isReviewer}
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy === "approve"
            ? "Submitting…"
            : mergeGateOpen
              ? "Approve & merge"
              : approvalsMet
                ? "Approve (acknowledge to merge)"
                : "Approve"}
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => act("request_changes")}
            disabled={busy !== null || !isReviewer}
            className="flex-1 rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-ink transition hover:bg-black/[0.03] disabled:opacity-40"
          >
            Request changes
          </button>
          <button
            onClick={() => act("reject")}
            disabled={busy !== null || !isReviewer}
            className="flex-1 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      </div>

      <p className="text-xs text-muted">
        {approvalsMet
          ? "All required reviewers have approved."
          : "Merge unlocks once every required reviewer approves."}{" "}
        On approval, drafts are squashed into one semantic change — no Git knowledge needed.
      </p>
    </section>
  );
}
