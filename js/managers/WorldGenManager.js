import * as CONST from '../constants.js';
import WorldGenerator from '../world/world-generator.js';
import FogOfWar from '../world/fog-of-war.js';
import { MapData, LegacyMapView, TERRAIN } from '../world/map-data.js';
import WorldMapAssetLoader from '../world/world-map-asset-loader.js';
import { assignInitialSettlementOwners } from '../systems/factions.js';
// No asset-backed world remains; procedural map generation is the default.
const worldMapManifest = Object.freeze({ files: {}, tileCount: 0 });

const WORLD_GEN_REVISION = '2026-05-03-typed-mapdata-v1-deterministic-settlements';
const WORLD_ASSET_REVISION = 'historical-asset-world-removed';

export class WorldGenManager {
  constructor() { this.world = null; this.game = null; this.assetLoader = null; }
  init(world, game) { this.world = world; this.game = game; }

  resolveMapSource() {
    if (typeof window !== 'undefined' && window.location?.href) {
      const requested = new URL(window.location.href).searchParams.get('world');
      if (requested === 'procedural' || requested === 'asset') return requested;
    }
    return CONST.WORLD?.MAP_SOURCE || 'asset';
  }

  createAssetLoader() {
    const progressByAsset = new Map();
    const totals = {
      owner: Number(worldMapManifest.files?.owner?.bytes) || Number(worldMapManifest.tileCount) || 0,
      terrain: Number(worldMapManifest.files?.terrain?.bytes) || Number(worldMapManifest.tileCount) || 0,
    };
    return new WorldMapAssetLoader({
      onProgress: ({ assetName, loaded, total }) => {
        progressByAsset.set(assetName, {
          loaded: Number(loaded) || 0,
          total: Number(total) || 0,
        });
        let loadedTotal = 0;
        let expectedTotal = 0;
        for (const [name, entry] of progressByAsset.entries()) {
          loadedTotal += entry.loaded;
          expectedTotal += entry.total || totals[name?.replace('.bin', '')] || 0;
        }
        expectedTotal = Math.max(expectedTotal, totals.owner + totals.terrain);
        const percent = expectedTotal > 0 ? (loadedTotal / expectedTotal) * 80 : 0;
        this.game?.gameFlowManager?.setMapLoadingProgress?.(Math.min(80, percent), `${assetName} yukleniyor`);
      },
      onLog: (message, detail) => {
        if (detail !== undefined) console.info(message, detail);
        else console.info(message);
      },
    });
  }

  buildLegacyMapView(mapData, seed) {
    return new LegacyMapView(mapData, {
      settlements: mapData.settlements,
      factionZones: mapData.factionZones,
      rivers: mapData.rivers,
      roads: mapData.roads,
      forests: mapData.forests,
      mountains: mapData.mountains,
      crossings: mapData.crossings,
      biomes: mapData.biomes,
      pois: mapData.pois,
      politicalOwnerIds: mapData.politicalOwnerIds,
      politicalOwnerMap: mapData.politicalOwnerMap,
      assetMetadata: mapData.assetMetadata,
      seed,
    });
  }

  finalizeGeneratedMap(mapData, mapView, normalizedSeed, revision) {
    this.world.state.map = mapView;
    // Runtime convenience only; SaveManager must not serialize mapData wholesale.
    this.world.state.mapData = mapData;

    if (!Array.isArray(this.world.state.map.factionZones) || this.world.state.map.factionZones.length === 0) {
      this.world.state.map.factionZones = this.buildFactionZonesFromSettlements(this.world.state.map);
    }

    this.game?.ensureFactionState?.();
    assignInitialSettlementOwners(this.world.state, { playerFactionId: CONST.FACTION.ID.PLAYER });

    if (!(this.world.state.map.biomes instanceof Uint8Array) || this.world.state.map.biomes.length !== this.world.state.map.width * this.world.state.map.height) {
      const fallbackBiomes = new Uint8Array(this.world.state.map.width * this.world.state.map.height);
      for (let idx = 0; idx < mapData.count; idx++) {
        const terrainId = mapData.terrain[idx];
        if (terrainId === TERRAIN.WATER) fallbackBiomes[idx] = CONST.BIOME.SEA;
        else if (terrainId === TERRAIN.SHORE) fallbackBiomes[idx] = CONST.BIOME.SHORE;
        else if (terrainId === TERRAIN.MOUNTAIN) fallbackBiomes[idx] = CONST.BIOME.MOUNTAIN;
        else if (terrainId === TERRAIN.SNOW) fallbackBiomes[idx] = CONST.BIOME.SNOW;
        else if (terrainId === TERRAIN.FOREST) fallbackBiomes[idx] = CONST.BIOME.FOREST;
        else fallbackBiomes[idx] = CONST.BIOME.PLAINS;
      }
      this.world.state.map.biomes = fallbackBiomes;
      mapData.biomes = fallbackBiomes;
    }

    this.world._crossingSet = new Set((this.world.state.map.crossings || []).map((p) => `${p.x},${p.y}`));
    this.world.ensureBuildingSystem?.({
      map: this.world.state.map,
      reset: true,
    });
    this.rebuildMovementMasks();

    this.world._worldSeedCache = normalizedSeed;
    this.world._worldGenRevision = revision;
    this.world.fogOfWar = new FogOfWar(mapData.width, mapData.height, this.world.state.map.fog);
    if (this.shouldUseFogOfWar(mapData)) {
      this.updateFogFromPlayer();
    } else if (mapData.fog instanceof Uint8Array) {
      mapData.fog.fill(2);
    }
    return this.world.state.map;
  }

  shouldUseFogOfWar(mapData = null) {
    const activeMapData = mapData || this.world.state?.map?.mapData || this.world.state?.map?.__mapData || this.world.state?.mapData;
    return activeMapData?.assetMetadata?.mapSource !== 'ohm-1648';
  }

  async ensureWorldGenerated(seed) {
    if (!this.world.state) return null;

    const normalizedSeed = Number.isFinite(seed) ? seed : parseInt(String(seed || this.world.state.seed || 1337), 10) || 1337;
    const mapSource = this.resolveMapSource();
    const revision = mapSource === 'asset' ? WORLD_ASSET_REVISION : WORLD_GEN_REVISION;
    const existingMap = this.world.state?.map;
    const existingMapData = existingMap?.mapData || existingMap?.__mapData || this.world.state?.mapData;
    const hasExistingMapData = existingMapData instanceof MapData
      && existingMapData.width > 0
      && existingMapData.height > 0
      && existingMapData.count === existingMapData.width * existingMapData.height;
    const hasMatchingRevision = this.world._worldGenRevision === revision;
    const hasMatchingSeed = mapSource === 'asset' || this.world._worldSeedCache === normalizedSeed;
    if (hasExistingMapData && hasMatchingSeed && hasMatchingRevision) {
      this.world.state.mapData = existingMapData;
      if (!Array.isArray(this.world.state.map.factionZones) || this.world.state.map.factionZones.length === 0) {
        this.world.state.map.factionZones = this.buildFactionZonesFromSettlements(this.world.state.map);
      }
      this.game?.ensureFactionState?.();
      assignInitialSettlementOwners(this.world.state, { playerFactionId: CONST.FACTION.ID.PLAYER });
      if (this.world.state.map.fog instanceof Uint8Array) {
        this.world.fogOfWar = new FogOfWar(this.world.state.map.width, this.world.state.map.height, this.world.state.map.fog);
      }
      this.world._crossingSet = new Set((this.world.state.map.crossings || []).map((p) => `${p.x},${p.y}`));
      this.world.ensureBuildingSystem?.({
        map: this.world.state.map,
        reset: true,
      });
      this.rebuildMovementMasks();
      return this.world.state.map;
    }

    const tileSize = CONST.WORLD.TILE_SIZE;

    if (mapSource === 'asset') {
      try {
        this.assetLoader = this.assetLoader || this.createAssetLoader();
        this.game?.gameFlowManager?.setMapLoadingProgress?.(0, 'Harita assetleri yukleniyor');
        const loaded = await this.assetLoader.load();
        this.game?.gameFlowManager?.setMapLoadingProgress?.(90, 'MapData hazirlaniyor');
        const mapData = loaded.mapData;
        mapData.settlements = [];
        mapData.roads = [];
        mapData.rivers = [];
        mapData.crossings = [];
        mapData.seed = null;
        mapData.assetLoadMetrics = loaded.metrics;
        const mapView = this.buildLegacyMapView(mapData, null);
        mapView.assetLoadMetrics = loaded.metrics;
        this.game?.gameFlowManager?.setMapLoadingProgress?.(100, 'Harita hazir');
        return this.finalizeGeneratedMap(mapData, mapView, null, WORLD_ASSET_REVISION);
      } catch (error) {
        if (!CONST.WORLD?.ALLOW_PROCEDURAL_FALLBACK) throw error;
        console.error('[WorldGen] Asset map load failed; falling back to procedural world.', error);
      }
    }

    const generator = new WorldGenerator(normalizedSeed);
    const mapData = generator.generateMapData({
      chunkSize: 64,
      tileSize,
      settlementCoordMode: 'auto',
    });

    const settlements = (mapData.settlements || []).map((settlement, index) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : settlement.x;
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : settlement.y;
      return {
        ...settlement,
        id: settlement.id ?? `settlement-${index + 1}`,
        tx,
        ty,
        x: tx * tileSize + tileSize * 0.5,
        y: ty * tileSize + tileSize * 0.5,
      };
    });
    mapData.settlements = settlements;

    const mapView = this.buildLegacyMapView(mapData, mapData.seed ?? normalizedSeed);
    return this.finalizeGeneratedMap(mapData, mapView, normalizedSeed, WORLD_GEN_REVISION);
  }

  rebuildMovementMasks() {
    const map = this.world.state?.map;
    if (!map || !Number.isFinite(map.width) || !Number.isFinite(map.height)) {
      this.world._roadMask = null;
      this.world._riverMask = null;
      return;
    }

    const mapSize = Math.max(0, map.width * map.height);
    this.world._roadMask = new Uint8Array(mapSize);
    this.world._riverMask = new Uint8Array(mapSize);

    (map.roads || []).forEach((road) => {
      (road?.path || []).forEach((point) => {
        if (!point) return;
        const ix = point.y * map.width + point.x;
        if (ix >= 0 && ix < this.world._roadMask.length) this.world._roadMask[ix] = 1;
      });
    });

    (map.rivers || []).forEach((river) => {
      (river || []).forEach((point) => {
        if (!point) return;
        const ix = point.y * map.width + point.x;
        if (ix >= 0 && ix < this.world._riverMask.length) this.world._riverMask[ix] = 1;
      });
    });
  }

  updateFogFromPlayer() {
    const map = this.world.state?.map;
    const player = this.game?.playerParty;
    if (!map || !player) return;
    const mapData = map?.mapData || map?.__mapData || this.world.state?.mapData;
    if (!(mapData instanceof MapData) || mapData.count <= 0) return;
    if (!this.shouldUseFogOfWar(mapData)) {
      if (mapData.fog instanceof Uint8Array && mapData._assetFogRevealed !== true) {
        mapData.fog.fill(2);
        mapData._assetFogRevealed = true;
      }
      return;
    }

    if (!(map.fog instanceof Uint8Array) || map.fog.length !== map.width * map.height) {
      mapData.fog = new Uint8Array(map.width * map.height);
    }

    if (!this.world.fogOfWar || this.world.fogOfWar.width !== map.width || this.world.fogOfWar.height !== map.height || this.world.fogOfWar.data !== map.fog) {
      this.world.fogOfWar = new FogOfWar(map.width, map.height, map.fog);
    }

    const tileSize = CONST.WORLD.TILE_SIZE;
    const px = Math.floor(player.x / tileSize);
    const py = Math.floor(player.y / tileSize);
    this.world.fogOfWar.updateVision(px, py, 6);
  }

  getMovementContextAt(x, y) {
    const map = this.world.state?.map;
    if (!map) {
      return { onRoad: false, onRiver: false, onCrossing: false, blocked: false, speedMult: CONST.GAME.OFFROAD_SPEED_MULT, encounterMult: CONST.GAME.ENCOUNTER_CHANCE_OFFROAD, terrainLabel: 'Arazi: normal' };
    }

    const { tx, ty } = this.world.getTilePosition(x, y);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
      return { onRoad: false, onRiver: false, onCrossing: false, blocked: false, speedMult: CONST.GAME.OFFROAD_SPEED_MULT, encounterMult: CONST.GAME.ENCOUNTER_CHANCE_OFFROAD, terrainLabel: 'Arazi: normal' };
    }

    const idx = ty * map.width + tx;
    const onRoad = Boolean(this.world._roadMask?.[idx]);
    const onRiver = Boolean(this.world._riverMask?.[idx]);
    const onCrossing = this.world._crossingSet?.has?.(`${tx},${ty}`) || false;
    const blocked = onRiver && !onCrossing && Boolean(CONST.GAME.RIVER_BLOCK_NON_CROSSING);

    let speedMult = onRoad ? CONST.GAME.ROAD_SPEED_MULT : CONST.GAME.OFFROAD_SPEED_MULT;
    if (onRiver && !onCrossing && !CONST.GAME.RIVER_BLOCK_NON_CROSSING) {
      speedMult *= CONST.GAME.RIVER_CROSSING_PENALTY_MULT;
    }

    const encounterMult = onRoad ? CONST.GAME.ENCOUNTER_CHANCE_ROAD : CONST.GAME.ENCOUNTER_CHANCE_OFFROAD;

    let terrainLabel = onRoad ? `Yol: +%${Math.round((CONST.GAME.ROAD_SPEED_MULT - 1) * 100)}` : 'Arazi: normal';
    if (onRiver && onCrossing) terrainLabel = 'Geçit: köprü/ford';
    if (onRiver && !onCrossing) terrainLabel = CONST.GAME.RIVER_BLOCK_NON_CROSSING ? 'Nehir: geçiş yok' : 'Nehir: ağır geçiş';

    return { onRoad, onRiver, onCrossing, blocked, speedMult, encounterMult, terrainLabel };
  }

  getBiomeKeyAtTile(tx, ty) {
    const map = this.world.state?.map;
    if (!map || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    const idx = ty * map.width + tx;
    const biome = map.biomes?.[idx];
    switch (biome) {
      case CONST.BIOME.FOREST: return 'FOREST';
      case CONST.BIOME.HILLS: return 'HILLS';
      case CONST.BIOME.MOUNTAIN: return 'MOUNTAIN';
      case CONST.BIOME.SNOW: return 'SNOW';
      case CONST.BIOME.SHORE: return 'SHORE';
      default: return 'PLAINS';
    }
  }

  getNearestSettlementAt(tx, ty) {
    const settlements = this.world.state?.map?.settlements || [];
    let nearest = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const settlement of settlements) {
      const sx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor(Number(settlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
      const sy = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor(Number(settlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
      const dist = Math.hypot((sx - tx), (sy - ty));
      if (dist < bestDist) {
        bestDist = dist;
        nearest = settlement;
      }
    }
    return nearest;
  }

  getNearestSettlementTierAt(tx, ty) {
    const settlements = this.world.state?.map?.settlements || [];
    let nearest = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const settlement of settlements) {
      const sx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor(Number(settlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
      const sy = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor(Number(settlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
      const dist = Math.hypot((sx - tx), (sy - ty));
      if (dist < bestDist) {
        bestDist = dist;
        nearest = settlement;
      }
    }
    return nearest ? this.game?.getSettlementTier?.(nearest) ?? 2 : 2;
  }

  findNearestCityId(x, y, radiusTiles = null) {
    const settlements = this.world.state?.map?.settlements || [];
    if (!settlements.length || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    const tile = Number(CONST.WORLD.TILE_SIZE || 60);
    const maxTiles = Number(radiusTiles ?? (this.game?.getEffectiveTuning?.()?.FACTION_WAR?.FRONTLINE_RADIUS ?? CONST.FACTION_WAR.FRONTLINE_RADIUS));
    const maxDist = Math.max(1, maxTiles) * tile;
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    settlements.forEach((city) => {
      const dist = Math.hypot(Number(city?.x ?? 0) - x, Number(city?.y ?? 0) - y);
      if (dist <= maxDist && dist < bestDist) {
        best = city;
        bestDist = dist;
      }
    });
    return best?.id || null;
  }

  buildFactionZonesFromSettlements(map) {
    if (!map || !Array.isArray(map.settlements) || !Number.isFinite(map.width) || !Number.isFinite(map.height)) return [];
    const tileSize = Math.max(1, Number(CONST.WORLD.TILE_SIZE || 1));
    const boundsByOwner = new Map();
    for (const settlement of map.settlements) {
      const owner = settlement?.owner;
      if (!owner || owner === CONST.FACTION.ID.BANDIT || owner === CONST.FACTION.ID.PLAYER) continue;
      const tx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor(Number(settlement?.x ?? 0) / tileSize);
      const ty = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor(Number(settlement?.y ?? 0) / tileSize);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;

      const old = boundsByOwner.get(owner) || { minX: tx, minY: ty, maxX: tx, maxY: ty };
      old.minX = Math.min(old.minX, tx);
      old.minY = Math.min(old.minY, ty);
      old.maxX = Math.max(old.maxX, tx);
      old.maxY = Math.max(old.maxY, ty);
      boundsByOwner.set(owner, old);
    }

    const zones = [];
    boundsByOwner.forEach((b, owner) => {
      const spanX = Math.max(1, b.maxX - b.minX + 1);
      const spanY = Math.max(1, b.maxY - b.minY + 1);
      const pad = Math.max(6, Math.round(Math.max(spanX, spanY) * 0.16));
      const x0 = Math.max(0, b.minX - pad);
      const y0 = Math.max(0, b.minY - pad);
      const x1 = Math.min(map.width - 1, b.maxX + pad);
      const y1 = Math.min(map.height - 1, b.maxY + pad);
      zones.push({
        owner,
        x: x0,
        y: y0,
        w: Math.max(1, x1 - x0 + 1),
        h: Math.max(1, y1 - y0 + 1),
      });
    });

    return zones;
  }
}
