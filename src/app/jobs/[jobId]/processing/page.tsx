import { ProcessingWorkspace } from "@/components/processing/processing-workspace";
import { AppShell } from "@/components/shell/app-shell";

export default async function ProcessingPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AppShell active={2}><ProcessingWorkspace jobId={jobId} /></AppShell>;
}
