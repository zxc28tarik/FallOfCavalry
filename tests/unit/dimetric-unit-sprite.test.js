import { describe, expect, it } from 'vitest';
import {
  drawDimetricUnitSprite,
  estimateDimetricUnitBodyBounds,
  getDimetricUnitAnimState,
  getDimetricUnitDetailLevel,
  getDimetricUnitFrameIndex,
  resolveDimetricUnitDirection,
} from '../../js/rendering/dimetric/unit-sprite.js';

function makeCtxStub() {
  return {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'round',
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    ellipse() {},
    fill() {},
    stroke() {},
  };
}

describe('dimetric unit sprite', () => {
  it('resolves direction from velocity', () => {
    expect(resolveDimetricUnitDirection(1, 0, 'S')).toBe('E');
    expect(resolveDimetricUnitDirection(0, 1, 'S')).toBe('S');
    expect(resolveDimetricUnitDirection(-1, 0, 'S')).toBe('W');
    expect(resolveDimetricUnitDirection(0, -1, 'S')).toBe('N');
  });

  it('keeps fallback direction for near-zero speed', () => {
    expect(resolveDimetricUnitDirection(0, 0, 'NW')).toBe('NW');
    expect(resolveDimetricUnitDirection(1e-6, 1e-6, 'SE')).toBe('SE');
  });

  it('computes animation state from movement flags', () => {
    expect(getDimetricUnitAnimState({ walkSpeed: 0 })).toBe('idle');
    expect(getDimetricUnitAnimState({ walkSpeed: 120 })).toBe('walk');
    expect(getDimetricUnitAnimState({ walkSpeed: 120, isAttacking: true })).toBe('attack');
    expect(getDimetricUnitAnimState({ walkSpeed: 120, isDead: true })).toBe('dead');
  });

  it('returns deterministic frame index for each state', () => {
    const walkFrame = getDimetricUnitFrameIndex({ state: 'walk', timeMs: 1000, frameCount: 4 });
    const attackFrame = getDimetricUnitFrameIndex({ state: 'attack', timeMs: 1000, frameCount: 4 });
    const deadFrame = getDimetricUnitFrameIndex({ state: 'dead', timeMs: 1000, frameCount: 4 });
    expect(walkFrame).toBeGreaterThanOrEqual(0);
    expect(walkFrame).toBeLessThan(4);
    expect(attackFrame).toBeGreaterThanOrEqual(0);
    expect(attackFrame).toBeLessThan(4);
    expect(deadFrame).toBe(3);
  });

  it('selects detail level from zoom and quality', () => {
    expect(getDimetricUnitDetailLevel({ zoom: 0.9, qualityLevel: 0 })).toBe('full');
    expect(getDimetricUnitDetailLevel({ zoom: 0.58, qualityLevel: 1 })).toBe('reduced');
    expect(getDimetricUnitDetailLevel({ zoom: 0.40, qualityLevel: 1 })).toBe('minimal');
    expect(getDimetricUnitDetailLevel({ zoom: 1.1, qualityLevel: 4 })).toBe('minimal');
  });

  it('estimates body bounds anchored to actor screen point', () => {
    const bounds = estimateDimetricUnitBodyBounds({ x: 120, y: 80, tileH: 32, zoom: 1 });
    expect(bounds.w).toBeGreaterThan(0);
    expect(bounds.h).toBeGreaterThan(0);
    expect(bounds.x).toBeLessThan(120);
    expect(bounds.y).toBeLessThan(80);
  });

  it('draws sprite and returns bounds', () => {
    const ctx = makeCtxStub();
    const bounds = drawDimetricUnitSprite(ctx, {
      x: 200,
      y: 160,
      tileH: 36,
      zoom: 1.2,
      direction: 'NE',
      timeMs: 1450,
      walkSpeed: 120,
    });
    expect(bounds).toBeTruthy();
    expect(bounds.w).toBeGreaterThan(0);
    expect(bounds.h).toBeGreaterThan(0);
  });

  it('draws minimal detail sprite mode', () => {
    const ctx = makeCtxStub();
    const bounds = drawDimetricUnitSprite(ctx, {
      x: 150,
      y: 120,
      tileH: 28,
      zoom: 0.4,
      detail: 'minimal',
      direction: 'S',
    });
    expect(bounds).toBeTruthy();
    expect(bounds.w).toBeGreaterThan(0);
  });
});
