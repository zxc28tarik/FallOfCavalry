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
import MinimapSimple from './rendering/minimap-simple.js';

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
    this.maxUnitsToDeploy = 8;
    this.playerRoster = [];
    this.enemyRoster = [];
    this.rosterCursorIndex = 0;
    this.enemyUnitsById = {};
    this.itemCatalog = [
      { id: 'grain', name: 'Grain', unitValue: 4, baseBuy: 4, baseSell: 2 },
      { id: 'wood', name: 'Wood', unitValue: 5, baseBuy: 5, baseSell: 3 },
      { id: 'leather', name: 'Leather', unitValue: 7, baseBuy: 7, baseSell: 4 },
      { id: 'iron', name: 'Iron', unitValue: 11, baseBuy: 11, baseSell: 7 },
      { id: 'arrows', name: 'Arrows', unitValue: 5, baseBuy: 5, baseSell: 3 },
      { id: 'cloth', name: 'Cloth', unitValue: 6, baseBuy: 6, baseSell: 4 },
      { id: 'tools', name: 'Tools', unitValue: 9, baseBuy: 9, baseSell: 6 },
    ];
    this.cityOffers = [];
    this.cityCursor = 0;
    this.cityMarketCursor = 0;
    this.cityHealerCursor = 0;
    this.battleProjectiles = [];
    this.battleRecoveryTimer = 0;
    this.battleDragUnitId = null;
    this.battleDragOffsetX = 0;
    this.battleDragOffsetY = 0;
    this.followParty = false;
    this.saveLoadRows = ['autosave', 'manual1', 'manual2'];
    this.saveLoadCursor = 0;
    this.saveLoadPreviousMode = 'map';
    this.autosaveIntervalMs = 60000;
    this.autosaveTimerId = null;
    this.lastAutosaveHudAt = 0;

    this.minimapRenderer = null;
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
    this.state.on('day:tick', (day) => this.processDailyEconomy(day));
    this.listenersBound = true;
  }

  processDailyEconomy(day) {
    if (!this.playerParty) return;
    const roster = this.playerParty.roster || [];
    const totalWage = roster.reduce((sum, u) => 
      sum + Math.max(0, Math.floor(u.wagePerDay ?? 0)), 0);

    if (totalWage === 0) return;

    const canPay = (this.playerParty.gold ?? 0) >= totalWage;
    if (canPay) {
      this.playerParty.gold -= totalWage;
      this.setLastEventLog(`Gün ${day}: Ücret ${totalWage}g ödendi.`);
    } else {
      this.playerParty.gold = 0;
      this.playerParty.morale = Math.max(10, (this.playerParty.morale ?? 50) - 5);
      this.setLastEventLog(`Gün ${day}: Ödeme yapılamadı! Moral -5.`);
    }
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
      const roster = [];
      for (let i = 0; i < 6; i += 1) {
        roster.push({ id: `inf-${i + 1}`, name: `Infantry ${i + 1}`, class: 'infantry', hp: 100, maxHp: 100, atk: 14, def: 8, speed: 72, meleeRange: 20, isRanged: false });
      }
      for (let i = 0; i < 3; i += 1) {
        roster.push({ id: `arc-${i + 1}`, name: `Archer ${i + 1}`, class: 'archer', hp: 78, maxHp: 78, atk: 10, def: 4, speed: 68, meleeRange: 14, rangedRange: 220, rangedDamage: 12, rangedCooldown: 1.2, isRanged: true });
      }
      this.playerParty.roster = roster;
    }
    if (!this.playerParty.inventory || typeof this.playerParty.inventory !== 'object') {
      this.playerParty.inventory = { items: [], capacity: null };
    }
    this.ensureInventoryModel();
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
    const total = 4 + (seedBase % 5);
    const archers = 1 + (seedBase % 3);
    const units = [];
    for (let i = 0; i < total; i += 1) {
      const isRanged = i < archers;
      units.push({
        id: `${enemyId}-u${i + 1}`,
        name: isRanged ? `Raider Archer ${i + 1}` : `Raider ${i + 1}`,
        class: isRanged ? 'archer' : 'infantry',
        hp: isRanged ? 74 : 96,
        maxHp: isRanged ? 74 : 96,
        atk: isRanged ? 10 : 13,
        def: isRanged ? 4 : 7,
        speed: isRanged ? 66 : 70,
        meleeRange: isRanged ? 12 : 20,
        rangedRange: isRanged ? 210 : 0,
        rangedDamage: isRanged ? 11 : 0,
        rangedCooldown: isRanged ? 1.3 : 0,
        isRanged,
      });
    }
    this.enemyUnitsById[enemyId] = units;
    const enemyParty = this.enemyParties.find((party) => party.id === enemyId);
    if (enemyParty && !Array.isArray(enemyParty.roster)) {
      enemyParty.roster = units.map((u) => ({ ...u }));
    }
    return units;
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

  getSelectedRosterCount() {
    if (!Array.isArray(this.playerRoster)) return 0;
    return this.playerRoster.filter(
      (unit) => unit?.selected === true && this.getEffectiveCount(unit) > 0
    ).length;
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
        (this.playerParty?.roster || []).forEach((unit) => {
          if (!unit?.wounded) return;
          if (Math.random() < 0.15) {
            unit.hp = Math.min(unit.maxHp, (unit.hp ?? unit.maxHp) + 2);
            unit.wounded = (unit.hp / Math.max(1, unit.maxHp)) <= 0.35;
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
    const battle = this.state?.battle;
    if (!battle || !Number.isFinite(dt) || dt <= 0) {
      this.updateTransientUIState();
      return;
    }

    const playerUnits = battle.playerUnits || [];
    const enemyUnits = battle.enemyUnits || [];
    const allUnits = [...playerUnits, ...enemyUnits];

    const alivePlayer = playerUnits.filter((u) => !u.dead && u.hp > 0);
    const aliveEnemy = enemyUnits.filter((u) => !u.dead && u.hp > 0);
    if (aliveEnemy.length === 0) { this.resolveBattle('victory'); return; }
    if (alivePlayer.length === 0) { this.resolveBattle('defeat'); return; }

    for (const unit of allUnits) {
      if (unit.dead || unit.hp <= 0) continue;
      const enemies = unit.side === 'player' ? aliveEnemy : alivePlayer;
      unit.attackTimer = Math.max(0, (unit.attackTimer || 0) - dt);
      unit.rangedTimer = Math.max(0, (unit.rangedTimer || 0) - dt);

      let target = enemies.find((e) => e.unitId === unit.targetId && !e.dead && e.hp > 0);
      if (!target) {
        target = this.findNearestEnemy(unit, enemies);
        unit.targetId = target?.unitId || null;
      }
      if (!target) continue;

      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (unit.isRanged) {
        if (dist <= unit.rangedRange) {
          if (unit.rangedTimer <= 0 && (battle.projectiles?.length ?? 0) < 200) {
            this.spawnProjectile(unit, target, battle.projectiles);
            unit.rangedTimer = unit.rangedCooldown;
          }
        } else {
          const step = Math.min(dist, unit.speed * dt);
          unit.x += (dx / dist) * step;
          unit.y += (dy / dist) * step;
        }
      } else if (dist <= unit.meleeRange) {
        if (unit.attackTimer <= 0) {
          this.applyUnitDamage(unit, target, unit.atk);
          unit.attackTimer = 0.9;
        }
      } else {
        const step = Math.min(dist, unit.speed * dt);
        unit.x += (dx / dist) * step;
        unit.y += (dy / dist) * step;
      }
    }

    const nextProjectiles = [];
    for (const projectile of (battle.projectiles || [])) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) continue;
      const targets = projectile.side === 'player' ? enemyUnits : playerUnits;
      let hit = false;
      for (const unit of targets) {
        if (unit.dead || unit.hp <= 0) continue;
        const hitDist = Math.hypot(unit.x - projectile.x, unit.y - projectile.y);
        if (hitDist <= (unit.radius || 9)) {
          this.applyUnitDamage(projectile, unit, projectile.damage);
          hit = true;
          break;
        }
      }
      if (!hit) nextProjectiles.push(projectile);
    }
    battle.projectiles = nextProjectiles;

    this.updateTransientUIState();
  }

  findNearestEnemy(unit, enemies) {
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const enemy of enemies || []) {
      if (!enemy || enemy.dead || enemy.hp <= 0) continue;
      const d = Math.hypot((enemy.x || 0) - (unit.x || 0), (enemy.y || 0) - (unit.y || 0));
      if (d < bestDist) {
        bestDist = d;
        best = enemy;
      }
    }
    return best;
  }

  applyUnitDamage(attacker, target, baseDamage) {
    if (!target || target.dead || target.hp <= 0) return 0;
    const variance = 0.9 + (Math.random() * 0.2);
    const raw = Math.max(1, (baseDamage ?? 1) - (target.def ?? 0));
    const damage = Math.max(1, Math.floor(raw * variance));
    target.hp -= damage;
    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
    }
    return damage;
  }

  spawnProjectile(shooter, target, list) {
    if (!list) return;
    const dx = (target.x || 0) - (shooter.x || 0);
    const dy = (target.y || 0) - (shooter.y || 0);
    const dist = Math.hypot(dx, dy) || 1;
    const speed = 340;
    const spread = (Math.random() - 0.5) * 0.08;
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const nx = (dx / dist) * cos - (dy / dist) * sin;
    const ny = (dx / dist) * sin + (dy / dist) * cos;
    list.push({
      x: shooter.x,
      y: shooter.y,
      vx: nx * speed,
      vy: ny * speed,
      side: shooter.side,
      damage: Math.max(1, Math.floor(shooter.rangedDamage || shooter.atk || 8)),
      ttl: 1.5,
      radius: 2,
    });
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
    this.playerRoster = (this.playerParty?.roster || []).map((unit, idx) => ({
      ...unit,
      selected: idx < this.maxUnitsToDeploy,
    }));
    this.enemyRoster = this.getEnemyUnits(enemyId).map((unit) => ({ ...unit, selected: true }));
    this.rosterCursorIndex = 0;

    if (!this.state.roster || typeof this.state.roster !== 'object') {
      this.state.roster = {};
    }

    this.state.roster.enemyId = enemyId;
    this.state.roster.warning = '';
    this.state.roster.maxDeploy = this.maxUnitsToDeploy;
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
    this.placeBattleUnits(playerUnits, 'player');
    this.placeBattleUnits(enemyUnits, 'enemy');

    this.cancelPlayerDestination();
    this.state.encounter = null;
    this.state.roster.warning = '';
    this.state.battle = {
      enemyId,
      startedAt: Date.now(),
      result: null,
      resolvedAt: null,
      playerUnits,
      enemyUnits,
      projectiles: [],
      targetRetargetTimer: 0,
    };

    this.state.setMode('battle');
    this.updateTransientUIState();
    return true;
  }

  createBattleUnitsFromRoster(roster, side) {
    return (roster || []).map((entry, idx) => ({
      unitId: `${side}-${entry.id}-${idx}`,
      sourceId: entry.id,
      side,
      name: entry.name,
      class: entry.class || (entry.isRanged ? 'archer' : 'infantry'),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: Math.max(1, Math.floor(entry.hp ?? entry.maxHp ?? 100)),
      maxHp: Math.max(1, Math.floor(entry.maxHp ?? entry.hp ?? 100)),
      atk: Math.max(1, Math.floor(entry.atk ?? 10)),
      def: Math.max(0, Math.floor(entry.def ?? 0)),
      speed: Math.max(20, Math.floor(entry.speed ?? 70)),
      meleeRange: Math.max(8, Math.floor(entry.meleeRange ?? 18)),
      isRanged: Boolean(entry.isRanged),
      rangedRange: Math.max(0, Math.floor(entry.rangedRange ?? 0)),
      rangedDamage: Math.max(1, Math.floor(entry.rangedDamage ?? entry.atk ?? 8)),
      rangedCooldown: Math.max(0.3, Number(entry.rangedCooldown ?? 1.2)),
      rangedTimer: 0,
      targetId: null,
      attackTimer: 0,
      radius: 9,
      dead: false,
    }));
  }

  placeBattleUnits(units, side) {
    const sideUnits = (units || []).filter((unit) => unit.side === side);
    if (sideUnits.length === 0) return;

    const width = Number.isFinite(this.canvas?.width) ? this.canvas.width : 1280;
    const height = Number.isFinite(this.canvas?.height) ? this.canvas.height : 720;
    const xBase = side === 'player' ? Math.max(100, width * 0.2) : Math.min(width - 100, width * 0.8);
    const minY = 90;
    const maxY = Math.max(minY + 1, height - 90);
    const spacing = sideUnits.length > 1 ? (maxY - minY) / (sideUnits.length - 1) : 0;

    sideUnits.forEach((unit, idx) => {
      unit.x = xBase + ((idx % 2) * (side === 'player' ? -22 : 22));
      unit.y = Math.max(minY, Math.min(maxY, minY + (spacing * idx)));
    });
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

  ensureInventoryModel() {
    if (!this.playerParty) return;
    const inv = this.playerParty.inventory;
    if (!inv || typeof inv !== 'object') {
      this.playerParty.inventory = { items: [], capacity: null };
      return;
    }

    if (!Array.isArray(inv.items)) {
      const mapped = [];
      Object.entries(inv).forEach(([id, qty]) => {
        if (id === 'items' || id === 'capacity' || id === 'gold') return;
        if (!Number.isFinite(qty) || qty <= 0) return;
        const cat = this.itemCatalog.find((i) => i.id === id);
        mapped.push({ id, name: cat?.name || id, qty: Math.floor(qty), unitValue: cat?.unitValue ?? cat?.baseBuy ?? 1 });
      });
      this.playerParty.inventory = {
        items: mapped,
        capacity: Number.isFinite(inv.capacity) ? inv.capacity : null,
      };
    }

    if (!Number.isFinite(this.playerParty.inventory.capacity)) this.playerParty.inventory.capacity = null;
  }

  getItemName(itemId) {
    return this.itemCatalog.find((item) => item.id === itemId)?.name || itemId;
  }

  getItemQty(itemId) {
    this.ensureInventoryModel();
    if (!itemId) return 0;
    const item = (this.playerParty?.inventory?.items || []).find((entry) => entry.id === itemId);
    return Math.max(0, Math.floor(item?.qty ?? 0));
  }

  addItem(itemId, name, qty = 1, unitValue = null) {
    this.ensureInventoryModel();
    if (!itemId || !Number.isFinite(qty) || qty <= 0 || !this.playerParty?.inventory?.items) return false;
    const list = this.playerParty.inventory.items;
    const existing = list.find((entry) => entry.id === itemId);
    const amount = Math.floor(qty);
    if (existing) {
      existing.qty = Math.max(0, Math.floor(existing.qty ?? 0) + amount);
      if (!existing.name) existing.name = name || this.getItemName(itemId);
      if (!Number.isFinite(existing.unitValue)) existing.unitValue = unitValue ?? this.itemCatalog.find((i) => i.id === itemId)?.unitValue ?? 1;
      return true;
    }

    list.push({
      id: itemId,
      name: name || this.getItemName(itemId),
      qty: amount,
      unitValue: Number.isFinite(unitValue) ? unitValue : (this.itemCatalog.find((i) => i.id === itemId)?.unitValue ?? 1),
    });
    return true;
  }

  removeItem(itemId, qty) {
    this.ensureInventoryModel();
    if (!itemId || !Number.isFinite(qty) || qty <= 0 || !this.playerParty?.inventory?.items) return false;
    const list = this.playerParty.inventory.items;
    const idx = list.findIndex((entry) => entry.id === itemId);
    if (idx < 0) return false;
    const next = Math.floor(list[idx].qty ?? 0) - Math.floor(qty);
    if (next < 0) return false;
    if (next === 0) list.splice(idx, 1);
    else list[idx].qty = next;
    return true;
  }

  listInventoryForUI() {
    this.ensureInventoryModel();
    return this.itemCatalog.map((item) => {
      const invItem = (this.playerParty?.inventory?.items || []).find((entry) => entry.id === item.id);
      return {
        ...item,
        qty: Math.max(0, Math.floor(invItem?.qty ?? 0)),
      };
    });
  }

  buildAftermathPanelData() {
    const a = this.state?.aftermath;
    if (!a) return { title: 'Aftermath', body: 'No aftermath data', footer: 'Enter to continue' };
    const deadLines = (a.dead || []).slice(0, 6).map((u) => `- ${u.name}`).join('\n') || 'None';
    const woundedLines = (a.wounded || []).slice(0, 6).map((u) => `- ${u.name}`).join('\n') || 'None';
    const lootLines = (a.loot || []).map((l) => `+ ${l.name || this.getItemName(l.id)} x${l.qty}`).join('\n') || 'No loot';
    const lootValue = (a.loot || []).reduce((sum, l) => sum + ((l.unitValue ?? 0) * (l.qty ?? 0)), 0);
    const survivors = Math.max(0, (this.playerParty?.roster || []).length);
    return {
      title: `Aftermath: ${String(a.result || '').toUpperCase()}`,
      body: `Dead (${a.dead?.length ?? 0})\n${deadLines}\n\nWounded (${a.wounded?.length ?? 0})\n${woundedLines}\n\nSurvivors: ${survivors}\n\nLoot\n${lootLines}\nTotal Loot Value: ${lootValue}\nGold: ${a.goldDelta >= 0 ? '+' : ''}${a.goldDelta}\nXP: ${a.xpDelta >= 0 ? '+' : ''}${a.xpDelta}`,
      footer: 'T / Enter = Take Loot   |   L / Esc = Leave Loot',
    };
  }



  getSettlementTier(settlement) {
    const type = String(settlement?.type || '').toLowerCase();
    if (type.includes('city') || type.includes('castle')) return 3;
    if (type.includes('town')) return 2;
    return 1;
  }

  getActiveSettlementForCity() {
    const settlements = this.state?.map?.settlements || [];
    const px = this.playerParty?.x ?? 0;
    const py = this.playerParty?.y ?? 0;
    let nearest = settlements[0] || null;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (const s of settlements) {
      const dx = (s?.x ?? 0) - px;
      const dy = (s?.y ?? 0) - py;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = s;
      }
    }
    return nearest || { id: 'city-fallback', name: 'Settlement', type: 'town' };
  }

  generateRecruitOffersForSettlement(settlement) {
    const tier = this.getSettlementTier(settlement);
    const day = Math.max(1, Math.floor(this.state?.day ?? 1));
    const base = `${settlement?.id || 'settlement'}:${day}:${tier}`;
    let seed = 0;
    for (const ch of base) seed = (seed * 31 + ch.charCodeAt(0)) % 2147483647;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483647;
      return (seed % 1000) / 1000;
    };

    const count = 4 + tier;
    const offers = [];
    for (let i = 0; i < count; i += 1) {
      const ranged = tier > 1 ? rand() < 0.4 : rand() < 0.2;
      const unitType = ranged ? 'archer' : 'infantry';
      const quality = Math.min(5, Math.max(1, 1 + Math.floor(rand() * (tier + 2))));
      const qStat = 1 + ((quality - 1) * 0.05);
      const qCost = 1 + ((quality - 1) * 0.10);
      const baseHp = ranged ? 78 : 100;
      const baseAtk = ranged ? 10 : 14;
      const baseDef = ranged ? 5 : 8;
      const baseCost = ranged ? 12 : 10;
      const baseWage = ranged ? 2 : 1;
      offers.push({
        id: `${settlement?.id || 's'}-rec-${day}-${i}`,
        unitType,
        unitClassLabel: ranged ? 'Archer' : 'Infantry',
        quality,
        count: 1 + Math.floor(rand() * (2 + tier)),
        hireCost: Math.max(1, Math.round(baseCost * qCost)),
        wagePerDay: Math.max(1, Math.round(baseWage * qCost)),
        templateStats: {
          maxHp: Math.max(1, Math.round(baseHp * qStat)),
          atk: Math.max(1, Math.round(baseAtk * qStat)),
          def: Math.max(0, Math.round(baseDef * qStat)),
          speed: ranged ? 68 : 72,
          melee: !ranged,
          ranged,
        },
      });
    }
    return offers;
  }

  ensureSettlementRecruitState(settlement, dayNow) {
    if (!settlement || typeof settlement !== 'object') return;
    const today = Math.max(1, Math.floor(dayNow ?? this.state?.day ?? 1));
    if (!settlement.recruit || typeof settlement.recruit !== 'object') {
      settlement.recruit = { lastRefreshDay: today, refreshEveryDays: 3, offers: this.generateRecruitOffersForSettlement(settlement) };
      return;
    }
    if (!Number.isFinite(settlement.recruit.refreshEveryDays)) settlement.recruit.refreshEveryDays = 3;
    if (!Array.isArray(settlement.recruit.offers)) settlement.recruit.offers = [];
    if (!Number.isFinite(settlement.recruit.lastRefreshDay)) settlement.recruit.lastRefreshDay = today;
    if ((today - settlement.recruit.lastRefreshDay) >= settlement.recruit.refreshEveryDays) {
      settlement.recruit.offers = this.generateRecruitOffersForSettlement(settlement);
      settlement.recruit.lastRefreshDay = today;
    }
  }

  ensureSettlementMarketState(settlement) {
    if (!settlement || typeof settlement !== 'object') return;
    const tier = this.getSettlementTier(settlement);
    if (!Array.isArray(settlement.marketStock)) {
      settlement.marketStock = this.itemCatalog.map((item, idx) => ({
        id: item.id,
        qty: Math.max(1, 4 + tier + idx % 3),
      }));
    }
    if (typeof settlement.priceMultiplier !== 'object' || !settlement.priceMultiplier) {
      settlement.priceMultiplier = {};
      this.itemCatalog.forEach((item, idx) => {
        const base = 1 + ((tier - 2) * 0.08) + ((idx % 3) * 0.03);
        settlement.priceMultiplier[item.id] = Math.min(1.3, Math.max(0.8, Number(base.toFixed(2))));
      });
    }
  }

  ensureCityOffers() {
    if (!this.state) return;
    if (!this.state.city || typeof this.state.city !== 'object') {
      this.state.city = this.getActiveSettlementForCity();
    }
    this.ensureSettlementRecruitState(this.state.city, this.state.day ?? 1);
    this.ensureSettlementMarketState(this.state.city);
    this.cityOffers = this.state.city?.recruit?.offers || [];
  }

  getWoundedUnits() {
    return (this.playerParty?.roster || []).filter((u) => Boolean(u?.wounded) || (u?.woundedDays ?? 0) > 0 || ((u?.hp ?? 0) / Math.max(1, u?.maxHp ?? 1)) <= 0.35);
  }

  buildCityPanelData() {
    this.ensureCityOffers();
    const submode = this.state?.citySubmode || 'menu';
    const city = this.state?.city || { name: 'Settlement', type: 'town', recruit: { refreshEveryDays: 3, lastRefreshDay: this.state?.day ?? 1 } };
    const day = this.state?.day ?? 1;

    if (submode === 'menu') {
      return {
        title: `${city.name || 'Settlement'} (${String(city.type || 'town').toUpperCase()})`,
        body: `Gold: ${Math.floor(this.playerParty?.gold ?? 0)}

1 = Recruit
2 = Market
H = Healer

Esc / E = Exit city`,
        footer: 'Choose a service',
      };
    }

    if (submode === 'recruit') {
      const recruit = city.recruit || { refreshEveryDays: 3, lastRefreshDay: day };
      const daysToRefresh = Math.max(0, recruit.refreshEveryDays - (day - (recruit.lastRefreshDay ?? day)));
      const lines = (this.cityOffers || []).map((offer, i) => {
        const mark = i === this.cityCursor ? '>' : ' ';
        return `${mark} ${offer.unitClassLabel} Q${offer.quality}  Av:${offer.count}  Hire:${offer.hireCost}g  Wage:${offer.wagePerDay}/d`;
      }).join('
') || 'No recruits available';
      return {
        title: 'City - Recruit',
        body: `${city.name || 'Settlement'}  Tier:${this.getSettlementTier(city)}
Refresh in ${daysToRefresh} day(s)

Gold: ${Math.floor(this.playerParty?.gold ?? 0)}  Roster: ${(this.playerParty?.roster || []).length}/24

${lines}

Up/Down select, Enter hire 1, Shift+Enter hire max, Esc back`,
        footer: 'Hiring adds units to battle roster',
      };
    }

    if (submode === 'market') {
      this.ensureSettlementMarketState(city);
      const stockMap = new Map((city.marketStock || []).map((s) => [s.id, s.qty]));
      const lines = this.itemCatalog.map((item, i) => {
        const mark = i === this.cityMarketCursor ? '>' : ' ';
        const mult = Number(city.priceMultiplier?.[item.id] ?? 1);
        const buyPrice = Math.max(1, Math.round((item.baseBuy ?? item.unitValue ?? 1) * mult));
        const sellPrice = Math.max(1, Math.floor(buyPrice * 0.7));
        const stock = Math.max(0, Math.floor(stockMap.get(item.id) ?? 0));
        const qty = this.getItemQty(item.id);
        return `${mark} ${item.name}  Buy:${buyPrice} Sell:${sellPrice}  Stock:${stock}  Inv:${qty}`;
      }).join('\n');
      return {
        title: 'City - Market',
        body: `Gold: ${Math.floor(this.playerParty?.gold ?? 0)}

${lines}

B/Enter buy1 | Shift buy5
S/Backspace sell1 | Shift sell5
Esc back`,
        footer: 'Trade uses settlement stock and your inventory',
      };
    }

    const wounded = this.getWoundedUnits();
    const lines = wounded.length
      ? wounded.map((unit, i) => {
        const mark = i === this.cityHealerCursor ? '>' : ' ';
        const missing = Math.max(0, (unit.maxHp ?? 0) - (unit.hp ?? 0));
        const cost = Math.max(0, Math.ceil(missing * 0.2));
        return `${mark} ${unit.name} HP ${Math.floor(unit.hp ?? 0)}/${Math.floor(unit.maxHp ?? 1)} Cost:${cost}g`;
      }).join('
')
      : 'No wounded units';
    return {
      title: 'City - Healer',
      body: `Gold: ${Math.floor(this.playerParty?.gold ?? 0)}

${lines}

Up/Down select, Enter heal, Esc back`,
      footer: 'Heal wounded units',
    };
  }

  recruitCurrentUnit(hireMax = false) {
    this.ensureCityOffers();
    const offer = this.cityOffers[this.cityCursor];
    if (!offer || offer.count <= 0) {
      this.setLastEventLog('No recruits available');
      return false;
    }
    const freeSlots = Math.max(0, 24 - (this.playerParty?.roster || []).length);
    const affordable = Math.floor((this.playerParty?.gold ?? 0) / Math.max(1, offer.hireCost));
    const qty = hireMax ? Math.min(offer.count, affordable, freeSlots) : Math.min(1, offer.count, affordable, freeSlots);
    if (qty <= 0) {
      this.setLastEventLog((this.playerParty?.gold ?? 0) < offer.hireCost ? 'Not enough gold' : 'Roster is full');
      return false;
    }

    for (let i = 0; i < qty; i += 1) {
      const idx = (this.playerParty.roster || []).length + 1;
      this.playerParty.roster.push({
        id: `${offer.unitType}-${Date.now()}-${idx}-${i}`,
        name: `${offer.unitClassLabel} ${idx}`,
        class: offer.unitType,
        hp: offer.templateStats.maxHp,
        maxHp: offer.templateStats.maxHp,
        atk: offer.templateStats.atk,
        def: offer.templateStats.def,
        speed: offer.templateStats.speed,
        meleeRange: offer.templateStats.melee ? 20 : 14,
        isRanged: Boolean(offer.templateStats.ranged),
        rangedRange: offer.templateStats.ranged ? 220 : 0,
        rangedDamage: offer.templateStats.ranged ? Math.max(8, offer.templateStats.atk) : 0,
        rangedCooldown: offer.templateStats.ranged ? 1.2 : 0,
        wagePerDay: offer.wagePerDay,
        quality: offer.quality,
        wounded: false,
        woundedDays: 0,
      });
    }

    this.playerParty.gold -= qty * offer.hireCost;
    offer.count = Math.max(0, offer.count - qty);
    this.setLastEventLog(`Recruited ${offer.unitClassLabel} x${qty}`);
    this.runAutosave('recruit');
    return true;
  }

  tradeCurrentItem(deltaQty) {
    const entry = this.itemCatalog[this.cityMarketCursor];
    const qty = Math.max(1, Math.floor(Math.abs(deltaQty || 1)));
    if (!entry) return false;

    const city = this.state?.city;
    this.ensureSettlementMarketState(city);
    const stockEntry = (city?.marketStock || []).find((s) => s.id === entry.id);
    const mult = Number(city?.priceMultiplier?.[entry.id] ?? 1);
    const buyPrice = Math.max(1, Math.round((entry.baseBuy ?? entry.unitValue ?? 1) * mult));
    const sellPrice = Math.max(1, Math.floor(buyPrice * 0.7));

    if ((deltaQty || 1) > 0) {
      const available = Math.max(0, Math.floor(stockEntry?.qty ?? 0));
      const buyQty = Math.min(qty, available);
      if (buyQty <= 0) {
        this.setLastEventLog('Market out of stock');
        return false;
      }
      const cost = buyPrice * buyQty;
      if ((this.playerParty?.gold ?? 0) < cost) {
        this.setLastEventLog('Not enough gold');
        return false;
      }
      this.playerParty.gold -= cost;
      if (stockEntry) stockEntry.qty = Math.max(0, available - buyQty);
      this.addItem(entry.id, entry.name, buyQty, entry.unitValue ?? entry.baseBuy);
      this.setLastEventLog(`Bought ${entry.name} x${buyQty}`);
      return true;
    }

    const sellQty = Math.min(qty, this.getItemQty(entry.id));
    if (sellQty <= 0) {
      this.setLastEventLog('No items to sell');
      return false;
    }
    this.removeItem(entry.id, sellQty);
    if (stockEntry) stockEntry.qty = Math.max(0, Math.floor(stockEntry.qty ?? 0)) + sellQty;
    this.playerParty.gold = (this.playerParty.gold ?? 0) + (sellPrice * sellQty);
    this.setLastEventLog(`Sold ${entry.name} x${sellQty}`);
    return true;
  }

  healCurrentUnit() {
    const wounded = this.getWoundedUnits();
    const unit = wounded[this.cityHealerCursor];
    if (!unit) {
      this.setLastEventLog('No wounded unit selected');
      return false;
    }
    const missing = Math.max(0, (unit.maxHp ?? 0) - (unit.hp ?? 0));
    if (missing <= 0) {
      unit.wounded = false;
      unit.woundedDays = 0;
      return false;
    }
    const affordableHeal = Math.min(missing, Math.floor((this.playerParty?.gold ?? 0) / 0.2));
    if (affordableHeal <= 0) {
      this.setLastEventLog('Not enough gold to heal');
      return false;
    }
    const cost = Math.ceil(affordableHeal * 0.2);
    unit.hp = Math.min(unit.maxHp, unit.hp + affordableHeal);
    unit.wounded = (unit.hp / Math.max(1, unit.maxHp)) <= 0.35;
    if (!unit.wounded) unit.woundedDays = 0;
    this.playerParty.gold -= cost;
    this.setLastEventLog(`Healed ${unit.name}`);
    return true;
  }


  generateBattleLoot(result, battle) {
    const enemyUnits = battle?.enemyUnits || [];
    const infantryCount = enemyUnits.filter((u) => !u?.isRanged).length;
    const archerCount = enemyUnits.filter((u) => u?.isRanged).length;
    const total = enemyUnits.length;
    const unitScale = Math.max(1, Math.floor(total / 2));
    if (result === 'defeat') return [];

    const loot = [];
    const push = (id, qty) => {
      if (!Number.isFinite(qty) || qty <= 0) return;
      const item = this.itemCatalog.find((i) => i.id === id);
      if (!item) return;
      loot.push({ id: item.id, name: item.name, qty: Math.floor(qty), unitValue: item.unitValue ?? item.baseBuy ?? 1 });
    };

    if (result === 'victory') {
      push('grain', 1 + Math.floor(infantryCount / 2) + Math.floor(Math.random() * 2));
      push('leather', Math.max(1, Math.floor(infantryCount / 2)));
      if (archerCount > 0) {
        push('arrows', 2 + Math.floor(archerCount * 1.5));
        push('wood', 1 + Math.floor(archerCount / 2)); // bow parts surrogate
      }
      if (Math.random() < 0.2) push('iron', 1 + Math.floor(unitScale / 3));
    } else {
      push('grain', Math.max(1, Math.floor(unitScale / 2)));
      if (archerCount > 0) push('arrows', 1 + Math.floor(archerCount / 2));
    }

    return loot.slice(0, 9);
  }

  applyRosterOutcomeFromBattle(battle) {
    const roster = this.playerParty?.roster || [];
    const dead = [];
    const wounded = [];

    for (const unit of (battle?.playerUnits || [])) {
      const idx = roster.findIndex((r) => r.id === unit.sourceId);
      if (idx < 0) continue;
      const model = roster[idx];
      if (unit.hp <= 0 || unit.dead) {
        dead.push({ id: model.id, name: model.name });
        roster.splice(idx, 1);
        continue;
      }
      model.hp = Math.max(1, Math.floor(unit.hp));
      model.wounded = (model.hp / Math.max(1, model.maxHp)) <= 0.35;
      if (model.wounded) wounded.push({ id: model.id, name: model.name });
    }

    return { dead, wounded };
  }


  resolveBattle(result) {
    if (!this.state || this.state.mode !== 'battle') return false;
    const battle = this.state.battle;
    if (!battle?.enemyId || battle.result || this.state.aftermath) return false;

    const enemyId = battle.enemyId;
    battle.result = result;
    battle.resolvedAt = Date.now();

    const outcome = this.applyRosterOutcomeFromBattle(battle);
    const loot = this.generateBattleLoot(result, battle);
    const goldDelta = result === 'victory' ? 8 + Math.floor(Math.random() * 8) : result === 'retreat' ? 2 + Math.floor(Math.random() * 3) : 0;
    const xpDelta = result === 'victory' ? 10 + Math.floor(Math.random() * 7) : result === 'retreat' ? 3 : 0;

    this.state.aftermath = {
      result,
      enemyId,
      dead: outcome.dead,
      wounded: outcome.wounded,
      casualties: { dead: outcome.dead.length, wounded: outcome.wounded.length, survivors: Math.max(0, (this.playerParty?.roster || []).length) },
      loot,
      goldDelta,
      xpDelta,
      timestamp: Date.now(),
    };
    this.state.uiPanel = this.buildAftermathPanelData();
    this.state.setMode('aftermath');
    this.updateTransientUIState();
    return true;
  }

  exitAftermathToMap(takeLoot = true) {
    if (!this.state || this.state.mode !== 'aftermath' || !this.state.aftermath) return false;
    const aftermath = this.state.aftermath;
    const enemyId = aftermath.enemyId;
    const result = aftermath.result;
    const enemy = this.enemyParties.find((party) => party?.id === enemyId) || null;

    if (takeLoot) {
      for (const entry of aftermath.loot || []) {
        this.addItem(entry.id, entry.name, entry.qty, entry.unitValue);
      }
      this.playerParty.gold = (this.playerParty.gold ?? 0) + (aftermath.goldDelta ?? 0);
      this.playerParty.xp = (this.playerParty.xp ?? 0) + (aftermath.xpDelta ?? 0);
      this.setLastEventLog(`Aftermath claimed: +${aftermath.goldDelta ?? 0}g, +${aftermath.xpDelta ?? 0}xp`);
    } else {
      this.playerParty.gold = (this.playerParty.gold ?? 0) + (aftermath.goldDelta ?? 0);
      this.playerParty.xp = (this.playerParty.xp ?? 0) + (aftermath.xpDelta ?? 0);
      this.setLastEventLog('Aftermath continued (loot discarded)');
    }

    if (result === 'victory') {
      this.despawnEnemyParty(enemyId);
      this.applyBattleExit(enemy, enemyId, this.encounterPushbackDistance);
    } else if (result === 'defeat') {
      this.cancelPlayerDestination();
      this.applyBattleExit(enemy, enemyId, this.defeatPushbackDistance);
    } else {
      this.applyBattleExit(enemy, enemyId, this.encounterPushbackDistance);
    }

    this.state.uiPanel = null;
    this.state.aftermath = null;
    this.state.setMode('map');
    this.runAutosave('aftermath-close');
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
        const allUnits = [...(this.state?.battle?.playerUnits || []), ...(this.state?.battle?.enemyUnits || [])];
        const hit = allUnits.find((u) => !u.dead && u.side === 'player' && Math.hypot(u.x - x, u.y - y) <= ((u.radius ?? 10) + 8));
        if (!hit) return;
        this.state.battle.selection = this.state.battle.selection || {};
        this.state.battle.selection.unitId = hit.unitId;
        if (this.state?.battle?.phase === 'deploy' && this.mode !== 'paused') {
          this.battleDragUnitId = hit.unitId;
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

    if (this.canvas && !this._wheelBound) {
      this._wheelBound = true;
      this.canvas.addEventListener('wheel', (e) => {
        if (this.state?.mode !== 'map') return;
        e.preventDefault();
        const cam = this.getCameraSafe();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        cam.zoom = Math.max(0.3, Math.min(3.0, cam.zoom * factor));
        this.clampCameraToWorld();
      }, { passive: false });
    }
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

      if (this.state?.accounting) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
          e.preventDefault?.();
          this.state.accounting = null;
          this.state.uiPanel = null;
          this.updateTransientUIState();
          this.runAutosave('accounting-close');
          return;
        }
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
          this.exitAftermathToMap(false);
          return;
        }

        if (this.state?.saveLoadOpen) {
          e.preventDefault?.();
          this.closeSaveLoadPanel();
          return;
        }

        if (this.state?.mode === 'city') {
          e.preventDefault?.();
          if ((this.state.citySubmode || 'menu') !== 'menu') {
            this.state.citySubmode = 'menu';
            this.updateTransientUIState();
            return;
          }
          this.state.uiPanel = null;
          this.state.setMode('map');
          this.updateTransientUIState();
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

      if (this.state?.saveLoadOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault?.();
          this.saveLoadCursor = Math.max(0, this.saveLoadCursor - 1);
          this.state.uiPanel = this.buildSaveLoadPanelData();
          this.updateTransientUIState();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault?.();
          this.saveLoadCursor = Math.min(this.saveLoadRows.length - 1, this.saveLoadCursor + 1);
          this.state.uiPanel = this.buildSaveLoadPanelData();
          this.updateTransientUIState();
          return;
        }

        const slot = this.getSelectedSaveSlot();
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault?.();
          this.saveToSlot(slot);
          this.state.uiPanel = this.buildSaveLoadPanelData();
          this.updateTransientUIState();
          return;
        }
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault?.();
          this.loadFromSlot(slot);
          this.closeSaveLoadPanel();
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault?.();
          this.exportSelectedSaveToTextarea(slot);
          this.state.uiPanel = this.buildSaveLoadPanelData();
          this.updateTransientUIState();
          return;
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault?.();
          const loaded = this.importTextareaToSlotAndLoad(slot);
          if (loaded) this.closeSaveLoadPanel();
          else {
            this.state.uiPanel = this.buildSaveLoadPanelData();
            this.updateTransientUIState();
          }
          return;
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
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault?.();
          let selected = 0;
          this.playerRoster.forEach((unit) => {
            if (selected < this.maxUnitsToDeploy && this.getEffectiveCount(unit) > 0) {
              unit.selected = true;
              selected += 1;
            } else {
              unit.selected = false;
            }
          });
          this.updateTransientUIState();
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault?.();
          this.playerRoster.forEach((unit) => { unit.selected = false; });
          this.updateTransientUIState();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault?.();
          this.confirmRosterSelection();
          return;
        }
      }

      if (this.state?.mode === 'battle') {
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
        if (e.key === 'Enter' || e.key === 't' || e.key === 'T') {
          e.preventDefault?.();
          this.exitAftermathToMap(true);
          return;
        }
        if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
          e.preventDefault?.();
          this.exitAftermathToMap(false);
          return;
        }
      }

      if (this.state?.mode === 'city') {
        const submode = this.state.citySubmode || 'menu';
        if (submode === 'menu') {
          if (e.key === '1' || e.key === 'r' || e.key === 'R') { this.state.citySubmode = 'recruit'; this.cityCursor = 0; this.updateTransientUIState(); return; }
          if (e.key === '2' || e.key === 't' || e.key === 'T') { this.state.citySubmode = 'market'; this.cityMarketCursor = 0; this.updateTransientUIState(); return; }
          if (e.key === 'h' || e.key === 'H') { this.state.citySubmode = 'healer'; this.cityHealerCursor = 0; this.updateTransientUIState(); return; }
          if (e.key === 'e' || e.key === 'E') { this.state.uiPanel = null; this.state.setMode('map'); this.updateTransientUIState(); return; }
        }

        if (submode === 'recruit') {
          if (e.key === 'ArrowUp') { e.preventDefault?.(); this.cityCursor = Math.max(0, this.cityCursor - 1); this.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); this.cityCursor = Math.min(Math.max(0, this.cityOffers.length - 1), this.cityCursor + 1); this.updateTransientUIState(); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); this.recruitCurrentUnit(Boolean(e.shiftKey)); this.updateTransientUIState(); return; }
        }

        if (submode === 'market') {
          if (e.key === 'ArrowUp') { e.preventDefault?.(); this.cityMarketCursor = Math.max(0, this.cityMarketCursor - 1); this.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); this.cityMarketCursor = Math.min(Math.max(0, this.itemCatalog.length - 1), this.cityMarketCursor + 1); this.updateTransientUIState(); return; }
          if (e.key === 'b' || e.key === 'B' || e.key === 'Enter') { e.preventDefault?.(); this.tradeCurrentItem(e.shiftKey ? 5 : 1); this.updateTransientUIState(); return; }
          if (e.key === 's' || e.key === 'S' || e.key === 'Backspace') { e.preventDefault?.(); this.tradeCurrentItem(e.shiftKey ? -5 : -1); this.updateTransientUIState(); return; }
        }

        if (submode === 'healer') {
          const wounded = this.getWoundedUnits();
          if (e.key === 'ArrowUp') { e.preventDefault?.(); this.cityHealerCursor = Math.max(0, this.cityHealerCursor - 1); this.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); this.cityHealerCursor = Math.min(Math.max(0, wounded.length - 1), this.cityHealerCursor + 1); this.updateTransientUIState(); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); this.healCurrentUnit(); this.updateTransientUIState(); return; }
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
        this.state.citySubmode = 'menu';
        this.cityCursor = 0;
        this.cityMarketCursor = 0;
        this.cityHealerCursor = 0;
        this.accountingCursor = 0;
        this.state.city = this.getActiveSettlementForCity();
        this.ensureSettlementRecruitState(this.state.city, this.state.day ?? 1);
        this.ensureSettlementMarketState(this.state.city);
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
        if (this.state?.mode === 'map') {
          this.openSaveLoadPanel();
          return;
        }
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
      saveTransferText: utils.getEl('saveTransferText'),
    };

    const missing = Object.entries(this.dom).filter(([, el]) => !el).map(([key]) => key);
    if (missing.length) {
      this.warnOnce('game:missing-dom-ids', `[Game] Missing DOM ids: ${missing.join(', ')}`);
    }

    const btnSave = document.getElementById('btnSaveGame');
    const btnLoad = document.getElementById('btnLoadGame');
    const btnReset = document.getElementById('btnResetGame');
    const btnTransfer = document.getElementById('btnOpenSaveTransfer');
    const btnExport = document.getElementById('btnExportSave');
    const btnImport = document.getElementById('btnImportSave');
    const btnCloseTransfer = document.getElementById('btnCloseSaveTransfer');

    if (btnSave) btnSave.addEventListener('click', () => this.quickSave());
    if (btnLoad) btnLoad.addEventListener('click', () => this.openSaveLoadPanel());
    if (btnReset) btnReset.addEventListener('click', () => {
      if (confirm('Oyunu sıfırlamak istediğine emin misin?')) {
        this.saveSystem?.deleteSave?.();
        this.saveSystem?.deleteAutosave?.();
        location.reload();
      }
    });
    if (btnTransfer) btnTransfer.addEventListener('click', () => {
      document.getElementById('saveTransferModal')?.classList.remove('hidden');
    });
    if (btnExport) btnExport.addEventListener('click', () => {
      this.exportSelectedSaveToTextarea('manual1');
    });
    if (btnImport) btnImport.addEventListener('click', () => {
      this.importTextareaToSlotAndLoad('manual1');
      document.getElementById('saveTransferModal')?.classList.add('hidden');
    });
    if (btnCloseTransfer) btnCloseTransfer.addEventListener('click', () => {
      document.getElementById('saveTransferModal')?.classList.add('hidden');
    });

    this.minimapRenderer = new MinimapSimple(
      document.getElementById('hudMiniMap')
    );

    document.querySelectorAll('[data-battle-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseFloat(btn.dataset.battleSpeed);
        if (!Number.isFinite(speed)) return;
        if (this.state?.battle) this.state.battleSpeed = speed;
        document.querySelectorAll('[data-battle-speed]')
          .forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });

    const btnBattlePause = document.getElementById('btnBattlePause');
    if (btnBattlePause) {
      btnBattlePause.addEventListener('click', () => {
        if (this.state?.mode === 'battle') this.togglePaused();
      });
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
    this.startAutosaveLoop();
    this.hudManager?.setMenuVisible?.(false);
    this.hudManager?.setSettingsVisible?.(false);
    this.hudManager?.setPaused?.(false);
    return true;
  }

  continueGame() {
    const canContinue = Boolean(this.saveSystem?.hasSave?.());
    this.hudManager?.setContinueEnabled?.(canContinue);
    if (!canContinue) return false;

    const result = this.saveSystem?.loadSlot?.('manual1');
    if (!result?.ok || !result.data) return false;
    this.applySavePayload(result.data, { slot: 'manual1' });
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
    this.stopAutosaveLoop();

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

  buildSavePayload() {
    const nowIso = new Date().toISOString();
    const roster = (this.playerParty?.roster || []).map((unit) => ({
      id: unit.id,
      class: unit.class || 'unit',
      label: unit.name || unit.class || 'Unit',
      hp: Math.max(1, Math.floor(unit.hp ?? unit.maxHp ?? 1)),
      maxHp: Math.max(1, Math.floor(unit.maxHp ?? unit.hp ?? 1)),
      atk: Math.max(1, Math.floor(unit.atk ?? 10)),
      def: Math.max(0, Math.floor(unit.def ?? 0)),
      speed: Math.max(20, Math.floor(unit.speed ?? 60)),
      melee: Boolean(!unit.isRanged),
      ranged: Boolean(unit.isRanged),
      wagePerDay: Math.max(0, Math.floor(unit.wagePerDay ?? 0)),
      quality: Math.max(0, Math.floor(unit.quality ?? 0)),
      wounded: Boolean(unit.wounded),
      woundedDays: Math.max(0, Math.floor(unit.woundedDays ?? 0)),
      meleeRange: Math.floor(unit.meleeRange ?? 18),
      rangedRange: Math.floor(unit.rangedRange ?? 0),
      rangedDamage: Math.floor(unit.rangedDamage ?? 0),
      rangedCooldown: Number(unit.rangedCooldown ?? 0),
    }));

    const settlements = this.state?.map?.settlements || [];
    this.ensureInventoryModel();
    const inventory = {
      items: Array.isArray(this.playerParty?.inventory?.items) ? this.playerParty.inventory.items.map((item) => ({
        id: item.id,
        name: item.name || this.getItemName(item.id),
        qty: Math.max(0, Math.floor(item.qty ?? 0)),
        unitValue: Math.max(1, Math.floor(item.unitValue ?? this.itemCatalog.find((c) => c.id === item.id)?.unitValue ?? 1)),
      })) : [],
      capacity: Number.isFinite(this.playerParty?.inventory?.capacity) ? this.playerParty.inventory.capacity : null,
    };

    const settlementsRecruit = settlements
      .filter((s) => s?.id && s?.recruit)
      .map((s) => ({
        settlementId: s.id,
        lastRefreshDay: Number.isFinite(s.recruit?.lastRefreshDay) ? s.recruit.lastRefreshDay : 0,
        refreshEveryDays: Number.isFinite(s.recruit?.refreshEveryDays) ? s.recruit.refreshEveryDays : 3,
        offers: Array.isArray(s.recruit?.offers) ? s.recruit.offers : [],
      }));

    return {
      schemaVersion: 1,
      savedAt: nowIso,
      game: {
        day: Number.isFinite(this.state?.day) ? this.state.day : 1,
        mode: typeof this.state?.mode === 'string' ? this.state.mode : 'map',
        paused: Boolean(this.state?.paused),
        camera: {
          x: Number.isFinite(this.state?.camera?.x) ? this.state.camera.x : 0,
          y: Number.isFinite(this.state?.camera?.y) ? this.state.camera.y : 0,
          zoom: Number.isFinite(this.state?.camera?.zoom) ? this.state.camera.zoom : 1,
        },
        playerParty: {
          x: Number.isFinite(this.playerParty?.x) ? this.playerParty.x : 320,
          y: Number.isFinite(this.playerParty?.y) ? this.playerParty.y : 320,
          radius: Number.isFinite(this.playerParty?.radius) ? this.playerParty.radius : 12,
          speed: Number.isFinite(this.playerParty?.speed) ? this.playerParty.speed : 180,
          selected: Boolean(this.playerParty?.selected),
          destX: Number.isFinite(this.playerParty?.destX) ? this.playerParty.destX : null,
          destY: Number.isFinite(this.playerParty?.destY) ? this.playerParty.destY : null,
          hasDestination: Boolean(this.playerParty?.hasDestination),
          gold: Number.isFinite(this.playerParty?.gold) ? this.playerParty.gold : 0,
          xp: Number.isFinite(this.playerParty?.xp) ? this.playerParty.xp : 0,
          morale: Number.isFinite(this.playerParty?.morale) ? this.playerParty.morale : 50,
        },
        roster,
        enemies: (this.enemyParties || []).map((e) => ({
          id: e.id,
          x: Number.isFinite(e.x) ? e.x : 0,
          y: Number.isFinite(e.y) ? e.y : 0,
          radius: Number.isFinite(e.radius) ? e.radius : 12,
          speed: Number.isFinite(e.speed) ? e.speed : 35,
          vx: Number.isFinite(e.vx) ? e.vx : 0,
          vy: Number.isFinite(e.vy) ? e.vy : 0,
        })),
        enemyCooldowns: this.lastEncounterEndTimeByEnemyId || {},
        settlementsRecruit,
        settlementsMarkets: settlements.filter((st) => st?.id).map((st) => ({
          settlementId: st.id,
          marketStock: Array.isArray(st.marketStock) ? st.marketStock : [],
          priceMultiplier: st.priceMultiplier && typeof st.priceMultiplier === 'object' ? st.priceMultiplier : {},
        })),
        inventory,
      },
    };
  }

  applySavePayload(payload, { slot = 'manual1' } = {}) {
    const game = payload?.game || {};
    if (!this.state || !this.playerParty) return false;

    this.state.day = Number.isFinite(game.day) ? game.day : 1;
    this.state.paused = Boolean(game.paused);
    this.state.camera = {
      x: Number.isFinite(game?.camera?.x) ? game.camera.x : 0,
      y: Number.isFinite(game?.camera?.y) ? game.camera.y : 0,
      zoom: Number.isFinite(game?.camera?.zoom) ? game.camera.zoom : 1,
    };

    const p = game.playerParty || {};
    this.playerParty.x = Number.isFinite(p.x) ? p.x : this.playerParty.x;
    this.playerParty.y = Number.isFinite(p.y) ? p.y : this.playerParty.y;
    this.playerParty.radius = Number.isFinite(p.radius) ? p.radius : this.playerParty.radius;
    this.playerParty.speed = Number.isFinite(p.speed) ? p.speed : this.playerParty.speed;
    this.playerParty.selected = Boolean(p.selected);
    this.playerParty.destX = Number.isFinite(p.destX) ? p.destX : null;
    this.playerParty.destY = Number.isFinite(p.destY) ? p.destY : null;
    this.playerParty.hasDestination = Boolean(p.hasDestination);
    this.playerParty.gold = Number.isFinite(p.gold) ? p.gold : 0;
    this.playerParty.xp = Number.isFinite(p.xp) ? p.xp : 0;
    this.playerParty.morale = Number.isFinite(p.morale) ? p.morale : 50;

    const inv = game.inventory && typeof game.inventory === 'object' ? game.inventory : { items: [], capacity: null };
    this.playerParty.inventory = {
      items: Array.isArray(inv.items) ? inv.items.map((it) => ({
        id: it.id,
        name: it.name || this.getItemName(it.id),
        qty: Math.max(0, Math.floor(it.qty ?? 0)),
        unitValue: Math.max(1, Math.floor(it.unitValue ?? this.itemCatalog.find((c) => c.id === it.id)?.unitValue ?? 1)),
      })).filter((it) => it.id && it.qty > 0) : [],
      capacity: Number.isFinite(inv.capacity) ? inv.capacity : null,
    };
    this.ensureInventoryModel();

    const roster = Array.isArray(game.roster) ? game.roster : [];
    this.playerParty.roster = roster.map((u, i) => ({
      id: u.id || `unit-${i + 1}`,
      name: u.label || u.class || `Unit ${i + 1}`,
      class: u.class || 'unit',
      hp: Math.max(1, Math.floor(u.hp ?? u.maxHp ?? 1)),
      maxHp: Math.max(1, Math.floor(u.maxHp ?? u.hp ?? 1)),
      atk: Math.max(1, Math.floor(u.atk ?? 10)),
      def: Math.max(0, Math.floor(u.def ?? 0)),
      speed: Math.max(20, Math.floor(u.speed ?? 60)),
      isRanged: Boolean(u.ranged),
      meleeRange: Math.floor(u.meleeRange ?? 18),
      rangedRange: Math.floor(u.rangedRange ?? 0),
      rangedDamage: Math.floor(u.rangedDamage ?? 0),
      rangedCooldown: Number(u.rangedCooldown ?? 0),
      wagePerDay: Math.max(0, Math.floor(u.wagePerDay ?? 0)),
      quality: Math.max(0, Math.floor(u.quality ?? 0)),
      wounded: Boolean(u.wounded),
      woundedDays: Math.max(0, Math.floor(u.woundedDays ?? 0)),
    }));

    this.enemyParties = (Array.isArray(game.enemies) ? game.enemies : []).map((e) => ({
      id: e.id,
      x: Number.isFinite(e.x) ? e.x : 0,
      y: Number.isFinite(e.y) ? e.y : 0,
      radius: Number.isFinite(e.radius) ? e.radius : 12,
      speed: Number.isFinite(e.speed) ? e.speed : 35,
      vx: Number.isFinite(e.vx) ? e.vx : 0,
      vy: Number.isFinite(e.vy) ? e.vy : 0,
    }));
    this.state.aiParties = this.enemyParties;

    this.lastEncounterEndTimeByEnemyId = game.enemyCooldowns && typeof game.enemyCooldowns === 'object'
      ? game.enemyCooldowns
      : {};

    const recruitBySettlement = new Map((Array.isArray(game.settlementsRecruit) ? game.settlementsRecruit : []).map((r) => [r.settlementId, r]));
    const settlements = this.state.map?.settlements || [];
    settlements.forEach((s) => {
      const rec = recruitBySettlement.get(s.id);
      if (!rec) return;
      s.recruit = {
        lastRefreshDay: Number.isFinite(rec.lastRefreshDay) ? rec.lastRefreshDay : 0,
        refreshEveryDays: Number.isFinite(rec.refreshEveryDays) ? rec.refreshEveryDays : 3,
        offers: Array.isArray(rec.offers) ? rec.offers : [],
      };
    });

    const marketBySettlement = new Map((Array.isArray(game.settlementsMarkets) ? game.settlementsMarkets : []).map((m) => [m.settlementId, m]));
    settlements.forEach((s) => {
      const market = marketBySettlement.get(s.id);
      if (!market) return;
      s.marketStock = Array.isArray(market.marketStock) ? market.marketStock : [];
      s.priceMultiplier = market.priceMultiplier && typeof market.priceMultiplier === 'object' ? market.priceMultiplier : {};
    });

    const loadedMode = typeof game.mode === 'string' ? game.mode : 'map';
    const safeModes = new Set(['map', 'city']);
    if (!safeModes.has(loadedMode)) {
      this.state.setMode('map');
      this.setLastEventLog('Loaded into map for safety');
    } else {
      this.state.setMode(loadedMode);
    }

    this.state.encounter = null;
    this.state.battle = null;
    this.state.accounting = null;
    this.state.aftermath = null;
    this.state.lastSaveMeta = { slot, at: Date.now() };
    this.updateTransientUIState();
    return true;
  }

  getSelectedSaveSlot() {
    return this.saveLoadRows[Math.max(0, Math.min(this.saveLoadRows.length - 1, this.saveLoadCursor))] || 'manual1';
  }

  openSaveLoadPanel() {
    if (!this.state || this.state.saveLoadOpen) return false;
    this.saveLoadPreviousMode = this.state.mode;
    this.state.saveLoadOpen = true;
    this.saveLoadCursor = 0;
    this.state.uiPanel = this.buildSaveLoadPanelData();
    this.updateTransientUIState();
    return true;
  }

  closeSaveLoadPanel() {
    if (!this.state?.saveLoadOpen) return false;
    this.state.saveLoadOpen = false;
    this.state.uiPanel = null;
    this.updateTransientUIState();
    return true;
  }

  buildSaveLoadPanelData() {
    const day = Math.floor(this.state?.day ?? 1);
    const gold = Math.floor(this.playerParty?.gold ?? 0);
    const rosterSize = (this.playerParty?.roster || []).length;
    const rows = this.saveLoadRows.map((slot, idx) => {
      const mark = idx === this.saveLoadCursor ? '>' : ' ';
      const has = this.saveSystem?.hasSlot?.(slot) ? 'saved' : 'empty';
      return `${mark} ${slot} (${has})`;
    }).join('\n');
    return {
      title: 'Save / Load',
      body: `Day ${day}  Gold ${gold}  Roster ${rosterSize}

${rows}

Up/Down select slot
S save  L load
E export to textarea  I import from textarea
Esc close`,
      footer: 'Slots: autosave / manual1 / manual2',
    };
  }

  saveToSlot(slot) {
    const payload = this.buildSavePayload();
    const res = this.saveSystem?.saveSlot?.(slot, payload);
    if (!res?.ok) {
      this.setLastEventLog('Save failed');
      return false;
    }
    this.state.lastSaveMeta = { slot, at: Date.now() };
    this.setLastEventLog(`Saved ${slot}`);
    this.updateTransientUIState();
    return true;
  }

  loadFromSlot(slot) {
    const res = this.saveSystem?.loadSlot?.(slot);
    if (!res?.ok || !res.data) {
      this.setLastEventLog(`Load failed: ${res?.reason || 'unknown'}`);
      return false;
    }
    const ok = this.applySavePayload(res.data, { slot });
    if (!ok) {
      this.setLastEventLog('Load failed');
      return false;
    }
    this.setLastEventLog(`Loaded ${slot}`);
    return true;
  }

  exportSelectedSaveToTextarea(slot) {
    const json = this.saveSystem?.exportSlot?.(slot);
    if (!json) {
      this.setLastEventLog('Export failed');
      return false;
    }
    if (this.dom?.saveTransferText) {
      this.dom.saveTransferText.value = json;
      this.dom.saveTransferText.focus?.();
      this.dom.saveTransferText.select?.();
    }
    this.setLastEventLog(`Exported ${slot}`);
    return true;
  }

  importTextareaToSlotAndLoad(slot) {
    const text = this.dom?.saveTransferText?.value;
    if (!text || typeof text !== 'string') {
      this.setLastEventLog('Import text is empty');
      return false;
    }
    const imported = this.saveSystem?.importToSlot?.(slot, text);
    if (!imported?.ok) {
      this.setLastEventLog(`Import failed: ${imported?.reason || 'invalid json'}`);
      return false;
    }
    return this.loadFromSlot(slot);
  }

  startAutosaveLoop() {
    if (this.autosaveTimerId) return;
    const tick = () => {
      this.autosaveTimerId = null;
      if (this.state?.mode === 'map' && !this.state?.accounting && !this.state?.saveLoadOpen) {
        this.runAutosave('interval');
      }
      this.startAutosaveLoop();
    };
    this.autosaveTimerId = setTimeout(tick, this.autosaveIntervalMs);
  }

  stopAutosaveLoop() {
    if (!this.autosaveTimerId) return;
    clearTimeout(this.autosaveTimerId);
    this.autosaveTimerId = null;
  }

  runAutosave(trigger = 'manual') {
    const ok = this.saveToSlot('autosave');
    if (!ok) return false;
    const now = Date.now();
    if ((now - this.lastAutosaveHudAt) >= 30000 || trigger !== 'interval') {
      this.lastAutosaveHudAt = now;
      this.setLastEventLog('Autosaved', 1600);
    }
    return true;
  }

  quickSave() {
    return this.saveToSlot('manual1');
  }

  quickLoad() {
    return this.loadFromSlot('manual1');
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
    this.minimapRenderer?.render(this);
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
    this.ctx.fillText('F = Battle Prep, C = Continue', this.canvas.width / 2, this.canvas.height / 2 + 56);
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
    this.ctx.fillText('R Recruit  T Market  H Healer  |  E/Esc leave city', this.canvas.width / 2, this.canvas.height / 2 + 18);
    this.updateTransientUIState();
  }

  renderBattle() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#1f1f24';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const battle = this.state?.battle;
    if (!battle) return;
    const playerUnits = battle.playerUnits || [];
    const enemyUnits = battle.enemyUnits || [];
    const alivePlayer = playerUnits.filter((u) => !u.dead && u.hp > 0).length;
    const aliveEnemy = enemyUnits.filter((u) => !u.dead && u.hp > 0).length;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Player: ${alivePlayer}   Enemy: ${aliveEnemy}   R = Retreat`, this.canvas.width / 2, 30);

    for (const unit of [...playerUnits, ...enemyUnits]) {
      if (unit.dead || unit.hp <= 0) continue;
      this.ctx.fillStyle = unit.side === 'player' ? '#4aa3ff' : '#d9534f';
      this.ctx.beginPath();
      this.ctx.arc(unit.x, unit.y, unit.radius || 9, 0, Math.PI * 2);
      this.ctx.fill();

      if (unit.isRanged) {
        this.ctx.fillStyle = '#f2c94c';
        this.ctx.beginPath();
        this.ctx.arc(unit.x, unit.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }

      const hpRatio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
      this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
      this.ctx.fillRect(unit.x - 12, unit.y - 16, 24, 3);
      this.ctx.fillStyle = '#89d38d';
      this.ctx.fillRect(unit.x - 12, unit.y - 16, 24 * hpRatio, 3);
    }

    for (const projectile of (battle.projectiles || [])) {
      this.ctx.fillStyle = projectile.side === 'player' ? '#c6defd' : '#ffc5c2';
      this.ctx.beginPath();
      this.ctx.arc(projectile.x, projectile.y, projectile.radius || 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.hudManager?.update?.();
  }


  renderDebugInfo() {
    if (!this.state) return;
    const lines = [
      `FPS: ${(this.state.debug?.fps ?? 0).toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${Math.floor(this.playerParty?.gold ?? 0)}`,
      `Party: (${(this.playerParty?.x ?? 0).toFixed(0)}, ${(this.playerParty?.y ?? 0).toFixed(0)})`,
      `Roster: ${(this.playerParty?.roster || []).length}`,
      `Enemies: ${(this.enemyParties || []).length}`,
    ];
    if (this.dom?.debugOverlay) {
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
