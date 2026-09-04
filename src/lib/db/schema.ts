import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ArticleDraftResult, JobMetadata, JobOptions, JobStatus, TranscriptResult } from "@/types/job";

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  ownerId: text("owner_id").notNull(),
  blobPath: text("blob_path").notNull(),
  blobUrl: text("blob_url").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  bytes: integer("bytes").notNull(),
  durationMsFromClient: integer("duration_ms_from_client").notNull(),
  etag: text("etag").notNull(),
  metadata: jsonb("metadata").$type<JobMetadata>().notNull(),
  options: jsonb("options").$type<JobOptions>().notNull(),
  status: text("status").$type<JobStatus>().notNull(),
  stage: text("stage").notNull(),
  stageIndex: integer("stage_index").notNull(),
  stageCount: integer("stage_count").notNull(),
  runId: text("run_id"),
  transcriptVersion: integer("transcript_version").notNull().default(0),
  draftVersion: integer("draft_version").notNull().default(0),
  error: jsonb("error").$type<{ code: string; message: string; retryable: boolean }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const transcriptVersions = pgTable("transcript_versions", {
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  result: jsonb("result").$type<TranscriptResult>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.jobId, table.version] })]);

export const draftVersions = pgTable("draft_versions", {
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  result: jsonb("result").$type<ArticleDraftResult>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.jobId, table.version] })]);

export const cmsDeliveries = pgTable("cms_deliveries", {
  id: uuid("id").primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  draftVersion: integer("draft_version").notNull(),
  idempotencyKey: uuid("idempotency_key").notNull().unique(),
  receiptId: text("receipt_id").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  jobHash: text("job_hash").notNull(),
  event: text("event").notNull(),
  success: boolean("success").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
