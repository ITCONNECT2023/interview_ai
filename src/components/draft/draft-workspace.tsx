"use client";

import { AlertTriangle, Check, Clipboard, ExternalLink, FileText, Headphones, LoaderCircle, Quote, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer, type AudioPlayerHandle, formatTime } from "@/components/transcript/audio-player";
import type { Lead, PublicJob, TranscriptSegment } from "@/types/job";

type Tab = "key" | "quotes" | "facts" | "review";
type LeadType = "FACT" | "QUOTE" | "ISSUE";

export function DraftWorkspace({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("quotes");
  const [sourceId, setSourceId] = useState("");
  const [copied, setCopied] = useState("");
  const [cmsConfirmed, setCmsConfirmed] = useState(false);
  const [delivery, setDelivery] = useState<{ receiptId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const playerRef = useRef<AudioPlayerHandle | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("초안 결과를 불러오지 못했습니다.");
      const data = await response.json() as PublicJob;
      setJob(data); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "초안 결과를 불러오지 못했습니다."); }
  }, [jobId]);

  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(initial); }, [load]);
  useEffect(() => {
    if (job?.status !== "DRAFTING") return;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [job?.status, load]);

  const draft = job?.draft;
  const transcript = job?.transcript;
  const selectedLeadType = draft?.selectedLeadType ?? "FACT";
  const selectedLead = draft?.leads[selectedLeadType.toLowerCase() as "fact" | "quote" | "issue"];
  const source = transcript?.segments.find((segment) => segment.id === sourceId);
  const unresolved = transcript?.reviewItems.filter((item) => !item.resolved).length ?? 0;

  async function selectLead(type: LeadType) {
    if (!draft || !job) return;
    const previousLeadType = draft.selectedLeadType;
    setJob({ ...job, draft: { ...draft, selectedLeadType: type } });
    const response = await fetch(`/api/jobs/${jobId}/drafts`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ draftVersion: job.draftVersion, leadType: type }) });
    if (!response.ok) {
      setJob({ ...job, draft: { ...draft, selectedLeadType: previousLeadType } });
      setError(await apiMessage(response));
    }
  }

  function openSource(ids: string[]) {
    const id = ids[0];
    const segment = transcript?.segments.find((item) => item.id === id);
    if (!segment) return setError("연결된 근거 전사를 찾을 수 없습니다.");
    setSourceId(id); playerRef.current?.seek(segment.startMs);
    document.getElementById("source-review")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function copyText(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1800); }
    catch { setError("클립보드 권한이 없습니다. 문장을 직접 선택해 복사해 주세요."); }
  }

  async function regenerate() {
    if (!job?.transcriptVersion) return;
    setBusy(true);
    const response = await fetch(`/api/jobs/${jobId}/drafts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transcriptVersion: job.transcriptVersion }) });
    setBusy(false);
    if (!response.ok) return setError(await apiMessage(response));
    await load();
  }

  async function deliver() {
    if (!job?.draftVersion || !cmsConfirmed) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/jobs/${jobId}/cms-deliveries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draftVersion: job.draftVersion, confirm: true, idempotencyKey: crypto.randomUUID() }) });
    setBusy(false);
    if (!response.ok) return setError(await apiMessage(response));
    setDelivery(await response.json() as { receiptId: string });
  }

  if (!job || job.status === "DRAFTING" || !draft || !transcript) return <GenerationState job={job} error={error} onRetry={() => void load()} />;

  const articleText = [selectedLead?.text, ...draft.paragraphs.map((paragraph) => paragraph.text)].filter(Boolean).join("\n\n");

  return (
    <main className="page page-wide">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="page-title">기사 초안 & 취재원 대조</h1><p className="page-subtitle">완성 문장형 초안을 읽되, 모든 문장과 인용은 원문 위치에서 다시 확인할 수 있습니다.</p></div><div className="flex flex-wrap gap-2"><button className="button button-secondary" onClick={() => router.push(`/jobs/${jobId}/transcript`)}><ExternalLink size={15} /> 원문 전사 다시보기</button><button className="button button-secondary" onClick={() => void copyText(articleText, "draft")}><Clipboard size={15} /> {copied === "draft" ? "복사됨" : "초안 전체 복사"}</button></div></div>

      <div className="alert" style={{ marginTop: 18 }}><AlertTriangle size={15} className="inline" /> 이 초안은 전사 내부 근거만 사용했습니다. `[확인 필요]` {unresolved}건을 확인한 뒤 데스크 검토함으로 보내세요.</div>
      {error && <div className="alert alert-error" style={{ marginTop: 14 }}><strong>작업을 완료하지 못했습니다.</strong><br />{error} <button className="underline" onClick={() => setError("")}>닫기</button></div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_420px]" style={{ marginTop: 18 }}>
        <div className="grid gap-5">
          <section className="panel"><div className="panel-header"><div><strong>도입부(Lead) 제안안</strong><p className="help">하나를 선택하면 본문 첫 단락에 반영됩니다.</p></div><span className="badge">전사 v{draft.transcriptVersion} · 초안 v{job.draftVersion}</span></div><div className="panel-body grid gap-3">{(["FACT", "QUOTE", "ISSUE"] as LeadType[]).map((type) => <LeadCard key={type} type={type} lead={draft.leads[type.toLowerCase() as "fact" | "quote" | "issue"]} selected={selectedLeadType === type} onSelect={() => void selectLead(type)} onSource={openSource} />)}</div></section>

          <article className="panel overflow-hidden"><div className="panel-header"><div className="flex items-center gap-2"><FileText size={20} /><strong>권장 기사 본문 초안</strong></div><span className="badge badge-blue">문장형 초안</span></div><div className="p-6 md:p-9"><section className="rounded-xl border border-blue-100 bg-blue-50/60 p-5"><span className="badge badge-blue">선택 리드</span><p className="mt-3 text-[16px] leading-8 text-slate-900">{selectedLead?.text}</p><SourceButton ids={selectedLead?.sourceSegmentIds ?? []} onClick={openSource} /></section><div className="mt-7 grid gap-7">{draft.paragraphs.map((paragraph) => <section key={paragraph.order}><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold">{paragraph.heading}</h2><span className="mono text-[11px] text-slate-400">문단 {paragraph.order}</span></div><p className="text-[16px] leading-8 text-slate-800">{paragraph.text}</p><SourceButton ids={paragraph.sourceSegmentIds} onClick={openSource} /></section>)}</div></div></article>

          <section className="panel" id="source-review"><div className="panel-header"><div><strong>원문·음성 근거 대조</strong><p className="help">근거 링크 한 번으로 해당 전사와 음성 위치를 엽니다.</p></div><Headphones size={19} color="#2563eb" /></div><div className="panel-body">{source ? <div className="grid gap-4 md:grid-cols-[1fr_280px]"><div className="rounded-lg border border-blue-200 bg-blue-50 p-4"><div className="flex items-center gap-2"><span className="badge mono">{source.id}</span><span className="badge">{speakerLabel(source)}</span><span className="mono text-xs text-blue-700">{formatTime(source.startMs)}–{formatTime(source.endMs)}</span></div><p className="mt-3 text-sm leading-7">{source.text}</p></div><AudioPlayer src={job.audioUrl} durationMs={transcript.durationMs} activeStartMs={source.startMs} playerRef={playerRef} /></div> : <p className="py-5 text-center text-sm text-slate-500">리드·문단·취재 데이터의 근거 링크를 누르세요.</p>}</div></section>
        </div>

        <aside className="grid h-fit gap-5 xl:sticky xl:top-20">
          <section className="panel overflow-hidden"><div className="flex overflow-x-auto border-b border-slate-200">{(["key", "quotes", "facts", "review"] as Tab[]).map((value) => <button key={value} className={`shrink-0 border-b-2 px-4 py-3 text-xs font-bold ${tab === value ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`} onClick={() => setTab(value)}>{tabLabel(value)} <span className="ml-1">{tabCount(value, transcript)}</span></button>)}</div><div className="panel-body grid gap-3">{tabItems(tab, transcript).length === 0 ? <p className="help">0건</p> : tabItems(tab, transcript).map((item) => <div key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className={`badge ${tab === "review" ? "badge-amber" : tab === "facts" ? "badge-green" : "badge-blue"}`}>{item.id}</span><button className="mono text-[11px] font-bold text-blue-600 hover:underline" onClick={() => openSource(item.ids)}>{item.ids[0]}</button></div><p className="mt-2 text-xs leading-6 text-slate-700">{item.text}</p>{tab === "quotes" && <button className="button button-ghost mt-2" onClick={() => void copyText(item.text, item.id)}><Quote size={13} /> {copied === item.id ? "복사됨" : "인용문 복사"}</button>}</div>)}</div></section>

          <section className="panel"><div className="panel-header"><strong className="text-sm">본문 구조</strong></div><ol className="panel-body grid gap-3">{draft.outline.map((item) => <li key={item.order} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{item.order}</span><div><strong className="block text-xs">{item.heading}</strong><p className="help mt-1">{item.purpose}</p></div></li>)}</ol></section>

          <section className="panel"><div className="panel-header"><div><strong className="text-sm">CMS 데스크 송고</strong><p className="help">게시가 아닌 편집 검토함 접수입니다.</p></div><Send size={18} /></div><div className="panel-body grid gap-3">{delivery ? <div className="alert" style={{ borderColor: "#a7f3d0", background: "#ecfdf5", color: "#047857" }}><Check size={15} className="inline" /> 데스크 접수 완료<br /><span className="mono">{delivery.receiptId}</span></div> : <><label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={cmsConfirmed} onChange={(e) => setCmsConfirmed(e.target.checked)} style={{ marginTop: 3 }} /><span>확인 필요 {unresolved}건과 최신 초안 v{job.draftVersion}을 검토했으며 데스크 검토함으로 보냅니다.</span></label><button className="button button-primary" disabled={!cmsConfirmed || busy} onClick={() => void deliver()}>{busy ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />} CMS 데스크 송고</button></>}</div></section>
          <section className="panel"><div className="panel-body grid gap-2"><button className="button button-secondary" disabled={busy} onClick={() => void regenerate()}><RotateCcw size={14} /> 같은 전사로 재생성</button><button className="button button-secondary" onClick={() => router.push(`/jobs/${jobId}/transcript`)}>전사 검토로 돌아가기</button><button className="button button-ghost" onClick={() => router.push("/jobs/new")}>업로드부터 다시 하기</button></div></section>
        </aside>
      </div>
    </main>
  );
}

function GenerationState({ job, error, onRetry }: { job: PublicJob | null; error: string; onRetry: () => void }) {
  const failed = job?.status === "FAILED";
  const labels = ["리드 생성", "본문 구조 생성", "본문 초안 생성", "근거 검증"];
  return <main className="page" style={{ maxWidth: 820 }}><div className="text-center"><span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${failed ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}>{failed ? <AlertTriangle /> : <LoaderCircle className="animate-spin" />}</span><h1 className="page-title mt-4">{failed ? "초안을 생성하지 못했습니다" : "근거 기반 기사 초안을 만들고 있습니다"}</h1><p className="page-subtitle">검증을 통과하기 전에는 결과를 보여주지 않습니다.</p></div><section className="panel mt-7"><div className="panel-body grid gap-3">{labels.map((label, index) => <div key={label} className={`flex items-center gap-3 rounded-lg border p-3 ${job && index + 1 === job.stageIndex ? "border-blue-200 bg-blue-50" : index + 1 < (job?.stageIndex ?? 0) ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-bold">{index + 1}</span><strong className="text-sm">{label}</strong></div>)}</div></section>{(failed || error) && <div className="alert alert-error mt-4">{job?.error?.message ?? error}<br /><button className="underline" onClick={onRetry}>마지막 유효 상태 다시 불러오기</button></div>}</main>;
}

function LeadCard({ type, lead, selected, onSelect, onSource }: { type: LeadType; lead: Lead; selected: boolean; onSelect: () => void; onSource: (ids: string[]) => void }) { return <label className={`block cursor-pointer rounded-xl border p-4 transition ${selected ? "border-2 border-blue-500 bg-blue-50/50" : "border-slate-200 hover:border-blue-300"}`}><div className="flex items-center gap-3"><input type="radio" name="lead" checked={selected} onChange={onSelect} /><span className="badge badge-blue">{type === "FACT" ? "사실형" : type === "QUOTE" ? "인용형" : "이슈형"}</span></div><p className="mt-3 text-sm leading-7 text-slate-800">{lead.text}</p><SourceButton ids={lead.sourceSegmentIds} onClick={onSource} /></label>; }
function SourceButton({ ids, onClick }: { ids: string[]; onClick: (ids: string[]) => void }) { return <button className="mono mt-3 text-[11px] font-bold text-blue-600 hover:underline" onClick={(event) => { event.preventDefault(); onClick(ids); }}>근거 {ids.join(", ")}</button>; }
function speakerLabel(segment: TranscriptSegment) { return segment.speaker === "UNCLEAR" ? "화자 [불명확]" : `화자 ${segment.speaker}`; }
function tabLabel(tab: Tab) { return ({ key: "핵심", quotes: "인용", facts: "사실", review: "확인" } as const)[tab]; }
function tabCount(tab: Tab, transcript: NonNullable<PublicJob["transcript"]>) { return tab === "key" ? transcript.keyStatements.length : tab === "quotes" ? transcript.quoteCandidates.length : tab === "facts" ? transcript.facts.length : transcript.reviewItems.length; }
function tabItems(tab: Tab, transcript: NonNullable<PublicJob["transcript"]>) { if (tab === "key") return transcript.keyStatements.map((item) => ({ id: item.id, text: item.text, ids: item.sourceSegmentIds })); if (tab === "quotes") return transcript.quoteCandidates.map((item) => ({ id: item.id, text: item.quote, ids: item.sourceSegmentIds })); if (tab === "facts") return transcript.facts.map((item) => ({ id: item.id, text: item.text, ids: item.sourceSegmentIds })); return transcript.reviewItems.map((item) => ({ id: item.id, text: item.text, ids: item.sourceSegmentIds })); }
async function apiMessage(response: Response) { try { const body = await response.json() as { error?: { message?: string } }; return body.error?.message ?? "요청에 실패했습니다."; } catch { return "요청에 실패했습니다."; } }
