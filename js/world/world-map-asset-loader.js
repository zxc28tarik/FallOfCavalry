import * as CONST from '../constants.js';
import { MapData, TERRAIN, FLAGS, HEIGHT_ENCODING, HEIGHT_RANGE } from './map-data.js';
import ownerUrl from '../../assets/world-map/owner.bin?url';
import terrainUrl from '../../assets/world-map/terrain.bin?url';
import colorsUrl from '../../assets/world-map/faction-colors.json?url';
import manifest from '../../assets/world-map/world-map-manifest.json';

export const ASSET_OWNER_ID_TO_FACTION_ID = Object.freeze({
  1: 'ottoman',
  2: 'spanish',
  3: 'austria',
  4: 'hre',
  5: 'france',
  6: 'netherlands',
  7: 'portugal',
  8: 'sweden',
  9: 'denmark',
  10: 'polish',
  11: 'russia',
  12: 'safavid',
  13: 'venice',
  14: 'genoa',
  15: 'papal_states',
  16: 'swiss',
  17: 'morocco',
  18: 'tuscany',
  19: 'savoy',
});

export const DEFAULT_WORLD_MAP_ASSET_URLS = Object.freeze({
  owner: ownerUrl,
  terrain: terrainUrl,
  factionColors: colorsUrl,
});

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(arrayBuffer) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') return null;
  return toHex(await subtle.digest('SHA-256', arrayBuffer));
}

function formatBytes(bytes) {
  return `${Math.round((Number(bytes) || 0) / 1024 / 1024 * 100) / 100} MiB`;
}

function roundScale(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function computeWorldScale(assetManifest = manifest, tileSizePx = CONST.WORLD?.TILE_SIZE || 32) {
  const manifestScale = assetManifest?.worldScale;
  if (manifestScale && typeof manifestScale === 'object') {
    return {
      ...manifestScale,
      tileSizePx: Number(manifestScale.tileSizePx) || Number(tileSizePx) || 32,
    };
  }

  const bbox = assetManifest?.bbox;
  const width = Number(assetManifest?.width);
  const height = Number(assetManifest?.height);
  if (!bbox || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const south = Number(bbox.south);
  const north = Number(bbox.north);
  const west = Number(bbox.west);
  const east = Number(bbox.east);
  if (![south, north, west, east].every(Number.isFinite) || north <= south || east <= west) {
    return null;
  }

  const kmPerDegree = 111.32;
  const centerLatitude = (south + north) / 2;
  const widthKm = (east - west) * kmPerDegree * Math.cos((centerLatitude * Math.PI) / 180);
  const heightKm = (north - south) * kmPerDegree;
  const kmPerTileX = widthKm / width;
  const kmPerTileY = heightKm / height;
  const safeTileSizePx = Math.max(1, Number(tileSizePx) || 32);

  return {
    unit: 'km',
    calculation: 'spherical-mid-latitude-approximation',
    centerLatitude: roundScale(centerLatitude, 2),
    approxWidthKm: roundScale(widthKm, 2),
    approxHeightKm: roundScale(heightKm, 2),
    kmPerTileX: roundScale(kmPerTileX),
    kmPerTileY: roundScale(kmPerTileY),
    averageKmPerTile: roundScale((kmPerTileX + kmPerTileY) / 2),
    kmPerWorldPixelX: roundScale(kmPerTileX / safeTileSizePx, 5),
    kmPerWorldPixelY: roundScale(kmPerTileY / safeTileSizePx, 5),
    tileSizePx: safeTileSizePx,
  };
}

function appendCacheBust(url, token) {
  if (!token) return url;
  const raw = String(url || '');
  if (!raw) return raw;
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}v=${encodeURIComponent(String(token).slice(0, 16))}`;
}

function assetTileToLatLon(x, y, width, height, bbox = manifest?.bbox) {
  const west = Number(bbox?.west);
  const east = Number(bbox?.east);
  const south = Number(bbox?.south);
  const north = Number(bbox?.north);
  if (![west, east, south, north].every(Number.isFinite) || width <= 1 || height <= 1) {
    return { lat: 0, lon: 0 };
  }
  return {
    lon: west + ((x + 0.5) / width) * (east - west),
    lat: north - ((y + 0.5) / height) * (north - south),
  };
}

function visualNoise(x, y, seed = 0) {
  const n = Math.sin((x * 12.9898) + (y * 78.233) + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function isSingleGrassWorldMapMode() {
  return CONST.WORLD?.WORLD_MAP_FORCE_SINGLE_GRASS_BIOME !== false;
}

function inRect(lon, lat, west, south, east, north) {
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

function classifyVisualLandBiome(x, y, width, height, assetManifest = manifest) {
  const { lat, lon } = assetTileToLatLon(x, y, width, height, assetManifest?.bbox);
  const local = visualNoise(x * 0.37, y * 0.37, 11);
  const broad = visualNoise(x * 0.045, y * 0.045, 17);
  const fine = visualNoise(x * 1.7, y * 1.7, 23);

  const mountainBelt =
    inRect(lon, lat, 5.0, 43.0, 16.5, 48.5) // Alps
    || inRect(lon, lat, 12.5, 41.0, 19.0, 46.5) // Dinaric/Adriatic mountains
    || inRect(lon, lat, 34.0, 39.0, 48.0, 44.5) // Caucasus
    || inRect(lon, lat, -8.5, 29.0, 11.0, 36.5) // Atlas / North Africa highlands
    || inRect(lon, lat, 27.0, 37.0, 42.5, 41.8) // Anatolian ranges
    || inRect(lon, lat, 5.0, 59.0, 31.0, 70.5); // Scandinavian highlands

  if (mountainBelt && (broad > 0.30 || local > 0.56)) {
    return broad > 0.66 || local > 0.78 ? CONST.BIOME.MOUNTAIN : CONST.BIOME.HILLS;
  }

  const aridSouth = lat < 34.5 && lon > -12 && lon < 42;
  if (aridSouth && broad > 0.22) return CONST.BIOME.HILLS;

  const forestClimate =
    (lat >= 45 && lat <= 62 && lon >= -6 && lon <= 37)
    || (lat >= 50 && lon >= 24 && lon <= 52)
    || (lat >= 39 && lat <= 46 && lon >= 24 && lon <= 41);
  if (forestClimate && ((broad * 0.55 + local * 0.33 + fine * 0.12) > 0.49)) {
    return CONST.BIOME.FOREST;
  }

  if (lat > 63 && broad > 0.66) return CONST.BIOME.HILLS;
  return CONST.BIOME.PLAINS;
}

function isWaterTile(terrain, index) {
  return terrain[index] === TERRAIN.WATER;
}

function countNeighborMatches(biomes, width, height, x, y, predicate) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (predicate(biomes[(ny * width) + nx], nx, ny)) count += 1;
    }
  }
  return count;
}

function hasAdjacentWater(terrain, width, height, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (isWaterTile(terrain, (ny * width) + nx)) return true;
    }
  }
  return false;
}

function smoothVisualBiomes(terrain, biomes, width, height) {
  const next = biomes.slice();
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const i = row + x;
      if (isWaterTile(terrain, i)) continue;
      if (hasAdjacentWater(terrain, width, height, x, y)) {
        next[i] = CONST.BIOME.SHORE;
        continue;
      }

      const current = biomes[i];
      const counts = new Map();
      let bestBiome = current;
      let bestCount = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = (ny * width) + nx;
          if (isWaterTile(terrain, ni)) continue;
          const biome = biomes[ni];
          const count = (counts.get(biome) || 0) + 1;
          counts.set(biome, count);
          if (count > bestCount) {
            bestCount = count;
            bestBiome = biome;
          }
        }
      }

      const currentCount = counts.get(current) || 0;
      if (bestBiome !== current && bestCount >= 5 && currentCount <= 2) {
        next[i] = bestBiome;
      }
    }
  }
  return next;
}

function buildFeatureAnchors({
  terrain,
  biomes,
  width,
  height,
  targetBiomes,
  stride,
  density,
  noiseSeed,
  minNeighborSupport = 3,
}) {
  const anchors = [];
  const targetSet = new Set(targetBiomes);
  const safeStride = Math.max(1, Math.floor(Number(stride) || 1));
  const safeDensity = Math.max(0.05, Math.min(0.98, Number(density) || 0.5));

  for (let by = 0; by < height; by += safeStride) {
    for (let bx = 0; bx < width; bx += safeStride) {
      let best = null;
      let bestScore = -Infinity;
      const yEnd = Math.min(height, by + safeStride);
      const xEnd = Math.min(width, bx + safeStride);
      for (let y = by; y < yEnd; y += 1) {
        const row = y * width;
        for (let x = bx; x < xEnd; x += 1) {
          const i = row + x;
          if (isWaterTile(terrain, i)) continue;
          const biome = biomes[i];
          if (!targetSet.has(biome)) continue;

          const support = countNeighborMatches(
            biomes,
            width,
            height,
            x,
            y,
            (neighborBiome) => targetSet.has(neighborBiome),
          );
          const localNoise = visualNoise(x * 0.41, y * 0.41, noiseSeed);
          const broadNoise = visualNoise(x * 0.13, y * 0.13, noiseSeed + 19);
          const coastalPenalty = hasAdjacentWater(terrain, width, height, x, y) ? 1.35 : 0;
          const score = support + (localNoise * 0.85) + (broadNoise * 0.55) - coastalPenalty;
          if (score > bestScore) {
            bestScore = score;
            best = { x, y, support };
          }
        }
      }

      if (!best) continue;
      const supportBoost = Math.max(0, best.support - minNeighborSupport) * 0.05;
      const keepChance = Math.max(0.08, Math.min(0.98, safeDensity + supportBoost));
      const keepNoise = visualNoise(best.x * 0.73, best.y * 0.73, noiseSeed + 101);
      if (best.support >= minNeighborSupport && keepNoise <= keepChance) {
        anchors.push({ x: best.x, y: best.y });
      }
    }
  }

  return anchors;
}

function buildVisualFeatureLayers(terrain, biomes, width, height, assetManifest = manifest) {
  const flags = new Uint16Array(terrain.length);
  if (isSingleGrassWorldMapMode()) {
    biomes.fill(CONST.BIOME.PLAINS);
    const forests = buildFeatureAnchors({
      terrain,
      biomes,
      width,
      height,
      targetBiomes: [CONST.BIOME.PLAINS],
      stride: Math.max(3, Number(CONST.WORLD?.WORLD_MAP_FOREST_STRIDE) || 5),
      density: Number(CONST.WORLD?.WORLD_MAP_FOREST_DENSITY) || 0.34,
      noiseSeed: 101,
      minNeighborSupport: 4,
    });
    for (const forest of forests) {
      flags[(forest.y * width) + forest.x] |= FLAGS.FOREST;
    }
    return { flags, forests, mountains: [] };
  }

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      const i = row + x;
      if (isWaterTile(terrain, i)) {
        biomes[i] = CONST.BIOME.SEA;
        continue;
      }
      biomes[i] = classifyVisualLandBiome(x, y, width, height, assetManifest);
    }
  }

  const smoothedBiomes = smoothVisualBiomes(terrain, biomes, width, height);
  biomes.set(smoothedBiomes);

  for (let i = 0; i < terrain.length; i += 1) {
    if (isWaterTile(terrain, i)) continue;
    const biome = biomes[i];
    if (biome === CONST.BIOME.FOREST) {
      flags[i] |= FLAGS.FOREST;
    } else if (biome === CONST.BIOME.MOUNTAIN || biome === CONST.BIOME.HILLS) {
      flags[i] |= FLAGS.MOUNTAIN;
    }
  }

  const forests = buildFeatureAnchors({
    terrain,
    biomes,
    width,
    height,
    targetBiomes: [CONST.BIOME.FOREST],
    stride: CONST.WORLD?.VISUAL_FEATURE_STRIDE || 2,
    density: CONST.WORLD?.FOREST_ANCHOR_DENSITY || 0.76,
    noiseSeed: 101,
    minNeighborSupport: 3,
  });
  const mountains = buildFeatureAnchors({
    terrain,
    biomes,
    width,
    height,
    targetBiomes: [CONST.BIOME.MOUNTAIN, CONST.BIOME.HILLS],
    stride: Math.max(2, Number(CONST.WORLD?.VISUAL_FEATURE_STRIDE) || 2),
    density: CONST.WORLD?.MOUNTAIN_ANCHOR_DENSITY || 0.61,
    noiseSeed: 137,
    minNeighborSupport: 2,
  });

  return { flags, forests, mountains };
}

async function readResponseArrayBuffer(response, {
  assetName,
  expectedBytes,
  onProgress,
  onLog,
} = {}) {
  const contentLength = Number(response.headers?.get?.('content-length'));
  const total = Number.isFinite(contentLength) && contentLength > 0
    ? contentLength
    : Number(expectedBytes) || 0;

  if (!response.body?.getReader) {
    const buffer = await response.arrayBuffer();
    onProgress?.({ assetName, loaded: buffer.byteLength, total: total || buffer.byteLength });
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({ assetName, loaded, total });
  }

  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  onLog?.(`[WorldMapAssetLoader] ${assetName} fetched ${formatBytes(loaded)}`);
  return out.buffer;
}

async function fetchArrayBuffer(url, fetchImpl = globalThis.fetch, options = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('World map asset loader needs fetch()');
  }
  const requestUrl = appendCacheBust(url, options.cacheBust);
  options.onLog?.(`[WorldMapAssetLoader] Fetch started: ${options.assetName || requestUrl}`);
  const response = await fetchImpl(requestUrl, { cache: 'no-cache' });
  if (!response?.ok) {
    throw new Error(`Failed to load world map asset ${requestUrl}: ${response?.status || 'network_error'}`);
  }
  return readResponseArrayBuffer(response, options);
}

async function fetchJson(url, fetchImpl = globalThis.fetch, options = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('World map asset loader needs fetch()');
  }
  const requestUrl = appendCacheBust(url, options.cacheBust);
  options.onLog?.(`[WorldMapAssetLoader] Fetch started: ${options.assetName || requestUrl}`);
  const response = await fetchImpl(requestUrl, { cache: 'no-cache' });
  if (!response?.ok) {
    throw new Error(`Failed to load world map JSON ${requestUrl}: ${response?.status || 'network_error'}`);
  }
  const json = await response.json();
  options.onLog?.(`[WorldMapAssetLoader] ${options.assetName || 'JSON'} fetched`);
  return json;
}

function assertByteLength(view, expected, name) {
  if (view.byteLength !== expected) {
    throw new RangeError(`${name} byte length ${view.byteLength} does not match expected ${expected}`);
  }
}

function buildFactionZones(ownerAsset, width, height, ownerIdToFactionId = ASSET_OWNER_ID_TO_FACTION_ID) {
  const bounds = new Map();
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const ownerId = ownerAsset[row + x];
      const owner = ownerIdToFactionId[ownerId];
      if (!owner) continue;
      const old = bounds.get(owner) || { owner, minX: x, minY: y, maxX: x, maxY: y, tileCount: 0 };
      old.minX = Math.min(old.minX, x);
      old.minY = Math.min(old.minY, y);
      old.maxX = Math.max(old.maxX, x);
      old.maxY = Math.max(old.maxY, y);
      old.tileCount++;
      bounds.set(owner, old);
    }
  }

  return [...bounds.values()].map((b) => ({
    owner: b.owner,
    x: b.minX,
    y: b.minY,
    w: b.maxX - b.minX + 1,
    h: b.maxY - b.minY + 1,
    tileCount: b.tileCount,
  }));
}

function buildOwnerStats(ownerAsset, width, height, ownerIdToFactionId = ASSET_OWNER_ID_TO_FACTION_ID) {
  const stats = new Map();
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const ownerId = ownerAsset[row + x];
      const factionId = ownerIdToFactionId[ownerId];
      if (!factionId) continue;
      const old = stats.get(factionId) || {
        factionId,
        ownerId,
        count: 0,
        sumX: 0,
        sumY: 0,
        minX: x,
        minY: y,
        maxX: x,
        maxY: y,
      };
      old.count++;
      old.sumX += x;
      old.sumY += y;
      old.minX = Math.min(old.minX, x);
      old.minY = Math.min(old.minY, y);
      old.maxX = Math.max(old.maxX, x);
      old.maxY = Math.max(old.maxY, y);
      stats.set(factionId, old);
    }
  }
  return stats;
}

export function findFactionStartTile(mapData, factionId, ownerStats = mapData?.assetOwnerStats) {
  const stats = ownerStats instanceof Map ? ownerStats.get(factionId) : null;
  const ownerId = stats?.ownerId;
  if (!mapData || !ownerId || !stats?.count) return null;

  const centerX = Math.round(stats.sumX / stats.count);
  const centerY = Math.round(stats.sumY / stats.count);
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let y = stats.minY; y <= stats.maxY; y++) {
    const row = y * mapData.width;
    for (let x = stats.minX; x <= stats.maxX; x++) {
      const idx = row + x;
      if (mapData.owner[idx] !== ownerId || mapData.terrain[idx] === TERRAIN.WATER) continue;
      const dist = Math.hypot(x - centerX, y - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        best = { tx: x, ty: y, ownerId, factionId };
      }
    }
  }

  return best;
}

export function createMapDataFromWorldMapAssets({
  ownerBytes,
  terrainBytes,
  factionColors = {},
  assetManifest = manifest,
  chunkSize = 64,
  ownerIdToFactionId = ASSET_OWNER_ID_TO_FACTION_ID,
} = {}) {
  const width = Number(assetManifest?.width);
  const height = Number(assetManifest?.height);
  const count = width * height;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('World map manifest has invalid dimensions');
  }

  const ownerAsset = ownerBytes instanceof Uint8Array ? ownerBytes : new Uint8Array(ownerBytes || []);
  const terrainAsset = terrainBytes instanceof Uint8Array ? terrainBytes : new Uint8Array(terrainBytes || []);
  assertByteLength(ownerAsset, count, 'owner.bin');
  assertByteLength(terrainAsset, count, 'terrain.bin');

  const terrain = new Uint8Array(count);
  const owner = new Uint16Array(count);
  const heightMap = new Uint16Array(count);
  const biomes = new Uint8Array(count);
  const singleGrassMode = isSingleGrassWorldMapMode();
  let waterCount = 0;
  let landCount = 0;
  let sourceWaterCount = 0;

  for (let i = 0; i < count; i++) {
    const terrainValue = terrainAsset[i];
    if (terrainValue === 0) {
      sourceWaterCount++;
    } else if (terrainValue !== 1) {
      throw new Error(`Unexpected terrain asset value ${terrainValue} at tile ${i}`);
    }

    if (singleGrassMode) {
      terrain[i] = TERRAIN.GRASS;
      biomes[i] = CONST.BIOME.PLAINS;
      heightMap[i] = 32768;
      owner[i] = ownerAsset[i];
      landCount++;
      continue;
    }

    if (terrainValue === 0) {
      terrain[i] = TERRAIN.WATER;
      biomes[i] = CONST.BIOME.SEA;
      heightMap[i] = 0;
      waterCount++;
    } else if (terrainValue === 1) {
      terrain[i] = TERRAIN.GRASS;
      biomes[i] = CONST.BIOME.PLAINS;
      heightMap[i] = 32768;
      owner[i] = ownerAsset[i];
      landCount++;
    }
  }

  const visualLayers = buildVisualFeatureLayers(terrain, biomes, width, height, assetManifest);
  const fog = new Uint8Array(count);
  fog.fill(2);
  const ownerStats = buildOwnerStats(ownerAsset, width, height, ownerIdToFactionId);
  const politicalOwnerIds = [''];
  for (let id = 1; id <= 255; id++) {
    if (ownerIdToFactionId[id]) politicalOwnerIds[id] = ownerIdToFactionId[id];
  }

  const mapData = new MapData(width, height, {
    chunkSize,
    terrain,
    heightMap,
    distToSea: null,
    owner,
    fog,
    flags: visualLayers.flags,
    biomes,
    settlements: [],
    factionZones: buildFactionZones(ownerAsset, width, height, ownerIdToFactionId),
    rivers: [],
    roads: [],
    crossings: [],
    forests: visualLayers.forests,
    mountains: visualLayers.mountains,
    pois: [],
    politicalOwnerIds,
    politicalOwnerMap: ownerAsset.slice(),
    seed: null,
    heightEncoding: HEIGHT_ENCODING.NORMALIZED_U16_V1,
    heightRange: HEIGHT_RANGE,
  });

  mapData.assetMetadata = {
    mapSource: assetManifest.mapSource || assetManifest.id || 'asset',
    worldMapVersion: assetManifest.id || null,
    date: assetManifest.date || null,
    projection: assetManifest.projection || CONST.WORLD?.MAP_PROJECTION || null,
    bbox: assetManifest.bbox || CONST.WORLD?.MAP_BBOX || null,
    worldScale: computeWorldScale(assetManifest, CONST.WORLD?.TILE_SIZE || 32),
    width,
    height,
    tileCount: count,
    hashes: {
      owner: assetManifest.files?.owner?.sha256 || null,
      terrain: assetManifest.files?.terrain?.sha256 || null,
      factionColors: assetManifest.files?.factionColors?.sha256 || null,
    },
    waterCount,
    landCount,
    sourceWaterCount,
    visualForestCount: visualLayers.forests.length,
    visualMountainCount: visualLayers.mountains.length,
  };
  mapData.factionColors = factionColors;
  mapData.assetOwnerStats = ownerStats;
  mapData.assetOwnerIdToFactionId = { ...ownerIdToFactionId };
  mapData._assetFogRevealed = true;
  mapData.modifiedChunks.clear();
  mapData.fogModifiedChunks.clear();

  return mapData;
}

export class WorldMapAssetLoader {
  constructor(options = {}) {
    this.urls = options.urls || DEFAULT_WORLD_MAP_ASSET_URLS;
    this.manifest = options.manifest || manifest;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.validateHashes = options.validateHashes !== false;
    this.onProgress = options.onProgress || null;
    this.onLog = options.onLog || ((message, detail) => {
      if (detail !== undefined) console.info(message, detail);
      else console.info(message);
    });
  }

  async load() {
    const start = nowMs();
    const fileMeta = this.manifest.files || {};
    this.onLog?.('[WorldMapAssetLoader] Asset load started', {
      mapSource: this.manifest.mapSource,
      version: this.manifest.id,
      width: this.manifest.width,
      height: this.manifest.height,
    });
    const [ownerBuffer, terrainBuffer, factionColors] = await Promise.all([
      fetchArrayBuffer(this.urls.owner, this.fetchImpl, {
        assetName: 'owner.bin',
        expectedBytes: fileMeta.owner?.bytes,
        cacheBust: fileMeta.owner?.sha256 || this.manifest.id,
        onProgress: this.onProgress,
        onLog: this.onLog,
      }),
      fetchArrayBuffer(this.urls.terrain, this.fetchImpl, {
        assetName: 'terrain.bin',
        expectedBytes: fileMeta.terrain?.bytes,
        cacheBust: fileMeta.terrain?.sha256 || this.manifest.id,
        onProgress: this.onProgress,
        onLog: this.onLog,
      }),
      fetchJson(this.urls.factionColors, this.fetchImpl, {
        assetName: 'faction-colors.json',
        cacheBust: fileMeta.factionColors?.sha256 || this.manifest.id,
        onLog: this.onLog,
      }),
    ]);
    const fetchedAt = nowMs();
    this.onLog?.('[WorldMapAssetLoader] Asset fetch completed', {
      ownerBytes: ownerBuffer.byteLength,
      terrainBytes: terrainBuffer.byteLength,
      fetchMs: fetchedAt - start,
    });

    if (this.validateHashes) {
      const [ownerHash, terrainHash] = await Promise.all([
        sha256Hex(ownerBuffer),
        sha256Hex(terrainBuffer),
      ]);
      if (ownerHash && ownerHash !== this.manifest.files?.owner?.sha256) {
        throw new Error(`owner.bin hash mismatch: ${ownerHash}`);
      }
      if (terrainHash && terrainHash !== this.manifest.files?.terrain?.sha256) {
        throw new Error(`terrain.bin hash mismatch: ${terrainHash}`);
      }
      this.onLog?.('[WorldMapAssetLoader] Hash validation completed', {
        ownerHash: ownerHash || 'skipped',
        terrainHash: terrainHash || 'skipped',
      });
    }

    const mapData = createMapDataFromWorldMapAssets({
      ownerBytes: new Uint8Array(ownerBuffer),
      terrainBytes: new Uint8Array(terrainBuffer),
      factionColors,
      assetManifest: this.manifest,
    });
    const completedAt = nowMs();
    this.onLog?.('[WorldMapAssetLoader] MapData created', {
      width: mapData.width,
      height: mapData.height,
      tiles: mapData.count,
      parseMs: completedAt - fetchedAt,
      totalMs: completedAt - start,
    });
    return {
      mapData,
      factionColors,
      manifest: this.manifest,
      metrics: {
        fetchMs: fetchedAt - start,
        parseMs: completedAt - fetchedAt,
        totalMs: completedAt - start,
      },
    };
  }
}

export default WorldMapAssetLoader;
