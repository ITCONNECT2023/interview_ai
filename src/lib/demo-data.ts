import type { ArticleDraftResult, JobRecord, TranscriptResult } from "@/types/job";

export const demoTranscript: TranscriptResult = {
  schemaVersion: "1.0",
  durationMs: 167_000,
  segments: [
    { id: "SEG-001", speaker: "B", startMs: 8_000, endMs: 34_000, text: "이번 제도 개편의 핵심 목표와 시행 시기를 설명해 주시겠습니까?", originalText: "이번 제도 개편의 핵심 목표와 시행 시기를 설명해 주시겠습니까?", confidence: 0.98, flags: [], reviewed: true },
    { id: "SEG-002", speaker: "A", startMs: 35_000, endMs: 78_000, text: "정부의 기본 방침은 현장 혼선을 줄이는 것입니다. 시행 시기는 관계 부처와 업계 의견을 수렴해 조율할 여지가 있습니다.", originalText: "정부의 기본 방침은 현장 혼선을 줄이는 것입니다. 시행 시기는 관계 부처와 업계 의견을 수렴해 조율할 여지가 있습니다.", confidence: 0.96, flags: [], reviewed: true },
    { id: "SEG-003", speaker: "B", startMs: 80_000, endMs: 112_000, text: "예산 규모가 [불명확] 원이라고 들렸는데 확정된 수치입니까?", originalText: "예산 규모가 [불명확] 원이라고 들렸는데 확정된 수치입니까?", confidence: 0.62, flags: ["UNCLEAR_AUDIO", "UNCLEAR_NUMBER"], reviewed: false },
    { id: "SEG-004", speaker: "A", startMs: 114_000, endMs: 158_000, text: "예산은 아직 관계 부처 협의 중이며 확정된 수치는 아닙니다. 확정 뒤 별도로 공개하겠습니다.", originalText: "예산은 아직 관계 부처 협의 중이며 확정된 수치는 아닙니다. 확정 뒤 별도로 공개하겠습니다.", confidence: 0.95, flags: [], reviewed: true },
  ],
  keyStatements: [
    { id: "KEY-001", text: "제도 개편의 목표는 현장 혼선을 줄이는 것이다.", sourceSegmentIds: ["SEG-002"] },
    { id: "KEY-002", text: "시행 시기는 관계 부처·업계 의견에 따라 조율될 수 있다.", sourceSegmentIds: ["SEG-002"] },
  ],
  quoteCandidates: [
    { id: "QUOTE-001", text: "정부의 기본 방침은 현장 혼선을 줄이는 것입니다.", quote: "정부의 기본 방침은 현장 혼선을 줄이는 것입니다.", sourceSegmentIds: ["SEG-002"], speaker: "A", startMs: 35_000, endMs: 78_000 },
    { id: "QUOTE-002", text: "예산은 아직 관계 부처 협의 중이며 확정된 수치는 아닙니다.", quote: "예산은 아직 관계 부처 협의 중이며 확정된 수치는 아닙니다.", sourceSegmentIds: ["SEG-004"], speaker: "A", startMs: 114_000, endMs: 158_000 },
  ],
  facts: [
    { id: "FACT-001", text: "예산 수치는 아직 확정되지 않았다.", sourceSegmentIds: ["SEG-004"] },
  ],
  reviewItems: [
    { id: "REVIEW-001", text: "질문에 언급된 예산 규모의 음성이 불명확하다.", sourceSegmentIds: ["SEG-003"], reason: "UNCLEAR_NUMBER", resolved: false },
  ],
};

export const demoDraft: ArticleDraftResult = {
  schemaVersion: "1.0",
  transcriptVersion: 1,
  selectedLeadType: "FACT",
  leads: {
    fact: { text: "정부가 현장 혼선을 줄이는 방향으로 제도 개편을 추진하며 시행 시기는 관계 부처와 업계 의견을 수렴해 조율할 수 있다고 밝혔다.", sourceSegmentIds: ["SEG-002"], quoteCandidateIds: [] },
    quote: { text: "“정부의 기본 방침은 현장 혼선을 줄이는 것입니다.” 정부는 제도 개편의 시행 시기를 관계 부처와 업계 의견에 따라 조율할 수 있다고 설명했다.", sourceSegmentIds: ["SEG-002"], quoteCandidateIds: ["QUOTE-001"] },
    issue: { text: "제도 개편의 시행 시기와 예산이 아직 확정되지 않은 가운데 정부는 현장 혼선을 줄이겠다는 원칙을 제시했다.", sourceSegmentIds: ["SEG-002", "SEG-004"], quoteCandidateIds: [] },
  },
  outline: [
    { order: 1, heading: "개편 방향", purpose: "정부가 밝힌 목표를 전달한다.", sourceSegmentIds: ["SEG-002"], analysisItemIds: ["KEY-001"] },
    { order: 2, heading: "시행 일정", purpose: "조율 가능성을 설명한다.", sourceSegmentIds: ["SEG-002"], analysisItemIds: ["KEY-002"] },
    { order: 3, heading: "남은 확인 사항", purpose: "미확정 예산을 표시한다.", sourceSegmentIds: ["SEG-003", "SEG-004"], analysisItemIds: ["FACT-001", "REVIEW-001"] },
  ],
  paragraphs: [
    { order: 1, heading: "개편 방향", text: "정부는 제도 개편의 핵심 목표가 현장 혼선을 줄이는 데 있다고 설명했다.", sourceSegmentIds: ["SEG-002"], quoteCandidateIds: [], reviewItemIds: [] },
    { order: 2, heading: "시행 일정", text: "정부 관계자는 “정부의 기본 방침은 현장 혼선을 줄이는 것입니다.”라고 말했다. 시행 시기는 관계 부처와 업계 의견을 수렴해 조율할 여지가 있다고 덧붙였다.", sourceSegmentIds: ["SEG-002"], quoteCandidateIds: ["QUOTE-001"], reviewItemIds: [] },
    { order: 3, heading: "예산", text: "예산은 관계 부처 협의 중으로 확정되지 않았다. 질문에 언급된 구체적인 금액은 [확인 필요] 상태다.", sourceSegmentIds: ["SEG-003", "SEG-004"], quoteCandidateIds: [], reviewItemIds: ["REVIEW-001"] },
  ],
};

export function createDemoJob(): JobRecord {
  const now = new Date();
  return {
    id: "demo",
    organizationId: "local-newsroom",
    ownerId: "local-reporter",
    blobPath: "demo/interview.mp3",
    blobUrl: "",
    originalName: "인터뷰_샘플.mp3",
    mimeType: "audio/mpeg",
    bytes: 2_048_000,
    durationMsFromClient: demoTranscript.durationMs,
    etag: "demo",
    metadata: { title: "제도 개편 백브리핑", sourceIdentifier: "취재원 1", reporterName: "담당 기자", disclosure: "ON_RECORD", consentAccepted: true },
    options: { extractQuotes: true, extractFactsAndReviewItems: true },
    status: "DRAFT_READY",
    stage: "근거 검증 완료",
    stageIndex: 5,
    stageCount: 5,
    transcriptVersion: 1,
    transcript: structuredClone(demoTranscript),
    draftVersion: 1,
    draft: structuredClone(demoDraft),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
  };
}
