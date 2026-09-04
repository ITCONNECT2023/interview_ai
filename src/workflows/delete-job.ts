import { deleteJobBlob, deleteJobRows, markDeleting } from "@/workflows/steps/delete-job";

export async function deleteJobWorkflow(jobId: string) {
  "use workflow";
  await markDeleting(jobId);
  await deleteJobBlob(jobId);
  await deleteJobRows(jobId);
  return { jobId, status: "DELETED" as const };
}
