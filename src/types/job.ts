export type Speaker = "A" | "B" | "UNCLEAR";
export type ReviewReason =
  | "UNCLEAR_AUDIO"
  | "UNCLEAR_SPEAKER"
  | "UNCLEAR_NUMBER"
  | "UNCLEAR_NAME"
  | "CONTRADICTION";

export type TranscriptSegment = {
  id: `SEG-${string}`;
  speaker: Speaker;
  startMs: number;
  endMs: number;
  text: string;
  originalText?: string;
  confidence: number | null;
  flags: ReviewReason[];
  reviewed?: boolean;
  updatedAt?: string;
};

export type AnalysisItem = {
  id: string;
  text: string;
  sourceSegmentIds: string[];
};

export type QuoteCandidate = AnalysisItem & {
  speaker: Speaker;
  quote: string;
  startMs: number;
  endMs: number;
};

export type ReviewItem = AnalysisItem & {
  reason: ReviewReason;
  resolved: boolean;
};

export type TranscriptResult = {
  schemaVersion: "1.0";
  durationMs: number;
  segments: TranscriptSegment[];
  keyStatements: AnalysisItem[];
  quoteCandidates: QuoteCandidate[];
  facts: AnalysisItem[];
  reviewItems: ReviewItem[];
};

export type Lead = {
  text: string;
  sourceSegmentIds: string[];
  quoteCandidateIds: string[];
};

export type ArticleDraftResult = {
  schemaVersion: "1.0";
  transcriptVersion: number;
  leads: { fact: Lead; quote: Lead; issue: Lead };
  selectedLeadType?: "FACT" | "QUOTE" | "ISSUE";
  outline: Array<{
    order: number;
    heading: string;
    purpose: string;
    sourceSegmentIds: string[];
    analysisItemIds: string[];
  }>;
  paragraphs: Array<{
    order: number;
    heading: string;
    text: string;
    sourceSegmentIds: string[];
    quoteCandidateIds: string[];
    reviewItemIds: string[];
  }>;
};

export type JobStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "TRANSCRIPT_READY"
  | "DRAFTING"
  | "DRAFT_READY"
  | "FAILED"
  | "DELETING"
  | "DELETED";

export type JobMetadata = {
  title: string;
  sourceIdentifier: string;
  reporterName: string;
  beat?: string;
  recordedAt?: string;
  disclosure: "ON_RECORD" | "BACKGROUND" | "OFF_RECORD";
  consentAccepted: true;
};

export type JobOptions = {
  extractQuotes: boolean;
  extractFactsAndReviewItems: boolean;
};

export type JobRecord = {
  id: string;
  organizationId: string;
  ownerId: string;
  blobPath: string;
  blobUrl: string;
  originalName: string;
  mimeType: string;
  bytes: number;
  durationMsFromClient: number;
  etag: string;
  metadata: JobMetadata;
  options: JobOptions;
  status: JobStatus;
  stage: string;
  stageIndex: number;
  stageCount: number;
  runId?: string;
  transcriptVersion: number;
  transcript?: TranscriptResult;
  draftVersion: number;
  draft?: ArticleDraftResult;
  error?: { code: string; message: string; retryable: boolean };
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type PublicJob = Omit<JobRecord, "blobUrl" | "etag" | "organizationId" | "ownerId"> & {
  audioUrl?: string;
  unresolvedCount: number;
};

export type TranscriptOperation =
  | { type: "UPDATE_TEXT"; segmentId: string; text: string }
  | { type: "RESTORE_TEXT"; segmentId: string }
  | { type: "SET_SPEAKER"; segmentId: string; speaker: "A" | "B" }
  | { type: "SET_REVIEWED"; segmentId: string; reviewed: boolean }
  | { type: "SPLIT"; segmentId: string; atMs: number }
  | { type: "ADD_QUOTE"; segmentId: string; quote: string }
  | { type: "ADD_EVIDENCE"; segmentId: string; text: string; classification: "FACT" | "REVIEW"; reason?: ReviewReason };
