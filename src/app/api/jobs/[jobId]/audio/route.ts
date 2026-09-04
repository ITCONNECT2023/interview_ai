import { get } from "@vercel/blob";
import { requireActor } from "@/lib/auth/actor";
import { getJob } from "@/lib/db/repository";
import { getServerEnv } from "@/lib/env/server";
import { apiError } from "@/lib/security/request";
import { isLocalAudioUrl, readLocalAudio } from "@/lib/storage/audio";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job?.blobUrl) throw new Error("NOT_FOUND");
    const range = request.headers.get("range");

    if (isLocalAudioUrl(job.blobUrl)) {
      const bytes = await readLocalAudio(job.blobUrl);
      return localAudioResponse(bytes, job.mimeType, range);
    }

    const token = getServerEnv().BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("CONFIGURATION_ERROR");
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

function localAudioResponse(bytes: Uint8Array, mimeType: string, range: string | null) {
  const headers = new Headers({
    "content-type": mimeType,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
  });
  if (!range) {
    headers.set("content-length", String(bytes.byteLength));
    return new Response(toArrayBuffer(bytes), { status: 200, headers });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return rangeNotSatisfiable(bytes.byteLength);
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= bytes.byteLength) {
    return rangeNotSatisfiable(bytes.byteLength);
  }
  const chunk = bytes.subarray(start, end + 1);
  headers.set("content-range", `bytes ${start}-${end}/${bytes.byteLength}`);
  headers.set("content-length", String(chunk.byteLength));
  return new Response(toArrayBuffer(chunk), { status: 206, headers });
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function rangeNotSatisfiable(size: number) {
  return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
}
