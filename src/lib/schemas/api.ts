import { z } from "zod";

const mimeSchema = z.enum(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/m4a"]);

export const createJobSchema = z.object({
  upload: z.object({
    blobPath: z.string().min(1),
    blobUrl: z.string().url(),
    originalName: z.string().min(1).max(255),
    mimeType: mimeSchema,
    bytes: z.number().int().positive().max(104_857_600),
    durationMsFromClient: z.number().int().positive().max(600_000),
    etag: z.string().min(1),
  }),
  metadata: z.object({
    title: z.string().trim().min(1).max(100),
    sourceIdentifier: z.string().trim().min(1).max(100),
    reporterName: z.string().trim().min(1).max(100),
    beat: z.string().trim().max(100).optional(),
    recordedAt: z.string().datetime().optional(),
    disclosure: z.enum(["ON_RECORD", "BACKGROUND", "OFF_RECORD"]),
    consentAccepted: z.literal(true),
  }),
  options: z.object({
    extractQuotes: z.boolean(),
    extractFactsAndReviewItems: z.boolean(),
  }),
});

const operationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("UPDATE_TEXT"), segmentId: z.string(), text: z.string().trim().min(1) }),
  z.object({ type: z.literal("RESTORE_TEXT"), segmentId: z.string() }),
  z.object({ type: z.literal("SET_SPEAKER"), segmentId: z.string(), speaker: z.enum(["A", "B"]) }),
  z.object({ type: z.literal("SET_REVIEWED"), segmentId: z.string(), reviewed: z.boolean() }),
  z.object({ type: z.literal("SPLIT"), segmentId: z.string(), atMs: z.number().int().positive() }),
  z.object({ type: z.literal("ADD_QUOTE"), segmentId: z.string(), quote: z.string().min(1) }),
  z.object({
    type: z.literal("ADD_EVIDENCE"),
    segmentId: z.string(),
    text: z.string().min(1),
    classification: z.enum(["FACT", "REVIEW"]),
    reason: z.enum(["UNCLEAR_AUDIO", "UNCLEAR_SPEAKER", "UNCLEAR_NUMBER", "UNCLEAR_NAME", "CONTRADICTION"]).optional(),
  }),
  z.object({ type: z.literal("SELECT_LEAD"), leadType: z.enum(["FACT", "QUOTE", "ISSUE"]) }),
]);

export const transcriptPatchSchema = z.object({
  baseVersion: z.number().int().positive(),
  operations: z.array(operationSchema).min(1).max(50),
});

export const draftRequestSchema = z.object({ transcriptVersion: z.number().int().positive() });

export const cmsDeliverySchema = z.object({
  draftVersion: z.number().int().positive(),
  confirm: z.literal(true),
  idempotencyKey: z.string().uuid(),
});

export type TranscriptOperation = z.infer<typeof operationSchema>;
