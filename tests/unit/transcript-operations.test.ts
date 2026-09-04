import { describe, expect, it } from "vitest";
import { demoTranscript } from "@/lib/demo-data";
import { applyTranscriptOperations } from "@/lib/transcript/operations";

describe("transcript operations", () => {
  it("preserves the original when a reporter edits text", () => {
    const result = applyTranscriptOperations(demoTranscript, [{ type: "UPDATE_TEXT", segmentId: "SEG-001", text: "수정한 질문입니다." }]);
    expect(result.segments[0].text).toBe("수정한 질문입니다.");
    expect(result.segments[0].originalText).toBe(demoTranscript.segments[0].text);
  });

  it("does not register a quote containing unclear text", () => {
    expect(() => applyTranscriptOperations(demoTranscript, [{ type: "ADD_QUOTE", segmentId: "SEG-003", quote: demoTranscript.segments[2].text }])).toThrow("QUOTE_INVALID");
  });

  it("splits a segment without overlapping timecodes", () => {
    const source = demoTranscript.segments[0];
    const atMs = Math.round((source.startMs + source.endMs) / 2);
    const result = applyTranscriptOperations(demoTranscript, [{ type: "SPLIT", segmentId: source.id, atMs }]);
    expect(result.segments).toHaveLength(demoTranscript.segments.length + 1);
    expect(result.segments[0].endMs).toBe(result.segments[1].startMs);
  });
});
