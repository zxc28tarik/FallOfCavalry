import { describe, it, expect, vi } from 'vitest';
import { TERRAIN } from '../../js/world/map-data.js';
import {
  computeWorldScale,
  createMapDataFromWorldMapAssets,
  findFactionStartTile,
  WorldMapAssetLoader,
} from '../../js/world/world-map-asset-loader.js';

const TEST_MANIFEST = Object.freeze({
  id: 'test-world-map',
  mapSource: 'test-asset',
  date: '1648-12-31',
  width: 4,
  height: 3,
  tileCount: 12,
  bbox: { south: 25, west: -15, north: 71, east: 55 },
  files: {
    owner: { bytes: 12, sha256: null },
    terrain: { bytes: 12, sha256: null },
    factionColors: { bytes: 2, sha256: null },
  },
});

const SHORE_TEST_MANIFEST = Object.freeze({
  id: 'shore-test-world-map',
  mapSource: 'shore-test',
  date: '1648-12-31',
  width: 6,
  height: 6,
  tileCount: 36,
  bbox: { south: 25, west: -15, north: 71, east: 55 },
  files: {
    owner: { bytes: 36, sha256: null },
    terrain: { bytes: 36, sha256: null },
    factionColors: { bytes: 2, sha256: null },
  },
});

const FOREST_TEST_MANIFEST = Object.freeze({
  id: 'forest-test-world-map',
  mapSource: 'forest-test',
  date: '1648-12-31',
  width: 12,
  height: 12,
  tileCount: 144,
  bbox: { south: 50, west: 8, north: 58, east: 20 },
  files: {
    owner: { bytes: 144, sha256: null },
    terrain: { bytes: 144, sha256: null },
    factionColors: { bytes: 2, sha256: null },
  },
});

function makeAssets() {
  return {
    terrainBytes: new Uint8Array([
      0, 1, 1, 0,
      1, 1, 1, 1,
      0, 1, 1, 0,
    ]),
    ownerBytes: new Uint8Array([
      0, 1, 1, 0,
      1, 1, 2, 2,
      0, 2, 2, 0,
    ]),
  };
}

function makeUniformAssets(width, height, terrainValue = 1, ownerValue = 1) {
  return {
    terrainBytes: new Uint8Array(width * height).fill(terrainValue),
    ownerBytes: new Uint8Array(width * height).fill(ownerValue),
  };
}

describe('WorldMapAssetLoader', () => {
  it('builds MapData from terrain and owner assets', () => {
    const assets = makeAssets();
    const mapData = createMapDataFromWorldMapAssets({
      ...assets,
      factionColors: {},
      assetManifest: TEST_MANIFEST,
      ownerIdToFactionId: { 1: 'ottoman', 2: 'france' },
    });

    expect(mapData.width).toBe(4);
    expect(mapData.height).toBe(3);
    expect(mapData.count).toBe(12);
    expect(mapData.terrain[0]).toBe(TERRAIN.GRASS);
    expect(mapData.terrain[1]).toBe(TERRAIN.GRASS);
    expect(mapData.owner[0]).toBe(0);
    expect(mapData.owner[5]).toBe(1);
    expect(mapData.owner[6]).toBe(2);
    expect(new Set(Array.from(mapData.biomes))).toEqual(new Set([2]));
    expect(mapData.mountains).toEqual([]);
    expect(mapData.settlements).toEqual([]);
    expect(mapData.roads).toEqual([]);
    expect(mapData.rivers).toEqual([]);
    expect(mapData.assetMetadata.mapSource).toBe('test-asset');
    expect(mapData.assetMetadata.waterCount).toBe(0);
    expect(mapData.assetMetadata.sourceWaterCount).toBe(4);
    expect(mapData.assetMetadata.worldScale?.kmPerTileX).toBeGreaterThan(0);
    expect(mapData.assetMetadata.worldScale?.kmPerTileY).toBeGreaterThan(0);
  });

  it('computes world scale from bbox and manifest dimensions', () => {
    const scale = computeWorldScale({
      width: 1995,
      height: 1504,
      bbox: { south: 25, west: -15, north: 71, east: 55 },
    }, 32);

    expect(scale.approxWidthKm).toBeCloseTo(5214.13, 1);
    expect(scale.approxHeightKm).toBeCloseTo(5120.72, 1);
    expect(scale.kmPerTileX).toBeCloseTo(2.6136, 4);
    expect(scale.kmPerTileY).toBeCloseTo(3.4047, 4);
    expect(scale.tileSizePx).toBe(32);
  });

  it('finds a faction start tile near the owner centroid', () => {
    const assets = makeAssets();
    const mapData = createMapDataFromWorldMapAssets({
      ...assets,
      factionColors: {},
      assetManifest: TEST_MANIFEST,
      ownerIdToFactionId: { 1: 'ottoman', 2: 'france' },
    });

    const start = findFactionStartTile(mapData, 'france');
    expect(start).toMatchObject({ factionId: 'france', ownerId: 2 });
    expect(mapData.owner[mapData.index(start.tx, start.ty)]).toBe(2);
  });

  it('collapses mixed source terrain into a single plains biome without sea or shore tiles', () => {
    const assets = makeUniformAssets(6, 6, 1, 1);
    assets.terrainBytes[(2 * 6) + 2] = 0;
    assets.terrainBytes[(2 * 6) + 3] = 0;
    assets.terrainBytes[(3 * 6) + 2] = 0;
    assets.terrainBytes[(3 * 6) + 3] = 0;

    const mapData = createMapDataFromWorldMapAssets({
      ...assets,
      factionColors: {},
      assetManifest: SHORE_TEST_MANIFEST,
      ownerIdToFactionId: { 1: 'ottoman' },
    });

    expect(Array.from(mapData.terrain).every((value) => value === TERRAIN.GRASS)).toBe(true);
    expect(Array.from(mapData.biomes).every((value) => value === 2)).toBe(true);
    expect(mapData.mountains).toEqual([]);
    expect(mapData.assetMetadata.waterCount).toBe(0);
    expect(mapData.assetMetadata.sourceWaterCount).toBe(4);
  });

  it('produces deterministic biome and feature anchors for the same land asset', () => {
    const assets = makeUniformAssets(12, 12, 1, 1);
    const first = createMapDataFromWorldMapAssets({
      ...assets,
      factionColors: {},
      assetManifest: FOREST_TEST_MANIFEST,
      ownerIdToFactionId: { 1: 'ottoman' },
    });
    const second = createMapDataFromWorldMapAssets({
      ...assets,
      factionColors: {},
      assetManifest: FOREST_TEST_MANIFEST,
      ownerIdToFactionId: { 1: 'ottoman' },
    });

    expect(Array.from(first.biomes)).toEqual(Array.from(second.biomes));
    expect(first.forests).toEqual(second.forests);
    expect(first.mountains).toEqual(second.mountains);
    expect(first.mountains).toEqual([]);
  });

  it('loads assets with a custom fetch implementation', async () => {
    const assets = makeAssets();
    const fetchImpl = vi.fn(async (url) => ({
      ok: true,
      arrayBuffer: async () => (String(url).startsWith('owner') ? assets.ownerBytes.buffer : assets.terrainBytes.buffer),
      json: async () => ({}),
    }));
    const loader = new WorldMapAssetLoader({
      urls: { owner: 'owner', terrain: 'terrain', factionColors: 'colors' },
      manifest: TEST_MANIFEST,
      fetchImpl,
      validateHashes: false,
    });

    const result = await loader.load();
    expect(result.mapData.width).toBe(4);
    expect(result.metrics.totalMs).toBeGreaterThanOrEqual(0);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('owner?v='), { cache: 'no-cache' });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('terrain?v='), { cache: 'no-cache' });
  });

  it('does not append cache-bust tokens to data urls', async () => {
    const assets = makeAssets();
    const dataUrl = 'data:application/json;base64,e30=';
    const fetchImpl = vi.fn(async (url) => ({
      ok: true,
      arrayBuffer: async () => (String(url).startsWith('owner') ? assets.ownerBytes.buffer : assets.terrainBytes.buffer),
      json: async () => ({}),
    }));
    const loader = new WorldMapAssetLoader({
      urls: { owner: 'owner', terrain: 'terrain', factionColors: dataUrl },
      manifest: TEST_MANIFEST,
      fetchImpl,
      validateHashes: false,
    });

    await loader.load();

    expect(fetchImpl).toHaveBeenCalledWith(dataUrl, { cache: 'no-cache' });
  });
});
