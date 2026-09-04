import { FatalError } from "workflow";
import { getJob, patchJob, saveDraft } from "@/lib/db/repository";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini/client";
import { ARTICLE_SYSTEM_PROMPT } from "@/lib/gemini/prompts/article";
import { articleDraftResultSchema, articleJsonSchema } from "@/lib/schemas/gemini";
import { validateArticleEvidence, validateTranscriptEvidence } from "@/lib/validators/evidence";
import type { ArticleDraftResult, TranscriptResult } from "@/types/job";

export async function loadDraftInput(jobId: string, transcriptVersion: number): Promise<TranscriptResult> {
  "use step";
  const job = await getJob(jobId);
  if (!job?.transcript) throw new FatalError("TRANSCRIPT_NOT_FOUND");
  if (job.transcriptVersion !== transcriptVersion) throw new FatalError("STALE_TRANSCRIPT");
  if (validateTranscriptEvidence(job.transcript).length) throw new FatalError("EVIDENCE_INVALID");
  return job.transcript;
}

export async function setDraftStage(jobId: string, stage: string, stageIndex: number) {
  "use step";
  await patchJob(jobId, { status: "DRAFTING", stage, stageIndex, error: undefined });
}

export async function generateGroundedDraft(transcript: TranscriptResult, transcriptVersion: number): Promise<ArticleDraftResult> {
  "use step";
  const interaction = await getGeminiClient().interactions.create({
    model: GEMINI_MODEL,
    store: false,
    system_instruction: ARTICLE_SYSTEM_PROMPT,
    input: `다음 검토 전사 JSON만 근거로 작성하라. transcriptVersion은 ${transcriptVersion}이다.\n${JSON.stringify(transcript)}`,
    response_format: { type: "text", mime_type: "application/json", schema: articleJsonSchema },
  });
  if (!interaction.output_text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return articleDraftResultSchema.parse(JSON.parse(interaction.output_text)) as ArticleDraftResult;
}
generateGroundedDraft.maxRetries = 3;

export async function validateAndSaveDraft(jobId: string, draft: ArticleDraftResult, transcript: TranscriptResult) {
  "use step";
  const errors = validateArticleEvidence(draft, transcript);
  if (errors.length) throw new FatalError(`ARTICLE_EVIDENCE_INVALID:${errors.join("|")}`);
  await saveDraft(jobId, draft);
}

export async function markDraftFailed(jobId: string, message: string) {
  "use step";
  await patchJob(jobId, { status: "FAILED", stage: "초안 생성 실패", error: { code: "DRAFT_FAILED", message: message.slice(0, 160), retryable: true } });
}
