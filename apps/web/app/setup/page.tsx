import { getWorkspace } from "@/lib/api";
import { SetupWizard } from "@/components/setup/SetupWizard";
import type { WorkspaceInfo } from "@context-studio/types";

export const dynamic = process.env.STATIC_EXPORT === "1" ? "force-static" : "force-dynamic";

export default async function SetupPage() {
  let initial: WorkspaceInfo = { configured: false, sources: [], documents: [], agents: [] };
  try {
    initial = await getWorkspace();
  } catch {
    // Backend unreachable — wizard still renders with empty defaults.
  }
  return <SetupWizard initial={initial} />;
}
