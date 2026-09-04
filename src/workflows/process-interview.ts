import {
  deleteGeminiFile,
  loadProcessingInput,
  markProcessingFailed,
  setProcessingStage,
  transcribeAudio,
  uploadAudioToGemini,
  validateAndSaveTranscript,
} from "@/workflows/steps/process-interview";

export async function processInterviewWorkflow(jobId: string) {
  "use workflow";
  let geminiFileName: string | undefined;
  try {
    await setProcessingStage(jobId, "업로드 확인", 1);
    const input = await loadProcessingInput(jobId);
    await setProcessingStage(jobId, "화자 분리", 2);
    const file = await uploadAudioToGemini(input);
    geminiFileName = file.name;
    await setProcessingStage(jobId, "음성 전사", 3);
    const transcript = await transcribeAudio(file);
    await setProcessingStage(jobId, "전사 기반 분석", 4);
    await setProcessingStage(jobId, "결과 저장", 5);
    await validateAndSaveTranscript(jobId, transcript);
    return { jobId, status: "TRANSCRIPT_READY" as const };
  } catch (error) {
    await markProcessingFailed(jobId, error instanceof Error ? error.message : "UNKNOWN");
    throw error;
  } finally {
    if (geminiFileName) await deleteGeminiFile(geminiFileName);
  }
}
