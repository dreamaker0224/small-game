import { Home, Play, RotateCcw } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface PauseModalProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseModal({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
}: PauseModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-dialog-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#2D1B14]/55 px-5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-xs rounded-3xl border border-[#E7D8C9] bg-[#FFFDF9] p-6 text-center shadow-2xl">
        <h2
          id="pause-dialog-title"
          className="font-display text-2xl font-bold text-[#2D1B14]"
        >
          遊戲暫停
        </h2>
        <p className="mt-1.5 text-sm font-medium text-[#6B442E]">
          目前疊至 <span className="font-mono-num font-bold">{hud.layers}</span> 層 ·{' '}
          <span className="font-mono-num font-bold">{hud.score.toLocaleString()}</span> 分
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-5 text-base font-bold text-white shadow-[0_4px_0_#9F1239] transition-all duration-150 hover:bg-[#BE123C] active:translate-y-0.5 active:shadow-[0_2px_0_#9F1239] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            繼續遊戲
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#DFCBB8] bg-[#FFF8F0] px-5 text-base font-bold text-[#2D1B14] transition-colors duration-150 hover:bg-[#F5E6D3] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D1B14] whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            重新開始
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[#6B442E] transition-colors duration-150 hover:bg-[#F5E6D3]/60 hover:text-[#2D1B14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D1B14] whitespace-nowrap"
          >
            <Home className="h-4 w-4" />
            返回主畫面
          </button>
        </div>
      </div>
    </div>
  );
}
