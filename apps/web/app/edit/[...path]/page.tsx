import { getDocumentView, getInsights, getWorkspace } from "@/lib/api";
import { Editor } from "@/components/editor/Editor";
import { DEMO_DOC_PATHS } from "@/lib/demo";

export const dynamic = process.env.STATIC_EXPORT === "1" ? "force-static" : "force-dynamic";

// For the static (GitHub Pages) demo, pre-render every demo document.
export function generateStaticParams() {
  return process.env.STATIC_EXPORT === "1"
    ? DEMO_DOC_PATHS.map((p) => ({ path: p.split("/") }))
    : [];
}

const ACTING_USER = "user-dana";

export default async function EditPage({
  params,
}: {
  params: { path: string[] };
}) {
  const documentPath = params.path.map(decodeURIComponent).join("/");

  let doc;
  let files: Array<{ path: string; kind: string }> = [];
  let fileReads: number | undefined;
  try {
    const [d, f, insights] = await Promise.all([
      getDocumentView(documentPath, ACTING_USER),
      getWorkspace().then((w) => w.files).catch(() => []),
      getInsights().catch(() => null),
    ]);
    doc = d;
    files = f;
    fileReads = insights?.files.find((x) => x.path === documentPath)?.reads;
  } catch {
    return <ErrorState title="Couldn’t reach the backend" body="Start the server and reload." />;
  }

  if (!doc) {
    return (
      <ErrorState
        title="Document not found"
        body={`No document at “${documentPath}”. Try policies/refunds.md.`}
      />
    );
  }

  return <Editor doc={doc} files={files} currentPath={documentPath} fileReads={fileReads} />;
}

function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
      <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">{title}</h1>
      <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">{body}</p>
    </div>
  );
}
