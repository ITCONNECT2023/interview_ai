"use client";

import { AlertTriangle, Check, Clock3, FileAudio, LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PublicJob } from "@/types/job";

const stages = ["업로드 확인", "화자 분리", "음성 전사", "전사 기반 분석", "결과 저장"];

export function ProcessingWorkspace({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [connectionError, setConnectionError] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("작업 상태를 가져오지 못했습니다.");
      const next = await response.json() as PublicJob;
      setJob(next);
      setConnectionError("");
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "연결 재시도 중입니다.");
    }
  }, [jobId]);

  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 2000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000); return () => window.clearInterval(timer); }, [startedAt]);

  const complete = job?.status === "TRANSCRIPT_READY" || job?.status === "DRAFT_READY";
  const failed = job?.status === "FAILED";
  const activeIndex = Math.max(0, Math.min(5, job?.stageIndex ?? 0));

  async function retry() {
    const response = await fetch(`/api/jobs/${jobId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "RETRY_TRANSCRIPTION" }) });
    if (response.ok) await load(); else setConnectionError("재시도를 시작하지 못했습니다.");
  }

  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <div className="text-center"><span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${failed ? "bg-rose-50 text-rose-600" : complete ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}>{failed ? <AlertTriangle /> : complete ? <Check /> : <LoaderCircle className="animate-spin" />}</span><h1 className="page-title" style={{ marginTop: 18 }}>{failed ? "전사를 완료하지 못했습니다" : complete ? "전사와 분석이 완료되었습니다" : "인터뷰를 전사하고 있습니다"}</h1><p className="page-subtitle">결과를 만들기 전까지 전사 내용은 화면에 노출하지 않습니다.</p></div>

      <section className="panel" style={{ marginTop: 28 }}>
        <div className="panel-header"><div className="flex items-center gap-3"><span className="brand-mark" style={{ background: "#eff6ff", color: "#2563eb" }}><FileAudio size={18} /></span><div><strong className="block text-sm">{job?.originalName ?? "작업 정보를 확인하는 중"}</strong><span className="help">{job ? `${Math.round(job.durationMsFromClient / 1000)}초 · ${job.metadata.title}` : "새로고침해도 같은 작업을 이어갑니다."}</span></div></div><span className="badge"><Clock3 size={12} /> {elapsed}초 경과</span></div>
        <div className="panel-body">
          <ol className="grid gap-3">
            {stages.map((stage, index) => {
              const number = index + 1;
              const done = complete || number < activeIndex;
              const active = !complete && !failed && number === activeIndex;
              const errorStage = failed && number === activeIndex;
              return (
                <li key={stage} className={`flex items-center gap-3 rounded-lg border p-3 ${active ? "border-blue-200 bg-blue-50" : errorStage ? "border-rose-200 bg-rose-50" : done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200"}`}>
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-blue-600 text-white" : errorStage ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-400"}`}>{done ? <Check size={15} /> : errorStage ? <AlertTriangle size={15} /> : number}</span>
                  <div><strong className="block text-sm">{stage}</strong><span className="help">{active ? "처리 중" : done ? "완료" : errorStage ? "오류" : "대기"}</span></div>
                  {active && <LoaderCircle size={16} className="ml-auto animate-spin text-blue-600" />}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {connectionError && <div className="alert" style={{ marginTop: 16 }}><strong>상태 연결을 다시 확인하고 있습니다.</strong><br />{connectionError} <button className="underline" onClick={() => void load()}>다시 조회</button></div>}
      {failed && <div className="alert alert-error" style={{ marginTop: 16 }}><strong>{job.error?.code ?? "TRANSCRIPTION_FAILED"}</strong><br />{job.error?.message ?? "전사 단계에서 오류가 발생했습니다."}</div>}
      {complete && <div className="grid grid-cols-3 gap-3" style={{ marginTop: 16 }}><Stat label="전사 구간" value={`${job.transcript?.segments.length ?? 0}개`} /><Stat label="불명확" value={`${job.transcript?.segments.filter((s) => s.text.includes("[불명확]")).length ?? 0}개`} /><Stat label="확인 필요" value={`${job.unresolvedCount}개`} /></div>}
      <div className="flex justify-end gap-2" style={{ marginTop: 22 }}>{failed && <><button className="button button-secondary" onClick={() => router.push("/jobs/new")}>업로드부터 다시 하기</button><button className="button button-primary" onClick={() => void retry()}><RotateCcw size={15} /> 같은 파일 재시도</button></>}{complete && <button className="button button-primary" onClick={() => router.push(`/jobs/${jobId}/transcript`)}>전사 검토로 이동</button>}</div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="panel p-4 text-center"><strong className="block text-xl">{value}</strong><span className="help">{label}</span></div>; }
