import { describe, expect, it } from "vitest";
import { demoDraft, demoTranscript } from "@/lib/demo-data";
import { validateArticleEvidence, validateTranscriptEvidence } from "@/lib/validators/evidence";

describe("evidence validators", () => {
  it("accepts grounded demo results", () => {
    expect(validateTranscriptEvidence(demoTranscript)).toEqual([]);
    expect(validateArticleEvidence(demoDraft, demoTranscript)).toEqual([]);
  });

  it("blocks overlapping transcript timestamps", () => {
    const transcript = structuredClone(demoTranscript);
    transcript.segments[1].startMs = transcript.segments[0].endMs - 1;
    expect(validateTranscriptEvidence(transcript)).toContain(`타임코드 오류: ${transcript.segments[1].id}`);
  });

  it("blocks modified direct quotes", () => {
    const draft = structuredClone(demoDraft);
    draft.paragraphs[1].text = "정부 관계자는 “기본 방침은 완전히 바뀌었습니다.”라고 말했다.";
    expect(validateArticleEvidence(draft, demoTranscript)).toContain("변형되거나 누락된 인용: QUOTE-001");
  });

  it("blocks numbers missing from source segments", () => {
    const draft = structuredClone(demoDraft);
    draft.paragraphs[0].text = "정부는 999억원을 확정했다.";
    expect(validateArticleEvidence(draft, demoTranscript)).toContain("전사에 없는 수치: 999억원");
  });
});
