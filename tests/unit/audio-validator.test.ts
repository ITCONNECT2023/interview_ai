import { describe, expect, it } from "vitest";
import { validateAudioDuration, validateAudioFileMetadata } from "@/lib/validators/audio";

describe("audio validation", () => {
  it("accepts an allowed audio file", () => {
    expect(validateAudioFileMetadata({ name: "interview.mp3", size: 1024, type: "audio/mpeg" } as File)).toEqual({ valid: true });
    expect(validateAudioDuration(600_000)).toEqual({ valid: true });
  });

  it("rejects unsupported, oversized, and over-ten-minute files", () => {
    expect(validateAudioFileMetadata({ name: "interview.exe", size: 1024, type: "application/octet-stream" } as File)).toMatchObject({ valid: false, code: "FILE_TYPE_UNSUPPORTED" });
    expect(validateAudioFileMetadata({ name: "interview.wav", size: 104_857_601, type: "audio/wav" } as File)).toMatchObject({ valid: false, code: "FILE_TOO_LARGE" });
    expect(validateAudioDuration(600_001)).toMatchObject({ valid: false, code: "AUDIO_TOO_LONG" });
  });
});
