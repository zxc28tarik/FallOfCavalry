/**
 * FallOfCavalry - Typed world map data.
 *
 * MapData is the authoritative tile store. LegacyMapView keeps old map.tiles
 * callers alive during the migration, but legacy tile objects are not for hot paths.
 */

import * as CONST from '../constants.js';

export const TERRAIN = Object.freeze({
  WATER: 0,
  SHORE: 1,
  GRASS: 2,
  FOREST: 3,
  MOUNTAIN: 4,
  SNOW: 5,
});

export const TERRAIN_NAME = Object.freeze({
  [TERRAIN.WATER]: 'water',
  [TERRAIN.SHORE]: 'shore',
  [TERRAIN.GRASS]: 'grass',
  [TERRAIN.FOREST]: 'forest',
  [TERRAIN.MOUNTAIN]: 'mountain',
  [TERRAIN.SNOW]: 'snow',
});

export const TERRAIN_ID = Object.freeze({
  water: TERRAIN.WATER,
  shore: TERRAIN.SHORE,
  grass: TERRAIN.GRASS,
  forest: TERRAIN.FOREST,
  mountain: TERRAIN.MOUNTAIN,
  snow: TERRAIN.SNOW,
});

export const FLAGS = Object.freeze({
  ROAD: 1 << 0,
  RIVER: 1 << 1,
  BLOCKED: 1 << 2,
  FOREST: 1 << 3,
  MOUNTAIN: 1 << 4,
  SETTLEMENT: 1 << 5,
});

export const HEIGHT_ENCODING = Object.freeze({
  NORMALIZED_U16_V1: 'normalized-u16-v1',
});

export const HEIGHT_RANGE = Object.freeze({
  min: 0,
  max: 1,
  unit: 'normalized',
});

function assertLayer(layer, Type, count, name) {
  if (layer == null) return new Type(count);
  if (!(layer instanceof Type)) throw new TypeError(`${name} must be ${Type.name}`);
  if (layer.length !== count) {
    throw new RangeError(`${name} length ${layer.length} does not match map tile count ${count}`);
  }
  return layer;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.floor(Number(value) || 0)));
}

function clampU16(value) {
  return Math.max(0, Math.min(65535, Math.floor(Number(value) || 0)));
}

function terrainIdFrom(value) {
  if (Number.isFinite(value)) return Math.max(0, Math.min(255, Math.floor(value)));

  const text = String(value ?? '').trim().toLowerCase();
  if (/^\d+$/.test(text)) return Math.max(0, Math.min(255, Number(text)));

  return TERRAIN_ID[text] ?? TERRAIN.GRASS;
}

function heightToU16(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return clampU16(n <= 1 ? n * 65535 : n);
}

function addFlagDirect(mapData, x, y, flag) {
  if (!mapData.inBounds(x, y)) return;
  mapData.flags[mapData.index(x, y)] |= flag;
}

function settlementTileCoords(settlement, mapData, options = {}) {
  if (Number.isFinite(settlement?.tx) && Number.isFinite(settlement?.ty)) {
    return { tx: Math.floor(settlement.tx), ty: Math.floor(settlement.ty) };
  }

  if (Number.isFinite(settlement?.tileX) && Number.isFinite(settlement?.tileY)) {
    return { tx: Math.floor(settlement.tileX), ty: Math.floor(settlement.tileY) };
  }

  const mode = options.settlementCoordMode || 'auto';
  const tileSize = Math.max(1, Number(options.tileSize || CONST.WORLD?.TILE_SIZE) || 32);
  const x = Number(settlement?.x);
  const y = Number(settlement?.y);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return { tx: -1, ty: -1 };

  if (mode === 'pixel') return { tx: Math.floor(x / tileSize), ty: Math.floor(y / tileSize) };
  if (mode === 'tile') return { tx: Math.floor(x), ty: Math.floor(y) };

  const looksPixel =
    x >= mapData.width ||
    y >= mapData.height ||
    x > mapData.width * 0.95 ||
    y > mapData.height * 0.95;

  return looksPixel
    ? { tx: Math.floor(x / tileSize), ty: Math.floor(y / tileSize) }
    : { tx: Math.floor(x), ty: Math.floor(y) };
}

export class MapData {
  constructor(width, height, options = {}) {
    if (width && typeof width === 'object') {
      return MapData.fromGeneratedWorld(width, height && typeof height === 'object' ? height : options);
    }

    this.width = Math.max(1, Math.floor(Number(width) || 1));
    this.height = Math.max(1, Math.floor(Number(height) || 1));
    this.count = this.width * this.height;
    this.chunkSize = Math.max(1, Math.floor(Number(options.chunkSize) || 64));
    this.onChunkDirty = typeof options.onChunkDirty === 'function' ? options.onChunkDirty : null;
    this.heightEncoding = options.heightEncoding || HEIGHT_ENCODING.NORMALIZED_U16_V1;
    this.heightRange = options.heightRange || HEIGHT_RANGE;

    this.terrain = assertLayer(options.terrain, Uint8Array, this.count, 'terrain');
    this.heightMap = assertLayer(options.heightMap, Uint16Array, this.count, 'heightMap');
    this.distToSea = options.distToSea || null;
    this.flags = assertLayer(options.flags, Uint16Array, this.count, 'flags');
    this.owner = assertLayer(options.owner, Uint16Array, this.count, 'owner');
    this.fog = assertLayer(options.fog, Uint8Array, this.count, 'fog');

    this.settlements = Array.isArray(options.settlements) ? options.settlements : [];
    this.factionZones = Array.isArray(options.factionZones) ? options.factionZones : [];
    this.rivers = Array.isArray(options.rivers) ? options.rivers : [];
    this.roads = Array.isArray(options.roads) ? options.roads : [];
    this.forests = Array.isArray(options.forests) ? options.forests : [];
    this.mountains = Array.isArray(options.mountains) ? options.mountains : [];
    this.crossings = Array.isArray(options.crossings) ? options.crossings : [];
    this.biomes = options.biomes || null;
    this.pois = Array.isArray(options.pois) ? options.pois : [];
    this.politicalOwnerIds = Array.isArray(options.politicalOwnerIds) ? options.politicalOwnerIds.slice() : [];
    this.politicalOwnerMap = options.politicalOwnerMap instanceof Uint8Array && options.politicalOwnerMap.length === this.count
      ? options.politicalOwnerMap
      : null;
    this.seed = options.seed ?? null;

    this.walkabilityOverrides = new Map();
    this.modifiedChunks = new Set();
    this.fogModifiedChunks = new Set();
  }

  index(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  chunkKeyForTile(x, y) {
    return `${Math.floor(x / this.chunkSize)},${Math.floor(y / this.chunkSize)}`;
  }

  markChunkDirtyByTile(x, y, reason = 'terrain') {
    if (!this.inBounds(x, y)) return false;

    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const key = `${cx},${cy}`;

    if (reason === 'fog') this.fogModifiedChunks.add(key);
    else this.modifiedChunks.add(key);

    this.onChunkDirty?.(cx, cy, reason);
    return true;
  }

  consumeModifiedChunks() {
    const out = [...this.modifiedChunks];
    this.modifiedChunks.clear();
    return out;
  }

  consumeFogModifiedChunks() {
    const out = [...this.fogModifiedChunks];
    this.fogModifiedChunks.clear();
    return out;
  }

  getTerrainId(x, y) {
    if (!this.inBounds(x, y)) return TERRAIN.WATER;
    return this.terrain[this.index(x, y)];
  }

  setTerrainId(x, y, terrainId) {
    if (!this.inBounds(x, y)) return false;
    this.terrain[this.index(x, y)] = terrainIdFrom(terrainId);
    return this.markChunkDirtyByTile(x, y, 'terrain');
  }

  getHeight(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.heightMap[this.index(x, y)] / 65535;
  }

  setHeight(x, y, value) {
    if (!this.inBounds(x, y)) return false;
    this.heightMap[this.index(x, y)] = heightToU16(value);
    return this.markChunkDirtyByTile(x, y, 'terrain');
  }

  getFlags(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.flags[this.index(x, y)];
  }

  setFlags(x, y, flags) {
    if (!this.inBounds(x, y)) return false;
    this.flags[this.index(x, y)] = clampU16(flags);
    return this.markChunkDirtyByTile(x, y, 'flags');
  }

  addFlag(x, y, flag) {
    if (!this.inBounds(x, y)) return false;
    this.flags[this.index(x, y)] |= flag;
    return this.markChunkDirtyByTile(x, y, 'flags');
  }

  removeFlag(x, y, flag) {
    if (!this.inBounds(x, y)) return false;
    this.flags[this.index(x, y)] &= ~flag;
    return this.markChunkDirtyByTile(x, y, 'flags');
  }

  hasFlag(x, y, flag) {
    return this.inBounds(x, y) && Boolean(this.flags[this.index(x, y)] & flag);
  }

  getFog(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.fog[this.index(x, y)];
  }

  setFog(x, y, value) {
    if (!this.inBounds(x, y)) return false;
    this.fog[this.index(x, y)] = clampByte(value);
    return this.markChunkDirtyByTile(x, y, 'fog');
  }

  getOwner(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.owner[this.index(x, y)];
  }

  setOwner(x, y, value) {
    if (!this.inBounds(x, y)) return false;
    this.owner[this.index(x, y)] = clampU16(value);
    return this.markChunkDirtyByTile(x, y, 'owner');
  }

  getTile(x, y) {
    if (!this.inBounds(x, y)) return null;

    const i = this.index(x, y);
    return {
      x,
      y,
      type: TERRAIN_NAME[this.terrain[i]] || 'grass',
      terrainId: this.terrain[i],
      height: this.heightMap[i] / 65535,
      flags: this.flags[i],
      owner: this.owner[i],
      fog: this.fog[i],
    };
  }

  setTile(x, y, patch) {
    if (!this.inBounds(x, y) || patch == null) return false;

    if (typeof patch === 'string' || Number.isFinite(patch)) {
      return this.setTerrainId(x, y, patch);
    }

    const i = this.index(x, y);
    let normalDirtyReason = null;
    let fogDirty = false;

    if (patch.type != null || patch.terrainId != null) {
      this.terrain[i] = terrainIdFrom(patch.terrainId ?? patch.type);
      normalDirtyReason = 'terrain';
    }

    if (patch.height != null) {
      this.heightMap[i] = heightToU16(patch.height);
      normalDirtyReason ||= 'terrain';
    }

    if (patch.flags != null) {
      this.flags[i] = clampU16(patch.flags);
      normalDirtyReason ||= 'flags';
    }

    if (patch.owner != null) {
      this.owner[i] = clampU16(patch.owner);
      normalDirtyReason ||= 'owner';
    }

    if (patch.fog != null) {
      this.fog[i] = clampByte(patch.fog);
      fogDirty = true;
    }

    let changed = false;
    if (normalDirtyReason) {
      this.markChunkDirtyByTile(x, y, normalDirtyReason);
      changed = true;
    }
    if (fogDirty) {
      this.markChunkDirtyByTile(x, y, 'fog');
      changed = true;
    }

    return changed || true;
  }

  walkKey(x, y) {
    return `${x},${y}`;
  }

  isWalkable(x, y) {
    const key = this.walkKey(x, y);
    if (this.walkabilityOverrides.has(key)) return Boolean(this.walkabilityOverrides.get(key));
    if (!this.inBounds(x, y)) return false;
    const terrainId = this.getTerrainId(x, y);
    return terrainId !== TERRAIN.WATER && !this.hasFlag(x, y, FLAGS.BLOCKED);
  }

  setWalkable(x, y, walkable) {
    if (!this.inBounds(x, y)) return false;
    this.walkabilityOverrides.set(this.walkKey(x, y), Boolean(walkable));
    return true;
  }

  clearWalkableOverride(x, y) {
    if (!this.inBounds(x, y)) return false;
    return this.walkabilityOverrides.delete(this.walkKey(x, y));
  }

  clearAllWalkabilityOverrides() {
    this.walkabilityOverrides.clear();
  }

  getMovementCost(x, y) {
    if (!this.isWalkable(x, y)) return CONST.TERRAIN?.COST?.WATER ?? 999;
    const terrainName = TERRAIN_NAME[this.getTerrainId(x, y)] || 'grass';
    const typeKey = terrainName.toUpperCase();
    return CONST.TERRAIN?.COST?.[typeKey] || 1;
  }

  getSettlementAt(x, y) {
    return this.settlements.find((s) => Math.abs(s.x - x) < 2 && Math.abs(s.y - y) < 2);
  }

  isForest(x, y) {
    return this.hasFlag(x, y, FLAGS.FOREST);
  }

  isMountain(x, y) {
    return this.hasFlag(x, y, FLAGS.MOUNTAIN);
  }

  isRiver(x, y) {
    return this.hasFlag(x, y, FLAGS.RIVER);
  }

  isRoad(x, y) {
    return this.hasFlag(x, y, FLAGS.ROAD);
  }

  static fromGeneratedWorld(worldData, options = {}) {
    const map = new MapData(worldData.width, worldData.height, {
      ...options,
      settlements: worldData.settlements || [],
      factionZones: worldData.factionZones || [],
      rivers: worldData.rivers || [],
      roads: worldData.roads || [],
      forests: worldData.forests || [],
      mountains: worldData.mountains || [],
      crossings: worldData.crossings || [],
      biomes: worldData.biomes || null,
      pois: worldData.pois || [],
      politicalOwnerIds: worldData.politicalOwnerIds || [],
      politicalOwnerMap: worldData.politicalOwnerMap || null,
      seed: worldData.seed ?? options.seed ?? null,
      distToSea: worldData.distToSea || options.distToSea || null,
      terrain: worldData.terrain instanceof Uint8Array ? worldData.terrain : options.terrain,
      heightEncoding: worldData.heightEncoding || options.heightEncoding || HEIGHT_ENCODING.NORMALIZED_U16_V1,
      heightRange: worldData.heightRange || options.heightRange || HEIGHT_RANGE,
    });

    for (let i = 0; i < map.count; i++) {
      if (!(worldData.terrain instanceof Uint8Array)) {
        const legacyTile = Array.isArray(worldData.tiles) ? worldData.tiles[i] : null;
        map.terrain[i] = terrainIdFrom(options.terrain?.[i] ?? legacyTile?.terrainId ?? legacyTile?.type);
      }
      map.heightMap[i] = heightToU16(worldData.heightMap?.[i] ?? 0);
      map.fog[i] = clampByte(worldData.fog?.[i] ?? 0);
    }

    for (const f of worldData.forests || []) addFlagDirect(map, f.x, f.y, FLAGS.FOREST);
    for (const m of worldData.mountains || []) addFlagDirect(map, m.x, m.y, FLAGS.MOUNTAIN);
    for (const river of worldData.rivers || []) {
      for (const p of river || []) addFlagDirect(map, p.x, p.y, FLAGS.RIVER);
    }
    for (const road of worldData.roads || []) {
      for (const p of road?.path || []) addFlagDirect(map, p.x, p.y, FLAGS.ROAD);
    }
    for (const settlement of worldData.settlements || []) {
      const { tx, ty } = settlementTileCoords(settlement, map, options);
      addFlagDirect(map, tx, ty, FLAGS.SETTLEMENT);
    }

    map.modifiedChunks.clear();
    map.fogModifiedChunks.clear();
    return map;
  }
}

export class LegacyMapView {
  constructor(mapData, extras = {}) {
    this.mapData = mapData;
    this.__mapData = mapData;
    this._warnedOps = new Set();
    this._tilesProxy = this._createTilesProxy();

    for (const [key, value] of Object.entries(extras || {})) {
      if (key === 'width' || key === 'height' || key === 'terrain' || key === 'flags' || key === 'fog' || key === 'tiles') continue;
      this[key] = value;
    }

    this.settlements ??= mapData.settlements;
    this.factionZones ??= mapData.factionZones;
    this.rivers ??= mapData.rivers;
    this.roads ??= mapData.roads;
    this.forests ??= mapData.forests;
    this.mountains ??= mapData.mountains;
    this.crossings ??= mapData.crossings;
    this.biomes ??= mapData.biomes;
    this.pois ??= mapData.pois;
    this.politicalOwnerIds ??= mapData.politicalOwnerIds;
    this.politicalOwnerMap ??= mapData.politicalOwnerMap;
    this.seed ??= mapData.seed;
  }

  get width() {
    return this.mapData.width;
  }

  get height() {
    return this.mapData.height;
  }

  get terrain() {
    return this.mapData.terrain;
  }

  get heightMap() {
    return this.mapData.heightMap;
  }

  get distToSea() {
    return this.mapData.distToSea;
  }

  get flags() {
    return this.mapData.flags;
  }

  get owner() {
    return this.mapData.owner;
  }

  get fog() {
    return this.mapData.fog;
  }

  get tiles() {
    this._warn('tiles', 'map.tiles compatibility access is slow. Migrate caller to MapData typed-array APIs.');
    return this._tilesProxy;
  }

  getTile(x, y) {
    return this.mapData.getTile(x, y);
  }

  setTile(x, y, patch) {
    return this.mapData.setTile(x, y, patch);
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      settlements: this.settlements,
      factionZones: this.factionZones,
      rivers: this.rivers,
      roads: this.roads,
      forests: this.forests,
      mountains: this.mountains,
      crossings: this.crossings,
      pois: this.pois,
      politicalOwnerIds: this.politicalOwnerIds,
    };
  }

  _warn(op, message) {
    if (this._warnedOps.has(op)) return;
    this._warnedOps.add(op);
    console.warn(`[LegacyMapView] ${message}`);
  }

  _tileAtIndex(index) {
    const x = index % this.mapData.width;
    const y = Math.floor(index / this.mapData.width);
    return this.mapData.getTile(x, y);
  }

  _createTilesProxy() {
    const self = this;

    const warnExpensive = (op) => {
      self._warn(op, `map.tiles.${op}(...) creates legacy tile objects across ${self.mapData.count} tiles. Replace before large-map mode.`);
    };

    return new Proxy([], {
      get(_target, prop) {
        if (prop === 'length') return self.mapData.count;

        if (prop === 'toJSON') {
          return () => {
            self._warn('toJSON', 'map.tiles serialization is disabled. Save map seed/diffs instead of legacy tile objects.');
            return undefined;
          };
        }

        if (prop === Symbol.iterator) {
          self._warn('iterator', `Iterating map.tiles creates legacy tile objects across ${self.mapData.count} tiles. Replace before large-map mode.`);
          return function* iterator() {
            for (let i = 0; i < self.mapData.count; i++) yield self._tileAtIndex(i);
          };
        }

        if (prop === 'forEach') {
          return (fn, thisArg) => {
            warnExpensive('forEach');
            for (let i = 0; i < self.mapData.count; i++) {
              fn.call(thisArg, self._tileAtIndex(i), i, self._tilesProxy);
            }
          };
        }

        if (prop === 'map') {
          return (fn, thisArg) => {
            warnExpensive('map');
            const out = new Array(self.mapData.count);
            for (let i = 0; i < self.mapData.count; i++) {
              out[i] = fn.call(thisArg, self._tileAtIndex(i), i, self._tilesProxy);
            }
            return out;
          };
        }

        if (prop === 'filter') {
          return (fn, thisArg) => {
            warnExpensive('filter');
            const out = [];
            for (let i = 0; i < self.mapData.count; i++) {
              const tile = self._tileAtIndex(i);
              if (fn.call(thisArg, tile, i, self._tilesProxy)) out.push(tile);
            }
            return out;
          };
        }

        if (prop === 'find') {
          return (fn, thisArg) => {
            warnExpensive('find');
            for (let i = 0; i < self.mapData.count; i++) {
              const tile = self._tileAtIndex(i);
              if (fn.call(thisArg, tile, i, self._tilesProxy)) return tile;
            }
            return undefined;
          };
        }

        if (prop === 'some') {
          return (fn, thisArg) => {
            warnExpensive('some');
            for (let i = 0; i < self.mapData.count; i++) {
              if (fn.call(thisArg, self._tileAtIndex(i), i, self._tilesProxy)) return true;
            }
            return false;
          };
        }

        if (prop === 'every') {
          return (fn, thisArg) => {
            warnExpensive('every');
            for (let i = 0; i < self.mapData.count; i++) {
              if (!fn.call(thisArg, self._tileAtIndex(i), i, self._tilesProxy)) return false;
            }
            return true;
          };
        }

        const index = Number(prop);
        if (Number.isInteger(index) && index >= 0 && index < self.mapData.count) {
          self._warn('index', 'map.tiles[index] creates a legacy tile object. Use MapData layer access in hot paths.');
          return self._tileAtIndex(index);
        }

        return undefined;
      },

      set(_target, prop, value) {
        const index = Number(prop);
        if (!Number.isInteger(index) || index < 0 || index >= self.mapData.count) return false;

        const x = index % self.mapData.width;
        const y = Math.floor(index / self.mapData.width);
        return self.mapData.setTile(x, y, value);
      },
    });
  }
}

export function createLegacyMapView(mapData, extras = {}) {
  return new LegacyMapView(mapData, extras);
}

export default MapData;
