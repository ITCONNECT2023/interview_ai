import "server-only";
import { getServerEnv } from "@/lib/env/server";
import type { JobRecord } from "@/types/job";

export async function deliverToCms(job: JobRecord, idempotencyKey: string) {
  const env = getServerEnv();
  if (!env.CMS_API_BASE_URL || !env.CMS_API_TOKEN) {
    if (process.env.NODE_ENV === "production") throw new Error("CONFIGURATION_ERROR");
    return { receiptId: `local-${job.id}-${job.draftVersion}`, status: "submitted_for_review" as const };
  }
  if (!job.draft) throw new Error("DRAFT_NOT_FOUND");
  const selected = job.draft.selectedLeadType ?? "FACT";
  const lead = job.draft.leads[selected.toLowerCase() as "fact" | "quote" | "issue"];
  const response = await fetch(`${env.CMS_API_BASE_URL.replace(/\/$/, "")}/editorial-review`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.CMS_API_TOKEN}`, "idempotency-key": idempotencyKey },
    body: JSON.stringify({
      externalId: `${job.id}:${job.draftVersion}`,
      title: job.metadata.title,
      reporter: job.metadata.reporterName,
      disclosure: job.metadata.disclosure,
      selectedLeadType: selected,
      lead: lead.text,
      paragraphs: job.draft.paragraphs.map(({ order, heading, text }) => ({ order, heading, text })),
      unresolvedCount: job.transcript?.reviewItems.filter((item) => !item.resolved).length ?? 0,
      status: "submitted_for_review",
    }),
  });
  if (!response.ok) throw new Error("CMS_ERROR");
  const payload = await response.json() as { receiptId?: string };
  if (!payload.receiptId) throw new Error("CMS_ERROR");
  return { receiptId: payload.receiptId, status: "submitted_for_review" as const };
}
