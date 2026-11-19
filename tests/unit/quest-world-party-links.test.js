import { describe, expect, it, vi } from 'vitest';
import {
  spawnBanditOnRegisteredRoute, validBanditRoute, nextBanditRouteTarget,
  registeredTradeRoute, validatedPartyQuestLinks,
} from '../../js/systems/quest-world-party-links.js';
import {
  spawnPartyBandit, createInitialWorldAiState, ensureWorldParties, updateWorldParties,
} from '../../js/systems/world-ai.js';
import WorldPartyManager from '../../js/managers/WorldPartyManager.js';
import WorldSimManager from '../../js/managers/WorldSimManager.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { creditQuestObjectivesForVerifiedEvent } from '../../js/systems/quest-event-matcher.js';
import { emptyQuestEventLedger, recordVerifiedBattleQuestEvent } from '../../js/systems/quest-event-ledger.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import SaveSystem from '../../js/systems/save-system.js';
import SaveManager from '../../js/managers/SaveManager.js';

const map = {
  width: 50, height: 50, tileSize: 32,
  settlements: [
    { id: 'edirne', x: 128, y: 192, ownerFactionId: 'ottoman' },
    { id: 'bursa', x: 512, y: 192, ownerFactionId: 'ottoman' },
    { id: 'belgrade', x: 960, y: 480, ownerFactionId: 'hre' },
  ],
};
const routes = [
  { id: 'route:edirne:bursa', fromCityId: 'edirne', toCityId: 'bursa', quality: 1 },
  { id: 'route:bursa:belgrade', fromCityId: 'bursa', toCityId: 'belgrade', quality: 1 },
];
const cfg = {
  MAX_BANDIT_PARTIES: 1, MAX_PATROL_PARTIES: 0, MAX_CARAVAN_PARTIES: 0,
  MAX_REFUGEE_PARTIES: 0, MAX_TRAVELING_MERCHANT_PARTIES: 0,
  MAX_MESSENGER_PARTIES: 0, MAX_VILLAGER_PARTIES: 0, MAX_NOBLE_PARTIES: 0,
};
const source = () => ({
  id: 'bandit-custom', kind: 'bandit', factionId: 'bandits', routeId: routes[0].id,
  encounterType: 'bandit', x: 320, y: 192, targetX: 512, targetY: 192,
});
const battle = (enemyId = 'bandit-custom') => ({
  phase: 'result', result: 'victory', resolvedAt: 1795102000000, enemyId,
  battleResult: { enemyId, enemyFactionId: 'bandits', result: 'victory', winner: 'player' },
});
function activeRouteQuest() {
  const def = JSON.parse(JSON.stringify(QUEST_DEFS.find(q=>q.id==='secure_trade_route'))
    .replace(/\{\{targetRouteId\}\}/g, routes[0].id)
    .replace(/\{\{targetCityId\}\}/g, 'edirne')
    .replace(/\{\{issuerFactionId\}\}/g, 'ottoman'));
  return {
    ...def, id: 'quest_real_route', status: 'active', templateId: def.id,
    createdAt: 3, targetCityId: 'edirne', targetRouteId: routes[0].id,
  };
}

describe('V1.18: true world party route association and live commander source', () => {
  it('rejects forged routes without real endpoints, duplicates or physical coordinates', () => {
    expect(registeredTradeRoute(map, routes, routes[0].id)?.from?.id).toBe('edirne');
    expect(registeredTradeRoute(map, routes, 'route:fake:fake')).toBeNull();
    expect(registeredTradeRoute(map, [
      { id: routes[0].id, fromCityId: 'fake', toCityId: 'bursa' },
    ], routes[0].id)).toBeNull();
    expect(registeredTradeRoute(map, [
      { id: routes[0].id, fromCityId: 'edirne', toCityId: 'edirne' },
    ], routes[0].id)).toBeNull();
    expect(validBanditRoute({ ...source(), x: 320, y: 999 }, map, routes)).toBeNull();
    expect(validBanditRoute({ ...source(), targetX: 999, targetY: 999 }, map, routes)).toBeNull();
    expect(validBanditRoute({ ...source(), kind: 'patrol' }, map, routes)).toBeNull();
    expect(validBanditRoute({ ...source(), factionId: 'hre' }, map, routes)).toBeNull();
  });

  it('spawns a bandit physically on the real route, with an endpoint patrol goal', () => {
    const tagged = spawnBanditOnRegisteredRoute(map, routes);
    expect(tagged).toMatchObject({
      routeId: routes[0].id, x: 320, y: 192,
      targetX: 512, targetY: 192, homeCityId: 'edirne',
    });
    const party = spawnPartyBandit(map, {}, cfg, { tradeRoutes: routes });
    expect(party.kind).toBe('bandit');
    expect(party.factionId).toBe('bandits');
    expect(party.routeId).toBe(routes[0].id);
    expect(validBanditRoute(party, map, routes)).not.toBeNull();
    expect(nextBanditRouteTarget({ ...party, x: 512, y: 192 }, map, routes))
      .toEqual({ x: 128, y: 192 });
  });

  it('generates ordinary world AI with route-backed bandits, then moves along registered corridor', () => {
    const ai = createInitialWorldAiState();
    ensureWorldParties({ aiState: ai, worldState: map, factions: {}, cfg,
      currentDay: 2, tradeRoutes: routes });
    const bandit = ai.parties.find(p => p.kind === 'bandit');
    expect(bandit?.routeId).toBe(routes[0].id);
    const firstX = bandit.x;
    updateWorldParties({ aiState: ai, worldState: map, tradeRoutes: routes, factions: {},
      cfg, dtSec: 1, playerParty: null });
    expect(bandit.x).toBeGreaterThan(firstX);
    expect(validBanditRoute(bandit, map, routes)).not.toBeNull();
    expect(bandit.path[0]).toMatchObject({ x: 512, y: 192 });
  });

  it('does not attach a route to unrelated or unsupported parties or missing trade data', () => {
    const oldParty = spawnPartyBandit(map, {}, cfg);
    expect(oldParty.routeId).toBeUndefined();
    expect(validatedPartyQuestLinks(oldParty, { worldState: map, tradeRoutes: routes })).toEqual({});
    expect(spawnBanditOnRegisteredRoute(map, [{ id: 'nonexistent' }])).toBeNull();
    expect(validatedPartyQuestLinks({ ...source(), kind: 'caravan' },
      { worldState: map, tradeRoutes: routes })).toEqual({});
  });

  it('binds commanders only from explicit living registry party IDs, never saved party claim', () => {
    const party = { ...source(), commanderId: 'made-up-commander' };
    const none = validatedPartyQuestLinks(party, {
      worldState: map, tradeRoutes: routes, commanders: [],
    });
    expect(none.commanderId).toBeUndefined();
    const linked = validatedPartyQuestLinks(party, {
      worldState: map, tradeRoutes: routes,
      commanders: [{ id: 'commander-genuine', partyId: party.id, alive: true }],
    });
    expect(linked.commanderId).toBe('commander-genuine');
    expect(validatedPartyQuestLinks(party, {
      worldState: map, tradeRoutes: routes,
      commanders: [{ id: 'commander-genuine', partyId: party.id, status: 'dead' }],
    }).commanderId).toBeUndefined();
  });

  it('WorldPartyManager creates, revalidates and projects real bandit links into visible world', () => {
    const world = { state: { map, day: 2, commanders: [] }, enemyParties: [],
      worldAi: createInitialWorldAiState() };
    const game = { economyManager: { ensureTradeRoutes: () => routes },
      getWorldAiCfgWithRegionMods: () => cfg };
    const manager = new WorldPartyManager();
    manager.init(world, game);
    manager.ensureWorldParties();
    const bandit = world.enemyParties.find(p => p.worldPartyKind === 'bandit');
    expect(bandit?.routeId).toBe(routes[0].id);
    expect(game.enemyParties.find(p => p.id === bandit.id)?.routeId).toBe(routes[0].id);
    // Malicious/obsolete persisted route links aren't displayed as authority.
    world.worldAi.parties[0].routeId = 'route:fake:fake';
    manager.syncVisiblePartiesToWorld();
    expect(world.enemyParties.find(p => p.id === bandit.id).routeId).toBeUndefined();
    world.worldAi.parties[0].routeId = routes[0].id;
    manager.syncVisiblePartiesToWorld();
    expect(world.enemyParties.find(p => p.id === bandit.id).routeId).toBe(routes[0].id);
  });

  it('converts AI-world encounter into correct temporary battle enemy with the exact route link', () => {
    const party = source();
    const world = { state: { mode: 'map', map, commanders: [] },
      worldAi: { parties: [party] }, enemyParties: [],
      worldEncounterPartyByEnemyId: {} };
    const sim = new WorldSimManager();
    sim.world = world;
    sim.game = { economyManager: { ensureTradeRoutes: () => routes } };
    sim.triggerEncounter = vi.fn(() => true);
    expect(sim.processWorldAiEncounters([{ partyId: party.id, x: party.x, y: party.y }]))
      .toBe(true);
    expect(sim.triggerEncounter).toHaveBeenCalledTimes(1);
    const temp = world.enemyParties.find(p => p.id === `wai-${party.id}`);
    expect(temp).toMatchObject({
      routeId: routes[0].id, worldPartyKind: 'bandit',
      encounterType: 'bandit', factionId: 'bandits', temporary: true,
    });
    const qm = new QuestManager({ pushOverlay: vi.fn() }, { applyEffect: vi.fn() }, null);
    const quest = activeRouteQuest();
    qm.addQuest(quest);
    const ledger = emptyQuestEventLedger();
    expect(recordVerifiedBattleQuestEvent(ledger, {
      battle: battle(temp.id), currentDay: 4,
      enemyParty: temp, tradeRoutes: routes,
    })).toBe(true);
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: qm, eventId: ledger.observed[0].eventId,
    })).toMatchObject([{ outcome: 'bandits_defeated' }]);
    expect(quest.objectives[0].outcome).toBe('bandits_defeated');
  });

  it('retains source route IDs in the save sidecar but revalidates them after loading', () => {
    const state = { map, mode: 'map', day: 3 };
    const worldAi = { parties: [source()], lastRespawnDay: 3 };
    const game = {
      playerParty: { gold: 0, roster: [] }, itemCatalog: [], settings: {},
      worldAi, enemyParties: [],
      worldManager: { worldAi, enemyParties: [], lastEncounterEndTimeByEnemyId: {},
        syncBuildingStateToMap: () => null }, ensureInventoryModel: () => {},
      ensureRosterState: () => {},
    };
    const save = new SaveManager(state);
    save.init(game);
    const out = save.buildSavePayload();
    expect(out.game.worldAi.parties[0].routeId).toBe(routes[0].id);
    const loaded = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(out))).data;
    const rebuilt = loaded.game.worldAi.parties[0];
    expect(rebuilt.routeId).toBe(routes[0].id);
    expect(validatedPartyQuestLinks(rebuilt, { worldState: map, tradeRoutes: routes }))
      .toMatchObject({ routeId: routes[0].id });
    rebuilt.routeId = routes[1].id; // Forged route, physically elsewhere
    expect(validatedPartyQuestLinks(rebuilt, { worldState: map, tradeRoutes: routes }))
      .toEqual({});
  });
});
