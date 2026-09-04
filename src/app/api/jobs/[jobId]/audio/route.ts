import { get } from "@vercel/blob";
import { requireActor } from "@/lib/auth/actor";
import { getJob } from "@/lib/db/repository";
import { getServerEnv } from "@/lib/env/server";
import { apiError } from "@/lib/security/request";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job?.blobUrl) throw new Error("NOT_FOUND");
    const token = getServerEnv().BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("CONFIGURATION_ERROR");
    const range = request.headers.get("range");
    const result = await get(job.blobUrl, { access: "private", token, headers: range ? { range } : undefined });
    if (!result || !result.stream) throw new Error("NOT_FOUND");
    const headers = new Headers();
    result.headers.forEach((value, key) => headers.set(key, value));
    headers.set("content-type", job.mimeType);
    headers.set("accept-ranges", "bytes");
    headers.set("cache-control", "private, no-store");
    return new Response(result.stream, { status: range ? 206 : 200, headers });
  } catch (error) {
    return apiError(error);
  }
}
