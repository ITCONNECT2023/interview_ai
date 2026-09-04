import { AppShell } from "@/components/shell/app-shell";
import { TranscriptWorkspace } from "@/components/transcript/transcript-workspace";

export default async function TranscriptPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AppShell active={3}><TranscriptWorkspace jobId={jobId} /></AppShell>;
}
