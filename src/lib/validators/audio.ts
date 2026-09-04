export const ACCEPTED_EXTENSIONS = ["mp3", "m4a", "wav"] as const;
export const ACCEPTED_MIME_TYPES = ["audio/mpeg", "audio/mp4", "audio/m4a", "audio/wav", "audio/x-wav"] as const;
export const MAX_AUDIO_BYTES = 104_857_600;
export const MAX_AUDIO_DURATION_MS = 600_000;

export type AudioValidation = { valid: true } | { valid: false; code: string; message: string };

export function validateAudioFileMetadata(file: Pick<File, "name" | "size" | "type">): AudioValidation {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    return { valid: false, code: "FILE_TYPE_UNSUPPORTED", message: "mp3, m4a, wav 파일만 올릴 수 있습니다." };
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return { valid: false, code: "MIME_MISMATCH", message: "파일 확장자와 실제 음성 형식을 확인해 주세요." };
  }
  if (file.size <= 0) return { valid: false, code: "FILE_EMPTY", message: "빈 파일은 올릴 수 없습니다." };
  if (file.size > MAX_AUDIO_BYTES) return { valid: false, code: "FILE_TOO_LARGE", message: "파일은 100MB 이하여야 합니다." };
  return { valid: true };
}

export function validateAudioDuration(durationMs: number): AudioValidation {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return { valid: false, code: "AUDIO_DAMAGED", message: "재생할 수 없는 음성 파일입니다." };
  if (durationMs > MAX_AUDIO_DURATION_MS) return { valid: false, code: "AUDIO_TOO_LONG", message: "음성 길이는 10분 이하여야 합니다." };
  return { valid: true };
}
