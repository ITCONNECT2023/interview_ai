import { start } from "workflow/api";
import { requireActor } from "@/lib/auth/actor";
import { getJob, patchJob } from "@/lib/db/repository";
import { toPublicJob } from "@/lib/jobs/public-job";
import { apiError, assertSameOrigin } from "@/lib/security/request";
import { deleteJobWorkflow } from "@/workflows/delete-job";
import { processInterviewWorkflow } from "@/workflows/process-interview";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job) throw new Error("NOT_FOUND");
    return Response.json(toPublicJob(job));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job) throw new Error("NOT_FOUND");
    const body = await request.json() as { action?: string };
    if (body.action !== "RETRY_TRANSCRIPTION") throw new Error("INVALID_ACTION");
    const run = await start(processInterviewWorkflow, [job.id]);
    await patchJob(job.id, { runId: run.runId, status: "PROCESSING", stage: "재시도 준비", stageIndex: 0, error: undefined });
    return Response.json({ jobId, runId: run.runId, status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job) throw new Error("NOT_FOUND");
    if (job.status === "DELETING") throw new Error("DELETE_IN_PROGRESS");
    const run = await start(deleteJobWorkflow, [jobId]);
    await patchJob(jobId, { status: "DELETING", stage: "자료 삭제 대기", runId: run.runId });
    return Response.json({ status: "DELETING", runId: run.runId }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
