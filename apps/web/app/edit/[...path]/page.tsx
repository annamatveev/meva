import Link from "next/link";
import { getDocumentView } from "@/lib/api";
import { Editor } from "@/components/editor/Editor";

export const dynamic = "force-dynamic";

const ACTING_USER = "user-dana";

export default async function EditPage({
  params,
}: {
  params: { path: string[] };
}) {
  const documentPath = params.path.map(decodeURIComponent).join("/");

  let doc;
  try {
    doc = await getDocumentView(documentPath, ACTING_USER);
  } catch {
    return (
      <ErrorState title="Couldn’t reach the backend" body="Start the server and reload." />
    );
  }

  if (!doc) {
    return (
      <ErrorState
        title="Document not found"
        body={`No document at “${documentPath}”. Try policies/refunds.md.`}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← All change requests
      </Link>
      <Editor doc={doc} />
    </div>
  );
}

function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
      <h1 className="text-lg font-semibold text-amber-900">{title}</h1>
      <p className="mt-1 text-sm text-amber-800">{body}</p>
    </div>
  );
}
