import * as CONST from '../constants.js';
import WorldGenerator from '../world/world-generator.js';
import FogOfWar from '../world/fog-of-war.js';
import { assignInitialSettlementOwners, getStance } from '../systems/factions.js';
import { computeRiskMultiplier, riskLabel } from '../systems/encounter-risk.js';
import { ensureWorldParties, createInitialWorldAiState, updateWorldParties, getBanditCap } from '../systems/world-ai.js';
import { getBanditCapFromEvents } from '../systems/events.js';
import { tickWeatherLayer } from '../rendering/weather-layer.js';
import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import { setContractsRuntimeContext } from '../systems/contracts.js';
import { createInitialRegionState, getActiveRegionModifiers } from '../systems/region-state.js';

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
    this._encounterRollByEnemyId = {};
    this.encounterMargin = 10;
    this.encounterCooldownMs = 3000;
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

  // ─── 3C: Risk, Encounters, Party Initialization ─────────────────

  computeEncounterRiskContext() {
    const player = this.game?.playerParty;
    if (!player || !this.state?.map) return { mult: 1, label: 'Orta' };

    const moveContext = this.getMovementContextAt(player.x, player.y);
    const { tx, ty } = this.getTilePosition(player.x, player.y);
    const biomeKey = this.getBiomeKeyAtTile(tx, ty) || 'PLAINS';
    const nearestSettlement = this.getNearestSettlementAt(tx, ty);
    const settlementTx = Number.isFinite(nearestSettlement?.tx) ? nearestSettlement.tx : Math.floor(Number(nearestSettlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
    const settlementTy = Number.isFinite(nearestSettlement?.ty) ? nearestSettlement.ty : Math.floor(Number(nearestSettlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
    const nearSettlement = nearestSettlement && Math.hypot((settlementTx - tx), (settlementTy - ty)) <= 2.5;
    const market = nearSettlement ? this.state?.markets?.[nearestSettlement.id] : null;
    const mult = computeRiskMultiplier({
      state: this.state,
      movementCtx: moveContext,
      biomeKey,
      inCamp: Boolean(this.state?.camp?.active),
      supplies: this.state?.supplies,
      market,
    });
    return { mult, label: riskLabel(mult) };
  }

  initEnemyParties() {
    if (!this.state) return;
    if (!this.game?.worldAi || typeof this.game.worldAi !== 'object') {
      if (this.game) this.game.worldAi = createInitialWorldAiState();
    }
    if (!Array.isArray(this.game?.worldAi?.parties)) {
      if (this.game?.worldAi) this.game.worldAi.parties = [];
    }

    const worldState = this.state?.map || {};
    ensureWorldParties({
      aiState: this.game?.worldAi,
      worldState,
      factions: this.state?.factions || CONST.FACTIONS,
      cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
      currentDay: this.state?.day ?? 1,
      banditCapOverride: this.game?.getBanditCapWithEvents?.(this.game?.getCurrentEvents?.(this.state?.day ?? 1)),
    });

    this.game.enemyParties = [];
    if (Array.isArray(this.state.aiParties) && this.state.aiParties.length > 0) {
      this.game.enemyParties = this.state.aiParties.map((party) => ({
        ...party,
        factionId: party?.factionId || CONST.FACTION.ID.BANDITS,
      }));
      this.state.aiParties = this.game.enemyParties;
      return;
    }

    const bounds = this.getWorldBounds();
    const mapSpanX = Math.max(200, bounds.maxX - bounds.minX);
    const mapSpanY = Math.max(200, bounds.maxY - bounds.minY);
    const baseX = bounds.minX + mapSpanX * 0.35;
    const baseY = bounds.minY + mapSpanY * 0.35;

    this.game.enemyParties = [
      { id: 'enemy-1', x: baseX, y: baseY, radius: 12, speed: 40, vx: 0.45, vy: 0.3, factionId: CONST.FACTION.ID.BANDIT },
      { id: 'enemy-2', x: baseX + 320, y: baseY + 120, radius: 12, speed: 35, vx: -0.35, vy: 0.38, factionId: CONST.FACTION.ID.HRE },
      { id: 'enemy-3', x: baseX + 140, y: baseY + 360, radius: 12, speed: 30, vx: 0.32, vy: -0.4, factionId: CONST.FACTION.ID.OTTOMAN },
      { id: 'enemy-1', x: baseX, y: baseY, radius: 12, speed: 40, vx: 0.45, vy: 0.3, factionId: CONST.FACTION.ID.BANDITS },
      { id: 'enemy-2', x: baseX + 320, y: baseY + 120, radius: 12, speed: 35, vx: -0.35, vy: 0.38, factionId: CONST.FACTION.ID.BANDITS },
      { id: 'enemy-3', x: baseX + 140, y: baseY + 360, radius: 12, speed: 30, vx: 0.32, vy: -0.4, factionId: CONST.FACTION.ID.BANDITS },
    ];
    this.state.aiParties = this.game.enemyParties;
    this.state.worldAi = this.game.worldAi;
  }

  ensureRosterState() {
    const roster = this.game?.playerParty?.roster;
    if (!Array.isArray(roster)) return;
    roster.forEach((unit) => this.game?.ensureRosterUnitState?.(unit));
    this.game.playerParty.roster = roster.filter((unit) => unit?.status !== 'dead');
  }

  initPlayerParty() {
    if (this.game?.playerParty) return;

    const fallback = {
      x: 320,
      y: 320,
      radius: 12,
      speed: 180,
      selected: false,
      destX: null,
      destY: null,
      hasDestination: false,
      arrivalFeedbackTimer: 0,
      hovered: false,
    };

    const statePlayer = this.state?.player;
    if (statePlayer && Number.isFinite(statePlayer.x) && Number.isFinite(statePlayer.y)) {
      fallback.x = statePlayer.x;
      fallback.y = statePlayer.y;
      fallback.destX = null;
      fallback.destY = null;
    }

    this.game.playerParty = fallback;
    this.game?.ensureFactionState?.();
    if (!Number.isFinite(this.game.playerParty.gold)) this.game.playerParty.gold = 0;
    if (!Number.isFinite(this.game.playerParty.xp)) this.game.playerParty.xp = 0;
    if (!Number.isFinite(this.game.playerParty.morale)) this.game.playerParty.morale = 64;
    if (!Number.isFinite(this.game.playerParty.renown)) this.game.playerParty.renown = 0;
    if (!Number.isFinite(this.game.playerParty.starveDays)) this.game.playerParty.starveDays = 0;
    if (!Array.isArray(this.game.playerParty.contracts)) this.game.playerParty.contracts = [];
    if (typeof this.game.playerParty.factionId !== 'string' || !this.game.playerParty.factionId) this.game.playerParty.factionId = CONST.FACTION.ID.PLAYER;
    if (!Number.isFinite(this.game.playerParty.renown)) this.game.playerParty.renown = Number(CONST.GAME.STARTING_RENOWN ?? 0);
    if (!Array.isArray(this.game.playerParty.roster) || this.game.playerParty.roster.length === 0) {
      const roster = [];
      for (let i = 0; i < 6; i += 1) {
        roster.push({ id: `inf-${i + 1}`, name: `Infantry ${i + 1}`, class: 'infantry', hp: 100, maxHp: 100, atk: 14, def: 8, speed: 72, meleeRange: 20, isRanged: false, status: 'healthy', healProgress: 0 });
      }
      for (let i = 0; i < 3; i += 1) {
        roster.push({ id: `arc-${i + 1}`, name: `Archer ${i + 1}`, class: 'archer', hp: 78, maxHp: 78, atk: 10, def: 4, speed: 68, meleeRange: 14, rangedRange: 220, rangedDamage: 12, rangedCooldown: 1.2, isRanged: true, status: 'healthy', healProgress: 0 });
      }
      this.game.playerParty.roster = roster;
    }
    this.ensureRosterState();
    if (!this.game.playerParty.inventory || typeof this.game.playerParty.inventory !== 'object') {
      this.game.playerParty.inventory = { items: [], capacity: null };
    }
    this.game?.ensureInventoryModel?.();
    if (this.state) {
      this.state.playerParty = this.game.playerParty;
      setContractsRuntimeContext({ party: this.game.playerParty, map: this.state?.map, worldSeed: this.state?.seed });
      if (typeof this.state.lastEventLog !== 'string') this.state.lastEventLog = '';
      if (!Number.isFinite(this.state.lastEventLogUntil)) this.state.lastEventLogUntil = 0;
    }

    this.initEnemyParties();
    this.game?.initRosters?.();
  }

  tryTriggerEncounter() {
    if (this.state?.mode !== 'map' || !this.game?.playerParty || !Array.isArray(this.game?.enemyParties)) return false;
    if (this.state.encounter) return false;

    const now = Date.now();
    for (const enemy of this.game.enemyParties) {
      if (!enemy?.id) continue;

      const cooldownUntil = this.game?.lastEncounterEndTimeByEnemyId?.[enemy.id] ?? 0;
      if (now - cooldownUntil < this.encounterCooldownMs) continue;

      const dist = Math.hypot(this.game.playerParty.x - enemy.x, this.game.playerParty.y - enemy.y);
      const triggerDist = (this.game.playerParty.radius ?? 12) + (enemy.radius ?? 12) + this.encounterMargin;
      if (dist > triggerDist) continue;

      const rollAt = this._encounterRollByEnemyId[enemy.id] ?? 0;
      if (now - rollAt < 350) continue;
      this._encounterRollByEnemyId[enemy.id] = now;

      const moveContext = this.getMovementContextAt(this.game.playerParty.x, this.game.playerParty.y);
      const riskCtx = this.computeEncounterRiskContext();
      this.state.encounterRisk = riskCtx;
      let chance = 0.1 * moveContext.encounterMult * (Number(riskCtx?.mult) || 1);
      if (moveContext.onRiver && !moveContext.onCrossing) {
        chance *= 1.35;
      }

      if (Math.random() > Math.max(0.01, Math.min(0.95, chance))) continue;

      this.triggerEncounter(enemy);
      return true;
    }

    return false;
  }

  triggerEncounter(enemy) {
    if (!this.state || this.state.mode !== 'map' || !enemy?.id) return false;

    this.cancelPlayerDestination();
    this.state.encounter = {
      enemyId: enemy.id,
      startedAt: Date.now(),
      enemySnapshot: {
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
      },
    };
    this.state.setMode('encounter');
    this.game?.maybeShowTutorialHint?.({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: true });
    return true;
  }

  processWorldAiEncounters(encounters = []) {
    if (!Array.isArray(encounters) || encounters.length === 0) return false;
    if (this.state?.mode !== 'map' || this.state?.encounter) return false;

    const first = encounters.find((entry) => entry?.partyId);
    if (!first) return false;
    const party = (this.game?.worldAi?.parties || []).find((p) => p?.id === first.partyId);
    if (!party) return false;

    const enemyId = `wai-${party.id}`;
    const existing = (this.game?.enemyParties || []).find((e) => e?.id === enemyId);
    if (!existing) {
      this.game?.enemyParties?.push({
        id: enemyId,
        x: Number(party.x ?? first.x ?? 0),
        y: Number(party.y ?? first.y ?? 0),
        radius: 12,
        speed: 30,
        vx: 0,
        vy: 0,
        temporary: true,
        factionId: party.factionId,
        worldPartyKind: party.kind,
      });
    }

    if (this.game) this.game.worldEncounterPartyByEnemyId[enemyId] = party.id;
    return this.triggerEncounter({ id: enemyId, x: party.x, y: party.y, radius: 12 });
  }

  // ── Phase 3D: Simulation loop & UI state ──────────────────────────

  updateTransientUIState() {
    if (!this.state) return;
    this.game?.ensureFactionState?.();
    this.state.encounterRisk = this.computeEncounterRiskContext();
    if (this.state.clueMarker && Number(this.state.day ?? 1) > Number(this.state.clueMarker.expiresDay ?? 0)) {
      this.state.clueMarker = null;
    }
    this.game?.cleanupExpiredMarketOpportunities?.(this.state.day);
    const currentEvents = this.game?.refreshCurrentEventsSummary?.(this.state.day);
    setContractsRuntimeContext({ party: this.game?.playerParty, map: this.state?.map, worldSeed: this.state?.seed });
    if (this.state.lastEventLog && Date.now() >= (this.state.lastEventLogUntil ?? 0)) {
      this.state.lastEventLog = '';
      this.state.lastEventLogUntil = 0;
    }

    if (this.state.mode === 'roster') {
      this.state.playerRoster = (this.game?.playerRoster || []).map((unit) => ({
        ...unit,
        status: unit?.status || 'healthy',
        effectiveCount: this.getEffectiveCount(unit),
      }));
      this.state.enemyRoster = (this.game?.enemyRoster || []).map((unit) => ({
        ...unit,
        effectiveCount: this.getEffectiveCount(unit),
      }));
      this.state.rosterCursorIndex = this.game?.rosterCursorIndex ?? 0;
      this.state.rosterSelectedCount = this.game?.getSelectedRosterCount?.() ?? 0;
      this.state.rosterPowerPlayer = this.state.playerRoster.reduce((sum, unit) => sum + (unit.effectiveCount * ((unit.atk ?? 10) + 8)), 0);
      this.state.rosterPowerEnemy = this.state.enemyRoster.reduce((sum, unit) => sum + (unit.effectiveCount * ((unit.atk ?? 10) + 8)), 0);
    }

    if (this.state.mode === 'city') {
      this.state.uiPanel = this.game?.buildCityPanelData?.();
      const settlement = this.state.city;
      this.state.currentCityFactionContext = this.game?.getCityFactionContext?.(settlement);
      if (settlement?.id) {
        this.game?.cityUI?.setData?.({
          settlement,
          recruitPool: settlement.recruitPool || [],
          market: this.state?.markets?.[settlement.id] || null,
        });
      }
    }

    if (this.state.mode === 'aftermath') {
      this.state.uiPanel = this.game?.buildAftermathPanelData?.();
    }
    if (this.state.mode !== 'city') this.state.currentCityFactionContext = null;

    if (this.state?.camp?.active) {
      const { weight, cap } = this.game?.getLogisticsSpeedMult?.() || { weight: 0, cap: 100 };
      const mult = CONST.CAMP.WATCH_MULT[this.state?.camp?.watch || 'med'] ?? 1;
      const raidChance = `${Math.round(CONST.CAMP.RAID_BASE_CHANCE * mult * 100)}%`;
      this.game?.campUI?.refresh?.({ weight, capacity: cap, raidChance });
    }

    if (this.state?.accounting) this.game?.accountingUI?.show?.(this.state.accounting);
    else this.game?.accountingUI?.hide?.();

    if (isCurrentEventsModalOpen()) renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    this.game?.hudManager?.update?.();
  }

  updatePlayerParty(dt) {
    const party = this.game?.playerParty;
    if (!party || !Number.isFinite(dt) || dt <= 0) return;

    if (party.arrivalFeedbackTimer > 0) {
      party.arrivalFeedbackTimer = Math.max(0, party.arrivalFeedbackTimer - dt);
    }

    if (this.game?.followParty) {
      this.centerCameraOnParty();
    }

    if (this.game?.mode === 'paused' || this.state?.mode !== 'map') return;

    if (!party.hasDestination) return;

    const dx = party.destX - party.x;
    const dy = party.destY - party.y;
    const dist = Math.hypot(dx, dy);
    const epsilon = 2;

    if (dist <= epsilon) {
      this.completePlayerArrival();
      return;
    }

    if (this.state?.camp?.active) {
      this.cancelPlayerDestination();
      return;
    }

    const currentContext = this.getMovementContextAt(party.x, party.y);
    const logistics = this.game?.getLogisticsSpeedMult?.() || { starvingMult: 1, overcapMult: 1, weight: 0, cap: 100 };
    this.game.currentTerrainStatus = `${currentContext.terrainLabel} | Yük: ${Math.round(logistics.weight)}/${Math.round(logistics.cap)}`;
    if (currentContext.blocked) {
      this.cancelPlayerDestination();
      return;
    }

    const step = party.speed * currentContext.speedMult * logistics.starvingMult * logistics.overcapMult * dt;
    if (step >= dist) {
      this.completePlayerArrival();
      return;
    }

    const nx = party.x + (dx / dist) * step;
    const ny = party.y + (dy / dist) * step;
    const nextContext = this.getMovementContextAt(nx, ny);
    if (nextContext.blocked) {
      this.cancelPlayerDestination();
      return;
    }

    party.x = nx;
    party.y = ny;

    const clamped = this.clampToWorld(party.x, party.y);
    party.x = clamped.x;
    party.y = clamped.y;

    if (this.game?.followParty) {
      this.centerCameraOnParty();
    }
  }

  updateEnemyParties(dt) {
    const enemies = this.game?.enemyParties;
    if (!Array.isArray(enemies) || enemies.length === 0) return;
    if (!Number.isFinite(dt) || dt <= 0 || this.state?.mode !== 'map') return;

    const bounds = this.getWorldBounds();
    const driftRate = 0.15;
    const playerX = Number(this.game?.playerParty?.x ?? 0);
    const playerY = Number(this.game?.playerParty?.y ?? 0);

    enemies.forEach((enemy, index) => {
      if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;

      const wobble = (this.state.timeSec * 0.65) + (index * 1.37);
      enemy.vx = (enemy.vx ?? 0) + Math.sin(wobble) * driftRate * dt;
      enemy.vy = (enemy.vy ?? 0) + Math.cos(wobble * 1.11) * driftRate * dt;

      const enemyFactionId = enemy.factionId || CONST.FACTION.ID.BANDIT;
      const stance = getStance(this.state?.factions, enemyFactionId, 'player', CONST.DIPLOMACY_RELATIONS);
      const dxToPlayer = playerX - enemy.x;
      const dyToPlayer = playerY - enemy.y;
      const playerDist = Math.hypot(dxToPlayer, dyToPlayer) || 1;
      const playerDirX = dxToPlayer / playerDist;
      const playerDirY = dyToPlayer / playerDist;
      const aggroRadius = stance === 'WAR' ? 260 : (stance === 'NEUTRAL' ? 140 : 0);
      if (aggroRadius > 0 && playerDist <= aggroRadius) {
        const aggroStrength = stance === 'WAR' ? 0.85 : 0.25;
        enemy.vx += playerDirX * aggroStrength * dt;
        enemy.vy += playerDirY * aggroStrength * dt;
      }
      if (stance === 'ALLY' && playerDist < 140) {
        enemy.vx -= playerDirX * 0.5 * dt;
        enemy.vy -= playerDirY * 0.5 * dt;
      }

      const speedLen = Math.hypot(enemy.vx, enemy.vy) || 1;
      enemy.vx /= speedLen;
      enemy.vy /= speedLen;

      const speed = Number.isFinite(enemy.speed) ? enemy.speed : 35;
      const radius = Number.isFinite(enemy.radius) ? enemy.radius : 12;
      const context = this.getMovementContextAt(enemy.x, enemy.y);
      const moveSpeed = speed * context.speedMult;
      const nx = enemy.x + enemy.vx * moveSpeed * dt;
      const ny = enemy.y + enemy.vy * moveSpeed * dt;
      const nextContext = this.getMovementContextAt(nx, ny);
      if (nextContext.blocked) {
        enemy.vx *= -1;
        enemy.vy *= -1;
      } else {
        enemy.x = nx;
        enemy.y = ny;
      }

      if (enemy.x < bounds.minX + radius || enemy.x > bounds.maxX - radius) {
        enemy.vx *= -1;
        enemy.x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, enemy.x));
      }
      if (enemy.y < bounds.minY + radius || enemy.y > bounds.maxY - radius) {
        enemy.vy *= -1;
        enemy.y = Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, enemy.y));
      }
    });
  }

  updateMapSimulation(dt) {
    this.game?.updatePoiInteractHint?.();
    this.updateTransientUIState();
    if (this.state) this.state.worldAi = this.game?.worldAi;
    if (this.state?.paused || this.state?.accounting) return;
    this.updatePlayerParty(dt);
    if ((this.game?.getEffectiveTuning?.() || {}).WORLD_AI?.ENABLED ?? CONST.WORLD_AI?.ENABLED) {
      const worldState = this.state?.map || {};
      ensureWorldParties({
        aiState: this.game?.worldAi,
        worldState,
        factions: this.state?.factions || CONST.FACTIONS,
        cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
        currentDay: this.state?.day ?? 1,
        banditCapOverride: this.game?.getBanditCapWithEvents?.(this.game?.getCurrentEvents?.(this.state?.day ?? 1)),
      });
      this.game?.syncWarStateFromRelations?.();
      const encounters = updateWorldParties({
        aiState: this.game?.worldAi,
        worldState,
        playerParty: this.game?.playerParty,
        factions: this.state?.factions || CONST.FACTIONS,
        cfg: this.game?.getWorldAiCfgWithRegionMods?.() || {},
        dtSec: dt,
      });
      this.processWorldAiEncounters(encounters);
    } else {
      this.updateEnemyParties(dt);
      this.tryTriggerEncounter();
    }

    const party = this.game?.playerParty;
    const tilePos = this.getTilePosition(party?.x ?? 0, party?.y ?? 0);
    const nearestSettlement = this.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    const settlementTx = Number.isFinite(nearestSettlement?.tx) ? nearestSettlement.tx : Math.floor(Number(nearestSettlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
    const settlementTy = Number.isFinite(nearestSettlement?.ty) ? nearestSettlement.ty : Math.floor(Number(nearestSettlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
    const nearSettlement = Boolean(nearestSettlement) && Math.hypot(settlementTx - tilePos.tx, settlementTy - tilePos.ty) <= 2.5;
    const nearPoi = Boolean(this.game?.getNearestInteractablePoi?.());

    this.game?.maybeShowTutorialHint?.({
      nearSettlement,
      nearPoi,
      inCamp: Boolean(this.state?.camp?.active),
      inBattleDeploy: false,
      inBattleFight: false,
      inEncounter: this.state?.mode === 'encounter',
    });

    this.updateFogFromPlayer();
    tickWeatherLayer(dt, this.game?.canvas?.width ?? CONST.GAME.VIEW_WIDTH, this.game?.canvas?.height ?? CONST.GAME.VIEW_HEIGHT);
  }

  // ─── Phase 11C: Enemy party management ───────────────────────────────────────

  cleanupTemporaryEnemy(enemyId, { force = false } = {}) {
    const g = this.game;
    if (!enemyId || !Array.isArray(g.enemyParties)) return false;
    const enemy = g.enemyParties.find((party) => party?.id === enemyId);
    if (!enemy) return false;
    if (force || enemy?.temporary) return this.despawnEnemyParty(enemyId);
    return false;
  }

  despawnEnemyParty(enemyId) {
    const g = this.game;
    if (!enemyId || !Array.isArray(g.enemyParties)) return false;
    const idx = g.enemyParties.findIndex((party) => party?.id === enemyId);
    if (idx === -1) return false;
    g.enemyParties.splice(idx, 1);

    if (Array.isArray(this.state?.aiParties) && this.state.aiParties !== g.enemyParties) {
      const stateIdx = this.state.aiParties.findIndex((party) => party?.id === enemyId);
      if (stateIdx >= 0) this.state.aiParties.splice(stateIdx, 1);
    }
    return true;
  }

  // ─── Phase 12A: Region & bandit-cap methods ───────────────────────────────────

  getRegionIdAtTile(tx, ty) {
    const g = this.game;
    const nearestSettlement = g.getNearestSettlementAt(tx, ty);
    if (nearestSettlement?.id) return String(nearestSettlement.id);
    return `wild:${Math.floor(Number(tx) || 0)}:${Math.floor(Number(ty) || 0)}`;
  }

  getCurrentRegionContext() {
    const g = this.game;
    const tilePos = g.getTilePosition(g.playerParty?.x ?? 0, g.playerParty?.y ?? 0);
    const regionId = this.getRegionIdAtTile(tilePos.tx, tilePos.ty);
    const nearestSettlement = g.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    return {
      regionId,
      regionName: nearestSettlement?.name || regionId,
      tilePos,
      settlement: nearestSettlement,
    };
  }

  getCurrentRegionModifiers(day = this.state?.day) {
    const g = this.game;
    const ctx = this.getCurrentRegionContext();
    if (!this.state?.regionState) this.state.regionState = createInitialRegionState();
    this.state.currentRegionId = ctx.regionId;
    this.state.currentRegionName = ctx.regionName;
    return getActiveRegionModifiers(this.state.regionState, ctx.regionId, day);
  }

  getWorldAiCfgWithRegionMods() {
    const g = this.game;
    const base = g.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI;
    const mods = this.getCurrentRegionModifiers(this.state?.day);
    const banditMult = mods.reduce((mult, mod) => (mod?.id === 'high_banditry' ? (mult * Number(CONST.REGION_MODIFIERS.HIGH_BANDITRY.banditSpawnMult || 1.5)) : mult), 1);
    if (banditMult === 1) return base;
    return {
      ...base,
      MAX_BANDIT_PARTIES: Math.max(1, Math.floor(Number(base.MAX_BANDIT_PARTIES ?? 0) * banditMult)),
    };
  }

  getRenownGainMultAtCurrentRegion() {
    const mods = this.getCurrentRegionModifiers(this.state?.day);
    return mods.reduce((mult, mod) => (mod?.id === 'pilgrimage' ? (mult * Number(CONST.REGION_MODIFIERS.PILGRIMAGE.renownGainMult || 1.2)) : mult), 1);
  }

  getBanditCapWithEvents(worldEvents) {
    const g = this.game;
    const tuning = g.getEffectiveTuning();
    const worldCfg = tuning.WORLD_AI || CONST.WORLD_AI;
    const eventsCfg = tuning.EVENTS || CONST.EVENTS;
    const baseCap = Number(worldCfg.MAX_BANDIT_PARTIES ?? CONST.WORLD_AI.MAX_BANDIT_PARTIES);
    return getBanditCap(worldEvents, getBanditCapFromEvents(worldEvents, baseCap, eventsCfg), eventsCfg);
  }
}
