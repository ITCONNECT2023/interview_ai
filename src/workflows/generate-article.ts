import { generateGroundedDraft, loadDraftInput, markDraftFailed, setDraftStage, validateAndSaveDraft } from "@/workflows/steps/generate-article";

export async function generateArticleWorkflow(jobId: string, transcriptVersion: number) {
  "use workflow";
  try {
    const transcript = await loadDraftInput(jobId, transcriptVersion);
    await setDraftStage(jobId, "리드 생성", 1);
    await setDraftStage(jobId, "본문 구조 생성", 2);
    await setDraftStage(jobId, "본문 초안 생성", 3);
    const draft = await generateGroundedDraft(transcript, transcriptVersion);
    await setDraftStage(jobId, "근거 검증", 4);
    await validateAndSaveDraft(jobId, draft, transcript);
    return { jobId, status: "DRAFT_READY" as const };
  } catch (error) {
    await markDraftFailed(jobId, error instanceof Error ? error.message : "UNKNOWN");
    throw error;
  }
}
