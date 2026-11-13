import { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { GameHud } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { TitleOverlay } from './components/TitleOverlay';
import { CakeStackEngine } from './game/CakeStackEngine';
import {
  loadHighScores,
  loadMutedPref,
  saveHighScores,
  saveMutedPref,
} from './game/storage';
import { GameStatus, HighScoreRecord, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  layers: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  isDarkSky: false,
  lastEvent: 'none',
};

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CakeStackEngine | null>(null);

  const [status, setStatus] = useState<GameStatus>('TITLE');
  const statusRef = useRef<GameStatus>('TITLE');

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [records, setRecords] = useState<HighScoreRecord>(() => loadHighScores());
  const [newBestFlags, setNewBestFlags] = useState({
    score: false,
    layers: false,
  });
  const [muted, setMuted] = useState<boolean>(() => {
    const pref = loadMutedPref();
    soundEngine.setMuted(pref);
    return pref;
  });

  const updateStatus = useCallback((next: GameStatus) => {
    statusRef.current = next;
    setStatus(next);
    engineRef.current?.setStatus(next);
  }, []);

  // Initialize isolated 60fps Canvas Engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new CakeStackEngine(canvas, {
      onHudUpdate: (nextHud) => {
        setHud(nextHud);
      },
      onGameOver: (finalHud) => {
        setHud(finalHud);
        const saved = saveHighScores(
          finalHud.score,
          finalHud.layers,
          finalHud.maxCombo
        );
        setRecords(saved.record);
        setNewBestFlags({
          score: saved.isNewBestScore && finalHud.score > 0,
          layers: saved.isNewBestLayers && finalHud.layers > 0,
        });
        statusRef.current = 'GAME_OVER';
        setStatus('GAME_OVER');
      },
      onAutoPause: () => {
        statusRef.current = 'PAUSED';
        setStatus('PAUSED');
      },
    });

    engineRef.current = engine;
    engine.startLoop();

    const handleResize = () => {
      engine.resize();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    window.addEventListener('resize', handleResize);

    const handleBlur = () => {
      engine.handleWindowBlur();
    };
    const handleVisibility = () => {
      if (document.hidden) {
        engine.handleWindowBlur();
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiTap();
    setNewBestFlags({ score: false, layers: false });
    setHud(INITIAL_HUD);
    statusRef.current = 'PLAYING';
    setStatus('PLAYING');
    engineRef.current?.startNewGame();
  }, []);

  const handleTogglePause = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playUiTap();
    if (statusRef.current === 'PLAYING') {
      updateStatus('PAUSED');
    } else if (statusRef.current === 'PAUSED') {
      updateStatus('PLAYING');
    }
  }, [updateStatus]);

  const handleReturnTitle = useCallback(() => {
    soundEngine.playUiTap();
    setHud(INITIAL_HUD);
    updateStatus('TITLE');
  }, [updateStatus]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      saveMutedPref(next);
      if (!next) {
        soundEngine.unlock();
        soundEngine.playUiTap();
      }
      return next;
    });
  }, []);

  const handlePlayfieldPointerDown = useCallback(() => {
    if (statusRef.current !== 'PLAYING') return;
    soundEngine.unlock();
    engineRef.current?.triggerDrop();
  }, []);

  // Keyboard support (Space / Enter / ArrowDown to drop or confirm, Esc / P to pause)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (statusRef.current === 'PLAYING' || statusRef.current === 'PAUSED') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown') {
        if (statusRef.current === 'PLAYING') {
          e.preventDefault();
          soundEngine.unlock();
          engineRef.current?.triggerDrop();
        } else if (statusRef.current === 'TITLE' && e.code !== 'ArrowDown') {
          e.preventDefault();
          handleStart();
        } else if (statusRef.current === 'GAME_OVER' && e.code !== 'ArrowDown') {
          e.preventDefault();
          handleStart();
        } else if (statusRef.current === 'PAUSED' && e.code === 'Enter') {
          e.preventDefault();
          handleTogglePause();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleStart, handleTogglePause]);

  return (
    <main
      ref={containerRef}
      onPointerDown={handlePlayfieldPointerDown}
      className="relative h-[100dvh] w-full overflow-hidden bg-[#FFF8F0] select-none"
    >
      {/* Isolated 60fps Canvas Viewport */}
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-pointer touch-manipulation"
        aria-label="甜心鐘樓疊疊樂遊戲畫布"
      />

      {/* Title Screen Shell */}
      {status === 'TITLE' && (
        <div
          className="fixed inset-0 z-30"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <TitleOverlay
            records={records}
            muted={muted}
            onToggleMute={handleToggleMute}
            onStart={handleStart}
          />
        </div>
      )}

      {/* Active & Paused HUD */}
      {(status === 'PLAYING' || status === 'PAUSED') && (
        <GameHud
          hud={hud}
          status={status}
          muted={muted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
        />
      )}

      {/* Pause Modal */}
      {status === 'PAUSED' && (
        <PauseModal
          hud={hud}
          onResume={handleTogglePause}
          onRestart={handleStart}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {/* Game Over Modal */}
      {status === 'GAME_OVER' && (
        <GameOverModal
          hud={hud}
          records={records}
          isNewBestScore={newBestFlags.score}
          isNewBestLayers={newBestFlags.layers}
          onPlayAgain={handleStart}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </main>
  );
}
