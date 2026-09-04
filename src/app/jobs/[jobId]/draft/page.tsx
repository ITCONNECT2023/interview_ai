import { DraftWorkspace } from "@/components/draft/draft-workspace";
import { AppShell } from "@/components/shell/app-shell";

export default async function DraftPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AppShell active={4}><DraftWorkspace jobId={jobId} /></AppShell>;
}
