import Link from "next/link";
import { getContextPr } from "@/lib/api";
import { PRHeader } from "@/components/cpr/PRHeader";
import { SemanticDiff } from "@/components/cpr/SemanticDiff";
import { BlastRadius } from "@/components/cpr/BlastRadius";
import { EvalsPanel } from "@/components/cpr/EvalsPanel";
import { ApprovalPanel } from "@/components/cpr/ApprovalPanel";

export const dynamic = "force-dynamic";

export default async function ContextPrPage({
  params,
}: {
  params: { id: string };
}) {
  let pr;
  try {
    pr = await getContextPr(params.id);
  } catch {
    return (
      <ErrorState
        title="Couldn’t reach the backend"
        body="Is the server running? Start it with `pnpm dev:server` (default http://localhost:4000)."
      />
    );
  }

  if (!pr) {
    return (
      <ErrorState
        title="Change request not found"
        body={`No Context PR with id “${params.id}”. Try the seeded sample, pr-001.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All change requests
      </Link>

      <PRHeader pr={pr} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <SemanticDiff diff={pr.diff} />
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <BlastRadius blast={pr.blastRadius} />
          <EvalsPanel prId={pr.id} />
          <ApprovalPanel pr={pr} />
        </aside>
      </div>
    </div>
  );
}

function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-lg font-semibold text-amber-900">{title}</h1>
      <p className="mt-1 text-sm text-amber-800">{body}</p>
      <Link href="/" className="mt-3 inline-block text-sm font-medium text-amber-900 underline">
        Back to start
      </Link>
    </div>
  );
}
