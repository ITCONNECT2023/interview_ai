"use client";

import { upload } from "@vercel/blob/client";
import { AlertTriangle, Check, FileAudio, LoaderCircle, RotateCcw, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { validateAudioDuration, validateAudioFileMetadata } from "@/lib/validators/audio";

type SelectedAudio = { file: File; durationMs: number };

export function UploadWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [audio, setAudio] = useState<SelectedAudio | null>(null);
  const [fileError, setFileError] = useState("");
  const [title, setTitle] = useState("");
  const [sourceIdentifier, setSourceIdentifier] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [beat, setBeat] = useState("");
  const [recordedAt, setRecordedAt] = useState("");
  const [disclosure, setDisclosure] = useState("ON_RECORD");
  const [consent, setConsent] = useState(false);
  const [extractQuotes, setExtractQuotes] = useState(true);
  const [extractFacts, setExtractFacts] = useState(true);
  const [progress, setProgress] = useState(0);
  const [uploadMode, setUploadMode] = useState<"local" | "vercel-blob">("local");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const formValid = Boolean(audio && title.trim() && sourceIdentifier.trim() && reporterName.trim() && consent && status !== "uploading");

  async function chooseFile(file?: File) {
    setFileError("");
    setAudio(null);
    setStatus("idle");
    if (!file) return;
    const metadata = validateAudioFileMetadata(file);
    if (!metadata.valid) return setFileError(metadata.message);
    try {
      const durationMs = await readDuration(file);
      const duration = validateAudioDuration(durationMs);
      if (!duration.valid) return setFileError(duration.message);
      setAudio({ file, durationMs });
    } catch {
      setFileError("재생할 수 없는 파일입니다. 다른 음성을 선택해 주세요.");
    }
  }

  async function begin() {
    if (!formValid || !audio) return;
    setStatus("uploading");
    setError("");
    setProgress(0);
    try {
      const prepId = crypto.randomUUID();
      const prefixResponse = await fetch("/api/blob/upload");
      if (!prefixResponse.ok) throw new Error(await getApiMessage(prefixResponse));
      const { prefix, mode } = await prefixResponse.json() as { prefix: string; mode: "local" | "vercel-blob" };
      setUploadMode(mode);
      const safeName = audio.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = mode === "local"
        ? await uploadLocalFile(audio.file, prepId, setProgress)
        : await upload(`${prefix}/${prepId}/${safeName}`, audio.file, {
            access: "private",
            handleUploadUrl: "/api/blob/upload",
            multipart: audio.file.size > 5 * 1024 * 1024,
            contentType: audio.file.type,
            clientPayload: JSON.stringify({ prepId, mimeType: audio.file.type, bytes: audio.file.size }),
            onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
          });
      setProgress(100);
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          upload: { blobPath: blob.pathname, blobUrl: blob.url, originalName: audio.file.name, mimeType: audio.file.type, bytes: audio.file.size, durationMsFromClient: Math.round(audio.durationMs), etag: blob.etag },
          metadata: { title: title.trim(), sourceIdentifier: sourceIdentifier.trim(), reporterName: reporterName.trim(), beat: beat.trim() || undefined, recordedAt: recordedAt ? new Date(recordedAt).toISOString() : undefined, disclosure, consentAccepted: true },
          options: { extractQuotes, extractFactsAndReviewItems: extractFacts },
        }),
      });
      if (!response.ok) throw new Error(await getApiMessage(response));
      const result = await response.json() as { jobId: string };
      setStatus("done");
      router.push(`/jobs/${result.jobId}/processing`);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "업로드에 실패했습니다.");
    }
  }

  return (
    <main className="page">
      <h1 className="page-title">인터뷰 음성 등록</h1>
      <p className="page-subtitle">10분 이내의 음성을 등록하면 화자 구분 전사와 기사 초안 재료를 만듭니다.</p>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]" style={{ marginTop: 26 }}>
        <section className="panel">
          <div className="panel-header"><div><strong>1. 음성 파일</strong><p className="help" style={{ marginTop: 4 }}>mp3 · m4a · wav / 최대 10분 · 100MB</p></div><FileAudio size={22} color="#2563eb" /></div>
          <div className="panel-body">
            {!audio ? (
              <button type="button" className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center hover:border-blue-400 hover:bg-blue-50" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void chooseFile(event.dataTransfer.files[0]); }}>
                <UploadCloud size={34} style={{ margin: "0 auto 12px", color: "#2563eb" }} />
                <strong className="block text-sm">파일을 끌어 놓거나 찾아보세요</strong>
                <span className="help">한 번에 음성 파일 1개만 등록할 수 있습니다.</span>
              </button>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="brand-mark" style={{ background: "#2563eb" }}><FileAudio size={17} /></span><div><strong className="block text-sm">{audio.file.name}</strong><span className="help">{formatBytes(audio.file.size)} · {formatTime(audio.durationMs)}</span></div></div><button className="button button-ghost" aria-label="파일 제거" onClick={() => { setAudio(null); setProgress(0); }}><X size={17} /></button></div>
                <div className="badge badge-green" style={{ marginTop: 12 }}><Check size={12} /> 검증 완료</div>
              </div>
            )}
            <input ref={inputRef} className="sr-only" type="file" accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav,audio/x-wav" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            {fileError && <p className="error-text" style={{ marginTop: 10 }}><AlertTriangle size={14} className="inline" /> {fileError}</p>}
            {status === "uploading" && <div style={{ marginTop: 18 }}><div className="flex justify-between text-xs"><span>{uploadMode === "local" ? "내 컴퓨터에 안전하게 저장 중" : "Private Blob으로 전송 중"}</span><strong>{progress}%</strong></div><div className="progress-track" style={{ marginTop: 8 }}><div className="progress-fill" style={{ width: `${progress}%` }} /></div></div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header"><strong>2. 취재 정보</strong><span className="badge">필수값 표시</span></div>
          <div className="panel-body grid gap-4 sm:grid-cols-2">
            <label className="field sm:col-span-2"><span className="label">취재·보도 건명 *</span><input className="input" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 제도 개편 백브리핑" /></label>
            <label className="field"><span className="label">취재원 식별자 *</span><input className="input" maxLength={100} value={sourceIdentifier} onChange={(e) => setSourceIdentifier(e.target.value)} placeholder="사용자가 정한 식별자" /><span className="help">화자 신원은 자동 추정하지 않습니다.</span></label>
            <label className="field"><span className="label">담당 기자 *</span><input className="input" maxLength={100} value={reporterName} onChange={(e) => setReporterName(e.target.value)} /></label>
            <label className="field"><span className="label">출입처·부처</span><input className="input" maxLength={100} value={beat} onChange={(e) => setBeat(e.target.value)} /></label>
            <label className="field"><span className="label">녹음 일시</span><input className="input" type="datetime-local" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} /></label>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2" style={{ marginTop: 20 }}>
        <section className="panel"><div className="panel-header"><strong>3. 공개 범위와 자료 처리</strong></div><div className="panel-body grid gap-4">
          <label className="field"><span className="label">발언 공개 범위 *</span><select className="select" value={disclosure} onChange={(e) => setDisclosure(e.target.value)}><option value="ON_RECORD">On the Record</option><option value="BACKGROUND">Background</option><option value="OFF_RECORD">Off the Record</option></select></label>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} /><span><strong className="block">자료 처리에 동의합니다. *</strong><span className="help">원본·전사·분석·초안은 최대 30일 보관 후 자동 삭제됩니다. 사용자는 그 전에 즉시 삭제할 수 있습니다.</span></span></label>
        </div></section>
        <section className="panel"><div className="panel-header"><strong>4. 분석 옵션</strong></div><div className="panel-body grid gap-3">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><span><strong className="block">화자 분리</strong><span className="help">화자 A·B, 판별 실패는 화자 [불명확]</span></span><input type="checkbox" checked disabled /></label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><span><strong className="block">핵심 인용문 자동 추출</strong><span className="help">전사 원문과 일치하는 후보만 추출</span></span><input type="checkbox" checked={extractQuotes} onChange={(e) => setExtractQuotes(e.target.checked)} /></label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><span><strong className="block">사실·확인 필요 항목 추출</strong><span className="help">외부 검색·대조 없이 전사 내부만 분류</span></span><input type="checkbox" checked={extractFacts} onChange={(e) => setExtractFacts(e.target.checked)} /></label>
        </div></section>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 20 }}><strong>업로드하지 못했습니다.</strong><br />{error}</div>}
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 24 }}>
        <p className="help">전사에 없는 내용 생성, 화자 신원 추정, 안 들린 부분 임의 보완은 하지 않습니다.</p>
        <div className="flex gap-2">{status === "error" && <button className="button button-secondary" onClick={begin}><RotateCcw size={15} /> 다시 시도</button>}<button className="button button-primary" disabled={!formValid} onClick={begin}>{status === "uploading" ? <><LoaderCircle className="animate-spin" size={16} /> 업로드 중</> : "전사 및 분석 시작"}</button></div>
      </div>
    </main>
  );
}

function readDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { const value = audio.duration * 1000; URL.revokeObjectURL(url); resolve(value); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("AUDIO_DAMAGED")); };
    audio.src = url;
  });
}
function formatBytes(bytes: number) { return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`; }
function formatTime(ms: number) { const seconds = Math.round(ms / 1000); return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`; }
async function getApiMessage(response: Response) { try { const body = await response.json() as { error?: { message?: string } }; return body.error?.message ?? "요청에 실패했습니다."; } catch { return "요청에 실패했습니다."; } }
type StoredUpload = { pathname: string; url: string; etag: string };

function uploadLocalFile(file: File, prepId: string, onProgress: (percentage: number) => void) {
  return new Promise<StoredUpload>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/blob/upload");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      const body = request.response as StoredUpload | { error?: { message?: string } } | null;
      if (request.status >= 200 && request.status < 300 && body && "pathname" in body) resolve(body);
      else reject(new Error(body && "error" in body ? body.error?.message ?? "로컬 저장에 실패했습니다." : "로컬 저장에 실패했습니다."));
    };
    request.onerror = () => reject(new Error("로컬 저장 서버에 연결하지 못했습니다."));
    const form = new FormData();
    form.append("file", file);
    form.append("prepId", prepId);
    request.send(form);
  });
}
