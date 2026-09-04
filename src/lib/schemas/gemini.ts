import { z } from "zod";

const reasonSchema = z.enum([
  "UNCLEAR_AUDIO",
  "UNCLEAR_SPEAKER",
  "UNCLEAR_NUMBER",
  "UNCLEAR_NAME",
  "CONTRADICTION",
]);

const analysisItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  sourceSegmentIds: z.array(z.string()).min(1),
});

export const transcriptResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  durationMs: z.number().int().positive().max(600_000),
  segments: z.array(z.object({
    id: z.string().regex(/^SEG-/),
    speaker: z.enum(["A", "B", "UNCLEAR"]),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
    text: z.string().min(1),
    confidence: z.number().min(0).max(1).nullable(),
    flags: z.array(reasonSchema),
  })).min(1),
  keyStatements: z.array(analysisItemSchema),
  quoteCandidates: z.array(analysisItemSchema.extend({
    speaker: z.enum(["A", "B", "UNCLEAR"]),
    quote: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().positive(),
  })),
  facts: z.array(analysisItemSchema),
  reviewItems: z.array(analysisItemSchema.extend({ reason: reasonSchema, resolved: z.boolean() })),
});

const leadSchema = z.object({
  text: z.string().min(1),
  sourceSegmentIds: z.array(z.string()).min(1),
  quoteCandidateIds: z.array(z.string()),
});

export const articleDraftResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  transcriptVersion: z.number().int().positive(),
  leads: z.object({ fact: leadSchema, quote: leadSchema, issue: leadSchema }),
  outline: z.array(z.object({
    order: z.number().int().positive(),
    heading: z.string(),
    purpose: z.string(),
    sourceSegmentIds: z.array(z.string()).min(1),
    analysisItemIds: z.array(z.string()),
  })).min(1),
  paragraphs: z.array(z.object({
    order: z.number().int().positive(),
    heading: z.string(),
    text: z.string().min(1),
    sourceSegmentIds: z.array(z.string()).min(1),
    quoteCandidateIds: z.array(z.string()),
    reviewItemIds: z.array(z.string()),
  })).min(1),
});

export const transcriptJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "durationMs", "segments", "keyStatements", "quoteCandidates", "facts", "reviewItems"],
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    durationMs: { type: "integer" },
    segments: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "speaker", "startMs", "endMs", "text", "confidence", "flags"], properties: {
      id: { type: "string" }, speaker: { type: "string", enum: ["A", "B", "UNCLEAR"] }, startMs: { type: "integer" }, endMs: { type: "integer" }, text: { type: "string" }, confidence: { anyOf: [{ type: "number" }, { type: "null" }] }, flags: { type: "array", items: { type: "string", enum: ["UNCLEAR_AUDIO", "UNCLEAR_SPEAKER", "UNCLEAR_NUMBER", "UNCLEAR_NAME", "CONTRADICTION"] } }
    }}},
    keyStatements: { type: "array", items: { $ref: "#/$defs/item" } },
    facts: { type: "array", items: { $ref: "#/$defs/item" } },
    quoteCandidates: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text", "sourceSegmentIds", "speaker", "quote", "startMs", "endMs"], properties: { id: { type: "string" }, text: { type: "string" }, sourceSegmentIds: { type: "array", items: { type: "string" } }, speaker: { type: "string", enum: ["A", "B", "UNCLEAR"] }, quote: { type: "string" }, startMs: { type: "integer" }, endMs: { type: "integer" } } } },
    reviewItems: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "text", "sourceSegmentIds", "reason", "resolved"], properties: { id: { type: "string" }, text: { type: "string" }, sourceSegmentIds: { type: "array", items: { type: "string" } }, reason: { type: "string", enum: ["UNCLEAR_AUDIO", "UNCLEAR_SPEAKER", "UNCLEAR_NUMBER", "UNCLEAR_NAME", "CONTRADICTION"] }, resolved: { type: "boolean" } } } },
  },
  $defs: { item: { type: "object", additionalProperties: false, required: ["id", "text", "sourceSegmentIds"], properties: { id: { type: "string" }, text: { type: "string" }, sourceSegmentIds: { type: "array", items: { type: "string" } } } } },
};

export const articleJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "transcriptVersion", "leads", "outline", "paragraphs"],
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    transcriptVersion: { type: "integer" },
    leads: { type: "object", additionalProperties: false, required: ["fact", "quote", "issue"], properties: { fact: { $ref: "#/$defs/lead" }, quote: { $ref: "#/$defs/lead" }, issue: { $ref: "#/$defs/lead" } } },
    outline: { type: "array", items: { type: "object", additionalProperties: false, required: ["order", "heading", "purpose", "sourceSegmentIds", "analysisItemIds"], properties: { order: { type: "integer" }, heading: { type: "string" }, purpose: { type: "string" }, sourceSegmentIds: { type: "array", items: { type: "string" } }, analysisItemIds: { type: "array", items: { type: "string" } } } } },
    paragraphs: { type: "array", items: { type: "object", additionalProperties: false, required: ["order", "heading", "text", "sourceSegmentIds", "quoteCandidateIds", "reviewItemIds"], properties: { order: { type: "integer" }, heading: { type: "string" }, text: { type: "string" }, sourceSegmentIds: { type: "array", items: { type: "string" } }, quoteCandidateIds: { type: "array", items: { type: "string" } }, reviewItemIds: { type: "array", items: { type: "string" } } } } },
  },
  $defs: { lead: { type: "object", additionalProperties: false, required: ["text", "sourceSegmentIds", "quoteCandidateIds"], properties: { text: { type: "string" }, sourceSegmentIds: { type: "array", items: { type: "string" } }, quoteCandidateIds: { type: "array", items: { type: "string" } } } } },
};
