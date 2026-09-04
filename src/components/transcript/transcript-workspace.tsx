"use client";

import { AlertTriangle, Check, ChevronRight, Download, FileWarning, LoaderCircle, Quote, RotateCcw, Save, Scissors, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer, formatTime, type AudioPlayerHandle } from "@/components/transcript/audio-player";
import type { PublicJob, Speaker, TranscriptOperation, TranscriptResult, TranscriptSegment } from "@/types/job";

type SaveState = "saved" | "saving" | "failed";

export function TranscriptWorkspace({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<PublicJob | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [currentMs, setCurrentMs] = useState(0);
  const playerRef = useRef<AudioPlayerHandle | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("전사 결과를 불러오지 못했습니다.");
    const data = await response.json() as PublicJob;
    if (!data.transcript) throw new Error("전사가 아직 준비되지 않았습니다.");
    setJob(data); setTranscript(data.transcript); setVersion(data.transcriptVersion); setSelectedId((value) => value || data.transcript!.segments[0]?.id || "");
  }, [jobId]);

  useEffect(() => { const initial = window.setTimeout(() => void load().catch((cause) => setError(cause.message)), 0); return () => window.clearTimeout(initial); }, [load]);

  const visibleSegments = useMemo(() => transcript?.segments.filter((segment) => !query.trim() || segment.text.toLowerCase().includes(query.trim().toLowerCase())) ?? [], [transcript, query]);
  const selected = transcript?.segments.find((segment) => segment.id === selectedId);
  const reviewed = transcript?.segments.filter((segment) => segment.reviewed).length ?? 0;
  const total = transcript?.segments.length ?? 0;
  const unresolved = transcript?.reviewItems.filter((item) => !item.resolved).length ?? 0;

  async function mutate(operation: TranscriptOperation) {
    if (!transcript) return;
    setSaveState("saving"); setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}/transcript`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseVersion: version, operations: [operation] }) });
      if (!response.ok) throw new Error(await apiMessage(response));
      await load(); setSaveState("saved");
    } catch (cause) {
      setSaveState("failed"); setError(cause instanceof Error ? cause.message : "변경을 저장하지 못했습니다.");
    }
  }

  function updateLocal(id: string, text: string) { setTranscript((current) => current ? { ...current, segments: current.segments.map((segment) => segment.id === id ? { ...segment, text } : segment) } : current); }

  async function startDraft() {
    if (!transcript) return;
    if (unresolved > 0 && !window.confirm(`확인 필요 항목 ${unresolved}건을 유지한 채 초안을 생성하시겠습니까?`)) return;
    const response = await fetch(`/api/jobs/${jobId}/drafts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transcriptVersion: version }) });
    if (!response.ok) return setError(await apiMessage(response));
    router.push(`/jobs/${jobId}/draft`);
  }

  if (!job || !transcript) return <main className="page"><div className="panel p-8"><LoaderCircle className="animate-spin text-blue-600" /><p className="page-subtitle">전사와 저장 상태를 불러오는 중입니다.</p>{error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error} <button className="underline" onClick={() => void load()}>다시 하기</button></div>}</div></main>;

  return (
    <main className="page page-wide">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="page-title">전사 검토</h1><p className="page-subtitle">음성을 근거로 화자·문장·불명확 구간을 직접 확인하세요.</p></div><div className="flex items-center gap-2"><span className={`badge ${saveState === "failed" ? "badge-rose" : saveState === "saving" ? "badge-blue" : "badge-green"}`}>{saveState === "saving" ? <LoaderCircle size={12} className="animate-spin" /> : saveState === "failed" ? <AlertTriangle size={12} /> : <Check size={12} />}{saveState === "saving" ? "저장 중" : saveState === "failed" ? "저장 실패" : "자동 저장됨"}</span><span className="badge">전사 v{version}</span></div></div>

      {error && <div className="alert alert-error" style={{ marginTop: 16 }}><strong>검토 작업 오류</strong><br />{error} <button className="underline" onClick={() => void load()}>마지막 저장본 다시 불러오기</button></div>}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]" style={{ marginTop: 20 }}>
        <aside className="panel h-fit xl:sticky xl:top-20">
          <div className="panel-header"><strong className="text-sm">음성 트랙</strong><span className="badge">{job.originalName}</span></div>
          <div className="panel-body"><AudioPlayer src={job.audioUrl} durationMs={transcript.durationMs} activeStartMs={selected?.startMs} onTime={setCurrentMs} playerRef={playerRef} /><div className="mt-5 grid gap-2"><Info label="현재 구간" value={selected?.id ?? "-"} /><Info label="현재 화자" value={speakerLabel(selected?.speaker)} /><Info label="재생 위치" value={formatTime(currentMs)} /></div></div>
        </aside>

        <section className="min-w-0">
          <div className="panel">
            <div className="panel-header"><div><strong>시간순 전사</strong><p className="help">{visibleSegments.length}개 구간 표시</p></div><label className="relative"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" /><input className="input" style={{ paddingLeft: 34, width: 230 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="전사 검색" /></label></div>
            <div className="grid gap-3 p-4">
              {visibleSegments.length === 0 && <div className="p-8 text-center text-sm text-slate-500">검색 결과가 없습니다. <button className="underline" onClick={() => setQuery("")}>전체 전사로 돌아가기</button></div>}
              {visibleSegments.map((segment) => <SegmentCard key={segment.id} segment={segment} selected={segment.id === selectedId} selectedText={segment.id === selectedId ? selectedText : ""} onSelect={() => { setSelectedId(segment.id); setSelectedText(""); playerRef.current?.seek(segment.startMs); }} onTextSelection={(value) => { setSelectedId(segment.id); setSelectedText(value); }} onTextChange={(text) => updateLocal(segment.id, text)} onSaveText={() => void mutate({ type: "UPDATE_TEXT", segmentId: segment.id, text: segment.text })} onRestore={() => void mutate({ type: "RESTORE_TEXT", segmentId: segment.id })} onSpeaker={(speaker) => void mutate({ type: "SET_SPEAKER", segmentId: segment.id, speaker })} onReviewed={() => void mutate({ type: "SET_REVIEWED", segmentId: segment.id, reviewed: true })} onSplit={() => void mutate({ type: "SPLIT", segmentId: segment.id, atMs: Math.round((segment.startMs + segment.endMs) / 2) })} onQuote={() => void mutate({ type: "ADD_QUOTE", segmentId: segment.id, quote: selectedText || segment.text })} onEvidence={(classification) => void mutate({ type: "ADD_EVIDENCE", segmentId: segment.id, text: selectedText || segment.text, classification, reason: classification === "REVIEW" ? "UNCLEAR_AUDIO" : undefined })} />)}
            </div>
          </div>
        </section>

        <aside className="grid h-fit gap-4 xl:sticky xl:top-20">
          <section className="panel"><div className="panel-header"><strong className="text-sm">검토 현황</strong><span className="badge badge-blue">{total ? Math.round(reviewed / total * 100) : 0}%</span></div><div className="panel-body"><div className="progress-track"><div className="progress-fill" style={{ width: `${total ? reviewed / total * 100 : 0}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-2"><Info label="검토 완료" value={`${reviewed}/${total}`} /><Info label="미해결" value={`${unresolved}건`} /></div></div></section>
          <section className="panel"><div className="panel-header"><strong className="text-sm">근거 목록</strong></div><div className="panel-body grid gap-3"><EvidenceList title="인용문 후보" count={transcript.quoteCandidates.length} items={transcript.quoteCandidates.map((item) => ({ id: item.id, text: item.quote, segmentId: item.sourceSegmentIds[0] }))} onOpen={openEvidence} /><EvidenceList title="사실 정보" count={transcript.facts.length} items={transcript.facts.map((item) => ({ id: item.id, text: item.text, segmentId: item.sourceSegmentIds[0] }))} onOpen={openEvidence} /><EvidenceList title="확인 필요" count={unresolved} items={transcript.reviewItems.filter((item) => !item.resolved).map((item) => ({ id: item.id, text: item.text, segmentId: item.sourceSegmentIds[0] }))} onOpen={openEvidence} /></div></section>
          <section className="panel"><div className="panel-body grid gap-2"><a className="button button-secondary" href={`/api/jobs/${jobId}/transcript/export?format=txt`}><Download size={15} /> TXT 내보내기</a><a className="button button-secondary" href={`/api/jobs/${jobId}/transcript/export?format=hwp`}><Download size={15} /> HWP용 내보내기</a><button className="button button-primary" onClick={() => void startDraft()}>기사 초안 생성 <ChevronRight size={15} /></button><button className="button button-ghost" onClick={() => router.push("/jobs/new")}><RotateCcw size={14} /> 처음부터 다시 하기</button></div></section>
        </aside>
      </div>
    </main>
  );

  function openEvidence(segmentId: string) { const segment = transcript!.segments.find((item) => item.id === segmentId); if (!segment) return setError("근거 구간을 찾을 수 없습니다."); setSelectedId(segmentId); playerRef.current?.seek(segment.startMs); document.getElementById(`segment-${segmentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

function SegmentCard({ segment, selected, selectedText, onSelect, onTextSelection, onTextChange, onSaveText, onRestore, onSpeaker, onReviewed, onSplit, onQuote, onEvidence }: { segment: TranscriptSegment; selected: boolean; selectedText: string; onSelect: () => void; onTextSelection: (value: string) => void; onTextChange: (value: string) => void; onSaveText: () => void; onRestore: () => void; onSpeaker: (value: "A" | "B") => void; onReviewed: () => void; onSplit: () => void; onQuote: () => void; onEvidence: (value: "FACT" | "REVIEW") => void }) {
  const unclear = segment.text.includes("[불명확]") || segment.speaker === "UNCLEAR";
  return <article id={`segment-${segment.id}`} className={`segment-card rounded-xl border bg-white p-4 transition ${selected ? "border-2 border-blue-500 shadow-sm" : "border-slate-200"}`} onClick={onSelect}>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="badge mono">#{segment.id}</span><select className="select" style={{ width: 130, padding: "6px 8px" }} value={segment.speaker === "UNCLEAR" ? "" : segment.speaker} onChange={(e) => onSpeaker(e.target.value as "A" | "B")}><option value="" disabled>화자 [불명확]</option><option value="A">화자 A</option><option value="B">화자 B</option></select><button className="mono text-xs font-semibold text-blue-600 hover:underline" onClick={(e) => { e.stopPropagation(); onSelect(); }}>{formatTime(segment.startMs)}–{formatTime(segment.endMs)}</button></div><div className="flex gap-2">{unclear && <span className="badge badge-amber"><AlertTriangle size={12} /> 확인 필요</span>}{segment.reviewed && <span className="badge badge-green"><Check size={12} /> 검토 완료</span>}</div></div>
    <textarea className={`textarea mt-3 ${unclear ? "border-amber-300 bg-amber-50/40" : ""}`} value={segment.text} onChange={(e) => onTextChange(e.target.value)} onSelect={(e) => { const target = e.currentTarget; onTextSelection(target.value.slice(target.selectionStart, target.selectionEnd)); }} onBlur={onSaveText} aria-label={`${segment.id} 전사 수정`} />
    {unclear && <div className="alert mt-3"><FileWarning size={15} className="inline" /> 시스템은 들리지 않은 부분을 임의로 보완하지 않습니다. 음성으로 확인한 경우에만 직접 수정하세요.</div>}
    <div className="mt-3 flex flex-wrap gap-2"><button className="button button-secondary" onClick={onRestore}><RotateCcw size={14} /> 원문 복원</button><button className="button button-secondary" onClick={onSplit}><Scissors size={14} /> 중간에서 구간 분할</button><button className="button button-secondary" disabled={!selectedText && segment.text.includes("[불명확]")} onClick={onQuote}><Quote size={14} /> {selectedText ? "선택문 인용 등록" : "구간 인용 등록"}</button><button className="button button-secondary" onClick={() => onEvidence("FACT")}>사실 정보</button><button className="button button-secondary" onClick={() => onEvidence("REVIEW")}>확인 필요</button><button className="button button-blue" disabled={unclear} onClick={onReviewed}><Check size={14} /> 검토 완료</button></div>
  </article>;
}

function EvidenceList({ title, count, items, onOpen }: { title: string; count: number; items: Array<{ id: string; text: string; segmentId: string }>; onOpen: (segmentId: string) => void }) { return <details open={title === "확인 필요"}><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold"><span>{title}</span><span className="badge">{count}</span></summary><div className="mt-2 grid gap-2">{items.length === 0 ? <p className="help">0건</p> : items.slice(0, 5).map((item) => <button key={item.id} className="rounded-lg border border-slate-200 p-2 text-left text-[11px] leading-relaxed hover:border-blue-300" onClick={() => onOpen(item.segmentId)}>{item.text}<span className="mono mt-1 block text-blue-600">{item.segmentId}</span></button>)}</div></details>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><span className="help block">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>; }
function speakerLabel(speaker?: Speaker) { return speaker === "UNCLEAR" ? "화자 [불명확]" : speaker ? `화자 ${speaker}` : "-"; }
async function apiMessage(response: Response) { try { const body = await response.json() as { error?: { message?: string } }; return body.error?.message ?? "요청에 실패했습니다."; } catch { return "요청에 실패했습니다."; } }
