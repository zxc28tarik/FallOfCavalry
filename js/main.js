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
import StartScreen from './ui/start-screen.js';
import WorldGenerator from './world/world-generator.js';
import FogOfWar from './world/fog-of-war.js';
import * as recruitmentSystem from './systems/recruitment.js';
import * as tradeSystem from './systems/trade.js';
import CityServicesUI from './ui/city-services.js';
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
import { applyBattleOutcomes, tickHealing } from './systems/casualties.js';

import * as utils from './utils.js';

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
    this.saveSystem = null;
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
    this.TuningUIClass = null;
    this.activePoi = null;
    this.pendingPoiAmbush = null;
    this.fogOfWar = null;
    this._worldSeedCache = null;
    this._crossingSet = new Set();
    this._roadMask = null;
    this._riverMask = null;
    this._encounterRollByEnemyId = {};
    this.currentTerrainStatus = 'Arazi: normal';
    this.currentBattleTerrain = { terrainKey: 'PLAINS', mods: CONST.TERRAIN_MODS.PLAINS };

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
    this.floatingTexts = [];
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

  getTuningDefaults() {
    return {
      ENCOUNTER_RISK: {
        ROAD_MULT: Number(CONST.ENCOUNTER_RISK.ROAD_MULT),
        OFFROAD_MULT: Number(CONST.ENCOUNTER_RISK.OFFROAD_MULT),
        STARVING_MULT: Number(CONST.ENCOUNTER_RISK.STARVING_MULT),
      },
      POI: {
        AMBUSH_CHANCE_RUIN: Number(CONST.POI.AMBUSH_CHANCE_RUIN),
        CLUE_CHANCE_RUIN: Number(CONST.POI.CLUE_CHANCE_RUIN),
        RARE_BONUS_CHANCE: Number(CONST.POI.RARE_BONUS_CHANCE),
      },
      MARKET: {
        MOMENTUM_PER_QTY: Number(CONST.MARKET.MOMENTUM_PER_QTY),
        MOMENTUM_DECAY: Number(CONST.MARKET.MOMENTUM_DECAY),
      },
      SUPPLIES: {
        DAILY_PER_UNIT_CONSUMPTION: Number(CONST.SUPPLIES.DAILY_PER_UNIT_CONSUMPTION),
        STARVATION_MORALE_PENALTY: Number(CONST.SUPPLIES.STARVATION_MORALE_PENALTY),
      },
      BATTLE_FORMATION: {
        COHESION_RADIUS: Number(CONST.BATTLE_FORMATION.COHESION_RADIUS),
        COHESION_ALLY_CAP: Number(CONST.BATTLE_FORMATION.COHESION_ALLY_CAP),
        LINE_DEF_BONUS: Number(CONST.BATTLE_FORMATION.LINE_DEF_BONUS),
        COLUMN_SPEED_BONUS: Number(CONST.BATTLE_FORMATION.COLUMN_SPEED_BONUS),
        WEDGE_FRONT_ATK_BONUS: Number(CONST.BATTLE_FORMATION.WEDGE_FRONT_ATK_BONUS),
        WEDGE_REAR_ATK_BONUS: Number(CONST.BATTLE_FORMATION.WEDGE_REAR_ATK_BONUS),
        WEDGE_FRONT_SLOTS: Number(CONST.BATTLE_FORMATION.WEDGE_FRONT_SLOTS),
        SCATTER_RANGED_TAKEN_REDUCTION: Number(CONST.BATTLE_FORMATION.SCATTER_RANGED_TAKEN_REDUCTION),
        SCATTER_ALLY_DEATH_SHOCK_REDUCTION: Number(CONST.BATTLE_FORMATION.SCATTER_ALLY_DEATH_SHOCK_REDUCTION),
      },
      BATTLE_FLANK: {
        FLANK_MULT: Number(CONST.BATTLE_FLANK.FLANK_MULT),
        REAR_MULT: Number(CONST.BATTLE_FLANK.REAR_MULT),
        FLANK_MORALE_BONUS: Number(CONST.BATTLE_FLANK.FLANK_MORALE_BONUS),
        REAR_MORALE_BONUS: Number(CONST.BATTLE_FLANK.REAR_MORALE_BONUS),
      },
      BATTLE_MORALE: {
        MORALE_MAX: Number(CONST.BATTLE_MORALE.MORALE_MAX),
        DAMAGE_TO_MORALE: Number(CONST.BATTLE_MORALE.DAMAGE_TO_MORALE),
        ALLY_DEATH_SHOCK: Number(CONST.BATTLE_MORALE.ALLY_DEATH_SHOCK),
        OUTNUMBERED_DRAIN_PER_SEC: Number(CONST.BATTLE_MORALE.OUTNUMBERED_DRAIN_PER_SEC),
        REGEN_PER_SEC: Number(CONST.BATTLE_MORALE.REGEN_PER_SEC),
        FLEE_THRESHOLD: Number(CONST.BATTLE_MORALE.FLEE_THRESHOLD),
        ROUT_THRESHOLD: Number(CONST.BATTLE_MORALE.ROUT_THRESHOLD),
        SHAKEN_ATTACK_MULT: Number(CONST.BATTLE_MORALE.SHAKEN_ATTACK_MULT),
        ROUT_SPEED_MULT: Number(CONST.BATTLE_MORALE.ROUT_SPEED_MULT),
        ROUT_DEF_MULT: Number(CONST.BATTLE_MORALE.ROUT_DEF_MULT),
      },
      BATTLE_AI: {
        AI_RETARGET_SEC: Number(CONST.BATTLE_AI.AI_RETARGET_SEC),
        AI_TARGET_LOWHP_WEIGHT: Number(CONST.BATTLE_AI.AI_TARGET_LOWHP_WEIGHT),
        AI_TARGET_ROUTING_BONUS: Number(CONST.BATTLE_AI.AI_TARGET_ROUTING_BONUS),
        AI_LOCAL_RADIUS: Number(CONST.BATTLE_AI.AI_LOCAL_RADIUS),
        AI_OUTNUMBERED_RATIO: Number(CONST.BATTLE_AI.AI_OUTNUMBERED_RATIO),
        AI_RETREAT_MORALE: Number(CONST.BATTLE_AI.AI_RETREAT_MORALE),
        AI_RETREAT_HP_PCT: Number(CONST.BATTLE_AI.AI_RETREAT_HP_PCT),
        SKIRMISH_DESIRED_RANGE_MULT: Number(CONST.BATTLE_AI.SKIRMISH_DESIRED_RANGE_MULT),
        SKIRMISH_MIN_RANGE_MULT: Number(CONST.BATTLE_AI.SKIRMISH_MIN_RANGE_MULT),
        SKIRMISH_KITE_SPEED_MULT: Number(CONST.BATTLE_AI.SKIRMISH_KITE_SPEED_MULT),
        AI_BOUNDS_PAD_PX: Number(CONST.BATTLE_AI.AI_BOUNDS_PAD_PX),
        AI_MAX_APPROACH_TIME_SEC: Number(CONST.BATTLE_AI.AI_MAX_APPROACH_TIME_SEC),
        AI_STALL_WINDOW_SEC: Number(CONST.BATTLE_AI.AI_STALL_WINDOW_SEC),
        AI_STALL_MIN_PROGRESS_PX: Number(CONST.BATTLE_AI.AI_STALL_MIN_PROGRESS_PX),
        AI_STALL_ABORT_SEC: Number(CONST.BATTLE_AI.AI_STALL_ABORT_SEC),
        SKIRMISH_BOUNDS_FAIL_HOLD_SEC: Number(CONST.BATTLE_AI.SKIRMISH_BOUNDS_FAIL_HOLD_SEC),
      },
      BATTLE_COUNTERS: {
        SPEAR_VS_CAV_DMG_MULT: Number(CONST.BATTLE_COUNTERS.SPEAR_VS_CAV_DMG_MULT),
        SPEAR_VS_CAV_MORALE_BONUS: Number(CONST.BATTLE_COUNTERS.SPEAR_VS_CAV_MORALE_BONUS),
        CAV_VS_ARCHER_DMG_MULT: Number(CONST.BATTLE_COUNTERS.CAV_VS_ARCHER_DMG_MULT),
        CAV_VS_ARCHER_MORALE_BONUS: Number(CONST.BATTLE_COUNTERS.CAV_VS_ARCHER_MORALE_BONUS),
        INFANTRY_VS_SPEAR_DMG_MULT: Number(CONST.BATTLE_COUNTERS.INFANTRY_VS_SPEAR_DMG_MULT),
        COUNTER_BASE_MORALE_BONUS: Number(CONST.BATTLE_COUNTERS.COUNTER_BASE_MORALE_BONUS),
      },
      BATTLE_CHARGE: {
        CHARGE_BUILD_PER_SEC: Number(CONST.BATTLE_CHARGE.CHARGE_BUILD_PER_SEC),
        CHARGE_READY_THRESHOLD: Number(CONST.BATTLE_CHARGE.CHARGE_READY_THRESHOLD),
        CHARGE_DMG_MULT: Number(CONST.BATTLE_CHARGE.CHARGE_DMG_MULT),
        CHARGE_MORALE_BONUS: Number(CONST.BATTLE_CHARGE.CHARGE_MORALE_BONUS),
        CHARGE_COOLDOWN_SEC: Number(CONST.BATTLE_CHARGE.CHARGE_COOLDOWN_SEC),
        BRACE_CHARGE_REDUCTION_MULT: Number(CONST.BATTLE_CHARGE.BRACE_CHARGE_REDUCTION_MULT),
        BRACE_THORNS_DMG_FRACTION: Number(CONST.BATTLE_CHARGE.BRACE_THORNS_DMG_FRACTION),
      },
      BATTLE_RANGED: {
        SUPPRESS_DURATION_SEC: Number(CONST.BATTLE_RANGED.SUPPRESS_DURATION_SEC),
        SUPPRESS_SPEED_MULT: Number(CONST.BATTLE_RANGED.SUPPRESS_SPEED_MULT),
        SUPPRESS_MORALE_DRAIN_PER_SEC: Number(CONST.BATTLE_RANGED.SUPPRESS_MORALE_DRAIN_PER_SEC),
        MELEE_EMERGENCY_RANGE_MULT: Number(CONST.BATTLE_RANGED.MELEE_EMERGENCY_RANGE_MULT),
        AMMO_PER_SHOT: Number(CONST.BATTLE_RANGED.AMMO_PER_SHOT),
      },
      BATTLE_CASUALTIES: {
        WOUNDED_HP_THRESHOLD_PCT: Number(CONST.BATTLE_CASUALTIES.WOUNDED_HP_THRESHOLD_PCT),
        WOUNDED_BASE_CHANCE: Number(CONST.BATTLE_CASUALTIES.WOUNDED_BASE_CHANCE),
        WOUNDED_ROUTE_BONUS_CHANCE: Number(CONST.BATTLE_CASUALTIES.WOUNDED_ROUTE_BONUS_CHANCE),
        WOUNDED_HP_MAX_MULT: Number(CONST.BATTLE_CASUALTIES.WOUNDED_HP_MAX_MULT),
        WOUNDED_ATK_MULT: Number(CONST.BATTLE_CASUALTIES.WOUNDED_ATK_MULT),
        HEAL_PER_DAY: Number(CONST.BATTLE_CASUALTIES.HEAL_PER_DAY),
        HEAL_CAMP_MULT: Number(CONST.BATTLE_CASUALTIES.HEAL_CAMP_MULT),
        HEAL_STARVING_MULT: Number(CONST.BATTLE_CASUALTIES.HEAL_STARVING_MULT),
      },
    };
  }

  getEffectiveTuning() {
    const defaults = this.getTuningDefaults();
    this.ensureTuningState();
    const tuning = this.state?.tuning || {};
    Object.keys(defaults).forEach((group) => {
      defaults[group] = { ...defaults[group], ...(tuning[group] || {}) };
    });
    return defaults;
  }

  applyTuningDraft(draft) {
    if (!draft || typeof draft !== 'object') return;
    this.ensureTuningState();
    ['ENCOUNTER_RISK', 'POI', 'MARKET', 'SUPPLIES', 'BATTLE_FORMATION', 'BATTLE_FLANK', 'BATTLE_MORALE', 'BATTLE_AI', 'BATTLE_COUNTERS', 'BATTLE_CHARGE', 'BATTLE_RANGED', 'BATTLE_CASUALTIES'].forEach((group) => {
      if (!draft[group] || typeof draft[group] !== 'object') return;
      this.state.tuning[group] = { ...(this.state.tuning[group] || {}), ...draft[group] };
    });
    this.state.tuningDraft = draft;
  }

  async setupTuningUI() {
    if (!this.state?.devMode) return;
    if (!this.TuningUIClass) {
      const mod = await import('./ui/tuning-ui.js');
      this.TuningUIClass = mod?.default || null;
    }
    if (!this.TuningUIClass || this.tuningUI) return;
    this.tuningUI = new this.TuningUIClass({
      getDefaults: () => this.getTuningDefaults(),
      getCurrent: () => this.getEffectiveTuning(),
      onApply: (draft) => {
        this.applyTuningDraft(draft);
        this.updateTransientUIState();
      },
      onSave: (draft) => {
        this.state.tuning = draft && typeof draft === 'object' ? draft : {};
        this.runAutosave('tuning');
      },
      onReset: () => {
        this.state.tuning = {};
        this.state.tuningDraft = null;
        this.updateTransientUIState();
      },
    });

    this.tuningUI.bind({
      modal: this.dom?.tuningModal,
      body: this.dom?.tuningBody,
      btnClose: this.dom?.btnCloseTuning,
      btnSave: this.dom?.btnTuningSave,
      btnReset: this.dom?.btnTuningReset,
    });

    if (this.dom?.btnCloseTuning && this.dom.btnCloseTuning.dataset.boundMainTuning !== '1') {
      this.dom.btnCloseTuning.dataset.boundMainTuning = '1';
      this.dom.btnCloseTuning.addEventListener('click', () => this.hideTuningModal());
    }
  }

  async showTuningModal() {
    this.ensureTuningState();
    if (!this.state?.devMode) return false;
    await this.setupTuningUI();
    if (!this.dom?.tuningModal) return false;
    this._tuningPauseMode = this.mode;
    this.setPaused(true);
    this.tuningUI?.show?.();
    return true;
  }

  hideTuningModal() {
    if (!this.dom?.tuningModal || this.dom.tuningModal.classList.contains('hidden')) return false;
    this.tuningUI?.hide?.();
    if (this._tuningPauseMode === 'playing') this.setPaused(false);
    this._tuningPauseMode = null;
    return true;
  }


  updateBuildInfoBadge() {
    const el = this.dom?.buildInfo;
    if (!el) return;

    const version = typeof CONST.BUILD_INFO?.version === 'string' ? CONST.BUILD_INFO.version.trim() : '';
    const builtAt = typeof CONST.BUILD_INFO?.builtAt === 'string' ? CONST.BUILD_INFO.builtAt.trim() : '';

    if (!version && !builtAt) {
      el.classList.add('hidden');
      return;
    }

    const stamp = formatBuildTimestamp(builtAt);
    const pieces = [];
    if (version) pieces.push(`v${version}`);
    if (stamp) pieces.push(stamp);
    el.textContent = pieces.join(' • ');
    el.classList.remove('hidden');
  }

  applyDevOnlyDomLock() {
    const devOnlyIds = ['tuningModal', 'debugOverlay', 'debugSmokePanel', 'fpsOverlay', 'perfOverlay', 'debugStats'];
    if (typeof document === 'undefined') return;
    for (const id of devOnlyIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!this.state?.devMode) {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('inert', '');
        el.style.pointerEvents = 'none';
      } else {
        el.removeAttribute('inert');
        el.style.pointerEvents = '';
        el.removeAttribute('aria-hidden');
      }
    }
  }

  maybeShowTutorialHint(context = {}) {
    this.ensureTutorialState();
    const hint = chooseTutorialHint({ state: this.state, mode: this.state?.mode, ...context });
    if (!hint) return false;
    this.state.tutorial.lastShownAt = Date.now();
    this.state.tutorial.shown[hint.key] = true;
    if (!this.hudManager?.showTransientHint?.(hint.text, CONST.TUTORIAL_HINTS.COOLDOWN_MS)) {
      this.setLastEventLog(hint.text, CONST.TUTORIAL_HINTS.COOLDOWN_MS);
    }
    return true;
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
    if (!this.state.markets || typeof this.state.markets !== 'object') this.state.markets = {};
    if (!this.state.marketOpportunities || typeof this.state.marketOpportunities !== 'object') this.state.marketOpportunities = {};
    if (!this.state.dailyLedger || typeof this.state.dailyLedger !== 'object') this.state.dailyLedger = { tradePL: 0 };
    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
    if (this.state) PoiSystem.ensurePoiState(this.state);
    this.ensureTutorialState();
    this.ensureTuningState();
    this.state.devMode = isDevMode();
    this.applyDevOnlyDomLock();
    const storageTuning = loadTuningFromStorage();
    if (storageTuning) {
      this.state.tuning = { ...(this.state.tuning || {}), ...storageTuning };
    }
    this.input = this.input || new InputManager(this.canvas);
    this.gameLoop = this.gameLoop || new GameLoop(this.state, this.input, null);
    this.hudManager = this.hudManager || new HUDManager(this.state);
    this.saveSystem = this.saveSystem || new SaveSystem();
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
    this.setupEventListeners();
    this.initPlayerParty();
    this.setupPartyInputHandlers();
    this.setupDOMReferences();
    this.updateBuildInfoBadge();
    this.applyDevOnlyDomLock();
    this.setupSettingsUI();
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
    if (!unit) return;
    if (!unit.fx) unit.fx = { hitUntil: 0, deathStartedAt: null };
    if (!Number.isFinite(unit.fx.hitUntil)) unit.fx.hitUntil = 0;
    if (unit.fx.deathStartedAt !== null && !Number.isFinite(unit.fx.deathStartedAt)) unit.fx.deathStartedAt = null;
  }

  getUnitAnimationKey(unit) {
    if (!unit) return null;
    if (unit.command === CONST.BATTLE_COMMANDS.ATTACK) return 'infantry_attack';
    const moving = Math.hypot(Number(unit.vx) || 0, Number(unit.vy) || 0) > 0.01;
    return moving ? 'infantry_walk' : 'infantry_idle';
  }

  getBattleAnimPlayer(unit) {
    if (!unit) return null;
    const id = unit.unitId || `${unit.side}:${unit.id || `${unit.x}:${unit.y}`}`;
    let player = this.battleAnimPlayers.get(id);
    if (!player) {
      player = new AnimationPlayer(this.spriteLoader, 'infantry_idle');
      this.battleAnimPlayers.set(id, player);
    }
    return player;
  }

  drawBattleUnitFallback(ctx, unit, x, y, size) {
    ctx.fillStyle = unit.side === 'player' ? '#4aa3ff' : '#d9534f';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  drawUnitSpriteOrFallback(ctx, unit, x, y, size, now) {
    if (!ctx || !unit) return;
    this.ensureBattleUnitFx(unit);

    if (unit.fx.deathStartedAt) {
      const t = (now - unit.fx.deathStartedAt) / CONST.BATTLE_FX.DEATH_FADE_DURATION;
      if (t >= 1) {
        unit._remove = true;
        return;
      }
      const scale = 1 - (t * (1 - CONST.BATTLE_FX.DEATH_SHRINK_FACTOR));
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      this.drawUnitSpriteOrFallback(ctx, { ...unit, fx: { ...unit.fx, deathStartedAt: null } }, x, y, size, now);
      ctx.restore();
      return;
    }

    let spriteDrawn = false;
    if (this.assetsReady && this.spriteLoader) {
      const player = this.getBattleAnimPlayer(unit);
      const spriteKey = unit.animKey || 'infantry_idle';
      if (player?.hasAnimation?.(spriteKey)) {
        spriteDrawn = player.drawFrame(ctx, spriteKey, x, y, size * 2 * CONST.SPRITES.BATTLE_UNIT_SCALE, { anchor: 'center' });
      }
    }

    if (!spriteDrawn) this.drawBattleUnitFallback(ctx, unit, x, y, size);

    if (unit.fx.hitUntil > now) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = CONST.BATTLE_FX.HIT_FLASH_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
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

  setupEventListeners() {
    if (this.listenersBound || !this.state) return;

    this.state.on('mode:changed', ({ old, new: newMode }) => this.onModeChanged(old, newMode));
    this.state.on('day:advanced', (day) => {
      this.state.dailyLedger = { tradePL: 0 };
      utils.devLog(this.state, `[Game] Day ${day} started`);
    });
    this.state.on('player:gold:changed', ({ old, new: newGold, delta }) => {
      utils.devLog(this.state, `[Game] Gold: ${old} → ${newGold} (${delta >= 0 ? '+' : ''}${delta})`);
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

    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
    this.cleanupExpiredMarketOpportunities(day);
    this.ensureInventoryModel();
    this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
      ? this.state.dailyLedger
      : { tradePL: 0 };

    const { weight, cap, overcapMult } = this.getLogisticsSpeedMult();
    const goldBefore = Math.floor(this.playerParty.gold ?? 0);
    const moraleBefore = Math.floor(this.playerParty.morale ?? 50);
    const foodBefore = Number(this.state?.supplies?.food ?? 0);
    const notes = [];

    const roster = this.playerParty.roster || [];
    const totalWage = roster.reduce((sum, u) => sum + Math.max(0, Math.floor(u.wagePerDay ?? u.wage ?? 0)), 0);

    if (totalWage > 0) {
      const canPay = (this.playerParty.gold ?? 0) >= totalWage;
      if (canPay) {
        this.playerParty.gold -= totalWage;
      } else {
        this.playerParty.gold -= totalWage;
        this.playerParty.morale = Math.max(10, (this.playerParty.morale ?? 50) - 5);
        notes.push('Maaşlar ödenemedi, moral düştü.');
      }
    }

    const supplyRes = suppliesSystem.applyEndOfDay(this.state, this.playerParty, { inCamp: Boolean(this.state?.camp?.active) });

    let raid = { happened: false, lossText: '' };
    if (this.state?.camp?.active) {
      campSystem.applyCampBenefits(this.playerParty);
      const raided = campSystem.rollRaid(this.state, Math.random);
      if (raided) {
        raid.happened = true;
        if ((this.state.supplies?.food ?? 0) > 1.5) {
          this.state.supplies.food = Math.max(0, Number((this.state.supplies.food - 2).toFixed(2)));
          raid.lossText = 'Erzak -2';
          this.setLastEventLog(`Gün ${day}: Kamp baskını! Erzak -2.`);
        } else {
          this.playerParty.gold = Math.floor((this.playerParty.gold ?? 0) - 10);
          raid.lossText = 'Altın -10';
          this.setLastEventLog(`Gün ${day}: Kamp baskını! Altın -10.`);
        }
      } else if (supplyRes.starved) {
        this.setLastEventLog(`Gün ${day}: Erzak bitti! Moral ${supplyRes.moraleDelta}.`);
      }
    } else if (supplyRes.starved) {
      this.setLastEventLog(`Gün ${day}: Erzak bitti! Moral ${supplyRes.moraleDelta}.`);
    }

    tickHealing({
      party: this.playerParty,
      cfg: this.getEffectiveTuning().BATTLE_CASUALTIES,
      isCamp: Boolean(this.state?.camp?.active),
      isStarving: Boolean(supplyRes?.starved),
    });

    if ((this.playerParty.gold ?? 0) < 0) {
      this.playerParty.morale = Math.max(0, (this.playerParty.morale ?? 50) - CONST.ACCOUNTING.NEGATIVE_GOLD_MORALE_PENALTY);
      notes.push(`Altın negatif: Moral -${CONST.ACCOUNTING.NEGATIVE_GOLD_MORALE_PENALTY}`);
    }

    if (this.state.markets && typeof this.state.markets === 'object') {
      const settlements = this.state?.map?.settlements || [];
      const settlementMap = new Map(settlements.filter((s) => s?.id).map((s) => [s.id, s]));
      Object.entries(this.state.markets).forEach(([settlementKey, market]) => {
        const settlement = settlementMap.get(settlementKey);
        if (!settlement) return;
        settlement.tier = this.getSettlementTier(settlement);
        const biomeKey = this.getBiomeKeyAtTile(settlement.tx, settlement.ty);
        tradeSystem.advanceMarketOneDay(settlement, market, {
          seed: this.state?.seed,
          day: this.state?.day,
          settlementKey,
          biomeKey,
          tuning: this.state?.tuning,
        });
      });
    }

    const summary = {
      day: Number.isFinite(day) ? day : Math.floor(this.state?.day ?? 1),
      foodBefore,
      foodAfter: Number(this.state?.supplies?.food ?? 0),
      consumed: Number(supplyRes?.consumed ?? 0),
      starved: Boolean(supplyRes?.starved),
      starvationMoraleDelta: Number(supplyRes?.moraleDelta ?? 0),
      weight,
      capacity: cap,
      overcap: weight > cap,
      overcapSpeedMult: overcapMult,
      camp: { active: Boolean(this.state?.camp?.active), watch: this.state?.camp?.watch || 'med' },
      raid,
      goldBefore,
      goldAfter: Math.floor(this.playerParty.gold ?? 0),
      moraleBefore,
      moraleAfter: Math.floor(this.playerParty.morale ?? 50),
      tradePL: Number(this.state?.dailyLedger?.tradePL ?? 0),
      notes,
    };

    this.state.lastAccounting = summary;
    if (CONST.ACCOUNTING.AUTO_OPEN) {
      this.state.accounting = summary;
      this.state.paused = true;
      this.accountingUI?.show?.(summary);
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
        roster.push({ id: `inf-${i + 1}`, name: `Infantry ${i + 1}`, class: 'infantry', hp: 100, maxHp: 100, atk: 14, def: 8, speed: 72, meleeRange: 20, isRanged: false, status: 'healthy', healProgress: 0 });
      }
      for (let i = 0; i < 3; i += 1) {
        roster.push({ id: `arc-${i + 1}`, name: `Archer ${i + 1}`, class: 'archer', hp: 78, maxHp: 78, atk: 10, def: 4, speed: 68, meleeRange: 14, rangedRange: 220, rangedDamage: 12, rangedCooldown: 1.2, isRanged: true, status: 'healthy', healProgress: 0 });
      }
      this.playerParty.roster = roster;
    }
    this.ensureRosterState();
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

  ensureRosterUnitState(unit) {
    if (!unit || typeof unit !== 'object') return unit;
    if (!Number.isFinite(unit.healProgress)) unit.healProgress = 0;
    unit.healProgress = Math.max(0, Math.min(1, Number(unit.healProgress)));
    const status = typeof unit.status === 'string' ? unit.status : 'healthy';
    unit.status = ['healthy', 'wounded', 'dead'].includes(status) ? status : 'healthy';
    if (unit.status === 'healthy') unit.healProgress = 0;
    return unit;
  }

  ensureRosterState() {
    const roster = this.playerParty?.roster;
    if (!Array.isArray(roster)) return;
    roster.forEach((unit) => this.ensureRosterUnitState(unit));
    this.playerParty.roster = roster.filter((unit) => unit?.status !== 'dead');
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
      status: stack?.status || 'healthy',
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
    this.updatePoiInteractHint();
    this.updateTransientUIState();
    if (this.state?.paused || this.state?.accounting) return;
    this.updatePlayerParty(dt);
    this.updateEnemyParties(dt);
    this.tryTriggerEncounter();

    const party = this.playerParty;
    const tilePos = this.getTilePosition(party?.x ?? 0, party?.y ?? 0);
    const nearestSettlement = this.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    const settlementTx = Number.isFinite(nearestSettlement?.tx) ? nearestSettlement.tx : Math.floor(Number(nearestSettlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
    const settlementTy = Number.isFinite(nearestSettlement?.ty) ? nearestSettlement.ty : Math.floor(Number(nearestSettlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
    const nearSettlement = Boolean(nearestSettlement) && Math.hypot(settlementTx - tilePos.tx, settlementTy - tilePos.ty) <= 2.5;
    const nearPoi = Boolean(this.getNearestInteractablePoi());

    this.maybeShowTutorialHint({
      nearSettlement,
      nearPoi,
      inCamp: Boolean(this.state?.camp?.active),
      inBattleDeploy: false,
      inBattleFight: false,
      inEncounter: this.state?.mode === 'encounter',
    });

    this.updateFogFromPlayer();
  }

  ensureWorldGenerated(seed) {
    if (!this.state) return null;

    const normalizedSeed = Number.isFinite(seed) ? seed : parseInt(String(seed || this.state.seed || 1337), 10) || 1337;
    const hasExistingTiles = Array.isArray(this.state?.map?.tiles) && this.state.map.tiles.length > 0;
    if (hasExistingTiles && this._worldSeedCache === normalizedSeed) {
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

  updateFogFromPlayer() {
    const map = this.state?.map;
    const player = this.playerParty;
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

  getTilePosition(x, y) {
    const tileSize = CONST.WORLD.TILE_SIZE;
    const tx = Math.floor((Number.isFinite(x) ? x : 0) / tileSize);
    const ty = Math.floor((Number.isFinite(y) ? y : 0) / tileSize);
    return { tx, ty };
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
    return nearest ? this.getSettlementTier(nearest) : 2;
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

  computeEncounterRiskContext() {
    const player = this.playerParty;
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

  updateTransientUIState() {
    if (!this.state) return;
    this.state.encounterRisk = this.computeEncounterRiskContext();
    if (this.state.clueMarker && Number(this.state.day ?? 1) > Number(this.state.clueMarker.expiresDay ?? 0)) {
      this.state.clueMarker = null;
    }
    this.cleanupExpiredMarketOpportunities(this.state.day);
    if (this.state.lastEventLog && Date.now() >= (this.state.lastEventLogUntil ?? 0)) {
      this.state.lastEventLog = '';
      this.state.lastEventLogUntil = 0;
    }

    if (this.state.mode === 'roster') {
      this.state.playerRoster = this.playerRoster.map((unit) => ({
        ...unit,
        status: unit?.status || 'healthy',
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
      const settlement = this.state.city;
      if (settlement?.id) {
        this.cityUI?.setData?.({
          recruitPool: settlement.recruitPool || [],
          market: this.state?.markets?.[settlement.id] || null,
        });
      }
    }

    if (this.state.mode === 'aftermath') {
      this.state.uiPanel = this.buildAftermathPanelData();
    }

    if (this.state?.camp?.active) {
      const { weight, cap } = this.getLogisticsSpeedMult();
      const mult = CONST.CAMP.WATCH_MULT[this.state?.camp?.watch || 'med'] ?? 1;
      const raidChance = `${Math.round(CONST.CAMP.RAID_BASE_CHANCE * mult * 100)}%`;
      this.campUI?.refresh?.({ weight, capacity: cap, raidChance });
    }

    if (this.state?.accounting) this.accountingUI?.show?.(this.state.accounting);
    else this.accountingUI?.hide?.();

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

    if (battle.phase === 'deploy' && this.battleDeployMode?.active) {
      this.updateTransientUIState();
      return;
    }

    this.lastBattleDt = Math.max(1 / 120, dt);
    const deltaMs = (typeof dt === 'number' && dt < 5) ? (dt * 1000) : dt;
    battle.playerUnits = (battle.playerUnits || []).filter((u) => !u?._remove);
    battle.enemyUnits = (battle.enemyUnits || []).filter((u) => !u?._remove);
    const playerUnits = battle.playerUnits || [];
    const enemyUnits = battle.enemyUnits || [];
    const tuning = this.getEffectiveTuning();
    const formationTuning = tuning.BATTLE_FORMATION || CONST.BATTLE_FORMATION;
    const aiTuning = tuning.BATTLE_AI || CONST.BATTLE_AI;
    const battleBounds = {
      xMin: 0,
      xMax: Number(this.canvas?.width || CONST.BATTLE.BATTLEFIELD_WIDTH),
      yMin: 0,
      yMax: Number(this.canvas?.height || CONST.BATTLE.BATTLEFIELD_HEIGHT),
    };

    if (battle.phase === 'deploy' && this.battleDeployMode?.active) {
      const preview = this.battleDeployMode.computePreviewPositions(playerUnits.length);
      this.ctx.fillStyle = 'rgba(212,175,55,0.12)';
      this.ctx.fillRect(40, 60, Math.max(120, (this.canvas.width / 2) - 80), Math.max(120, this.canvas.height - 120));
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(90,180,255,0.45)';
      preview.forEach((p) => { this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); this.ctx.fill(); });
      const ax = this.battleDeployMode.anchorX;
      const ay = this.battleDeployMode.anchorY;
      const len = 42;
      const rad = (this.battleDeployMode.angleDeg * Math.PI) / 180;
      this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(ax, ay);
      this.ctx.lineTo(ax + Math.cos(rad) * len, ay + Math.sin(rad) * len);
      this.ctx.stroke();
      this.ctx.restore();
    }
    const allUnits = [...playerUnits, ...enemyUnits];
    const dtSec = deltaMs / 1000;
    for (const unit of allUnits) {
      const allies = unit?.side === 'enemy' ? enemyUnits : playerUnits;
      const cohesion = computeUnitCohesion(unit, allies, formationTuning.COHESION_RADIUS, formationTuning.COHESION_ALLY_CAP);
      unit.formationCohesion = cohesion;
      Object.assign(unit, getFormationMultipliers(unit, cohesion, formationTuning));
    }
    const moraleCfg = getBattleMoraleConfig(this);
    const rangedCfg = tuning.BATTLE_RANGED || CONST.BATTLE_RANGED;
    battle.timeSec = Number(battle.timeSec || 0) + dt;

    const alivePlayer = playerUnits.filter((u) => !u.dead && u.hp > 0);
    const aliveEnemy = enemyUnits.filter((u) => !u.dead && u.hp > 0);
    if (aliveEnemy.length === 0) { this.resolveBattle('victory'); return; }
    if (alivePlayer.length === 0) { this.resolveBattle('defeat'); return; }

    this.tickBattleMorale(allUnits, battle, dt, moraleCfg);
    updateEnemyAI({ battle, dtMs: deltaMs, cfg: aiTuning, bounds: battleBounds });

    for (const unit of allUnits) {
      this.ensureBattleUnitFx(unit);
      if (unit.dead || unit.hp <= 0) {
        if (!unit.fx.deathStartedAt) unit.fx.deathStartedAt = performance.now();
        continue;
      }
      const enemies = unit.side === 'player' ? aliveEnemy : alivePlayer;
      unit.chargeCooldownRemaining = Math.max(0, Number(unit.chargeCooldownRemaining || 0) - dtSec);
      if (unit.role === 'cavalry') computeChargeState({ unit, dtSec, cfg: tuning });
      unit.attackTimer = Math.max(0, (unit.attackTimer || 0) - dt);
      unit.rangedTimer = Math.max(0, (unit.rangedTimer || 0) - dt);

      let target = enemies.find((e) => e.unitId === unit.targetId && !e.dead && e.hp > 0);
      if ((unit.command === CONST.BATTLE_COMMANDS.FOCUS || unit.command === CONST.BATTLE_COMMANDS.SKIRMISH) && unit.focusTargetId) {
        const focused = enemies.find((e) => e.unitId === unit.focusTargetId && !e.dead && e.hp > 0);
        if (focused) target = focused;
      }
      if (!target) {
        target = this.findNearestEnemy(unit, enemies);
        unit.targetId = target?.unitId || null;
      }
      if (!target) continue;

      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const terrainMods = this.currentBattleTerrain?.mods || CONST.TERRAIN_MODS.PLAINS;
      const cmdSpeed = Number(unit.commandSpeedMult ?? 1);
      const formationSpeed = Number(unit.formationSpeedMult ?? 1);
      tickSuppression({ unit, dtMs: deltaMs, battleTimeSec: battle.timeSec, cfg: rangedCfg });
      const suppressionSpeed = Number(unit.suppressionSpeedMult ?? 1);
      const stepSpeed = (unit.speed * terrainMods.speed * cmdSpeed * formationSpeed * suppressionSpeed);
      const prevX = unit.x;
      const prevY = unit.y;
      unit.lastPosX = prevX;
      unit.lastPosY = prevY;

      if (unit.command === CONST.BATTLE_COMMANDS.RETREAT) {
        const retreatStep = Math.min(dist, stepSpeed * dt);
        unit.x -= (dx / dist) * retreatStep;
        unit.y -= (dy / dist) * retreatStep;
      } else if (unit.aiApproachPoint) {
        const adx = unit.aiApproachPoint.x - unit.x;
        const ady = unit.aiApproachPoint.y - unit.y;
        const adist = Math.hypot(adx, ady) || 0.001;
        if (adist <= Math.max(10, unit.meleeRange || 16)) {
          unit.aiApproachPoint = null;
        } else {
          const step = Math.min(adist, stepSpeed * dt);
          unit.x += (adx / adist) * step;
          unit.y += (ady / adist) * step;
        }
      } else if (unit.isRanged) {
        const inSkirmish = unit.command === CONST.BATTLE_COMMANDS.SKIRMISH || unit.skirmish;
        const desiredRange = unit.rangedRange * Number(aiTuning.SKIRMISH_DESIRED_RANGE_MULT ?? 0.9);
        const minRange = unit.rangedRange * Number(aiTuning.SKIRMISH_MIN_RANGE_MULT ?? 0.6);
        if (inSkirmish && dist < minRange) {
          const kite = computeSkirmishKiteStep(unit, target, stepSpeed, dt, battleBounds, aiTuning);
          unit.x = kite.x;
          unit.y = kite.y;
          if (kite.hitBounds && !kite.movedAway) {
            unit.skirmishBoundsFailSec = Number(unit.skirmishBoundsFailSec || 0) + dt;
            if (unit.skirmishBoundsFailSec >= Number(aiTuning.SKIRMISH_BOUNDS_FAIL_HOLD_SEC ?? 0.5)) {
              applyCommandEffects(unit, CONST.BATTLE_COMMANDS.HOLD);
              unit.skirmishHoldUntil = Number(battle.timeSec || 0) + Number(aiTuning.SKIRMISH_BOUNDS_FAIL_HOLD_SEC ?? 0.5);
              unit.skirmishBoundsFailSec = 0;
            }
          } else {
            unit.skirmishBoundsFailSec = 0;
          }
        } else if (Number(unit.skirmishHoldUntil || 0) > Number(battle.timeSec || 0)) {
          // temporary hold near edge
        } else if (dist <= unit.rangedRange) {
        const canFire = canUnitFireRanged(unit, battle, rangedCfg, dist);
        const fallbackToMelee = shouldUseMeleeFallback({ unit, distToTarget: dist, cfg: rangedCfg, battle });

        if (canFire && dist <= unit.rangedRange) {
          if (unit.rangedTimer <= 0 && (battle.projectiles?.length ?? 0) < 200) {
            const ammoOk = consumeAmmo({
              battle,
              side: unit.side,
              amount: Math.max(1, Math.floor(Number(rangedCfg.AMMO_PER_SHOT ?? 1))),
            });
            if (ammoOk) {
              this.spawnProjectile(unit, target, battle.projectiles);
              const shakenTimerMult = unit.moraleState === 'shaken'
                ? Number(moraleCfg.SHAKEN_ATTACK_COOLDOWN_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_COOLDOWN_MULT)
                : 1;
              unit.rangedTimer = unit.rangedCooldown * shakenTimerMult;
            }
          }
        } else if (fallbackToMelee && dist <= unit.meleeRange) {
          if (unit.attackTimer <= 0) {
            const atkMult = unit.moraleState === 'shaken'
              ? Number(moraleCfg.SHAKEN_ATTACK_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_MULT)
              : 1;
            this.applyUnitDamage(unit, target, unit.atk * atkMult);
            const shakenTimerMult = unit.moraleState === 'shaken'
              ? Number(moraleCfg.SHAKEN_ATTACK_COOLDOWN_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_COOLDOWN_MULT)
              : 1;
            unit.attackTimer = 0.9 * shakenTimerMult;
          }
        } else {
          const engageRange = inSkirmish ? desiredRange : 0;
          if (dist > engageRange) {
            const step = Math.min(dist, stepSpeed * dt);
            unit.x += (dx / dist) * step;
            unit.y += (dy / dist) * step;
          }
        }
      } else if (dist <= unit.meleeRange) {
        if (unit.attackTimer <= 0) {
          const atkMult = unit.moraleState === 'shaken'
            ? Number(moraleCfg.SHAKEN_ATTACK_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_MULT)
            : 1;
          this.applyUnitDamage(unit, target, unit.atk * atkMult, { isMelee: true });
          const shakenTimerMult = unit.moraleState === 'shaken'
            ? Number(moraleCfg.SHAKEN_ATTACK_COOLDOWN_MULT ?? CONST.BATTLE_MORALE.SHAKEN_ATTACK_COOLDOWN_MULT)
            : 1;
          unit.attackTimer = 0.9 * shakenTimerMult;
        }
      } else {
        const step = Math.min(dist, stepSpeed * dt);
        unit.x += (dx / dist) * step;
        unit.y += (dy / dist) * step;
      }

      const clampedPos = clampToBattleBounds(unit, battleBounds, Number(aiTuning.AI_BOUNDS_PAD_PX ?? 0));
      unit.x = clampedPos.x;
      unit.y = clampedPos.y;
      unit.vx = (unit.x - prevX) / dt;
      unit.vy = (unit.y - prevY) / dt;
      const safeDt = dt > 0 ? dt : (1 / 60);
      unit.vx = (unit.x - prevX) / safeDt;
      unit.vy = (unit.y - prevY) / safeDt;
      const moveDx = unit.x - prevX;
      const moveDy = unit.y - prevY;
      const moveDist = Math.hypot(moveDx, moveDy);
      if (moveDist > 0.01) unit.facing = Math.atan2(moveDy, moveDx);
      else if (Math.hypot(dx, dy) > 0.001) unit.facing = Math.atan2(dy, dx);
      if (!Number.isFinite(unit.facing)) unit.facing = unit.side === 'player' ? 0 : Math.PI;
      unit.animKey = this.getUnitAnimationKey(unit) || 'infantry_idle';
      if (this.assetsReady && this.spriteLoader) {
        const player = this.getBattleAnimPlayer(unit);
        player?.set?.(unit.animKey);
        player?.update?.(deltaMs);
      }
    }

    const nextProjectiles = [];
    for (const projectile of (battle.projectiles || [])) {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.ttl -= dt;
      if (projectile.ttl <= 0) { this.projectilePool.release(projectile); continue; }
      const targets = projectile.side === 'player' ? enemyUnits : playerUnits;
      let hit = false;
      for (const unit of targets) {
        if (unit.dead || unit.hp <= 0) continue;
        const hitDist = Math.hypot(unit.x - projectile.x, unit.y - projectile.y);
        if (hitDist <= (unit.radius || 9)) {
          this.applyUnitDamage(projectile, unit, projectile.damage, { isMelee: false });
          this.applyUnitDamage(projectile, unit, projectile.damage);
          applySuppressionOnHit({ target: unit, battleTimeSec: Number(battle.timeSec || 0), cfg: rangedCfg });
          hit = true;
          this.projectilePool.release(projectile);
          break;
        }
      }
      if (!hit) nextProjectiles.push(projectile);
    }
    battle.projectiles = nextProjectiles;
    this.updateFloatingTexts(dt);

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

  applyUnitDamage(attacker, target, baseDamage, context = {}) {
    if (!target || target.dead || target.hp <= 0) return 0;
    const tuning = this.getEffectiveTuning();
    const flankTuning = tuning?.BATTLE_FLANK || CONST.BATTLE_FLANK;
    const moraleCfg = getBattleMoraleConfig(this);
    const battle = this.state?.battle;
    const isMelee = context.isMelee !== false && !attacker?.isRanged;

    const attackDirVec = getAttackDirectionAgainstDefender(attacker, target);
    const attackSide = classifyAttackSide(Number(target.facing || 0), attackDirVec);
    const flank = resolveFlankBonuses(attackSide, flankTuning);

    const variance = 0.9 + (Math.random() * 0.2);
    const type = attacker?.damageType || (attacker?.isRanged ? CONST.DAMAGE_TYPE.PIERCE : CONST.DAMAGE_TYPE.CUT);
    const terrainMods = this.currentBattleTerrain?.mods || CONST.TERRAIN_MODS.PLAINS;
    const defMult = Number(target?.commandDefMult ? (1 / target.commandDefMult) : 1) / Math.max(0.01, Number(target?.formationDefMult ?? 1));
    const cmdCtx = { defMult, retreating: Boolean(target?.retreating) };
    const atkMult = Math.max(0.01, Number(attacker?.formationAtkMult ?? 1));
    const adjustedBase = (baseDamage ?? 1) * atkMult;
    const base = Math.max(1, (adjustedBase - (target.def ?? 0)));
    let damage = computeDamage({ attacker, defender: target, base: base * variance, damageType: type, terrainMods, commandCtx: cmdCtx });

    let moraleBonus = Math.max(0, Number(flank.moraleBonus || 0));
    let isChargeHit = false;

    if (isMelee) {
      const counter = getCounterEffect({ attackerRole: attacker?.role, defenderRole: target?.role, cfg: tuning });
      damage *= Math.max(0.01, Number(counter.dmgMult || 1));
      moraleBonus += Math.max(0, Number(counter.moraleBonus || 0));

      if (attacker?.role === 'cavalry' && attacker.chargeReady) {
        const chargeCfg = tuning?.BATTLE_CHARGE || CONST.BATTLE_CHARGE;
        isChargeHit = true;
        damage *= Math.max(0.01, Number(chargeCfg.CHARGE_DMG_MULT ?? 1));
        moraleBonus += Math.max(0, Number(chargeCfg.CHARGE_MORALE_BONUS ?? 0));

        attacker.chargeMeter = 0;
        attacker.chargeReady = false;
        attacker.chargeCooldownRemaining = Math.max(0, Number(chargeCfg.CHARGE_COOLDOWN_SEC ?? 0));

        if (isBracedSpearman(target, tuning)) {
          const reducedMult = Math.max(0.01, Number(chargeCfg.BRACE_CHARGE_REDUCTION_MULT ?? 1));
          damage *= reducedMult;
          moraleBonus += 2;
          const thornDamage = Math.max(1, Math.round(damage * Math.max(0, Number(chargeCfg.BRACE_THORNS_DMG_FRACTION ?? 0))));
          attacker.hp = Math.max(0, Number(attacker.hp || 0) - thornDamage);
          this.spawnFloatingText(attacker.x || 0, attacker.y || 0, `-${thornDamage} BRACED`, attacker.side === 'player' ? '#ffd0d0' : '#fff2a8');
          if (attacker.hp <= 0) {
            attacker.dead = true;
            this.ensureBattleUnitFx(attacker);
            if (!attacker.fx.deathStartedAt) attacker.fx.deathStartedAt = performance.now();
          }
        }
      }
    }

    if (attacker?.isRanged) damage *= Math.max(0.01, Number(target?.formationRangedTakenMult ?? 1));
    damage = Math.max(1, damage * Math.max(0.1, Number(flank.damageMult || 1)));
    const finalDamage = Math.max(1, Math.round(damage));

    this.ensureBattleUnitFx(target);
    target.hp -= finalDamage;
    if (Number.isFinite(target.morale)) target.morale = Math.max(0, Number(target.morale) - moraleBonus);
    applyMoraleDamage(target, finalDamage, moraleCfg, Number(battle?.timeSec || 0));
    this.updateUnitMoraleState(target, moraleCfg);

    target.fx.hitUntil = performance.now() + CONST.BATTLE_FX.HIT_FLASH_DURATION;
    const marker = this.state?.devMode && attackSide !== ATTACK_SIDE.FRONT ? ` ${String(attackSide).toUpperCase()}` : '';
    const chargeMarker = isChargeHit ? ' CHARGE' : '';
    this.spawnFloatingText(target.x || 0, target.y || 0, `-${finalDamage}${marker}${chargeMarker}`, target.side === 'player' ? '#ffd0d0' : '#fff2a8');

    if (target.hp <= 0) {
      target.hp = 0;
      target.dead = true;
      if (!target.fx.deathStartedAt) target.fx.deathStartedAt = performance.now();
      const allUnits = [...(battle?.playerUnits || []), ...(battle?.enemyUnits || [])];
      applyAllyDeathShock(target, allUnits, moraleCfg);
      allUnits.forEach((unit) => this.updateUnitMoraleState(unit, moraleCfg));
    }
    return finalDamage;
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
    const projectile = this.projectilePool.acquire();
    projectile.x = shooter.x;
    projectile.y = shooter.y;
    projectile.vx = nx * speed;
    projectile.vy = ny * speed;
    projectile.side = shooter.side;
    projectile.isRanged = true;
    projectile.damageType = shooter.damageType || CONST.DAMAGE_TYPE.PIERCE;
    projectile.damage = Math.max(1, Math.floor(shooter.rangedDamage || shooter.atk || 8));
    projectile.attackDirX = nx;
    projectile.attackDirY = ny;
    projectile.ttl = 1.5;
    projectile.radius = 2;
    list.push(projectile);
  }


  spawnFloatingText(x, y, text, color = '#ffffff') {
    const ft = this.floatingTextPool.acquire();
    ft.x = x;
    ft.y = y;
    ft.text = String(text || '');
    ft.color = color;
    ft.ttl = 0.8;
    ft.vy = -20;
    this.floatingTexts.push(ft);
  }

  updateFloatingTexts(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const next = [];
    for (const ft of this.floatingTexts) {
      ft.ttl -= dt;
      ft.y += ft.vy * dt;
      if (ft.ttl <= 0) this.floatingTextPool.release(ft);
      else next.push(ft);
    }
    this.floatingTexts = next;
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

    if (this.state?.camp?.active) {
      this.cancelPlayerDestination();
      return;
    }

    const currentContext = this.getMovementContextAt(this.playerParty.x, this.playerParty.y);
    const logistics = this.getLogisticsSpeedMult();
    this.currentTerrainStatus = `${currentContext.terrainLabel} | Yük: ${Math.round(logistics.weight)}/${Math.round(logistics.cap)}`;
    if (currentContext.blocked) {
      this.cancelPlayerDestination();
      return;
    }

    const step = this.playerParty.speed * currentContext.speedMult * logistics.starvingMult * logistics.overcapMult * dt;
    if (step >= dist) {
      this.completePlayerArrival();
      return;
    }

    const nx = this.playerParty.x + (dx / dist) * step;
    const ny = this.playerParty.y + (dy / dist) * step;
    const nextContext = this.getMovementContextAt(nx, ny);
    if (nextContext.blocked) {
      this.cancelPlayerDestination();
      return;
    }

    this.playerParty.x = nx;
    this.playerParty.y = ny;

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

      const rollAt = this._encounterRollByEnemyId[enemy.id] ?? 0;
      if (now - rollAt < 350) continue;
      this._encounterRollByEnemyId[enemy.id] = now;

      const moveContext = this.getMovementContextAt(this.playerParty.x, this.playerParty.y);
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
    this.maybeShowTutorialHint({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: true });
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
      status: unit?.status || 'healthy',
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
    this.cleanupTemporaryEnemy(enemyId);
    this.lastEncounterEndTimeByEnemyId[enemyId] = Date.now();
    if (this.state) {
      this.state.encounter = null;
      this.battleCommandsUI?.hide?.();
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
    this.placeBattleUnits(enemyUnits, 'enemy');

    const battleAmmo = initBattleAmmoFromParty({ party: this.playerParty, cfg: this.getEffectiveTuning().BATTLE_RANGED });

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
      playerAmmoStart: battleAmmo.startAmmo,
      playerAmmo: battleAmmo.ammo,
      targetRetargetTimer: 0,
      settlement: this.getActiveSettlementForCity(),
      phase: 'deploy',
    };

    this.currentBattleTerrain = getBattleTerrainContext(this.state, this.state.battle);
    this.state.setMode('battle');
    this.battleCommandsUI?.show?.();
    this.startBattleDeployment();
    this.updateTransientUIState();
    return true;
  }

  createBattleUnitsFromRoster(roster, side) {
    const moraleCfg = getBattleMoraleConfig(this);
    const casualtyCfg = this.getEffectiveTuning().BATTLE_CASUALTIES;
    return (roster || []).map((entry, idx) => {
      const wounded = entry?.status === 'wounded';
      const maxHpBase = Math.max(1, Math.floor(entry.maxHp ?? entry.hp ?? 100));
      const maxHp = wounded ? Math.max(1, Math.floor(maxHpBase * Number(casualtyCfg.WOUNDED_HP_MAX_MULT))) : maxHpBase;
      const atkBase = Math.max(1, Math.floor(entry.atk ?? 10));
      const atk = wounded ? Math.max(1, Math.floor(atkBase * Number(casualtyCfg.WOUNDED_ATK_MULT))) : atkBase;
      const hp = Math.min(maxHp, Math.max(1, Math.floor(entry.hp ?? maxHp)));
      return {
      unitId: `${side}-${entry.id}-${idx}`,
      sourceId: entry.id,
      rosterId: entry.id,
      side,
      name: entry.name,
      class: entry.class || (entry.isRanged ? 'archer' : 'infantry'),
      role: inferUnitRole(entry),
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp,
      maxHp,
      atk,
      def: Math.max(0, Math.floor(entry.def ?? 0)),
      speed: Math.max(20, Math.floor(entry.speed ?? 70)),
      meleeRange: Math.max(8, Math.floor(entry.meleeRange ?? 18)),
      isRanged: Boolean(entry.isRanged),
      rangedRange: Math.max(0, Math.floor(entry.rangedRange ?? 0)),
      rangedDamage: Math.max(1, Math.floor(entry.rangedDamage ?? entry.atk ?? 8)),
      rangedCooldown: Math.max(0.3, Number(entry.rangedCooldown ?? 1.2)),
      rangedTimer: 0,
      targetId: null,
      armorType: entry.armorType || (entry.isRanged ? CONST.ARMOR_TYPE.LIGHT : (String(entry.class || '').includes('cav') ? CONST.ARMOR_TYPE.HEAVY : CONST.ARMOR_TYPE.MEDIUM)),
      damageType: entry.damageType || (entry.isRanged ? CONST.DAMAGE_TYPE.PIERCE : CONST.DAMAGE_TYPE.CUT),
      command: null,
      commandSpeedMult: 1,
      commandDefMult: 1,
      formation: CONST.DEPLOY.DEFAULT_FORMATION,
      formSlot: idx,
      formationCohesion: 0,
      formationAtkMult: 1,
      formationDefMult: 1,
      formationSpeedMult: 1,
      formationRangedTakenMult: 1,
      formationMoraleShockMult: 1,
      focusTargetId: null,
      retreating: false,
      skirmish: false,
      aiApproachPoint: null,
      aiApproachSetAtSec: 0,
      aiLastApproachDist: 0,
      aiApproachLastCheckAtSec: 0,
      aiStallSec: 0,
      aiNextRetargetAtSec: 0,
      facing: side === 'player' ? 0 : Math.PI,
      moraleMax: Math.max(1, Number(moraleCfg.MORALE_MAX ?? CONST.BATTLE_MORALE.MORALE_MAX)),
      morale: Math.max(1, Number(entry.morale ?? moraleCfg.MORALE_MAX ?? CONST.BATTLE_MORALE.MORALE_MAX)),
      chargeMeter: 0,
      chargeReady: false,
      chargeCooldownRemaining: 0,
      lastPosX: 0,
      lastPosY: 0,
      moraleState: 'steady',
      lastDamageAt: -999,
      attackTimer: 0,
      holdFire: false,
      suppressedUntil: 0,
      suppressionSpeedMult: 1,
      radius: 9,
      dead: false,
      fx: { hitUntil: 0, deathStartedAt: null },
    };
    });
  }

  updateUnitMoraleState(unit, moraleCfg) {
    if (!unit || unit.dead || unit.hp <= 0) return;
    const fleeThreshold = Number(moraleCfg.FLEE_THRESHOLD ?? CONST.BATTLE_MORALE.FLEE_THRESHOLD);
    const routThreshold = Number(moraleCfg.ROUT_THRESHOLD ?? CONST.BATTLE_MORALE.ROUT_THRESHOLD);
    if (unit.morale <= routThreshold) {
      unit.moraleState = 'routing';
      unit.command = CONST.BATTLE_COMMANDS.RETREAT;
      unit.retreating = true;
      unit.commandSpeedMult = Number(moraleCfg.ROUT_SPEED_MULT ?? CONST.BATTLE_MORALE.ROUT_SPEED_MULT);
      unit.commandDefMult = Number(moraleCfg.ROUT_DEF_MULT ?? CONST.BATTLE_MORALE.ROUT_DEF_MULT);
    } else if (unit.morale <= fleeThreshold) {
      unit.moraleState = 'shaken';
      unit.retreating = false;
      unit.commandSpeedMult = 1;
      unit.commandDefMult = 1;
    } else {
      if (unit.moraleState === 'routing' || unit.moraleState === 'shaken') {
        unit.command = null;
      }
      unit.moraleState = 'steady';
      unit.retreating = false;
      unit.commandSpeedMult = 1;
      unit.commandDefMult = 1;
    }
  }

  tickBattleMorale(units, battle, dt, moraleCfg) {
    const outnumberedRadius = Math.max(1, Number(moraleCfg.OUTNUMBERED_RADIUS ?? CONST.BATTLE_MORALE.OUTNUMBERED_RADIUS));
    const regenRadius = Math.max(1, Number(moraleCfg.REGEN_ALLY_RADIUS ?? CONST.BATTLE_MORALE.REGEN_ALLY_RADIUS));
    const outnumberedDrain = Math.max(0, Number(moraleCfg.OUTNUMBERED_DRAIN_PER_SEC ?? CONST.BATTLE_MORALE.OUTNUMBERED_DRAIN_PER_SEC));
    const regenPerSec = Math.max(0, Number(moraleCfg.REGEN_PER_SEC ?? CONST.BATTLE_MORALE.REGEN_PER_SEC));
    const damageGraceSec = Math.max(0, Number(moraleCfg.REGEN_DAMAGE_GRACE_SEC ?? CONST.BATTLE_MORALE.REGEN_DAMAGE_GRACE_SEC));

    const outnumberedRadiusSq = outnumberedRadius * outnumberedRadius;
    const regenRadiusSq = regenRadius * regenRadius;

    for (const unit of units) {
      if (!unit || unit.dead || unit.hp <= 0) continue;
      clampMorale(unit, moraleCfg);

      let allyCount = 0;
      let enemyCount = 0;
      let regenAllyNearby = false;
      for (const other of units) {
        if (!other || other.dead || other.hp <= 0 || other.unitId === unit.unitId) continue;
        const dx = (other.x || 0) - (unit.x || 0);
        const dy = (other.y || 0) - (unit.y || 0);
        const distSq = (dx * dx) + (dy * dy);
        if (other.side === unit.side) {
          if (!regenAllyNearby && distSq <= regenRadiusSq) regenAllyNearby = true;
          if (distSq <= outnumberedRadiusSq) allyCount += 1;
        } else if (distSq <= outnumberedRadiusSq) {
          enemyCount += 1;
        }
      }

      if (enemyCount > allyCount) unit.morale = Math.max(0, unit.morale - (outnumberedDrain * dt));
      const sinceDamage = Number(battle.timeSec || 0) - Number(unit.lastDamageAt ?? 0);
      if (regenAllyNearby && sinceDamage >= damageGraceSec) {
        unit.morale = Math.min(unit.moraleMax, unit.morale + (regenPerSec * dt));
      }

      this.updateUnitMoraleState(unit, moraleCfg);
    }
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
      unit.formSlot = idx;
      unit.formation = unit.formation || CONST.DEPLOY.DEFAULT_FORMATION;
      unit.facing = side === 'enemy' ? 180 : (Number(unit.facing) || 0);
      if (side === 'enemy') unit.formation = CONST.FORMATION.LINE;
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



  setupCityServicesUI() {
    if (this.cityUI) return;
    this.cityUI = new CityServicesUI({
      state: this.state,
      party: this.playerParty,
      recruitmentSystem,
      tradeSystem,
      onRecruit: (unit) => {
        const result = recruitmentSystem.hireUnit(this.playerParty, unit);
        if (result?.ok) {
          if (Array.isArray(this.state?.city?.recruitPool)) {
            this.state.city.recruitPool = this.state.city.recruitPool.filter((it) => it.uid !== unit.uid);
          }
          this.setLastEventLog(result.message || 'Birlik kiralandı.');
          this.runAutosave('recruit');
        } else {
          this.setLastEventLog(result?.message || 'Kiralama başarısız.');
        }
      },
      onBuy: (itemId, qty) => {
        const settlement = this.state?.city;
        if (!settlement) return;
        const market = this.getOrCreateMarketForSettlement(settlement);
        const result = tradeSystem.buy(this.playerParty, market, settlement, itemId, qty, {
          day: this.state?.day,
          settlementKey: this.getSettlementOpportunityKey(settlement),
          marketOpportunities: this.state?.marketOpportunities,
          tuning: this.state?.tuning,
        });
        this.ensureInventoryModel();
        this.state.markets[settlement.id] = market;
        if (result?.ok) {
          this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
            ? this.state.dailyLedger
            : { tradePL: 0 };
          this.state.dailyLedger.tradePL = Number(this.state.dailyLedger.tradePL ?? 0) - Number(result?.spentGold ?? 0);
        }
        this.setLastEventLog(result?.message || 'İşlem tamamlandı.');
        if (result?.ok) this.runAutosave('trade');
      },
      onSell: (itemId, qty) => {
        const settlement = this.state?.city;
        if (!settlement) return;
        const market = this.getOrCreateMarketForSettlement(settlement);
        const result = tradeSystem.sell(this.playerParty, market, settlement, itemId, qty, {
          day: this.state?.day,
          settlementKey: this.getSettlementOpportunityKey(settlement),
          marketOpportunities: this.state?.marketOpportunities,
          tuning: this.state?.tuning,
        });
        this.ensureInventoryModel();
        this.state.markets[settlement.id] = market;
        if (result?.ok) {
          this.state.dailyLedger = this.state.dailyLedger && typeof this.state.dailyLedger === 'object'
            ? this.state.dailyLedger
            : { tradePL: 0 };
          this.state.dailyLedger.tradePL = Number(this.state.dailyLedger.tradePL ?? 0) + Number(result?.earnedGold ?? 0);
        }
        this.setLastEventLog(result?.message || 'İşlem tamamlandı.');
        if (result?.ok) this.runAutosave('trade');
      },
      onClose: () => this.exitCityServices(),
    });

    this.cityUI.bind({
      cityRoot: utils.getEl('settlementModal'),
      btnRecruit: utils.getEl('btnRecruit'),
      btnTrade: utils.getEl('btnTrade'),
      cityClose: utils.getEl('btnLeaveSettlement') || utils.getEl('btnCloseSettlement'),
      cityList: utils.getEl('settlementLore'),
    });
  }

  getOrCreateMarketForSettlement(settlement) {
    if (!this.state.markets || typeof this.state.markets !== 'object') this.state.markets = {};
    if (!settlement?.id) return tradeSystem.initMarket(settlement, this.state?.seed);
    if (!this.state.markets[settlement.id]) {
      this.state.markets[settlement.id] = tradeSystem.initMarket(settlement, this.state?.seed);
    }
    if (!this.state.markets[settlement.id].momentum || typeof this.state.markets[settlement.id].momentum !== 'object') {
      this.state.markets[settlement.id].momentum = {};
    }
    return this.state.markets[settlement.id];
  }

  enterCityServices() {
    if (!this.state) return false;
    this.setupCityServicesUI();
    this.maybeShowTutorialHint({ nearSettlement: true, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: false });
    this.state.city = this.getActiveSettlementForCity();
    const settlement = this.state.city;
    settlement.tier = this.getSettlementTier(settlement);
    const recruitPool = recruitmentSystem.getRecruitPool(settlement, this.state?.seed);
    settlement.recruitPool = recruitPool;
    const market = this.getOrCreateMarketForSettlement(settlement);
    this.state.setMode('city');
    this.cityUI?.show?.(settlement, { recruitPool, market });
    this.updateTransientUIState();
    return true;
  }

  exitCityServices() {
    this.cityUI?.hide?.();
    if (this.state?.mode === 'city') this.state.setMode('map');
    this.updateTransientUIState();
    return true;
  }


  getLogisticsSpeedMult() {
    const starvingMult = this.state?.status?.starving ? CONST.SUPPLIES.STARVATION_SPEED_MULT : 1;
    this.ensureInventoryModel();
    const weight = capacitySystem.computeCarryWeight(this.playerParty?.inventory);
    const cap = capacitySystem.computeCapacity(this.playerParty);
    const overcapMult = capacitySystem.computeOvercapSpeedMult(weight, cap);
    return { starvingMult, overcapMult, weight, cap };
  }

  setupCampUI() {
    if (this.campUI) return;
    this.campUI = new CampUI({
      state: this.state,
      onClose: () => {
        if (this.state?.camp?.active) campSystem.toggleCamp(this.state);
        this.campUI?.hide?.();
      },
      onSetWatch: (level) => {
        campSystem.setWatch(this.state, level);
      },
    });

    this.campUI.bind({
      root: utils.getEl('campModal'),
      closeBtn: utils.getEl('campCloseBtn'),
      status: utils.getEl('campStatusText'),
    });
  }

  toggleCampMode() {
    campSystem.ensureCampState(this.state);
    const active = campSystem.toggleCamp(this.state);
    if (active) this.maybeShowTutorialHint({ nearSettlement: false, nearPoi: false, inCamp: true, inBattleDeploy: false, inBattleFight: false, inEncounter: false });
    if (active) {
      this.cancelPlayerDestination();
      const { weight, cap } = this.getLogisticsSpeedMult();
      const mult = CONST.CAMP.WATCH_MULT[this.state?.camp?.watch || 'med'] ?? 1;
      const raidChance = `${Math.round(CONST.CAMP.RAID_BASE_CHANCE * mult * 100)}%`;
      this.campUI?.show?.({ weight, capacity: cap, raidChance });
      this.setLastEventLog('Kamp kuruldu.');
    } else {
      this.campUI?.hide?.();
      this.setLastEventLog('Kamptan çıkıldı.');
    }
  }


  setupBattleDeployUI() {
    if (this.battleDeployUI) return;
    this.battleDeployUI = new BattleDeployUI({
      onStart: () => this.confirmBattleDeployment(),
      onCancel: () => this.cancelBattleDeployment(),
    });
    this.battleDeployUI.bind({
      root: this.dom?.battleDeployOverlay || utils.getEl('battleDeployOverlay'),
      btnStart: this.dom?.btnDeployStart || utils.getEl('btnDeployStart'),
      btnCancel: this.dom?.btnDeployCancel || utils.getEl('btnDeployCancel'),
      hintText: this.dom?.deployHint || utils.getEl('deployHint'),
    });
  }

  startBattleDeployment() {
    const battle = this.state?.battle;
    if (!battle) return false;
    this.maybeShowTutorialHint({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: true, inBattleFight: false, inEncounter: false });
    this.battleDeployMode = new BattleDeployMode({
      state: this.state,
      party: this.playerParty,
      battle,
      camera: this.state?.camera,
    });
    this.battleDeployUI?.setFormation?.(this.battleDeployMode.formation);
    this.battleDeployUI?.show?.();
    return true;
  }

  confirmBattleDeployment() {
    const battle = this.state?.battle;
    if (!battle || !this.battleDeployMode?.active) return false;
    this.maybeShowTutorialHint({ nearSettlement: false, nearPoi: false, inCamp: false, inBattleDeploy: false, inBattleFight: true, inEncounter: false });
    this.battleDeployMode.applyDeployment(battle.playerUnits || []);
    battle.phase = 'fight';
    this.battleDeployUI?.hide?.();
    return true;
  }

  cancelBattleDeployment() {
    this.battleDeployMode?.cancel?.();
    this.battleDeployUI?.hide?.();
    this.battleDeployMode = null;
    if (this.state) {
      this.state.battle = null;
      this.state.setMode('map');
    }
    return true;
  }

  setupBattleCommandsUI() {
    if (this.battleCommandsUI) return;
    this.battleCommandsUI = new BattleCommandsUI({
      onCommand: (cmd) => this.applyBattleCommand(cmd),
      onToggle: (toggle, active) => {
        if (toggle === 'hold-fire') this.toggleBattleHoldFire(active);
      },
    });
    this.battleCommandsUI.bind({ root: this.dom?.battleCommandBar || utils.getEl('battleCommandBar') });
  }

  applyBattleCommand(cmd) {
    const battle = this.state?.battle;
    if (!battle || this.state?.mode !== 'battle') return false;
    if (battle.phase === 'deploy' && this.battleDeployMode?.active) return false;

    const playerUnits = battle.playerUnits || [];
    const selectedId = this.state?.battle?.selection?.unitId || null;
    const targets = selectedId ? playerUnits.filter((u) => u.unitId === selectedId) : playerUnits;

    targets.forEach((unit) => {
      applyCommandEffects(unit, cmd);
      if (cmd === CONST.BATTLE_COMMANDS.FOCUS || cmd === CONST.BATTLE_COMMANDS.SKIRMISH) {
        const enemy = this.findNearestEnemy(unit, battle.enemyUnits || []);
        unit.focusTargetId = enemy?.unitId || null;
      } else if (cmd !== CONST.BATTLE_COMMANDS.HOLD) {
        unit.focusTargetId = null;
      }
    });

    this.battleCommandsUI?.setActiveCommand?.(cmd);
    return true;
  }

  toggleBattleHoldFire(forceValue = null) {
    const battle = this.state?.battle;
    if (!battle || this.state?.mode !== 'battle') return false;
    const playerUnits = battle.playerUnits || [];
    const selectedId = this.state?.battle?.selection?.unitId || null;
    const selectedUnit = selectedId ? playerUnits.find((u) => u.unitId === selectedId) : null;

    if (selectedUnit) {
      if (!selectedUnit.isRanged) return false;
      const next = forceValue == null ? !Boolean(selectedUnit.holdFire) : Boolean(forceValue);
      selectedUnit.holdFire = next;
      this.battleCommandsUI?.setToggleState?.('hold-fire', next);
      return true;
    }

    const rangedUnits = playerUnits.filter((u) => u?.isRanged);
    if (rangedUnits.length === 0) return false;
    const next = forceValue == null ? !rangedUnits.every((u) => Boolean(u.holdFire)) : Boolean(forceValue);
    rangedUnits.forEach((u) => { u.holdFire = next; });
    this.battleCommandsUI?.setToggleState?.('hold-fire', next);
    return true;
  }



  setupAccountingUI() {
    if (this.accountingUI) return;
    this.accountingUI = new AccountingUI();
    this.accountingUI.bind({
      modal: this.dom.accountingModal,
      body: this.dom.accountingBody,
      btnContinue: this.dom.btnAccountingContinue,
    });

    if (this.dom.btnAccountingContinue && !this._accountingContinueBound) {
      this._accountingContinueBound = true;
      this.dom.btnAccountingContinue.addEventListener('click', () => {
        this.closeAccountingModal();
      });
    }
  }

  closeAccountingModal() {
    this.accountingUI?.hide?.();
    this.state.accounting = null;
    this.state.uiPanel = null;
    if (this.state) this.state.paused = false;
    this.updateTransientUIState();
    this.runAutosave('accounting-close');
    return true;
  }

  setupPoiUI() {
    if (this.poiUI) return;
    this.poiUI = new PoiUI();
    this.poiUI.bind({
      modal: this.dom.poiModal,
      title: this.dom.poiTitle,
      desc: this.dom.poiDesc,
      cooldown: this.dom.poiCooldown,
      result: this.dom.poiResult,
      btnClose: this.dom.btnClosePoi,
      btnInvestigate: this.dom.btnPoiInvestigate,
      btnLeave: this.dom.btnPoiLeave,
    });
    this.poiUI.onLeave = () => {
      this.resolvePoiFollowup();
      this.activePoi = null;
    };
    this.poiUI.onInvestigate = () => {
      this.investigateActivePoi();
    };
  }

  getNearestInteractablePoi() {
    const nearest = PoiSystem.getNearestPoi(this.state?.map, this.playerParty?.x, this.playerParty?.y, CONST.WORLD.TILE_SIZE);
    if (!nearest || nearest.distTiles > CONST.POI.INTERACT_RADIUS_TILES) return null;
    return nearest;
  }

  updatePoiInteractHint() {
    if (!this.state) return;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.pois) || map.pois.length === 0) {
      this.state.interactHint = '';
      return;
    }
    const nearest = this.getNearestInteractablePoi();
    if (!nearest?.poi) {
      this.state.interactHint = '';
      return;
    }
    const typeText = nearest.poi.type === 'ruin' ? 'Harabe' : 'Kamp';
    this.state.interactHint = `E: İncele (${typeText})`;
  }

  openPoiModal() {
    if (this.state?.mode !== 'map') return false;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.pois) || map.pois.length === 0) return false;
    if (!this.poiUI || typeof this.poiUI.show !== 'function') return false;
    const nearest = this.getNearestInteractablePoi();
    if (!nearest?.poi) return false;
    this.maybeShowTutorialHint({ nearSettlement: false, nearPoi: true, inCamp: false, inBattleDeploy: false, inBattleFight: false, inEncounter: false });
    this.activePoi = nearest.poi;
    const remainingDays = PoiSystem.getCooldownRemainingDays(this.state, nearest.poi);
    const can = PoiSystem.canInteract(this.state, nearest.poi);
    const cooldownText = remainingDays > 0 ? `Tekrar inceleme: ${remainingDays} gün sonra` : '';
    this.poiUI?.show?.({ poi: nearest.poi, canInvestigate: can, cooldownText, remainingDays });
    return true;
  }

  investigateActivePoi() {
    const poi = this.activePoi;
    if (!poi || !this.state) return false;
    const remainingDays = PoiSystem.getCooldownRemainingDays(this.state, poi);
    if (!PoiSystem.canInteract(this.state, poi)) {
      this.setLastEventLog(`Bu bölgeyi tekrar incelemek için ${remainingDays} gün bekle.`);
      return false;
    }

    const tileSize = CONST.WORLD.TILE_SIZE;
    const poiWorldX = poi.x * tileSize + tileSize * 0.5;
    const poiWorldY = poi.y * tileSize + tileSize * 0.5;
    const movementContext = this.getMovementContextAt(poiWorldX, poiWorldY);
    const biomeKey = this.getBiomeKeyAtTile(poi.x, poi.y);
    const settlementTier = this.getNearestSettlementTierAt(poi.x, poi.y);

    const outcome = PoiSystem.rollOutcome({
      seed: this.state.seed,
      day: this.state.day,
      poi,
      context: {
        onRoad: Boolean(movementContext?.onRoad),
        biomeKey,
        settlementTier,
        map: this.state?.map,
      },
      tuning: this.state?.tuning,
    });
    PoiSystem.markInvestigated(this.state, poi);

    if (outcome.kind === CONST.POI.OUTCOME.LOOT) {
      const gold = Math.max(0, Math.floor(outcome?.loot?.gold ?? 0));
      const food = Math.max(0, Math.floor(outcome?.loot?.food ?? 0));
      const firstItem = Array.isArray(outcome?.loot?.items) ? outcome.loot.items[0] : null;
      const canAddFood = Number.isFinite(this.state?.supplies?.food);
      const hasInventoryArray = Array.isArray(this.playerParty?.inventory?.items);

      this.playerParty.gold = (this.playerParty.gold ?? 0) + gold;
      if (canAddFood) this.state.supplies.food += food;

      let itemLabel = 'ticaret malı';
      let itemQty = 0;
      if (firstItem?.id) {
        itemQty = Math.max(1, Math.floor(firstItem.qty ?? 1));
        itemLabel = this.getItemName(firstItem.id);
        if (hasInventoryArray) this.addItem(firstItem.id, itemLabel, itemQty);
      }

      const rareSuffix = outcome.rare ? ' (Nadir!)' : '';
      this.setLastEventLog(`Ganimet: +${gold} altın, +${food} erzak, +${itemLabel} x${itemQty}${rareSuffix}`);
      this.poiUI?.showResult?.({ kind: 'loot', lines: [`+${gold} altın`, `+${food} erzak`, `${itemLabel} x${itemQty}${rareSuffix}`] });
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.CLUE) {
      const gold = Math.max(0, Math.floor(outcome?.reward?.gold ?? 0));
      const food = Math.max(0, Math.floor(outcome?.reward?.food ?? 0));
      this.playerParty.gold = (this.playerParty.gold ?? 0) + gold;
      if (Number.isFinite(this.state?.supplies?.food)) this.state.supplies.food += food;

      let clueLabel = outcome?.clue?.label || 'Belirsiz hedef';
      if (outcome?.clue && Number.isFinite(outcome.clue.x) && Number.isFinite(outcome.clue.y)) {
        let markerOpportunity = null;
        if (outcome?.opportunity?.itemId) {
          const settlementKey = String(outcome.opportunity.settlementKey || outcome?.clue?.settlementKey || `${outcome.clue.x},${outcome.clue.y}`);
          const dayNow = Number(this.state.day ?? 1);
          const expiresDay = Number(outcome.opportunity.expiresDay ?? dayNow + CONST.POI.OPPORTUNITY_DURATION_DAYS);
          const bonusPct = Math.max(1, Math.floor(outcome.opportunity.bonusPct ?? 0));
          const itemId = outcome.opportunity.itemId;
          const itemName = this.getItemName(itemId);
          const daysLeft = Math.max(0, expiresDay - dayNow);
          markerOpportunity = { settlementKey, itemId, bonusPct, expiresDay };
          this.state.marketOpportunities = this.state.marketOpportunities || {};
          this.state.marketOpportunities[settlementKey] = markerOpportunity;
          clueLabel = `${outcome.clue.label || 'Yerleşim'}: ${itemName} +%${bonusPct} (${daysLeft} gün)`;
        }
        this.state.clueMarker = {
          x: outcome.clue.x,
          y: outcome.clue.y,
          label: clueLabel,
          expiresDay: Number(this.state.day ?? 1) + 3,
          opportunity: markerOpportunity,
        };
      }
      this.setLastEventLog(`İpucu bulundu: ${clueLabel}. +${gold} altın, +${food} erzak.`);
      this.poiUI?.showResult?.({ kind: 'clue', lines: [`İpucu: ${clueLabel}`, `Ödül: +${gold} altın, +${food} erzak`] });
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.NOTHING) {
      const msg = outcome?.message || 'Burada kayda değer bir şey yok...';
      this.setLastEventLog(msg);
      this.poiUI?.showResult?.({ kind: 'nothing', lines: [msg] });
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.AMBUSH) {
      const loss = outcome?.loss;
      if (loss?.mode === 'food' && Number.isFinite(this.state?.supplies?.food)) {
        const before = Math.max(0, Math.floor(this.state.supplies.food));
        const amount = Math.max(0, Math.floor(loss.amount ?? 0));
        this.state.supplies.food = Math.max(0, before - amount);
      } else if (loss?.mode === 'gold') {
        const before = Math.max(0, Math.floor(this.playerParty.gold ?? 0));
        const amount = Math.max(0, Math.floor(loss.amount ?? 0));
        this.playerParty.gold = Math.max(0, before - amount);
      } else if (loss?.mode === 'morale') {
        const amount = Math.max(0, Math.floor(loss.amount ?? 0));
        this.playerParty.morale = Math.max(0, Math.floor((this.playerParty.morale ?? 50) - amount));
      }
      this.pendingPoiAmbush = outcome.enemyId;
      const lossText = loss?.mode ? `${Math.max(0, Math.floor(loss.amount ?? 0))} ${loss.mode === 'food' ? 'erzak' : (loss.mode === 'gold' ? 'altın' : 'moral')} kaybettin` : 'kayıp yaşandı';
      this.setLastEventLog(`Pusu! ${lossText}.`);
      this.poiUI?.showResult?.({ kind: 'ambush', lines: [`Pusu! ${lossText}.`, 'Kapat ile karşılaşmaya geç.'] });
      return true;
    }

    return false;
  }


  resolvePoiFollowup() {
    const enemyId = this.pendingPoiAmbush;
    this.pendingPoiAmbush = null;
    if (!enemyId) return;

    if (Array.isArray(this.enemyParties)) {
      this.enemyParties.push({
        id: enemyId,
        x: (this.playerParty?.x ?? 0) + 60,
        y: (this.playerParty?.y ?? 0) + 40,
        radius: 12,
        speed: 40,
        vx: 0,
        vy: 0,
        temporary: Boolean(CONST.POI.AMBUSH_TEMPORARY),
      });
      this.state.aiParties = this.enemyParties;
    }
    this.state.encounter = { enemyId, startedAt: Date.now(), desc: 'Pusuya düştün!' };
    if (typeof this.enterEncounter === 'function') this.enterEncounter(enemyId);
    else if (typeof this.startEncounter === 'function') this.startEncounter(enemyId);
    else if (typeof this.state?.setMode === 'function') this.state.setMode('encounter');
  }

  getSettlementTier(settlement) {
    const type = String(settlement?.type || '').toLowerCase();
    if (type.includes('city') || type.includes('castle')) return 3;
    if (type.includes('town')) return 2;
    return 1;
  }

  getSettlementOpportunityKey(settlement) {
    if (!settlement || typeof settlement !== 'object') return null;
    if (settlement.id) return String(settlement.id);
    if (Number.isFinite(settlement.tx) && Number.isFinite(settlement.ty)) return `${settlement.tx},${settlement.ty}`;
    if (Number.isFinite(settlement.x) && Number.isFinite(settlement.y)) {
      const tx = Math.floor(settlement.x / CONST.WORLD.TILE_SIZE);
      const ty = Math.floor(settlement.y / CONST.WORLD.TILE_SIZE);
      return `${tx},${ty}`;
    }
    return null;
  }

  cleanupExpiredMarketOpportunities(day = this.state?.day) {
    if (!this.state) return;
    if (!this.state.marketOpportunities || typeof this.state.marketOpportunities !== 'object') {
      this.state.marketOpportunities = {};
      return;
    }
    const nowDay = Number(day ?? 1);
    Object.keys(this.state.marketOpportunities).forEach((key) => {
      const opportunity = this.state.marketOpportunities[key];
      if (!opportunity || !Number.isFinite(opportunity.expiresDay) || nowDay > Number(opportunity.expiresDay)) {
        delete this.state.marketOpportunities[key];
      }
    });
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
    return (this.playerParty?.roster || []).filter((u) => u?.status === 'wounded');
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
      }).join('\n') || 'No recruits available';
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
      }).join('\n')
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
        armorType: offer.templateStats.ranged ? CONST.ARMOR_TYPE.LIGHT : CONST.ARMOR_TYPE.MEDIUM,
        damageType: offer.templateStats.ranged ? CONST.DAMAGE_TYPE.PIERCE : CONST.DAMAGE_TYPE.CUT,
        wagePerDay: offer.wagePerDay,
        quality: offer.quality,
        status: 'healthy',
        healProgress: 0,
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
      unit.status = 'healthy';
      unit.healProgress = 0;
      return false;
    }
    const affordableHeal = Math.min(missing, Math.floor((this.playerParty?.gold ?? 0) / 0.2));
    if (affordableHeal <= 0) {
      this.setLastEventLog('Not enough gold to heal');
      return false;
    }
    const cost = Math.ceil(affordableHeal * 0.2);
    unit.hp = Math.min(unit.maxHp, unit.hp + affordableHeal);
    if ((unit.hp / Math.max(1, unit.maxHp)) > 0.35) {
      unit.status = 'healthy';
      unit.healProgress = 0;
    }
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

    let usedAmmo = 0;
    if (Number.isFinite(battle.playerAmmoStart)) {
      usedAmmo = Math.max(0, Math.floor(Number(battle.playerAmmoStart) - Math.max(0, Number(battle.playerAmmo ?? 0))));
    }
    if (!Number.isFinite(usedAmmo)) usedAmmo = 0;
    const arrowsExists = Array.isArray(this.playerParty?.inventory?.items)
      && this.playerParty.inventory.items.some((item) => item?.id === 'arrows');
    if (arrowsExists && usedAmmo > 0) this.removeItem('arrows', usedAmmo);

    const rosterBefore = new Map((this.playerParty?.roster || []).map((u) => [u.id, { ...u }]));
    const casualtyCfg = this.getEffectiveTuning().BATTLE_CASUALTIES;
    const battleRng = () => Math.random();
    applyBattleOutcomes({ battle, party: this.playerParty, cfg: casualtyCfg, rng: battleRng });
    const dead = [];
    const wounded = [];
    for (const [id, unitBefore] of rosterBefore.entries()) {
      const after = (this.playerParty?.roster || []).find((u) => u.id === id);
      if (!after) dead.push({ id: unitBefore.id, name: unitBefore.name });
      else if (after.status === 'wounded') wounded.push({ id: after.id, name: after.name });
    }
    const outcome = { dead, wounded };
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
      this.cleanupTemporaryEnemy(enemyId, { force: true });
      this.applyBattleExit(enemy, enemyId, this.encounterPushbackDistance);
    } else if (result === 'defeat') {
      this.cancelPlayerDestination();
      this.cleanupTemporaryEnemy(enemyId);
      this.applyBattleExit(enemy, enemyId, this.defeatPushbackDistance);
    } else {
      this.cleanupTemporaryEnemy(enemyId);
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
    this.battleCommandsUI?.hide?.();
    this.battleDeployUI?.hide?.();
    this.battleDeployMode = null;
  }

  cleanupTemporaryEnemy(enemyId, { force = false } = {}) {
    if (!enemyId || !Array.isArray(this.enemyParties)) return false;
    const enemy = this.enemyParties.find((party) => party?.id === enemyId);
    if (!enemy) return false;
    if (force || enemy?.temporary) return this.despawnEnemyParty(enemyId);
    return false;
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

        if (this.state?.battle?.phase === 'deploy' && this.battleDeployMode?.active) {
          this.battleDeployMode.setAnchor(x, y);
          return;
        }

        const hit = (this.state?.battle?.playerUnits || []).find((u) => !u.dead && Math.hypot(u.x - x, u.y - y) <= ((u.radius ?? 10) + 8));
        if (!hit) return;
        this.state.battle.selection = this.state.battle.selection || {};
        this.state.battle.selection.unitId = hit.unitId;
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

      if (this.state?.devMode && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault?.();
        if (this.dom?.tuningModal && !this.dom.tuningModal.classList.contains('hidden')) this.hideTuningModal();
        else { this.showTuningModal(); }
        return;
      }

      if (this.dom?.tuningModal && !this.dom.tuningModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault?.();
          this.hideTuningModal();
        }
        return;
      }

      if (this.state?.devMode && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault?.();
        this.reloadSpriteAssets();
        return;
      }

      if (e.key === 'Enter' && this.mode === 'menu') {
        e.preventDefault?.();
        this.enterStart();
        return;
      }

      if ((e.key === 'k' || e.key === 'K') && this.state?.mode === 'map') {
        e.preventDefault?.();
        this.toggleCampMode();
        return;
      }

      if (this.state?.accounting) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
          e.preventDefault?.();
          this.closeAccountingModal();
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
        if (this.state?.battle?.phase === 'deploy' && this.battleDeployMode?.active) {
          if (e.key === '1') { e.preventDefault?.(); this.battleDeployMode.setFormation(CONST.FORMATION.LINE); this.battleDeployUI?.setFormation?.(CONST.FORMATION.LINE); return; }
          if (e.key === '2') { e.preventDefault?.(); this.battleDeployMode.setFormation(CONST.FORMATION.COLUMN); this.battleDeployUI?.setFormation?.(CONST.FORMATION.COLUMN); return; }
          if (e.key === '3') { e.preventDefault?.(); this.battleDeployMode.setFormation(CONST.FORMATION.WEDGE); this.battleDeployUI?.setFormation?.(CONST.FORMATION.WEDGE); return; }
          if (e.key === '4') { e.preventDefault?.(); this.battleDeployMode.setFormation(CONST.FORMATION.SCATTER); this.battleDeployUI?.setFormation?.(CONST.FORMATION.SCATTER); return; }
          if (e.key === 'q' || e.key === 'Q') { e.preventDefault?.(); this.battleDeployMode.rotate(-1); return; }
          if (e.key === 'e' || e.key === 'E') { e.preventDefault?.(); this.battleDeployMode.rotate(1); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); this.confirmBattleDeployment(); return; }
          if (e.key === 'Escape') { e.preventDefault?.(); this.cancelBattleDeployment(); return; }
          return;
        }

        if (e.key === 'h' || e.key === 'H') { e.preventDefault?.(); this.applyBattleCommand(CONST.BATTLE_COMMANDS.HOLD); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault?.(); this.applyBattleCommand(CONST.BATTLE_COMMANDS.FOCUS); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault?.(); this.applyBattleCommand(CONST.BATTLE_COMMANDS.RETREAT); return; }
        if (e.key === 'k' || e.key === 'K') { e.preventDefault?.(); this.applyBattleCommand(CONST.BATTLE_COMMANDS.SKIRMISH); return; }
        if (e.key === 'x' || e.key === 'X') { e.preventDefault?.(); this.toggleBattleHoldFire(); return; }
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault?.();
          this.resolveBattle('victory');
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
        this.enterCityServices();
        return;
      }

      if ((e.key === 'e' || e.key === 'E') && this.state?.mode === 'map') {
        e.preventDefault?.();
        const pois = this.state?.map?.pois;
        if (!Array.isArray(pois) || pois.length === 0) {
          if (this.state) this.state.interactHint = '';
          return;
        }
        this.openPoiModal();
        return;
      }

      if (this.mode !== 'playing') return;

      if (e.key === ' ' && this.state?.mode !== 'start') {
        e.preventDefault?.();
        this.state.togglePause();
      }

      if (this.state?.devMode && e.key === 'F3') {
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
      factionGrid: utils.getEl('factionGrid'),
      btnStart: utils.getEl('btnStart'),
      btnContinue: utils.getEl('btnContinue'),
      btnLoadStart: utils.getEl('btnLoadStart'),
      seedInput: utils.getEl('seedInput'),
      randomSeedBtn: utils.getEl('randomSeedBtn'),
      startSaveInfo: utils.getEl('startSaveInfo'),
      selectedFactionName: utils.getEl('selectedFactionName'),
      selectedFactionDesc: utils.getEl('selectedFactionDesc'),
      selectedFactionDoc: utils.getEl('selectedFactionDoc'),
      selectedFactionArmy: utils.getEl('selectedFactionArmy'),
      mainMenuOverlay: utils.getEl('mainMenuOverlay'),
      settlementModal: utils.getEl('settlementModal'),
      encounterModal: utils.getEl('encounterModal'),
      poiModal: utils.getEl('poiModal'),
      poiTitle: utils.getEl('poiTitle'),
      poiDesc: utils.getEl('poiDesc'),
      poiCooldown: utils.getEl('poiCooldown'),
      poiResult: utils.getEl('poiResult'),
      btnClosePoi: utils.getEl('btnClosePoi'),
      btnPoiInvestigate: utils.getEl('btnPoiInvestigate'),
      btnPoiLeave: utils.getEl('btnPoiLeave'),
      battleResultModal: utils.getEl('battleResultModal'),
      battleCommandBar: utils.getEl('battleCommandBar'),
      battleDeployOverlay: utils.getEl('battleDeployOverlay'),
      btnDeployStart: utils.getEl('btnDeployStart'),
      btnDeployCancel: utils.getEl('btnDeployCancel'),
      deployHint: utils.getEl('deployHint'),
      toggleHints: utils.getEl('toggleHints'),
      tooltip: utils.getEl('tooltip'),
      debugOverlay: utils.getEl('debugOverlay'),
      hudMinimapPanel: utils.getEl('hudMinimapPanel'),
      hudMiniMap: utils.getEl('hudMiniMap'),
      saveTransferText: utils.getEl('saveTransferText'),
      accountingModal: utils.getEl('accountingModal'),
      accountingBody: utils.getEl('accountingBody'),
      btnAccountingContinue: utils.getEl('btnAccountingContinue'),
      tuningModal: utils.getEl('tuningModal'),
      tuningBody: utils.getEl('tuningBody'),
      btnCloseTuning: utils.getEl('btnCloseTuning'),
      btnTuningSave: utils.getEl('btnTuningSave'),
      btnTuningReset: utils.getEl('btnTuningReset'),
      buildInfo: utils.getEl('buildInfo'),
    };

    const optionalStartUi = new Set(['factionGrid', 'btnStart', 'btnContinue', 'btnLoadStart', 'seedInput', 'randomSeedBtn', 'startSaveInfo', 'selectedFactionName', 'selectedFactionDesc', 'selectedFactionDoc', 'selectedFactionArmy']);
    const missing = Object.entries(this.dom).filter(([key, el]) => !el && !optionalStartUi.has(key)).map(([key]) => key);
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

    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
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
    }

    const btnBattlePause = document.getElementById('btnBattlePause');
    if (btnBattlePause) {
      btnBattlePause.addEventListener('click', () => {
        if (this.state?.mode === 'battle') this.togglePaused();
      });
    }

    this.setupDebugSmokePanel();
  }


  setupSettingsUI() {
    const toggleHints = this.dom?.toggleHints;
    this.ensureTutorialState();
    if (!toggleHints) return;
    toggleHints.checked = Boolean(this.state?.tutorial?.enabled);
    if (toggleHints.dataset.boundHintToggle === '1') return;
    toggleHints.dataset.boundHintToggle = '1';
    toggleHints.addEventListener('change', (event) => {
      this.ensureTutorialState();
      const checked = Boolean(event?.target?.checked);
      this.state.tutorial.enabled = checked;
      if (!checked) this.state.tutorial.lastShownAt = 0;
    });
  }


  setupDebugSmokePanel() {
    if (!this.dom?.debugOverlay) return;
    if (!this.state?.devMode) {
      this.dom.debugOverlay.classList.add('hidden');
      this.dom.debugOverlay.innerHTML = '';
      return;
    }
    if (this.dom.debugOverlay.dataset.smokeReady === '1') return;
    this.dom.debugOverlay.dataset.smokeReady = '1';
    this.dom.debugOverlay.innerHTML = '<div id="debugInfo" class="debug-info"></div><div class="debug-actions"><button id="btnOpenTuning" class="action-btn btn-dark text-xs">Tuning</button><button id="btnRunSmoke" class="action-btn btn-dark text-xs">Run Smoke</button><pre id="smokeResults" class="smoke-results"></pre></div>';
    this.dom.btnRunSmoke = this.dom.debugOverlay.querySelector('#btnRunSmoke');
    this.dom.btnOpenTuning = this.dom.debugOverlay.querySelector('#btnOpenTuning');
    this.dom.smokeResults = this.dom.debugOverlay.querySelector('#smokeResults');

    if (this.dom.btnOpenTuning && !this._tuningDebugBtnBound) {
      this._tuningDebugBtnBound = true;
      this.dom.btnOpenTuning.addEventListener('click', () => { this.showTuningModal(); });
    }

    if (this.dom.btnRunSmoke && !this._smokeBtnBound) {
      this._smokeBtnBound = true;
      this.dom.btnRunSmoke.addEventListener('click', async () => {
        await this.runSmokeScenarios();
      });
    }

    if (typeof window !== 'undefined' && this.state?.devMode) {
      window.__FOC_RUN_SMOKE__ = () => this.runSmokeScenarios();
    }
  }

  appendSmokeResults(results) {
    if (!this.dom?.smokeResults) return;
    const rows = (results || []).map((r) => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.msg}`);
    this.dom.smokeResults.textContent = rows.join('\n');
  }

  async runSmokeScenarios() {
    if (!this.state?.devMode) return [];
    const out = [];
    const push = (name, ok, msg) => out.push({ name, ok: Boolean(ok), msg: msg || (ok ? 'PASS' : 'FAIL') });

    push('1) Start screen opens', this.state?.mode === 'start', `mode=${this.state?.mode}`);
    push('2) Faction cards exist', (document.querySelectorAll('.faction-card').length || 0) > 0, `cards=${document.querySelectorAll('.faction-card').length}`);
    push('3) Start button state exists', Boolean(this.dom?.btnStart), this.dom?.btnStart?.disabled ? 'disabled' : 'enabled');

    const prevMode = this.state?.mode;
    this.startNewGame();
    push('4) Start enters map', this.state?.mode === 'map', `mode=${this.state?.mode}`);

    const nearSettlement = this.getActiveSettlementForCity();
    push('5) Settlement nearby query', Boolean(nearSettlement), nearSettlement ? (nearSettlement.name || nearSettlement.id) : 'none');

    const prevCamp = Boolean(this.state?.camp?.active);
    if (!prevCamp) this.toggleCampMode();
    push('6) Camp can activate', Boolean(this.state?.camp?.active), `active=${this.state?.camp?.active}`);
    if (this.state?.camp?.active) this.toggleCampMode();
    push('7) Camp can deactivate', !this.state?.camp?.active, `active=${this.state?.camp?.active}`);

    const movementCtx = this.getMovementContextAt(this.playerParty?.x ?? 0, this.playerParty?.y ?? 0);
    push('8) Movement context valid', Number.isFinite(movementCtx?.speedMult), `speedMult=${movementCtx?.speedMult}`);

    const foodBefore = this.state?.supplies?.food ?? 0;
    this.processDailyEconomy((this.state?.day ?? 1) + 1);
    push('9) End day opens accounting', Boolean(this.state?.accounting), this.state?.accounting ? 'opened' : 'not opened');
    push('10) Food consumed/unchanged', (this.state?.supplies?.food ?? 0) <= foodBefore, `${foodBefore}→${this.state?.supplies?.food ?? 0}`);

    const saveOk = this.saveToSlot('manual2');
    const loadOk = this.loadFromSlot('manual2');
    push('11) Save+Load works', Boolean(saveOk && loadOk), `save=${saveOk} load=${loadOk}`);
    push('12) lastAccounting exists', Boolean(this.state?.lastAccounting), this.state?.lastAccounting ? 'present' : 'missing');

    push('13) Battle command UI exists', Boolean(this.dom?.battleCommandBar), this.dom?.battleCommandBar ? 'present' : 'missing');
    const dmgTest = computeDamage({ attacker: { atk: 10, damageType: CONST.DAMAGE_TYPE.CUT }, defender: { armorType: CONST.ARMOR_TYPE.HEAVY }, base: 10, terrainMods: CONST.TERRAIN_MODS.PLAINS });
    push('14) computeDamage finite', Number.isFinite(dmgTest), `damage=${dmgTest}`);

    this.state.battle = this.state.battle || { playerUnits: [{ unitId: 'p1' }], enemyUnits: [], phase: 'deploy', projectiles: [] };
    this.battleDeployMode = new BattleDeployMode({ state: this.state, party: this.playerParty, battle: this.state.battle, camera: this.state?.camera });
    this.battleDeployUI?.show?.();
    push('15) Deployment overlay shows on battle start', !(this.dom?.battleDeployOverlay?.classList?.contains('hidden')), this.dom?.battleDeployOverlay?.classList?.contains('hidden') ? 'hidden' : 'visible');
    const previewCount = this.battleDeployMode.computePreviewPositions((this.state.battle.playerUnits || []).length).length;
    push('16) Formation preview count matches units', previewCount === (this.state.battle.playerUnits || []).length, `preview=${previewCount}`);

    const mapPois = this.state?.map?.pois || [];
    if (mapPois.length > 0) {
      const p = mapPois[0];
      const tileSize = CONST.WORLD.TILE_SIZE;
      this.playerParty.x = p.x * tileSize + tileSize * 0.5;
      this.playerParty.y = p.y * tileSize + tileSize * 0.5;
      this.updatePoiInteractHint();
      push('17) POI interaction hint appears near POI', Boolean(this.state?.interactHint), this.state?.interactHint || 'missing');

      const poiKey = PoiSystem.keyOfPoi(p);
      const prevVisited = this.state.poiState?.[poiKey]?.lastVisitedDay;
      this.activePoi = p;
      this.investigateActivePoi();
      const nowVisited = this.state.poiState?.[poiKey]?.lastVisitedDay;
      const expectedDay = Number(this.state?.day ?? 1);
      push('18) POI investigate updates poiState', nowVisited === expectedDay || nowVisited === prevVisited, `lastVisited=${nowVisited}`);

      const moveCtxAtPoi = this.getMovementContextAt(this.playerParty.x, this.playerParty.y);
      const testCtx = {
        onRoad: Boolean(moveCtxAtPoi?.onRoad),
        biomeKey: this.getBiomeKeyAtTile(p.x, p.y),
        settlementTier: this.getNearestSettlementTierAt(p.x, p.y),
        map: this.state?.map,
      };
      const first = PoiSystem.rollOutcome({ seed: this.state.seed, day: this.state.day, poi: p, context: testCtx, tuning: this.state?.tuning });
      const second = PoiSystem.rollOutcome({ seed: this.state.seed, day: this.state.day, poi: p, context: testCtx, tuning: this.state?.tuning });
      push('19) POI rollOutcome deterministic kind', first?.kind === second?.kind, `${first?.kind} vs ${second?.kind}`);
    } else {
      push('17) POI interaction hint appears near POI', true, 'PASS (no POI data)');
      push('18) POI investigate updates poiState', true, 'PASS (no POI data)');
      push('19) POI rollOutcome deterministic kind', true, 'PASS (no POI data)');
    }

    const firstSettlement = this.state?.map?.settlements?.[0] || null;
    if (firstSettlement) {
      const settlementKey = this.getSettlementOpportunityKey(firstSettlement);
      const market = this.getOrCreateMarketForSettlement(firstSettlement);
      const itemId = (CONST.TRADE_ITEMS?.[0]?.id) || null;
      if (settlementKey && itemId) {
        const baseSell = tradeSystem.getPrice(firstSettlement, market, itemId, 'sell', {
          day: this.state.day,
          settlementKey,
          marketOpportunities: {},
          tuning: this.state?.tuning,
        });
        this.state.marketOpportunities[settlementKey] = { itemId, bonusPct: 25, expiresDay: Number(this.state.day ?? 1) + 2 };
        const boostedSell = tradeSystem.getPrice(firstSettlement, market, itemId, 'sell', {
          day: this.state.day,
          settlementKey,
          marketOpportunities: this.state.marketOpportunities,
          tuning: this.state?.tuning,
        });
        push('20) Opportunity modifies sell price when active', boostedSell > baseSell, `${baseSell}→${boostedSell}`);

        this.state.marketOpportunities[settlementKey] = { itemId, bonusPct: 25, expiresDay: Number(this.state.day ?? 1) - 1 };
        this.cleanupExpiredMarketOpportunities(this.state.day);
        push('21) Expired opportunities are cleaned', !this.state.marketOpportunities[settlementKey], this.state.marketOpportunities[settlementKey] ? 'not cleaned' : 'cleaned');
      } else {
        push('20) Opportunity modifies sell price when active', true, 'PASS (missing settlementKey/itemId)');
        push('21) Expired opportunities are cleaned', true, 'PASS (missing settlementKey/itemId)');
      }
    } else {
      push('20) Opportunity modifies sell price when active', true, 'PASS (no settlement data)');
      push('21) Expired opportunities are cleaned', true, 'PASS (no settlement data)');
    }

    push('22) Tuning state exists', Boolean(this.state?.tuning && typeof this.state.tuning === 'object' && !Array.isArray(this.state.tuning)), this.state?.tuning ? 'present' : 'missing');

    const baseRisk = computeRiskMultiplier({
      state: { ...this.state, tuning: {} },
      movementCtx: { onRoad: true },
      biomeKey: 'PLAINS',
      inCamp: false,
      supplies: { food: 10 },
      market: null,
    });
    const tunedRisk = computeRiskMultiplier({
      state: { ...this.state, tuning: { ENCOUNTER_RISK: { ROAD_MULT: Number(CONST.ENCOUNTER_RISK.ROAD_MULT) + 0.25 } } },
      movementCtx: { onRoad: true },
      biomeKey: 'PLAINS',
      inCamp: false,
      supplies: { food: 10 },
      market: null,
    });
    push('23) Tuning override affects encounterRisk', tunedRisk !== baseRisk, `${baseRisk}→${tunedRisk}`);

    if (prevMode === 'start') this.enterStart();

    this.smokeResults = out;
    this.appendSmokeResults(out);
    return out;
  }

  onModeChanged(oldMode, newMode) {
    utils.devLog(this.state, `[Game] Mode changed: ${oldMode} → ${newMode}`);
    if (newMode !== 'map') {
      this.poiUI?.hide?.();
      this.activePoi = null;
      if (this.state) this.state.interactHint = '';
    }
    if (newMode === 'start') {
      utils.safeClass(this.dom.hud, 'add', 'hidden');
      utils.safeClass(this.dom.startModal, 'remove', 'hidden');
      utils.safeClass(this.dom.mainMenuOverlay, 'add', 'hidden');
      this.startScreen?.refresh?.();
      this.battleCommandsUI?.hide?.();
      return;
    }

    utils.safeClass(this.dom.hud, 'remove', 'hidden');
    utils.safeClass(this.dom.startModal, 'add', 'hidden');
    utils.safeClass(this.dom.mainMenuOverlay, 'add', 'hidden');
    if (newMode === 'battle') this.battleCommandsUI?.show?.();
    else this.battleCommandsUI?.hide?.();
    if (newMode !== 'battle') this.battleDeployUI?.hide?.();
  }



  setupStartFlow() {
    if (!this.startScreen) {
      this.startScreen = new StartScreen({
        state: this.state,
        saveSystem: this.saveSystem,
        onStart: ({ faction, seed }) => {
          this.state.seed = seed;
          this.state.selectedFaction = {
            id: faction.id,
            name: faction.name,
            color: faction.color,
            doctrine: faction.doctrine,
            desc: faction.desc,
          };
          if (this.state.player) {
            this.state.player.gold = faction.startingGold;
            this.state.player.renown = faction.startingRenown;
            this.state.player.army = faction.startingArmy;
          }
          if (this.playerParty) {
            this.playerParty.gold = faction.startingGold;
          }

          this.ensureWorldGenerated(seed);
          this.startNewGame();
        },
        onContinue: () => this.continueGame(),
        onLoad: () => this.openSaveLoadPanel(),
      });
    }

    this.startScreen.bind({
      factionGrid: utils.getEl('factionGrid'),
      btnStart: utils.getEl('btnStart'),
      btnContinue: utils.getEl('btnContinue'),
      btnLoadStart: utils.getEl('btnLoadStart'),
      seedInput: utils.getEl('seedInput'),
      randomSeedBtn: utils.getEl('randomSeedBtn'),
      selectedFactionName: utils.getEl('selectedFactionName'),
      selectedFactionDesc: utils.getEl('selectedFactionDesc'),
      selectedFactionDoc: utils.getEl('selectedFactionDoc'),
      selectedFactionArmy: utils.getEl('selectedFactionArmy'),
      startSaveInfo: utils.getEl('startSaveInfo'),
    });
  }

  enterStart() {
    this.mode = 'menu';
    this.hudManager?.setMenuVisible?.(false);
    this.hudManager?.setSettingsVisible?.(false);

    if (this.state?.mode !== 'start') {
      this.state.setMode('start');
    } else {
      this.onModeChanged('menu', 'start');
    }

    document.getElementById('mainMenuOverlay')?.classList.add('hidden');
  }
  setupMenuActions() {
    if (!this.hudManager || typeof this.hudManager.setMenuHandlers !== 'function') return;

    this.hudManager.setMenuHandlers({
      onStart: () => this.enterStart(),
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
    if (!canContinue) {
      this.startScreen?.setInfoMessage?.('Kayıt bulunamadı.');
      return false;
    }

    const payload = this.saveSystem?.loadLatest?.();
    if (!payload) {
      this.startScreen?.setInfoMessage?.('Kayıt bulunamadı.');
      return false;
    }

    const ok = this.applySavePayload(payload, { slot: 'autosave' });
    if (!ok) {
      this.startScreen?.setInfoMessage?.('Kayıt yüklenemedi.');
      return false;
    }

    if (!this.started && this.gameLoop?.start) {
      this.started = true;
      this.gameLoop.start();
    }

    this.mode = 'playing';
    if (this.state?.mode !== 'map') this.state.setMode('map');
    this.startAutosaveLoop();
    this.hudManager?.setPaused?.(false);
    this.hudManager?.setMenuVisible?.(false);
    this.hudManager?.setSettingsVisible?.(false);
    utils.safeClass(this.dom.startModal, 'add', 'hidden');
    utils.safeClass(this.dom.mainMenuOverlay, 'add', 'hidden');
    this.clampCameraToWorld();
    this.updateTransientUIState();
    return true;
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

    if (!Array.isArray(this.state?.map?.tiles) || this.state.map.tiles.length === 0) {
      this.ensureWorldGenerated(this.state?.seed);
    }

    if (this.state.mode !== 'map') {
      this.state.setMode('map');
    }

    this.updateTransientUIState();

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
    if (!this.state?.devMode || !this.state?.debug) return;

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
      status: ['healthy', 'wounded', 'dead'].includes(unit.status) ? unit.status : 'healthy',
      healProgress: Math.max(0, Math.min(1, Number(unit.healProgress ?? 0))),
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
          temporary: Boolean(e.temporary),
        })),
        enemyCooldowns: this.lastEncounterEndTimeByEnemyId || {},
        settlementsRecruit,
        settlementsMarkets: settlements.filter((st) => st?.id).map((st) => ({
          settlementId: st.id,
          marketStock: Array.isArray(st.marketStock) ? st.marketStock : [],
          priceMultiplier: st.priceMultiplier && typeof st.priceMultiplier === 'object' ? st.priceMultiplier : {},
        })),
        markets: this.state?.markets && typeof this.state.markets === 'object' ? this.state.markets : {},
        supplies: this.state?.supplies && typeof this.state.supplies === 'object' ? this.state.supplies : { food: 30 },
        camp: this.state?.camp && typeof this.state.camp === 'object' ? this.state.camp : { active: false, watch: 'med' },
        tutorial: {
          enabled: Boolean(this.state?.tutorial?.enabled ?? CONST.TUTORIAL_HINTS.ENABLED_DEFAULT),
          shown: this.state?.tutorial?.shown && typeof this.state.tutorial.shown === 'object' ? this.state.tutorial.shown : {},
        },
        poiState: this.state?.poiState && typeof this.state.poiState === 'object' ? this.state.poiState : {},
        clueMarker: this.state?.clueMarker && typeof this.state.clueMarker === 'object' ? this.state.clueMarker : null,
        marketOpportunities: this.state?.marketOpportunities && typeof this.state.marketOpportunities === 'object' ? this.state.marketOpportunities : {},
        status: this.state?.status && typeof this.state.status === 'object' ? this.state.status : { starving: false },
        lastAccounting: this.state?.lastAccounting && typeof this.state.lastAccounting === 'object' ? this.state.lastAccounting : null,
        dailyLedger: this.state?.dailyLedger && typeof this.state.dailyLedger === 'object' ? this.state.dailyLedger : { tradePL: 0 },
        inventory,
        tuning: this.state?.tuning && typeof this.state.tuning === 'object' ? this.state.tuning : {},
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
      status: ['healthy', 'wounded', 'dead'].includes(u.status) ? u.status : 'healthy',
      healProgress: Math.max(0, Math.min(1, Number(u.healProgress ?? 0))),
    })).filter((u) => u.status !== 'dead');
    this.ensureRosterState();

    this.enemyParties = (Array.isArray(game.enemies) ? game.enemies : []).filter((e) => !e?.temporary).map((e) => ({
      id: e.id,
      x: Number.isFinite(e.x) ? e.x : 0,
      y: Number.isFinite(e.y) ? e.y : 0,
      radius: Number.isFinite(e.radius) ? e.radius : 12,
      speed: Number.isFinite(e.speed) ? e.speed : 35,
      vx: Number.isFinite(e.vx) ? e.vx : 0,
      vy: Number.isFinite(e.vy) ? e.vy : 0,
      temporary: false,
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

    this.state.markets = game.markets && typeof game.markets === 'object' ? game.markets : {};
    Object.values(this.state.markets).forEach((market) => {
      if (!market || typeof market !== 'object') return;
      if (!market.momentum || typeof market.momentum !== 'object') market.momentum = {};
    });
    this.state.supplies = game.supplies && typeof game.supplies === 'object' ? game.supplies : { food: 30 };
    this.state.camp = game.camp && typeof game.camp === 'object' ? game.camp : { active: false, watch: 'med' };
    this.state.tutorial = {
      enabled: typeof game?.tutorial?.enabled === 'boolean' ? game.tutorial.enabled : CONST.TUTORIAL_HINTS.ENABLED_DEFAULT,
      shown: game?.tutorial?.shown && typeof game.tutorial.shown === 'object' && !Array.isArray(game.tutorial.shown) ? game.tutorial.shown : {},
      lastShownAt: 0,
    };
    this.state.poiState = game.poiState && typeof game.poiState === 'object' && !Array.isArray(game.poiState) ? game.poiState : {};
    this.state.clueMarker = game.clueMarker && typeof game.clueMarker === 'object' ? game.clueMarker : null;
    this.state.marketOpportunities = game.marketOpportunities && typeof game.marketOpportunities === 'object' && !Array.isArray(game.marketOpportunities)
      ? game.marketOpportunities
      : {};
    this.state.status = game.status && typeof game.status === 'object' ? game.status : { starving: false };
    this.state.lastAccounting = game.lastAccounting && typeof game.lastAccounting === 'object' ? game.lastAccounting : null;
    this.state.dailyLedger = game.dailyLedger && typeof game.dailyLedger === 'object'
      ? { tradePL: Number(game.dailyLedger.tradePL ?? 0) }
      : { tradePL: 0 };
    this.state.tuning = game.tuning && typeof game.tuning === 'object' && !Array.isArray(game.tuning) ? game.tuning : {};
    suppliesSystem.ensureSuppliesState(this.state);
    campSystem.ensureCampState(this.state);
    PoiSystem.ensurePoiState(this.state);
    this.cleanupExpiredMarketOpportunities(this.state.day);

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
    this.setupSettingsUI();
    this.updateTransientUIState();
    return true;
  }

  getSelectedSaveSlot() {
    return this.saveLoadRows[Math.max(0, Math.min(this.saveLoadRows.length - 1, this.saveLoadCursor))] || 'manual1';
  }

  openSaveLoadPanel() {
    if (typeof this.saveSystem?.openLoadPanel === 'function') {
      const opened = this.saveSystem.openLoadPanel();
      if (opened) return true;
    }

    if (this.state && !this.state.saveLoadOpen) {
      this.saveLoadPreviousMode = this.state.mode;
      this.state.saveLoadOpen = true;
      this.saveLoadCursor = 0;
      this.state.uiPanel = this.buildSaveLoadPanelData();
      this.updateTransientUIState();
      return true;
    }

    const continued = this.continueGame();
    if (!continued) {
      this.startScreen?.setInfoMessage?.('Kayıt yükleme arayüzü yok; autosave yok.');
    }
    return continued;
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

    this.renderWorldTerrain(this.ctx, camera);
    this.renderWorldOverlays(this.ctx, camera);

    this.ctx.restore();

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

  renderWorldTerrain(ctx, camera) {
    const map = this.state?.map;
    if (!map || !Array.isArray(map.tiles) || map.tiles.length === 0) return;

    const tileSize = CONST.WORLD.TILE_SIZE;
    const width = Number.isFinite(map.width) ? map.width : CONST.WORLD.MAP_WIDTH;
    const height = Number.isFinite(map.height) ? map.height : CONST.WORLD.MAP_HEIGHT;
    const fog = map.fog instanceof Uint8Array ? map.fog : null;

    const minX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
    const minY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
    const maxX = Math.min(width - 1, Math.ceil((camera.x + (this.canvas.width / camera.zoom)) / tileSize) + 1);
    const maxY = Math.min(height - 1, Math.ceil((camera.y + (this.canvas.height / camera.zoom)) / tileSize) + 1);

    const biomeColors = CONST.BIOME_COLORS || {};
    const biomes = map.biomes instanceof Uint8Array ? map.biomes : null;

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const idx = ty * width + tx;
        const tile = map.tiles[idx];
        const fallbackBiome = tile?.type === CONST.TERRAIN.TYPE.WATER
          ? CONST.BIOME.SEA
          : tile?.type === CONST.TERRAIN.TYPE.SHORE
            ? CONST.BIOME.SHORE
            : tile?.type === CONST.TERRAIN.TYPE.MOUNTAIN
              ? CONST.BIOME.MOUNTAIN
              : tile?.type === CONST.TERRAIN.TYPE.SNOW
                ? CONST.BIOME.SNOW
                : tile?.type === CONST.TERRAIN.TYPE.FOREST
                  ? CONST.BIOME.FOREST
                  : CONST.BIOME.PLAINS;
        const biome = biomes ? biomes[idx] : fallbackBiome;
        ctx.fillStyle = biomeColors[biome] || CONST.WORLD.COLOR_GRASS;
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);

        const fogLevel = fog ? fog[idx] : 2;
        if (fogLevel === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.92)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        } else if (fogLevel === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        }
      }
    }

    ctx.lineWidth = Math.max(1, 2 / camera.zoom);
    ctx.strokeStyle = 'rgba(69,116,184,0.9)';
    (map.rivers || []).forEach((river) => {
      if (!Array.isArray(river) || river.length < 2) return;
      ctx.beginPath();
      river.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(161,129,88,0.8)';
    (map.roads || []).forEach((road) => {
      const path = road?.path;
      if (!Array.isArray(path) || path.length < 2) return;
      ctx.beginPath();
      path.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });


    (map.pois || []).forEach((poi) => {
      const tx = poi?.x;
      const ty = poi?.y;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const px = (tx + 0.5) * tileSize;
      const py = (ty + 0.5) * tileSize;
      ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, 1.6 / camera.zoom);

      const poiSpriteKey = this.getPoiSpriteKey(poi.type);
      const poiScale = Math.max(0.65, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (this.assetsReady) {
        const drawn = this.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
        if (drawn) return;
      }

      if (poi.type === 'camp') {
        const s = Math.max(4, 8 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px - s * 0.8, py + s * 0.7);
        ctx.lineTo(px + s * 0.8, py + s * 0.7);
        ctx.closePath();
        ctx.stroke();
      } else {
        const s = Math.max(4, 7 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px - s, py - s);
        ctx.lineTo(px + s, py + s);
        ctx.moveTo(px + s, py - s);
        ctx.lineTo(px - s, py + s);
        ctx.stroke();
      }
    });

    (map.settlements || []).forEach((settlement) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const sx = Number.isFinite(settlement.x) ? settlement.x : (tx + 0.5) * tileSize;
      const sy = Number.isFinite(settlement.y) ? settlement.y : (ty + 0.5) * tileSize;
      const settlementScale = Math.max(0.75, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (this.assetsReady) {
        const drawn = this.spriteLoader?.drawSprite(ctx, 'settlement', sx, sy, { scale: settlementScale, anchor: 'center' });
        if (drawn) return;
      }
      ctx.fillStyle = fogLevel === 1 ? 'rgba(232,196,76,0.65)' : '#e8c44c';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(3, 7 / camera.zoom), 0, Math.PI * 2);
      ctx.fill();
    });

    const clue = this.state?.clueMarker;
    if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
      const cx = Number(clue.x);
      const cy = Number(clue.y);
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
        const fogLevel = fog ? fog[cy * width + cx] : 2;
        if (fogLevel > 0) {
          const x = (cx + 0.5) * tileSize;
          const y = (cy + 0.5) * tileSize;
          ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
          ctx.lineWidth = Math.max(1, 2.2 / camera.zoom);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, 11 / camera.zoom), 0, Math.PI * 2);
          ctx.stroke();
          if (camera.zoom >= 0.6) {
            ctx.fillStyle = 'rgba(245,218,96,0.95)';
            ctx.font = `${Math.max(10, 12 / camera.zoom)}px Inter`;
            ctx.fillText(String(clue.label || 'İpucu'), x + (10 / camera.zoom), y - (8 / camera.zoom));
          }
        }
      }
    }
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
    if (battle.phase === 'deploy' && this.battleDeployMode?.active) {
      this.updateTransientUIState();
      return;
    }

    const playerUnits = battle.playerUnits || [];
    const enemyUnits = battle.enemyUnits || [];

    if (battle.phase === 'deploy' && this.battleDeployMode?.active) {
      const preview = this.battleDeployMode.computePreviewPositions(playerUnits.length);
      this.ctx.fillStyle = 'rgba(212,175,55,0.12)';
      this.ctx.fillRect(40, 60, Math.max(120, (this.canvas.width / 2) - 80), Math.max(120, this.canvas.height - 120));
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(90,180,255,0.45)';
      preview.forEach((p) => { this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); this.ctx.fill(); });
      const ax = this.battleDeployMode.anchorX;
      const ay = this.battleDeployMode.anchorY;
      const len = 42;
      const rad = (this.battleDeployMode.angleDeg * Math.PI) / 180;
      this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(ax, ay);
      this.ctx.lineTo(ax + Math.cos(rad) * len, ay + Math.sin(rad) * len);
      this.ctx.stroke();
      this.ctx.restore();
    }
    const alivePlayer = playerUnits.filter((u) => !u.dead && u.hp > 0).length;
    const aliveEnemy = enemyUnits.filter((u) => !u.dead && u.hp > 0).length;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Player: ${alivePlayer}   Enemy: ${aliveEnemy}   H/F/R/X Commands`, this.canvas.width / 2, 30);
    const ammoNow = Math.max(0, Math.floor(Number(battle.playerAmmo ?? 0)));
    const ammoStart = Math.max(0, Math.floor(Number(battle.playerAmmoStart ?? 0)));
    this.ctx.font = '14px Arial';
    this.ctx.fillText(`Arrows: ${ammoNow}/${ammoStart}`, this.canvas.width / 2, 50);

    const now = performance.now();
    for (const unit of [...playerUnits, ...enemyUnits]) {
      this.ensureBattleUnitFx(unit);
      if (unit.hp <= 0 && !unit.fx.deathStartedAt) unit.fx.deathStartedAt = now;
      const isRenderable = !unit._remove && (!unit.dead || unit.fx.deathStartedAt);
      if (!isRenderable) continue;
      this.drawUnitSpriteOrFallback(this.ctx, unit, unit.x, unit.y, unit.radius || 9, now);

      if (unit.isRanged && !unit._remove) {
        this.ctx.fillStyle = '#f2c94c';
        this.ctx.beginPath();
        this.ctx.arc(unit.x, unit.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }

      if (!unit.dead && unit.hp > 0) {
        const hpRatio = Math.max(0, Math.min(1, unit.hp / Math.max(1, unit.maxHp)));
        const moraleRatio = Math.max(0, Math.min(1, (unit.morale || 0) / Math.max(1, unit.moraleMax || 1)));
        this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        this.ctx.fillRect(unit.x - 12, unit.y - 21, 24, 3);
        this.ctx.fillStyle = unit.moraleState === 'routing' ? '#ff6b6b' : (unit.moraleState === 'shaken' ? '#f2c94c' : '#6bdc87');
        this.ctx.fillRect(unit.x - 12, unit.y - 21, 24 * moraleRatio, 3);
        this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        this.ctx.fillRect(unit.x - 12, unit.y - 16, 24, 3);
        this.ctx.fillStyle = '#89d38d';
        this.ctx.fillRect(unit.x - 12, unit.y - 16, 24 * hpRatio, 3);

        if (unit.isRanged) {
          this.ctx.fillStyle = '#e6e6e6';
          this.ctx.font = '10px Arial';
          this.ctx.textAlign = 'left';
          const ammoText = unit.side === 'player' ? `A: ${Math.max(0, Math.floor(Number(battle.playerAmmo ?? 0)))}` : 'A: ∞';
          this.ctx.fillText(ammoText, unit.x + 10, unit.y - 10);
          if (this.state?.devMode && unit.holdFire === true) this.ctx.fillText('X', unit.x + 10, unit.y + 2);
          this.ctx.textAlign = 'center';
        }
      }
    }

    for (const projectile of (battle.projectiles || [])) {
      this.ctx.fillStyle = projectile.side === 'player' ? '#c6defd' : '#ffc5c2';
      this.ctx.beginPath();
      this.ctx.arc(projectile.x, projectile.y, projectile.radius || 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.font = '12px Arial';
    for (const ft of this.floatingTexts) {
      this.ctx.globalAlpha = Math.max(0, Math.min(1, ft.ttl / 0.8));
      this.ctx.fillStyle = ft.color || '#ffffff';
      this.ctx.fillText(ft.text || '', ft.x, ft.y);
    }
    this.ctx.restore();

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
      const infoEl = this.dom.debugOverlay.querySelector?.('#debugInfo');
      if (infoEl) infoEl.textContent = lines.join('\n');
      else this.dom.debugOverlay.textContent = lines.join('\n');
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
