import type {
  ApprovalRequestBody,
  ApprovalResponse,
  AutosaveResponse,
  ConfigureWorkspaceBody,
  ContextPR,
  ContextPrSummary,
  DocumentView,
  FreshnessOverview,
  ReviewTicket,
  WorkspaceInfo,
} from "@context-studio/types";

/** Base URL of the abstracted version-control backend (apps/server). */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

/** Fetch a full Context PR for the review screen (server-side, uncached). */
export async function getContextPr(id: string): Promise<ContextPR | null> {
  const res = await fetch(`${API_BASE}/api/context/pr/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load Context PR ${id}: ${res.status}`);
  return (await res.json()) as ContextPR;
}

/** Current workspace binding (server-side, uncached). */
export async function getWorkspace(): Promise<WorkspaceInfo> {
  const res = await fetch(`${API_BASE}/api/context/workspace`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load workspace: ${res.status}`);
  return (await res.json()) as WorkspaceInfo;
}

/** Bind to an external context store (client-side). */
export async function configureWorkspace(
  body: ConfigureWorkspaceBody,
): Promise<{ ok: true; data: WorkspaceInfo } | { ok: false; error: string }> {
  const res = await fetch(`${API_BASE}/api/context/workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: typeof json.error === "string" ? json.error : "Failed." };
  }
  return { ok: true, data: json as WorkspaceInfo };
}

/** List all Context PRs for the dashboard (server-side, uncached). */
export async function listContextPrs(): Promise<ContextPrSummary[]> {
  const res = await fetch(`${API_BASE}/api/context/pr`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list Context PRs: ${res.status}`);
  return (await res.json()) as ContextPrSummary[];
}

/** Freshness overview for the governance screen. */
export async function getFreshnessOverview(): Promise<FreshnessOverview> {
  const res = await fetch(`${API_BASE}/api/context/governance/freshness`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load freshness: ${res.status}`);
  return (await res.json()) as FreshnessOverview;
}

/** Open review tickets for the governance screen. */
export async function listTickets(): Promise<ReviewTicket[]> {
  const res = await fetch(`${API_BASE}/api/context/governance/tickets`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load tickets: ${res.status}`);
  return (await res.json()) as ReviewTicket[];
}

/** Load a document for the editor (content + per-block attribution). */
export async function getDocumentView(
  path: string,
  as: string,
): Promise<DocumentView | null> {
  const res = await fetch(
    `${API_BASE}/api/context/doc/view?path=${encodeURIComponent(path)}&as=${encodeURIComponent(as)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load document: ${res.status}`);
  return (await res.json()) as DocumentView;
}

/** Transparent autosave (client-side). */
export async function autosaveDoc(body: {
  documentPath: string;
  content: string;
  authorId: string;
}): Promise<AutosaveResponse> {
  const res = await fetch(`${API_BASE}/api/context/doc/autosave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Autosave failed: ${res.status}`);
  return (await res.json()) as AutosaveResponse;
}

/** Promote a draft into an in-review Context PR (client-side). */
export async function proposeChange(body: {
  draftPrId: string;
  title: string;
  description: string;
}): Promise<{ prId: string }> {
  const res = await fetch(`${API_BASE}/api/context/doc/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Propose failed: ${res.status}`);
  return (await res.json()) as { prId: string };
}

export const exportUrls = {
  llmsTxt: `${API_BASE}/api/context/export/llms.txt`,
  fcontext: `${API_BASE}/api/context/export/fcontext`,
};

/** Submit an approval decision (client-side). */
export async function submitApproval(
  id: string,
  body: ApprovalRequestBody,
): Promise<{ ok: true; data: ApprovalResponse } | { ok: false; error: string; code?: string }> {
  const res = await fetch(`${API_BASE}/api/context/pr/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: typeof json.error === "string" ? json.error : "Request failed.",
      code: json.code,
    };
  }
  return { ok: true, data: json as ApprovalResponse };
}
