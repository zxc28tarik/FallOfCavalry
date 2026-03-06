import * as CONST from '../constants.js';
import WorldGenerator from '../world/world-generator.js';
import FogOfWar from '../world/fog-of-war.js';
import { assignInitialSettlementOwners } from '../systems/factions.js';

export class WorldManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.aiParties = [];
    this.worldGen = null;
    this.fogOfWar = null;
    this._roadMask = null;
    this._riverMask = null;
    this._crossingSet = new Set();
    this._worldSeedCache = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── 3A: Pure Coordinate & Utility Methods ─────────────────────

  getCameraSafe() {
    if (!this.state) return { x: 0, y: 0, zoom: 1 };
    if (!this.state.camera || typeof this.state.camera !== 'object') {
      this.state.camera = { x: 0, y: 0, zoom: 1 };
    }

    if (!Number.isFinite(this.state.camera.x)) this.state.camera.x = 0;
    if (!Number.isFinite(this.state.camera.y)) this.state.camera.y = 0;
    if (!Number.isFinite(this.state.camera.zoom) || this.state.camera.zoom <= 0) {
      this.state.camera.zoom = 1;
    }

    return this.state.camera;
  }

  getWorldBounds() {
    const mapWidthTiles = Number.isFinite(this.state?.map?.width) ? this.state.map.width : CONST.WORLD.MAP_WIDTH;
    const mapHeightTiles = Number.isFinite(this.state?.map?.height) ? this.state.map.height : CONST.WORLD.MAP_HEIGHT;
    const tileSize = Number.isFinite(CONST.WORLD?.TILE_SIZE) ? CONST.WORLD.TILE_SIZE : 60;

    const maxX = Math.max(0, mapWidthTiles * tileSize);
    const maxY = Math.max(0, mapHeightTiles * tileSize);

    return {
      minX: 0,
      minY: 0,
      maxX,
      maxY,
    };
  }

  clampToWorld(x, y) {
    const bounds = this.getWorldBounds();
    const safeX = Number.isFinite(x) ? x : bounds.minX;
    const safeY = Number.isFinite(y) ? y : bounds.minY;

    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, safeX)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, safeY)),
    };
  }

  screenToWorld(screenX, screenY) {
    const camera = this.getCameraSafe();
    const x = Number.isFinite(screenX) ? screenX : 0;
    const y = Number.isFinite(screenY) ? screenY : 0;
    return {
      x: x / camera.zoom + camera.x,
      y: y / camera.zoom + camera.y,
    };
  }

  getTilePosition(x, y) {
    const tileSize = CONST.WORLD.TILE_SIZE;
    const tx = Math.floor((Number.isFinite(x) ? x : 0) / tileSize);
    const ty = Math.floor((Number.isFinite(y) ? y : 0) / tileSize);
    return { tx, ty };
  }

  getBiomeKeyAtTile(tx, ty) {
    const map = this.state?.map;
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
    const settlements = this.state?.map?.settlements || [];
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

  getEffectiveCount(entry) {
    if (!entry) return 0;
    if (Number.isFinite(entry.hp) && Number.isFinite(entry.maxHp)) {
      return entry.hp > 0 ? 1 : 0;
    }
    const count = Number.isFinite(entry.count) ? entry.count : 0;
    const injured = Number.isFinite(entry.injured) ? entry.injured : 0;
    return Math.max(0, count - injured);
  }

  isWorldPointOnParty(worldX, worldY, margin = 6) {
    if (!this.game?.playerParty) return false;
    const dist = Math.hypot(worldX - this.game.playerParty.x, worldY - this.game.playerParty.y);
    return dist <= this.game.playerParty.radius + margin;
  }

  cancelPlayerDestination() {
    if (!this.game?.playerParty || !this.game.playerParty.hasDestination) return false;
    this.game.playerParty.hasDestination = false;
    this.game.playerParty.destX = null;
    this.game.playerParty.destY = null;
    return true;
  }

  setPlayerDestination(worldX, worldY) {
    if (!this.game?.playerParty) return false;
    if (!this.game.playerParty.selected) return false;
    if (this.game.mode === 'paused' || this.game.mode === 'menu' || this.state?.mode !== 'map') return false;

    const clamped = this.clampToWorld(worldX, worldY);
    this.game.playerParty.destX = clamped.x;
    this.game.playerParty.destY = clamped.y;

    const epsilon = 2;
    const dist = Math.hypot(this.game.playerParty.destX - this.game.playerParty.x, this.game.playerParty.destY - this.game.playerParty.y);
    if (dist <= epsilon) {
      this.game.playerParty.hasDestination = false;
      this.game.playerParty.destX = null;
      this.game.playerParty.destY = null;
      return false;
    }

    this.game.playerParty.hasDestination = true;
    return true;
  }

  // ─── 3B: Camera, Pointer, World Gen, FOW, Masks ────────────────

  clampCameraToWorld() {
    const camera = this.getCameraSafe();
    const bounds = this.getWorldBounds();
    if (!this.game?.canvas || !Number.isFinite(this.game.canvas.width) || !Number.isFinite(this.game.canvas.height)) {
      return camera;
    }

    const zoom = Math.max(0.5, Math.min(2.5, camera.zoom));
    camera.zoom = zoom;

    const viewW = this.game.canvas.width / zoom;
    const viewH = this.game.canvas.height / zoom;

    const maxCameraX = Math.max(bounds.minX, bounds.maxX - viewW);
    const maxCameraY = Math.max(bounds.minY, bounds.maxY - viewH);

    camera.x = Math.max(bounds.minX, Math.min(maxCameraX, camera.x));
    camera.y = Math.max(bounds.minY, Math.min(maxCameraY, camera.y));
    return camera;
  }

  centerCameraOnParty() {
    if (!this.game?.playerParty || !this.game?.canvas) return false;

    const camera = this.getCameraSafe();
    const zoom = Math.max(0.5, Math.min(2.5, camera.zoom));
    const halfW = this.game.canvas.width / zoom / 2;
    const halfH = this.game.canvas.height / zoom / 2;

    camera.x = this.game.playerParty.x - halfW;
    camera.y = this.game.playerParty.y - halfH;
    this.clampCameraToWorld();
    return true;
  }

  updatePointerWorldState(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    this.game.mouseWorldX = world.x;
    this.game.mouseWorldY = world.y;

    if (this.game?.playerParty) {
      this.game.playerParty.hovered = this.isWorldPointOnParty(world.x, world.y);
    }

    return world;
  }

  completePlayerArrival() {
    if (!this.game?.playerParty) return false;
    if (!Number.isFinite(this.game.playerParty.destX) || !Number.isFinite(this.game.playerParty.destY)) {
      this.cancelPlayerDestination();
      return false;
    }

    const snapped = this.clampToWorld(this.game.playerParty.destX, this.game.playerParty.destY);
    this.game.playerParty.x = snapped.x;
    this.game.playerParty.y = snapped.y;
    this.game.playerParty.hasDestination = false;
    this.game.playerParty.destX = null;
    this.game.playerParty.destY = null;
    this.game.playerParty.arrivalFeedbackTimer = 1.0;
    return true;
  }

  rebuildMovementMasks() {
    const map = this.state?.map;
    if (!map || !Number.isFinite(map.width) || !Number.isFinite(map.height)) {
      this._roadMask = null;
      this._riverMask = null;
      return;
    }

    const mapSize = Math.max(0, map.width * map.height);
    this._roadMask = new Uint8Array(mapSize);
    this._riverMask = new Uint8Array(mapSize);

    (map.roads || []).forEach((road) => {
      (road?.path || []).forEach((point) => {
        if (!point) return;
        const ix = point.y * map.width + point.x;
        if (ix >= 0 && ix < this._roadMask.length) this._roadMask[ix] = 1;
      });
    });

    (map.rivers || []).forEach((river) => {
      (river || []).forEach((point) => {
        if (!point) return;
        const ix = point.y * map.width + point.x;
        if (ix >= 0 && ix < this._riverMask.length) this._riverMask[ix] = 1;
      });
    });
  }

  updateFogFromPlayer() {
    const map = this.state?.map;
    const player = this.game?.playerParty;
    if (!map || !player) return;
    if (!Array.isArray(map.tiles) || map.tiles.length === 0) return;

    if (!(map.fog instanceof Uint8Array) || map.fog.length !== map.width * map.height) {
      map.fog = new Uint8Array(map.width * map.height);
    }

    if (!this.fogOfWar || this.fogOfWar.width !== map.width || this.fogOfWar.height !== map.height || this.fogOfWar.data !== map.fog) {
      this.fogOfWar = new FogOfWar(map.width, map.height, map.fog);
    }

    const tileSize = CONST.WORLD.TILE_SIZE;
    const px = Math.floor(player.x / tileSize);
    const py = Math.floor(player.y / tileSize);
    this.fogOfWar.updateVision(px, py, 6);
  }

  ensureWorldGenerated(seed) {
    if (!this.state) return null;

    const normalizedSeed = Number.isFinite(seed) ? seed : parseInt(String(seed || this.state.seed || 1337), 10) || 1337;
    const hasExistingTiles = Array.isArray(this.state?.map?.tiles) && this.state.map.tiles.length > 0;
    if (hasExistingTiles && this._worldSeedCache === normalizedSeed) {
      this.game?.ensureFactionState?.();
      assignInitialSettlementOwners(this.state, { playerFactionId: CONST.FACTION.ID.PLAYER });
      if (this.state.map.fog instanceof Uint8Array) {
        this.fogOfWar = new FogOfWar(this.state.map.width, this.state.map.height, this.state.map.fog);
      }
      this._crossingSet = new Set((this.state.map.crossings || []).map((p) => `${p.x},${p.y}`));
      this.rebuildMovementMasks();
      return this.state.map;
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

    this.state.map = {
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
    assignInitialSettlementOwners(this.state, { playerFactionId: CONST.FACTION.ID.PLAYER });

    if (!(this.state.map.biomes instanceof Uint8Array) || this.state.map.biomes.length !== this.state.map.width * this.state.map.height) {
      const fallbackBiomes = new Uint8Array(this.state.map.width * this.state.map.height);
      (this.state.map.tiles || []).forEach((tile, idx) => {
        if (tile?.type === CONST.TERRAIN.TYPE.WATER) fallbackBiomes[idx] = CONST.BIOME.SEA;
        else if (tile?.type === CONST.TERRAIN.TYPE.SHORE) fallbackBiomes[idx] = CONST.BIOME.SHORE;
        else if (tile?.type === CONST.TERRAIN.TYPE.MOUNTAIN) fallbackBiomes[idx] = CONST.BIOME.MOUNTAIN;
        else if (tile?.type === CONST.TERRAIN.TYPE.SNOW) fallbackBiomes[idx] = CONST.BIOME.SNOW;
        else if (tile?.type === CONST.TERRAIN.TYPE.FOREST) fallbackBiomes[idx] = CONST.BIOME.FOREST;
        else fallbackBiomes[idx] = CONST.BIOME.PLAINS;
      });
      this.state.map.biomes = fallbackBiomes;
    }

    this._crossingSet = new Set(this.state.map.crossings.map((p) => `${p.x},${p.y}`));
    this.rebuildMovementMasks();

    this._worldSeedCache = normalizedSeed;
    this.fogOfWar = new FogOfWar(world.width, world.height, this.state.map.fog);
    this.updateFogFromPlayer();
    return this.state.map;
  }

  getMovementContextAt(x, y) {
    const map = this.state?.map;
    if (!map) {
      return { onRoad: false, onRiver: false, onCrossing: false, blocked: false, speedMult: CONST.GAME.OFFROAD_SPEED_MULT, encounterMult: CONST.GAME.ENCOUNTER_CHANCE_OFFROAD, terrainLabel: 'Arazi: normal' };
    }

    const { tx, ty } = this.getTilePosition(x, y);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
      return { onRoad: false, onRiver: false, onCrossing: false, blocked: false, speedMult: CONST.GAME.OFFROAD_SPEED_MULT, encounterMult: CONST.GAME.ENCOUNTER_CHANCE_OFFROAD, terrainLabel: 'Arazi: normal' };
    }

    const idx = ty * map.width + tx;
    const onRoad = Boolean(this._roadMask?.[idx]);
    const onRiver = Boolean(this._riverMask?.[idx]);
    const onCrossing = this._crossingSet?.has?.(`${tx},${ty}`) || false;
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

  getNearestSettlementTierAt(tx, ty) {
    const settlements = this.state?.map?.settlements || [];
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
    const settlements = this.state?.map?.settlements || [];
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
