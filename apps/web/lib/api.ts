import type {
  ApprovalAction,
  ApprovalResponse,
  AuthConfig,
  AutosaveResponse,
  LoginResponse,
  SessionUser,
  ConfigureWorkspaceBody,
  ContextPR,
  ContextPrSummary,
  DistributionStatus,
  DocumentView,
  EvalReport,
  FreshnessOverview,
  ReviewTicket,
  WorkspaceInfo,
} from "@context-studio/types";
import { DEMO, demo } from "./demo";

// The backend has two reachable addresses when containerized:
//  - browser  → the host-published URL (NEXT_PUBLIC_API_BASE, inlined at build)
//  - SSR       → the internal Docker-network URL (API_INTERNAL_BASE)
// apiBase() picks the right one based on where the fetch runs.
const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
const INTERNAL_BASE = process.env.API_INTERNAL_BASE ?? PUBLIC_BASE;

function apiBase(): string {
  return typeof window === "undefined" ? INTERNAL_BASE : PUBLIC_BASE;
}

/** Browser-facing base — for links the user clicks (must be host-reachable). */
export const API_BASE = PUBLIC_BASE;

/** Fetch a full Context PR for the review screen (server-side, uncached). */
export async function getContextPr(id: string): Promise<ContextPR | null> {
  if (DEMO) return demo.getContextPr(id);
  const res = await fetch(`${apiBase()}/api/context/pr/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load Context PR ${id}: ${res.status}`);
  return (await res.json()) as ContextPR;
}

/** Run the regression evals for a PR's proposed change. */
export async function getEvals(id: string): Promise<EvalReport> {
  if (DEMO) return demo.getEvals();
  const res = await fetch(`${apiBase()}/api/context/pr/${id}/evals`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to run evals: ${res.status}`);
  return (await res.json()) as EvalReport;
}

/** Current workspace binding (server-side, uncached). */
export async function getWorkspace(): Promise<WorkspaceInfo> {
  if (DEMO) return demo.getWorkspace();
  const res = await fetch(`${apiBase()}/api/context/workspace`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load workspace: ${res.status}`);
  return (await res.json()) as WorkspaceInfo;
}

/** Bind to an external context store (client-side; requires Owner). */
export async function configureWorkspace(
  body: ConfigureWorkspaceBody,
  authHeader: Record<string, string>,
): Promise<{ ok: true; data: WorkspaceInfo } | { ok: false; error: string }> {
  if (DEMO) return demo.configureWorkspace();
  const res = await fetch(`${apiBase()}/api/context/workspace`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
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
  if (DEMO) return demo.listContextPrs();
  const res = await fetch(`${apiBase()}/api/context/pr`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list Context PRs: ${res.status}`);
  return (await res.json()) as ContextPrSummary[];
}

/** Freshness overview for the governance screen. */
export async function getFreshnessOverview(): Promise<FreshnessOverview> {
  if (DEMO) return demo.getFreshnessOverview();
  const res = await fetch(`${apiBase()}/api/context/governance/freshness`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load freshness: ${res.status}`);
  return (await res.json()) as FreshnessOverview;
}

/** Open review tickets for the governance screen. */
export async function listTickets(): Promise<ReviewTicket[]> {
  if (DEMO) return demo.listTickets();
  const res = await fetch(`${apiBase()}/api/context/governance/tickets`, {
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
  if (DEMO) return demo.getDocumentView();
  const res = await fetch(
    `${apiBase()}/api/context/doc/view?path=${encodeURIComponent(path)}&as=${encodeURIComponent(as)}`,
    { cache: "no-store" },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load document: ${res.status}`);
  return (await res.json()) as DocumentView;
}

/** Transparent autosave (client-side, requires the `propose` permission). */
export async function autosaveDoc(
  body: { documentPath: string; content: string; authorId: string },
  authHeader: Record<string, string>,
): Promise<AutosaveResponse> {
  if (DEMO) return demo.autosaveDoc();
  const res = await fetch(`${apiBase()}/api/context/doc/autosave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Autosave failed: ${res.status}`);
  return (await res.json()) as AutosaveResponse;
}

/** Promote a draft into an in-review Context PR (client-side). */
export async function proposeChange(
  body: { draftPrId: string; title: string; description: string },
  authHeader: Record<string, string>,
): Promise<{ prId: string }> {
  if (DEMO) return demo.proposeChange();
  const res = await fetch(`${apiBase()}/api/context/doc/propose`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Propose failed: ${res.status}`);
  return (await res.json()) as { prId: string };
}

/** Current published distribution bundle status. */
export async function getDistribution(): Promise<DistributionStatus> {
  if (DEMO) return demo.getDistribution();
  const res = await fetch(`${apiBase()}/api/context/distribution`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load distribution: ${res.status}`);
  return (await res.json()) as DistributionStatus;
}

/** Re-publish signed per-agent slices (client-side; requires Owner). */
export async function publishDistribution(
  authHeader: Record<string, string>,
): Promise<DistributionStatus> {
  if (DEMO) return demo.publishDistribution();
  const res = await fetch(`${apiBase()}/api/context/distribution/publish`, {
    method: "POST",
    headers: { ...authHeader },
  });
  if (!res.ok) throw new Error(`Publish failed: ${res.status}`);
  return (await res.json()) as DistributionStatus;
}

export const exportUrls = DEMO
  ? { llmsTxt: "#", fcontext: "#", ledgerCsv: "#" }
  : {
      llmsTxt: `${API_BASE}/api/context/export/llms.txt`,
      fcontext: `${API_BASE}/api/context/export/fcontext`,
      ledgerCsv: `${API_BASE}/api/context/export/ledger.csv`,
    };

// --- Auth (Module 7) -----------------------------------------------------

/** Which login methods the server offers. */
export async function getAuthConfig(): Promise<AuthConfig> {
  if (DEMO) return demo.getAuthConfig();
  const res = await fetch(`${apiBase()}/api/context/auth/config`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load auth config: ${res.status}`);
  return (await res.json()) as AuthConfig;
}

/** Resolve the current session from a token (used after the SSO redirect). */
export async function getMe(token: string): Promise<SessionUser> {
  if (DEMO) return demo.getMe();
  const res = await fetch(`${apiBase()}/api/context/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Not authenticated: ${res.status}`);
  return ((await res.json()) as { user: SessionUser }).user;
}

/** Browser-facing URL that starts the Google SSO flow. */
export const googleLoginUrl = `${API_BASE}/api/context/auth/google/login`;

/** Selectable human identities for the login picker (dev fallback). */
export async function getUsers(): Promise<SessionUser[]> {
  if (DEMO) return demo.getUsers();
  const res = await fetch(`${apiBase()}/api/context/auth/users`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
  return (await res.json()) as SessionUser[];
}

/** Log in as an author (issues a session token). */
export async function login(authorId: string): Promise<LoginResponse> {
  if (DEMO) return demo.login(authorId);
  const res = await fetch(`${apiBase()}/api/context/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authorId }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return (await res.json()) as LoginResponse;
}

/**
 * Submit an approval decision. The acting reviewer is derived from the session
 * token (authHeader), never the body — you can only act as yourself.
 */
export async function submitApproval(
  id: string,
  body: { action: ApprovalAction; blastRadiusAcknowledged?: boolean },
  authHeader: Record<string, string>,
): Promise<{ ok: true; data: ApprovalResponse } | { ok: false; error: string; code?: string }> {
  if (DEMO) return demo.submitApproval();
  const res = await fetch(`${apiBase()}/api/context/pr/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
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
