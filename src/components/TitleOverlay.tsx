import { Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';
import keyArtUrl from '../assets/images/patisserie_key_art_1794575603797.jpg';
import { HighScoreRecord } from '../game/types';

interface TitleOverlayProps {
  records: HighScoreRecord;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
}

export function TitleOverlay({
  records,
  muted,
  onToggleMute,
  onStart,
}: TitleOverlayProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-gradient-to-b from-[#FFF3E4] via-[#FCEBD6] to-[#E6C7A3]">
      {/* Illustrated Patisserie Key-Art Backdrop */}
      {!imgFailed && (
        <img
          src={keyArtUrl}
          alt="法式甜點店手繪背景"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
        />
      )}

      {/* Measured contrast scrim preserving calm upper-center negative space */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,248,240,0.88) 0%, rgba(255,248,240,0.68) 42%, rgba(45,27,20,0.46) 78%, rgba(45,27,20,0.78) 100%)',
        }}
      />

      {/* Top perimeter mute button */}
      <div className="relative z-10 flex items-center justify-end px-4 pt-3 sm:px-6 sm:pt-5">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? '開啟音效' : '靜音'}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#FFFDF9]/90 text-[#2D1B14] shadow-sm transition-transform duration-150 hover:bg-[#FFFDF9] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48]"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Center Hero Title Lockup over calm negative space */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center px-6 text-center">
        {/* Bespoke inline SVG patisserie pendulum & layered cake emblem */}
        <svg
          viewBox="0 0 120 108"
          className="mb-3 h-24 w-28 drop-shadow-sm sm:h-28 sm:w-32"
          aria-hidden="true"
        >
          {/* Clock dial */}
          <circle cx="60" cy="20" r="14" fill="#5C3317" />
          <circle cx="60" cy="20" r="11.5" fill="#FFFDF7" stroke="#F59E0B" strokeWidth="2.2" />
          <path d="M60 20 L60 13 M60 20 L65 22" stroke="#2D1B14" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="60" cy="20" r="2" fill="#E11D48" />
          {/* Pendulum rod */}
          <line x1="60" y1="34" x2="60" y2="54" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
          {/* Top cake slice */}
          <rect x="34" y="54" width="52" height="17" rx="4" fill="#FDE6BA" stroke="#3E2216" strokeOpacity="0.22" />
          <path d="M33 57 Q41 64 49 57 Q57 64 65 57 Q73 64 81 57 L87 57 L87 54 Q87 51 83 51 L37 51 Q33 51 33 54 Z" fill="#FFF9F5" />
          <circle cx="60" cy="48" r="4.5" fill="#E11D48" />
          <path d="M56 44 Q60 41 64 44" stroke="#16A34A" strokeWidth="2" fill="none" strokeLinecap="round" />
          {/* Base cake layer */}
          <rect x="24" y="73" width="72" height="20" rx="5" fill="#7B4B32" stroke="#3E2216" strokeOpacity="0.25" />
          <rect x="25" y="82" width="70" height="3.5" fill="#F59E0B" />
          <path d="M23 76 Q33 83 43 76 Q53 83 63 76 Q73 83 83 76 Q91 82 97 76 L97 73 Q97 70 93 70 L27 70 Q23 70 23 73 Z" fill="#FFFDF7" />
          {/* Porcelain plate */}
          <rect x="14" y="95" width="92" height="6" rx="3" fill="#FFFDF9" />
          <rect x="44" y="101" width="32" height="4" rx="2" fill="#E5DDD5" />
        </svg>

        <h1 className="font-display text-balance text-4xl font-bold tracking-tight text-[#2D1B14] sm:text-5xl">
          甜心鐘樓疊疊樂
        </h1>
        <p className="mt-2.5 max-w-xs text-sm font-medium leading-relaxed text-[#5C3A28] sm:text-base">
          抓準擺鐘節奏點擊放下蛋糕，精準對齊疊出最高法式甜點塔。
        </p>

        {/* Clean unboxed high-score metadata */}
        {records.bestLayers > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2.5 text-sm font-medium text-[#4A2C1D]">
            <span>
              最高紀錄 <strong className="font-mono-num font-bold">{records.bestLayers}</strong> 層
            </span>
            <span aria-hidden="true" className="text-[#9A6B4E]">
              ·
            </span>
            <span>
              <strong className="font-mono-num font-bold">{records.bestScore.toLocaleString()}</strong> 分
            </span>
          </div>
        )}
      </div>

      {/* Bottom CTA & Single Flat Control Hint */}
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-col items-center px-6 pb-8 sm:pb-10">
        <button
          type="button"
          onClick={onStart}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#E11D48] px-8 text-lg font-bold tracking-wide text-white shadow-[0_6px_0_#9F1239,0_12px_24px_rgba(45,27,20,0.28)] transition-all duration-150 hover:bg-[#BE123C] active:translate-y-1 active:shadow-[0_2px_0_#9F1239] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white whitespace-nowrap"
        >
          開始疊蛋糕
        </button>

        <p className="mt-5 text-center text-xs font-medium tracking-wide text-[#FFF8F0]/90">
          點擊螢幕放開蛋糕 · Space / Enter 投放 · Esc 暫停
        </p>
      </div>
    </div>
  );
}
