import type { ArticleDraftResult, TranscriptResult } from "@/types/job";

export function validateTranscriptEvidence(result: TranscriptResult): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  let lastEnd = 0;
  for (const segment of result.segments) {
    if (ids.has(segment.id)) errors.push(`중복 구간 ID: ${segment.id}`);
    ids.add(segment.id);
    if (segment.startMs < lastEnd || segment.endMs <= segment.startMs) errors.push(`타임코드 오류: ${segment.id}`);
    if (!segment.text.trim()) errors.push(`빈 전사: ${segment.id}`);
    lastEnd = segment.endMs;
  }
  const validateIds = (itemId: string, sourceIds: string[]) => {
    if (sourceIds.length === 0 || sourceIds.some((id) => !ids.has(id))) errors.push(`근거 연결 오류: ${itemId}`);
  };
  result.keyStatements.forEach((item) => validateIds(item.id, item.sourceSegmentIds));
  result.facts.forEach((item) => validateIds(item.id, item.sourceSegmentIds));
  result.reviewItems.forEach((item) => validateIds(item.id, item.sourceSegmentIds));
  for (const quote of result.quoteCandidates) {
    validateIds(quote.id, quote.sourceSegmentIds);
    const source = result.segments.filter((segment) => quote.sourceSegmentIds.includes(segment.id)).map((segment) => segment.text).join(" ");
    if (!source.includes(quote.quote) || quote.quote.includes("[불명확]")) errors.push(`인용 원문 불일치: ${quote.id}`);
  }
  return errors;
}

export function validateArticleEvidence(draft: ArticleDraftResult, transcript: TranscriptResult): string[] {
  const errors: string[] = [];
  const segmentIds = new Set<string>(transcript.segments.map((segment) => segment.id));
  const quoteMap = new Map(transcript.quoteCandidates.map((quote) => [quote.id, quote]));
  const reviewIds = new Set(transcript.reviewItems.map((item) => item.id));
  const checkSegments = (label: string, ids: string[]) => {
    if (ids.length === 0 || ids.some((id) => !segmentIds.has(id))) errors.push(`근거 없는 ${label}`);
  };
  Object.entries(draft.leads).forEach(([type, lead]) => {
    checkSegments(`${type} 리드`, lead.sourceSegmentIds);
    lead.quoteCandidateIds.forEach((id) => { if (!quoteMap.has(id)) errors.push(`리드 인용 참조 오류: ${id}`); });
  });
  draft.outline.forEach((item) => checkSegments(`구조 ${item.order}`, item.sourceSegmentIds));
  draft.paragraphs.forEach((paragraph) => {
    checkSegments(`문단 ${paragraph.order}`, paragraph.sourceSegmentIds);
    paragraph.quoteCandidateIds.forEach((id) => {
      const quote = quoteMap.get(id);
      if (!quote || !paragraph.text.includes(quote.quote)) errors.push(`변형되거나 누락된 인용: ${id}`);
    });
    paragraph.reviewItemIds.forEach((id) => { if (!reviewIds.has(id)) errors.push(`확인 필요 참조 오류: ${id}`); });
    const sourceText = transcript.segments.filter((segment) => paragraph.sourceSegmentIds.includes(segment.id)).map((segment) => segment.text).join(" ");
    const numbers = paragraph.text.match(/\d[\d,.]*(?:조|억|만|천|백)?(?:%|원|명|건|년|월|일|시|분|초)?/g) ?? [];
    numbers.forEach((number) => {
      if (!sourceText.includes(number) && !paragraph.text.includes(`[확인 필요]`)) errors.push(`전사에 없는 수치: ${number}`);
    });
  });
  return errors;
}
