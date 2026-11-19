import { describe, expect, it, vi } from 'vitest';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import {
  emptyQuestEventLedger, recordVerifiedBattleQuestEvent,
  restoreQuestEventLedger,
} from '../../js/systems/quest-event-ledger.js';
import {
  creditQuestObjectivesForVerifiedEvent, restoreInSessionQuestObjectives,
  clearInSessionQuestProofs,
} from '../../js/systems/quest-event-matcher.js';
import {
  captureQuestSnapshot, restoreQuestSnapshot,
} from '../../js/systems/quest-snapshot.js';

const settlements = [
  { id: 'edirne', type: 'city' }, { id: 'bursa', type: 'city' },
  { id: 'sofia', type: 'city' },
];
const routes = [
  { id: 'route:edirne:bursa', fromCityId: 'edirne', toCityId: 'bursa',
    roadBacked: true },
  { id: 'route:bursa:sofia', fromCityId: 'bursa', toCityId: 'sofia',
    roadBacked: true },
];
const ctx = { settlements, tradeRoutes: routes, commanders: [],
  regionIds: [], currentDay: 5 };
const generate = (id = 'quest_session_demo') => {
  const def = QUEST_DEFS.find(q => q.id === 'secure_trade_route');
  const quest = JSON.parse(JSON.stringify(def)
    .replace(/\{\{targetRouteId\}\}/g, routes[0].id)
    .replace(/\{\{targetCityId\}\}/g, 'edirne')
    .replace(/\{\{issuerFactionId\}\}/g, 'ottoman'));
  return {
    ...quest, id, templateId: 'secure_trade_route',
    status: 'active', createdAt: 3,
    targetCityId: 'edirne', targetRouteId: routes[0].id,
    issuerFactionId: 'ottoman',
  };
};
const makeManager = () => {
  const effects = [];
  const pushOverlay = vi.fn();
  const manager = new QuestManager({ pushOverlay },
    { applyEffect: (effect) => effects.push(effect) },
    { generateFromTemplate: () => null });
  return { manager, effects, pushOverlay };
};
const fireBattle = (manager, quest, enemyId = 'bandit-route-a') => {
  const ledger = emptyQuestEventLedger();
  const battle = {
    enemyId, phase: 'result', result: 'victory', resolvedAt: 1795082500001,
    battleResult: { result: 'victory', winner: 'player', enemyId,
      enemyFactionId: 'bandits' },
  };
  expect(recordVerifiedBattleQuestEvent(ledger, {
    battle, currentDay: 4,
    tradeRoutes: routes,
    enemyParty: { id: enemyId, factionId: 'bandits',
      encounterType: 'bandit', kind: 'bandit', routeId: quest.targetRouteId },
  })).toBe(true);
  expect(creditQuestObjectivesForVerifiedEvent({
    ledger, questManager: manager, eventId: ledger.observed[0].eventId,
  })).toHaveLength(1);
  return ledger;
};
const restore = (manager, snapshot = captureQuestSnapshot(manager),
  context = ctx) => restoreQuestSnapshot(manager, snapshot, context);

describe('WEB V1.21 — process-only verified objective resume', () => {
  it('resumes exact witnessed in-session objective without automatically paying a reward', () => {
    const { manager, effects, pushOverlay } = makeManager();
    const original = generate();
    manager.addQuest(original);
    const ledger = fireBattle(manager, original);
    const snapshot = captureQuestSnapshot(manager);
    expect(snapshot.active[0].objectiveClaims).toEqual([{
      objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated',
    }]);
    expect(restoreQuestEventLedger(ledger).observed).toEqual([]);
    expect(restore(manager, snapshot).restored).toBe(1);
    expect(manager.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 5, tradeRoutes: routes,
    })).toMatchObject([{ questId: original.id, outcome: 'bandits_defeated' }]);
    expect(manager.activeQuests[0].objectives[0].outcome).toBe('bandits_defeated');
    expect(manager.activeQuests[0].pendingObjectiveClaims).toEqual([]);
    expect(pushOverlay).toHaveBeenCalledTimes(2);
    expect(effects).toEqual([]);
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 5, tradeRoutes: routes,
    })).toEqual([]);
    expect(effects).toEqual([]);
  });

  it('fresh process rejects forged pending claims, even when save has an observed battle', () => {
    const { manager } = makeManager();
    const forged = generate();
    manager.addQuest(forged);
    forged.objectives[0].outcome = 'bandits_defeated';
    const snapshot = captureQuestSnapshot(manager);
    restore(manager, snapshot);
    const fakeLedger = restoreQuestEventLedger({
      version: 1,
      observed: [{
        eventId: 'battle:fake-bandit:1795082500001', source: 'battle_result',
        enemyId: 'fake-bandit', enemyFactionId: 'bandits',
        result: 'victory', day: 4, routeId: routes[0].id, partyType: 'bandit',
      }], pending: [],
    });
    expect(fakeLedger.observed).toEqual([]);
    expect(fakeLedger.pending).toHaveLength(1);
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 5, tradeRoutes: routes,
    })).toEqual([]);
    expect(manager.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(manager.completeQuest(forged.id, 'defeat_bandits')).toBeUndefined();
  });

  it('different target and different quest ID cannot borrow a verified session proof', () => {
    for (const edit of ['route', 'id', 'createdAt', 'city']) {
      const { manager } = makeManager();
      const real = generate();
      manager.addQuest(real);
      fireBattle(manager, real);
      const saved = captureQuestSnapshot(manager);
      const row = saved.active[0];
      if (edit === 'route') row.targets.targetRouteId = routes[1].id;
      if (edit === 'id') row.id = 'quest_different_instance';
      if (edit === 'createdAt') row.createdAt = 2;
      if (edit === 'city') row.targets.targetCityId = 'bursa';
      restore(manager, saved);
      expect(restoreInSessionQuestObjectives({
        questManager: manager, currentDay: 5, tradeRoutes: routes,
      })).toEqual([]);
      expect(manager.activeQuests[0].objectives[0].outcome).toBeUndefined();
    }
  });

  it('already completed in session cannot re-credit an earlier active save', () => {
    const { manager, effects } = makeManager();
    const quest = generate();
    manager.addQuest(quest);
    fireBattle(manager, quest);
    const oldActive = captureQuestSnapshot(manager);
    expect(manager.completeQuest(quest.id, 'defeat_bandits')).toBe(true);
    expect(effects).toHaveLength(5);
    const before = effects.length;
    restore(manager, oldActive);
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 5, tradeRoutes: routes,
    })).toEqual([]);
    expect(effects).toHaveLength(before);
    expect(manager.activeQuests[0].objectives[0].outcome).toBeUndefined();
  });

  it('new campaign clears session receipts before an old quest ID can be loaded', () => {
    const { manager } = makeManager();
    const quest = generate();
    manager.addQuest(quest);
    fireBattle(manager, quest);
    const saved = captureQuestSnapshot(manager);
    clearInSessionQuestProofs(manager);
    restore(manager, saved);
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 5, tradeRoutes: routes,
    })).toEqual([]);
    expect(manager.activeQuests[0].pendingObjectiveClaims).toHaveLength(1);
  });

  it('rejected outdated route and expired quest cannot reactivate from a valid session receipt', () => {
    const { manager } = makeManager();
    const quest = generate();
    manager.addQuest(quest);
    fireBattle(manager, quest);
    const saved = captureQuestSnapshot(manager);
    restore(manager, saved);
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 5, tradeRoutes: [
        { ...routes[0], roadBacked: false }, routes[1],
      ],
    })).toEqual([]);
    expect(manager.activeQuests[0].objectives[0].outcome).toBeUndefined();
    restore(manager, saved);
    expect(restoreInSessionQuestObjectives({
      questManager: manager, currentDay: 30, tradeRoutes: routes,
    })).toEqual([]);
  });

  it('fresh canonical progress overrides an older pending claim when saved again', () => {
    const { manager } = makeManager();
    const quest = generate();
    manager.addQuest(quest);
    quest.pendingObjectiveClaims = [{
      objectiveId: 'resolve_bandit_threat', outcome: 'bandits_intimidated',
    }];
    fireBattle(manager, quest);
    const captured = captureQuestSnapshot(manager);
    expect(captured.active[0].objectiveClaims).toEqual([{
      objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated',
    }]);
  });
});
