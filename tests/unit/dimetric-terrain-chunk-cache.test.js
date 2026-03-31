import { describe, expect, it } from 'vitest';
import { buildAnchorAlignedConfig } from '../../js/rendering/dimetric/projection.js';
import {
  computeCoastlineMask,
  computeDimetricVisibleTileBounds,
  DimetricTerrainChunkCache,
} from '../../js/rendering/dimetric/terrain-chunk-cache.js';
import * as CONST from '../../js/constants.js';

function makeFakeCanvasFactory() {
  return (width, height) => ({
    width,
    height,
    getContext: () => ({
      imageSmoothingEnabled: false,
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() {},
      stroke() {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    }),
  });
}

describe('dimetric terrain chunk cache', () => {
  it('computes clamped visible tile bounds from camera + config', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const canvas = { width: 800, height: 600 };
    const config = buildAnchorAlignedConfig({
      anchorTileX: 12,
      anchorTileY: 9,
      anchorWorldX: 400,
      anchorWorldY: 304,
      tileW: 64,
      tileH: 32,
      elevationPx: 24,
    });
    const bounds = computeDimetricVisibleTileBounds({
      camera,
      canvas,
      config,
      mapWidth: 64,
      mapHeight: 64,
      paddingTiles: 2,
    });
    expect(bounds).not.toBeNull();
    expect(bounds.minX).toBeGreaterThanOrEqual(0);
    expect(bounds.minY).toBeGreaterThanOrEqual(0);
    expect(bounds.maxX).toBeLessThanOrEqual(63);
    expect(bounds.maxY).toBeLessThanOrEqual(63);
    expect(bounds.minX).toBeLessThanOrEqual(12);
    expect(bounds.maxX).toBeGreaterThanOrEqual(12);
    expect(bounds.minY).toBeLessThanOrEqual(9);
    expect(bounds.maxY).toBeGreaterThanOrEqual(9);
  });

  it('reuses cached chunks and evicts oldest entries when limit exceeded', () => {
    const cache = new DimetricTerrainChunkCache({
      chunkSize: 4,
      maxChunks: 2,
      canvasFactory: makeFakeCanvasFactory(),
    });
    const map = { id: 'map-a' };
    cache.configure({
      map,
      tileW: 64,
      tileH: 32,
      chunkSize: 4,
      maxChunks: 2,
    });
    const resolveBiomeAt = () => 2;

    const a0 = cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    const a1 = cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    expect(a0).toBeTruthy();
    expect(a1).toBe(a0);

    const b = cache.getChunk({ chunkX: 1, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    const c = cache.getChunk({ chunkX: 2, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    expect(b).toBeTruthy();
    expect(c).toBeTruthy();
    expect(cache.getStats().chunkCount).toBe(2);

    const a2 = cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    expect(a2).toBeTruthy();
    expect(a2).not.toBe(a0);
  });

  it('computes coastline masks for shore/sea boundaries only', () => {
    const SEA = CONST.BIOME.SEA;
    const SHORE = CONST.BIOME.SHORE;
    const PLAINS = CONST.BIOME.PLAINS;
    const grid = [
      [SEA, SEA, PLAINS],
      [SHORE, SHORE, PLAINS],
      [PLAINS, PLAINS, PLAINS],
    ];
    const resolveBiomeAt = (x, y) => grid[y]?.[x];

    const shoreMask = computeCoastlineMask({
      tx: 1,
      ty: 1,
      mapWidth: 3,
      mapHeight: 3,
      resolveBiomeAt,
      centerBiome: SHORE,
    });
    expect(shoreMask & 1).toBe(1); // N
    expect(shoreMask & 8).toBe(0); // W (shore)
    expect(shoreMask & 2).toBe(0); // E
    expect(shoreMask & 4).toBe(0); // S

    const seaMask = computeCoastlineMask({
      tx: 1,
      ty: 0,
      mapWidth: 3,
      mapHeight: 3,
      resolveBiomeAt,
      centerBiome: SEA,
    });
    expect(seaMask & 4).toBe(4); // S
    expect(seaMask & 1).toBe(0); // N (oob)
    expect(seaMask & 2).toBe(0); // E (plains)

    const plainsMask = computeCoastlineMask({
      tx: 2,
      ty: 2,
      mapWidth: 3,
      mapHeight: 3,
      resolveBiomeAt,
      centerBiome: PLAINS,
    });
    expect(plainsMask).toBe(0);
  });
});
