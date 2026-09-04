import type { JobRecord, PublicJob } from "@/types/job";

export function toPublicJob(job: JobRecord): PublicJob {
  const { blobUrl: _blobUrl, etag: _etag, organizationId: _organizationId, ownerId: _ownerId, ...safe } = job;
  return {
    ...safe,
    audioUrl: job.blobUrl ? `/api/jobs/${job.id}/audio` : undefined,
    unresolvedCount: job.transcript?.reviewItems.filter((item) => !item.resolved).length ?? 0,
  };
}
