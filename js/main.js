/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';
import HUDManager from './ui/hud.js';
import AudioSystem from './systems/audio-system.js';
import { isDevMode } from './systems/dev-gate.js';
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
import { QuestManager } from './managers/QuestManager.js';
import { QuestGenerator } from './systems/QuestGenerator.js';
import QuestCompletionOverlay from './ui/QuestCompletionOverlay.js';

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
    // campUI, accountingUI, settingsUI, codexUI, poiUI, helpOverlayVisible, listenersBound, weatherState → UIManager
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

  quitToMenu() { return this.gameFlowManager.enterMenu(); }

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
    this.modeManager = this.state.modeManager;
    this.battleManager = this.battleManager || new BattleManager(this.state);
    this.battleManager.init(this);
    this.worldManager = this.worldManager || new WorldManager(this.state);
    this.worldManager.init(this);
    this.economyManager = this.economyManager || new EconomyManager(this.state);
    this.economyManager.init(this);
    this.poiManager = this.poiManager || new PoiManager(this.state);
    this.poiManager.init(this);
    this.tuningManager = this.tuningManager || new TuningManager(this.state);
    this.tuningManager.init(this);
    this.uiManager = this.uiManager || new UIManager(this.state);
    this.uiManager.init(this);
    this.uiManager.ensureTutorialState();
    this.tuningManager.ensureTuningState();
    this.diplomacyManager = this.diplomacyManager || new DiplomacyManager(this.state);
    this.diplomacyManager.init(this);
    this.diplomacyManager.ensureFactionState();
    this.state.devMode = isDevMode();
    this.uiManager.applyDevOnlyDomLock();
    this.input = this.input || new InputManager(this.canvas);
    this.gameLoop = this.gameLoop || new GameLoop(this.state, this.input, null);
    this.hudManager = this.hudManager || new HUDManager(this.state);
    this.saveManager = this.saveManager || new SaveManager(this.state);
    this.saveManager.init(this);
    this.inputManager = this.inputManager || new GameInputManager(this.state);
    this.inputManager.init(this);
    this.renderManager = this.renderManager || new RenderManager(this.state);
    this.renderManager.init(this);
    this.cityManager = this.cityManager || new CityManager(this.state);
    this.cityManager.init(this);
    this.questGenerator = this.questGenerator || new QuestGenerator(this.worldManager, this.cityManager, this.economyManager, this.diplomacyManager);
    this.questManager = this.questManager || new QuestManager(this.modeManager, this.worldManager, this.questGenerator);
    this.questCompletionOverlay = this.questCompletionOverlay || new QuestCompletionOverlay({ modeManager: this.modeManager, questManager: this.questManager });
    this.state.on?.('overlay:pushed', ({ panel, context }) => {
      if (panel === 'questCompletion') this.questCompletionOverlay.show(context);
    });
    this.state.on?.('overlay:popped', ({ panel }) => {
      if (panel?.name === 'questCompletion') this.questCompletionOverlay.hide();
    });
    this.encounterManager = this.encounterManager || new EncounterManager(this.state);
    this.encounterManager.init(this);
    this.devManager = this.devManager || new DevManager(this.state);
    this.devManager.init(this);
    this.gameFlowManager = this.gameFlowManager || new GameFlowManager(this.state);
    this.gameFlowManager.init(this);
    // Quest completion is the event authority. Character effects are guarded
    // by a separate, currently EMPTY reviewed policy catalog.
    this.questManager.onQuestCompleted = (receipt) =>
      this.gameFlowManager.applyVerifiedQuestCharacterOutcome(receipt);
    this.audioSystem = this.audioSystem || new AudioSystem();

    this.uiManager.setupCanvas();
    initWeatherLayer(this.uiManager.getWeatherConfig());
    this.uiManager.setupEventListeners();
    this.worldManager.initPlayerParty();
    this.uiManager.refreshWeatherState(this.state?.day ?? 1);
    this.inputManager.setupPartyInputHandlers();
    this.uiManager.setupDOMReferences();
    this.uiManager.ensureHudEventsButton();
    this.hudManager?.setupElements?.();
    this.hudManager?.setupListeners?.();
    this.uiManager.updateBuildInfoBadge();
    this.uiManager.applyDevOnlyDomLock();
    this.uiManager.setupSettingsUI();
    this.uiManager.setupWorldMapOverlay();
    this.uiManager.setupHelpOverlay();
    this.uiManager.setupMenuActions();
    this.gameFlowManager.setupStartFlow();
    this.cityManager.setupCityServicesUI();
    this.uiManager.setupCampUI();
    this.battleManager.setupBattleCommandsUI();
    this.battleManager.setupBattleDeployUI();
    this.uiManager.setupAccountingUI();
    this.uiManager.setupPoiUI();
    this.gameFlowManager.enterStart();
    this.uiManager.onModeChanged(this.state.mode, this.state.mode);
    this.renderManager.loadSpriteAssets();

    if (typeof window !== 'undefined') {
      window.game = this;
      window.STATE = this.state;
    }

    this.initialized = true;
    utils.devLog(this.state, '✅ FallOfCavalry - Ready!');
    return true;
  }

  get cityUI() {
    return this.cityManager?.cityUI || null;
  }

  set cityUI(value) {
    if (this.cityManager) this.cityManager.cityUI = value;
  }

  setupCityServicesUI() {
    return this.cityManager?.setupCityServicesUI?.();
  }

  buildCityPanelData() {
    return this.economyManager?.buildCityPanelData?.();
  }

  buildBattleResultPanelData() {
    return this.encounterManager?.buildBattleResultPanelData?.();
  }

  getCityFactionContext(settlement) {
    return this.diplomacyManager?.getCityFactionContext?.(settlement) || null;
  }

  ensureInventoryModel() {
    return this.economyManager?.ensureInventoryModel?.();
  }

  getItemName(itemId) {
    return this.economyManager?.getItemName?.(itemId) || itemId;
  }

  getWoundedUnits() {
    return this.battleManager?.getWoundedUnits?.() || [];
  }

  setLastEventLog(...args) {
    return this.gameFlowManager?.setLastEventLog?.(...args);
  }

  runAutosave(...args) {
    return this.saveManager?.runAutosave?.(...args);
  }

  updateTransientUIState() {
    return this.worldManager?.updateTransientUIState?.();
  }

  refreshCurrentEventsSummary(...args) {
    return this.gameFlowManager?.refreshCurrentEventsSummary?.(...args) || [];
  }

  getEffectiveTuning() {
    return this.tuningManager?.getEffectiveTuning?.() || {};
  }

  getWorldAiCfgWithRegionMods() {
    return this.worldManager?.getWorldAiCfgWithRegionMods?.() || {};
  }

  getSelectedRosterCount() {
    return (this.encounterManager?.playerRoster || []).filter((u) => u?.selected && (u?.count ?? 0) > 0).length;
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
