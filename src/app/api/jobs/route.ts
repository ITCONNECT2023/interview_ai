import { start } from "workflow/api";
import { requireActor } from "@/lib/auth/actor";
import { createJob } from "@/lib/db/repository";
import { toPublicJob } from "@/lib/jobs/public-job";
import { checkRateLimit } from "@/lib/rate-limit";
import { createJobSchema } from "@/lib/schemas/api";
import { apiError, assertSameOrigin } from "@/lib/security/request";
import { processInterviewWorkflow } from "@/workflows/process-interview";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await checkRateLimit(`jobs:${actor.organizationId}:${actor.userId}`, 20);
    const input = createJobSchema.parse(await request.json());
    const job = await createJob({
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      ownerId: actor.userId,
      ...input.upload,
      metadata: input.metadata,
      options: input.options,
    });
    const run = await start(processInterviewWorkflow, [job.id]);
    const { patchJob } = await import("@/lib/db/repository");
    await patchJob(job.id, { runId: run.runId });
    return Response.json({ jobId: job.id, status: job.status, statusUrl: `/api/jobs/${job.id}`, job: toPublicJob(job) }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
