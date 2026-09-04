import { start } from "workflow/api";
import { requireActor } from "@/lib/auth/actor";
import { getJob, patchJob, selectLead } from "@/lib/db/repository";
import { draftRequestSchema } from "@/lib/schemas/api";
import { apiError, assertSameOrigin } from "@/lib/security/request";
import { generateArticleWorkflow } from "@/workflows/generate-article";

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job?.transcript) throw new Error("NOT_FOUND");
    const input = draftRequestSchema.parse(await request.json());
    if (input.transcriptVersion !== job.transcriptVersion) throw new Error("VERSION_CONFLICT");
    const run = await start(generateArticleWorkflow, [jobId, input.transcriptVersion]);
    await patchJob(jobId, { runId: run.runId, status: "DRAFTING", stage: "리드 생성", stageIndex: 0, stageCount: 4 });
    return Response.json({ runId: run.runId, statusUrl: `/api/jobs/${jobId}` }, { status: 202 });
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
    if (!job?.draft) throw new Error("NOT_FOUND");
    const body = await request.json() as { draftVersion?: number; leadType?: "FACT" | "QUOTE" | "ISSUE" };
    if (!body.draftVersion || !body.leadType) throw new Error("INVALID_ACTION");
    await selectLead(jobId, body.draftVersion, body.leadType);
    return Response.json({ selectedLeadType: body.leadType });
  } catch (error) {
    return apiError(error);
  }
}
