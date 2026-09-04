"use client";

import { Pause, Play, Repeat2, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AudioPlayerHandle = { seek: (milliseconds: number, autoplay?: boolean) => void };

export function AudioPlayer({ src, durationMs, activeStartMs, onTime, playerRef }: { src?: string; durationMs: number; activeStartMs?: number; onTime?: (milliseconds: number) => void; playerRef?: React.MutableRefObject<AudioPlayerHandle | null> }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => { if (activeStartMs !== undefined && audioRef.current && Math.abs(audioRef.current.currentTime * 1000 - activeStartMs) > 1000) { audioRef.current.currentTime = activeStartMs / 1000; setCurrent(activeStartMs); } }, [activeStartMs]);
  useEffect(() => { if (playerRef) playerRef.current = { seek(milliseconds, autoplay = false) { if (!audioRef.current) return; audioRef.current.currentTime = milliseconds / 1000; setCurrent(milliseconds); if (autoplay) void audioRef.current.play(); } }; }, [playerRef]);

  function seek(deltaMs: number) {
    if (!audioRef.current) return;
    const next = Math.max(0, Math.min(durationMs, current + deltaMs));
    audioRef.current.currentTime = next / 1000;
    setCurrent(next);
  }

  async function toggle() {
    if (!audioRef.current || !src) return setError("이 작업의 음성 파일을 불러올 수 없습니다.");
    try { if (audioRef.current.paused) await audioRef.current.play(); else audioRef.current.pause(); } catch { setError("음성을 재생하지 못했습니다. 다시 불러와 주세요."); }
  }

  function repeat() { seek(-3000); void audioRef.current?.play(); }

  return (
    <div>
      <audio ref={audioRef} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(e) => { const ms = e.currentTarget.currentTime * 1000; setCurrent(ms); onTime?.(ms); }} onError={() => setError("음성 파일을 불러오지 못했습니다.")} />
      <div className="flex items-center gap-2">
        <button className="button button-secondary" onClick={() => seek(-5000)} aria-label="5초 뒤로"><RotateCcw size={15} /></button>
        <button className="button button-blue" style={{ width: 44 }} onClick={() => void toggle()} aria-label={playing ? "일시정지" : "재생"}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <button className="button button-secondary" onClick={() => seek(5000)} aria-label="5초 앞으로"><RotateCw size={15} /></button>
        <button className="button button-secondary" onClick={repeat} aria-label="3초 반복"><Repeat2 size={15} /></button>
        <select className="select" style={{ width: 82, padding: "8px" }} value={speed} onChange={(e) => { const value = Number(e.target.value); setSpeed(value); if (audioRef.current) audioRef.current.playbackRate = value; }} aria-label="재생 속도"><option value={0.8}>0.8x</option><option value={1}>1.0x</option><option value={1.2}>1.2x</option><option value={1.5}>1.5x</option></select>
      </div>
      <input className="w-full accent-blue-600" style={{ marginTop: 12 }} type="range" min={0} max={durationMs || 1} value={current} onChange={(e) => { const value = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = value / 1000; setCurrent(value); }} />
      <div className="mono flex justify-between text-[11px] text-slate-500"><span>{formatTime(current)}</span><span>{formatTime(durationMs)}</span></div>
      {error && <p className="error-text" style={{ marginTop: 8 }}>{error} <button className="underline" onClick={() => { setError(""); audioRef.current?.load(); }}>다시 불러오기</button></p>}
    </div>
  );
}

export function formatTime(ms: number) { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
