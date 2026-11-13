import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { GameStatus, HudSnapshot } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  status: GameStatus;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
}

export function GameHud({
  hud,
  status,
  muted,
  onToggleMute,
  onTogglePause,
}: GameHudProps) {
  const inkPrimary = hud.isDarkSky ? 'text-[#FFF8F0]' : 'text-[#2D1B14]';
  const inkSecondary = hud.isDarkSky ? 'text-[#FDE68A]/90' : 'text-[#6B442E]';
  const btnSurface = hud.isDarkSky
    ? 'bg-[#2D1B14]/70 text-[#FFF8F0] hover:bg-[#2D1B14]/90 border border-[#FFF8F0]/20'
    : 'bg-[#FFFDF9]/85 text-[#2D1B14] hover:bg-[#FFFDF9] border border-[#2D1B14]/10';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-4 py-3 sm:px-6 sm:py-5">
      {/* Top Perimeter HUD Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-left: Unboxed tabular-nums Score & Layer Height */}
        <div className="flex flex-col">
          <div className={`flex items-baseline gap-2.5 transition-colors duration-300 ${inkPrimary}`}>
            <span className="font-mono-num text-3xl font-bold leading-none tracking-tight sm:text-4xl">
              {hud.layers}
            </span>
            <span className="text-sm font-bold">層</span>
          </div>

          <div
            className={`mt-1.5 flex items-center gap-2 text-xs font-semibold transition-colors duration-300 sm:text-sm ${inkSecondary}`}
          >
            <span className="font-mono-num">{hud.score.toLocaleString()} 分</span>
            {hud.combo >= 2 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-[#E11D48]">
                  連擊 ×{hud.combo}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-right: Mute & Pause interactive controls (>= 44x44px) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            aria-label={muted ? '開啟音效' : '靜音'}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl shadow-sm transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] ${btnSurface}`}
          >
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePause();
            }}
            aria-label={status === 'PAUSED' ? '繼續遊戲' : '暫停遊戲'}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl px-3 font-bold shadow-sm transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] ${btnSurface}`}
          >
            {status === 'PAUSED' ? (
              <Play className="h-5 w-5 fill-current" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
            <span className="hidden text-sm whitespace-nowrap sm:inline">
              {status === 'PAUSED' ? '繼續' : '暫停'}
            </span>
          </button>
        </div>
      </div>

      {/* Subtle initial tap prompt on layer 0 only */}
      {status === 'PLAYING' && hud.layers === 0 && (
        <div className="mb-6 flex justify-center sm:mb-8">
          <p className="rounded-lg bg-[#FFFDF9]/80 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#5C3A28] shadow-sm">
            點擊畫面任一處，將蛋糕落到瓷盤上
          </p>
        </div>
      )}
    </div>
  );
}
