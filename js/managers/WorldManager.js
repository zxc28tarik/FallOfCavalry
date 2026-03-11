import * as CONST from '../constants.js';
import { createInitialWorldAiState } from '../systems/world-ai.js';
import { createInitialRegionState } from '../systems/region-state.js';
import { WorldGenManager } from './WorldGenManager.js';
import { WorldSimManager } from './WorldSimManager.js';

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
  }

  init(game) {
    this.game = game;
    if (!this.state.regionState || typeof this.state.regionState !== 'object')
      this.state.regionState = createInitialRegionState();
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
  triggerEncounter(enemy) { return this.simManager.triggerEncounter(enemy); }
  processWorldAiEncounters(encounters = []) { return this.simManager.processWorldAiEncounters(encounters); }
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
