import { describe, expect, it } from 'vitest';
import {
  resolveDimetricNatureVariant,
  sampleDimetricGroundDecal,
} from '../../js/rendering/dimetric/nature-layer.js';

describe('dimetric nature layer', () => {
  it('returns deterministic forest variant values', () => {
    const a = resolveDimetricNatureVariant({ kind: 'forest', tx: 41, ty: 87, fogLevel: 2 });
    const b = resolveDimetricNatureVariant({ kind: 'forest', tx: 41, ty: 87, fogLevel: 2 });
    expect(a).toEqual(b);
    expect(a.family === 'conifer' || a.family === 'broadleaf').toBe(true);
    expect(a.scale).toBeGreaterThanOrEqual(0.78);
    expect(a.scale).toBeLessThanOrEqual(1.32);
  });

  it('keeps large mountain variants taller than regular mountain variants', () => {
    const small = resolveDimetricNatureVariant({ kind: 'mountain', tx: 12, ty: 18, fogLevel: 2 });
    const large = resolveDimetricNatureVariant({ kind: 'mountain_large', tx: 12, ty: 18, fogLevel: 2 });
    expect(large.scale).toBeGreaterThan(small.scale);
    expect(large.snow).toBeGreaterThanOrEqual(small.snow);
  });

  it('skips decals on sea and mountain biomes', () => {
    expect(sampleDimetricGroundDecal({
      tx: 10,
      ty: 14,
      biome: 0,
    })).toBeNull();
    expect(sampleDimetricGroundDecal({
      tx: 10,
      ty: 14,
      biome: 5,
    })).toBeNull();
  });

  it('returns deterministic decal payload when spawned', () => {
    let decal = null;
    for (let ty = 0; ty < 50 && !decal; ty += 1) {
      for (let tx = 0; tx < 50 && !decal; tx += 1) {
        decal = sampleDimetricGroundDecal({
          tx,
          ty,
          biome: 2,
          lodLevel: 'full',
          qualityLevel: 0,
          featureDensityScale: 1,
        });
      }
    }

    expect(decal).toBeTruthy();
    const same = sampleDimetricGroundDecal({
      tx: 7,
      ty: 5,
      biome: 2,
      lodLevel: 'full',
      qualityLevel: 0,
      featureDensityScale: 1,
    });
    const sameAgain = sampleDimetricGroundDecal({
      tx: 7,
      ty: 5,
      biome: 2,
      lodLevel: 'full',
      qualityLevel: 0,
      featureDensityScale: 1,
    });
    expect(same).toEqual(sameAgain);
    if (same) {
      expect(same.scale).toBeGreaterThanOrEqual(0.22);
      expect(same.scale).toBeLessThanOrEqual(0.78);
      expect(same.alpha).toBeGreaterThanOrEqual(0.22);
      expect(same.alpha).toBeLessThanOrEqual(0.78);
    }
  });

  it('reduces decal spawn density at minimal lod and lower quality', () => {
    let fullCount = 0;
    let minimalCount = 0;
    for (let ty = 0; ty < 40; ty += 1) {
      for (let tx = 0; tx < 40; tx += 1) {
        if (sampleDimetricGroundDecal({
          tx,
          ty,
          biome: 2,
          lodLevel: 'full',
          qualityLevel: 0,
          featureDensityScale: 1,
        })) {
          fullCount += 1;
        }
        if (sampleDimetricGroundDecal({
          tx,
          ty,
          biome: 2,
          lodLevel: 'minimal',
          qualityLevel: 4,
          featureDensityScale: 0.35,
        })) {
          minimalCount += 1;
        }
      }
    }

    expect(fullCount).toBeGreaterThan(0);
    expect(minimalCount).toBeLessThan(fullCount);
  });
});
