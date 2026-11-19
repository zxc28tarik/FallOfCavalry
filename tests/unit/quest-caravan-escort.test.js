import { describe, expect, it, vi } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import WorldPartyManager from '../../js/managers/WorldPartyManager.js';
import { createInitialWorldAiState, spawnPartyBandit } from '../../js/systems/world-ai.js';
import {
  spawnQuestEscortCaravan, tickQuestEscortCaravan,
  validEscortQuest, isLiveEscortParty,
} from '../../js/systems/quest-caravan-escort.js';
import {
  emptyQuestEventLedger, recordVerifiedCaravanArrivalEvent,
  restoreQuestEventLedger,
} from '../../js/systems/quest-event-ledger.js';
import { creditQuestObjectivesForVerifiedEvent } from '../../js/systems/quest-event-matcher.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';
import {
  spawnEscortNpcGuards, isRuntimeEscortGuard,
  activeEscortGuards, runEscortNpcSkirmish,
} from '../../js/systems/quest-escort-npc-guards.js';
import {
  inspectLiveEscortCargo, outstandingEscortCargoForSave,
} from '../../js/systems/quest-escort-cargo.js';

const worldMap = {
  width: 30, height: 20, tileSize: 32,
  settlements: [
    { id: 0, type: 'city', tx: 4, ty: 6, x: 144, y: 208 },
    { id: 1, type: 'city', tx: 10, ty: 6, x: 336, y: 208 },
  ],
  roads: [
    { from: 0, to: 1, path: [
      { x: 4, y: 6 }, { x: 7, y: 7 }, { x: 10, y: 6 },
    ] },
  ],
};
const routes = [{
  id: 'route:0:1', fromCityId: 0, toCityId: 1, roadBacked: true,
}];
const quest = (id = 'quest_escort_active') => {
  const def = QUEST_DEFS.find(d => d.id === 'escort_first_caravan');
  const ready = JSON.parse(JSON.stringify(def)
    .replaceAll('{{targetRouteId}}', routes[0].id)
    .replaceAll('{{issuerFactionId}}', 'ottoman'));
  return { ...ready, id, templateId: def.id, status: 'active',
    createdAt: 3, targetRouteId: routes[0].id, issuerFactionId: 'ottoman' };
};
const make = () => {
  const applied = [], shown = [];
  const qm = new QuestManager({ pushOverlay: (...a) => shown.push(a) },
    { applyEffect: e => applied.push(e) }, null);
  qm.addQuest(quest());
  const state = { map: worldMap, day: 4, mode: 'map',
    questEventLedger: emptyQuestEventLedger() };
  const world = { state, worldAi: createInitialWorldAiState(), enemyParties: [] };
  const playerParty = { x: 144, y: 208, gold: 100, factionId: 'player', roster: [] };
  const game = {
    playerParty, questManager: qm, worldManager: world,
    economyManager: { ensureTradeRoutes: () => routes },
    getWorldAiCfgWithRegionMods: () => ({
      MAX_BANDIT_PARTIES: 0, MAX_PATROL_PARTIES: 0, MAX_CARAVAN_PARTIES: 0,
      MAX_REFUGEE_PARTIES: 0, MAX_TRAVELING_MERCHANT_PARTIES: 0,
      MAX_MESSENGER_PARTIES: 0, MAX_VILLAGER_PARTIES: 0, MAX_NOBLE_PARTIES: 0,
      CARAVAN_SPEED: 2.5,
    }),
    getBanditCapWithEvents: () => 0,
    settings: {}, itemCatalog: [],
    ensureRosterState: () => {}, ensureInventoryModel: () => {},
  };
  const manager = new WorldPartyManager();
  manager.init(world, game);
  return { qm, applied, shown, world, game, manager, state, playerParty };
};

describe('WEB V1.22 — authentic caravan escort and verified arrival', () => {
  it('uses the existing real road and waits at origin until player is near', () => {
    const q = quest();
    const p = spawnQuestEscortCaravan(q, worldMap, routes, 4, 1);
    expect(isLiveEscortParty(p)).toBe(true);
    expect(p).toMatchObject({
      kind: 'caravan', routeId: 'route:0:1',
      homeCityId: 0, escortDestinationCityId: 1,
      escortQuestId: q.id, x: 144, y: 208, targetX: 336, targetY: 208,
    });
    const waiting = tickQuestEscortCaravan(p, {
      quest: q, worldState: worldMap, tradeRoutes: routes,
      playerParty: { x: 900, y: 500 }, currentDay: 4, dtSec: 0.1,
    });
    expect(waiting.status).toBe('awaiting_player');
    expect(p.x).toBe(144);
    expect(p.escortStarted).toBe(false);
  });

  it('does not spawn from an obsolete route, unsupported quest, expired or completed outcome', () => {
    for (const invalid of [
      { templateId: 'secure_trade_route' },
      { status: 'available' },
      { createdAt: 30 },
      { targetRouteId: 'route:1:0' },
      { objectives: [{ id: 'deliver_caravan_safely', type: 'escort_party',
        targetRouteId: routes[0].id, outcome: 'caravan_arrived' }] },
    ]) {
      const q = { ...quest(), ...invalid };
      expect(validEscortQuest(q, worldMap, routes, 4)).toBeNull();
      expect(spawnQuestEscortCaravan(q, worldMap, routes, 4)).toBeNull();
    }
    expect(spawnQuestEscortCaravan(quest(), worldMap, [
      { ...routes[0], roadBacked: false },
    ], 4)).not.toBeNull(); // Road exists: prefer graph, not a user-defined flag.
    expect(spawnQuestEscortCaravan(quest(),
      { ...worldMap, roads: [] }, routes, 4)).toBeNull();
  });

  it('rejects JSON-cloned / invented arrival parties and saved ledger rows', () => {
    const q = quest();
    const live = spawnQuestEscortCaravan(q, worldMap, routes, 4, 100);
    expect(live).toBeTruthy();
    const forged = { ...live, escortArrived: true,
      escortStarted: true, escortElapsedSeconds: 10, escortVisitedPoints: 3,
      x: 336, y: 208 };
    const ledger = emptyQuestEventLedger();
    expect(recordVerifiedCaravanArrivalEvent(ledger, {
      party: forged, quest: q, worldState: worldMap, tradeRoutes: routes,
      currentDay: 4, resolvedAt: 1795092500000,
    })).toBe(false);
    expect(ledger.observed).toEqual([]);
    const pending = restoreQuestEventLedger({ version: 1, observed: [{
      source: 'caravan_arrival', result: 'caravan_arrived',
      eventId: 'caravan:fake-party:1795092500000',
      enemyId: 'fake-party', enemyFactionId: 'neutral',
      partyType: 'caravan', questId: q.id,
      routeId: routes[0].id, fromCityId: '0', toCityId: '1', day: 4,
    }], pending: [] });
    expect(pending.observed).toEqual([]);
    expect(pending.pending).toHaveLength(1);
    const { qm } = make();
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger: pending, questManager: qm,
      eventId: pending.pending[0].eventId,
    })).toEqual([]);
  });

  it('moves along physical road, and unlocks exact quest only at real witnessed arrival', () => {
    const { qm, shown, applied, manager, world, playerParty } = make();
    manager.ensureWorldParties();
    const original = world.worldAi.parties.find(p => p.escortQuestId);
    expect(original).toBeTruthy();
    manager.ensureWorldParties();
    expect(world.worldAi.parties.filter(p => p.kind === 'caravan'
      && p.escortQuestId)).toHaveLength(1);
    expect(world.worldAi.parties.filter(p => p.kind === 'escort_guard')).toHaveLength(3);
    let end = false;
    for (let i = 0; i < 750; i += 1) {
      playerParty.x = original.x;
      playerParty.y = original.y;
      manager.updateWorldParties(0.1);
      if (qm.activeQuests[0]?.objectives[0]?.outcome === 'caravan_arrived') {
        end = true; break;
      }
    }
    expect(end).toBe(true);
    expect(original.escortVisitedPoints).toBeGreaterThanOrEqual(2);
    expect(original.escortArrived).toBe(true);
    expect(world.state.questEventLedger.observed).toMatchObject([{
      source: 'caravan_arrival', result: 'caravan_arrived', questId: qm.activeQuests[0].id,
      routeId: routes[0].id,
    }]);
    expect(shown).toHaveLength(1);
    expect(applied).toEqual([]);
    expect(qm.completeQuest(qm.activeQuests[0].id, 'caravan_delivered')).toBe(true);
    expect(applied).toEqual([
      { type: 'change_player_gold', amount: 250 },
      { type: 'change_player_reputation', amount: 2 },
      { type: 'improve_trade_route', routeId: routes[0].id, amount: 1 },
    ]);
    expect(qm.completedQuests).toHaveLength(1);
    expect(qm.completeQuest(qm.completedQuests[0].id, 'caravan_delivered')).not.toBe(true);
  });

  it('fails after player abandons a moving caravan but never fabricates arrival credit', () => {
    const { qm, manager, world, playerParty } = make();
    manager.ensureWorldParties();
    const p = world.worldAi.parties.find(x => x.escortQuestId);
    manager.updateWorldParties(0.1); // Start while player near.
    playerParty.x = 900;
    playerParty.y = 500;
    for (let i = 0; i < 60; i += 1) manager.updateWorldParties(0.1);
    expect(qm.failedQuests).toHaveLength(1);
    expect(qm.failedQuests[0].failReason).toBe('escort_abandoned');
    expect(qm.activeQuests).toHaveLength(0);
    expect(p.escortArrived).toBe(false);
    expect(world.state.questEventLedger.observed).toHaveLength(0);
  });

  it('holds a real escort for an actual route bandit then moves again when the threat is gone', () => {
    const { game, world, manager, playerParty } = make();
    const onHud = vi.fn();
    game.questEscortHud = { update: onHud, hide: vi.fn() };
    manager.ensureWorldParties();
    const caravan = world.worldAi.parties.find(p => p.escortQuestId);
    const bandit = spawnPartyBandit(worldMap, {}, { BANDIT_SPEED: 0.01 },
      { tradeRoutes: routes });
    expect(bandit.routeId).toBe(routes[0].id);
    bandit.x = caravan.x + 32;
    bandit.y = caravan.y;
    world.worldAi.parties.push(bandit);
    playerParty.x = caravan.x;
    playerParty.y = caravan.y;
    manager.updateWorldParties(0.1);
    expect(caravan.escortStarted).toBe(true);
    expect(caravan.escortElapsedSeconds).toBe(0);
    expect(onHud).toHaveBeenCalledWith(expect.objectContaining({
      party: caravan, status: 'under_threat', threatCount: 1,
    }));
    world.worldAi.parties = world.worldAi.parties.filter(p => p !== bandit);
    manager.updateWorldParties(0.1);
    expect(caravan.escortElapsedSeconds).toBeGreaterThan(0);
    expect(caravan.escortVisitedPoints).toBeGreaterThanOrEqual(1);
    expect(onHud).toHaveBeenCalledWith(expect.objectContaining({
      party: caravan, threatCount: 0,
    }));
  });

  it('SaveManager does not persist quest escort as a player-authored authoritative party', () => {
    const { qm, manager, state, game, world } = make();
    manager.ensureWorldParties();
    const p = world.worldAi.parties.find(x => x.escortQuestId);
    expect(p).toBeTruthy();
    const save = new SaveManager(state);
    save.init(game);
    const payload = save.buildSavePayload();
    expect(payload.game.worldAi.parties.some(x => x.id === p.id)).toBe(false);
    const normalized = new SaveSystem().normalizePayload(payload).data;
    expect(normalized.game.worldAi.parties.some(x => x.id === p.id)).toBe(false);
    expect(qm.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(state.questEventLedger.observed).toEqual([]);
  });
});

describe('WEB V1.26 — independent escort NPC guards and cargo raids', () => {
  it('spawns three authentic visible world escort guards tethered to one quest caravan', () => {
    const { manager, world, playerParty } = make();
    manager.ensureWorldParties();
    const caravan = world.worldAi.parties.find(p => p.kind === 'caravan' && p.escortQuestId);
    const guards = world.worldAi.parties.filter(p => p.kind === 'escort_guard');
    expect(guards).toHaveLength(3);
    expect(guards.every(g => isRuntimeEscortGuard(g))).toBe(true);
    expect(guards.every(g => g.escortGuardOf === caravan.id
      && g.escortQuestId === caravan.escortQuestId && g.hp === 30)).toBe(true);
    manager.ensureWorldParties();
    expect(world.worldAi.parties.filter(p => p.kind === 'escort_guard')).toHaveLength(3);
    manager.updateWorldParties(0.1);
    expect(activeEscortGuards(caravan, world.worldAi.parties)).toHaveLength(3);
    expect(guards.some(g => Math.hypot(g.x - caravan.x, g.y - caravan.y) > 2)).toBe(true);
    expect(playerParty.gold).toBe(100);
  });

  it('source-generated bandit fights guards automatically, takes damage, and leaves no quest credit', () => {
    const { manager, world, qm, applied, playerParty } = make();
    manager.ensureWorldParties();
    const caravan = world.worldAi.parties.find(p => p.kind === 'caravan' && p.escortQuestId);
    const guards = activeEscortGuards(caravan, world.worldAi.parties);
    const bandit = spawnPartyBandit(worldMap, {}, { BANDIT_SPEED: 0.01 },
      { tradeRoutes: routes });
    bandit.x = caravan.x + 24; bandit.y = caravan.y;
    world.worldAi.parties.push(bandit);
    manager.updateWorldParties(0.2);
    expect(caravan.escortStarted).toBe(true);
    for (let i = 0; i < 50 && bandit.alive !== false; i++) manager.updateWorldParties(0.2);
    expect(bandit.alive).toBe(false);
    expect(caravan.escortDefended).toBe(1);
    expect(caravan.escortCargo).toBeLessThan(100);
    expect(guards.some(g => g.hp < 30)).toBe(true);
    expect(qm.activeQuests).toHaveLength(1);
    expect(qm.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(qm.completedQuests).toHaveLength(0);
    expect(applied).toEqual([]);
    expect(playerParty.gold).toBe(100);
    manager.updateWorldParties(0.2);
    expect(caravan.escortElapsedSeconds).toBeGreaterThan(0);
    expect(caravan.escortDefended).toBe(1);
  });

  it('genuine raid can destroy weakened convoy and apply exactly one canonical route penalty', () => {
    const { manager, world, qm, applied, playerParty } = make();
    manager.ensureWorldParties();
    const caravan = world.worldAi.parties.find(p => p.kind === 'caravan' && p.escortQuestId);
    for (const guard of activeEscortGuards(caravan, world.worldAi.parties)) {
      guard.hp = 0; guard.alive = false; // deliberately weakened QA convoy
    }
    caravan.escortCargo = 24;
    caravan.escortHull = 24;
    const bandit = spawnPartyBandit(worldMap, {}, { BANDIT_SPEED: 0.01 },
      { tradeRoutes: routes });
    bandit.x = caravan.x + 24; bandit.y = caravan.y;
    world.worldAi.parties.push(bandit);
    for (let i = 0; i < 30 && qm.activeQuests.length; i++) {
      manager.updateWorldParties(0.2);
    }
    expect(qm.activeQuests).toHaveLength(0);
    expect(qm.failedQuests).toMatchObject([{
      failReason: 'escort_cargo_raided', status: 'failed',
    }]);
    expect(caravan.escortFailed).toBe(true);
    expect(caravan.escortCargo).toBe(0);
    expect(caravan.escortHull).toBe(0);
    expect(bandit.alive).toBe(true);
    expect(qm.completedQuests).toHaveLength(0);
    expect(applied).toEqual([{
      type: 'damage_trade_route', routeId: routes[0].id, amount: 2,
    }]);
    manager.updateWorldParties(0.2);
    expect(qm.failedQuests).toHaveLength(1);
    expect(applied).toHaveLength(1);
    expect(playerParty.gold).toBe(100);
    expect(world.state.questEventLedger.observed).toEqual([]);
  });

  it('rejects cloned bandit/guard source, mismatched road, and no-before-player raid', () => {
    const q = quest('quest_npc_guard_clone');
    const caravan = spawnQuestEscortCaravan(q, worldMap, routes, 4);
    const parties = [caravan];
    const guards = spawnEscortNpcGuards(caravan, parties);
    const bandit = spawnPartyBandit(worldMap, {}, { BANDIT_SPEED: 0.01 },
      { tradeRoutes: routes });
    bandit.x = caravan.x + 20; bandit.y = caravan.y;
    const fake = { ...bandit };
    parties.push(fake);
    expect(runEscortNpcSkirmish({
      caravan, quest:q, parties, worldState:worldMap, tradeRoutes:routes,
      currentDay:4, dtSec:0.8,
    })).toMatchObject({status:'clear',threats:0});
    parties.pop();
    parties.push(bandit);
    expect(runEscortNpcSkirmish({
      caravan, quest:q, parties, worldState:worldMap, tradeRoutes:routes,
      currentDay:4, dtSec:0.8,
    }).status).toBe('waiting');
    expect(caravan.escortCargo).toBe(100);
    expect(guards.every(g => g.hp === 30)).toBe(true);
    const swapped = { ...guards[0] };
    expect(isRuntimeEscortGuard(swapped)).toBe(false);
    const otherQuest = { ...q, id: 'quest_escort_wrong_identity' };
    expect(runEscortNpcSkirmish({
      caravan, quest:otherQuest, parties, worldState:worldMap, tradeRoutes:routes,
      currentDay:4, dtSec:0.8,
    }).status).toBe('invalid');
    expect(caravan.escortCargo).toBe(100);
    const mismatched = { ...bandit, routeId: 'route:unknown' };
    parties[parties.indexOf(bandit)] = mismatched;
    caravan.escortStarted = true;
    expect(runEscortNpcSkirmish({
      caravan, quest:q, parties, worldState:worldMap, tradeRoutes:routes,
      currentDay:4, dtSec:1,
    }).status).toBe('clear');
    expect(caravan.escortCargo).toBe(100);
  });

  it('restored save cannot create authoritative guard, health or loot proof', () => {
    const { manager, world, qm, state, game } = make();
    manager.ensureWorldParties();
    const caravan = world.worldAi.parties.find(p => p.kind === 'caravan' && p.escortQuestId);
    const guard = activeEscortGuards(caravan, world.worldAi.parties)[0];
    const cloned = { ...guard, hp: 999, attack: 999 };
    expect(isRuntimeEscortGuard(cloned)).toBe(false);
    expect(spawnEscortNpcGuards({ ...caravan }, [caravan, cloned])).toEqual([]);
    const save = new SaveManager(state);
    save.init(game);
    const payload = save.buildSavePayload();
    expect(payload.game.worldAi.parties.filter(p => p.escortQuestId
      || String(p.id).startsWith('quest-escort-'))).toHaveLength(0);
    expect(qm.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(state.questEventLedger.observed).toEqual([]);
  });
});


describe('WEB V1.27 — real market inventory / safe active-quest save integration', () => {
  it('debites source market and refunds pending goods only inside saved snapshot', () => {
    const { manager, world, state, game } = make();
    // Local copy: do not mutate module-level test world or create phantom goods.
    state.map = { ...worldMap,
      settlements: worldMap.settlements.map(s => ({
        ...s, marketStock: [
          { id: 'wheat', qty: 8 }, { id: 'iron', qty: 8 },
          { id: 'cloth', qty: 8 },
        ],
      })),
    };
    game.economyManager.itemCatalog = [
      { id: 'wheat' }, { id: 'iron' }, { id: 'cloth' },
    ];
    game.economyManager.ensureSettlementMarketState = vi.fn();
    manager.ensureWorldParties();
    const caravan = world.worldAi.parties.find(p => p.escortQuestId
      && p.kind === 'caravan');
    expect(caravan).toBeTruthy();
    expect(inspectLiveEscortCargo(caravan)).toHaveLength(3);
    expect(state.map.settlements[0].marketStock.every(s => s.qty === 0)).toBe(true);
    expect(outstandingEscortCargoForSave(world.worldAi.parties).get('0')
      .get('wheat')).toBe(8);
    const save = new SaveManager(state);
    save.init(game);
    const payload = save.buildSavePayload();
    expect(payload.game.settlementsMarkets.find(x => x.settlementId === 0)
      .marketStock).toEqual([
        { id: 'wheat', qty: 8 },
        { id: 'iron', qty: 8 },
        { id: 'cloth', qty: 8 },
      ]);
    expect(state.map.settlements[0].marketStock.every(s => s.qty === 0)).toBe(true);
    expect(payload.game.worldAi.parties.some(p => p.escortQuestId)).toBe(false);
    // Genuine manager update reaches the road destination; credited delivery
    // must move exactly the reserved 24 units to the destination market once.
    for (let tick = 0; tick < 800; tick += 1) {
      game.playerParty.x = caravan.x;
      game.playerParty.y = caravan.y;
      manager.updateWorldParties(0.1);
      if (game.questManager.activeQuests[0]?.objectives[0]?.outcome
        === 'caravan_arrived') break;
    }
    expect(game.questManager.activeQuests[0]?.objectives[0]?.outcome)
      .toBe('caravan_arrived');
    expect(state.map.settlements[1].marketStock)
      .toEqual([{ id: 'wheat', qty: 16 },
        { id: 'iron', qty: 16 }, { id: 'cloth', qty: 16 }]);
    expect(outstandingEscortCargoForSave(world.worldAi.parties).size).toBe(0);
    const deliveredSnapshot = save.buildSavePayload();
    expect(deliveredSnapshot.game.settlementsMarkets
      .find(x => x.settlementId === 1).marketStock[0].qty).toBe(16);
  });
});
