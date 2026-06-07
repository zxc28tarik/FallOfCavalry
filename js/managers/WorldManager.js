import * as CONST from '../constants.js';
import { createInitialWorldAiState } from '../systems/world-ai.js';
import { createInitialRegionState } from '../systems/region-state.js';
import { WorldGenManager } from './WorldGenManager.js';
import { WorldSimManager } from './WorldSimManager.js';
import { distanceToSettlementTiles, findSettlementAtWorldPoint, getSettlementInteractRangeTiles } from '../systems/settlement-picking.js';
import { screenToWorldPrecise } from '../rendering/dimetric/projection.js';
import { buildDimetricCameraConfig, resolveProjectionMode } from '../rendering/dimetric/view-config.js';
import { BuildingSystem } from '../systems/building-system.js';
import { resolveWallVariant } from '../rendering/dimetric/wall-auto-tile.js';
import { TERRAIN as MAP_TERRAIN } from '../world/map-data.js';

export class WorldManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.aiParties = [];
    this.worldGen = null;
    this.worldAi = createInitialWorldAiState();
    this.enemyParties = [];
    this.worldEncounterPartyByEnemyId = {};
    this.lastEncounterEndTimeByEnemyId = {};
    this.currentTerrainStatus = 'Arazi: normal';
    this.fogOfWar = null;
    this._roadMask = null;
    this._riverMask = null;
    this._crossingSet = new Set();
    this._worldSeedCache = null;
    this._encounterRollByEnemyId = {};
    this.encounterMargin = 10;
    this.encounterCooldownMs = 3000;
    this.genManager = null;
    this.simManager = null;
    this.buildingSystem = null;
    this._buildingSystemMapRef = null;
    this.projectionMode = null;
    this.refreshProjectionMode();
  }

  init(game) {
    this.game = game;
    if (!this.state.regionState || typeof this.state.regionState !== 'object')
      this.state.regionState = createInitialRegionState();
    this.refreshProjectionMode();
    this.genManager = new WorldGenManager();
    this.genManager.init(this, game);
    this.simManager = new WorldSimManager();
    this.simManager.init(this, game);
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

  getWorldScale() {
    const mapData = this.state?.map?.mapData || this.state?.map?.__mapData || this.state?.mapData;
    const scale = mapData?.assetMetadata?.worldScale || this.state?.map?.assetMetadata?.worldScale;
    if (scale && typeof scale === 'object') return scale;
    return {
      unit: 'km',
      kmPerTileX: CONST.WORLD.MAP_KM_PER_TILE_X,
      kmPerTileY: CONST.WORLD.MAP_KM_PER_TILE_Y,
      averageKmPerTile: CONST.WORLD.MAP_AVERAGE_KM_PER_TILE,
      kmPerWorldPixelX: CONST.WORLD.MAP_KM_PER_WORLD_PIXEL_X,
      kmPerWorldPixelY: CONST.WORLD.MAP_KM_PER_WORLD_PIXEL_Y,
      tileSizePx: CONST.WORLD.TILE_SIZE,
    };
  }

  getCurrentDay() {
    return Math.max(0, Math.floor(Number(this.state?.day ?? 0)));
  }

  getWorldState() {
    const settlements = Array.isArray(this.state?.map?.settlements) ? this.state.map.settlements : [];
    const routes = Array.isArray(this.state?.tradeRoutes) ? this.state.tradeRoutes : [];
    const banditCount = (this.enemyParties || []).filter((party) => String(party?.encounterType || party?.worldPartyKind || party?.kind) === 'bandit').length;
    return {
      isAtWar: Boolean(this.state?.warState?.wars?.some?.((war) => war?.active)),
      banditDensity: Math.max(0, Math.min(1, banditCount / Math.max(1, settlements.length || 8))),
      tradeRouteDamaged: routes.some((route) => Number(route?.damage ?? 0) > 0 || route?.status === 'damaged'),
      settlements,
      routes,
    };
  }

  pickQuestTargetRegion(rule, _context = {}) {
    const current = this.getCurrentRegionContext?.();
    if (current?.regionId) return current.regionId;
    const settlements = Array.isArray(this.state?.map?.settlements) ? this.state.map.settlements : [];
    const target = settlements.find((settlement) => settlement?.id);
    return target?.id ? `region:${target.id}` : null;
  }

  pickQuestTargetFort(_rule, _context = {}) {
    const settlements = Array.isArray(this.state?.map?.settlements) ? this.state.map.settlements : [];
    const fort = settlements.find((settlement) => {
      const type = String(settlement?.type || '').toLowerCase();
      return settlement?.id && (type.includes('fort') || type.includes('castle'));
    });
    return fort?.id || null;
  }

  pickQuestTargetCommander(_rule, _context = {}) {
    const commanders = Array.isArray(this.state?.commanders) ? this.state.commanders : [];
    return commanders.find((commander) => commander?.id)?.id || null;
  }

  applyEffect(effect) {
    if (!effect || !effect.type) return;
    const amount = Number(effect.amount ?? 0);
    switch (effect.type) {
      case 'increase_city_security':
        this.game?.cityManager?.increaseSecurity?.(effect.cityId, amount);
        break;
      case 'decrease_city_security':
        this.game?.cityManager?.decreaseSecurity?.(effect.cityId, amount);
        break;
      case 'improve_trade_route':
        this.game?.economyManager?.improveTradeRoute?.(effect.routeId, amount);
        break;
      case 'damage_trade_route':
        this.game?.economyManager?.damageTradeRoute?.(effect.routeId, amount);
        break;
      case 'change_faction_relation':
        (this.game?.factionManager || this.game?.diplomacyManager)?.changeRelation?.(effect.factionId, amount);
        break;
      case 'decrease_army_morale':
        this.decreaseMorale(amount);
        break;
      case 'decrease_elite_unit_approval':
        this.decreaseEliteApproval(amount);
        break;
      case 'spawn_world_party':
        this.simManager?.worldPartyManager?.spawnParty?.(effect.partyTemplateId, effect.location);
        break;
      case 'change_player_gold':
        this.changeGold(amount);
        break;
      case 'change_player_reputation':
        this.changeReputation(amount);
        break;
      case 'change_player_honor':
        this.changeHonor(amount);
        break;
      case 'change_player_nam':
        this.changeNam(amount);
        break;
      default:
        console.warn('Unknown world effect:', effect);
        break;
    }
  }

  changeGold(amount) {
    if (!this.game?.playerParty || !Number.isFinite(amount)) return;
    this.game.playerParty.gold = Math.floor(Number(this.game.playerParty.gold ?? 0) + amount);
  }

  changeReputation(amount) {
    if (!this.game?.playerParty || !Number.isFinite(amount)) return;
    this.game.playerParty.renown = Math.max(0, Math.floor(Number(this.game.playerParty.renown ?? 0) + amount));
  }

  changeHonor(amount) {
    if (!this.game?.playerParty || !Number.isFinite(amount)) return;
    this.game.playerParty.honor = Math.floor(Number(this.game.playerParty.honor ?? 0) + amount);
  }

  changeNam(amount) {
    if (!this.game?.playerParty || !Number.isFinite(amount)) return;
    this.game.playerParty.nam = Math.floor(Number(this.game.playerParty.nam ?? 0) + amount);
  }

  decreaseMorale(amount) {
    if (!this.game?.playerParty || !Number.isFinite(amount)) return;
    this.game.playerParty.morale = Math.max(0, Math.floor(Number(this.game.playerParty.morale ?? 0) - Math.abs(amount)));
  }

  decreaseEliteApproval(amount) {
    if (!this.game?.playerParty || !Number.isFinite(amount)) return;
    this.game.playerParty.eliteApproval = Math.max(0, Math.floor(Number(this.game.playerParty.eliteApproval ?? 50) - Math.abs(amount)));
  }

  worldPixelDistanceToKm(dx, dy) {
    const scale = this.getWorldScale();
    const kmX = Number(scale?.kmPerWorldPixelX) || (Number(CONST.WORLD.MAP_KM_PER_TILE_X) / Number(CONST.WORLD.TILE_SIZE || 32));
    const kmY = Number(scale?.kmPerWorldPixelY) || (Number(CONST.WORLD.MAP_KM_PER_TILE_Y) / Number(CONST.WORLD.TILE_SIZE || 32));
    return Math.hypot((Number(dx) || 0) * kmX, (Number(dy) || 0) * kmY);
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

  refreshProjectionMode() {
    this.projectionMode = resolveProjectionMode(Boolean(CONST.DIMETRIC?.USE_DIMETRIC), {
      allowLegacyUrlOverride: Boolean(this.state?.devMode),
      allowLegacyRuntime: Boolean(this.state?.devMode),
    });
    return this.projectionMode;
  }

  isDimetricMode() {
    return Boolean(this.projectionMode?.dimetricEnabled);
  }

  isLegacyTopdownMode() {
    return Boolean(this.projectionMode?.legacyTopdownEnabled);
  }

  getDimetricViewConfig(camera = this.getCameraSafe()) {
    return buildDimetricCameraConfig({
      camera,
      map: this.state?.map,
      canvas: this.game?.canvas,
      tileSize: CONST.WORLD?.TILE_SIZE,
      tileW: CONST.DIMETRIC?.TILE_W,
      tileH: CONST.DIMETRIC?.TILE_H,
      elevationPx: CONST.DIMETRIC?.ELEVATION_PX,
    });
  }

  screenToWorld(screenX, screenY) {
    const camera = this.getCameraSafe();
    const x = Number.isFinite(screenX) ? screenX : 0;
    const y = Number.isFinite(screenY) ? screenY : 0;
    if (this.isDimetricMode() && this.game?.canvas) {
      const view = this.getDimetricViewConfig(camera);
      if (view?.config) {
        const picked = screenToWorldPrecise(x, y, camera, view.config, 0);
        const tileX = Math.max(0, Math.min(view.mapWidth - 1, picked.tileX));
        const tileY = Math.max(0, Math.min(view.mapHeight - 1, picked.tileY));
        const tileSize = Math.max(1, Number(view.tileSize) || Number(CONST.WORLD?.TILE_SIZE) || 32);
        return {
          x: (tileX + 0.5) * tileSize,
          y: (tileY + 0.5) * tileSize,
          tileX,
          tileY,
          isDimetric: true,
        };
      }
    }
    return {
      x: x / camera.zoom + camera.x,
      y: y / camera.zoom + camera.y,
    };
  }

  getTilePosition(x, y) {
    if (x && typeof x === 'object') {
      if (Number.isFinite(x.tileX) && Number.isFinite(x.tileY)) {
        return {
          tx: Math.floor(x.tileX),
          ty: Math.floor(x.tileY),
        };
      }
      if (Number.isFinite(x.x) || Number.isFinite(x.y)) {
        return this.getTilePosition(x.x, x.y);
      }
    }
    const tileSize = CONST.WORLD.TILE_SIZE;
    const tx = Math.floor((Number.isFinite(x) ? x : 0) / tileSize);
    const ty = Math.floor((Number.isFinite(y) ? y : 0) / tileSize);
    return { tx, ty };
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
    this.game.playerParty.vx = 0;
    this.game.playerParty.vy = 0;
    this.game.playerParty.moveState = 'idle';
    return true;
  }

  setPlayerDestination(worldX, worldY) {
    if (!this.game?.playerParty) return false;
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
      this.game.playerParty.vx = 0;
      this.game.playerParty.vy = 0;
      this.game.playerParty.moveState = 'idle';
      return false;
    }

    this.game.playerParty.hasDestination = true;
    this.game.playerParty.moveState = 'moving';
    return true;
  }

  getSettlementAtWorldPoint(worldX, worldY, options = {}) {
    const map = this.state?.map;
    if (!map) return null;
    return findSettlementAtWorldPoint(map, worldX, worldY, {
      tileSize: CONST.WORLD?.TILE_SIZE,
      isDimetric: this.isDimetricMode(),
      maxHitScale: Number.isFinite(options.maxHitScale) ? options.maxHitScale : 1.0,
    });
  }

  distanceToSettlementTiles(settlement, worldX, worldY) {
    return distanceToSettlementTiles(settlement, worldX, worldY, {
      tileSize: CONST.WORLD?.TILE_SIZE,
    });
  }

  isPlayerNearSettlement(settlement, rangeTiles = null) {
    if (!settlement || !this.game?.playerParty) return false;
    const worldX = Number(this.game.playerParty.x);
    const worldY = Number(this.game.playerParty.y);
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return false;
    const distTiles = this.distanceToSettlementTiles(settlement, worldX, worldY);
    const defaultRange = getSettlementInteractRangeTiles(settlement, {
      isDimetric: this.isDimetricMode(),
    });
    const maxRange = Number.isFinite(rangeTiles) ? Number(rangeTiles) : defaultRange;
    return distTiles <= Math.max(0.1, maxRange);
  }

  // ─── 3B: Camera, Pointer, World Gen, FOW, Masks ────────────────

  buildBuildingAdapter(map = this.state?.map) {
    const tileSize = Number(CONST.WORLD?.TILE_SIZE) || 32;
    if (!map || !Number.isFinite(map.width) || !Number.isFinite(map.height)) return null;
    const mapData = map?.mapData || map?.__mapData || this.state?.mapData || null;
    const terrain = mapData?.terrain instanceof Uint8Array ? mapData.terrain : null;
    const getTerrainIdAt = (x, y) => {
      if (!terrain) return null;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
      return terrain[(y * map.width) + x];
    };
    const settlementSet = new Set((map.settlements || []).map((settlement) => {
      const tx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor(Number(settlement?.x || 0) / tileSize);
      const ty = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor(Number(settlement?.y || 0) / tileSize);
      return `${tx},${ty}`;
    }));
    return {
      width: map.width,
      height: map.height,
      isValidTile(x, y) {
        return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < map.width && y < map.height;
      },
      isWaterTile(x, y) {
        return getTerrainIdAt(x, y) === MAP_TERRAIN.WATER;
      },
      isHardBlockedTile(x, y) {
        return settlementSet.has(`${x},${y}`);
      },
      setWalkable(x, y, walkable) {
        if (!(map.walkabilityOverrides instanceof Map)) map.walkabilityOverrides = new Map();
        map.walkabilityOverrides.set(`${x},${y}`, Boolean(walkable));
      },
    };
  }

  ensureBuildingSystem(options = {}) {
    const map = options?.map || this.state?.map;
    if (!map || !Number.isFinite(map.width) || !Number.isFinite(map.height)) {
      this.buildingSystem = null;
      this._buildingSystemMapRef = null;
      return null;
    }

    const shouldRecreate = options?.reset === true || !this.buildingSystem || this._buildingSystemMapRef !== map;
    if (shouldRecreate) {
      const adapter = this.buildBuildingAdapter(map);
      if (!adapter) return null;
      this.buildingSystem = new BuildingSystem(adapter);
      this._buildingSystemMapRef = map;
      const sourceState = options?.state || map.buildingState;
      if (sourceState && typeof sourceState === 'object') {
        this.buildingSystem.load(sourceState);
      }
      map.buildingState = this.buildingSystem.toJSON();
    }

    return this.buildingSystem;
  }

  syncBuildingStateToMap() {
    const map = this.state?.map;
    const system = this.buildingSystem;
    if (!map || !system || this._buildingSystemMapRef !== map) return null;
    map.buildingState = system.toJSON();
    return map.buildingState;
  }

  placeBuilding(defId, anchorX, anchorY, options = {}) {
    const system = this.ensureBuildingSystem();
    if (!system) return null;
    const placed = system.place(defId, anchorX, anchorY, options);
    if (!placed) return null;
    this.syncBuildingStateToMap();
    return placed;
  }

  canPlaceBuilding(defId, anchorX, anchorY, options = {}) {
    const system = this.ensureBuildingSystem();
    if (!system || typeof system.canPlace !== 'function') {
      return { ok: false, reason: 'system_unavailable' };
    }
    return system.canPlace(defId, anchorX, anchorY, options);
  }

  removeBuilding(buildingId) {
    const system = this.ensureBuildingSystem();
    if (!system) return false;
    const removed = system.remove(buildingId);
    if (removed) this.syncBuildingStateToMap();
    return removed;
  }

  getBuildingAtTile(tx, ty) {
    const system = this.ensureBuildingSystem();
    if (!system) return null;
    return system.getBuildingAt(tx, ty);
  }

  getBuildingById(buildingId) {
    const system = this.ensureBuildingSystem();
    if (!system) return null;
    if (typeof system.getBuildingById !== 'function') return null;
    return system.getBuildingById(buildingId);
  }

  getWallVariantAtTile(tx, ty) {
    const system = this.ensureBuildingSystem();
    if (!system) return null;
    return resolveWallVariant(tx, ty, system.tileIndex, {
      buildings: system.buildings,
    });
  }

  clampCameraToWorld() {
    const camera = this.getCameraSafe();
    const bounds = this.getWorldBounds();
    if (!this.game?.canvas || !Number.isFinite(this.game.canvas.width) || !Number.isFinite(this.game.canvas.height)) {
      return camera;
    }

    const minZoom = Math.max(0.01, Number(CONST.WORLD?.MIN_ZOOM ?? CONST.WORLD?.CAMERA_MIN_ZOOM) || 0.42);
    const maxZoom = Math.max(minZoom, Number(CONST.WORLD?.CAMERA_MAX_ZOOM) || 2.5);
    const zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom));
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
    const minZoom = Math.max(0.01, Number(CONST.WORLD?.MIN_ZOOM ?? CONST.WORLD?.CAMERA_MIN_ZOOM) || 0.42);
    const maxZoom = Math.max(minZoom, Number(CONST.WORLD?.CAMERA_MAX_ZOOM) || 2.5);
    const zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom));
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
    if (Number.isFinite(world.tileX) && Number.isFinite(world.tileY)) {
      this.game.mouseTileX = Math.floor(world.tileX);
      this.game.mouseTileY = Math.floor(world.tileY);
    } else {
      const tile = this.getTilePosition(world.x, world.y);
      this.game.mouseTileX = tile.tx;
      this.game.mouseTileY = tile.ty;
    }

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
    this.game.playerParty.vx = 0;
    this.game.playerParty.vy = 0;
    this.game.playerParty.moveState = 'arrived';
    return true;
  }

  // WorldGenManager delegates:
  ensureWorldGenerated(seed) { return this.genManager.ensureWorldGenerated(seed); }
  rebuildMovementMasks() { return this.genManager.rebuildMovementMasks(); }
  updateFogFromPlayer() { return this.genManager.updateFogFromPlayer(); }
  getMovementContextAt(x, y) { return this.genManager.getMovementContextAt(x, y); }
  getBiomeKeyAtTile(tx, ty) { return this.genManager.getBiomeKeyAtTile(tx, ty); }
  getNearestSettlementAt(tx, ty) { return this.genManager.getNearestSettlementAt(tx, ty); }
  getNearestSettlementTierAt(tx, ty) { return this.genManager.getNearestSettlementTierAt(tx, ty); }
  findNearestCityId(x, y, radiusTiles = null) { return this.genManager.findNearestCityId(x, y, radiusTiles); }

  // WorldSimManager delegates:
  initEnemyParties() { return this.simManager.initEnemyParties(); }
  initPlayerParty() { return this.simManager.initPlayerParty(); }
  ensureRosterState() { return this.simManager.ensureRosterState(); }
  computeEncounterRiskContext() { return this.simManager.computeEncounterRiskContext(); }
  tryTriggerEncounter() { return this.simManager.tryTriggerEncounter(); }
  triggerEncounter(enemy, context = {}) { return this.simManager.triggerEncounter(enemy, context); }
  processWorldAiEncounters(encounters = []) { return this.simManager.processWorldAiEncounters(encounters); }
  checkSurpriseEncounters(options = {}) { return this.simManager.worldPartyManager?.checkSurpriseEncounters(options) || false; }
  updateTransientUIState() { return this.simManager.updateTransientUIState(); }
  updatePlayerParty(dt) { return this.simManager.updatePlayerParty(dt); }
  updateEnemyParties(dt) { return this.simManager.updateEnemyParties(dt); }
  updateMapSimulation(dt) { return this.simManager.updateMapSimulation(dt); }
  cleanupTemporaryEnemy(enemyId, opts) { return this.simManager.cleanupTemporaryEnemy(enemyId, opts); }
  despawnEnemyParty(enemyId) { return this.simManager.despawnEnemyParty(enemyId); }
  getRegionIdAtTile(tx, ty) { return this.simManager.getRegionIdAtTile(tx, ty); }
  getCurrentRegionContext() { return this.simManager.getCurrentRegionContext(); }
  getCurrentRegionModifiers(day) { return this.simManager.getCurrentRegionModifiers(day); }
  getWorldAiCfgWithRegionMods() { return this.simManager.getWorldAiCfgWithRegionMods(); }
  getRenownGainMultAtCurrentRegion() { return this.simManager.getRenownGainMultAtCurrentRegion(); }
  getBanditCapWithEvents(worldEvents) { return this.simManager.getBanditCapWithEvents(worldEvents); }
}
