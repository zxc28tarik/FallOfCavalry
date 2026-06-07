import { describe, expect, it, vi } from 'vitest';
import { buildAnchorAlignedConfig } from '../../js/rendering/dimetric/projection.js';
import {
  biomeBaseLayerRgb,
  computeCoastlineMask,
  computeDimetricVisibleTileBounds,
  DimetricBiomeBaseLayer,
  DimetricTerrainChunkCache,
  resolveBiomeBasePixelsPerTile,
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

function makeCapturingCanvasFactory(captures = []) {
  return (width, height) => {
    const canvas = { width, height };
    const ctx = {
      imageSmoothingEnabled: true,
      drawImage(...args) {
        captures.push({ type: 'drawImage', args });
      },
      createImageData: (imageWidth, imageHeight) => ({
        data: new Uint8ClampedArray(imageWidth * imageHeight * 4),
      }),
      putImageData(image, x, y) {
        canvas.imageData = image.data;
        captures.push({ type: 'putImageData', width: canvas.width, height: canvas.height, x, y });
      },
      save() {},
      restore() {},
      fillRect(x, y, w, h) {
        captures.push({ type: 'fillRect', x, y, w, h, fillStyle: ctx.fillStyle });
      },
      fillStyle: '',
    };
    canvas.getContext = () => ctx;
    return canvas;
  };
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

  it('reuses cached chunks and evicts oldest entries when byte budget is exceeded', () => {
    const cache = new DimetricTerrainChunkCache({
      chunkSize: 4,
      maxCacheBytes: 300000,
      canvasFactory: makeFakeCanvasFactory(),
    });
    const map = { id: 'map-a' };
    cache.configure({
      map,
      tileW: 64,
      tileH: 32,
      chunkSize: 4,
      maxCacheBytes: 300000,
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
    expect(cache.getStats().totalBytes).toBeLessThanOrEqual(300000);

    const a2 = cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    expect(a2).toBeTruthy();
    expect(a2).not.toBe(a0);
  });

  it('does not evict chunks marked visible while evicting non-visible LRU chunks', () => {
    const cache = new DimetricTerrainChunkCache({
      chunkSize: 4,
      maxCacheBytes: 300000,
      canvasFactory: makeFakeCanvasFactory(),
    });
    cache.configure({
      map: { id: 'map-visible' },
      tileW: 64,
      tileH: 32,
      chunkSize: 4,
      maxCacheBytes: 300000,
    });
    cache.beginFrame({ visibleKeys: new Set(['0,0']), frameBuildLimit: 4 });
    const resolveBiomeAt = () => 2;

    const visible = cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 24, mapHeight: 8, resolveBiomeAt });
    const oldNonVisible = cache.getChunk({ chunkX: 1, chunkY: 0, mapWidth: 24, mapHeight: 8, resolveBiomeAt });
    const newNonVisible = cache.getChunk({ chunkX: 2, chunkY: 0, mapWidth: 24, mapHeight: 8, resolveBiomeAt });

    expect(visible).toBeTruthy();
    expect(oldNonVisible).toBeTruthy();
    expect(newNonVisible).toBeTruthy();
    expect(cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 24, mapHeight: 8, resolveBiomeAt })).toBe(visible);
    expect(cache.getStats().totalBytes).toBeLessThanOrEqual(300000);
  });

  it('limits chunk builds per frame', () => {
    const cache = new DimetricTerrainChunkCache({
      chunkSize: 4,
      maxCacheBytes: 96 * 1024 * 1024,
      canvasFactory: makeFakeCanvasFactory(),
    });
    cache.configure({
      map: { id: 'map-budget' },
      tileW: 64,
      tileH: 32,
      chunkSize: 4,
    });
    cache.beginFrame({ frameBuildLimit: 1 });
    const resolveBiomeAt = () => 2;

    const first = cache.getChunk({ chunkX: 0, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });
    const second = cache.getChunk({ chunkX: 1, chunkY: 0, mapWidth: 16, mapHeight: 16, resolveBiomeAt });

    expect(first).toBeTruthy();
    expect(second).toBeNull();
    expect(cache.getStats().chunkBuildsThisFrame).toBe(1);
    expect(cache.getStats().chunkBuildSkipsThisFrame).toBe(1);
  });

  it('builds the biome base layer once and keeps it outside the chunk byte budget', () => {
    const captures = [];
    const baseLayer = new DimetricBiomeBaseLayer({
      canvasFactory: makeCapturingCanvasFactory(captures),
    });
    const map = {
      width: 2,
      height: 2,
      biomes: new Uint8Array([
        CONST.BIOME.PLAINS,
        CONST.BIOME.FOREST,
        CONST.BIOME.SHORE,
        CONST.BIOME.SEA,
      ]),
    };
    const cache = new DimetricTerrainChunkCache({
      chunkSize: 4,
      maxCacheBytes: 1024,
      canvasFactory: makeFakeCanvasFactory(),
    });
    cache.configure({ map, tileW: 64, tileH: 32, maxCacheBytes: 1024 });
    const bytesBefore = cache.getStats().totalBytes;

    baseLayer.configure({
      map,
      mapWidth: 2,
      mapHeight: 2,
      resolveBiomeAt: (x, y) => map.biomes[(y * 2) + x],
      groundStylePreset: 'classic',
    });
    const firstCanvas = baseLayer.canvas;
    baseLayer.configure({
      map,
      mapWidth: 2,
      mapHeight: 2,
      resolveBiomeAt: (x, y) => map.biomes[(y * 2) + x],
      groundStylePreset: 'classic',
    });

    expect(baseLayer.canvas).toBe(firstCanvas);
    expect(baseLayer.getStats()).toMatchObject({
      width: 4,
      height: 4,
      pixelsPerTile: 2,
      buildCount: 1,
    });
    expect(cache.getStats().totalBytes).toBe(bytesBefore);
  });

  it('uses the chunk terrain biome palette for base layer presets', () => {
    const classicCaptures = [];
    const classicMap = {
      width: 1,
      height: 1,
      biomes: new Uint8Array([CONST.BIOME.PLAINS]),
    };
    const classicLayer = new DimetricBiomeBaseLayer({
      canvasFactory: makeCapturingCanvasFactory(classicCaptures),
    });
    classicLayer.configure({
      map: classicMap,
      mapWidth: 1,
      mapHeight: 1,
      resolveBiomeAt: () => CONST.BIOME.PLAINS,
      groundStylePreset: 'classic',
    });
    expect(Array.from(classicLayer.canvas.imageData.slice(0, 4))).toEqual([
      ...biomeBaseLayerRgb(CONST.BIOME.PLAINS, 'classic', 0, 0),
      255,
    ]);

    const strongholdMap = {
      width: 1,
      height: 1,
      biomes: new Uint8Array([CONST.BIOME.FOREST]),
    };
    const strongholdLayer = new DimetricBiomeBaseLayer({
      canvasFactory: makeCapturingCanvasFactory([]),
    });
    strongholdLayer.configure({
      map: strongholdMap,
      mapWidth: 1,
      mapHeight: 1,
      resolveBiomeAt: () => CONST.BIOME.FOREST,
      groundStylePreset: 'stronghold',
    });
    expect(Array.from(strongholdLayer.canvas.imageData.slice(0, 4))).toEqual([
      ...biomeBaseLayerRgb(CONST.BIOME.FOREST, 'stronghold', 0, 0),
      255,
    ]);
    expect(strongholdLayer.getStats()).toMatchObject({
      groundStylePreset: 'stronghold',
    });
  });

  it('drops biome base resolution to one pixel per tile for large maps', () => {
    expect(resolveBiomeBasePixelsPerTile(100, 100)).toBe(2);
    expect(resolveBiomeBasePixelsPerTile(2000, 1500)).toBe(2);
    expect(resolveBiomeBasePixelsPerTile(3000, 1500)).toBe(1);
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

  it('prefers configured ground sprites over fallback fill when available', () => {
    const drawImage = vi.fn();
    const cache = new DimetricTerrainChunkCache({
      chunkSize: 2,
      maxChunks: 2,
      canvasFactory: (width, height) => ({
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
          fillRect() {},
          save() {},
          restore() {},
          clip() {},
          drawImage,
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
        }),
      }),
    });
    const map = { id: 'map-ground-sprite' };
    const sprite = { width: 64, height: 32 };
    cache.configure({
      map,
      tileW: 64,
      tileH: 32,
      groundSpriteVariants: { plains: [sprite] },
    });

    const chunk = cache.getChunk({
      chunkX: 0,
      chunkY: 0,
      mapWidth: 2,
      mapHeight: 2,
      resolveBiomeAt: () => CONST.BIOME.PLAINS,
    });

    expect(chunk).toBeTruthy();
    expect(drawImage).toHaveBeenCalled();
    expect(cache.getStats()).toMatchObject({
      groundSpritesEnabled: true,
    });
  });
});
