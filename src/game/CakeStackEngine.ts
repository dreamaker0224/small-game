import { soundEngine } from '../audio/soundEngine';
import { pickFlavorForLayer } from './cakeFlavors';
import {
  CakeBlock,
  CakeFlavor,
  FallingDebris,
  FloatingCallout,
  GameStatus,
  HudSnapshot,
  Particle,
  SliceFlash,
} from './types';

interface FallingCake {
  x: number;
  bottomY: number;
  width: number;
  height: number;
  vy: number;
  flavor: CakeFlavor;
}

interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onGameOver: (finalHud: HudSnapshot) => void;
  onAutoPause: () => void;
}

const CAKE_HEIGHT = 42;
const GRAVITY = 4100;
const INITIAL_DROP_VY = 210;
const PERFECT_TOLERANCE = 7.5;
const EXPAND_STEP = 14;
const EXPAND_STREAK = 3;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${b})`;
}

export class CakeStackEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private elapsedTime = 0;

  private viewW = 390;
  private viewH = 844;
  private dpr = 1;
  private reducedMotion = false;

  private status: GameStatus = 'TITLE';

  // Tower & active state
  private layers: CakeBlock[] = [];
  private fallingCake: FallingCake | null = null;
  private debris: FallingDebris[] = [];
  private particles: Particle[] = [];
  private callouts: FloatingCallout[] = [];
  private sliceFlashes: SliceFlash[] = [];

  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private currentWidth = 156;
  private initialWidth = 156;
  private standWidth = 236;
  private nextFlavorIndex = 0;

  // Pendulum state
  private pendulumPhase = 0;
  private pendulumAngle = 0;
  private clampOpen = 0;
  private cakeSpawnScale = 1;
  private hasActiveCakeOnHook = true;

  // Camera & juice
  private cameraY = 0;
  private targetCameraY = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private missDelayTimer = 0;
  private pendingGameOver = false;

  // Cached decorative stars for night sky
  private stars: Array<{ x: number; y: number; r: number; twinkle: number }> = [];

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (let i = 0; i < 48; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.72,
        r: 0.9 + Math.random() * 1.8,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    this.resize();
    this.resetWorldState('TITLE');
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();

      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    this.viewW = rect && rect.width > 0 ? rect.width : window.innerWidth;
    this.viewH = rect && rect.height > 0 ? rect.height : window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.viewW * this.dpr);
    this.canvas.height = Math.floor(this.viewH * this.dpr);
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;

    const prevInit = this.initialWidth;
    this.initialWidth = clamp(this.viewW * 0.39, 128, 162);
    this.standWidth = Math.round(this.initialWidth * 1.52);

    if (this.layers.length === 0 && !this.fallingCake) {
      this.currentWidth = this.initialWidth;
    } else if (prevInit > 0) {
      this.currentWidth = Math.min(this.currentWidth, this.initialWidth);
    }
  }

  public setStatus(nextStatus: GameStatus): void {
    this.status = nextStatus;
  }

  public startNewGame(): void {
    this.resetWorldState('PLAYING');
    this.emitHud('none');
  }

  public handleWindowBlur(): void {
    if (this.status === 'PLAYING' && !this.pendingGameOver) {
      this.status = 'PAUSED';
      this.callbacks.onAutoPause();
    }
  }

  private resetWorldState(status: GameStatus): void {
    this.status = status;
    this.layers = [];
    this.fallingCake = null;
    this.debris = [];
    this.particles = [];
    this.callouts = [];
    this.sliceFlashes = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.initialWidth = clamp(this.viewW * 0.39, 128, 162);
    this.standWidth = Math.round(this.initialWidth * 1.52);
    this.currentWidth = this.initialWidth;
    this.nextFlavorIndex = 0;

    this.pendulumPhase = -Math.PI / 4;
    this.pendulumAngle = 0;
    this.clampOpen = 0;
    this.cakeSpawnScale = 1;
    this.hasActiveCakeOnHook = true;

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.missDelayTimer = 0;
    this.pendingGameOver = false;
  }

  public triggerDrop(): boolean {
    if (this.status !== 'PLAYING' || this.pendingGameOver) return false;
    if (this.fallingCake !== null || !this.hasActiveCakeOnHook) return false;

    const { bobX, bobY } = this.getPendulumBobScreenPos();
    const screenBaseY = this.getScreenBaseY();

    const worldX = bobX - this.viewW / 2;
    const worldBottomY = bobY + CAKE_HEIGHT / 2 - screenBaseY + this.cameraY;

    this.fallingCake = {
      x: worldX,
      bottomY: worldBottomY,
      width: this.currentWidth,
      height: CAKE_HEIGHT,
      vy: INITIAL_DROP_VY,
      flavor: pickFlavorForLayer(this.nextFlavorIndex),
    };

    this.hasActiveCakeOnHook = false;
    this.clampOpen = 1;
    soundEngine.playSnip();
    return true;
  }

  private getScreenBaseY(): number {
    return this.viewH * 0.8;
  }

  private getPendulumGeometry() {
    const pivotX = this.viewW / 2;
    const pivotY = clamp(this.viewH * 0.06, 40, 58);
    const armLength = clamp(Math.min(this.viewW * 0.44, this.viewH * 0.25), 148, 215);
    return { pivotX, pivotY, armLength };
  }

  private getPendulumBobScreenPos(): { bobX: number; bobY: number } {
    const { pivotX, pivotY, armLength } = this.getPendulumGeometry();
    const clampX = pivotX + armLength * Math.sin(this.pendulumAngle);
    const clampY = pivotY + armLength * Math.cos(this.pendulumAngle);
    return {
      bobX: clampX,
      bobY: clampY + CAKE_HEIGHT / 2 + 8,
    };
  }

  private update(dt: number): void {
    if (this.status === 'PAUSED') {
      return;
    }

    this.elapsedTime += dt;

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateShakeAndSquash(dt);
      return;
    }

    // Pendulum swing
    if (this.status === 'TITLE') {
      this.pendulumPhase += dt * 1.45;
      this.pendulumAngle = 0.52 * Math.sin(this.pendulumPhase);
    } else if (this.status === 'PLAYING' && !this.pendingGameOver) {
      const omega = 2.15;
      const maxAmp = 0.78;
      this.pendulumPhase += dt * omega;
      this.pendulumAngle = maxAmp * Math.sin(this.pendulumPhase);
    }

    // Clamp & spawn scale animations
    this.clampOpen = lerp(this.clampOpen, 0, 1 - Math.exp(-12 * dt));
    if (this.hasActiveCakeOnHook && this.cakeSpawnScale < 1) {
      this.cakeSpawnScale = Math.min(1, this.cakeSpawnScale + dt * 5.8);
    }

    // Falling cake physics
    if (this.status === 'PLAYING' && this.fallingCake) {
      this.fallingCake.vy += GRAVITY * dt;
      this.fallingCake.bottomY += this.fallingCake.vy * dt;

      const targetLandingY = -this.layers.length * CAKE_HEIGHT;
      if (this.fallingCake.bottomY >= targetLandingY) {
        this.resolveCakeLanding(this.fallingCake, targetLandingY);
      }
    }

    // Pending Game Over countdown
    if (this.pendingGameOver) {
      this.missDelayTimer -= dt;
      if (this.missDelayTimer <= 0) {
        this.pendingGameOver = false;
        this.status = 'GAME_OVER';
        this.callbacks.onGameOver(this.buildHudSnapshot('none'));
      }
    }

    // Debris physics
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vy += GRAVITY * 0.78 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.angle += d.angularVel * dt;
      if (d.y - this.cameraY > this.viewH * 0.6) {
        d.alpha -= dt * 2.2;
      }
      if (d.alpha <= 0) {
        this.debris.splice(i, 1);
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += (p.kind === 'sparkle' ? 220 : 1200) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
    }

    // Floating callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.callouts.splice(i, 1);
        continue;
      }
      c.y += c.vy * dt;
      c.vy *= Math.exp(-3.5 * dt);
    }

    // Slice flashes
    for (let i = this.sliceFlashes.length - 1; i >= 0; i--) {
      const s = this.sliceFlashes[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.sliceFlashes.splice(i, 1);
      }
    }

    // Camera smooth follow
    const screenBaseY = this.getScreenBaseY();
    const maxTopScreenY = this.viewH * 0.56;
    const towerTopWorldY = -this.layers.length * CAKE_HEIGHT;
    this.targetCameraY = Math.min(0, towerTopWorldY + (screenBaseY - maxTopScreenY));
    this.cameraY = lerp(this.cameraY, this.targetCameraY, 1 - Math.exp(-6.5 * dt));

    this.updateShakeAndSquash(dt);
  }

  private updateShakeAndSquash(dt: number): void {
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 26);

    for (let i = 0; i < this.layers.length; i++) {
      const block = this.layers[i];
      if (Math.abs(block.squash) > 0.001 || Math.abs(block.squashVel) > 0.001) {
        // Spring damper
        const force = -190 * block.squash - 16 * block.squashVel;
        block.squashVel += force * dt;
        block.squash += block.squashVel * dt;
      } else {
        block.squash = 0;
        block.squashVel = 0;
      }
    }
  }

  private resolveCakeLanding(cake: FallingCake, landingY: number): void {
    this.fallingCake = null;

    const isFirstLayer = this.layers.length === 0;
    const targetX = isFirstLayer ? 0 : this.layers[this.layers.length - 1].x;
    const targetWidth = isFirstLayer
      ? this.standWidth
      : this.layers[this.layers.length - 1].width;

    const leftA = cake.x - cake.width / 2;
    const rightA = cake.x + cake.width / 2;
    const leftB = targetX - targetWidth / 2;
    const rightB = targetX + targetWidth / 2;

    const overlapLeft = Math.max(leftA, leftB);
    const overlapRight = Math.min(rightA, rightB);
    const overlapWidth = overlapRight - overlapLeft;

    // Complete miss -> Game Over
    if (overlapWidth <= 2) {
      const side = cake.x >= targetX ? 1 : -1;
      this.debris.push({
        x: cake.x,
        y: landingY,
        width: cake.width,
        height: cake.height,
        vx: side * 75,
        vy: -110,
        angle: 0,
        angularVel: side * 4.2,
        flavor: cake.flavor,
        alpha: 1,
      });
      this.shakeIntensity = this.reducedMotion ? 0 : 9;
      this.pendingGameOver = true;
      this.missDelayTimer = 0.62;
      soundEngine.playMiss();
      return;
    }

    const deltaX = Math.abs(cake.x - targetX);
    const isPerfect = !isFirstLayer && deltaX <= PERFECT_TOLERANCE;

    let finalX = (overlapLeft + overlapRight) / 2;
    let finalWidth = overlapWidth;
    let eventKind: HudSnapshot['lastEvent'] = 'none';

    if (isPerfect) {
      finalX = targetX;
      finalWidth = Math.min(cake.width, targetWidth);
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      let expanded = false;
      if (
        this.combo >= EXPAND_STREAK &&
        this.combo % EXPAND_STREAK === 0 &&
        finalWidth < this.initialWidth
      ) {
        finalWidth = Math.min(this.initialWidth, finalWidth + EXPAND_STEP);
        expanded = true;
      }

      const comboBonus = this.combo * 25;
      const layerPoints = 50 + comboBonus;
      this.score += layerPoints;
      this.currentWidth = finalWidth;
      eventKind = expanded ? 'expanded' : 'perfect';

      // Juice
      this.hitstopTimer = this.reducedMotion ? 0 : 0.042;
      this.shakeIntensity = this.reducedMotion ? 0 : 3.5;
      this.spawnPerfectBurst(finalX, landingY - CAKE_HEIGHT / 2, finalWidth, expanded);

      this.callouts.push({
        x: finalX,
        y: landingY - CAKE_HEIGHT - 16,
        vy: -78,
        text: expanded ? `完美 ×${this.combo} 寬度恢復!` : `完美對齊 ×${this.combo}`,
        subtext: `+${layerPoints}`,
        color: expanded ? '#D97706' : '#E11D48',
        life: 0.95,
        maxLife: 0.95,
        scale: 1.1,
      });

      if (expanded) {
        soundEngine.playExpandBonus();
      } else {
        soundEngine.playPerfect(this.combo);
      }
    } else {
      // Partial slice or first layer landing on stand
      const wasTrimmed = overlapWidth < cake.width - 0.5;
      this.combo = 0;

      if (wasTrimmed) {
        eventKind = 'sliced';
        // Spawn left or right sliced overhang
        if (leftA < leftB) {
          const cutW = leftB - leftA;
          this.debris.push({
            x: leftA + cutW / 2,
            y: landingY,
            width: cutW,
            height: cake.height,
            vx: -85 - Math.random() * 45,
            vy: -95,
            angle: 0,
            angularVel: -3.5 - Math.random() * 2,
            flavor: cake.flavor,
            alpha: 1,
          });
          this.spawnSliceCrumbs(leftB, landingY - CAKE_HEIGHT / 2, cake.flavor);
          this.sliceFlashes.push({
            x: leftB,
            yTop: landingY - CAKE_HEIGHT - 14,
            yBottom: landingY + 10,
            life: 0.2,
            maxLife: 0.2,
          });
        }
        if (rightA > rightB) {
          const cutW = rightA - rightB;
          this.debris.push({
            x: rightB + cutW / 2,
            y: landingY,
            width: cutW,
            height: cake.height,
            vx: 85 + Math.random() * 45,
            vy: -95,
            angle: 0,
            angularVel: 3.5 + Math.random() * 2,
            flavor: cake.flavor,
            alpha: 1,
          });
          this.spawnSliceCrumbs(rightB, landingY - CAKE_HEIGHT / 2, cake.flavor);
          this.sliceFlashes.push({
            x: rightB,
            yTop: landingY - CAKE_HEIGHT - 14,
            yBottom: landingY + 10,
            life: 0.2,
            maxLife: 0.2,
          });
        }
        soundEngine.playSlice();
        this.shakeIntensity = this.reducedMotion ? 0 : 2.8;
      } else {
        this.shakeIntensity = this.reducedMotion ? 0 : 2.0;
      }

      this.currentWidth = finalWidth;
      const basePoints = 25;
      this.score += basePoints;
      soundEngine.playLand(finalWidth / this.initialWidth);

      this.spawnLandingCrumbs(finalX, landingY, finalWidth, cake.flavor);
      this.callouts.push({
        x: finalX,
        y: landingY - CAKE_HEIGHT - 12,
        vy: -56,
        text: `+${basePoints}`,
        color: this.isDarkSky() ? '#FFF8F0' : '#4A2C1D',
        life: 0.65,
        maxLife: 0.65,
        scale: 1,
      });
    }

    // Add settled layer & propagate gentle compression wave down top 3 layers
    const newBlock: CakeBlock = {
      id: this.layers.length + 1,
      x: finalX,
      bottomY: landingY,
      width: finalWidth,
      height: CAKE_HEIGHT,
      flavor: cake.flavor,
      squash: 0.2,
      squashVel: 0,
      isPerfect,
    };
    this.layers.push(newBlock);

    for (let offset = 1; offset <= 2; offset++) {
      const idx = this.layers.length - 1 - offset;
      if (idx >= 0) {
        this.layers[idx].squash = Math.max(this.layers[idx].squash, 0.1 / offset);
      }
    }

    this.nextFlavorIndex += 1;
    this.hasActiveCakeOnHook = true;
    this.cakeSpawnScale = 0.25;
    this.emitHud(eventKind);
  }

  private spawnLandingCrumbs(
    x: number,
    y: number,
    width: number,
    flavor: CakeFlavor
  ): void {
    const count = this.reducedMotion ? 4 : 10;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.particles.push({
        x: x + side * (width * 0.42 + (Math.random() - 0.5) * 10),
        y: y - 4,
        vx: side * (35 + Math.random() * 80),
        vy: -50 - Math.random() * 110,
        size: 3 + Math.random() * 3.5,
        color: i % 3 === 0 ? flavor.frosting : flavor.spongeTop,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        kind: 'crumb',
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 8,
      });
    }
  }

  private spawnSliceCrumbs(cutX: number, cutY: number, flavor: CakeFlavor): void {
    const count = this.reducedMotion ? 6 : 16;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: cutX + (Math.random() - 0.5) * 8,
        y: cutY + (Math.random() - 0.5) * 24,
        vx: (Math.random() - 0.5) * 160,
        vy: -130 - Math.random() * 140,
        size: 2.8 + Math.random() * 4.2,
        color: i % 2 === 0 ? flavor.frosting : flavor.filling,
        life: 0.5 + Math.random() * 0.35,
        maxLife: 0.85,
        kind: 'cream',
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 10,
      });
    }
  }

  private spawnPerfectBurst(
    x: number,
    y: number,
    width: number,
    expanded: boolean
  ): void {
    const count = this.reducedMotion ? 8 : expanded ? 28 : 20;
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * (width + 24);
      this.particles.push({
        x: x + rx,
        y: y + (Math.random() - 0.5) * 14,
        vx: (rx / Math.max(20, width)) * 120 + (Math.random() - 0.5) * 50,
        vy: -110 - Math.random() * 170,
        size: 3.5 + Math.random() * 4.5,
        color: expanded
          ? i % 2 === 0
            ? '#F59E0B'
            : '#FDE68A'
          : i % 2 === 0
            ? '#FB7185'
            : '#FBBF24',
        life: 0.65 + Math.random() * 0.35,
        maxLife: 1,
        kind: 'sparkle',
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 6,
      });
    }
  }

  private isDarkSky(): boolean {
    return this.layers.length >= 22;
  }

  private buildHudSnapshot(lastEvent: HudSnapshot['lastEvent']): HudSnapshot {
    return {
      layers: this.layers.length,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      isDarkSky: this.isDarkSky(),
      lastEvent,
    };
  }

  private emitHud(lastEvent: HudSnapshot['lastEvent']): void {
    this.callbacks.onHudUpdate(this.buildHudSnapshot(lastEvent));
  }

  // =========================================================================
  // RENDERING
  // =========================================================================

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // Camera shake offset
    const shakeX =
      this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 1.6 : 0;
    const shakeY =
      this.shakeIntensity > 0 ? (Math.random() - 0.5) * this.shakeIntensity * 1.4 : 0;

    this.drawSkyAndBackdrop(ctx);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    const centerX = this.viewW / 2;
    const screenBaseY = this.getScreenBaseY();

    // Draw patisserie counter & porcelain stand in world space
    this.drawCounterAndStand(ctx, centerX, screenBaseY - this.cameraY);

    // Vertical alignment guide lines from swinging cake edges down to target surface
    if (
      (this.status === 'PLAYING' || this.status === 'PAUSED') &&
      this.hasActiveCakeOnHook &&
      !this.pendingGameOver
    ) {
      const { bobX, bobY } = this.getPendulumBobScreenPos();
      const targetScreenY = screenBaseY - this.layers.length * CAKE_HEIGHT - this.cameraY;
      const startY = bobY + CAKE_HEIGHT / 2 + 6;
      if (targetScreenY > startY) {
        const halfW = (this.currentWidth * this.cakeSpawnScale) / 2;
        const centerColor = this.isDarkSky()
          ? 'rgba(255, 248, 240, 0.68)'
          : 'rgba(62, 34, 22, 0.58)';
        const edgeColor = this.isDarkSky()
          ? 'rgba(254, 243, 199, 0.20)'
          : 'rgba(110, 63, 30, 0.16)';

        ctx.save();
        // Light left & right edge guide lines
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 7]);
        ctx.strokeStyle = edgeColor;
        ctx.beginPath();
        ctx.moveTo(bobX - halfW, startY);
        ctx.lineTo(bobX - halfW, targetScreenY);
        ctx.moveTo(bobX + halfW, startY);
        ctx.lineTo(bobX + halfW, targetScreenY);
        ctx.stroke();

        // Subtle landing marker ticks at edges
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = edgeColor;
        ctx.beginPath();
        ctx.moveTo(bobX - halfW - 4, targetScreenY);
        ctx.lineTo(bobX - halfW + 4, targetScreenY);
        ctx.moveTo(bobX + halfW - 4, targetScreenY);
        ctx.lineTo(bobX + halfW + 4, targetScreenY);
        ctx.stroke();

        // Dark center alignment guide line
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = centerColor;
        ctx.beginPath();
        ctx.moveTo(bobX, startY);
        ctx.lineTo(bobX, targetScreenY);
        ctx.stroke();

        // Center landing tick
        ctx.setLineDash([]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bobX - 5, targetScreenY);
        ctx.lineTo(bobX + 5, targetScreenY);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Draw stacked cake layers (culled cleanly to visible viewport)
    for (let i = 0; i < this.layers.length; i++) {
      const block = this.layers[i];
      const screenBottomY = screenBaseY + block.bottomY - this.cameraY;
      if (screenBottomY < -80 || screenBottomY - block.height > this.viewH + 80) {
        continue;
      }
      this.drawCakeBlock(
        ctx,
        centerX + block.x,
        screenBottomY,
        block.width,
        block.height,
        block.flavor,
        block.squash,
        i === this.layers.length - 1
      );
    }

    // Draw falling cake
    if (this.fallingCake) {
      const f = this.fallingCake;
      const screenBottomY = screenBaseY + f.bottomY - this.cameraY;
      this.drawCakeBlock(
        ctx,
        centerX + f.x,
        screenBottomY,
        f.width,
        f.height,
        f.flavor,
        0,
        true
      );
    }

    // Draw tumbling sliced debris
    for (let i = 0; i < this.debris.length; i++) {
      const d = this.debris[i];
      const screenBottomY = screenBaseY + d.y - this.cameraY;
      ctx.save();
      ctx.globalAlpha = clamp(d.alpha, 0, 1);
      ctx.translate(centerX + d.x, screenBottomY - d.height / 2);
      ctx.rotate(d.angle);
      this.drawCakeBlock(ctx, 0, d.height / 2, d.width, d.height, d.flavor, 0, false);
      ctx.restore();
    }

    // Draw slice slash flashes
    for (let i = 0; i < this.sliceFlashes.length; i++) {
      const s = this.sliceFlashes[i];
      const alpha = s.life / s.maxLife;
      const sx = centerX + s.x;
      const y1 = screenBaseY + s.yTop - this.cameraY;
      const y2 = screenBaseY + s.yBottom - this.cameraY;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 251, 235, ${alpha * 0.95})`;
      ctx.lineWidth = 3 * alpha;
      ctx.beginPath();
      ctx.moveTo(sx, y1);
      ctx.lineTo(sx, y2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      const px = centerX + p.x;
      const py = screenBaseY + p.y - this.cameraY;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(px, py);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      if (p.kind === 'sparkle') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.35, -p.size * 0.35);
        ctx.lineTo(p.size, 0);
        ctx.lineTo(p.size * 0.35, p.size * 0.35);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.35, p.size * 0.35);
        ctx.lineTo(-p.size, 0);
        ctx.lineTo(-p.size * 0.35, -p.size * 0.35);
        ctx.closePath();
        ctx.fill();
      } else if (p.kind === 'cream') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
      }
      ctx.restore();
    }

    // Draw floating callouts
    for (let i = 0; i < this.callouts.length; i++) {
      const c = this.callouts[i];
      const alpha = clamp(c.life / (c.maxLife * 0.65), 0, 1);
      const cx = centerX + c.x;
      const cy = screenBaseY + c.y - this.cameraY;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(16 * c.scale)}px "Noto Sans TC", sans-serif`;
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, cx, cy);
      if (c.subtext) {
        ctx.font = `700 13px "JetBrains Mono", monospace`;
        ctx.fillText(c.subtext, cx, cy + 18);
      }
      ctx.restore();
    }

    // Draw Top Pendulum Clock & Swinging Cake
    if (this.status === 'PLAYING' || this.status === 'PAUSED') {
      this.drawPendulumClock(ctx);
    }

    ctx.restore();
    ctx.restore();
  }

  private drawSkyAndBackdrop(ctx: CanvasRenderingContext2D): void {
    const altitude = Math.max(0, -this.cameraY);
    // Normalize altitude into 0..3 stages (0=Patisserie, 1=Day Sky, 2=Dusk, 3=Starry Night)
    const stage = clamp(altitude / 900, 0, 3);

    let topColor = '#FFF3E4';
    let bottomColor = '#FFF9F2';

    if (stage < 1) {
      topColor = lerpColor('#FFF3E4', '#BAE6FD', stage);
      bottomColor = lerpColor('#FFF9F2', '#FEF3C7', stage);
    } else if (stage < 2) {
      const t = stage - 1;
      topColor = lerpColor('#BAE6FD', '#FB923C', t);
      bottomColor = lerpColor('#FEF3C7', '#FDE68A', t);
    } else {
      const t = stage - 2;
      topColor = lerpColor('#FB923C', '#1E1B4B', t);
      bottomColor = lerpColor('#FDE68A', '#4C1D95', t);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Night stars appear smoothly in stage 2..3
    if (stage > 1.75) {
      const starAlpha = clamp((stage - 1.75) / 1.0, 0, 1);
      ctx.save();
      for (let i = 0; i < this.stars.length; i++) {
        const st = this.stars[i];
        const pulse = 0.55 + 0.45 * Math.sin(this.elapsedTime * 2.2 + st.twinkle);
        ctx.fillStyle = `rgba(254, 243, 199, ${starAlpha * pulse})`;
        ctx.beginPath();
        ctx.arc(st.x * this.viewW, st.y * this.viewH, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Soft parallax clouds in mid/high altitude
    if (stage > 0.3 && stage < 2.6) {
      const cloudAlpha =
        stage < 1 ? clamp((stage - 0.3) * 1.4, 0, 0.7) : clamp((2.6 - stage) * 0.9, 0, 0.7);
      ctx.save();
      ctx.fillStyle = `rgba(255, 255, 255, ${cloudAlpha * 0.55})`;
      for (let c = 0; c < 4; c++) {
        const cx =
          ((c * 0.31 * this.viewW + this.elapsedTime * (8 + c * 3)) %
            (this.viewW + 180)) -
          90;
        const cy =
          ((this.viewH * (0.22 + c * 0.16) - this.cameraY * (0.18 + c * 0.03)) %
            (this.viewH + 120));
        this.drawCloud(ctx, cx, cy, 42 + c * 8);
      }
      ctx.restore();
    }

    // Subtle interior patisserie wallpaper & arched window framing near ground (altitude < 520)
    const parlorFade = clamp(1 - altitude / 520, 0, 1);
    if (parlorFade > 0.02) {
      ctx.save();
      ctx.globalAlpha = parlorFade;

      const wallY = this.getScreenBaseY() - this.cameraY;

      // Subtle vertical cream wainscoting stripes
      ctx.fillStyle = 'rgba(229, 207, 184, 0.25)';
      const stripeSpacing = 54;
      for (let x = 0; x < this.viewW; x += stripeSpacing) {
        ctx.fillRect(x, 0, 2, Math.max(0, wallY));
      }

      // Soft arched Parisian window light beams on far left/right on wider screens
      if (this.viewW >= 540) {
        ctx.fillStyle = 'rgba(255, 252, 244, 0.45)';
        ctx.beginPath();
        ctx.roundRect(36, 90 - this.cameraY * 0.45, 96, 220, [48, 48, 8, 8]);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(this.viewW - 132, 90 - this.cameraY * 0.45, 96, 220, [48, 48, 8, 8]);
        ctx.fill();
      }

      // Sage wainscoting paneling behind the oak counter
      ctx.fillStyle = '#CFE0D7';
      ctx.fillRect(0, wallY - 58, this.viewW, 90);
      ctx.fillStyle = '#B8CEBF';
      ctx.fillRect(0, wallY - 58, this.viewW, 5);

      ctx.restore();
    }
  }

  private drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ): void {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.arc(x + size * 0.48, y - size * 0.14, size * 0.44, 0, Math.PI * 2);
    ctx.arc(x + size * 0.92, y + size * 0.04, size * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCounterAndStand(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    groundScreenY: number
  ): void {
    if (groundScreenY > this.viewH + 140) return;

    ctx.save();

    // Warm oak patisserie counter surface below porcelain stand
    const counterTopY = groundScreenY + 38;
    const counterGrad = ctx.createLinearGradient(0, counterTopY, 0, counterTopY + 180);
    counterGrad.addColorStop(0, '#B87A4B');
    counterGrad.addColorStop(0.14, '#9B5F34');
    counterGrad.addColorStop(1, '#6E3F1E');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterTopY, this.viewW, Math.max(220, this.viewH - counterTopY + 80));

    // Counter top bevel highlight
    ctx.fillStyle = '#D99B66';
    ctx.fillRect(0, counterTopY, this.viewW, 6);

    // Porcelain cake stand stem & base
    ctx.fillStyle = '#E7E0D8';
    ctx.beginPath();
    ctx.moveTo(centerX - 18, groundScreenY + 8);
    ctx.lineTo(centerX + 18, groundScreenY + 8);
    ctx.lineTo(centerX + 34, counterTopY + 4);
    ctx.lineTo(centerX - 34, counterTopY + 4);
    ctx.closePath();
    ctx.fill();

    // Foot base
    ctx.fillStyle = '#F7F3EE';
    ctx.beginPath();
    ctx.roundRect(centerX - 58, counterTopY - 4, 116, 12, 6);
    ctx.fill();

    // Main porcelain plate at y = groundScreenY
    const plateW = this.standWidth + 16;
    ctx.fillStyle = 'rgba(45, 27, 20, 0.12)';
    ctx.beginPath();
    ctx.ellipse(centerX, counterTopY + 6, 62, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#E5DDD5';
    ctx.beginPath();
    ctx.roundRect(centerX - plateW / 2, groundScreenY + 2, plateW, 11, 6);
    ctx.fill();

    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.roundRect(centerX - plateW / 2 - 4, groundScreenY - 3, plateW + 8, 9, 5);
    ctx.fill();

    // Subtle brass lace rim accent on plate
    ctx.fillStyle = '#F3E7D3';
    ctx.fillRect(centerX - this.standWidth / 2, groundScreenY - 1, this.standWidth, 2);

    ctx.restore();
  }

  private drawCakeBlock(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    bottomY: number,
    width: number,
    height: number,
    flavor: CakeFlavor,
    squash: number,
    isTopLayer: boolean
  ): void {
    const scaleY = 1 - squash * 0.45;
    const scaleX = 1 + squash * 0.25;
    const drawW = Math.max(8, width * scaleX);
    const drawH = Math.max(12, height * scaleY);
    const left = centerX - drawW / 2;
    const top = bottomY - drawH;

    ctx.save();

    // Subtle contact shadow below cake
    ctx.fillStyle = 'rgba(45, 27, 20, 0.11)';
    ctx.fillRect(left + 3, bottomY - 2, Math.max(4, drawW - 6), 3);

    // Sponge body gradient
    const spongeGrad = ctx.createLinearGradient(0, top + 8, 0, bottomY);
    spongeGrad.addColorStop(0, flavor.spongeTop);
    spongeGrad.addColorStop(1, flavor.spongeBottom);
    ctx.fillStyle = spongeGrad;
    ctx.beginPath();
    ctx.roundRect(left, top + 3, drawW, drawH - 3, [6, 6, 4, 4]);
    ctx.fill();

    // Center jam / cream filling layer
    const midY = top + drawH * 0.56;
    ctx.fillStyle = flavor.filling;
    ctx.fillRect(left + 1, midY - 2.5, Math.max(2, drawW - 2), 5);

    // Frosting cap with scalloped drips
    const capH = 12 * scaleY;
    ctx.fillStyle = flavor.frosting;
    ctx.beginPath();
    ctx.roundRect(left - 1, top, drawW + 2, capH, [7, 7, 3, 3]);
    ctx.fill();

    // Scalloped drip loops along the front
    const dripSpacing = 18;
    const dripCount = Math.max(1, Math.floor(drawW / dripSpacing));
    const step = drawW / dripCount;
    ctx.fillStyle = flavor.dripColor;
    ctx.beginPath();
    for (let i = 0; i < dripCount; i++) {
      const dx = left + i * step;
      const dripDepth = i % 2 === 0 ? 7 : 4.5;
      ctx.moveTo(dx + 1, top + capH - 2);
      ctx.quadraticCurveTo(
        dx + step * 0.5,
        top + capH + dripDepth * 2,
        dx + step - 1,
        top + capH - 2
      );
    }
    ctx.fill();

    // Top specular highlight
    ctx.fillStyle = flavor.frostingHighlight;
    ctx.beginPath();
    ctx.roundRect(left + 6, top + 2.5, Math.max(4, drawW - 12), 3, 2);
    ctx.fill();

    // Toppings (strawberries / blueberries / matcha pearls / choco curls) on top-most or wide cakes
    if (drawW >= 24 && (isTopLayer || drawW >= 46)) {
      this.drawCakeToppings(ctx, centerX, top, drawW, flavor);
    }

    // Crisp subtle outline for 2D illustrated craft
    ctx.strokeStyle = 'rgba(62, 34, 22, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(left, top, drawW, drawH, [7, 7, 4, 4]);
    ctx.stroke();

    ctx.restore();
  }

  private drawCakeToppings(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    topY: number,
    width: number,
    flavor: CakeFlavor
  ): void {
    const count = width >= 110 ? 3 : width >= 62 ? 2 : 1;
    const span = count === 1 ? 0 : width * 0.44;
    for (let i = 0; i < count; i++) {
      const tx =
        count === 1 ? centerX : centerX - span / 2 + (span * i) / (count - 1);

      if (flavor.toppingStyle === 'strawberry') {
        ctx.fillStyle = flavor.toppingPrimary;
        ctx.beginPath();
        ctx.ellipse(tx, topY - 2, 5.5, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flavor.toppingSecondary;
        ctx.beginPath();
        ctx.ellipse(tx, topY - 7.5, 5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (flavor.toppingStyle === 'blueberry' || flavor.toppingStyle === 'matcha') {
        ctx.fillStyle = flavor.toppingPrimary;
        ctx.beginPath();
        ctx.arc(tx, topY - 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = flavor.toppingSecondary;
        ctx.beginPath();
        ctx.arc(tx + 3.5, topY - 1, 3.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Choco / Caramel / Lemon curl garnish
        ctx.fillStyle = flavor.toppingPrimary;
        ctx.beginPath();
        ctx.roundRect(tx - 5, topY - 6, 10, 6, 3);
        ctx.fill();
        ctx.fillStyle = flavor.toppingSecondary;
        ctx.beginPath();
        ctx.arc(tx, topY - 3, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawPendulumClock(ctx: CanvasRenderingContext2D): void {
    const { pivotX, pivotY } = this.getPendulumGeometry();
    const { bobX, bobY } = this.getPendulumBobScreenPos();

    ctx.save();

    // Brass pendulum rod connecting clock pivot to cake clamp
    const rodGrad = ctx.createLinearGradient(pivotX - 4, pivotY, bobX + 4, bobY);
    rodGrad.addColorStop(0, '#B45309');
    rodGrad.addColorStop(0.5, '#F59E0B');
    rodGrad.addColorStop(1, '#92400E');

    ctx.strokeStyle = rodGrad;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY - CAKE_HEIGHT / 2 - 8);
    ctx.stroke();

    // Ornate walnut & brass clock dial at top center
    ctx.fillStyle = 'rgba(45, 27, 20, 0.16)';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY + 2, 27, 0, Math.PI * 2);
    ctx.fill();

    // Outer walnut ring
    ctx.fillStyle = '#5C3317';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Brass bezel
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 22.5, 0, Math.PI * 2);
    ctx.stroke();

    // Cream clock face
    ctx.fillStyle = '#FFFDF7';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 20, 0, Math.PI * 2);
    ctx.fill();

    // 4 cardinal clock ticks
    ctx.fillStyle = '#4A2C1D';
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.fillRect(pivotX + Math.cos(a) * 14 - 1, pivotY + Math.sin(a) * 14 - 1, 2, 2);
    }

    // Animated clock hands
    const minAngle = this.elapsedTime * 0.6 - Math.PI / 2;
    const hrAngle = this.elapsedTime * 0.12 - Math.PI / 2;
    ctx.strokeStyle = '#2D1B14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX + Math.cos(hrAngle) * 9, pivotY + Math.sin(hrAngle) * 9);
    ctx.stroke();

    ctx.strokeStyle = '#E11D48';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX + Math.cos(minAngle) * 14, pivotY + Math.sin(minAngle) * 14);
    ctx.stroke();

    // Center brass pin
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Pastry clamp at end of pendulum rod
    const clampY = bobY - CAKE_HEIGHT / 2 - 8;
    const spread = 10 + this.clampOpen * 16;

    // Brass clamp hub
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(bobX, clampY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Left & right clamp prongs
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bobX - 4, clampY + 1);
    ctx.lineTo(bobX - spread, clampY + 12);
    ctx.moveTo(bobX + 4, clampY + 1);
    ctx.lineTo(bobX + spread, clampY + 12);
    ctx.stroke();

    // Swinging cake held level by the clamp
    if (this.hasActiveCakeOnHook && !this.pendingGameOver) {
      const flavor = pickFlavorForLayer(this.nextFlavorIndex);
      ctx.save();
      ctx.translate(bobX, bobY);
      ctx.scale(this.cakeSpawnScale, this.cakeSpawnScale);
      this.drawCakeBlock(
        ctx,
        0,
        CAKE_HEIGHT / 2,
        this.currentWidth,
        CAKE_HEIGHT,
        flavor,
        0,
        true
      );
      ctx.restore();
    }

    ctx.restore();
  }
}
