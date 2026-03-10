/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';
import HUDManager from './ui/hud.js';
// SaveSystem → SaveManager
import AudioSystem from './systems/audio-system.js';
import * as CONST from './constants.js';
import MinimapSimple from './rendering/minimap-simple.js';
import StartScreen from './ui/start-screen.js';
import WorldGenerator from './world/world-generator.js';
import FogOfWar from './world/fog-of-war.js';
import * as recruitmentSystem from './systems/recruitment.js';
import * as tradeSystem from './systems/trade.js';
import { buyTruce, canBuyTruce, improveRelations, declareWar, applyContractRelationBonus, applyTradeCaravanAttackPenalty } from './systems/diplomacy.js';
import {
  createInitialFactionState,
  ensureFactionState,
  getRelation,
  getStance,
  applyBattleOutcomeToRelations,
  assignInitialSettlementOwners,
  setRelation,
} from './systems/factions.js';
import CityServicesUI from './ui/city-services.js';
import { showWinScreen, showLoseScreen, toggleCurrentEventsModal, isCurrentEventsModalOpen, renderCurrentEventsModal } from './ui/modals.js';
import {
  setContractsRuntimeContext,
  generateContractsForCity,
  acceptContract,
  completeContract,
  emitContractEvent,
} from './systems/contracts.js';
import * as suppliesSystem from './systems/supplies.js';
import * as capacitySystem from './systems/capacity.js';
import * as campSystem from './systems/camp.js';
import CampUI from './ui/camp-ui.js';
import AccountingUI from './ui/accounting-ui.js';
import { computeDamage, applyCommandEffects } from './systems/combat-rules.js';
import { getBattleTerrainContext } from './systems/terrain-effects.js';
import {
  getBattleMoraleConfig,
  clampMorale,
  applyMoraleDamage,
  applyAllyDeathShock,
} from './systems/battle-morale.js';
import BattleCommandsUI from './ui/battle-commands.js';
import BattleDeployMode from './game-modes/battle-deploy-mode.js';
import BattleDeployUI from './ui/battle-deploy-ui.js';
import PoiUI from './ui/poi-ui.js';
import * as PoiSystem from './systems/poi-system.js';
import { computeRiskMultiplier, riskLabel } from './systems/encounter-risk.js';
import {
  createInitialEventState,
  getActiveEvents,
  rollWarEvents,
  EVENT_TYPES,
  getBanditCapFromEvents,
  getEventTypeLabel,
} from './systems/events.js';
import { isDevMode, loadTuningFromStorage } from './systems/dev-gate.js';
import { classifyAttackSide, resolveFlankBonuses, getAttackDirectionAgainstDefender, ATTACK_SIDE } from './systems/flank.js';
import SpriteLoader from './rendering/sprite-loader.js';
import AnimationPlayer from './rendering/animation.js';
import { computeUnitCohesion, getFormationMultipliers } from './systems/formation.js';
import { updateEnemyAI, clampToBattleBounds, computeSkirmishKiteStep } from './systems/battle-ai.js';
import { inferUnitRole, getCounterEffect, computeChargeState, isBracedSpearman } from './systems/battle-counters.js';
import {
  initBattleAmmoFromParty,
  consumeAmmo,
  canUnitFireRanged,
  applySuppressionOnHit,
  tickSuppression,
  shouldUseMeleeFallback,
} from './systems/battle-ranged.js';
import {
  createBattleRng,
  computeEnemyPower,
  generateBattleLoot as generateRewardLoot,
  computeRenownDelta,
} from './systems/battle-rewards.js';
import { applyBattleOutcomes, tickHealing } from './systems/casualties.js';
import { computeWeatherForDay, getWeatherTint } from './systems/weather.js';
import { initWeatherLayer, setWeatherState, renderWeatherOverlay } from './rendering/weather-layer.js';
import { initBattleFx, spawnFx, tickBattleFx, renderBattleFx } from './rendering/battle-fx.js';
import { createCamera, setCameraTarget, updateCamera, applyCameraTransform, addCameraShake } from './rendering/camera.js';
import { createDefaultSettings, applySettingsPatch, serializeSettings, deserializeSettings } from './systems/settings.js';
import SettingsUI from './ui/settings.js';
import CodexUI from './ui/codex.js';
import {
  createInitialRegionState,
  getActiveRegionModifiers,
  applyPOIOutcomeToRegion,
} from './systems/region-state.js';
import {
  createInitialWorldAiState,
  ensureWorldParties,

  removeWorldParty,
  getBanditCap,
} from './systems/world-ai.js';
import {
  createInitialWarState,
  ensureWar,
  markPeace,
  updateCrisisFlag,
  onBattleResolved,
  captureCity,
  findWar,
} from './systems/faction-wars.js';

import * as utils from './utils.js';
import { BattleManager } from './managers/BattleManager.js';
import { WorldManager } from './managers/WorldManager.js';
import { SaveManager } from './managers/SaveManager.js';
import { EconomyManager } from './managers/EconomyManager.js';
import { GameInputManager } from './managers/InputManager.js';
import { RenderManager } from './managers/RenderManager.js';
import { CityManager } from './managers/CityManager.js';
import { PoiManager } from './managers/PoiManager.js';
import { TuningManager } from './managers/TuningManager.js';
import { UIManager } from './managers/UIManager.js';
import { DevManager } from './managers/DevManager.js';
import { DiplomacyManager } from './managers/DiplomacyManager.js';
import { EncounterManager } from './managers/EncounterManager.js';
import { GameFlowManager } from './managers/GameFlowManager.js';

window.__FOC_BOOT_OK__ = true;

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

function formatBuildTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function chooseTutorialHint({ state, mode, nearSettlement, nearPoi, inCamp, inBattleDeploy, inBattleFight, inEncounter }) {
  if (!state || typeof state !== 'object') return null;
  const tutorial = state.tutorial && typeof state.tutorial === 'object' ? state.tutorial : null;
  if (!tutorial?.enabled) return null;

  const day = Number(state.day ?? 1);
  const timeSec = Number(state.timeSec ?? 0);
  const outOfDayWindow = day > CONST.TUTORIAL_HINTS.MAX_DAYS;
  const outOfTimeWindow = Number.isFinite(timeSec) && timeSec > CONST.TUTORIAL_HINTS.MAX_REALTIME_SEC;
  if (outOfDayWindow && outOfTimeWindow) return null;

  const now = Date.now();
  const lastShownAt = Number(tutorial.lastShownAt ?? 0);
  if (Number.isFinite(lastShownAt) && (now - lastShownAt) < CONST.TUTORIAL_HINTS.COOLDOWN_MS) return null;

  const shown = tutorial.shown && typeof tutorial.shown === 'object' ? tutorial.shown : {};
  const candidates = [
    inEncounter ? 'encounter' : null,
    inBattleDeploy ? 'battleDeploy' : null,
    inBattleFight ? 'battleCmd' : null,
    nearSettlement ? 'city' : null,
    nearPoi ? 'poi' : null,
    inCamp ? 'camp' : null,
    mode === 'map' ? 'movement' : null,
  ].filter(Boolean);

  const key = candidates
    .filter((candidate) => !shown[candidate] && CONST.HINT_TEXT[candidate])
    .sort((a, b) => (CONST.TUTORIAL_HINTS.PRIORITY[b] ?? 0) - (CONST.TUTORIAL_HINTS.PRIORITY[a] ?? 0))[0];

  if (!key) return null;
  return { key, text: CONST.HINT_TEXT[key] };
}

class ObjectPool {
  constructor(size, factory, resetter = null) {
    this.size = Math.max(1, size | 0);
    this.factory = typeof factory === 'function' ? factory : (() => ({}));
    this.resetter = typeof resetter === 'function' ? resetter : null;
    this.free = [];
    for (let i = 0; i < this.size; i += 1) this.free.push(this.factory());
  }

  acquire() {
    return this.free.pop() || this.factory();
  }

  release(obj) {
    if (!obj || this.free.length >= this.size) return;
    if (this.resetter) this.resetter(obj);
    this.free.push(obj);
  }
}

class FallOfCavalry {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = null;
    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    // saveSystem → SaveManager
    this.audioSystem = null;
    this.startScreen = null;
    this.cityUI = null;
    this.campUI = null;
    this.accountingUI = null;
    this.battleCommandsUI = null;
    this.battleDeployMode = null;
    this.battleDeployUI = null;
    this.poiUI = null;
    this.tuningUI = null;
    this.settingsUI = null;
    this.codexUI = null;
    this.helpOverlayVisible = false;
    this.TuningUIClass = null;
    this.activePoi = null;
    this.pendingPoiAmbush = null;
    // fogOfWar, _worldSeedCache, _crossingSet, _roadMask, _riverMask → WorldManager
    // _encounterRollByEnemyId → WorldManager
    this.currentTerrainStatus = 'Arazi: normal';
    this.currentBattleTerrain = { terrainKey: 'PLAINS', mods: CONST.TERRAIN_MODS.PLAINS };
    this.weatherState = { type: 'CLEAR', timeOfDay: 'DAY' };

    this.mode = 'menu'; // menu | playing | paused
    this.dom = {};

    this.resizeHandler = null;
    // keyboardHandler, partyPointerHandler, partyPointerMoveHandler,
    // partyPointerUpHandler, partyContextMenuHandler → InputManager
    // rightPointerTracking, rightPointerMoved, rightPointerStartX,
    // rightPointerStartY → InputManager
    this.mouseWorldX = 0;
    this.mouseWorldY = 0;

    this.playerParty = null;
    this.enemyParties = [];
    this.worldAi = createInitialWorldAiState();
    this.worldEncounterPartyByEnemyId = {};
    this.lastEncounterEndTimeByEnemyId = {};
    // encounterMargin, encounterCooldownMs → WorldManager
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
    this.battleProjectiles = [];
    this.floatingTexts = [];
    this.battleRecoveryTimer = 0;
    this.battleDragUnitId = null;
    this.battleDragOffsetX = 0;
    this.battleDragOffsetY = 0;
    this.followParty = false;
    // saveLoadRows, saveLoadCursor, saveLoadPreviousMode, autosaveIntervalMs, autosaveTimerId, lastAutosaveHudAt → SaveManager
    this._tuningPauseMode = null;

    this.minimapRenderer = null;
    this.spriteLoader = null;
    this.assetsReady = false;
    this.battleAnimPlayers = new Map();
    this.lastBattleDt = 1 / 60;
    this.projectilePool = new ObjectPool(CONST.PERF.PROJECTILE_POOL, () => ({ x: 0, y: 0, vx: 0, vy: 0, side: 'player', damage: 0, ttl: 0, radius: 2, attackDirX: 0, attackDirY: 0 }), (p) => { p.ttl = 0; p.attackDirX = 0; p.attackDirY = 0; });
    this.floatingTextPool = new ObjectPool(CONST.PERF.FLOATTEXT_POOL, () => ({ x: 0, y: 0, text: '', color: '#fff', ttl: 0, vy: -18 }), (t) => { t.ttl = 0; t.text = ''; });
    this.smokeResults = [];
    this.started = false;
    this.initialized = false;
    this.listenersBound = false;
    this.warnedKeys = new Set();
    utils.devLog(isDevMode(), '🎮 FallOfCavalry - Initializing...');
    this.init();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    utils.warnOnce(key, message);
  }

  ensureTutorialState() {
    if (!this.state || typeof this.state !== 'object') return;
    const current = this.state.tutorial && typeof this.state.tutorial === 'object' ? this.state.tutorial : {};
    const shown = current.shown && typeof current.shown === 'object' ? current.shown : {};
    this.state.tutorial = {
      enabled: typeof current.enabled === 'boolean' ? current.enabled : CONST.TUTORIAL_HINTS.ENABLED_DEFAULT,
      lastShownAt: Number.isFinite(current.lastShownAt) ? current.lastShownAt : 0,
      shown,
    };
  }

  ensureTuningState() {
    if (!this.state || typeof this.state !== 'object') return;
    if (!this.state.tuning || typeof this.state.tuning !== 'object' || Array.isArray(this.state.tuning)) this.state.tuning = {};
  }
  ensureFactionState() { return this.diplomacyManager.ensureFactionState(); }

  getFactionName(factionId) { return this.diplomacyManager.getFactionName(factionId); }

  getCityFactionContext(settlement) { return this.diplomacyManager.getCityFactionContext(settlement); }


  findNearestCityId(x, y, radiusTiles) { return this.worldManager.findNearestCityId(x, y, radiusTiles); }

  syncWarStateFromRelations() { return this.diplomacyManager.syncWarStateFromRelations(); }

  getTuningDefaults() { return this.tuningManager.getTuningDefaults(); }
  getEffectiveTuning() { return this.tuningManager.getEffectiveTuning(); }
  applyTuningDraft(draft) { return this.tuningManager.applyTuningDraft(draft); }
  async setupTuningUI() { return this.tuningManager.setupTuningUI(); }
  async showTuningModal() { return this.tuningManager.showTuningModal(); }
  hideTuningModal() { return this.tuningManager.hideTuningModal(); }

  updateBuildInfoBadge() { return this.uiManager.updateBuildInfoBadge(); }

  applyDevOnlyDomLock() { return this.uiManager.applyDevOnlyDomLock(); }

  maybeShowTutorialHint(context = {}) { return this.uiManager.maybeShowTutorialHint(context); }

  getWeatherRegionId() {
    const tilePos = this.getTilePosition(this.playerParty?.x ?? 0, this.playerParty?.y ?? 0);
    const nearestSettlement = this.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    if (nearestSettlement?.id) return String(nearestSettlement.id);
    return `${tilePos.tx}:${tilePos.ty}`;
  }

  refreshWeatherState(dayIndex = Number(this.state?.day ?? 1)) {
    const weatherCfg = this.getWeatherConfig();
    if (!weatherCfg?.ENABLED) return;
    const weather = computeWeatherForDay({
      worldSeed: this.state?.seed ?? 1337,
      dayIndex,
      regionId: this.getWeatherRegionId(),
    });
    this.weatherState = weather;
    this.state.weatherState = weather;
    setWeatherState(weather);
  }


  getWeatherConfig() {
    return {
      ...CONST.WEATHER,
      ENABLED: Boolean(CONST.WEATHER?.ENABLED) && Boolean(this.settings?.weatherEnabled),
    };
  }

  getBattleFxConfig() {
    return this.battleManager.getBattleFxConfig();
  }

  getBattleCameraConfig() {
    return this.battleManager.getBattleCameraConfig();
  }

  applyGameSettingsPatch(patch = {}) { return this.gameFlowManager.applyGameSettingsPatch(patch); }
  getRegionIdAtTile(tx, ty) { return this.worldManager.getRegionIdAtTile(tx, ty); }

  getCurrentRegionContext() { return this.worldManager.getCurrentRegionContext(); }

  getCurrentRegionModifiers(day = this.state?.day) { return this.worldManager.getCurrentRegionModifiers(day); }

  getWorldAiCfgWithRegionMods() { return this.worldManager.getWorldAiCfgWithRegionMods(); }

  getRenownGainMultAtCurrentRegion() { return this.worldManager.getRenownGainMultAtCurrentRegion(); }

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
    this.battleManager = this.battleManager || new BattleManager(this.state);
    this.battleManager.init(this);
    this.worldManager = this.worldManager || new WorldManager(this.state);
    this.worldManager.init(this);
    if (!this.state.markets || typeof this.state.markets !== 'object') this.state.markets = {};
    if (!this.state.marketOpportunities || typeof this.state.marketOpportunities !== 'object') this.state.marketOpportunities = {};
    if (!this.state.regionState || typeof this.state.regionState !== 'object') this.state.regionState = createInitialRegionState();
    if (!this.state.dailyLedger || typeof this.state.dailyLedger !== 'object') this.state.dailyLedger = { tradePL: 0 };
    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
    if (this.state) PoiSystem.ensurePoiState(this.state);
    this.ensureTutorialState();
    this.ensureTuningState();
    this.settings = deserializeSettings(this.state?.settings, CONST.SETTINGS);
    this.state.settings = serializeSettings(this.settings);
    this.tuningManager = this.tuningManager || new TuningManager(this.state);
    this.tuningManager.init(this);
    this.diplomacyManager = this.diplomacyManager || new DiplomacyManager(this.state);
    this.diplomacyManager.init(this);
    this.uiManager = this.uiManager || new UIManager(this.state);
    this.uiManager.init(this);
    this.ensureFactionState();
    this.state.events = this.state.events && typeof this.state.events === 'object' ? this.state.events : createInitialEventState();
    this.state.devMode = isDevMode();
    this.applyDevOnlyDomLock();
    const storageTuning = loadTuningFromStorage();
    if (storageTuning) {
      this.state.tuning = { ...(this.state.tuning || {}), ...storageTuning };
    }
    this.input = this.input || new InputManager(this.canvas);
    this.gameLoop = this.gameLoop || new GameLoop(this.state, this.input, null);
    this.hudManager = this.hudManager || new HUDManager(this.state);
    this.saveManager = this.saveManager || new SaveManager(this.state);
    this.saveManager.init(this);
    this.economyManager = this.economyManager || new EconomyManager(this.state);
    this.economyManager.init(this);
    this.inputManager = this.inputManager || new GameInputManager(this.state);
    this.inputManager.init(this);
    this.renderManager = this.renderManager || new RenderManager(this.state);
    this.renderManager.init(this);
    this.cityManager = this.cityManager || new CityManager(this.state);
    this.cityManager.init(this);
    this.poiManager = this.poiManager || new PoiManager(this.state);
    this.poiManager.init(this);
    this.encounterManager = this.encounterManager || new EncounterManager(this.state);
    this.encounterManager.init(this);
    this.devManager = this.devManager || new DevManager(this.state);
    this.devManager.init(this);
    this.gameFlowManager = this.gameFlowManager || new GameFlowManager(this.state);
    this.gameFlowManager.init(this);
    this.audioSystem = this.audioSystem || new AudioSystem();
    const manifestOverride = this.state?.devMode && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('manifest') || '').trim()
      : '';
    const manifestUrl = manifestOverride || 'assets/manifest.json';
    this.spriteLoader = this.spriteLoader || new SpriteLoader(manifestUrl, {
      devMode: this.state?.devMode,
      warnOnce: utils.warnOnce,
      devLog: utils.devLog,
    });

    this.setupCanvas();
    initWeatherLayer(this.getWeatherConfig());
    this.setupEventListeners();
    this.initPlayerParty();
    this.refreshWeatherState(this.state?.day ?? 1);
    this.setupPartyInputHandlers();
    this.setupDOMReferences();
    this.ensureHudEventsButton();
    this.setupDOMReferences();
    this.hudManager?.setupElements?.();
    this.hudManager?.setupListeners?.();
    this.updateBuildInfoBadge();
    this.applyDevOnlyDomLock();
    this.setupSettingsUI();
    this.setupHelpOverlay();
    this.setupMenuActions();
    this.setupStartFlow();
    this.setupCityServicesUI();
    this.setupCampUI();
    this.setupBattleCommandsUI();
    this.setupBattleDeployUI();
    this.setupAccountingUI();
    this.setupPoiUI();
    this.enterStart();
    this.onModeChanged(this.state.mode, this.state.mode);
    this.loadSpriteAssets();

    if (typeof window !== 'undefined') {
      window.game = this;
      window.STATE = this.state;
    }

    this.initialized = true;
    utils.devLog(this.state, '✅ FallOfCavalry - Ready!');
    return true;
  }

  async loadSpriteAssets() {
    if (!this.spriteLoader) return false;
    try {
      await this.spriteLoader.loadAll();
      this.assetsReady = true;
    } catch {
      if (this.state?.devMode) utils.devLog(this.state, '[Assets] Sprite pipeline disabled; using fallback rendering.');
      this.assetsReady = false;
    }
    return this.assetsReady;
  }

  async reloadSpriteAssets() {
    this.assetsReady = false;
    this.battleAnimPlayers.clear();
    return this.loadSpriteAssets();
  }

  getPoiSpriteKey(poiType) {
    if (poiType === 'camp') return 'poi_camp';
    return 'poi_ruin';
  }

  ensureBattleUnitFx(unit) {
    return this.battleManager.ensureBattleUnitFx(unit);
  }

  getUnitAnimationKey(unit) {
    return this.battleManager.getUnitAnimationKey(unit);
  }

  getBattleAnimPlayer(unit) {
    return this.battleManager.getBattleAnimPlayer(unit);
  }

  drawBattleUnitFallback(ctx, unit, x, y, size) {
    return this.battleManager.drawBattleUnitFallback(ctx, unit, x, y, size);
  }

  drawUnitSpriteOrFallback(ctx, unit, x, y, size, now) {
    return this.battleManager.drawUnitSpriteOrFallback(ctx, unit, x, y, size, now);
  }

  setupCanvas() {
    if (this.resizeHandler || !this.canvas) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const resize = () => {
      this.canvas.width = typeof window.innerWidth === 'number' ? window.innerWidth : this.canvas.width;
      this.canvas.height = typeof window.innerHeight === 'number' ? window.innerHeight : this.canvas.height;
      utils.devLog(this.state, `[Canvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    };

    this.resizeHandler = resize;
    resize();
    window.addEventListener('resize', resize);
  }

  setupEventListeners() { return this.uiManager.setupEventListeners(); }

  getCurrentEvents(day = Number(this.state?.day ?? 1)) { return this.gameFlowManager.getCurrentEvents(day); }

  refreshCurrentEventsSummary(day = Number(this.state?.day ?? 1)) { return this.gameFlowManager.refreshCurrentEventsSummary(day); }

  applyDailyEventEffects(day, activeEvents) { return this.gameFlowManager.applyDailyEventEffects(day, activeEvents); }

  getBanditCapWithEvents(worldEvents) { return this.worldManager.getBanditCapWithEvents(worldEvents); }

  processDailyEconomy(day) { return this.economyManager.processDailyEconomy(day); }

  evaluateCampaignOutcome() { return this.gameFlowManager.evaluateCampaignOutcome(); }

  restartRun() { return this.gameFlowManager.restartRun(); }

  showCampaignWin() { return this.gameFlowManager.showCampaignWin(); }

  showCampaignLose() { return this.gameFlowManager.showCampaignLose(); }

  getCameraSafe() { return this.worldManager.getCameraSafe(); }

  getWorldBounds() { return this.worldManager.getWorldBounds(); }

  clampToWorld(x, y) { return this.worldManager.clampToWorld(x, y); }

  clampCameraToWorld() { return this.worldManager.clampCameraToWorld(); }

  centerCameraOnParty() { return this.worldManager.centerCameraOnParty(); }

  screenToWorld(screenX, screenY) { return this.worldManager.screenToWorld(screenX, screenY); }

  updatePointerWorldState(screenX, screenY) { return this.worldManager.updatePointerWorldState(screenX, screenY); }

  initPlayerParty() { return this.worldManager.initPlayerParty(); }

  ensureRosterUnitState(unit) {
    return this.battleManager.ensureRosterUnitState(unit);
  }

  ensureRosterState() { return this.worldManager.ensureRosterState(); }

  initRosters() { return this.encounterManager.initRosters(); }

  getEnemyUnits(enemyId) { return this.battleManager.getEnemyUnits(enemyId); }




  applyDifficultyToEnemyUnit(unit) {
    return this.battleManager.applyDifficultyToEnemyUnit(unit);
  }

  getEffectiveCount(entry) { return this.worldManager.getEffectiveCount(entry); }

  initEnemyParties() { return this.worldManager.initEnemyParties(); }

  updateMapSimulation(dt) { return this.worldManager.updateMapSimulation(dt); }

  ensureWorldGenerated(seed) { return this.worldManager.ensureWorldGenerated(seed); }

  updateFogFromPlayer() { return this.worldManager.updateFogFromPlayer(); }



  rebuildMovementMasks() { return this.worldManager.rebuildMovementMasks(); }

  getTilePosition(x, y) { return this.worldManager.getTilePosition(x, y); }

  getMovementContextAt(x, y) { return this.worldManager.getMovementContextAt(x, y); }

  getBiomeKeyAtTile(tx, ty) { return this.worldManager.getBiomeKeyAtTile(tx, ty); }

  getNearestSettlementTierAt(tx, ty) { return this.worldManager.getNearestSettlementTierAt(tx, ty); }

  getNearestSettlementAt(tx, ty) { return this.worldManager.getNearestSettlementAt(tx, ty); }

  computeEncounterRiskContext() { return this.worldManager.computeEncounterRiskContext(); }

  updateTransientUIState() { return this.worldManager.updateTransientUIState(); }

  updateBattleSimulation(dt) { return this.battleManager.updateBattleSimulation(dt); }

  findNearestEnemy(unit, enemies) {
    return this.battleManager.findNearestEnemy(unit, enemies);
  }

  applyUnitDamage(attacker, target, baseDamage, context = {}) { return this.battleManager.applyUnitDamage(attacker, target, baseDamage, context); }

  spawnProjectile(shooter, target, list) {
    return this.battleManager.spawnProjectile(shooter, target, list);
  }

  spawnFloatingText(x, y, text, color = '#ffffff') {
    return this.battleManager.spawnFloatingText(x, y, text, color);
  }

  updateFloatingTexts(dt) {
    return this.battleManager.updateFloatingTexts(dt);
  }


  updatePlayerParty(dt) { return this.worldManager.updatePlayerParty(dt); }

  updateEnemyParties(dt) { return this.worldManager.updateEnemyParties(dt); }

  processWorldAiEncounters(encounters) { return this.worldManager.processWorldAiEncounters(encounters); }
  tryTriggerEncounter() { return this.worldManager.tryTriggerEncounter(); }
  triggerEncounter(enemy) { return this.worldManager.triggerEncounter(enemy); }

  // backward-compat: encounterMargin used in rendering (drawWorldMap)
  get encounterMargin() { return this.worldManager.encounterMargin; }

  // backward-compat: saveSystem, saveLoadCursor, saveLoadRows used in keyboard handler + game flow
  get saveSystem() { return this.saveManager.saveSystem; }
  set saveSystem(v) { this.saveManager.saveSystem = v; }
  get saveLoadCursor() { return this.saveManager.saveLoadCursor; }
  set saveLoadCursor(v) { this.saveManager.saveLoadCursor = v; }
  get saveLoadRows() { return this.saveManager.saveLoadRows; }

  // backward-compat: input handler refs & tracking state (destroy() compatibility)
  get keyboardHandler() { return this.inputManager?.keyboardHandler; }
  set keyboardHandler(v) { if (this.inputManager) this.inputManager.keyboardHandler = v; }
  get partyPointerHandler() { return this.inputManager?.partyPointerHandler; }
  set partyPointerHandler(v) { if (this.inputManager) this.inputManager.partyPointerHandler = v; }
  get partyPointerMoveHandler() { return this.inputManager?.partyPointerMoveHandler; }
  set partyPointerMoveHandler(v) { if (this.inputManager) this.inputManager.partyPointerMoveHandler = v; }
  get partyPointerUpHandler() { return this.inputManager?.partyPointerUpHandler; }
  set partyPointerUpHandler(v) { if (this.inputManager) this.inputManager.partyPointerUpHandler = v; }
  get partyContextMenuHandler() { return this.inputManager?.partyContextMenuHandler; }
  set partyContextMenuHandler(v) { if (this.inputManager) this.inputManager.partyContextMenuHandler = v; }
  get rightPointerTracking() { return this.inputManager?.rightPointerTracking ?? false; }
  set rightPointerTracking(v) { if (this.inputManager) this.inputManager.rightPointerTracking = v; }
  get rightPointerMoved() { return this.inputManager?.rightPointerMoved ?? false; }
  set rightPointerMoved(v) { if (this.inputManager) this.inputManager.rightPointerMoved = v; }
  get rightPointerStartX() { return this.inputManager?.rightPointerStartX ?? 0; }
  set rightPointerStartX(v) { if (this.inputManager) this.inputManager.rightPointerStartX = v; }
  get rightPointerStartY() { return this.inputManager?.rightPointerStartY ?? 0; }
  set rightPointerStartY(v) { if (this.inputManager) this.inputManager.rightPointerStartY = v; }

  // backward-compat: city cursor properties used in keyboard handler
  get cityOffers() { return this.economyManager.cityOffers; }
  set cityOffers(v) { this.economyManager.cityOffers = v; }
  get cityCursor() { return this.economyManager.cityCursor; }
  set cityCursor(v) { this.economyManager.cityCursor = v; }
  get cityMarketCursor() { return this.economyManager.cityMarketCursor; }
  set cityMarketCursor(v) { this.economyManager.cityMarketCursor = v; }
  get cityHealerCursor() { return this.economyManager.cityHealerCursor; }
  set cityHealerCursor(v) { this.economyManager.cityHealerCursor = v; }

  resolveEncounter(action) { return this.encounterManager.resolveEncounter(action); }

  enterRoster(enemyId) { return this.encounterManager.enterRoster(enemyId); }


  finishEncounterToMap(enemy, enemyId) { return this.encounterManager.finishEncounterToMap(enemy, enemyId); }

  applyEncounterPushback(enemy) { return this.encounterManager.applyEncounterPushback(enemy); }

  confirmRosterSelection() { return this.battleManager.confirmRosterSelection(); }

  createBattleUnitsFromRoster(roster, side) { return this.battleManager.createBattleUnitsFromRoster(roster, side); }

  updateUnitMoraleState(unit, moraleCfg) {
    return this.battleManager.updateUnitMoraleState(unit, moraleCfg);
  }

  tickBattleMorale(units, battle, dt, moraleCfg) {
    return this.battleManager.tickBattleMorale(units, battle, dt, moraleCfg);
  }

  placeBattleUnits(units, side) { return this.battleManager.placeBattleUnits(units, side); }


  moveRosterCursor(delta) { return this.encounterManager.moveRosterCursor(delta); }

  toggleRosterSelectionAtCursor() { return this.encounterManager.toggleRosterSelectionAtCursor(); }

  ensureInventoryModel() { return this.economyManager.ensureInventoryModel(); }
  getItemName(itemId) { return this.economyManager.getItemName(itemId); }
  getItemQty(itemId) { return this.economyManager.getItemQty(itemId); }
  addItem(itemId, name, qty = 1, unitValue = null) { return this.economyManager.addItem(itemId, name, qty, unitValue); }
  removeItem(itemId, qty) { return this.economyManager.removeItem(itemId, qty); }
  listInventoryForUI() { return this.economyManager.listInventoryForUI(); }

  buildAftermathPanelData() { return this.encounterManager.buildAftermathPanelData(); }



  setupCityServicesUI() { return this.cityManager.setupCityServicesUI(); }

  getOrCreateMarketForSettlement(settlement) { return this.economyManager.getOrCreateMarketForSettlement(settlement); }

  enterCityServices() { return this.economyManager.enterCityServices(); }
  exitCityServices() { return this.economyManager.exitCityServices(); }


  getLogisticsSpeedMult() { return this.economyManager.getLogisticsSpeedMult(); }

  setupCampUI() { return this.uiManager.setupCampUI(); }
  toggleCampMode() { return this.uiManager.toggleCampMode(); }


  setupBattleDeployUI() { return this.battleManager.setupBattleDeployUI(); }

  startBattleDeployment() { return this.battleManager.startBattleDeployment(); }

  confirmBattleDeployment() { return this.battleManager.confirmBattleDeployment(); }

  cancelBattleDeployment() { return this.battleManager.cancelBattleDeployment(); }

  setupBattleCommandsUI() { return this.battleManager.setupBattleCommandsUI(); }

  applyBattleCommand(cmd) { return this.battleManager.applyBattleCommand(cmd); }

  toggleBattleHoldFire(forceValue = null) { return this.battleManager.toggleBattleHoldFire(forceValue); }



  setupAccountingUI() { return this.uiManager.setupAccountingUI(); }
  closeAccountingModal() { return this.uiManager.closeAccountingModal(); }

  setupPoiUI() { return this.uiManager.setupPoiUI(); }
  getNearestInteractablePoi() {
    const nearest = PoiSystem.getNearestPoi(this.state?.map, this.playerParty?.x, this.playerParty?.y, CONST.WORLD.TILE_SIZE);
    if (!nearest || nearest.distTiles > CONST.POI.INTERACT_RADIUS_TILES) return null;
    return nearest;
  }

  updatePoiInteractHint() { return this.poiManager.updatePoiInteractHint(); }

  openPoiModal() { return this.poiManager.openPoiModal(); }

  investigateActivePoi() { return this.poiManager.investigateActivePoi(); }


  resolvePoiFollowup() { return this.poiManager.resolvePoiFollowup(); }

  getSettlementTier(settlement) { return this.economyManager.getSettlementTier(settlement); }
  getSettlementOpportunityKey(settlement) { return this.economyManager.getSettlementOpportunityKey(settlement); }
  cleanupExpiredMarketOpportunities(day = this.state?.day) { return this.economyManager.cleanupExpiredMarketOpportunities(day); }
  getActiveSettlementForCity() { return this.economyManager.getActiveSettlementForCity(); }

  generateRecruitOffersForSettlement(settlement) { return this.economyManager.generateRecruitOffersForSettlement(settlement); }
  ensureSettlementRecruitState(settlement, dayNow) { return this.economyManager.ensureSettlementRecruitState(settlement, dayNow); }
  ensureSettlementMarketState(settlement) { return this.economyManager.ensureSettlementMarketState(settlement); }
  ensureCityOffers() { return this.economyManager.ensureCityOffers(); }

  getWoundedUnits() {
    return this.battleManager.getWoundedUnits();
  }

  buildCityPanelData() { return this.economyManager.buildCityPanelData(); }

  recruitCurrentUnit(hireMax = false) { return this.economyManager.recruitCurrentUnit(hireMax); }

  tradeCurrentItem(deltaQty) { return this.economyManager.tradeCurrentItem(deltaQty); }

  healCurrentUnit() { return this.economyManager.healCurrentUnit(); }


  generateBattleLoot(result, battle) { return this.battleManager.generateBattleLoot(result, battle); }

  applyRosterOutcomeFromBattle(battle) { return this.battleManager.applyRosterOutcomeFromBattle(battle); }


  resolveBattle(result) { return this.battleManager.resolveBattle(result); }

  exitAftermathToMap(takeLoot = true) { return this.battleManager.exitAftermathToMap(takeLoot); }


  applyBattleExit(enemy, enemyId, pushbackDistance) { return this.battleManager.applyBattleExit(enemy, enemyId, pushbackDistance); }

  cleanupTemporaryEnemy(enemyId, opts) { return this.worldManager.cleanupTemporaryEnemy(enemyId, opts); }

  despawnEnemyParty(enemyId) { return this.worldManager.despawnEnemyParty(enemyId); }

  setLastEventLog(message, durationMs = 3000) { return this.gameFlowManager.setLastEventLog(message, durationMs); }

  setPlayerDestination(worldX, worldY) { return this.worldManager.setPlayerDestination(worldX, worldY); }

  completePlayerArrival() { return this.worldManager.completePlayerArrival(); }

  cancelPlayerDestination() { return this.worldManager.cancelPlayerDestination(); }

  isWorldPointOnParty(worldX, worldY, margin) { return this.worldManager.isWorldPointOnParty(worldX, worldY, margin); }

  setupPartyInputHandlers() { return this.inputManager.setupPartyInputHandlers(); }

  setupKeyboardShortcuts() { return this.inputManager.setupKeyboardShortcuts(); }


  ensureHudEventsButton() { return this.uiManager.ensureHudEventsButton(); }

  setupDOMReferences() { return this.uiManager.setupDOMReferences(); }

  setupSettingsUI() { return this.uiManager.setupSettingsUI(); }
  setupHelpOverlay() { return this.uiManager.setupHelpOverlay(); }

  toggleHelpOverlay(force = null) { return this.uiManager.toggleHelpOverlay(force); }

  setupDebugSmokePanel() { return this.devManager.setupDebugSmokePanel(); }
  appendSmokeResults(results) {
    if (!this.dom?.smokeResults) return;
    const rows = (results || []).map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.msg}`);
    this.dom.smokeResults.textContent = rows.join('\n');
  }

  async runSmokeScenarios() { return this.devManager.runSmokeScenarios(); }
  onModeChanged(oldMode, newMode) { return this.uiManager.onModeChanged(oldMode, newMode); }



  setupStartFlow() { return this.gameFlowManager.setupStartFlow(); }

  enterStart() { return this.gameFlowManager.enterStart(); }
  setupMenuActions() { return this.uiManager.setupMenuActions(); }
  enterMenu() { return this.gameFlowManager.enterMenu(); }

  startNewGame() { return this.gameFlowManager.startNewGame(); }

  continueGame() { return this.gameFlowManager.continueGame(); }

  openSettings() { return this.gameFlowManager.openSettings(); }

  closeSettings() { return this.gameFlowManager.closeSettings(); }

  applyMasterVolume(value) { return this.gameFlowManager.applyMasterVolume(value); }

  quitToMenu() {
    return this.enterMenu();
  }

  start() { return this.gameFlowManager.start(); }

  stop() { return this.gameFlowManager.stop(); }

  setPaused(isPaused) { return this.gameFlowManager.setPaused(isPaused); }

  togglePaused() { return this.gameFlowManager.togglePaused(); }

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

  toggleDebug() { return this.devManager.toggleDebug(); }
  buildSavePayload() { return this.saveManager.buildSavePayload(); }
  applySavePayload(payload, opts) { return this.saveManager.applySavePayload(payload, opts); }

  getSelectedSaveSlot() { return this.saveManager.getSelectedSaveSlot(); }

  openSaveLoadPanel() { return this.saveManager.openSaveLoadPanel(); }
  closeSaveLoadPanel() { return this.saveManager.closeSaveLoadPanel(); }

  buildSaveLoadPanelData() { return this.saveManager.buildSaveLoadPanelData(); }

  saveToSlot(slot) { return this.saveManager.saveToSlot(slot); }

  loadFromSlot(slot) { return this.saveManager.loadFromSlot(slot); }

  exportSelectedSaveToTextarea(slot) { return this.saveManager.exportSelectedSaveToTextarea(slot); }
  importTextareaToSlotAndLoad(slot) { return this.saveManager.importTextareaToSlotAndLoad(slot); }

  startAutosaveLoop() { return this.saveManager.startAutosaveLoop(); }
  stopAutosaveLoop() { return this.saveManager.stopAutosaveLoop(); }
  runAutosave(trigger) { return this.saveManager.runAutosave(trigger); }
  quickSave() { return this.saveManager.quickSave(); }
  quickLoad() { return this.saveManager.quickLoad(); }

  renderStart() { return this.renderManager.renderStart(); }

  renderMap() { return this.renderManager.renderMap(); }

  renderWorldTerrain(ctx, camera) { return this.renderManager.renderWorldTerrain(ctx, camera); }

  renderWorldOverlays(ctx, camera) { return this.renderManager.renderWorldOverlays(ctx, camera); }

  renderEncounter() { return this.renderManager.renderEncounter(); }

  renderCity() { return this.renderManager.renderCity(); }

  renderBattle() { return this.battleManager.renderBattle(); }


  renderDebugInfo() { return this.renderManager.renderDebugInfo(); }
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
