import { requireActor } from "@/lib/auth/actor";
import { getJob, updateCurrentTranscript } from "@/lib/db/repository";
import { applyTranscriptOperations } from "@/lib/transcript/operations";
import { transcriptPatchSchema } from "@/lib/schemas/api";
import { apiError, assertSameOrigin } from "@/lib/security/request";
import { validateTranscriptEvidence } from "@/lib/validators/evidence";

type Context = { params: Promise<{ jobId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job?.transcript) throw new Error("NOT_FOUND");
    const input = transcriptPatchSchema.parse(await request.json());
    const version = await updateCurrentTranscript(jobId, input.baseVersion, (source) => {
      const next = applyTranscriptOperations(source, input.operations);
      const errors = validateTranscriptEvidence(next);
      if (errors.length) throw new Error("EVIDENCE_INVALID");
      return next;
    });
    return Response.json({ transcriptVersion: version, invalidated: ["draft"] });
  } catch (error) {
    return apiError(error);
  }
}
