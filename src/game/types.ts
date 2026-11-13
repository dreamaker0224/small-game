export type GameStatus = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface CakeFlavor {
  id: string;
  name: string;
  spongeTop: string;
  spongeBottom: string;
  filling: string;
  frosting: string;
  frostingHighlight: string;
  dripColor: string;
  toppingPrimary: string;
  toppingSecondary: string;
  toppingStyle: 'strawberry' | 'blueberry' | 'matcha' | 'choco' | 'caramel' | 'lemon';
}

export interface CakeBlock {
  id: number;
  /** Center X relative to stage center (0 = center) */
  x: number;
  /** Bottom Y in world space (0 = ground pedestal surface, negative goes up) */
  bottomY: number;
  width: number;
  height: number;
  flavor: CakeFlavor;
  /** Squash-and-stretch deformation (0 = rest, >0 = squashed) */
  squash: number;
  squashVel: number;
  isPerfect?: boolean;
}

export interface FallingDebris {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  flavor: CakeFlavor;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  kind: 'crumb' | 'sparkle' | 'cream';
  rotation: number;
  rotSpeed: number;
}

export interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface SliceFlash {
  x: number;
  yTop: number;
  yBottom: number;
  life: number;
  maxLife: number;
}

export interface HudSnapshot {
  layers: number;
  score: number;
  combo: number;
  maxCombo: number;
  isDarkSky: boolean;
  lastEvent: 'none' | 'perfect' | 'expanded' | 'sliced';
}

export interface HighScoreRecord {
  bestScore: number;
  bestLayers: number;
  bestCombo: number;
}
