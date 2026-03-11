import * as CONST from '../constants.js';
import WorldGenerator from '../world/world-generator.js';
import FogOfWar from '../world/fog-of-war.js';
import { assignInitialSettlementOwners } from '../systems/factions.js';

export class WorldGenManager {
  constructor() { this.world = null; this.game = null; }
  init(world, game) { this.world = world; this.game = game; }

  ensureWorldGenerated(seed) {
    if (!this.world.state) return null;

    const normalizedSeed = Number.isFinite(seed) ? seed : parseInt(String(seed || this.world.state.seed || 1337), 10) || 1337;
    const hasExistingTiles = Array.isArray(this.world.state?.map?.tiles) && this.world.state.map.tiles.length > 0;
    if (hasExistingTiles && this.world._worldSeedCache === normalizedSeed) {
      this.game?.ensureFactionState?.();
      assignInitialSettlementOwners(this.world.state, { playerFactionId: CONST.FACTION.ID.PLAYER });
      if (this.world.state.map.fog instanceof Uint8Array) {
        this.world.fogOfWar = new FogOfWar(this.world.state.map.width, this.world.state.map.height, this.world.state.map.fog);
      }
      this.world._crossingSet = new Set((this.world.state.map.crossings || []).map((p) => `${p.x},${p.y}`));
      this.rebuildMovementMasks();
      return this.world.state.map;
    }

    const world = new WorldGenerator(normalizedSeed).generate();
    const tileSize = CONST.WORLD.TILE_SIZE;
    const settlements = (world.settlements || []).map((settlement, index) => {
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

    const fog = world.fog instanceof Uint8Array
      ? world.fog
      : new Uint8Array(world.width * world.height);

    this.world.state.map = {
      width: world.width,
      height: world.height,
      tiles: Array.isArray(world.tiles) ? world.tiles : [],
      settlements,
      rivers: Array.isArray(world.rivers) ? world.rivers : [],
      roads: Array.isArray(world.roads) ? world.roads : [],
      forests: Array.isArray(world.forests) ? world.forests : [],
      mountains: Array.isArray(world.mountains) ? world.mountains : [],
      crossings: Array.isArray(world.crossings) ? world.crossings : [],
      biomes: world.biomes instanceof Uint8Array ? world.biomes : null,
      pois: Array.isArray(world.pois) ? world.pois : [],
      fog,
    };

    this.game?.ensureFactionState?.();
    assignInitialSettlementOwners(this.world.state, { playerFactionId: CONST.FACTION.ID.PLAYER });

    if (!(this.world.state.map.biomes instanceof Uint8Array) || this.world.state.map.biomes.length !== this.world.state.map.width * this.world.state.map.height) {
      const fallbackBiomes = new Uint8Array(this.world.state.map.width * this.world.state.map.height);
      (this.world.state.map.tiles || []).forEach((tile, idx) => {
        if (tile?.type === CONST.TERRAIN.TYPE.WATER) fallbackBiomes[idx] = CONST.BIOME.SEA;
        else if (tile?.type === CONST.TERRAIN.TYPE.SHORE) fallbackBiomes[idx] = CONST.BIOME.SHORE;
        else if (tile?.type === CONST.TERRAIN.TYPE.MOUNTAIN) fallbackBiomes[idx] = CONST.BIOME.MOUNTAIN;
        else if (tile?.type === CONST.TERRAIN.TYPE.SNOW) fallbackBiomes[idx] = CONST.BIOME.SNOW;
        else if (tile?.type === CONST.TERRAIN.TYPE.FOREST) fallbackBiomes[idx] = CONST.BIOME.FOREST;
        else fallbackBiomes[idx] = CONST.BIOME.PLAINS;
      });
      this.world.state.map.biomes = fallbackBiomes;
    }

    this.world._crossingSet = new Set(this.world.state.map.crossings.map((p) => `${p.x},${p.y}`));
    this.rebuildMovementMasks();

    this.world._worldSeedCache = normalizedSeed;
    this.world.fogOfWar = new FogOfWar(world.width, world.height, this.world.state.map.fog);
    this.updateFogFromPlayer();
    return this.world.state.map;
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
    if (!Array.isArray(map.tiles) || map.tiles.length === 0) return;

    if (!(map.fog instanceof Uint8Array) || map.fog.length !== map.width * map.height) {
      map.fog = new Uint8Array(map.width * map.height);
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
}
