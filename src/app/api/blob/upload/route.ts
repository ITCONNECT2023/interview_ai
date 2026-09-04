import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireActor } from "@/lib/auth/actor";
import { getServerEnv } from "@/lib/env/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, assertSameOrigin } from "@/lib/security/request";

export async function GET() {
  try {
    const actor = await requireActor();
    return Response.json({ prefix: `organizations/${actor.organizationId}/audio` });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor();
    await checkRateLimit(`upload:${actor.organizationId}:${actor.userId}`, 20);
    const env = getServerEnv();
    if (!env.BLOB_READ_WRITE_TOKEN) throw new Error("CONFIGURATION_ERROR");
    const body = await request.json() as HandleUploadBody;
    const response = await handleUpload({
      request,
      body,
      token: env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload ?? "{}") as { mimeType?: string; bytes?: number; prepId?: string };
        if (!payload.prepId || !payload.mimeType || !payload.bytes || payload.bytes > env.MAX_AUDIO_BYTES) throw new Error("FILE_INVALID");
        const safePath = `organizations/${actor.organizationId}/audio/${payload.prepId}/${pathname.split("/").pop()}`;
        if (pathname !== safePath) throw new Error("FILE_INVALID");
        return {
          allowedContentTypes: ["audio/mpeg", "audio/mp4", "audio/m4a", "audio/wav", "audio/x-wav"],
          maximumSizeInBytes: env.MAX_AUDIO_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ organizationId: actor.organizationId, ownerId: actor.userId, prepId: payload.prepId }),
        };
      },
    });
    return Response.json(response);
  } catch (error) {
    return apiError(error);
  }
}
