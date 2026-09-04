import { get } from "@vercel/blob";
import { FatalError } from "workflow";
import { getJob, patchJob, saveTranscript } from "@/lib/db/repository";
import { getServerEnv, requireServerEnv } from "@/lib/env/server";
import { getGeminiClient, GEMINI_MODEL } from "@/lib/gemini/client";
import { TRANSCRIPT_SYSTEM_PROMPT, TRANSCRIPT_USER_PROMPT } from "@/lib/gemini/prompts/transcript";
import { transcriptJsonSchema, transcriptResultSchema } from "@/lib/schemas/gemini";
import { isLocalAudioUrl, readLocalAudio } from "@/lib/storage/audio";
import { validateTranscriptEvidence } from "@/lib/validators/evidence";
import type { TranscriptResult } from "@/types/job";

export async function setProcessingStage(jobId: string, stage: string, stageIndex: number) {
  "use step";
  await patchJob(jobId, { status: "PROCESSING", stage, stageIndex, error: undefined });
}

export async function loadProcessingInput(jobId: string) {
  "use step";
  const job = await getJob(jobId);
  if (!job || job.status === "DELETED" || job.status === "DELETING") throw new FatalError("작업 입력이 없거나 삭제되었습니다.");
  if (job.bytes > getServerEnv().MAX_AUDIO_BYTES || job.durationMsFromClient > getServerEnv().MAX_AUDIO_DURATION_SECONDS * 1000) throw new FatalError("AUDIO_INVALID");
  return { blobUrl: job.blobUrl, mimeType: job.mimeType, originalName: job.originalName };
}

export async function uploadAudioToGemini(input: { blobUrl: string; mimeType: string; originalName: string }) {
  "use step";
  let bytes: ArrayBuffer;
  if (isLocalAudioUrl(input.blobUrl)) {
    const localBytes = await readLocalAudio(input.blobUrl);
    bytes = localBytes.buffer.slice(localBytes.byteOffset, localBytes.byteOffset + localBytes.byteLength) as ArrayBuffer;
  } else {
    const token = requireServerEnv("BLOB_READ_WRITE_TOKEN");
    const result = await get(input.blobUrl, { access: "private", token, useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) throw new Error("BLOB_NOT_FOUND");
    bytes = await new Response(result.stream).arrayBuffer();
  }
  const audio = new Blob([bytes], { type: input.mimeType });
  const file = await getGeminiClient().files.upload({ file: audio, config: { mimeType: input.mimeType, displayName: "interview-audio" } });
  if (!file.name || !file.uri) throw new Error("GEMINI_FILE_UPLOAD_FAILED");
  return { name: file.name, uri: file.uri, mimeType: file.mimeType ?? input.mimeType };
}

export async function transcribeAudio(file: { uri: string; mimeType: string }): Promise<TranscriptResult> {
  "use step";
  const interaction = await getGeminiClient().interactions.create({
    model: GEMINI_MODEL,
    store: false,
    input: [
      { type: "text", text: TRANSCRIPT_USER_PROMPT },
      { type: "audio", uri: file.uri, mime_type: file.mimeType },
    ],
    system_instruction: TRANSCRIPT_SYSTEM_PROMPT,
    response_format: { type: "text", mime_type: "application/json", schema: transcriptJsonSchema },
  });
  if (!interaction.output_text) throw new Error("GEMINI_EMPTY_RESPONSE");
  const result = transcriptResultSchema.parse(JSON.parse(interaction.output_text)) as TranscriptResult;
  const validationErrors = validateTranscriptEvidence(result);
  if (validationErrors.length) throw new Error(`TRANSCRIPT_VALIDATION_FAILED:${validationErrors.join("|")}`);
  return result;
}
transcribeAudio.maxRetries = 2;

export async function validateAndSaveTranscript(jobId: string, result: TranscriptResult) {
  "use step";
  const errors = validateTranscriptEvidence(result);
  if (errors.length) throw new FatalError(`EVIDENCE_INVALID:${errors.join("|")}`);
  await saveTranscript(jobId, {
    ...result,
    segments: result.segments.map((segment) => ({ ...segment, originalText: segment.text, reviewed: segment.flags.length === 0 })),
  });
}

export async function deleteGeminiFile(name: string) {
  "use step";
  await getGeminiClient().files.delete({ name });
}

export async function markProcessingFailed(jobId: string, message: string) {
  "use step";
  const validationFailed = message.includes("TRANSCRIPT_VALIDATION_FAILED") || message.includes("EVIDENCE_INVALID");
  const detail = message.replace(/^.*(?:TRANSCRIPT_VALIDATION_FAILED|EVIDENCE_INVALID):?/, "").trim();
  const userMessage = validationFailed
    ? `Gemini 전사 결과의 타임코드 또는 근거 연결이 유효하지 않습니다.${detail ? ` ${detail}` : ""}`
    : message === "UNKNOWN" ? "전사 작업의 상세 오류를 가져오지 못했습니다. 같은 파일로 다시 시도해 주세요." : message;
  await patchJob(jobId, {
    status: "FAILED",
    stage: "전사 실패",
    error: {
      code: validationFailed ? "TRANSCRIPT_VALIDATION_FAILED" : "TRANSCRIPTION_FAILED",
      message: userMessage.slice(0, 240),
      retryable: true,
    },
  });
}
