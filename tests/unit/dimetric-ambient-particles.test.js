import { describe, expect, it } from 'vitest';
import {
  getDimetricAmbientParticleBudget,
  getDimetricWeatherParticleBudget,
  sampleDimetricSmokePuff,
  sampleDimetricWeatherParticle,
} from '../../js/rendering/dimetric/ambient-particles.js';

describe('dimetric ambient particles', () => {
  it('reduces particle budget by lod and quality profile', () => {
    const full = getDimetricAmbientParticleBudget({ lodLevel: 'full', qualityLevel: 0, maxParticles: 120 });
    const reduced = getDimetricAmbientParticleBudget({ lodLevel: 'reduced', qualityLevel: 1, maxParticles: 120 });
    const minimal = getDimetricAmbientParticleBudget({ lodLevel: 'minimal', qualityLevel: 4, maxParticles: 120 });
    expect(full).toBe(120);
    expect(reduced).toBeLessThan(full);
    expect(minimal).toBeLessThan(reduced);
    expect(minimal).toBeGreaterThanOrEqual(0);
  });

  it('returns deterministic smoke puff output for same inputs', () => {
    const a = sampleDimetricSmokePuff({ timeMs: 12345, sourceId: 77, puffIndex: 2 });
    const b = sampleDimetricSmokePuff({ timeMs: 12345, sourceId: 77, puffIndex: 2 });
    expect(a).toEqual(b);
  });

  it('keeps smoke puff values in stable ranges', () => {
    const puff = sampleDimetricSmokePuff({ timeMs: 9012, sourceId: 15, puffIndex: 1 });
    expect(puff.rise).toBeGreaterThanOrEqual(0);
    expect(puff.rise).toBeLessThanOrEqual(1);
    expect(puff.sway).toBeGreaterThanOrEqual(-1);
    expect(puff.sway).toBeLessThanOrEqual(1);
    expect(puff.alpha).toBeGreaterThanOrEqual(0);
    expect(puff.alpha).toBeLessThanOrEqual(0.34);
    expect(puff.size).toBeGreaterThanOrEqual(0.24);
    expect(puff.size).toBeLessThanOrEqual(1.45);
  });

  it('animates over time for same source and puff index', () => {
    const p0 = sampleDimetricSmokePuff({ timeMs: 4000, sourceId: 9, puffIndex: 0 });
    const p1 = sampleDimetricSmokePuff({ timeMs: 6400, sourceId: 9, puffIndex: 0 });
    expect(p0).not.toEqual(p1);
  });

  it('computes weather particle budget from weather + quality', () => {
    const clear = getDimetricWeatherParticleBudget({ weatherType: 'CLEAR', lodLevel: 'full', qualityLevel: 0, maxParticles: 80 });
    const rain = getDimetricWeatherParticleBudget({ weatherType: 'RAIN', lodLevel: 'full', qualityLevel: 0, maxParticles: 80 });
    const rainLow = getDimetricWeatherParticleBudget({ weatherType: 'RAIN', lodLevel: 'minimal', qualityLevel: 4, maxParticles: 80 });
    expect(clear).toBe(0);
    expect(rain).toBeGreaterThan(0);
    expect(rainLow).toBeLessThan(rain);
  });

  it('returns deterministic weather particle samples and bounded values', () => {
    const snowA = sampleDimetricWeatherParticle({
      timeMs: 10000,
      weatherType: 'SNOW',
      tileX: 12,
      tileY: 8,
      index: 4,
    });
    const snowB = sampleDimetricWeatherParticle({
      timeMs: 10000,
      weatherType: 'SNOW',
      tileX: 12,
      tileY: 8,
      index: 4,
    });
    expect(snowA).toEqual(snowB);
    expect(snowA?.phase ?? -1).toBeGreaterThanOrEqual(0);
    expect(snowA?.phase ?? 2).toBeLessThan(1);
    expect(snowA?.alpha ?? 0).toBeGreaterThanOrEqual(0.10);
    expect(snowA?.alpha ?? 0).toBeLessThanOrEqual(0.34);

    const rain = sampleDimetricWeatherParticle({
      timeMs: 10500,
      weatherType: 'RAIN',
      tileX: 12,
      tileY: 8,
      index: 4,
    });
    expect(rain).toBeTruthy();
    expect(rain?.length ?? 0).toBeGreaterThanOrEqual(0.26);
    expect(rain?.length ?? 0).toBeLessThanOrEqual(0.80);
  });
});
