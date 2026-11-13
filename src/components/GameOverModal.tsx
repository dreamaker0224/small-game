import { Home, RotateCcw, Trophy } from 'lucide-react';
import { HighScoreRecord, HudSnapshot } from '../game/types';

interface GameOverModalProps {
  hud: HudSnapshot;
  records: HighScoreRecord;
  isNewBestScore: boolean;
  isNewBestLayers: boolean;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
}

export function GameOverModal({
  hud,
  records,
  isNewBestScore,
  isNewBestLayers,
  onPlayAgain,
  onReturnTitle,
}: GameOverModalProps) {
  const brokeRecord = isNewBestScore || isNewBestLayers;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-dialog-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#2D1B14]/60 px-5"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm rounded-3xl border border-[#E7D8C9] bg-[#FFFDF9] p-6 text-center shadow-2xl sm:p-7">
        {brokeRecord && (
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider text-[#D97706]">
            <Trophy className="h-4 w-4" />
            <span>締造新紀錄</span>
          </div>
        )}

        <h2
          id="gameover-dialog-title"
          className="font-display text-3xl font-bold text-[#2D1B14]"
        >
          甜點塔完成
        </h2>
        <p className="mt-1 text-sm font-medium text-[#6B442E]">
          {hud.layers === 0
            ? '差一點點就落到瓷盤上囉，再試一次吧！'
            : hud.layers >= 20
              ? '太厲害了！這座甜點鐘樓直達巴黎夜空。'
              : '手藝不錯，下一次一定能疊得更高！'}
        </p>

        {/* 3-metric score summary */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-[#EADCCF] rounded-2xl border border-[#EADCCF] bg-[#FFF8F0] py-3.5">
          <div className="flex flex-col items-center px-2">
            <span className="text-xs font-medium text-[#7C5640]">堆疊層數</span>
            <span className="font-mono-num mt-1 text-2xl font-bold text-[#2D1B14]">
              {hud.layers}
            </span>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-xs font-medium text-[#7C5640]">總得分</span>
            <span className="font-mono-num mt-1 text-2xl font-bold text-[#E11D48]">
              {hud.score.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-xs font-medium text-[#7C5640]">最高連擊</span>
            <span className="font-mono-num mt-1 text-2xl font-bold text-[#D97706]">
              ×{hud.maxCombo}
            </span>
          </div>
        </div>

        {/* Historical best unboxed metadata */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-[#7C5640]">
          <span>
            歷史最高 <strong className="font-mono-num text-[#2D1B14]">{records.bestLayers}</strong> 層
          </span>
          <span aria-hidden="true">·</span>
          <span>
            最佳分數{' '}
            <strong className="font-mono-num text-[#2D1B14]">
              {records.bestScore.toLocaleString()}
            </strong>
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E11D48] px-5 text-base font-bold text-white shadow-[0_4px_0_#9F1239] transition-all duration-150 hover:bg-[#BE123C] active:translate-y-0.5 active:shadow-[0_2px_0_#9F1239] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48] whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            再玩一次
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
