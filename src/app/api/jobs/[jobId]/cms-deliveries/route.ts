import { requireActor } from "@/lib/auth/actor";
import { deliverToCms } from "@/lib/cms/client";
import { findCmsDelivery, getJob, saveCmsDelivery } from "@/lib/db/repository";
import { checkRateLimit } from "@/lib/rate-limit";
import { cmsDeliverySchema } from "@/lib/schemas/api";
import { apiError, assertSameOrigin } from "@/lib/security/request";

type Context = { params: Promise<{ jobId: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    const { jobId } = await params;
    const input = cmsDeliverySchema.parse(await request.json());
    await checkRateLimit(`cms:${actor.organizationId}:${actor.userId}`, 10);
    const job = await getJob(jobId, actor.organizationId);
    if (!job?.draft || job.draftVersion !== input.draftVersion) throw new Error("VERSION_CONFLICT");
    const existing = await findCmsDelivery(input.idempotencyKey);
    if (existing) return Response.json(existing);
    const result = await deliverToCms(job, input.idempotencyKey);
    const delivery = await saveCmsDelivery({ deliveryId: crypto.randomUUID(), jobId, draftVersion: input.draftVersion, idempotencyKey: input.idempotencyKey, ...result });
    return Response.json(delivery, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
