import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  TRANSITION_BITS,
  computeTransitionMask,
  getBiomeTransitionPriority,
  shouldBlendNeighbor,
} from '../../js/rendering/dimetric/terrain-transitions.js';

function gridResolver(grid) {
  return (x, y) => grid[y]?.[x];
}

describe('dimetric terrain transitions', () => {
  it('uses deterministic biome transition priority ordering', () => {
    expect(getBiomeTransitionPriority(CONST.BIOME.SEA))
      .toBeGreaterThan(getBiomeTransitionPriority(CONST.BIOME.SHORE));
    expect(getBiomeTransitionPriority(CONST.BIOME.SHORE))
      .toBeGreaterThan(getBiomeTransitionPriority(CONST.BIOME.PLAINS));
    expect(getBiomeTransitionPriority(CONST.BIOME.MOUNTAIN))
      .toBeGreaterThan(getBiomeTransitionPriority(CONST.BIOME.FOREST));
  });

  it('blends only from higher-priority neighbor biomes', () => {
    expect(shouldBlendNeighbor(CONST.BIOME.PLAINS, CONST.BIOME.SEA)).toBe(true);
    expect(shouldBlendNeighbor(CONST.BIOME.PLAINS, CONST.BIOME.FOREST)).toBe(true);
    expect(shouldBlendNeighbor(CONST.BIOME.MOUNTAIN, CONST.BIOME.PLAINS)).toBe(false);
    expect(shouldBlendNeighbor(CONST.BIOME.SEA, CONST.BIOME.SEA)).toBe(false);
  });

  it('computes cardinal and diagonal transition masks', () => {
    const P = CONST.BIOME.PLAINS;
    const S = CONST.BIOME.SEA;
    const SH = CONST.BIOME.SHORE;
    const M = CONST.BIOME.MOUNTAIN;
    const H = CONST.BIOME.HILLS;
    const grid = [
      [P, SH, M],
      [S, P, H],
      [P, P, P],
    ];
    const mask = computeTransitionMask({
      tx: 1,
      ty: 1,
      mapWidth: 3,
      mapHeight: 3,
      resolveBiomeAt: gridResolver(grid),
      centerBiome: P,
    });

    expect(mask & TRANSITION_BITS.N).toBe(TRANSITION_BITS.N);
    expect(mask & TRANSITION_BITS.W).toBe(TRANSITION_BITS.W);
    expect(mask & TRANSITION_BITS.E).toBe(TRANSITION_BITS.E);
    expect(mask & TRANSITION_BITS.NE).toBe(TRANSITION_BITS.NE);
    expect(mask & TRANSITION_BITS.S).toBe(0);
    expect(mask & TRANSITION_BITS.SW).toBe(0);
  });

  it('does not create isolated diagonal transitions without cardinal support', () => {
    const P = CONST.BIOME.PLAINS;
    const S = CONST.BIOME.SEA;
    const grid = [
      [P, P, S],
      [P, P, P],
      [P, P, P],
    ];
    const mask = computeTransitionMask({
      tx: 1,
      ty: 1,
      mapWidth: 3,
      mapHeight: 3,
      resolveBiomeAt: gridResolver(grid),
      centerBiome: P,
    });

    expect(mask & TRANSITION_BITS.NE).toBe(0);
    expect(mask & TRANSITION_BITS.N).toBe(0);
    expect(mask & TRANSITION_BITS.E).toBe(0);
  });

  it('does not set mask bits for lower-priority neighbors or out-of-bounds', () => {
    const M = CONST.BIOME.MOUNTAIN;
    const P = CONST.BIOME.PLAINS;
    const grid = [
      [M, P],
      [P, P],
    ];
    const mask = computeTransitionMask({
      tx: 0,
      ty: 0,
      mapWidth: 2,
      mapHeight: 2,
      resolveBiomeAt: gridResolver(grid),
      centerBiome: M,
    });
    expect(mask).toBe(0);
  });
});
