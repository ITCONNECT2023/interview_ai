import { requireActor } from "@/lib/auth/actor";
import { getJob } from "@/lib/db/repository";
import { apiError } from "@/lib/security/request";

type Context = { params: Promise<{ jobId: string }> };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await requireActor();
    const { jobId } = await params;
    const job = await getJob(jobId, actor.organizationId);
    if (!job?.transcript) throw new Error("NOT_FOUND");
    const format = new URL(request.url).searchParams.get("format") === "hwp" ? "hwp" : "txt";
    const lines = job.transcript.segments.map((segment) => `[${formatTime(segment.startMs)}-${formatTime(segment.endMs)}] 화자 ${segment.speaker === "UNCLEAR" ? "[불명확]" : segment.speaker}\n${segment.text}`);
    if (format === "txt") {
      return new Response(lines.join("\n\n"), { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": `attachment; filename="transcript-${jobId}.txt"` } });
    }
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(job.metadata.title)}</title><h1>${escapeHtml(job.metadata.title)}</h1>${lines.map((line) => `<p>${escapeHtml(line).replace(/\n/g, "<br>")}</p>`).join("")}`;
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="transcript-${jobId}-hwp.html"` } });
  } catch (error) {
    return apiError(error);
  }
}

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
