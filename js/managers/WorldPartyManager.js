import * as CONST from '../constants.js';
import { validatedPartyQuestLinks, registeredTradeRoute, validBanditRoute } from '../systems/quest-world-party-links.js';
import {
  spawnQuestEscortCaravan, tickQuestEscortCaravan, isLiveEscortParty,
} from '../systems/quest-caravan-escort.js';
import {
  emptyQuestEventLedger, recordVerifiedCaravanArrivalEvent,
  recordVerifiedMissingCaravanReconEvent,
} from '../systems/quest-event-ledger.js';
import {
  isRuntimeRouteBandit, observeMissingCaravanBandits,
  witnessMissingCaravanEncounter,
} from '../systems/quest-route-recon.js';
import { creditQuestObjectivesForVerifiedEvent } from '../systems/quest-event-matcher.js';
import { streamWorldAiRegion } from '../systems/world-ai-regional-stream.js';
import { linkedEscortBattleThreat } from '../systems/quest-escort-threat-battle.js';
import {
  spawnEscortNpcGuards, runEscortNpcSkirmish,
  retireEscortNpcGuards,
} from '../systems/quest-escort-npc-guards.js';
import {
  reserveEscortCargo, deliverEscortCargo, disposeLiveBanditCargo,
  inspectCargoDispositions, auditLiveEscortCargoConservation,
  classifyRetiredEscortCargo,
} from '../systems/quest-escort-cargo.js';
import { mirrorCityStockChange } from '../systems/market-stock-bridge.js';
import { observeMarketMovement } from '../systems/market-cargo-report.js';
import {
  createInitialWorldAiState,
  spawnPartyBandit,
  ensureWorldParties as ensureBaseWorldParties,
  updateWorldParties as updateBaseWorldParties,
} from '../systems/world-ai.js';
import {
  ENCOUNTER_TYPE,
  canSurpriseEncounter,
  normalizeEncounterType,
} from '../data/encounter-defs.js';

const EXTRA_VISIBLE_PARTY_SPECS = Object.freeze([
  Object.freeze({ kind: 'refugee', type: ENCOUNTER_TYPE.REFUGEE, maxKey: 'MAX_REFUGEE_PARTIES', fallbackMax: 2, speed: 0.72, factionId: 'neutral' }),
  Object.freeze({ kind: 'merchant', type: ENCOUNTER_TYPE.TRAVELING_MERCHANT, maxKey: 'MAX_TRAVELING_MERCHANT_PARTIES', fallbackMax: 2, speed: 0.82, factionId: 'venice' }),
  Object.freeze({ kind: 'messenger', type: ENCOUNTER_TYPE.MESSENGER, maxKey: 'MAX_MESSENGER_PARTIES', fallbackMax: 2, speed: 1.28, factionId: 'neutral' }),
  Object.freeze({ kind: 'villagers', type: ENCOUNTER_TYPE.VILLAGERS, maxKey: 'MAX_VILLAGER_PARTIES', fallbackMax: 2, speed: 0.58, factionId: 'neutral' }),
  Object.freeze({ kind: 'noble', type: ENCOUNTER_TYPE.NOBLE, maxKey: 'MAX_NOBLE_PARTIES', fallbackMax: 1, speed: 0.92, factionId: 'player' }),
]);

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSettlements(worldState) {
  return Array.isArray(worldState?.settlements) ? worldState.settlements : [];
}

function getWorldBounds(worldState) {
  const tile = Number(worldState?.tileSize ?? worldState?.TILE_SIZE ?? CONST.WORLD?.TILE_SIZE ?? 32);
  const width = Number(worldState?.width ?? CONST.WORLD?.MAP_WIDTH ?? 100) * tile;
  const height = Number(worldState?.height ?? CONST.WORLD?.MAP_HEIGHT ?? 100) * tile;
  return { minX: 0, minY: 0, maxX: Math.max(tile, width), maxY: Math.max(tile, height), tileSize: tile };
}

function clampToBounds(x, y, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
  };
}

function pickSettlement(worldState, fallback = null, playerParty = null, despawnTiles = 40) {
  const settlements = getSettlements(worldState);
  if (!settlements.length) return fallback;
  const tile = getWorldBounds(worldState).tileSize;
  const range = (Number(despawnTiles) - 4) * tile;
  // Use only actual nearby settlement sources, within the existing AI's
  // 40-tile active range. Preserve the original all-world fallback when no
  // real city is local; never fabricate a city or relocate an existing party.
  const nearby = playerParty && Number.isFinite(playerParty.x) && Number.isFinite(playerParty.y)
    && Number.isFinite(range) && range > 0
    ? settlements.filter(s => Number.isFinite(s?.x) && Number.isFinite(s?.y)
      && Math.hypot(s.x - playerParty.x, s.y - playerParty.y) <= range)
    : [];
  const pool = nearby.length ? nearby : settlements;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickRoamTarget(worldState, x, y) {
  const bounds = getWorldBounds(worldState);
  const radius = Math.max(bounds.tileSize * 4, Math.min(bounds.maxX, bounds.maxY) * 0.10);
  return clampToBounds(x + randomInRange(-radius, radius), y + randomInRange(-radius, radius), bounds);
}

function createVisibleParty(spec, worldState, playerParty = null, despawnTiles = 40) {
  const bounds = getWorldBounds(worldState);
  const home = pickSettlement(worldState, null, playerParty, despawnTiles);
  const sx = Number(home?.x ?? randomInRange(bounds.minX, bounds.maxX));
  const sy = Number(home?.y ?? randomInRange(bounds.minY, bounds.maxY));
  const clamped = clampToBounds(sx + randomInRange(-bounds.tileSize, bounds.tileSize), sy + randomInRange(-bounds.tileSize, bounds.tileSize), bounds);
  const target = pickRoamTarget(worldState, clamped.x, clamped.y);
  return {
    id: makeId(spec.kind),
    factionId: spec.factionId,
    kind: spec.kind,
    encounterType: spec.type,
    x: clamped.x,
    y: clamped.y,
    targetX: target.x,
    targetY: target.y,
    speed: spec.speed,
    radius: 12,
    alive: true,
    homeCityId: home?.id,
    path: null,
    pathIndex: 0,
  };
}

export class WorldPartyManager {
  constructor() {
    this.world = null;
    this.game = null;
    this.surpriseCooldownMs = 9000;
    this._lastSurpriseAt = 0;
    this._guardBattleReceipts = new WeakMap();
  }

  init(world, game) {
    this.world = world;
    this.game = game;
  }

  getWorldAiCfg() {
    return {
      ...(CONST.WORLD_AI || {}),
      ...(this.game?.getWorldAiCfgWithRegionMods?.() || {}),
    };
  }

  ensureWorldParties() {
    if (!this.world?.state) return [];
    if (!this.world.worldAi || typeof this.world.worldAi !== 'object') this.world.worldAi = createInitialWorldAiState();
    if (!Array.isArray(this.world.worldAi.parties)) this.world.worldAi.parties = [];

    // A new GameState begins in the start menu with no actual settlement
    // layer. initPlayerParty() can call this manager during bootstrap; never
    // consume the first in-game spawn or its 3-day cooldown before the
    // player has chosen a faction and the genuine world has been generated.
    if (this.world.state.mode === 'start') return this.world.worldAi.parties;

    const worldState = this.world.state?.map || {};
    const tradeRoutes = this.game?.economyManager?.ensureTradeRoutes?.() || [];
    const cfg = this.getWorldAiCfg();
    // Only quest-linked, authentic route bandits stay on their mission road
    // when offscreen. Other real parties sleep with their original IDs.
    const protectedRouteIds = this.getProtectedRouteIds(worldState, tradeRoutes);
    const region = streamWorldAiRegion({
      aiState: this.world.worldAi, worldState,
      playerParty: this.game?.playerParty, cfg,
      currentDay: this.world.state?.day ?? 1,
      protectedRouteIds,
    });
    ensureBaseWorldParties({
      aiState: this.world.worldAi,
      worldState,
      factions: this.world.state?.factions || CONST.FACTIONS,
      cfg,
      currentDay: this.world.state?.day ?? 1,
      tradeRoutes,
      playerParty: this.game?.playerParty || null,
      forceRegionPopulation: region.forcePopulation,
      banditCapOverride: this.game?.getBanditCapWithEvents?.(this.game?.getCurrentEvents?.(this.world.state?.day ?? 1)),
    });

    this.ensureActiveQuestRouteThreats({ worldState, tradeRoutes, cfg });
    this.ensureActiveQuestCaravans({ worldState, tradeRoutes, cfg });

    // Extra visible parties (refugees, merchants, messengers, villagers,
    // nobles) obey the SAME in-game respawn interval as ordinary world AI.
    // In a full map, faraway parties may legitimately despawn on their first
    // update. Without a cooldown this immediately recreates all nine every
    // rendered frame. A separate persisted stamp preserves the first-ever
    // population and avoids restarting the timer on a save/load.
    const day = Math.max(1, Math.floor(Number(this.world.state?.day) || 1));
    const respawnDays = Math.max(0, Number(cfg?.RESPAWN_INTERVAL_DAYS ?? 3));
    const lastVisibleDay = Number.isFinite(this.world.worldAi.lastVisibleRespawnDay)
      ? this.world.worldAi.lastVisibleRespawnDay : null;
    if (lastVisibleDay === null || day - lastVisibleDay >= respawnDays
      || region.forcePopulation) {
      let added = 0;
      EXTRA_VISIBLE_PARTY_SPECS.forEach((spec) => {
        const max = Math.max(0, Math.floor(Number(cfg?.[spec.maxKey] ?? spec.fallbackMax)));
        while (this.world.worldAi.parties.filter((p) => p?.alive !== false && p?.kind === spec.kind).length < max) {
          this.world.worldAi.parties.push(createVisibleParty(
            spec, worldState, this.game?.playerParty, cfg?.DESPAWN_DISTANCE ?? 40,
          ));
          added++;
        }
      });
      if (added > 0 && (lastVisibleDay === null
        || day - lastVisibleDay >= respawnDays))
        this.world.worldAi.lastVisibleRespawnDay = day;
    }

    this.syncVisiblePartiesToWorld();
    return this.world.worldAi.parties;
  }

  /** Retain only CURRENT, actually registered mission routes as protected. */
  getProtectedRouteIds(worldState, tradeRoutes) {
    const quests=this.game?.questManager?.activeQuests;
    if(!Array.isArray(quests))return [];
    const verified=new Set();
    quests.forEach(q=>{
      if(q?.status!=='active'||!q.targetRouteId)return;
      const route=registeredTradeRoute(worldState,tradeRoutes,q.targetRouteId);
      if(route?.road)verified.add(String(route.routeId));
    });
    return [...verified];
  }

  /**
   * An accepted security quest should have a reachable threat on its actual
   * route. This creates at most three ordinary, procedural world bandit
   * patrols for otherwise empty target routes. No invented named characters,
   * official roles, quest completions, or reward receipts are produced.
   */
  ensureActiveQuestRouteThreats({ worldState, tradeRoutes, cfg }) {
    const state = this.world?.state;
    const parties = this.world?.worldAi?.parties;
    const tasks = this.game?.questManager?.activeQuests;
    if (!state || !Array.isArray(parties) || !Array.isArray(tasks)
      || !Array.isArray(tradeRoutes) || !Array.isArray(worldState?.settlements)
      || worldState.settlements.length < 2 || Number(cfg?.MAX_BANDIT_PARTIES ?? 1) <= 0) return 0;

    const day = Math.max(1, Math.floor(Number(state.day) || 1));
    const requestedRoutes = [];
    const investigativeRoutes = new Set();
    for (const quest of tasks) {
      if (quest?.status !== 'active'
        || !Number.isSafeInteger(quest.createdAt) || quest.createdAt > day
        || (Number.isSafeInteger(quest.timeLimitDays)
          && quest.createdAt + quest.timeLimitDays < day)) continue;
      const route = registeredTradeRoute(worldState, tradeRoutes, quest.targetRouteId);
      // Legacy synthetic test worlds have registered routes but no road
      // layer. Preserve prior security-quest behavior there; investigation
      // clues strictly require an actual generated-road source.
      if (!route || (quest.templateId === 'investigate_missing_caravan' && !route.road)) continue;
      if (quest.templateId === 'secure_trade_route') {
        const objective = quest.objectives?.find(o => o?.id === 'resolve_bandit_threat');
        const path = quest.completionPaths?.find(x => x?.id === 'defeat_bandits');
        if (objective?.outcome != null || objective?.type !== 'resolve_threat'
          || objective?.threatType !== 'bandit'
          || objective?.targetRouteId !== quest.targetRouteId
          || path?.requiredOutcome !== 'bandits_defeated'
          || (String(quest.targetCityId) !== String(route.from.id)
          && String(quest.targetCityId) !== String(route.to.id))) continue;
      } else if (quest.templateId === 'investigate_missing_caravan') {
        const objective = quest.objectives?.find(o => o?.id === 'find_caravan_fate');
        const path = quest.completionPaths?.find(x => x?.id === 'bandits_identified');
        if (objective?.type !== 'investigate'
          || objective?.outcome != null
          || objective?.targetRouteId !== quest.targetRouteId
          || path?.requiredOutcome !== 'bandits_located') continue;
        investigativeRoutes.add(route.routeId);
      } else continue;
      if (!requestedRoutes.includes(route.routeId)) requestedRoutes.push(route.routeId);
      if (requestedRoutes.length >= 3) break;
    }

    let added = 0;
    for (const routeId of requestedRoutes) {
      const existing = parties.some((party) => party?.alive !== false
        && party.routeId === routeId
        && (!investigativeRoutes.has(routeId) || isRuntimeRouteBandit(party))
        && validBanditRoute(party, worldState, tradeRoutes));
      if (existing) continue;
      const matched = tradeRoutes.find((row) => row?.id === routeId);
      const party = spawnPartyBandit(worldState, state.factions || {}, cfg, {
        tradeRoutes: matched ? [matched] : [],
      });
      if (party.routeId !== routeId) continue;
      parties.push(party);
      added += 1;
    }
    return added;
  }

  /**
   * The escort party is genuinely on the player's quest route, starts at
   * its source city and waits for the player. No ordinary/random caravan is
   * retroactively relabeled as a successful escorted convoy.
   */
  ensureActiveQuestCaravans({ worldState, tradeRoutes, cfg }) {
    const parties = this.world?.worldAi?.parties;
    const quests = this.game?.questManager?.activeQuests;
    if (!Array.isArray(parties) || !Array.isArray(quests)) return 0;
    const day = Math.max(1, Math.floor(Number(this.world?.state?.day) || 1));
    let spawned = 0;
    for (const quest of quests) {
      if (spawned >= 3) break;
      if (parties.some(p => p.escortQuestId === quest?.id)) continue;
      const party = spawnQuestEscortCaravan(quest, worldState, tradeRoutes,
        day, Number(cfg?.CARAVAN_SPEED ?? 0.8));
      if (!party) continue;
      // Reserve typed goods exclusively from the registered origin city's
      // canonical market stock. No stock/cargo is synthesized from a quest ID.
      const route = registeredTradeRoute(worldState, tradeRoutes, party.routeId);
      if (route?.road && this.game?.economyManager?.ensureSettlementMarketState) {
        this.game.economyManager.ensureSettlementMarketState(route.from);
        const reserved = reserveEscortCargo({
          caravan: party, quest, worldState, tradeRoutes, currentDay: day,
          catalog: this.game.economyManager.itemCatalog || CONST.TRADE_ITEMS,
        });
        const market = this.world?.state?.markets?.[String(route.from.id)];
        for (const row of reserved || []) {
          const stock = route.from.marketStock.find(item => item.id === row.id);
          if (stock) {
            mirrorCityStockChange(route.from, market, row.id,
              stock.qty + row.qty, stock.qty);
            observeMarketMovement({
              kind: 'escort_reserved', ledger: 'city', settlement: route.from,
              market, itemId: row.id, before: stock.qty + row.qty,
              after: stock.qty, day, questId: quest.id, routeId: party.routeId,
            });
          }
        }
      }
      parties.push(party);
      spawnEscortNpcGuards(party, parties);
      spawned += 1;
    }
    return spawned;
  }

  /**
   * Called once after actual BattleManager resolution but BEFORE world-party
   * cleanup. Only a live near-escort bandit battle can alter guard status.
   * Winning clears its real threat via the normal battle cleanup; losing
   * fails the escort and retains the world bandit for future encounters.
   */
  recordEscortGuardBattle({ battle, enemyId, linkedWorldPartyId } = {}) {
    const match = linkedEscortBattleThreat({
      battle, enemyId, linkedWorldPartyId,
      worldAi: this.world?.worldAi,
      questManager: this.game?.questManager,
      worldState: this.world?.state?.map || {},
      tradeRoutes: this.game?.economyManager?.ensureTradeRoutes?.() || [],
      currentDay: Math.max(1, Math.floor(Number(this.world?.state?.day) || 1)),
    });
    if (!match) return { relevant: false, retainBandit: false };
    let witnessed = this._guardBattleReceipts.get(match.caravan);
    if (!witnessed) {
      witnessed = new Set();
      this._guardBattleReceipts.set(match.caravan, witnessed);
    }
    if (witnessed.has(match.battleId)) {
      return { relevant: true, retainBandit: match.result === 'defeat',
        defended: false, repeated: true, routeId: match.routeId };
    }
    witnessed.add(match.battleId);
    if (match.result === 'defeat') {
      const failed = this.game?.questManager?.failQuest(
        match.quest.id, 'escort_guard_defeated',
      ) === true;
      if (failed) {
        match.caravan.alive = false;
        retireEscortNpcGuards(match.caravan, this.world?.worldAi?.parties || []);
      }
      this.game?.questEscortHud?.hide?.();
      return { relevant: true, retainBandit: true,
        failed, routeId: match.routeId };
    }
    // A guard victory is not a quest completion and earns no extra gold.
    // Real battle cleanup will remove this one genuine source bandit.
    match.caravan.escortDefended = (match.caravan.escortDefended || 0) + 1;
    return { relevant: true, retainBandit: false,
      defended: true, routeId: match.routeId };
  }

  /** A live route-bandit encounter is a first-hand investigation clue.
   * Only a process-spawned AI bandit on the actual target road can testify. */
  recordReconEncounter(party, enemyId) {
    const tasks = this.game?.questManager?.activeQuests || [];
    const map = this.world?.state?.map || {};
    const routes = this.game?.economyManager?.ensureTradeRoutes?.() || [];
    const day = Math.max(1, Math.floor(Number(this.world?.state?.day) || 1));
    const encounter = this.world?.state?.encounter;
    let credited = 0;
    for (const quest of tasks) {
      if (!witnessMissingCaravanEncounter({
        quest, party, worldState: map, tradeRoutes: routes,
        playerParty: this.game?.playerParty, enemyId, encounter,
        worldEncounterPartyByEnemyId: this.world?.worldEncounterPartyByEnemyId,
        currentDay: day,
      })) continue;
      if (this.recordReconEvidence(party, quest, map, routes, day)) credited++;
    }
    return credited;
  }

  recordReconEvidence(party, quest, worldState, tradeRoutes, day) {
    if (!this.world.state.questEventLedger) {
      this.world.state.questEventLedger = emptyQuestEventLedger();
    }
    const resolvedAt = Date.now();
    const ledger = this.world.state.questEventLedger;
    const recorded = recordVerifiedMissingCaravanReconEvent(ledger, {
      party, quest, worldState, tradeRoutes,
      worldParties: this.world.worldAi?.parties || [],
      playerParty: this.game?.playerParty,
      currentDay: day, resolvedAt,
    });
    if (!recorded) return false;
    return creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: this.game?.questManager,
      eventId: `recon:${party.id}:${resolvedAt}`,
    }).some(r => r.questId === quest.id);
  }

  processQuestRouteRecon(dtSec, { worldState, tradeRoutes }) {
    const quests = this.game?.questManager?.activeQuests;
    const parties = this.world?.worldAi?.parties;
    if (!Array.isArray(quests) || !Array.isArray(parties)) return 0;
    const day = Math.max(1, Math.floor(Number(this.world?.state?.day) || 1));
    let credited = 0;
    for (const quest of [...quests]) {
      if (quest?.templateId !== 'investigate_missing_caravan'
        || quest?.status !== 'active') continue;
      for (const party of parties) {
        if (!observeMissingCaravanBandits({
          quest, party, worldState, tradeRoutes,
          playerParty: this.game?.playerParty, currentDay: day, dtSec,
        })) continue;
        if (this.recordReconEvidence(party, quest, worldState, tradeRoutes, day)) {
          credited++; break;
        }
      }
    }
    return credited;
  }

  processQuestEscortCaravans(dtSec, { worldState, tradeRoutes }) {
    const parties = this.world?.worldAi?.parties;
    const quests = this.game?.questManager?.activeQuests;
    if (!Array.isArray(parties) || !Array.isArray(quests)) return [];
    const day = Math.max(1, Math.floor(Number(this.world?.state?.day) || 1));
    const outcomes = [];
    let display = null;
    for (const party of parties) {
      if (!party?.escortQuestId || party.alive === false) continue;
      // Source-verified individual guards are companion world parties,
      // not caravans and not independently claimable quest success.
      if (party.escortGuardOf) continue;
      if (!isLiveEscortParty(party)) {
        // JSON-restored and manually inserted parties are not an authority.
        party.alive = false;
        retireEscortNpcGuards(party, parties);
        continue;
      }
      const quest = quests.find(q => q.id === party.escortQuestId);
      if (!quest || quest.status !== 'active') {
        party.alive = false;
        classifyRetiredEscortCargo({ caravan: party, reason: 'quest_inactive' });
        retireEscortNpcGuards(party, parties);
        continue;
      }
      const threatCount = parties.filter(b => b?.alive !== false
        && b.kind === 'bandit' && b.routeId === party.routeId
        && validBanditRoute(b, worldState, tradeRoutes)
        && Math.hypot(b.x - party.x, b.y - party.y)
          <= Math.max(64, Number(worldState?.tileSize || 32) * 2.5)).length;
      const state = tickQuestEscortCaravan(party, {
        quest, worldState, tradeRoutes, playerParty: this.game?.playerParty,
        currentDay: day, dtSec, threat: threatCount > 0,
      });
      // No off-screen auto-raid before the player joins the convoy or
      // after a genuine destination. This also never simulates a battle result.
      const guards = runEscortNpcSkirmish({
        caravan: party, quest, parties, worldState, tradeRoutes,
        currentDay: day, dtSec,
      });
      const status = guards.status === 'raided' ? 'raided' : state.status;
      const remainingThreats = guards.status === 'defended'
        ? Math.max(0, threatCount - 1) : threatCount;
      if (status !== 'arrived' && status !== 'failed'
        && status !== 'invalid' && status !== 'raided' && !display) {
        display = { party, playerParty: this.game?.playerParty,
          status: guards.status === 'skirmishing' ? 'under_threat' : status,
          threatCount: remainingThreats, worldState };
      }
      if (status === 'failed' || status === 'raided') {
        party.alive = false;
        classifyRetiredEscortCargo({
          caravan: party, reason: status === 'raided'
            ? 'escort_raided' : 'escort_failed',
        });
        retireEscortNpcGuards(party, parties);
        this.game?.questManager?.failQuest(quest.id,
          status === 'raided' ? 'escort_cargo_raided' : 'escort_abandoned');
        outcomes.push({ questId: quest.id, status: 'failed',
          reason: status === 'raided' ? 'escort_cargo_raided' : 'escort_abandoned' });
      } else if (status === 'arrived') {
        if (!this.world.state.questEventLedger) {
          this.world.state.questEventLedger = emptyQuestEventLedger();
        }
        const ledger = this.world.state.questEventLedger;
        const resolvedAt = Date.now();
        const stamped = recordVerifiedCaravanArrivalEvent(ledger, {
          party, quest, worldState, tradeRoutes, currentDay: day, resolvedAt,
        });
        if (stamped) {
          // V1.27: only an authenticated arrival may deliver the remaining
          // reserved source goods. Never complete a mission from inventory.
          const route = registeredTradeRoute(worldState, tradeRoutes, party.routeId);
          if (route?.road && this.game?.economyManager?.ensureSettlementMarketState) {
            this.game.economyManager.ensureSettlementMarketState(route.to);
            const delivered = deliverEscortCargo({
              caravan: party, quest, worldState, tradeRoutes, currentDay: day,
            });
            const market = this.world?.state?.markets?.[String(route.to.id)];
            for (const row of delivered || []) {
              const stock = route.to.marketStock.find(item => item.id === row.id);
              if (stock) {
                mirrorCityStockChange(route.to, market, row.id,
                  stock.qty - row.qty, stock.qty);
                observeMarketMovement({
                  kind: 'escort_delivered', ledger: 'city', settlement: route.to,
                  market, itemId: row.id, before: stock.qty - row.qty,
                  after: stock.qty, day, questId: quest.id,
                  routeId: party.routeId,
                });
              }
            }
          }
          const receipt = creditQuestObjectivesForVerifiedEvent({
            ledger, questManager: this.game?.questManager,
            eventId: `caravan:${party.id}:${resolvedAt}`,
          });
          outcomes.push({ questId: quest.id, status: 'arrived',
            credited: receipt.some(r => r.questId === quest.id) });
        }
        party.alive = false;
        retireEscortNpcGuards(party, parties);
      }
    }
    this.world.worldAi.parties = parties.filter(p => p.alive !== false);
    if (display) this.game?.questEscortHud?.update?.(display);
    else this.game?.questEscortHud?.hide?.();
    return outcomes;
  }

  syncVisiblePartiesToWorld() {
    const parties = Array.isArray(this.world?.worldAi?.parties)
      ? this.world.worldAi.parties.filter((p) => p?.alive !== false)
      : [];
    const worldState = this.world.state?.map || {};
    const tradeRoutes = this.game?.economyManager?.ensureTradeRoutes?.() || [];
    const commanders = this.world.state?.commanders || [];
    this.world.enemyParties = parties
      .filter(p => p.kind !== 'escort_guard') // Already rendered via worldAI.
      .map((party) => ({
      ...party,
      // Strip save-supplied relationship IDs, rebuild them from current world.
      routeId: undefined,
      commanderId: undefined,
      ...validatedPartyQuestLinks(party, { worldState, tradeRoutes, commanders }),
      worldPartyKind: party.kind,
      encounterType: normalizeEncounterType(party.encounterType || party.kind),
      factionId: party?.factionId || CONST.FACTION?.ID?.BANDITS || 'bandits',
      radius: Number.isFinite(party?.radius) ? party.radius : 12,
    }));
    if (this.game) this.game.enemyParties = this.world.enemyParties;
    if (this.world.state) {
      this.world.state.aiParties = this.world.enemyParties;
      this.world.state.worldAi = this.world.worldAi;
    }
    return this.world.enemyParties;
  }

  updateWorldParties(dtSec) {
    this.ensureWorldParties();
    const encounters = updateBaseWorldParties({
      aiState: this.world.worldAi,
      worldState: this.world.state?.map || {},
      playerParty: this.game?.playerParty,
      factions: this.world.state?.factions || CONST.FACTIONS,
      cfg: this.getWorldAiCfg(),
      tradeRoutes: this.game?.economyManager?.ensureTradeRoutes?.() || [],
      protectedRouteIds: this.getProtectedRouteIds(this.world.state?.map || {},
        this.game?.economyManager?.ensureTradeRoutes?.() || []),
      dtSec,
      onBanditRemoved: (bandit, reason) =>
        disposeLiveBanditCargo({ bandit, reason }),
    });
    const worldState = this.world.state?.map || {};
    const tradeRoutes = this.game?.economyManager?.ensureTradeRoutes?.() || [];
    this.processQuestRouteRecon(dtSec, { worldState, tradeRoutes });
    this.processQuestEscortCaravans(dtSec, { worldState, tradeRoutes });
    this.syncVisiblePartiesToWorld();
    // NPC guards can eliminate a bandit AFTER the baseline AI has emitted
    // aggro for it. Never offer an encounter for that dead source party.
    return encounters.filter(e => this.world.worldAi.parties
      .some(p => p.id === e.partyId && p.alive !== false));
  }

  /** Per-convoy source-backed goods conservation, including unaccounted gaps. */
  auditEscortCargoConservation(caravan) {
    return auditLiveEscortCargoConservation({
      caravan, worldAi: this.world?.worldAi,
    });
  }

  /** Diagnostic report; cannot give gold, stock, or NPC loot. */
  inspectBanditCargoDispositions(limit = 20) {
    return inspectCargoDispositions(limit);
  }

  pickSurpriseType() {
    const risk = Number(this.world?.state?.encounterRisk?.mult ?? 1);
    const roll = Math.random();
    if (roll < 0.34 * risk) return ENCOUNTER_TYPE.BANDIT;
    if (roll < 0.50 * risk) return ENCOUNTER_TYPE.ENEMY_PATROL;
    if (roll < 0.64) return ENCOUNTER_TYPE.CARAVAN;
    if (roll < 0.76) return ENCOUNTER_TYPE.REFUGEE;
    if (roll < 0.90) return ENCOUNTER_TYPE.TRAVELING_MERCHANT;
    return ENCOUNTER_TYPE.MESSENGER;
  }

  createSurpriseParty(type) {
    const party = this.game?.playerParty || {};
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(32, Number(CONST.WORLD?.TILE_SIZE ?? 32) * 1.5);
    const pos = this.world?.clampToWorld?.(
      Number(party.x ?? 0) + Math.cos(angle) * dist,
      Number(party.y ?? 0) + Math.sin(angle) * dist,
    ) || { x: Number(party.x ?? 0), y: Number(party.y ?? 0) };
    const factionId = type === ENCOUNTER_TYPE.BANDIT
      ? 'bandits'
      : type === ENCOUNTER_TYPE.ENEMY_PATROL
        ? 'hre'
        : 'neutral';
    return {
      id: makeId(`surprise-${type}`),
      kind: type === ENCOUNTER_TYPE.ENEMY_PATROL ? 'patrol' : type,
      encounterType: type,
      x: pos.x,
      y: pos.y,
      radius: 12,
      speed: 0,
      vx: 0,
      vy: 0,
      temporary: true,
      surprise: true,
      factionId,
    };
  }

  spawnParty(partyTemplateId, location = {}) {
    if (!this.world?.state) return null;
    this.ensureWorldParties();
    const type = normalizeEncounterType(partyTemplateId || 'caravan');
    const pos = Number.isFinite(location?.x) && Number.isFinite(location?.y)
      ? this.world.clampToWorld?.(location.x, location.y) || { x: location.x, y: location.y }
      : this.world.clampToWorld?.(this.game?.playerParty?.x ?? 0, this.game?.playerParty?.y ?? 0) || { x: 0, y: 0 };
    const party = {
      id: makeId(`quest-${type}`),
      kind: type === ENCOUNTER_TYPE.ENEMY_PATROL ? 'patrol' : type,
      encounterType: type,
      factionId: location?.factionId || 'neutral',
      x: pos.x,
      y: pos.y,
      targetX: Number.isFinite(location?.targetX) ? location.targetX : pos.x,
      targetY: Number.isFinite(location?.targetY) ? location.targetY : pos.y,
      speed: 0.8,
      radius: 12,
      alive: true,
      questSpawned: true,
    };
    this.world.worldAi.parties.push(party);
    this.syncVisiblePartiesToWorld();
    return party;
  }

  checkSurpriseEncounters({ forceType = null } = {}) {
    if (!this.world?.state || this.world.state.mode !== 'map' || this.world.state.encounter || !this.game?.playerParty) return false;
    // Surprise events belong to real travel, not a stationary player's
    // city-market inspection, quest completion popup or save/load sequence.
    // Explicit forced/test/script encounters still bypass this movement gate.
    const player = this.game.playerParty;
    const activeTravel = Boolean(player.hasDestination || player.moveState === 'moving'
      || Math.hypot(Number(player.vx)||0,Number(player.vy)||0) > 0.01);
    if (!forceType && !activeTravel) return false;
    const now = Date.now();
    if (!forceType && now - this._lastSurpriseAt < this.surpriseCooldownMs) return false;

    const moveContext = this.world.getMovementContextAt?.(this.game.playerParty.x, this.game.playerParty.y) || { encounterMult: 1 };
    const risk = Number(this.world.state?.encounterRisk?.mult ?? 1);
    const rateMult = Number(CONST.GAME.ENCOUNTER_RATE_MULT ?? 1) || 1;
    const chance = Math.max(0, Math.min(0.08, 0.008 * Number(moveContext.encounterMult ?? 1) * risk * rateMult));
    if (!forceType && Math.random() > chance) return false;

    const type = normalizeEncounterType(forceType || this.pickSurpriseType());
    if (!canSurpriseEncounter(type)) return false;

    const party = this.createSurpriseParty(type);
    if (!Array.isArray(this.world.enemyParties)) this.world.enemyParties = [];
    this.world.enemyParties.push(party);
    this.world.state.aiParties = this.world.enemyParties;
    this._lastSurpriseAt = now;
    return this.world.simManager?.triggerEncounter?.(party, { surprise: true, encounterType: type }) || false;
  }
}

export default WorldPartyManager;
