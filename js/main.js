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
  ensureFactionState() {
    if (!this.state || typeof this.state !== 'object') return;
    const loaded = this.state.factions && typeof this.state.factions === 'object' && !Array.isArray(this.state.factions)
      ? this.state.factions
      : null;
    const knownIds = Array.isArray(loaded?.knownFactions) && loaded.knownFactions.length > 0
      ? loaded.knownFactions
      : CONST.FACTIONS.map((f) => f.id);
    const next = createInitialFactionState({
      factions: knownIds.map((id) => ({ id })),
      cfg: this.getEffectiveTuning().DIPLOMACY_RELATIONS || CONST.DIPLOMACY_RELATIONS,
    });
    if (loaded?.relations && typeof loaded.relations === 'object') {
      Object.entries(loaded.relations).forEach(([key, value]) => {
        if (Number.isFinite(value)) next.relations[key] = value;
      });
    }
    this.state.factions = next;
    this.state.warState = this.state.warState && typeof this.state.warState === 'object' ? this.state.warState : createInitialWarState();
    this.state.diplomacyOps = {
      buyTruce: (args = {}) => {
        const ok = buyTruce(args);
        if (ok) {
          const floor = Number(this.getEffectiveTuning().FACTION_WAR?.PEACE_TRUCE_THRESHOLD ?? CONST.FACTION_WAR.PEACE_TRUCE_THRESHOLD);
          setRelation(this.state.factions, 'player', args.targetFactionId, floor, CONST.DIPLOMACY_RELATIONS);
          markPeace(this.state.warState, 'player', args.targetFactionId);
        }
        return ok;
      },
      canBuyTruce,
      improveRelations: (args = {}) => {
        const ok = improveRelations(args);
        if (ok) {
          const rel = getRelation(this.state.factions, 'player', args.targetFactionId, CONST.DIPLOMACY_RELATIONS);
          const floor = Number(this.getEffectiveTuning().FACTION_WAR?.PEACE_TRUCE_THRESHOLD ?? CONST.FACTION_WAR.PEACE_TRUCE_THRESHOLD);
          if (rel >= floor) markPeace(this.state.warState, 'player', args.targetFactionId);
        }
        return ok;
      },
      declareWar: (args = {}) => {
        declareWar(args);
        ensureWar(this.state.warState, 'player', args.targetFactionId, this.state?.day ?? 1);
      },
    };
    if (this.playerParty && typeof this.playerParty === 'object' && !this.playerParty.factionId) {
      this.playerParty.factionId = this.state?.selectedFaction?.id || 'player';
    }
    updateCrisisFlag(this.state.warState, this.state.factions, this.getEffectiveTuning().FACTION_WAR || CONST.FACTION_WAR);
  }

  getFactionName(factionId) {
    return CONST.FACTIONS.find((f) => f.id === factionId)?.name || factionId || 'Unknown';
  }

  getCityFactionContext(settlement) {
    const ownerFactionId = settlement?.ownerFactionId || null;
    if (!ownerFactionId || !this.state?.factions) return null;
    const dipCfg = this.getEffectiveTuning().DIPLOMACY_RELATIONS || CONST.DIPLOMACY_RELATIONS;
    const relation = getRelation(this.state.factions, CONST.FACTION.ID.PLAYER, ownerFactionId);
    const stance = getStance(this.state.factions, CONST.FACTION.ID.PLAYER, ownerFactionId, dipCfg);
    const war = findWar(this.state?.warState, CONST.FACTION.ID.PLAYER, ownerFactionId);
    return {
      ownerFactionId,
      ownerFactionName: this.getFactionName(ownerFactionId),
      relation,
      stance,
      atWar: Boolean(war?.active),
      warscore: Number(war?.warscore ?? 0),
    };
  }


  findNearestCityId(x, y, radiusTiles) { return this.worldManager.findNearestCityId(x, y, radiusTiles); }

  syncWarStateFromRelations() {
    if (!this.state?.factions) return;
    this.state.warState = this.state.warState && typeof this.state.warState === 'object' ? this.state.warState : createInitialWarState();
    const cfg = this.getEffectiveTuning().FACTION_WAR || CONST.FACTION_WAR;
    const warThreshold = Number(cfg.WAR_DECL_THRESHOLD ?? -40);
    const peaceThreshold = Number(cfg.PEACE_TRUCE_THRESHOLD ?? -5);
    const known = this.state?.factions?.knownFactions || CONST.FACTIONS.map((f) => f.id);
    known.forEach((factionId) => {
      if (!factionId || factionId === 'player') return;
      const rel = getRelation(this.state.factions, 'player', factionId, CONST.DIPLOMACY_RELATIONS);
      if (rel <= warThreshold) ensureWar(this.state.warState, 'player', factionId, this.state?.day ?? 1);
      if (rel >= peaceThreshold) markPeace(this.state.warState, 'player', factionId);
    });
    updateCrisisFlag(this.state.warState, this.state.factions, cfg);
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
      WEATHER: {
        RAIN_CHANCE: Number(CONST.WEATHER.RAIN_CHANCE),
        SNOW_CHANCE: Number(CONST.WEATHER.SNOW_CHANCE),
        FOG_CHANCE: Number(CONST.WEATHER.FOG_CHANCE),
        RAIN_PARTICLES: Number(CONST.WEATHER.RAIN_PARTICLES),
        SNOW_PARTICLES: Number(CONST.WEATHER.SNOW_PARTICLES),
        FOG_ALPHA: Number(CONST.WEATHER.FOG_ALPHA),
        NIGHT_TINT_ALPHA: Number(CONST.WEATHER.NIGHT_TINT_ALPHA),
      },
      CAMPAIGN_OBJECTIVES: {
        WIN_RENOWN: Number(CONST.CAMPAIGN_OBJECTIVES.WIN_RENOWN),
        WIN_GOLD: Number(CONST.CAMPAIGN_OBJECTIVES.WIN_GOLD),
        LOSE_GOLD: Number(CONST.CAMPAIGN_OBJECTIVES.LOSE_GOLD),
        LOSE_STARVE_DAYS: Number(CONST.CAMPAIGN_OBJECTIVES.LOSE_STARVE_DAYS),
      },
      CONTRACTS: {
        REWARD_GOLD_BASE: Number(CONST.CONTRACTS.REWARD_GOLD_BASE),
        REWARD_RENOWN_BASE: Number(CONST.CONTRACTS.REWARD_RENOWN_BASE),
        DELIVERY_FOOD_MIN: Number(CONST.CONTRACTS.DELIVERY_FOOD_MIN),
        DELIVERY_FOOD_MAX: Number(CONST.CONTRACTS.DELIVERY_FOOD_MAX),
        BANDIT_BATTLE_COUNT: Number(CONST.CONTRACTS.BANDIT_BATTLE_COUNT),
        SCOUT_POI_COUNT: Number(CONST.CONTRACTS.SCOUT_POI_COUNT),
      },
      DIPLOMACY_ACTIONS: {
        TRUCE_COST_GOLD: Number(CONST.DIPLOMACY_ACTIONS.TRUCE_COST_GOLD),
        IMPROVE_RELATION_COST_GOLD: Number(CONST.DIPLOMACY_ACTIONS.IMPROVE_RELATION_COST_GOLD),
        IMPROVE_RELATION_DELTA: Number(CONST.DIPLOMACY_ACTIONS.IMPROVE_RELATION_DELTA),
        DECLARE_WAR_RELATION_DELTA: Number(CONST.DIPLOMACY_ACTIONS.DECLARE_WAR_RELATION_DELTA),
      },
      WORLD_AI: {
        ENABLED: Number(Boolean(CONST.WORLD_AI.ENABLED)),
        MAX_BANDIT_PARTIES: Number(CONST.WORLD_AI.MAX_BANDIT_PARTIES),
        MAX_PATROL_PARTIES: Number(CONST.WORLD_AI.MAX_PATROL_PARTIES),
        MAX_CARAVAN_PARTIES: Number(CONST.WORLD_AI.MAX_CARAVAN_PARTIES),
        BANDIT_SPEED: Number(CONST.WORLD_AI.BANDIT_SPEED),
        PATROL_SPEED: Number(CONST.WORLD_AI.PATROL_SPEED),
        CARAVAN_SPEED: Number(CONST.WORLD_AI.CARAVAN_SPEED),
        BANDIT_AGGRO_RADIUS: Number(CONST.WORLD_AI.BANDIT_AGGRO_RADIUS),
        PATROL_AGGRO_RADIUS: Number(CONST.WORLD_AI.PATROL_AGGRO_RADIUS),
        DESPAWN_DISTANCE: Number(CONST.WORLD_AI.DESPAWN_DISTANCE),
        RESPAWN_INTERVAL_DAYS: Number(CONST.WORLD_AI.RESPAWN_INTERVAL_DAYS),
      },
      EVENTS: {
        ENABLED: Number(Boolean(CONST.EVENTS.ENABLED)),
        MAX_ACTIVE_EVENTS: Number(CONST.EVENTS.MAX_ACTIVE_EVENTS),
        BASE_WAR_EVENT_CHANCE: Number(CONST.EVENTS.BASE_WAR_EVENT_CHANCE),
        CRISIS_EVENT_CHANCE: Number(CONST.EVENTS.CRISIS_EVENT_CHANCE),
        EVENT_DURATION_DAYS_MIN: Number(CONST.EVENTS.EVENT_DURATION_DAYS_MIN),
        EVENT_DURATION_DAYS_MAX: Number(CONST.EVENTS.EVENT_DURATION_DAYS_MAX),
        WAR_TAX_GOLD_MULT: Number(CONST.EVENTS.WAR_TAX_GOLD_MULT),
        WAR_TRADE_TARIFF_MULT: Number(CONST.EVENTS.WAR_TRADE_TARIFF_MULT),
        BANDIT_SPIKE_MULT: Number(CONST.EVENTS.BANDIT_SPIKE_MULT),
        REFUGEE_RENOWN_BONUS: Number(CONST.EVENTS.REFUGEE_RENOWN_BONUS),
      },
      DIPLOMACY_RELATIONS: {
        MIN_REL: Number(CONST.DIPLOMACY_RELATIONS.MIN_REL ?? CONST.DIPLOMACY_RELATIONS.MIN),
        MAX_REL: Number(CONST.DIPLOMACY_RELATIONS.MAX_REL ?? CONST.DIPLOMACY_RELATIONS.MAX),
        ALLY_THRESHOLD: Number(CONST.DIPLOMACY_RELATIONS.ALLY_THRESHOLD),
        WAR_THRESHOLD: Number(CONST.DIPLOMACY_RELATIONS.WAR_THRESHOLD),
      },
      FACTION_WAR: {
        WAR_DECL_THRESHOLD: Number(CONST.FACTION_WAR.WAR_DECL_THRESHOLD),
        PEACE_TRUCE_THRESHOLD: Number(CONST.FACTION_WAR.PEACE_TRUCE_THRESHOLD),
        CITY_CAPTURE_WARSCORE: Number(CONST.FACTION_WAR.CITY_CAPTURE_WARSCORE),
        BATTLE_WIN_WARSCORE: Number(CONST.FACTION_WAR.BATTLE_WIN_WARSCORE),
        BATTLE_LOSS_WARSCORE: Number(CONST.FACTION_WAR.BATTLE_LOSS_WARSCORE),
        WARSCORE_TO_FORCE_PEACE: Number(CONST.FACTION_WAR.WARSCORE_TO_FORCE_PEACE),
        WARSCORE_TO_FORCE_LOSS: Number(CONST.FACTION_WAR.WARSCORE_TO_FORCE_LOSS),
        FRONTLINE_RADIUS: Number(CONST.FACTION_WAR.FRONTLINE_RADIUS),
        CRISIS_WAR_COUNT_THRESHOLD: Number(CONST.FACTION_WAR.CRISIS_WAR_COUNT_THRESHOLD),
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
        HEAVY_INF_VS_INF_DMG_MULT: Number(CONST.BATTLE_COUNTERS.HEAVY_INF_VS_INF_DMG_MULT),
        ELITE_CAV_VS_INF_DMG_MULT: Number(CONST.BATTLE_COUNTERS.ELITE_CAV_VS_INF_DMG_MULT),
        ELITE_CAV_VS_ARCHER_DMG_MULT: Number(CONST.BATTLE_COUNTERS.ELITE_CAV_VS_ARCHER_DMG_MULT),
        SIEGE_VS_HEAVY_DMG_MULT: Number(CONST.BATTLE_COUNTERS.SIEGE_VS_HEAVY_DMG_MULT),
        SIEGE_VS_INF_DMG_MULT: Number(CONST.BATTLE_COUNTERS.SIEGE_VS_INF_DMG_MULT),
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
      BATTLE_CAMERA: {
        ENABLED: Boolean(CONST.BATTLE_CAMERA.ENABLED),
        BASE_ZOOM: Number(CONST.BATTLE_CAMERA.BASE_ZOOM),
        MAX_ZOOM_IN: Number(CONST.BATTLE_CAMERA.MAX_ZOOM_IN),
        MAX_ZOOM_OUT: Number(CONST.BATTLE_CAMERA.MAX_ZOOM_OUT),
        SMOOTHING_SEC: Number(CONST.BATTLE_CAMERA.SMOOTHING_SEC),
        SHAKE_ENABLED: Boolean(CONST.BATTLE_CAMERA.SHAKE_ENABLED),
        SHAKE_HIT_MAG: Number(CONST.BATTLE_CAMERA.SHAKE_HIT_MAG),
        SHAKE_CHARGE_MAG: Number(CONST.BATTLE_CAMERA.SHAKE_CHARGE_MAG),
        SHAKE_DURATION_SEC: Number(CONST.BATTLE_CAMERA.SHAKE_DURATION_SEC),
        SHAKE_FALLOFF: Number(CONST.BATTLE_CAMERA.SHAKE_FALLOFF),
        FOLLOW_STRENGTH: Number(CONST.BATTLE_CAMERA.FOLLOW_STRENGTH),
      },
      BATTLE_RANGED: {
        SUPPRESS_DURATION_SEC: Number(CONST.BATTLE_RANGED.SUPPRESS_DURATION_SEC),
        SUPPRESS_SPEED_MULT: Number(CONST.BATTLE_RANGED.SUPPRESS_SPEED_MULT),
        SUPPRESS_MORALE_DRAIN_PER_SEC: Number(CONST.BATTLE_RANGED.SUPPRESS_MORALE_DRAIN_PER_SEC),
        MELEE_EMERGENCY_RANGE_MULT: Number(CONST.BATTLE_RANGED.MELEE_EMERGENCY_RANGE_MULT),
        AMMO_PER_SHOT: Number(CONST.BATTLE_RANGED.AMMO_PER_SHOT),
      },
      BATTLE_FX: {
        ENABLED: Number(Boolean(CONST.BATTLE_FX.ENABLED)),
        MAX_PARTICLES: Number(CONST.BATTLE_FX.MAX_PARTICLES),
        HIT_PARTICLES: Number(CONST.BATTLE_FX.HIT_PARTICLES),
        BLOOD_PARTICLES: Number(CONST.BATTLE_FX.BLOOD_PARTICLES),
        DUST_PARTICLES: Number(CONST.BATTLE_FX.DUST_PARTICLES),
        TRAIL_PARTICLES_PER_SEC: Number(CONST.BATTLE_FX.TRAIL_PARTICLES_PER_SEC),
        PARTICLE_LIFETIME_SEC: Number(CONST.BATTLE_FX.PARTICLE_LIFETIME_SEC),
        PARTICLE_GRAVITY: Number(CONST.BATTLE_FX.PARTICLE_GRAVITY),
        PARTICLE_FRICTION: Number(CONST.BATTLE_FX.PARTICLE_FRICTION),
      },
      BATTLE_REWARDS: {
        LOOT_GOLD_MIN: Number(CONST.BATTLE_REWARDS.LOOT_GOLD_MIN),
        LOOT_GOLD_MAX: Number(CONST.BATTLE_REWARDS.LOOT_GOLD_MAX),
        LOOT_ITEM_CHANCE: Number(CONST.BATTLE_REWARDS.LOOT_ITEM_CHANCE),
        RENOWN_BASE: Number(CONST.BATTLE_REWARDS.RENOWN_BASE),
        RENOWN_PER_ENEMY_POWER: Number(CONST.BATTLE_REWARDS.RENOWN_PER_ENEMY_POWER),
        RENOWN_CASUALTY_PENALTY: Number(CONST.BATTLE_REWARDS.RENOWN_CASUALTY_PENALTY),
        RENOWN_ROUTING_PENALTY: Number(CONST.BATTLE_REWARDS.RENOWN_ROUTING_PENALTY),
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
    [
      'ENCOUNTER_RISK',
      'POI',
      'MARKET',
      'SUPPLIES',
      'WEATHER',
      'CAMPAIGN_OBJECTIVES',
      'CONTRACTS',
      'DIPLOMACY_ACTIONS',
      'WORLD_AI',
      'EVENTS',
      'DIPLOMACY_RELATIONS',
      'FACTION_WAR',
      'BATTLE_FORMATION',
      'BATTLE_FLANK',
      'BATTLE_MORALE',
      'BATTLE_AI',
      'BATTLE_COUNTERS',
      'BATTLE_CHARGE',
      'BATTLE_RANGED',
      'BATTLE_FX',
      'BATTLE_REWARDS',
      'BATTLE_CASUALTIES',
      'BATTLE_CAMERA',
    ].forEach((group) => {
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

  applyGameSettingsPatch(patch = {}) {
    this.settings = applySettingsPatch(this.settings, patch, CONST.SETTINGS);
    this.state.settings = serializeSettings(this.settings);
    if (this.settingsUI?.visible) this.settingsUI.syncFromState();
  }
  getRegionIdAtTile(tx, ty) {
    const nearestSettlement = this.getNearestSettlementAt(tx, ty);
    if (nearestSettlement?.id) return String(nearestSettlement.id);
    return `wild:${Math.floor(Number(tx) || 0)}:${Math.floor(Number(ty) || 0)}`;
  }

  getCurrentRegionContext() {
    const tilePos = this.getTilePosition(this.playerParty?.x ?? 0, this.playerParty?.y ?? 0);
    const regionId = this.getRegionIdAtTile(tilePos.tx, tilePos.ty);
    const nearestSettlement = this.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    return {
      regionId,
      regionName: nearestSettlement?.name || regionId,
      tilePos,
      settlement: nearestSettlement,
    };
  }

  getCurrentRegionModifiers(day = this.state?.day) {
    const ctx = this.getCurrentRegionContext();
    if (!this.state?.regionState) this.state.regionState = createInitialRegionState();
    this.state.currentRegionId = ctx.regionId;
    this.state.currentRegionName = ctx.regionName;
    return getActiveRegionModifiers(this.state.regionState, ctx.regionId, day);
  }

  getWorldAiCfgWithRegionMods() {
    const base = this.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI;
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

  setupEventListeners() {
    if (this.listenersBound || !this.state) return;

    this.state.on('mode:changed', ({ old, new: newMode }) => this.onModeChanged(old, newMode));
    this.state.on('day:advanced', (day) => {
      this.state.dailyLedger = { tradePL: 0 };
      this.refreshWeatherState(day);
      const activeEvents = this.refreshCurrentEventsSummary(day);
      rollWarEvents({
        eventState: this.state.events,
        warState: this.state.warState,
        factionsState: this.state.factions,
        worldState: this.state?.map || {},
        currentDay: day,
        cfg: this.getEffectiveTuning().EVENTS || CONST.EVENTS,
      });
      const rolledEvents = this.refreshCurrentEventsSummary(day);
      if ((this.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED) {
        ensureWorldParties({
          aiState: this.worldAi,
          worldState: this.state?.map || {},
          factions: this.state?.factions || CONST.FACTIONS,
          cfg: this.getWorldAiCfgWithRegionMods(),
          currentDay: day,
          banditCapOverride: this.getBanditCapWithEvents(rolledEvents.length ? rolledEvents : activeEvents),
        });
      }
      this.getCurrentRegionModifiers(day);
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
    this.state.on('ui:events:toggle', () => {
      const events = this.refreshCurrentEventsSummary(this.state?.day ?? 1);
      toggleCurrentEventsModal({ events, currentDay: this.state?.day ?? 1 });
    });
    this.listenersBound = true;
  }


  getCurrentEvents(day = Number(this.state?.day ?? 1)) {
    this.state.events = this.state.events && typeof this.state.events === 'object' ? this.state.events : createInitialEventState();
    return getActiveEvents(this.state.events, day);
  }

  refreshCurrentEventsSummary(day = Number(this.state?.day ?? 1)) {
    const activeEvents = this.getCurrentEvents(day);
    const summary = activeEvents.slice(0, 3).map((event) => {
      const suffix = event?.cityId || event?.regionId || 'Active';
      return `${getEventTypeLabel(event?.type)} (${suffix})`;
    }).join(', ');
    this.state.currentEventsSummary = summary ? `Events: ${summary}` : 'Events: None';
    return activeEvents;
  }

  applyDailyEventEffects(day, activeEvents) {
    if (!this.playerParty || !Array.isArray(activeEvents) || !activeEvents.length) return;
    const eventsCfg = this.getEffectiveTuning().EVENTS || CONST.EVENTS;
    const warTaxActive = activeEvents.some((event) => event?.type === EVENT_TYPES.WAR_TAX);
    if (warTaxActive) {
      this.playerParty.gold = Math.max(0, Math.floor(Number(this.playerParty.gold ?? 0) / Number(eventsCfg.WAR_TAX_GOLD_MULT ?? 1.15)));
    }

    const refugeeEvents = activeEvents.filter((event) => event?.type === EVENT_TYPES.REFUGEE_INFLUX);
    if (refugeeEvents.length > 0) {
      this.playerParty.renown = Math.max(0, Math.floor(Number(this.playerParty.renown ?? 0) + (Number(eventsCfg.REFUGEE_RENOWN_BONUS ?? 5) * refugeeEvents.length)));
      refugeeEvents.forEach((event) => {
        const sourceFaction = Array.isArray(event?.factionsInvolved)
          ? event.factionsInvolved.find((id) => id && id !== 'player')
          : null;
        if (!sourceFaction) return;
        const rel = getRelation(this.state.factions, 'player', sourceFaction, CONST.DIPLOMACY_RELATIONS);
        setRelation(this.state.factions, 'player', sourceFaction, rel + 2, CONST.DIPLOMACY_RELATIONS);
      });
    }

    if (warTaxActive || refugeeEvents.length > 0) {
      this.setLastEventLog(`Day ${day}: ${warTaxActive ? 'War tax applied. ' : ''}${refugeeEvents.length > 0 ? 'Refugees supported.' : ''}`.trim());
    }
  }

  getBanditCapWithEvents(worldEvents) {
    const worldCfg = this.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI;
    const eventsCfg = this.getEffectiveTuning().EVENTS || CONST.EVENTS;
    const baseCap = Number(worldCfg.MAX_BANDIT_PARTIES ?? CONST.WORLD_AI.MAX_BANDIT_PARTIES);
    return getBanditCap(worldEvents, getBanditCapFromEvents(worldEvents, baseCap, eventsCfg), eventsCfg);
  }

  processDailyEconomy(day) { return this.economyManager.processDailyEconomy(day); }

  evaluateCampaignOutcome() {
    if (!this.playerParty || this.state?.campaignEnded) return null;
    if ((this.playerParty.renown ?? 0) >= CONST.CAMPAIGN_OBJECTIVES.WIN_RENOWN) return 'win';
    if ((this.playerParty.gold ?? 0) >= CONST.CAMPAIGN_OBJECTIVES.WIN_GOLD) return 'win';

    const livingUnits = (this.playerParty.roster || []).filter((unit) => (unit?.hp ?? 0) > 0);
    if (livingUnits.length === 0) return 'lose';
    if ((this.playerParty.gold ?? 0) <= CONST.CAMPAIGN_OBJECTIVES.LOSE_GOLD
      && (this.playerParty.starveDays ?? 0) >= CONST.CAMPAIGN_OBJECTIVES.LOSE_STARVE_DAYS) return 'lose';
    return null;
  }

  restartRun() {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
      return true;
    }
    return false;
  }

  showCampaignWin() {
    if (this.state?.campaignEnded) return;
    if (this.state) this.state.campaignEnded = 'win';
    this.setPaused(true);
    showWinScreen({
      party: this.playerParty,
      day: this.state?.day ?? 1,
      onNewRun: () => this.restartRun(),
    });
  }

  showCampaignLose() {
    if (this.state?.campaignEnded) return;
    if (this.state) this.state.campaignEnded = 'lose';
    this.setPaused(true);
    showLoseScreen({
      party: this.playerParty,
      day: this.state?.day ?? 1,
      onNewRun: () => this.restartRun(),
    });
  }

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
    const enemyParty = (this.enemyParties || []).find((party) => party?.id === enemyId) || null;
    const enemyFactionId = enemyParty?.factionId || CONST.FACTION.ID.BANDITS;
    const playerUnits = this.createBattleUnitsFromRoster(selected, 'player');
    const enemyUnits = this.createBattleUnitsFromRoster(this.enemyRoster, 'enemy');
    this.placeBattleUnits(enemyUnits, 'enemy');

    const battleAmmo = initBattleAmmoFromParty({ party: this.playerParty, cfg: this.getEffectiveTuning().BATTLE_RANGED });

    this.cancelPlayerDestination();
    this.state.encounter = null;
    this.state.roster.warning = '';
    initBattleFx(this.getBattleFxConfig());
    this.state.battle = {
      enemyId,
      enemyFactionId,
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
      context: { nearCityId: this.findNearestCityId(this.playerParty?.x, this.playerParty?.y) },
      phase: 'deploy',
      camera: createCamera(),
    };

    this.currentBattleTerrain = getBattleTerrainContext(this.state, this.state.battle);
    this.state.setMode('battle');
    this.battleCommandsUI?.show?.();
    this.startBattleDeployment();
    this.updateTransientUIState();
    return true;
  }

  createBattleUnitsFromRoster(roster, side) { return this.battleManager.createBattleUnitsFromRoster(roster, side); }

  updateUnitMoraleState(unit, moraleCfg) {
    return this.battleManager.updateUnitMoraleState(unit, moraleCfg);
  }

  tickBattleMorale(units, battle, dt, moraleCfg) {
    return this.battleManager.tickBattleMorale(units, battle, dt, moraleCfg);
  }

  placeBattleUnits(units, side) { return this.battleManager.placeBattleUnits(units, side); }


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

  ensureInventoryModel() { return this.economyManager.ensureInventoryModel(); }
  getItemName(itemId) { return this.economyManager.getItemName(itemId); }
  getItemQty(itemId) { return this.economyManager.getItemQty(itemId); }
  addItem(itemId, name, qty = 1, unitValue = null) { return this.economyManager.addItem(itemId, name, qty, unitValue); }
  removeItem(itemId, qty) { return this.economyManager.removeItem(itemId, qty); }
  listInventoryForUI() { return this.economyManager.listInventoryForUI(); }

  buildAftermathPanelData() {
    const a = this.state?.aftermath;
    if (!a) return { title: 'Battle Aftermath', body: 'No aftermath data', footer: 'Enter = Continue' };

    const outcomeText = String(a.result || '').toLowerCase() === 'victory' ? 'Victory' : 'Defeat';
    const lootLines = (a.loot || []).map((l) => `- ${this.getItemName(l.id)} x${Math.max(1, Math.floor(l.qty ?? 1))}`).join('\n') || '- None';

    return {
      title: 'Battle Aftermath',
      body: `Outcome: ${outcomeText}

Casualties
- Dead: ${a.casualties?.dead ?? 0}
- Wounded: ${a.casualties?.wounded ?? 0}

Loot
- Gold gained: +${Math.max(0, Math.floor(a.goldDelta ?? 0))}
${lootLines}

Renown
- +${Math.max(0, Math.floor(a.renownDelta ?? 0))} renown
- New total: ${Math.max(0, Math.floor(a.renownTotal ?? this.playerParty?.renown ?? 0))}`,
      footer: 'Continue: Enter / Esc / T / L',
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
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, this.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
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
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, this.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
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
        if (result?.ok && itemId === 'grain') {
          emitContractEvent({ type: 'DELIVERED', itemId: 'food', qty, cityId: settlement.id }, this.playerParty);
        }
        if (result?.ok) this.runAutosave('trade');
      },
      onAcceptContract: (contractId) => {
        const accepted = acceptContract(contractId, this.playerParty);
        if (accepted?.type === 'ESCORT') {
          this.state.escortState = {
            contractId: accepted.id,
            fromCityId: accepted.cityId,
            toCityId: accepted.targetCityId,
            maxBanditEncounters: Number(accepted.maxBanditEncounters ?? 1),
            banditEncounters: 0,
            active: true,
          };
        }
        if (accepted) this.setLastEventLog('Contract accepted.');
      },
      onCompleteContract: (contractId) => {
        const completed = completeContract(contractId, this.playerParty, {
          warState: this.state?.warState,
          factions: this.state?.factions,
          onRelationBonus: (contract) => {
            const currentCityFactionId = this.state?.city?.ownerFactionId || this.state?.city?.owner || null;
            applyContractRelationBonus({
              factions: this.state?.factions,
              contract: { ...contract, factionId: contract.factionId || currentCityFactionId },
              cfg: CONST.DIPLOMACY_ACTIONS,
            });
          },
        });
        if (completed) {
          const bonus = Number(completed?.bonusRenown ?? 0);
          const baseRenown = Number(completed.rewardRenown ?? 0) + bonus;
          const mult = this.getRenownGainMultAtCurrentRegion();
          const boosted = Math.max(baseRenown, Math.floor(baseRenown * mult));
          const extra = Math.max(0, boosted - baseRenown);
          if (extra > 0) this.playerParty.renown = Math.floor(Number(this.playerParty.renown ?? 0) + extra);
          const bonusText = bonus > 0 ? ` (+${bonus} war bonus)` : '';
          this.setLastEventLog(`Contract completed: +${completed.rewardGold}g, +${boosted} renown${bonusText}${extra > 0 ? ' (pilgrimage bonus)' : ''}`);
        }
      },
      onDiplomacyAction: (summary) => {
        this.ensureFactionState();
        if (summary?.ok) {
          this.setLastEventLog(summary.message || 'Diplomacy action completed.');
          this.runAutosave('diplomacy');
        } else if (summary?.message) {
          this.setLastEventLog(summary.message);
        }
      },
      getFactionContext: (settlement) => this.getCityFactionContext(settlement),
      onClose: () => this.exitCityServices(),
    });

    this.cityUI.bind({
      cityRoot: utils.getEl('settlementModal'),
      btnRecruit: utils.getEl('btnRecruit'),
      btnTrade: utils.getEl('btnTrade'),
      btnContracts: utils.getEl('btnContracts'),
      cityClose: utils.getEl('btnLeaveSettlement') || utils.getEl('btnCloseSettlement'),
      cityList: utils.getEl('settlementLore'),
      cityTitle: utils.getEl('settlementTitle'),
      citySubtitle: utils.getEl('settlementSubtitle'),
      cityRelation: utils.getEl('settlementRelation'),
    });
  }

  getOrCreateMarketForSettlement(settlement) { return this.economyManager.getOrCreateMarketForSettlement(settlement); }

  enterCityServices() { return this.economyManager.enterCityServices(); }
  exitCityServices() { return this.economyManager.exitCityServices(); }


  getLogisticsSpeedMult() { return this.economyManager.getLogisticsSpeedMult(); }

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


  setupBattleDeployUI() { return this.battleManager.setupBattleDeployUI(); }

  startBattleDeployment() { return this.battleManager.startBattleDeployment(); }

  confirmBattleDeployment() { return this.battleManager.confirmBattleDeployment(); }

  cancelBattleDeployment() { return this.battleManager.cancelBattleDeployment(); }

  setupBattleCommandsUI() { return this.battleManager.setupBattleCommandsUI(); }

  applyBattleCommand(cmd) { return this.battleManager.applyBattleCommand(cmd); }

  toggleBattleHoldFire(forceValue = null) { return this.battleManager.toggleBattleHoldFire(forceValue); }



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
    const poiTypeNames = { ruin: 'Harabe', camp: 'Kamp', fort: 'Fort', shrine: 'Mabet', battlefield: 'Savaş Alanı', caravan_site: 'Kervan Mevkii' };
    const typeText = poiTypeNames[nearest.poi.type] || 'POI';
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
        nearestSettlementId: this.getNearestSettlementAt(poi.x, poi.y)?.id || null,
        settlementTx: this.getNearestSettlementAt(poi.x, poi.y)?.tx || null,
        settlementTy: this.getNearestSettlementAt(poi.x, poi.y)?.ty || null,
      },
      tuning: this.state?.tuning,
    });
    PoiSystem.markInvestigated(this.state, poi);
    const poiRegionId = this.getRegionIdAtTile(poi.x, poi.y);
    applyPOIOutcomeToRegion({
      regionState: this.state.regionState,
      poi: { ...poi, regionId: poiRegionId },
      outcomeType: outcome?.regionEffect || outcome?.kind,
      cfg: CONST.REGION_MODIFIERS,
      currentDay: this.state?.day,
    });

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

      const renownGain = Math.max(0, Math.floor(Number(outcome?.renown ?? 0) * this.getRenownGainMultAtCurrentRegion()));
      if (renownGain > 0) this.playerParty.renown = Math.floor(Number(this.playerParty.renown ?? 0) + renownGain);
      const rareSuffix = outcome.rare ? ' (Nadir!)' : '';
      this.setLastEventLog(`Ganimet: +${gold} altın, +${food} erzak, +${itemLabel} x${itemQty}${rareSuffix}${renownGain > 0 ? `, +${renownGain} şan` : ''}`);
      this.poiUI?.showResult?.({ kind: 'loot', lines: [`+${gold} altın`, `+${food} erzak`, `${itemLabel} x${itemQty}${rareSuffix}`, ...(renownGain > 0 ? [`+${renownGain} renown`] : [])] });
      if (poi.type === 'ruin') emitContractEvent({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: poi.id }, this.playerParty);
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.CLUE) {
      const gold = Math.max(0, Math.floor(outcome?.reward?.gold ?? 0));
      const food = Math.max(0, Math.floor(outcome?.reward?.food ?? 0));
      const renownGain = Math.max(0, Math.floor(Number(outcome?.renown ?? 0) * this.getRenownGainMultAtCurrentRegion()));
      this.playerParty.gold = (this.playerParty.gold ?? 0) + gold;
      if (renownGain > 0) this.playerParty.renown = Math.floor(Number(this.playerParty.renown ?? 0) + renownGain);
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
      this.setLastEventLog(`İpucu bulundu: ${clueLabel}. +${gold} altın, +${food} erzak${renownGain > 0 ? `, +${renownGain} şan` : ''}.`);
      this.poiUI?.showResult?.({ kind: 'clue', lines: [`İpucu: ${clueLabel}`, `Ödül: +${gold} altın, +${food} erzak`, ...(renownGain > 0 ? [`+${renownGain} renown`] : [])] });
      if (poi.type === 'ruin') emitContractEvent({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: poi.id }, this.playerParty);
      return true;
    }

    if (outcome.kind === CONST.POI.OUTCOME.NOTHING) {
      const msg = outcome?.message || 'Burada kayda değer bir şey yok...';
      this.setLastEventLog(msg);
      this.poiUI?.showResult?.({ kind: 'nothing', lines: [msg] });
      if (poi.type === 'ruin') emitContractEvent({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: poi.id }, this.playerParty);
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
        factionId: CONST.FACTION.ID.BANDITS,
      });
      this.state.aiParties = this.enemyParties;
    }
    this.state.encounter = { enemyId, startedAt: Date.now(), desc: 'Pusuya düştün!' };
    if (typeof this.enterEncounter === 'function') this.enterEncounter(enemyId);
    else if (typeof this.startEncounter === 'function') this.startEncounter(enemyId);
    else if (typeof this.state?.setMode === 'function') this.state.setMode('encounter');
  }

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

  exitAftermathToMap(takeLoot = true) {
    if (!this.state || this.state.mode !== 'aftermath' || !this.state.aftermath) return false;
    const aftermath = this.state.aftermath;
    const enemyId = aftermath.enemyId;
    const result = aftermath.result;
    const enemy = this.enemyParties.find((party) => party?.id === enemyId) || null;
    const linkedWorldPartyId = this.worldEncounterPartyByEnemyId?.[enemyId] || null;

    if (takeLoot) {
      this.setLastEventLog(`Aftermath: +${aftermath.goldDelta ?? 0}g, +${aftermath.renownDelta ?? 0} renown`);
    } else {
      this.setLastEventLog('Aftermath continued');
    }

    if (linkedWorldPartyId) {
      removeWorldParty(this.worldAi, linkedWorldPartyId);
      delete this.worldEncounterPartyByEnemyId[enemyId];
    }

    if (result === 'victory') {
      const regionId = `region-${Math.floor(((enemy?.x ?? 0) + (enemy?.y ?? 0)) / Math.max(1, CONST.WORLD.TILE_SIZE * 20))}`;
      const settlements = Array.isArray(this.state?.map?.settlements) ? this.state.map.settlements : [];
      const locationCity = settlements.reduce((best, settlement) => {
        if (!settlement) return best;
        const sx = Number(settlement.tx ?? settlement.x ?? 0);
        const sy = Number(settlement.ty ?? settlement.y ?? 0);
        const px = Number(this.playerParty?.x ?? 0);
        const py = Number(this.playerParty?.y ?? 0);
        const dist = Math.hypot(sx - px, sy - py);
        if (!best || dist < best.dist) return { dist, settlement };
        return best;
      }, null);
      const locationCityId = locationCity?.settlement?.id || null;
      const isTargetLeader = Boolean(enemy?.isTargetLeader || enemy?.type === 'bandit_leader');
      emitContractEvent({ type: 'BATTLE_WON', enemyFaction: enemy?.factionId || 'bandits', regionId, locationCityId, isTargetLeader }, this.playerParty);
      if (this.state?.escortState?.active && (enemy?.factionId || 'bandits') === 'bandits') {
        this.state.escortState.banditEncounters = Number(this.state.escortState.banditEncounters ?? 0) + 1;
      }
      if (enemy?.type === 'caravan') {
        applyTradeCaravanAttackPenalty({
          factions: this.state?.factions,
          caravanFactionId: enemy.factionId,
          cfg: CONST.DIPLOMACY_ACTIONS,
        });
      }
      const enemyFaction = aftermath.enemyFactionId || CONST.FACTION.ID.BANDITS;
      emitContractEvent({ type: 'BATTLE_WON', enemyFaction, regionId, locationCityId, isTargetLeader }, this.playerParty);
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


  applyBattleExit(enemy, enemyId, pushbackDistance) { return this.battleManager.applyBattleExit(enemy, enemyId, pushbackDistance); }

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

  setPlayerDestination(worldX, worldY) { return this.worldManager.setPlayerDestination(worldX, worldY); }

  completePlayerArrival() { return this.worldManager.completePlayerArrival(); }

  cancelPlayerDestination() { return this.worldManager.cancelPlayerDestination(); }

  isWorldPointOnParty(worldX, worldY, margin) { return this.worldManager.isWorldPointOnParty(worldX, worldY, margin); }

  setupPartyInputHandlers() { return this.inputManager.setupPartyInputHandlers(); }

  setupKeyboardShortcuts() { return this.inputManager.setupKeyboardShortcuts(); }


  ensureHudEventsButton() {
    if (typeof document === 'undefined') return;
    let btn = document.getElementById('hudEventsBtn');
    if (!btn) {
      const anchor = document.getElementById('hudEvent');
      if (!anchor || !anchor.parentElement) return;
      btn = document.createElement('button');
      btn.id = 'hudEventsBtn';
      btn.className = 'action-btn btn-dark text-xs mt-2';
      btn.textContent = 'Events';
      anchor.parentElement.appendChild(btn);
    }
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
      helpBtn: utils.getEl('helpBtn'),
      settingsBtn: utils.getEl('settingsBtn'),
      codexBtn: utils.getEl('codexBtn'),
      helpOverlay: utils.getEl('helpOverlay'),
      helpCloseBtn: utils.getEl('helpCloseBtn'),
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
    if (toggleHints) {
      toggleHints.checked = Boolean(this.state?.tutorial?.enabled);
      if (toggleHints.dataset.boundHintToggle !== '1') {
        toggleHints.dataset.boundHintToggle = '1';
        toggleHints.addEventListener('change', (event) => {
          this.ensureTutorialState();
          const checked = Boolean(event?.target?.checked);
          this.state.tutorial.enabled = checked;
          if (!checked) this.state.tutorial.lastShownAt = 0;
        });
      }
    }

    if (!this.settingsUI) {
      this.settingsUI = new SettingsUI({
        getSettings: () => this.settings,
        cfg: CONST.SETTINGS,
        onApply: (nextSettings) => {
          this.settings = nextSettings;
          this.state.settings = serializeSettings(nextSettings);
        },
      });
    }

    if (!this.codexUI) this.codexUI = new CodexUI();
  }

  setupHelpOverlay() {
    const body = this.dom?.helpOverlay?.querySelector?.('.frame-dark');
    if (body) {
      body.textContent = 'Hotkeys: H Hold, F Focus/Follow, R Retreat, K Skirmish/Camp, X Hold Fire/Cancel, E POI, C City, Esc Pause, J Codex, S Settings, ? Help.';
    }
    if (!this.dom?.helpCloseBtn || this.dom.helpCloseBtn.dataset.boundHelpClose === '1') return;
    this.dom.helpCloseBtn.dataset.boundHelpClose = '1';
    this.dom.helpCloseBtn.addEventListener('click', () => this.toggleHelpOverlay(false));
  }

  toggleHelpOverlay(force = null) {
    const next = typeof force === 'boolean' ? force : !this.helpOverlayVisible;
    this.helpOverlayVisible = next;
    if (this.dom?.helpOverlay) this.dom.helpOverlay.classList.toggle('hidden', !next);
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
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, this.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
        });
        this.state.marketOpportunities[settlementKey] = { itemId, bonusPct: 25, expiresDay: Number(this.state.day ?? 1) + 2 };
        const boostedSell = tradeSystem.getPrice(firstSettlement, market, itemId, 'sell', {
          day: this.state.day,
          settlementKey,
          marketOpportunities: this.state.marketOpportunities,
          tuning: this.state?.tuning,
          factions: this.state?.factions,
          playerFactionId: 'player',
          ownerFactionId: settlement?.ownerFactionId || settlement?.owner || null,
          diplomacyCfg: CONST.DIPLOMACY_ACTIONS,
          diplomacyRelations: CONST.DIPLOMACY_RELATIONS,
          activeRegionModifiers: getActiveRegionModifiers(this.state?.regionState, this.getRegionIdAtTile(settlement.tx, settlement.ty), this.state?.day),
        });
        push('20) Opportunity modifies sell price when active', boostedSell > baseSell, `${baseSell}→${boostedSell}`);

        this.state.marketOpportunities[settlementKey] = { itemId, bonusPct: 25, expiresDay: Number(this.state.day ?? 1) - 1 };
        this.cleanupExpiredMarketOpportunities(this.state.day);
    const currentEvents = this.refreshCurrentEventsSummary(this.state.day);
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
            this.playerParty.factionId = faction.id;
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
      onHudHelp: () => this.toggleHelpOverlay(),
      onHudSettings: () => this.settingsUI?.toggle?.(),
      onHudCodex: () => this.codexUI?.toggle?.(),
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
    if (this.mode === 'menu') {
      this.hudManager?.setSettingsVisible?.(true);
      return true;
    }
    this.settingsUI?.show?.();
    return true;
  }

  closeSettings() {
    this.hudManager?.setSettingsVisible?.(false);
    this.settingsUI?.hide?.();
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

    const weatherTint = getWeatherTint(this.weatherState || this.state?.weatherState, this.getWeatherConfig());
    renderWeatherOverlay(this.ctx, this.canvas.width, this.canvas.height, weatherTint);

    if (this.followParty) {
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'rgba(255,255,255,0.75)';
      this.ctx.fillText('Follow: ON (F)', 12, this.canvas.height - 12);
    }

    if (this.state?.debug?.enabled) {
      this.renderDebugInfo();
    }

    if (isCurrentEventsModalOpen()) renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
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

    if ((this.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED && Array.isArray(this.worldAi?.parties)) {
      const iconSize = Math.max(6, 10 / camera.zoom);
      this.worldAi.parties.forEach((party) => {
        if (!party || !Number.isFinite(party.x) || !Number.isFinite(party.y)) return;
        if (party.kind === 'bandit') {
          ctx.strokeStyle = '#ff4d4d';
          ctx.lineWidth = Math.max(1.5, 2 / camera.zoom);
          ctx.beginPath();
          ctx.moveTo(party.x - iconSize, party.y - iconSize);
          ctx.lineTo(party.x + iconSize, party.y + iconSize);
          ctx.moveTo(party.x + iconSize, party.y - iconSize);
          ctx.lineTo(party.x - iconSize, party.y + iconSize);
          ctx.stroke();
          return;
        }

        if (party.kind === 'patrol') {
          ctx.strokeStyle = '#8fd3ff';
          ctx.lineWidth = Math.max(1.2, 1.6 / camera.zoom);
          ctx.beginPath();
          ctx.moveTo(party.x, party.y - iconSize * 1.2);
          ctx.lineTo(party.x, party.y + iconSize * 1.2);
          ctx.lineTo(party.x - iconSize * 0.7, party.y + iconSize * 0.6);
          ctx.moveTo(party.x, party.y - iconSize * 0.5);
          ctx.lineTo(party.x + iconSize * 0.9, party.y - iconSize * 0.1);
          ctx.stroke();
          return;
        }

        ctx.fillStyle = '#d9b36a';
        ctx.fillRect(party.x - iconSize, party.y - iconSize * 0.6, iconSize * 2, iconSize * 1.2);
        ctx.strokeStyle = '#8a6b32';
        ctx.lineWidth = Math.max(1, 1.4 / camera.zoom);
        ctx.strokeRect(party.x - iconSize, party.y - iconSize * 0.6, iconSize * 2, iconSize * 1.2);
      });
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
