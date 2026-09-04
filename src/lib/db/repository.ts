import "server-only";
import { neon } from "@neondatabase/serverless";
import { and, eq, lte, notInArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { createDemoJob } from "@/lib/demo-data";
import { getServerEnv } from "@/lib/env/server";
import { cmsDeliveries, draftVersions, jobs, transcriptVersions } from "@/lib/db/schema";
import type { ArticleDraftResult, JobRecord, JobStatus, TranscriptResult } from "@/types/job";

type NewJob = Omit<JobRecord, "transcriptVersion" | "draftVersion" | "status" | "stage" | "stageIndex" | "stageCount" | "createdAt" | "updatedAt" | "expiresAt">;
type JobPatch = Partial<Pick<JobRecord, "status" | "stage" | "stageIndex" | "stageCount" | "runId" | "error" | "draftVersion" | "transcriptVersion">>;

const memory = globalThis as typeof globalThis & { __pressnoteJobs?: Map<string, JobRecord> };
memory.__pressnoteJobs ??= new Map<string, JobRecord>();
if (!memory.__pressnoteJobs.has("demo")) memory.__pressnoteJobs.set("demo", createDemoJob());
const deliveryMemory = globalThis as typeof globalThis & { __pressnoteDeliveries?: Map<string, CmsDelivery> };
type CmsDelivery = { deliveryId: string; jobId: string; draftVersion: number; idempotencyKey: string; receiptId: string; status: string; createdAt: string };
deliveryMemory.__pressnoteDeliveries ??= new Map<string, CmsDelivery>();

function database() {
  const url = getServerEnv().DATABASE_URL;
  if (!url && process.env.NODE_ENV === "production") {
    throw new Error("CONFIGURATION_ERROR: DATABASE_URL is required in production");
  }
  return url ? drizzle(neon(url)) : null;
}

function toRecord(row: typeof jobs.$inferSelect, transcript?: TranscriptResult, draft?: ArticleDraftResult): JobRecord {
  return {
    ...row,
    runId: row.runId ?? undefined,
    error: row.error ?? undefined,
    transcript,
    draft,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function createJob(input: NewJob): Promise<JobRecord> {
  const now = new Date();
  const record: JobRecord = {
    ...input,
    status: "UPLOADED",
    stage: "업로드 확인",
    stageIndex: 0,
    stageCount: 5,
    transcriptVersion: 0,
    draftVersion: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + getServerEnv().DATA_RETENTION_DAYS * 86_400_000).toISOString(),
  };
  const db = database();
  if (!db) {
    memory.__pressnoteJobs!.set(record.id, structuredClone(record));
    return record;
  }
  await db.insert(jobs).values({
    ...record,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(record.expiresAt),
    error: null,
  });
  return record;
}

export async function getJob(id: string, organizationId?: string): Promise<JobRecord | null> {
  const db = database();
  if (!db) {
    const value = memory.__pressnoteJobs!.get(id);
    if (!value || (organizationId && value.organizationId !== organizationId)) return null;
    return structuredClone(value);
  }
  const conditions = organizationId ? and(eq(jobs.id, id), eq(jobs.organizationId, organizationId)) : eq(jobs.id, id);
  const [row] = await db.select().from(jobs).where(conditions).limit(1);
  if (!row) return null;
  let transcript: TranscriptResult | undefined;
  let draft: ArticleDraftResult | undefined;
  if (row.transcriptVersion > 0) {
    const [version] = await db.select().from(transcriptVersions).where(and(eq(transcriptVersions.jobId, row.id), eq(transcriptVersions.version, row.transcriptVersion))).limit(1);
    transcript = version?.result;
  }
  if (row.draftVersion > 0) {
    const [version] = await db.select().from(draftVersions).where(and(eq(draftVersions.jobId, row.id), eq(draftVersions.version, row.draftVersion))).limit(1);
    draft = version?.result;
  }
  return toRecord(row, transcript, draft);
}

export async function patchJob(id: string, patch: JobPatch): Promise<void> {
  const db = database();
  if (!db) {
    const current = memory.__pressnoteJobs!.get(id);
    if (!current) throw new Error("NOT_FOUND");
    memory.__pressnoteJobs!.set(id, { ...current, ...patch, updatedAt: new Date().toISOString() });
    return;
  }
  await db.update(jobs).set({ ...patch, updatedAt: new Date() }).where(eq(jobs.id, id));
}

export async function saveTranscript(id: string, result: TranscriptResult, expectedVersion?: number): Promise<number> {
  const current = await getJob(id);
  if (!current) throw new Error("NOT_FOUND");
  if (expectedVersion !== undefined && current.transcriptVersion !== expectedVersion) throw new Error("VERSION_CONFLICT");
  const version = current.transcriptVersion + 1;
  const db = database();
  if (!db) {
    memory.__pressnoteJobs!.set(id, { ...current, transcript: structuredClone(result), transcriptVersion: version, draft: undefined, draftVersion: 0, status: "TRANSCRIPT_READY", stage: "결과 저장", stageIndex: 5, updatedAt: new Date().toISOString() });
    return version;
  }
  await db.transaction(async (tx) => {
    await tx.insert(transcriptVersions).values({ jobId: id, version, result, createdAt: new Date() });
    await tx.update(jobs).set({ transcriptVersion: version, draftVersion: 0, status: "TRANSCRIPT_READY", stage: "결과 저장", stageIndex: 5, error: null, updatedAt: new Date() }).where(eq(jobs.id, id));
  });
  return version;
}

export async function saveDraft(id: string, result: ArticleDraftResult): Promise<number> {
  const current = await getJob(id);
  if (!current) throw new Error("NOT_FOUND");
  const version = current.draftVersion + 1;
  const stored = { ...result, selectedLeadType: result.selectedLeadType ?? "FACT" };
  const db = database();
  if (!db) {
    memory.__pressnoteJobs!.set(id, { ...current, draft: structuredClone(stored), draftVersion: version, status: "DRAFT_READY", stage: "근거 검증 완료", stageIndex: 4, stageCount: 4, updatedAt: new Date().toISOString() });
    return version;
  }
  await db.transaction(async (tx) => {
    await tx.insert(draftVersions).values({ jobId: id, version, result: stored, createdAt: new Date() });
    await tx.update(jobs).set({ draftVersion: version, status: "DRAFT_READY", stage: "근거 검증 완료", stageIndex: 4, stageCount: 4, error: null, updatedAt: new Date() }).where(eq(jobs.id, id));
  });
  return version;
}

export async function updateCurrentTranscript(id: string, expectedVersion: number, transform: (value: TranscriptResult) => TranscriptResult) {
  const current = await getJob(id);
  if (!current?.transcript) throw new Error("NOT_FOUND");
  return saveTranscript(id, transform(structuredClone(current.transcript)), expectedVersion);
}

export async function selectLead(id: string, expectedVersion: number, leadType: "FACT" | "QUOTE" | "ISSUE") {
  const current = await getJob(id);
  if (!current?.draft || current.draftVersion !== expectedVersion) throw new Error("VERSION_CONFLICT");
  const draft = { ...current.draft, selectedLeadType: leadType };
  const db = database();
  if (!db) {
    memory.__pressnoteJobs!.set(id, { ...current, draft, updatedAt: new Date().toISOString() });
    return;
  }
  await db.update(draftVersions).set({ result: draft }).where(and(eq(draftVersions.jobId, id), eq(draftVersions.version, expectedVersion)));
}

export async function listExpiredJobIds(): Promise<string[]> {
  const db = database();
  if (!db) return [...memory.__pressnoteJobs!.values()].filter((job) => job.id !== "demo" && new Date(job.expiresAt) <= new Date() && !["DELETING", "DELETED"].includes(job.status)).map((job) => job.id);
  const rows = await db.select({ id: jobs.id }).from(jobs).where(and(lte(jobs.expiresAt, new Date()), notInArray(jobs.status, ["DELETING", "DELETED"] as JobStatus[])));
  return rows.map((row) => row.id);
}

export async function deleteJobData(id: string) {
  const db = database();
  if (!db) {
    memory.__pressnoteJobs!.delete(id);
    return;
  }
  await db.delete(jobs).where(eq(jobs.id, id));
}

export async function findCmsDelivery(idempotencyKey: string): Promise<CmsDelivery | null> {
  const db = database();
  if (!db) return deliveryMemory.__pressnoteDeliveries!.get(idempotencyKey) ?? null;
  const [row] = await db.select().from(cmsDeliveries).where(eq(cmsDeliveries.idempotencyKey, idempotencyKey)).limit(1);
  return row ? { deliveryId: row.id, jobId: row.jobId, draftVersion: row.draftVersion, idempotencyKey: row.idempotencyKey, receiptId: row.receiptId, status: row.status, createdAt: row.createdAt.toISOString() } : null;
}

export async function saveCmsDelivery(input: Omit<CmsDelivery, "createdAt">): Promise<CmsDelivery> {
  const delivery = { ...input, createdAt: new Date().toISOString() };
  const db = database();
  if (!db) {
    deliveryMemory.__pressnoteDeliveries!.set(input.idempotencyKey, delivery);
    return delivery;
  }
  await db.insert(cmsDeliveries).values({ id: input.deliveryId, jobId: input.jobId, draftVersion: input.draftVersion, idempotencyKey: input.idempotencyKey, receiptId: input.receiptId, status: input.status, createdAt: new Date(delivery.createdAt) });
  return delivery;
}
