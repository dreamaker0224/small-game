import { HighScoreRecord } from './types';

const SCORE_STORAGE_KEY = 'patisserie_cake_stack_records_v1';
const MUTE_STORAGE_KEY = 'patisserie_cake_stack_muted_v1';

export function loadHighScores(): HighScoreRecord {
  try {
    const raw = window.localStorage.getItem(SCORE_STORAGE_KEY);
    if (!raw) {
      return { bestScore: 0, bestLayers: 0, bestCombo: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<HighScoreRecord>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestLayers: typeof parsed.bestLayers === 'number' ? parsed.bestLayers : 0,
      bestCombo: typeof parsed.bestCombo === 'number' ? parsed.bestCombo : 0,
    };
  } catch {
    return { bestScore: 0, bestLayers: 0, bestCombo: 0 };
  }
}

export function saveHighScores(
  score: number,
  layers: number,
  maxCombo: number
): { record: HighScoreRecord; isNewBestScore: boolean; isNewBestLayers: boolean } {
  const prev = loadHighScores();
  const isNewBestScore = score > prev.bestScore;
  const isNewBestLayers = layers > prev.bestLayers;
  const next: HighScoreRecord = {
    bestScore: Math.max(prev.bestScore, score),
    bestLayers: Math.max(prev.bestLayers, layers),
    bestCombo: Math.max(prev.bestCombo, maxCombo),
  };
  try {
    window.localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors cleanly
  }
  return { record: next, isNewBestScore, isNewBestLayers };
}

export function loadMutedPref(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveMutedPref(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}
