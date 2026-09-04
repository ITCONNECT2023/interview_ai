import { start } from "workflow/api";
import { listExpiredJobIds } from "@/lib/db/repository";
import { getServerEnv } from "@/lib/env/server";
import { apiError } from "@/lib/security/request";
import { deleteJobWorkflow } from "@/workflows/delete-job";

export async function GET(request: Request) {
  try {
    const secret = getServerEnv().CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) throw new Error("FORBIDDEN");
    const ids = await listExpiredJobIds();
    const runs = await Promise.all(ids.map(async (id) => (await start(deleteJobWorkflow, [id])).runId));
    return Response.json({ queued: runs.length, runs });
  } catch (error) {
    return apiError(error);
  }
}
