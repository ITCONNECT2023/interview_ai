import { del } from "@vercel/blob";
import { deleteJobData, getJob, patchJob } from "@/lib/db/repository";
import { getServerEnv } from "@/lib/env/server";

export async function markDeleting(jobId: string) {
  "use step";
  await patchJob(jobId, { status: "DELETING", stage: "자료 삭제 중" });
}

export async function deleteJobBlob(jobId: string) {
  "use step";
  const job = await getJob(jobId);
  const token = getServerEnv().BLOB_READ_WRITE_TOKEN;
  if (job?.blobUrl && token) await del(job.blobUrl, { token });
}

export async function deleteJobRows(jobId: string) {
  "use step";
  await deleteJobData(jobId);
}
