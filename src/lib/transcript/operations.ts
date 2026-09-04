import type { TranscriptOperation } from "@/lib/schemas/api";
import type { TranscriptResult } from "@/types/job";

function segmentOrThrow(result: TranscriptResult, id: string) {
  const segment = result.segments.find((item) => item.id === id);
  if (!segment) throw new Error("SEGMENT_INVALID");
  return segment;
}

export function applyTranscriptOperations(source: TranscriptResult, operations: TranscriptOperation[]): TranscriptResult {
  const result = structuredClone(source);
  for (const operation of operations) {
    if (operation.type === "UPDATE_TEXT") {
      const segment = segmentOrThrow(result, operation.segmentId);
      segment.originalText ??= segment.text;
      segment.text = operation.text;
      segment.updatedAt = new Date().toISOString();
      segment.reviewed = !operation.text.includes("[불명확]");
    } else if (operation.type === "RESTORE_TEXT") {
      const segment = segmentOrThrow(result, operation.segmentId);
      segment.text = segment.originalText ?? segment.text;
      segment.updatedAt = new Date().toISOString();
      segment.reviewed = segment.flags.length === 0;
    } else if (operation.type === "SET_SPEAKER") {
      const segment = segmentOrThrow(result, operation.segmentId);
      segment.speaker = operation.speaker;
      segment.updatedAt = new Date().toISOString();
    } else if (operation.type === "SET_REVIEWED") {
      const segment = segmentOrThrow(result, operation.segmentId);
      if (operation.reviewed && segment.text.includes("[불명확]")) throw new Error("UNCLEAR_REMAINS");
      segment.reviewed = operation.reviewed;
      result.reviewItems = result.reviewItems.map((item) => item.sourceSegmentIds.includes(segment.id) ? { ...item, resolved: operation.reviewed } : item);
    } else if (operation.type === "SPLIT") {
      const index = result.segments.findIndex((item) => item.id === operation.segmentId);
      const segment = result.segments[index];
      if (!segment || operation.atMs <= segment.startMs || operation.atMs >= segment.endMs || operation.atMs - segment.startMs < 500 || segment.endMs - operation.atMs < 500) throw new Error("SEGMENT_INVALID");
      const ratio = (operation.atMs - segment.startMs) / (segment.endMs - segment.startMs);
      const splitAt = Math.max(1, Math.min(segment.text.length - 1, Math.round(segment.text.length * ratio)));
      const boundary = segment.text.lastIndexOf(" ", splitAt);
      const textIndex = boundary > 0 ? boundary : splitAt;
      const nextNumber = Math.max(...result.segments.map((item) => Number(item.id.replace("SEG-", "")) || 0)) + 1;
      const secondId = `SEG-${String(nextNumber).padStart(3, "0")}` as const;
      const first = { ...segment, endMs: operation.atMs, text: segment.text.slice(0, textIndex).trim(), originalText: segment.originalText?.slice(0, textIndex).trim() };
      const second = { ...segment, id: secondId, startMs: operation.atMs, text: segment.text.slice(textIndex).trim(), originalText: segment.originalText?.slice(textIndex).trim() };
      if (!first.text || !second.text) throw new Error("SEGMENT_INVALID");
      result.segments.splice(index, 1, first, second);
    } else if (operation.type === "ADD_QUOTE") {
      const segment = segmentOrThrow(result, operation.segmentId);
      if (!segment.text.includes(operation.quote) || operation.quote.includes("[불명확]")) throw new Error("QUOTE_INVALID");
      result.quoteCandidates.push({
        id: `QUOTE-${crypto.randomUUID()}`,
        text: operation.quote,
        quote: operation.quote,
        speaker: segment.speaker,
        startMs: segment.startMs,
        endMs: segment.endMs,
        sourceSegmentIds: [segment.id],
      });
    } else if (operation.type === "ADD_EVIDENCE") {
      const segment = segmentOrThrow(result, operation.segmentId);
      if (!segment.text.includes(operation.text)) throw new Error("EVIDENCE_INVALID");
      if (operation.classification === "FACT") {
        result.facts.push({ id: `FACT-${crypto.randomUUID()}`, text: operation.text, sourceSegmentIds: [segment.id] });
      } else {
        result.reviewItems.push({ id: `REVIEW-${crypto.randomUUID()}`, text: operation.text, sourceSegmentIds: [segment.id], reason: operation.reason ?? "UNCLEAR_AUDIO", resolved: false });
      }
    }
  }
  return result;
}
