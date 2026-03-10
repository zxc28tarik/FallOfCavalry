/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';
import HUDManager from './ui/hud.js';
import AudioSystem from './systems/audio-system.js';
import * as CONST from './constants.js';
import * as PoiSystem from './systems/poi-system.js';
import * as suppliesSystem from './systems/supplies.js';
import * as campSystem from './systems/camp.js';
import { createInitialEventState } from './systems/events.js';
import { isDevMode, loadTuningFromStorage } from './systems/dev-gate.js';
import SpriteLoader from './rendering/sprite-loader.js';
// createInitialWorldAiState → WorldManager
import { createInitialRegionState } from './systems/region-state.js';
import { serializeSettings, deserializeSettings } from './systems/settings.js';
import { initWeatherLayer } from './rendering/weather-layer.js';
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
    // startScreen → GameFlowManager
    // cityUI → CityManager
    // campUI, accountingUI, settingsUI, codexUI, poiUI, helpOverlayVisible, minimapRenderer, listenersBound, weatherState → UIManager
    // battleCommandsUI, battleDeployMode, battleDeployUI, currentBattleTerrain, defeatPushbackDistance, enemyUnitsById → BattleManager
    // tuningUI, TuningUIClass, _tuningPauseMode → TuningManager
    // activePoi, pendingPoiAmbush → PoiManager
    // worldAi, enemyParties, worldEncounterPartyByEnemyId, lastEncounterEndTimeByEnemyId, currentTerrainStatus → WorldManager
    // playerRoster, enemyRoster, rosterCursorIndex, maxUnitsToDeploy, encounterPushbackDistance → EncounterManager
    // fogOfWar, _worldSeedCache, _crossingSet, _roadMask, _riverMask, _encounterRollByEnemyId, encounterMargin, encounterCooldownMs → WorldManager
    // keyboardHandler, partyPointerHandler, partyPointerMoveHandler, partyPointerUpHandler, partyContextMenuHandler → InputManager
    // rightPointerTracking, rightPointerMoved, rightPointerStartX, rightPointerStartY → InputManager
    // saveLoadRows, saveLoadCursor, saveLoadPreviousMode, autosaveIntervalMs, autosaveTimerId, lastAutosaveHudAt → SaveManager

    this.mode = 'menu'; // menu | playing | paused
    this.dom = {};

    this.resizeHandler = null;
    this.mouseWorldX = 0;
    this.mouseWorldY = 0;

    this.playerParty = null;
    this.followParty = false;

    this.spriteLoader = null;
    this.assetsReady = false;
    this.started = false;
    this.initialized = false;
    this.warnedKeys = new Set();
    utils.devLog(isDevMode(), '🎮 FallOfCavalry - Initializing...');
    this.init();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    utils.warnOnce(key, message);
  }

  // backward-compat: battle pools/state live in BattleManager
  get floatingTexts() { return this.battleManager?.floatingTexts; }
  get floatingTextPool() { return this.battleManager?.floatingTextPool; }
  get projectilePool() { return this.battleManager?.projectilePool; }
  get battleAnimPlayers() { return this.battleManager?.battleAnimPlayers; }

  // backward-compat: itemCatalog lives in EconomyManager
  get itemCatalog() { return this.economyManager?.itemCatalog; }

  // backward-compat: smokeResults lives in DevManager
  get smokeResults() { return this.devManager?.smokeResults; }
  set smokeResults(v) { if (this.devManager) this.devManager.smokeResults = v; }

  // backward-compat: UI sub-objects live in their owning managers
  get startScreen() { return this.gameFlowManager?.startScreen; }
  set startScreen(v) { if (this.gameFlowManager) this.gameFlowManager.startScreen = v; }
  get cityUI() { return this.cityManager?.cityUI; }
  set cityUI(v) { if (this.cityManager) this.cityManager.cityUI = v; }
  get campUI() { return this.uiManager?.campUI; }
  set campUI(v) { if (this.uiManager) this.uiManager.campUI = v; }
  get accountingUI() { return this.uiManager?.accountingUI; }
  set accountingUI(v) { if (this.uiManager) this.uiManager.accountingUI = v; }
  get settingsUI() { return this.uiManager?.settingsUI; }
  set settingsUI(v) { if (this.uiManager) this.uiManager.settingsUI = v; }
  get codexUI() { return this.uiManager?.codexUI; }
  set codexUI(v) { if (this.uiManager) this.uiManager.codexUI = v; }
  get poiUI() { return this.uiManager?.poiUI; }
  set poiUI(v) { if (this.uiManager) this.uiManager.poiUI = v; }
  get helpOverlayVisible() { return this.uiManager?.helpOverlayVisible ?? false; }
  set helpOverlayVisible(v) { if (this.uiManager) this.uiManager.helpOverlayVisible = v; }
  get battleCommandsUI() { return this.battleManager?.battleCommandsUI; }
  set battleCommandsUI(v) { if (this.battleManager) this.battleManager.battleCommandsUI = v; }
  get battleDeployMode() { return this.battleManager?.battleDeployMode; }
  set battleDeployMode(v) { if (this.battleManager) this.battleManager.battleDeployMode = v; }
  get battleDeployUI() { return this.battleManager?.battleDeployUI; }
  set battleDeployUI(v) { if (this.battleManager) this.battleManager.battleDeployUI = v; }
  get tuningUI() { return this.tuningManager?.tuningUI; }
  set tuningUI(v) { if (this.tuningManager) this.tuningManager.tuningUI = v; }
  get TuningUIClass() { return this.tuningManager?.TuningUIClass; }
  set TuningUIClass(v) { if (this.tuningManager) this.tuningManager.TuningUIClass = v; }
  get activePoi() { return this.poiManager?.activePoi; }
  set activePoi(v) { if (this.poiManager) this.poiManager.activePoi = v; }
  get pendingPoiAmbush() { return this.poiManager?.pendingPoiAmbush; }
  set pendingPoiAmbush(v) { if (this.poiManager) this.poiManager.pendingPoiAmbush = v; }

  // backward-compat: battle state fields live in BattleManager
  get currentBattleTerrain() { return this.battleManager?.currentBattleTerrain; }
  set currentBattleTerrain(v) { if (this.battleManager) this.battleManager.currentBattleTerrain = v; }
  get defeatPushbackDistance() { return this.battleManager?.defeatPushbackDistance ?? 120; }
  set defeatPushbackDistance(v) { if (this.battleManager) this.battleManager.defeatPushbackDistance = v; }
  get enemyUnitsById() { return this.battleManager?.enemyUnitsById; }
  set enemyUnitsById(v) { if (this.battleManager) this.battleManager.enemyUnitsById = v; }

  // backward-compat: encounter/roster fields live in EncounterManager
  get playerRoster() { return this.encounterManager?.playerRoster; }
  set playerRoster(v) { if (this.encounterManager) this.encounterManager.playerRoster = v; }
  get enemyRoster() { return this.encounterManager?.enemyRoster; }
  set enemyRoster(v) { if (this.encounterManager) this.encounterManager.enemyRoster = v; }
  get rosterCursorIndex() { return this.encounterManager?.rosterCursorIndex ?? 0; }
  set rosterCursorIndex(v) { if (this.encounterManager) this.encounterManager.rosterCursorIndex = v; }
  get maxUnitsToDeploy() { return this.encounterManager?.maxUnitsToDeploy ?? 8; }
  set maxUnitsToDeploy(v) { if (this.encounterManager) this.encounterManager.maxUnitsToDeploy = v; }
  get encounterPushbackDistance() { return this.encounterManager?.encounterPushbackDistance ?? 64; }
  set encounterPushbackDistance(v) { if (this.encounterManager) this.encounterManager.encounterPushbackDistance = v; }

  // backward-compat: world fields live in WorldManager
  get worldAi() { return this.worldManager?.worldAi; }
  set worldAi(v) { if (this.worldManager) this.worldManager.worldAi = v; }
  get enemyParties() { return this.worldManager?.enemyParties; }
  set enemyParties(v) { if (this.worldManager) this.worldManager.enemyParties = v; }
  get worldEncounterPartyByEnemyId() { return this.worldManager?.worldEncounterPartyByEnemyId; }
  set worldEncounterPartyByEnemyId(v) { if (this.worldManager) this.worldManager.worldEncounterPartyByEnemyId = v; }
  get lastEncounterEndTimeByEnemyId() { return this.worldManager?.lastEncounterEndTimeByEnemyId; }
  set lastEncounterEndTimeByEnemyId(v) { if (this.worldManager) this.worldManager.lastEncounterEndTimeByEnemyId = v; }
  get currentTerrainStatus() { return this.worldManager?.currentTerrainStatus ?? 'Arazi: normal'; }
  set currentTerrainStatus(v) { if (this.worldManager) this.worldManager.currentTerrainStatus = v; }

  // backward-compat: tuning pause state lives in TuningManager
  get _tuningPauseMode() { return this.tuningManager?._tuningPauseMode ?? null; }
  set _tuningPauseMode(v) { if (this.tuningManager) this.tuningManager._tuningPauseMode = v; }

  // backward-compat: UI renderer/listener fields live in UIManager
  get minimapRenderer() { return this.uiManager?.minimapRenderer; }
  set minimapRenderer(v) { if (this.uiManager) this.uiManager.minimapRenderer = v; }
  get listenersBound() { return this.uiManager?.listenersBound ?? false; }
  set listenersBound(v) { if (this.uiManager) this.uiManager.listenersBound = v; }
  get weatherState() { return this.uiManager?.weatherState; }
  set weatherState(v) { if (this.uiManager) this.uiManager.weatherState = v; }
  ensureTutorialState() { return this.uiManager.ensureTutorialState(); }
  ensureTuningState() { return this.tuningManager.ensureTuningState(); }
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
  getWeatherRegionId() { return this.uiManager.getWeatherRegionId(); }
  refreshWeatherState(dayIndex = Number(this.state?.day ?? 1)) { return this.uiManager.refreshWeatherState(dayIndex); }
  getWeatherConfig() { return this.uiManager.getWeatherConfig(); }
  getBattleFxConfig() { return this.battleManager.getBattleFxConfig(); }
  getBattleCameraConfig() { return this.battleManager.getBattleCameraConfig(); }
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
    this.tuningManager = this.tuningManager || new TuningManager(this.state);
    this.tuningManager.init(this);
    this.uiManager = this.uiManager || new UIManager(this.state);
    this.uiManager.init(this);
    this.ensureTutorialState();
    this.ensureTuningState();
    this.settings = deserializeSettings(this.state?.settings, CONST.SETTINGS);
    this.state.settings = serializeSettings(this.settings);
    this.diplomacyManager = this.diplomacyManager || new DiplomacyManager(this.state);
    this.diplomacyManager.init(this);
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

  async loadSpriteAssets() { return this.renderManager.loadSpriteAssets(); }
  async reloadSpriteAssets() { return this.renderManager.reloadSpriteAssets(); }
  getPoiSpriteKey(poiType) { return this.poiManager.getPoiSpriteKey(poiType); }
  ensureBattleUnitFx(unit) { return this.battleManager.ensureBattleUnitFx(unit); }
  getUnitAnimationKey(unit) { return this.battleManager.getUnitAnimationKey(unit); }
  getBattleAnimPlayer(unit) { return this.battleManager.getBattleAnimPlayer(unit); }
  drawBattleUnitFallback(ctx, unit, x, y, size) { return this.battleManager.drawBattleUnitFallback(ctx, unit, x, y, size); }
  drawUnitSpriteOrFallback(ctx, unit, x, y, size, now) { return this.battleManager.drawUnitSpriteOrFallback(ctx, unit, x, y, size, now); }
  setupCanvas() { return this.uiManager.setupCanvas(); }
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
  ensureRosterUnitState(unit) { return this.battleManager.ensureRosterUnitState(unit); }
  ensureRosterState() { return this.worldManager.ensureRosterState(); }
  initRosters() { return this.encounterManager.initRosters(); }
  getEnemyUnits(enemyId) { return this.battleManager.getEnemyUnits(enemyId); }
  applyDifficultyToEnemyUnit(unit) { return this.battleManager.applyDifficultyToEnemyUnit(unit); }
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
  findNearestEnemy(unit, enemies) { return this.battleManager.findNearestEnemy(unit, enemies); }
  applyUnitDamage(attacker, target, baseDamage, context = {}) { return this.battleManager.applyUnitDamage(attacker, target, baseDamage, context); }
  spawnProjectile(shooter, target, list) { return this.battleManager.spawnProjectile(shooter, target, list); }
  spawnFloatingText(x, y, text, color = '#ffffff') { return this.battleManager.spawnFloatingText(x, y, text, color); }
  updateFloatingTexts(dt) { return this.battleManager.updateFloatingTexts(dt); }
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
  updateUnitMoraleState(unit, moraleCfg) { return this.battleManager.updateUnitMoraleState(unit, moraleCfg); }
  tickBattleMorale(units, battle, dt, moraleCfg) { return this.battleManager.tickBattleMorale(units, battle, dt, moraleCfg); }
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
  getNearestInteractablePoi() { return this.poiManager.getNearestInteractablePoi(); }
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
  getWoundedUnits() { return this.battleManager.getWoundedUnits(); }
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
  appendSmokeResults(results) { return this.devManager.appendSmokeResults(results); }
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
  quitToMenu() { return this.enterMenu(); }
  start() { return this.gameFlowManager.start(); }
  stop() { return this.gameFlowManager.stop(); }
  setPaused(isPaused) { return this.gameFlowManager.setPaused(isPaused); }
  togglePaused() { return this.gameFlowManager.togglePaused(); }
  isPaused() { return this.mode === 'paused'; }
  destroy() { return this.gameFlowManager.destroy(); }
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
