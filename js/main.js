/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';
import HUDManager from './ui/hud.js';
import SaveSystem from './systems/save-system.js';
import AudioSystem from './systems/audio-system.js';
import * as CONST from './constants.js';

import * as utils from './utils.js';

const ROOT_SCOPE = typeof window !== 'undefined' ? window : globalThis;
const GLOBAL_KEYS = {
  game: '__fallOfCavalryGameInstance__',
  bootstrapWarned: '__fallOfCavalryBootstrapWarned__',
  domReadyBound: '__fallOfCavalryDomReadyBound__',
};

function warnBootstrapOnce(message) {
  if (ROOT_SCOPE[GLOBAL_KEYS.bootstrapWarned]) return;
  ROOT_SCOPE[GLOBAL_KEYS.bootstrapWarned] = true;
  console.warn(message);
}

class FallOfCavalry {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = null;
    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    this.saveSystem = null;
    this.audioSystem = null;

    this.mode = 'menu'; // menu | playing | paused
    this.dom = {};

    this.resizeHandler = null;
    this.keyboardHandler = null;
    this.partyPointerHandler = null;
    this.partyPointerMoveHandler = null;
    this.partyPointerUpHandler = null;
    this.partyContextMenuHandler = null;

    this.rightPointerTracking = false;
    this.rightPointerMoved = false;
    this.rightPointerStartX = 0;
    this.rightPointerStartY = 0;
    this.mouseWorldX = 0;
    this.mouseWorldY = 0;

    this.playerParty = null;
    this.enemyParties = [];
    this.lastEncounterEndTimeByEnemyId = {};
    this.encounterMargin = 10;
    this.encounterCooldownMs = 3000;
    this.encounterPushbackDistance = 64;
    this.defeatPushbackDistance = 120;
    this.maxUnitsToDeploy = 6;
    this.playerRoster = [];
    this.enemyRoster = [];
    this.rosterCursorIndex = 0;
    this.enemyUnitsById = {};
    this.itemCatalog = [
      { id: 'grain', name: 'Grain', basePrice: 6 },
      { id: 'meat', name: 'Meat', basePrice: 10 },
      { id: 'ore', name: 'Iron Ore', basePrice: 18 },
      { id: 'cloth', name: 'Cloth', basePrice: 14 },
      { id: 'timber', name: 'Timber', basePrice: 9 },
      { id: 'herbs', name: 'Herbs', basePrice: 11 },
      { id: 'wine', name: 'Wine', basePrice: 16 },
    ];
    this.cityTab = 'recruit';
    this.cityOffers = [];
    this.battleAftermath = null;
    this.battleProjectiles = [];
    this.battleRecoveryTimer = 0;
    this.battleDragUnitId = null;
    this.battleDragOffsetX = 0;
    this.battleDragOffsetY = 0;
    this.followParty = false;

    this.started = false;
    this.initialized = false;
    this.listenersBound = false;
    this.warnedKeys = new Set();

    console.log('🎮 FallOfCavalry - Initializing...');
    this.init();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    console.warn(message);
  }

  init() {
    if (this.initialized) {
      this.warnOnce('game:init-duplicate', '[Game] init() already completed');
      return true;
    }

    this.canvas = utils.getEl('gameCanvas');
    if (!this.canvas || typeof this.canvas.getContext !== 'function') {
      this.warnOnce('game:missing-canvas', '[Game] Canvas unavailable; game init skipped');
      return false;
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      this.warnOnce('game:missing-context', '[Game] Canvas 2D context unavailable; game init skipped');
      return false;
    }

    this.state = this.state || new GameState();
    this.input = this.input || new InputManager(this.canvas);
    this.gameLoop = this.gameLoop || new GameLoop(this.state, this.input, null);
    this.hudManager = this.hudManager || new HUDManager(this.state);
    this.saveSystem = this.saveSystem || new SaveSystem();
    this.audioSystem = this.audioSystem || new AudioSystem();

    this.setupCanvas();
    this.setupEventListeners();
    this.initPlayerParty();
    this.setupPartyInputHandlers();
    this.setupDOMReferences();
    this.setupMenuActions();
    this.enterMenu();

    if (typeof window !== 'undefined') {
      window.game = this;
      window.STATE = this.state;
    }

    this.initialized = true;
    console.log('✅ FallOfCavalry - Ready!');
    return true;
  }

  setupCanvas() {
    if (this.resizeHandler || !this.canvas) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const resize = () => {
      this.canvas.width = typeof window.innerWidth === 'number' ? window.innerWidth : this.canvas.width;
      this.canvas.height = typeof window.innerHeight === 'number' ? window.innerHeight : this.canvas.height;
      console.log(`[Canvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    };

    this.resizeHandler = resize;
    resize();
    window.addEventListener('resize', resize);
  }

  setupEventListeners() {
    if (this.listenersBound || !this.state) return;

    this.state.on('mode:changed', ({ old, new: newMode }) => this.onModeChanged(old, newMode));
    this.state.on('day:advanced', (day) => console.log(`[Game] Day ${day} started`));
    this.state.on('player:gold:changed', ({ old, new: newGold, delta }) => {
      console.log(`[Game] Gold: ${old} → ${newGold} (${delta >= 0 ? '+' : ''}${delta})`);
    });

    this.state.on('render:start', () => this.renderStart());
    this.state.on('render:map', () => this.renderMap());
    this.state.on('render:city', () => this.renderCity());
    this.state.on('render:battle', () => this.renderBattle());
    this.state.on('render:encounter', () => this.renderEncounter());
    this.state.on('map:update', (dt) => this.updateMapSimulation(dt));
    this.state.on('encounter:update', () => this.updateTransientUIState());
    this.state.on('battle:update', (dt) => this.updateBattleSimulation(dt));
    this.state.on('city:update', () => this.updateTransientUIState());

    this.setupKeyboardShortcuts();
    this.listenersBound = true;
  }

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

  clampCameraToWorld() {
    const camera = this.getCameraSafe();
    const bounds = this.getWorldBounds();
    if (!this.canvas || !Number.isFinite(this.canvas.width) || !Number.isFinite(this.canvas.height)) {
      return camera;
    }

    const zoom = Math.max(0.5, Math.min(2.5, camera.zoom));
    camera.zoom = zoom;

    const viewW = this.canvas.width / zoom;
    const viewH = this.canvas.height / zoom;

    const maxCameraX = Math.max(bounds.minX, bounds.maxX - viewW);
    const maxCameraY = Math.max(bounds.minY, bounds.maxY - viewH);

    camera.x = Math.max(bounds.minX, Math.min(maxCameraX, camera.x));
    camera.y = Math.max(bounds.minY, Math.min(maxCameraY, camera.y));
    return camera;
  }

  centerCameraOnParty() {
    if (!this.playerParty || !this.canvas) return false;

    const camera = this.getCameraSafe();
    const zoom = Math.max(0.5, Math.min(2.5, camera.zoom));
    const halfW = this.canvas.width / zoom / 2;
    const halfH = this.canvas.height / zoom / 2;

    camera.x = this.playerParty.x - halfW;
    camera.y = this.playerParty.y - halfH;
    this.clampCameraToWorld();
    return true;
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

  updatePointerWorldState(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    this.mouseWorldX = world.x;
    this.mouseWorldY = world.y;

    if (this.playerParty) {
      this.playerParty.hovered = this.isWorldPointOnParty(world.x, world.y);
    }

    return world;
  }

  initPlayerParty() {
    if (this.playerParty) return;

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

    this.playerParty = fallback;
    if (!Number.isFinite(this.playerParty.gold)) this.playerParty.gold = 0;
    if (!Number.isFinite(this.playerParty.xp)) this.playerParty.xp = 0;
    if (!Number.isFinite(this.playerParty.morale)) this.playerParty.morale = 64;
    if (!Array.isArray(this.playerParty.roster) || this.playerParty.roster.length === 0) {
      this.playerParty.roster = [
        { id: 'militia', name: 'Militia', count: 12, wounded: 2 },
        { id: 'archers', name: 'Archers', count: 8, wounded: 1 },
        { id: 'spears', name: 'Spears', count: 10, wounded: 1 },
      ];
    }
    if (!this.playerParty.inventory || typeof this.playerParty.inventory !== 'object') {
      this.playerParty.inventory = { grain: 5, timber: 3 };
    }
    if (this.state) {
      this.state.playerParty = this.playerParty;
      if (typeof this.state.lastEventLog !== 'string') this.state.lastEventLog = '';
      if (!Number.isFinite(this.state.lastEventLogUntil)) this.state.lastEventLogUntil = 0;
    }

    this.initEnemyParties();
    this.initRosters();
  }

  initRosters() {
    if (Array.isArray(this.playerRoster) && this.playerRoster.length > 0) return;
    this.playerRoster = (this.playerParty?.roster || []).map((stack, idx) => ({
      id: stack.id,
      name: stack.name,
      type: stack.id === 'archers' ? 'ranged' : 'melee',
      count: stack.count,
      hp: 100,
      atk: stack.id === 'archers' ? 13 : 15,
      morale: this.playerParty?.morale ?? 60,
      fatigue: 10,
      injured: stack.wounded ?? 0,
      dead: (stack.count ?? 0) <= 0,
      selected: idx < 2,
    }));
    this.enemyRoster = [];

    if (this.state) {
      this.state.roster = {
        warning: '',
        enemyId: null,
      };
    }
  }

  getEnemyUnits(enemyId) {
    if (Array.isArray(this.enemyUnitsById[enemyId])) return this.enemyUnitsById[enemyId];
    const seedBase = enemyId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 17);
    const count = 4 + (seedBase % 4);
    const units = Array.from({ length: count }, (_, idx) => {
      const ranged = ((seedBase + idx) % 3) === 0;
      return {
        id: `${enemyId}-u${idx + 1}`,
        name: ranged ? `Raider Bow ${idx + 1}` : `Raider ${idx + 1}`,
        type: ranged ? 'ranged' : 'melee',
        count: 1,
        hp: ranged ? 80 : 100,
        atk: ranged ? 12 : 14,
        morale: 54 + ((seedBase + idx) % 16),
        fatigue: 8 + ((seedBase + (idx * 3)) % 12),
        injured: 0,
      };
    });
    this.enemyUnitsById[enemyId] = units;
    return units;
  }

  getEffectiveCount(entry) {
    if (!entry) return 0;
    const count = Number.isFinite(entry.count) ? entry.count : 0;
    const injured = Number.isFinite(entry.injured) ? entry.injured : 0;
    return Math.max(0, count - injured);
  }

  initEnemyParties() {
    if (!this.state) return;

    if (Array.isArray(this.state.aiParties) && this.state.aiParties.length > 0) {
      this.enemyParties = this.state.aiParties;
      return;
    }

    const bounds = this.getWorldBounds();
    const mapSpanX = Math.max(200, bounds.maxX - bounds.minX);
    const mapSpanY = Math.max(200, bounds.maxY - bounds.minY);
    const baseX = bounds.minX + mapSpanX * 0.35;
    const baseY = bounds.minY + mapSpanY * 0.35;

    this.enemyParties = [
      { id: 'enemy-1', x: baseX, y: baseY, radius: 12, speed: 40, vx: 0.45, vy: 0.3 },
      { id: 'enemy-2', x: baseX + 320, y: baseY + 120, radius: 12, speed: 35, vx: -0.35, vy: 0.38 },
      { id: 'enemy-3', x: baseX + 140, y: baseY + 360, radius: 12, speed: 30, vx: 0.32, vy: -0.4 },
    ];
    this.state.aiParties = this.enemyParties;
  }

  updateMapSimulation(dt) {
    this.updateTransientUIState();
    this.updatePlayerParty(dt);
    this.updateEnemyParties(dt);
    this.tryTriggerEncounter();

    if (Number.isFinite(dt) && dt > 0) {
      this.battleRecoveryTimer += dt;
      if (this.battleRecoveryTimer >= 1) {
        this.battleRecoveryTimer = 0;
        (this.playerParty?.roster || []).forEach((stack) => {
          if (!Number.isFinite(stack.wounded) || stack.wounded <= 0) return;
          if (Math.random() < 0.15) {
            stack.wounded = Math.max(0, stack.wounded - 1);
          }
        });
      }
    }
  }

  updateTransientUIState() {
    if (!this.state) return;
    if (this.state.lastEventLog && Date.now() >= (this.state.lastEventLogUntil ?? 0)) {
      this.state.lastEventLog = '';
      this.state.lastEventLogUntil = 0;
    }

    if (this.state.mode === 'roster') {
      this.state.playerRoster = this.playerRoster.map((unit) => ({
        ...unit,
        effectiveCount: this.getEffectiveCount(unit),
      }));
      this.state.enemyRoster = this.enemyRoster.map((unit) => ({
        ...unit,
        effectiveCount: this.getEffectiveCount(unit),
      }));
      this.state.rosterCursorIndex = this.rosterCursorIndex;
      this.state.rosterSelectedCount = this.getSelectedRosterCount();
      this.state.rosterPowerPlayer = this.state.playerRoster.reduce((sum, unit) => sum + (unit.effectiveCount * ((unit.atk ?? 10) + 8)), 0);
      this.state.rosterPowerEnemy = this.state.enemyRoster.reduce((sum, unit) => sum + (unit.effectiveCount * ((unit.atk ?? 10) + 8)), 0);
    }

    if (this.state.mode === 'city') {
      this.state.uiPanel = this.buildCityPanelData();
    }

    if (this.state.mode === 'aftermath') {
      this.state.uiPanel = this.buildAftermathPanelData();
    }

    this.hudManager?.update?.();
  }

  updateBattleSimulation(dt) {
    if (this.state?.mode !== 'battle') return;

    if (this.mode === 'paused') {
      this.updateTransientUIState();
      return;
    }

    if (Number.isFinite(dt) && dt > 0 && this.state) {
      this.state.battleLastDt = dt;
    }

    this.updateTransientUIState();
  }

  updatePlayerParty(dt) {
    if (!this.playerParty || !Number.isFinite(dt) || dt <= 0) return;

    if (this.playerParty.arrivalFeedbackTimer > 0) {
      this.playerParty.arrivalFeedbackTimer = Math.max(0, this.playerParty.arrivalFeedbackTimer - dt);
    }

    if (this.followParty) {
      this.centerCameraOnParty();
    }

    if (this.mode === 'paused' || this.state?.mode !== 'map') return;

    if (!this.playerParty.hasDestination) return;

    const dx = this.playerParty.destX - this.playerParty.x;
    const dy = this.playerParty.destY - this.playerParty.y;
    const dist = Math.hypot(dx, dy);
    const epsilon = 2;

    if (dist <= epsilon) {
      this.completePlayerArrival();
      return;
    }

    const step = this.playerParty.speed * dt;
    if (step >= dist) {
      this.completePlayerArrival();
      return;
    }

    this.playerParty.x += (dx / dist) * step;
    this.playerParty.y += (dy / dist) * step;

    const clamped = this.clampToWorld(this.playerParty.x, this.playerParty.y);
    this.playerParty.x = clamped.x;
    this.playerParty.y = clamped.y;

    if (this.followParty) {
      this.centerCameraOnParty();
    }
  }

  updateEnemyParties(dt) {
    if (!Array.isArray(this.enemyParties) || this.enemyParties.length === 0) return;
    if (!Number.isFinite(dt) || dt <= 0 || this.state?.mode !== 'map') return;

    const bounds = this.getWorldBounds();
    const driftRate = 0.15;

    this.enemyParties.forEach((enemy, index) => {
      if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;

      const wobble = (this.state.timeSec * 0.65) + (index * 1.37);
      enemy.vx = (enemy.vx ?? 0) + Math.sin(wobble) * driftRate * dt;
      enemy.vy = (enemy.vy ?? 0) + Math.cos(wobble * 1.11) * driftRate * dt;

      const speedLen = Math.hypot(enemy.vx, enemy.vy) || 1;
      enemy.vx /= speedLen;
      enemy.vy /= speedLen;

      const speed = Number.isFinite(enemy.speed) ? enemy.speed : 35;
      const radius = Number.isFinite(enemy.radius) ? enemy.radius : 12;
      enemy.x += enemy.vx * speed * dt;
      enemy.y += enemy.vy * speed * dt;

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

  tryTriggerEncounter() {
    if (this.state?.mode !== 'map' || !this.playerParty || !Array.isArray(this.enemyParties)) return false;
    if (this.state.encounter) return false;

    const now = Date.now();
    for (const enemy of this.enemyParties) {
      if (!enemy?.id) continue;

      const cooldownUntil = this.lastEncounterEndTimeByEnemyId[enemy.id] ?? 0;
      if (now - cooldownUntil < this.encounterCooldownMs) continue;

      const dist = Math.hypot(this.playerParty.x - enemy.x, this.playerParty.y - enemy.y);
      const triggerDist = (this.playerParty.radius ?? 12) + (enemy.radius ?? 12) + this.encounterMargin;
      if (dist > triggerDist) continue;

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
    return true;
  }

  resolveEncounter(action) {
    const encounter = this.state?.encounter;
    if (!encounter?.enemyId || this.state?.mode !== 'encounter') return false;

    const enemy = this.enemyParties.find((party) => party.id === encounter.enemyId);
    if (action === 'fight') {
      this.enterRoster(encounter.enemyId);
      return true;
    }

    this.finishEncounterToMap(enemy, encounter.enemyId);
    return true;
  }

  enterRoster(enemyId) {
    if (!this.state || this.state.mode !== 'encounter') return false;
    this.initRosters();
    this.playerRoster = (this.playerParty?.roster || []).map((stack, idx) => ({
      id: stack.id,
      name: stack.name,
      type: stack.id === 'archers' ? 'ranged' : 'melee',
      count: stack.count,
      hp: 100,
      atk: stack.id === 'archers' ? 13 : 15,
      morale: this.playerParty?.morale ?? 60,
      fatigue: 8 + idx,
      injured: stack.wounded ?? 0,
      dead: (stack.count ?? 0) <= 0,
      selected: false,
    }));
    this.enemyRoster = this.getEnemyUnits(enemyId).map((unit) => ({ ...unit, selected: true }));
    this.rosterCursorIndex = 0;
    this.playerRoster.forEach((unit, idx) => {
      unit.selected = idx < Math.min(3, this.maxUnitsToDeploy) && this.getEffectiveCount(unit) > 0 && !unit.dead;
    });

    if (!this.state.roster || typeof this.state.roster !== 'object') {
      this.state.roster = {};
    }

    this.state.roster.enemyId = enemyId;
    this.state.roster.warning = '';
    this.state.setMode('roster');
    this.updateTransientUIState();
    return true;
  }

  finishEncounterToMap(enemy, enemyId) {
    this.applyEncounterPushback(enemy);
    this.lastEncounterEndTimeByEnemyId[enemyId] = Date.now();
    if (this.state) {
      this.state.encounter = null;
      this.state.setMode('map');
    }
  }

  applyEncounterPushback(enemy) {
    if (!this.playerParty || !enemy) return;

    let dx = this.playerParty.x - enemy.x;
    let dy = this.playerParty.y - enemy.y;
    let dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      const angleSeed = (enemy.id?.length ?? 1) * 0.73;
      dx = Math.cos(angleSeed);
      dy = Math.sin(angleSeed);
      dist = 1;
    }

    const ux = dx / dist;
    const uy = dy / dist;
    const halfPush = this.encounterPushbackDistance / 2;

    const playerTarget = this.clampToWorld(
      this.playerParty.x + ux * halfPush,
      this.playerParty.y + uy * halfPush,
    );
    const enemyTarget = this.clampToWorld(
      enemy.x - ux * halfPush,
      enemy.y - uy * halfPush,
    );

    this.playerParty.x = playerTarget.x;
    this.playerParty.y = playerTarget.y;
    enemy.x = enemyTarget.x;
    enemy.y = enemyTarget.y;
  }

  confirmRosterSelection() {
    if (!this.state || this.state.mode !== 'roster') return false;
    const selected = this.playerRoster.filter((unit) => unit.selected && this.getEffectiveCount(unit) > 0);
    if (selected.length < 1) {
      this.state.roster.warning = 'Select at least 1 unit to deploy.';
      this.updateTransientUIState();
      return false;
    }

    const enemyId = this.state.roster?.enemyId ?? this.state.encounter?.enemyId ?? 'enemy-unknown';
    const playerUnits = this.createBattleUnitsFromRoster(selected, 'player');
    const enemyUnits = this.createBattleUnitsFromRoster(this.enemyRoster, 'enemy');
    const units = [...playerUnits, ...enemyUnits];

    this.placeBattleUnits(units, 'player');
    this.placeBattleUnits(units, 'enemy');

    this.cancelPlayerDestination();
    this.state.encounter = null;
    this.state.roster.warning = '';
    this.state.battle = {
      enemyId,
      phase: 'deploy',
      startedAt: Date.now(),
      units,
      log: [],
      ended: false,
      result: null,
      reward: null,
      resolvedAt: 0,
    };

    this.state.setMode('battle');
    this.updateTransientUIState();
    return true;
  }

  createBattleUnitsFromRoster(roster, side) {
    return (roster || [])
      .map((entry) => {
        const effectiveCount = this.getEffectiveCount(entry);
        if (effectiveCount <= 0) return null;
        return {
          id: `${side}-${entry.id}`,
          side,
          name: entry.name,
          type: entry.type,
          count: effectiveCount,
          hp: entry.hp,
          morale: entry.morale,
          x: 0,
          y: 0,
          tx: 0,
          ty: 0,
          cooldown: 0,
          alive: true,
        };
      })
      .filter(Boolean);
  }

  placeBattleUnits(units, side) {
    const sideUnits = (units || []).filter((unit) => unit.side === side);
    if (sideUnits.length === 0) return;

    const width = Number.isFinite(this.canvas?.width) ? this.canvas.width : 1280;
    const height = Number.isFinite(this.canvas?.height) ? this.canvas.height : 720;
    const x = side === 'player' ? Math.max(80, width * 0.22) : Math.min(width - 80, width * 0.78);
    const minY = 120;
    const maxY = Math.max(minY + 1, height - 120);
    const spacing = sideUnits.length > 1 ? (maxY - minY) / (sideUnits.length - 1) : 0;

    sideUnits.forEach((unit, idx) => {
      const y = minY + (spacing * idx);
      unit.x = x;
      unit.y = Math.max(minY, Math.min(maxY, y));
      unit.tx = unit.x;
      unit.ty = unit.y;
    });
  }

  getSelectedRosterCount() {
    return this.playerRoster.reduce((total, unit) => total + (unit.selected ? 1 : 0), 0);
  }

  moveRosterCursor(delta) {
    if (!Array.isArray(this.playerRoster) || this.playerRoster.length === 0) return false;
    const next = this.rosterCursorIndex + delta;
    this.rosterCursorIndex = Math.max(0, Math.min(this.playerRoster.length - 1, next));
    this.updateTransientUIState();
    return true;
  }

  toggleRosterSelectionAtCursor() {
    if (!Array.isArray(this.playerRoster) || this.playerRoster.length === 0) return false;
    const unit = this.playerRoster[this.rosterCursorIndex];
    if (!unit || this.getEffectiveCount(unit) <= 0) return false;

    if (unit.selected) {
      unit.selected = false;
      if (this.state?.roster) this.state.roster.warning = '';
      this.updateTransientUIState();
      return true;
    }

    const selected = this.getSelectedRosterCount();
    if (selected >= this.maxUnitsToDeploy) {
      if (this.state?.roster) this.state.roster.warning = `Deploy limit reached (${this.maxUnitsToDeploy}).`;
      this.updateTransientUIState();
      return false;
    }

    unit.selected = true;
    if (this.state?.roster) this.state.roster.warning = '';
    this.updateTransientUIState();
    return true;
  }

  getItemName(itemId) {
    return this.itemCatalog.find((item) => item.id === itemId)?.name || itemId;
  }

  addInventoryItem(itemId, qty) {
    if (!itemId || !Number.isFinite(qty) || qty <= 0) return false;
    const inv = this.playerParty?.inventory;
    if (!inv) return false;
    inv[itemId] = (inv[itemId] ?? 0) + qty;
    return true;
  }

  removeInventoryItem(itemId, qty) {
    const inv = this.playerParty?.inventory;
    if (!inv || !Number.isFinite(qty) || qty <= 0) return false;
    const current = inv[itemId] ?? 0;
    if (current < qty) return false;
    inv[itemId] = current - qty;
    if (inv[itemId] <= 0) delete inv[itemId];
    return true;
  }

  buildAftermathPanelData() {
    const a = this.battleAftermath;
    if (!a) return { title: 'Aftermath', body: 'No aftermath data', footer: 'Enter to return to map' };
    const rosterLines = (this.playerParty?.roster || []).map((r) => `- ${r.name}: ${r.count} (wounded ${r.wounded})`).join('\n');
    const lootLines = (a.loot || []).length
      ? a.loot.map((l) => `+ ${l.qty} ${this.getItemName(l.itemId)}`).join('\n')
      : 'No loot';
    return {
      title: `Aftermath: ${a.result.toUpperCase()}`,
      body: `Losses\nKilled: ${a.killed} | Wounded: ${a.wounded}\n\nRoster\n${rosterLines}\n\nLoot\n${lootLines}\nGold: +${a.goldReward}`,
      footer: 'Press Enter (or Esc) to return to map',
    };
  }

  buildCityPanelData() {
    const tab = this.cityTab;
    if (!Array.isArray(this.cityOffers) || this.cityOffers.length === 0) {
      this.cityOffers = [
        { id: 'militia', name: 'Militia', cost: 18, count: 3 },
        { id: 'archers', name: 'Archers', cost: 24, count: 2 },
        { id: 'spears', name: 'Spears', cost: 26, count: 2 },
      ];
    }

    if (tab === 'recruit') {
      const lines = this.cityOffers.map((offer, i) => `${i + 1}) ${offer.name} +${offer.count} (${offer.cost}g)`).join('\n');
      return { title: 'City - Recruit', body: `${lines}\n\nPress Q/W/E to recruit`, footer: 'Tabs: 1 Recruit, 2 Market, 3 Inn, 4 Craft | Esc exits city' };
    }

    if (tab === 'market') {
      const buyLines = this.itemCatalog.map((item, i) => `${i + 1}) Buy ${item.name} (${item.basePrice}g)`).join('\n');
      const invLines = Object.entries(this.playerParty?.inventory || {}).map(([id, qty], i) => `${i + 1}) Sell ${this.getItemName(id)} x${qty}`).join('\n') || 'No inventory';
      return { title: 'City - Market', body: `Buy\n${buyLines}\n\nSell\n${invLines}\n\nPress B then number to buy, S then number to sell`, footer: 'Tabs: 1 Recruit, 2 Market, 3 Inn, 4 Craft | Esc exits city' };
    }

    if (tab === 'inn') {
      const wounded = (this.playerParty?.roster || []).reduce((s, r) => s + (r.wounded || 0), 0);
      const healCost = wounded * 4;
      return { title: 'City - Inn', body: `Wounded soldiers: ${wounded}\nHeal cost: ${healCost}g\n\nPress H to heal wounded`, footer: 'Tabs: 1 Recruit, 2 Market, 3 Inn, 4 Craft | Esc exits city' };
    }

    return { title: 'City - Craft', body: 'Crafting coming soon.', footer: 'Tabs: 1 Recruit, 2 Market, 3 Inn, 4 Craft | Esc exits city' };
  }

  recruitOffer(index) {
    const offer = this.cityOffers[index];
    if (!offer) return false;
    if ((this.playerParty?.gold ?? 0) < offer.cost) {
      this.setLastEventLog('Not enough gold for recruitment');
      return false;
    }
    this.playerParty.gold -= offer.cost;
    const stack = (this.playerParty.roster || []).find((unit) => unit.id === offer.id);
    if (stack) {
      stack.count += offer.count;
    } else {
      this.playerParty.roster.push({ id: offer.id, name: offer.name, count: offer.count, wounded: 0 });
    }
    this.setLastEventLog(`Recruited ${offer.name} +${offer.count}`);
    return true;
  }

  buyMarketItem(index) {
    const item = this.itemCatalog[index];
    if (!item) return false;
    if ((this.playerParty?.gold ?? 0) < item.basePrice) {
      this.setLastEventLog('Not enough gold to buy item');
      return false;
    }
    this.playerParty.gold -= item.basePrice;
    this.addInventoryItem(item.id, 1);
    this.setLastEventLog(`Bought ${item.name}`);
    return true;
  }

  sellMarketItem(index) {
    const entries = Object.entries(this.playerParty?.inventory || {});
    const entry = entries[index];
    if (!entry) return false;
    const [itemId] = entry;
    const item = this.itemCatalog.find((it) => it.id === itemId);
    if (!item) return false;
    const sellPrice = Math.max(1, Math.floor(item.basePrice * 0.7));
    if (!this.removeInventoryItem(itemId, 1)) return false;
    this.playerParty.gold += sellPrice;
    this.setLastEventLog(`Sold ${item.name}`);
    return true;
  }

  healWoundedAtInn() {
    const wounded = (this.playerParty?.roster || []).reduce((sum, stack) => sum + (stack.wounded || 0), 0);
    const cost = wounded * 4;
    if (wounded <= 0) {
      this.setLastEventLog('No wounded to heal');
      return false;
    }
    if ((this.playerParty?.gold ?? 0) < cost) {
      this.setLastEventLog('Not enough gold for healing');
      return false;
    }
    this.playerParty.gold -= cost;
    (this.playerParty.roster || []).forEach((stack) => { stack.wounded = 0; });
    this.playerParty.morale = Math.min(100, (this.playerParty.morale ?? 60) + 4);
    this.setLastEventLog('Wounded healed at inn');
    return true;
  }

  applyAftermathToRoster(result) {
    const roster = this.playerParty?.roster || [];
    const total = roster.reduce((sum, stack) => sum + Math.max(0, stack.count || 0), 0);
    const killedRange = result === 'victory' ? [1, 3] : result === 'retreat' ? [2, 5] : [4, 8];
    const woundedRange = result === 'victory' ? [1, 3] : result === 'retreat' ? [2, 5] : [4, 9];
    let killed = Math.min(total, killedRange[0] + Math.floor(Math.random() * (killedRange[1] - killedRange[0] + 1)));
    let wounded = Math.min(total, woundedRange[0] + Math.floor(Math.random() * (woundedRange[1] - woundedRange[0] + 1)));

    for (const stack of roster) {
      if (killed <= 0) break;
      const healthy = Math.max(0, (stack.count || 0) - (stack.wounded || 0));
      const take = Math.min(healthy, killed);
      stack.count -= take;
      killed -= take;
    }

    for (const stack of roster) {
      if (killed <= 0) break;
      const take = Math.min(stack.wounded || 0, killed);
      stack.wounded -= take;
      stack.count -= take;
      killed -= take;
    }

    for (const stack of roster) {
      if (wounded <= 0) break;
      const healthy = Math.max(0, (stack.count || 0) - (stack.wounded || 0));
      const take = Math.min(healthy, wounded);
      stack.wounded += take;
      wounded -= take;
    }

    return {
      killed: Math.max(0, total - roster.reduce((sum, stack) => sum + Math.max(0, stack.count || 0), 0)),
      wounded: roster.reduce((sum, stack) => sum + Math.max(0, stack.wounded || 0), 0),
    };
  }

  generateBattleLoot(result) {
    if (result !== 'victory') return { loot: [], gold: result === 'retreat' ? Math.floor(Math.random() * 4) : 0 };
    const lootCount = 2 + Math.floor(Math.random() * 4);
    const loot = [];
    for (let i = 0; i < lootCount; i += 1) {
      const item = this.itemCatalog[(i + Math.floor(Math.random() * this.itemCatalog.length)) % this.itemCatalog.length];
      const qty = 1 + Math.floor(Math.random() * 3);
      loot.push({ itemId: item.id, qty });
      this.addInventoryItem(item.id, qty);
    }
    return { loot, gold: 10 + Math.floor(Math.random() * 16) };
  }

  resolveBattle(result) {
    if (!this.state || this.state.mode !== 'battle') return false;
    const battle = this.state.battle;
    if (!battle?.enemyId || battle.result) return false;

    const enemyId = battle.enemyId;
    battle.ended = true;
    battle.result = result;
    battle.resolvedAt = Date.now();

    const losses = this.applyAftermathToRoster(result);
    const lootResult = this.generateBattleLoot(result);
    const xpReward = result === 'victory' ? (8 + Math.floor(Math.random() * 11)) : result === 'retreat' ? (2 + Math.floor(Math.random() * 5)) : 0;
    this.playerParty.gold += lootResult.gold;
    this.playerParty.xp += xpReward;
    const moraleDelta = result === 'victory' ? (5 + Math.floor(Math.random() * 6)) : result === 'retreat' ? -(5 + Math.floor(Math.random() * 6)) : -(10 + Math.floor(Math.random() * 11));
    this.playerParty.morale = Math.max(0, Math.min(100, (this.playerParty.morale ?? 60) + moraleDelta));

    this.battleAftermath = {
      enemyId,
      result,
      killed: losses.killed,
      wounded: losses.wounded,
      loot: lootResult.loot,
      goldReward: lootResult.gold,
      xpReward,
      moraleDelta,
    };

    this.state.uiPanel = this.buildAftermathPanelData();
    this.state.setMode('aftermath');
    return true;
  }

  exitAftermathToMap() {
    if (!this.state || this.state.mode !== 'aftermath' || !this.battleAftermath) return false;
    const enemyId = this.battleAftermath.enemyId;
    const result = this.battleAftermath.result;
    const enemy = this.enemyParties.find((party) => party?.id === enemyId) || null;

    if (result === 'victory') {
      this.despawnEnemyParty(enemyId);
      this.applyBattleExit(enemy, enemyId, this.encounterPushbackDistance);
      this.setLastEventLog(`Victory vs ${enemyId} (+${this.battleAftermath.goldReward}g, +${this.battleAftermath.xpReward}xp)`);
    } else if (result === 'defeat') {
      this.cancelPlayerDestination();
      this.applyBattleExit(enemy, enemyId, this.defeatPushbackDistance);
      this.setLastEventLog(`Defeated by ${enemyId}`);
    } else {
      this.applyBattleExit(enemy, enemyId, this.encounterPushbackDistance);
      this.setLastEventLog(`Retreated from ${enemyId}`);
    }

    this.state.uiPanel = null;
    this.battleAftermath = null;
    this.state.setMode('map');
    return true;
  }

  applyBattleExit(enemy, enemyId, pushbackDistance) {
    if (Number.isFinite(pushbackDistance) && pushbackDistance > 0) {
      const previousDistance = this.encounterPushbackDistance;
      this.encounterPushbackDistance = pushbackDistance;
      this.applyEncounterPushback(enemy);
      this.encounterPushbackDistance = previousDistance;
    }

    this.lastEncounterEndTimeByEnemyId[enemyId] = Date.now();
    this.state.battle = null;
  }

  despawnEnemyParty(enemyId) {
    if (!enemyId || !Array.isArray(this.enemyParties)) return false;
    const idx = this.enemyParties.findIndex((party) => party?.id === enemyId);
    if (idx === -1) return false;
    this.enemyParties.splice(idx, 1);

    if (Array.isArray(this.state?.aiParties) && this.state.aiParties !== this.enemyParties) {
      const stateIdx = this.state.aiParties.findIndex((party) => party?.id === enemyId);
      if (stateIdx >= 0) this.state.aiParties.splice(stateIdx, 1);
    }
    return true;
  }

  setLastEventLog(message, durationMs = 3000) {
    if (!this.state) return;
    this.state.lastEventLog = typeof message === 'string' ? message : '';
    this.state.lastEventLogUntil = Date.now() + durationMs;
  }

  setPlayerDestination(worldX, worldY) {
    if (!this.playerParty) return false;
    if (!this.playerParty.selected) return false;
    if (this.mode === 'paused' || this.mode === 'menu' || this.state?.mode !== 'map') return false;

    const clamped = this.clampToWorld(worldX, worldY);
    this.playerParty.destX = clamped.x;
    this.playerParty.destY = clamped.y;

    const epsilon = 2;
    const dist = Math.hypot(this.playerParty.destX - this.playerParty.x, this.playerParty.destY - this.playerParty.y);
    if (dist <= epsilon) {
      this.playerParty.hasDestination = false;
      this.playerParty.destX = null;
      this.playerParty.destY = null;
      return false;
    }

    this.playerParty.hasDestination = true;
    return true;
  }

  completePlayerArrival() {
    if (!this.playerParty) return false;
    if (!Number.isFinite(this.playerParty.destX) || !Number.isFinite(this.playerParty.destY)) {
      this.cancelPlayerDestination();
      return false;
    }

    const snapped = this.clampToWorld(this.playerParty.destX, this.playerParty.destY);
    this.playerParty.x = snapped.x;
    this.playerParty.y = snapped.y;
    this.playerParty.hasDestination = false;
    this.playerParty.destX = null;
    this.playerParty.destY = null;
    this.playerParty.arrivalFeedbackTimer = 1.0;
    return true;
  }

  cancelPlayerDestination() {
    if (!this.playerParty || !this.playerParty.hasDestination) return false;
    this.playerParty.hasDestination = false;
    this.playerParty.destX = null;
    this.playerParty.destY = null;
    return true;
  }

  isWorldPointOnParty(worldX, worldY, margin = 6) {
    if (!this.playerParty) return false;
    const dist = Math.hypot(worldX - this.playerParty.x, worldY - this.playerParty.y);
    return dist <= this.playerParty.radius + margin;
  }

  setupPartyInputHandlers() {
    if (!this.canvas || this.partyPointerHandler || this.partyContextMenuHandler || this.partyPointerMoveHandler || this.partyPointerUpHandler) return;

    this.partyPointerHandler = (event) => {
      if (this.state?.mode === 'battle') {
        if (event?.button !== 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = (event?.clientX ?? 0) - rect.left;
        const y = (event?.clientY ?? 0) - rect.top;
        const hit = (this.state?.battle?.units || []).find((u) => !u.dead && u.side === 'player' && Math.hypot(u.x - x, u.y - y) <= ((u.radius ?? 10) + 8));
        if (!hit) return;
        this.state.battle.selection = this.state.battle.selection || {};
        this.state.battle.selection.unitId = hit.id;
        if (this.state?.battle?.phase === 'deploy' && this.mode !== 'paused') {
          this.battleDragUnitId = hit.id;
          this.battleDragOffsetX = x - hit.x;
          this.battleDragOffsetY = y - hit.y;
        }
        return;
      }

      if (!this.playerParty || this.mode === 'menu' || this.state?.mode !== 'map') return;

      const rect = typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = this.updatePointerWorldState(screenX, screenY);

      if (event?.button === 0) {
        if (event?.shiftKey) {
          this.setPlayerDestination(world.x, world.y);
          return;
        }

        if (this.isWorldPointOnParty(world.x, world.y)) {
          this.playerParty.selected = !this.playerParty.selected;
        } else {
          this.playerParty.selected = false;
        }
        return;
      }

      if (event?.button === 2) {
        event.preventDefault?.();
        this.rightPointerTracking = true;
        this.rightPointerMoved = false;
        this.rightPointerStartX = screenX;
        this.rightPointerStartY = screenY;
      }
    };

    this.partyPointerMoveHandler = (event) => {
      if (this.state?.mode === 'battle') {
        if (!this.battleDragUnitId || this.state?.battle?.phase !== 'deploy' || this.mode === 'paused') return;
        const unit = this.state.battle.units.find((u) => u.id === this.battleDragUnitId);
        if (!unit) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = (event?.clientX ?? 0) - rect.left - this.battleDragOffsetX;
        const y = (event?.clientY ?? 0) - rect.top - this.battleDragOffsetY;
        unit.x = Math.max(70, Math.min((this.canvas.width / 2) - 24, x));
        unit.y = Math.max(70, Math.min(this.canvas.height - 70, y));
        return;
      }

      if (!this.rightPointerTracking || !this.playerParty || this.mode === 'menu' || this.state?.mode !== 'map') return;

      const rect = typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const moved = Math.hypot(screenX - this.rightPointerStartX, screenY - this.rightPointerStartY);
      if (moved > 8) {
        this.rightPointerMoved = true;
      }
      this.updatePointerWorldState(screenX, screenY);
    };

    this.partyPointerUpHandler = (event) => {
      if (this.state?.mode === 'battle') {
        this.battleDragUnitId = null;
        this.battleDragOffsetX = 0;
        this.battleDragOffsetY = 0;
        return;
      }

      if (event?.button !== 2 || !this.rightPointerTracking || !this.playerParty || this.mode === 'menu' || this.state?.mode !== 'map') return;

      this.rightPointerTracking = false;
      if (this.rightPointerMoved) {
        this.rightPointerMoved = false;
        return;
      }

      const rect = typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = this.updatePointerWorldState(screenX, screenY);

      if (this.isWorldPointOnParty(world.x, world.y)) {
        this.cancelPlayerDestination();
        return;
      }

      this.setPlayerDestination(world.x, world.y);
    };

    this.partyContextMenuHandler = (event) => {
      event?.preventDefault?.();
    };

    this.canvas.addEventListener('mousedown', this.partyPointerHandler, { passive: false });
    this.canvas.addEventListener('mousemove', this.partyPointerMoveHandler, { passive: false });
    this.canvas.addEventListener('mouseup', this.partyPointerUpHandler, { passive: false });
    this.canvas.addEventListener('contextmenu', this.partyContextMenuHandler, { passive: false });
  }

  setupKeyboardShortcuts() {
    if (this.keyboardHandler) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    this.keyboardHandler = (e) => {
      if (!e || typeof e.key !== 'string') return;

      if (e.key === 'Enter' && this.mode === 'menu') {
        e.preventDefault?.();
        this.startNewGame();
        return;
      }

      if (e.key === 'Escape') {
        if (this.state?.mode === 'roster') {
          e.preventDefault?.();
          if (this.state.roster) this.state.roster.warning = '';
          this.state.setMode('encounter');
          this.updateTransientUIState();
          return;
        }

        if (this.state?.mode === 'battle') {
          e.preventDefault?.();
          this.togglePaused();
          return;
        }

        if (this.state?.mode === 'aftermath') {
          e.preventDefault?.();
          this.exitAftermathToMap();
          return;
        }

        if (this.state?.mode === 'city') {
          e.preventDefault?.();
          this.state.uiPanel = null;
          this.state.setMode('map');
          return;
        }

        e.preventDefault?.();
        if (this.mode === 'playing') {
          this.setPaused(true);
          return;
        }
        if (this.mode === 'paused') {
          this.setPaused(false);
          return;
        }
        if (this.mode === 'menu') {
          this.closeSettings();
        }
        return;
      }

      if (this.state?.mode === 'encounter') {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault?.();
          this.resolveEncounter('continue');
          return;
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault?.();
          this.resolveEncounter('fight');
          return;
        }
      }

      if (this.state?.mode === 'roster') {
        if (e.key === 'ArrowUp') {
          e.preventDefault?.();
          this.moveRosterCursor(-1);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault?.();
          this.moveRosterCursor(1);
          return;
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault?.();
          this.toggleRosterSelectionAtCursor();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault?.();
          this.confirmRosterSelection();
          return;
        }
      }

      if (this.state?.mode === 'battle') {
        if ((e.key === ' ' || e.key === 'Spacebar') && this.state?.battle?.phase === 'deploy') {
          e.preventDefault?.();
          this.state.battle.phase = 'fight';
          return;
        }

        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault?.();
          this.resolveBattle('victory');
          return;
        }
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault?.();
          this.resolveBattle('retreat');
          return;
        }
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault?.();
          this.resolveBattle('defeat');
          return;
        }
      }

      if (this.state?.mode === 'aftermath') {
        if (e.key === 'Enter') {
          e.preventDefault?.();
          this.exitAftermathToMap();
          return;
        }
      }

      if (this.state?.mode === 'city') {
        if (e.key === '1') { this.cityTab = 'recruit'; this.state.cityAction = null; this.updateTransientUIState(); return; }
        if (e.key === '2') { this.cityTab = 'market'; this.state.cityAction = null; this.updateTransientUIState(); return; }
        if (e.key === '3') { this.cityTab = 'inn'; this.state.cityAction = null; this.updateTransientUIState(); return; }
        if (e.key === '4') { this.cityTab = 'craft'; this.state.cityAction = null; this.updateTransientUIState(); return; }

        if (this.cityTab === 'recruit' && ['q', 'w', 'e', 'Q', 'W', 'E'].includes(e.key)) {
          e.preventDefault?.();
          const offerIndex = ['q', 'w', 'e'].indexOf(e.key.toLowerCase());
          if (offerIndex >= 0) this.recruitOffer(offerIndex);
          this.updateTransientUIState();
          return;
        }

        if (this.cityTab === 'market' && (e.key === 'b' || e.key === 'B')) {
          this.state.cityAction = 'buy';
          this.updateTransientUIState();
          return;
        }
        if (this.cityTab === 'market' && (e.key === 's' || e.key === 'S')) {
          this.state.cityAction = 'sell';
          this.updateTransientUIState();
          return;
        }

        if (this.cityTab === 'market' && /[1-9]/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (this.state.cityAction === 'buy') {
            this.buyMarketItem(idx);
          } else if (this.state.cityAction === 'sell') {
            this.sellMarketItem(idx);
          }
          this.updateTransientUIState();
          return;
        }

        if (this.cityTab === 'inn' && (e.key === 'h' || e.key === 'H')) {
          this.healWoundedAtInn();
          this.updateTransientUIState();
          return;
        }
      }

      if ((e.key === 'x' || e.key === 'Backspace') && this.mode !== 'menu' && this.state?.mode === 'map') {
        e.preventDefault?.();
        this.cancelPlayerDestination();
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && this.state?.mode === 'map') {
        e.preventDefault?.();
        this.followParty = !this.followParty;
        if (this.followParty) {
          this.centerCameraOnParty();
        }
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && this.state?.mode === 'map') {
        e.preventDefault?.();
        this.cityTab = 'recruit';
        this.state.cityAction = null;
        this.state.setMode('city');
        this.updateTransientUIState();
        return;
      }

      if (this.mode !== 'playing') return;

      if (e.key === ' ' && this.state?.mode !== 'start') {
        e.preventDefault?.();
        this.state.togglePause();
      }

      if (e.key === 'F3') {
        e.preventDefault?.();
        this.toggleDebug();
      }

      if (e.key === 'F5') {
        e.preventDefault?.();
        this.quickSave();
      }

      if (e.key === 'F9') {
        e.preventDefault?.();
        this.quickLoad();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  setupDOMReferences() {
    this.dom = {
      hud: utils.getEl('hud'),
      hudFaction: utils.getEl('hudFaction'),
      hudGold: utils.getEl('hudGold'),
      hudArmy: utils.getEl('hudArmy'),
      hudRenown: utils.getEl('hudRenown'),
      hudDay: utils.getEl('hudDay'),
      startModal: utils.getEl('startModal'),
      settlementModal: utils.getEl('settlementModal'),
      encounterModal: utils.getEl('encounterModal'),
      battleResultModal: utils.getEl('battleResultModal'),
      tooltip: utils.getEl('tooltip'),
      debugOverlay: utils.getEl('debugOverlay'),
      hudMinimapPanel: utils.getEl('hudMinimapPanel'),
      hudMiniMap: utils.getEl('hudMiniMap'),
    };

    const missing = Object.entries(this.dom).filter(([, el]) => !el).map(([key]) => key);
    if (missing.length) {
      this.warnOnce('game:missing-dom-ids', `[Game] Missing DOM ids: ${missing.join(', ')}`);
    }
  }

  onModeChanged(oldMode, newMode) {
    console.log(`[Game] Mode changed: ${oldMode} → ${newMode}`);
    if (newMode === 'start') {
      utils.safeClass(this.dom.hud, 'add', 'hidden');
      utils.safeClass(this.dom.startModal, 'remove', 'hidden');
    } else {
      utils.safeClass(this.dom.hud, 'remove', 'hidden');
      utils.safeClass(this.dom.startModal, 'add', 'hidden');
    }
  }

  setupMenuActions() {
    if (!this.hudManager || typeof this.hudManager.setMenuHandlers !== 'function') return;

    this.hudManager.setMenuHandlers({
      onStart: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onQuitToMenu: () => this.quitToMenu(),
      onSettings: () => this.openSettings(),
      onCloseSettings: () => this.closeSettings(),
      onVolumeChange: (value) => this.applyMasterVolume(value),
    });

    this.hudManager?.setRosterHandlers?.({
      onToggleUnit: (index) => {
        if (!Number.isInteger(index)) return;
        this.rosterCursorIndex = index;
        this.toggleRosterSelectionAtCursor();
      },
    });
  }

  enterMenu() {
    this.stop();
    this.mode = 'menu';

    this.hudManager?.setPaused?.(false);
    this.hudManager?.setMenuVisible?.(true);
    this.hudManager?.setSettingsVisible?.(false);

    const canContinue = Boolean(this.saveSystem?.hasSave?.());
    this.hudManager?.setContinueEnabled?.(canContinue);
    return true;
  }

  startNewGame() {
    const started = this.start();
    if (!started) return false;

    this.mode = 'playing';
    this.hudManager?.setMenuVisible?.(false);
    this.hudManager?.setSettingsVisible?.(false);
    this.hudManager?.setPaused?.(false);
    return true;
  }

  continueGame() {
    const canContinue = Boolean(this.saveSystem?.hasSave?.());
    this.hudManager?.setContinueEnabled?.(canContinue);
    if (!canContinue) return false;

    const result = this.saveSystem?.load?.();
    if (!result?.success || !result.data) return false;

    if (typeof this.saveSystem?.deserialize === 'function' && this.state) {
      this.saveSystem.deserialize(result.data, this.state);
    }

    return this.startNewGame();
  }

  openSettings() {
    if (this.mode !== 'menu') return false;
    this.hudManager?.setSettingsVisible?.(true);
    return true;
  }

  closeSettings() {
    this.hudManager?.setSettingsVisible?.(false);
    return true;
  }

  applyMasterVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return false;
    const normalized = numeric > 1 ? numeric / 100 : numeric;

    if (typeof this.audioSystem?.setMasterVolume === 'function') {
      this.audioSystem.setMasterVolume(normalized);
      return true;
    }

    if (typeof this.audioSystem?.setMusicVolume === 'function') {
      this.audioSystem.setMusicVolume(normalized);
    }
    if (typeof this.audioSystem?.setSfxVolume === 'function') {
      this.audioSystem.setSfxVolume(normalized);
    }
    return true;
  }

  quitToMenu() {
    return this.enterMenu();
  }

  start() {
    if (!this.initialized) {
      const ready = this.init();
      if (!ready) return false;
    }

    if (this.started) {
      this.warnOnce('game:start-duplicate', '[Game] start() already running');
      return true;
    }

    if (!this.state || !this.gameLoop || typeof this.gameLoop.start !== 'function') {
      this.warnOnce('game:start-unavailable', '[Game] start() unavailable');
      return false;
    }

    if (this.state.mode !== 'map') {
      this.state.setMode('map');
    }

    this.gameLoop.start();
    this.started = true;
    return true;
  }

  stop() {
    if (!this.started) {
      this.warnOnce('game:stop-duplicate', '[Game] stop() already stopped');
      return true;
    }

    this.gameLoop?.stop?.();
    this.started = false;
    return true;
  }

  setPaused(isPaused) {
    if (this.mode === 'menu') return true;

    const nextPaused = Boolean(isPaused);
    if (nextPaused && this.mode === 'paused') {
      this.warnOnce('game:pause-duplicate:on', '[Game] Pause already enabled');
      return true;
    }
    if (!nextPaused && this.mode === 'playing') {
      this.warnOnce('game:pause-duplicate:off', '[Game] Pause already disabled');
      return true;
    }

    if (nextPaused) {
      this.mode = 'paused';
      this.hudManager?.setPaused?.(true);
      this.hudManager?.setMenuVisible?.(false);
      if (this.started) {
        this.gameLoop?.stop?.();
      }
      return true;
    }

    this.mode = 'playing';
    this.hudManager?.setPaused?.(false);
    this.hudManager?.setMenuVisible?.(false);
    if (this.started) {
      this.gameLoop?.start?.();
    }
    return true;
  }

  togglePaused() {
    if (this.mode === 'playing') return this.setPaused(true);
    if (this.mode === 'paused') return this.setPaused(false);
    return true;
  }

  isPaused() {
    return this.mode === 'paused';
  }

  destroy() {
    this.stop();

    if (typeof window !== 'undefined' && this.resizeHandler && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.resizeHandler);
    }

    if (typeof document !== 'undefined' && this.keyboardHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.keyboardHandler);
    }

    if (this.canvas && typeof this.canvas.removeEventListener === 'function') {
      if (this.partyPointerHandler) {
        this.canvas.removeEventListener('mousedown', this.partyPointerHandler);
      }
      if (this.partyPointerMoveHandler) {
        this.canvas.removeEventListener('mousemove', this.partyPointerMoveHandler);
      }
      if (this.partyPointerUpHandler) {
        this.canvas.removeEventListener('mouseup', this.partyPointerUpHandler);
      }
      if (this.partyContextMenuHandler) {
        this.canvas.removeEventListener('contextmenu', this.partyContextMenuHandler);
      }
    }

    const destroyables = [this.input, this.gameLoop, this.renderer, this.hudManager];
    destroyables.forEach((sys) => sys?.destroy?.());

    this.resizeHandler = null;
    this.keyboardHandler = null;
    this.partyPointerHandler = null;
    this.partyPointerMoveHandler = null;
    this.partyPointerUpHandler = null;
    this.partyContextMenuHandler = null;
    this.rightPointerTracking = false;
    this.rightPointerMoved = false;
    this.rightPointerStartX = 0;
    this.rightPointerStartY = 0;
    this.listenersBound = false;
    this.started = false;
    this.initialized = false;

    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    this.saveSystem = null;
    this.audioSystem = null;
    this.state = null;
    this.ctx = null;
    this.canvas = null;
    this.mode = 'menu';
    this.playerParty = null;
    this.followParty = false;

    return true;
  }

  toggleDebug() {
    if (!this.state?.debug) return;

    this.state.debug.enabled = !this.state.debug.enabled;

    if (this.dom.debugOverlay) {
      if (this.state.debug.enabled) {
        this.dom.debugOverlay.classList.remove('hidden');
      } else {
        this.dom.debugOverlay.classList.add('hidden');
      }
    }
  }

  quickSave() {
    console.log('[Game] Quick saving...');
  }

  quickLoad() {
    console.log('[Game] Quick loading...');
  }

  renderStart() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '48px "Cinzel", serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FallOfCavalry', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.font = '24px "Crimson Text", serif';
    this.ctx.fillText('Select your faction to begin', this.canvas.width / 2, this.canvas.height / 2 + 60);
  }

  renderMap() {
    if (!this.ctx || !this.canvas) return;
    const camera = this.getCameraSafe();
    this.clampCameraToWorld();
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(camera.zoom, camera.zoom);
    this.ctx.translate(-camera.x, -camera.y);

    this.renderWorldOverlays(this.ctx, camera);

    this.ctx.restore();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Map View (TODO)', this.canvas.width / 2, this.canvas.height / 2);

    if (this.followParty) {
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'rgba(255,255,255,0.75)';
      this.ctx.fillText('Follow: ON (F)', 12, this.canvas.height - 12);
    }

    if (this.state?.debug?.enabled) {
      this.renderDebugInfo();
    }

    this.hudManager?.update?.();
  }

  renderWorldOverlays(ctx, camera) {
    if (!ctx || !camera || !this.playerParty) return;

    const lineBase = 2 / camera.zoom;
    const party = this.playerParty;

    if (party.hasDestination) {
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(party.destX, party.destY);
      ctx.stroke();

      const d = 8;
      ctx.strokeStyle = 'rgba(212,175,55,0.85)';
      ctx.beginPath();
      ctx.moveTo(party.destX - d, party.destY);
      ctx.lineTo(party.destX + d, party.destY);
      ctx.moveTo(party.destX, party.destY - d);
      ctx.lineTo(party.destX, party.destY + d);
      ctx.stroke();
    }

    if (party.selected && this.mode !== 'paused') {
      ctx.strokeStyle = 'rgba(200,220,255,0.28)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(this.mouseWorldX, this.mouseWorldY);
      ctx.stroke();

      const pd = 6;
      ctx.strokeStyle = 'rgba(200,220,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(this.mouseWorldX - pd, this.mouseWorldY);
      ctx.lineTo(this.mouseWorldX + pd, this.mouseWorldY);
      ctx.moveTo(this.mouseWorldX, this.mouseWorldY - pd);
      ctx.lineTo(this.mouseWorldX, this.mouseWorldY + pd);
      ctx.stroke();
    }

    if (party.arrivalFeedbackTimer > 0) {
      const t = party.arrivalFeedbackTimer;
      const pulse = 1 - t;
      const radius = party.radius + 8 + Math.sin(pulse * Math.PI * 4) * 2;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.15 + (t * 0.35)})`;
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#4aa3ff';
    ctx.beginPath();
    ctx.arc(party.x, party.y, party.radius, 0, Math.PI * 2);
    ctx.fill();

    if (party.hovered && !party.selected) {
      ctx.strokeStyle = 'rgba(170,205,255,0.65)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (party.selected) {
      const encounterRadius = party.radius + this.encounterMargin;
      ctx.strokeStyle = 'rgba(255,120,120,0.2)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, encounterRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3 / camera.zoom;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (Array.isArray(this.enemyParties)) {
      this.enemyParties.forEach((enemy) => {
        if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
        const enemyRadius = Number.isFinite(enemy.radius) ? enemy.radius : 12;
        ctx.fillStyle = '#d9534f';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemyRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  renderEncounter() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.fillStyle = '#171717';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const enemyId = this.state?.encounter?.enemyId ?? 'unknown';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.font = '40px Arial';
    this.ctx.fillText('Encounter!', this.canvas.width / 2, this.canvas.height / 2 - 20);
    this.ctx.font = '22px Arial';
    this.ctx.fillText(`Enemy: ${enemyId}`, this.canvas.width / 2, this.canvas.height / 2 + 18);
    this.ctx.font = '18px Arial';
    this.ctx.fillText('F = Fight, C = Continue', this.canvas.width / 2, this.canvas.height / 2 + 56);
    this.hudManager?.update?.();
  }

  renderCity() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('City Services', this.canvas.width / 2, this.canvas.height / 2 - 12);
    this.ctx.font = '16px Arial';
    this.ctx.fillText('1 Recruit  2 Market  3 Inn  4 Craft  |  Esc to leave city', this.canvas.width / 2, this.canvas.height / 2 + 18);
    this.updateTransientUIState();
  }

  renderBattle() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#2f2525';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const battle = this.state?.battle;
    const enemyId = battle?.enemyId ?? 'unknown';
    const arena = battle?.arena || { w: this.canvas.width, h: this.canvas.height, padding: 70 };

    this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    this.ctx.strokeRect(arena.padding, arena.padding, arena.w - (arena.padding * 2), arena.h - (arena.padding * 2));
    this.ctx.fillStyle = 'rgba(74,163,255,0.08)';
    this.ctx.fillRect(arena.padding, arena.padding, (arena.w / 2) - arena.padding, arena.h - (arena.padding * 2));
    this.ctx.fillStyle = 'rgba(217,83,79,0.08)';
    this.ctx.fillRect(arena.w / 2, arena.padding, (arena.w / 2) - arena.padding, arena.h - (arena.padding * 2));

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '34px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Battle', this.canvas.width / 2, this.canvas.height / 2 - 30);
    this.ctx.font = '20px Arial';
    this.ctx.fillText(`Enemy: ${enemyId}`, this.canvas.width / 2, this.canvas.height / 2 + 4);
    this.ctx.font = '17px Arial';
    this.ctx.fillText('R = Retreat  |  ESC = Pause', this.canvas.width / 2, this.canvas.height / 2 + 38);

    if (battle?.phase === 'deploy') {
      this.ctx.font = '22px Arial';
      this.ctx.fillStyle = '#f2c94c';
      this.ctx.fillText('DEPLOYMENT', this.canvas.width / 2, 54);
      this.ctx.font = '16px Arial';
      this.ctx.fillText('Drag units in left zone · Tab/Arrows adjust · Enter/Space start', this.canvas.width / 2, 78);
    }

    if (battle?.phase === 'fight') {
      this.ctx.font = '16px Arial';
      this.ctx.fillStyle = '#f2c94c';
      this.ctx.fillText('Fight: click unit then A=attack G=guard R=retreat', this.canvas.width / 2, 78);
    }

    if (Array.isArray(battle?.units)) {
      const selected = battle?.selection?.unitId;
      battle.units.forEach((unit) => {
        if (unit?.dead) return;
        const x = Number.isFinite(unit.x) ? unit.x : 0;
        const y = Number.isFinite(unit.y) ? unit.y : 0;

        this.ctx.fillStyle = unit.side === 'player' ? '#4aa3ff' : '#d9534f';
        this.ctx.beginPath();
        this.ctx.arc(x, y, unit.radius ?? 10, 0, Math.PI * 2);
        this.ctx.fill();

        if (selected === unit.id && unit.side === 'player') {
          this.ctx.strokeStyle = '#f2c94c';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(x, y, (unit.radius ?? 10) + 4, 0, Math.PI * 2);
          this.ctx.stroke();
        }

        const hpRatio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
        this.ctx.fillStyle = 'rgba(0,0,0,0.45)';
        this.ctx.fillRect(x - 16, y - 16, 32, 4);
        this.ctx.fillStyle = '#8ad68f';
        this.ctx.fillRect(x - 16, y - 16, 32 * hpRatio, 4);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '11px Arial';
        this.ctx.fillText(unit.name, x, y + 18);
      });
    }

    (battle?.projectiles || []).forEach((projectile) => {
      this.ctx.fillStyle = projectile.side === 'player' ? '#c6defd' : '#ffc5c2';
      this.ctx.beginPath();
      this.ctx.arc(projectile.x, projectile.y, projectile.radius ?? 3, 0, Math.PI * 2);
      this.ctx.fill();
    });

    if (Array.isArray(battle?.log)) {
      this.ctx.textAlign = 'left';
      this.ctx.font = '12px Arial';
      this.ctx.fillStyle = 'rgba(255,255,255,0.9)';
      battle.log.slice(-6).forEach((line, idx) => {
        this.ctx.fillText(`• ${line.text}`, 14, this.canvas.height - 112 + (idx * 16));
      });
    }

    if (battle?.phase === 'result') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.58)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px Arial';
      this.ctx.fillText((battle.result || '').toUpperCase(), this.canvas.width / 2, this.canvas.height / 2 - 34);
      this.ctx.font = '20px Arial';
      this.ctx.fillText(`Casualties: ${battle.summary?.deadPlayer ?? 0} dead, ${battle.summary?.woundedPlayer ?? 0} wounded`, this.canvas.width / 2, this.canvas.height / 2);
      this.ctx.fillText(`Rewards: +${battle.reward?.gold ?? 0}g, +${battle.reward?.xp ?? 0}xp`, this.canvas.width / 2, this.canvas.height / 2 + 30);
      this.ctx.fillText('Press Enter to continue', this.canvas.width / 2, this.canvas.height / 2 + 60);
    }

    this.hudManager?.update?.();
  }

  renderDebugInfo() {
    if (!this.state || !this.input) return;

    const lines = [
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${this.state.player.gold}`,
      `Mouse: (${this.input.mouse.x.toFixed(0)}, ${this.input.mouse.y.toFixed(0)})`,
    ];

    if (this.dom.debugOverlay) {
      this.dom.debugOverlay.textContent = lines.join('\n');
    }
  }
}

export function bootstrapFallOfCavalry() {
  if (ROOT_SCOPE[GLOBAL_KEYS.game]) {
    warnBootstrapOnce('[Main] Bootstrap already completed; skipping duplicate init.');
    return ROOT_SCOPE[GLOBAL_KEYS.game];
  }

  try {
    const game = new FallOfCavalry();
    ROOT_SCOPE[GLOBAL_KEYS.game] = game;
    return game;
  } catch (err) {
    console.error('Failed to initialize game:', err);
    if (typeof document !== 'undefined' && document.body) {
      document.body.innerHTML = `
        <div style="color: red; padding: 20px; font-family: monospace;">
          <h1>Game Failed to Load</h1>
          <pre>${err.message}\n\n${err.stack}</pre>
        </div>
      `;
    }
    return null;
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  if (!ROOT_SCOPE[GLOBAL_KEYS.domReadyBound]) {
    ROOT_SCOPE[GLOBAL_KEYS.domReadyBound] = true;
    document.addEventListener('DOMContentLoaded', bootstrapFallOfCavalry);
  }
}

export default FallOfCavalry;
