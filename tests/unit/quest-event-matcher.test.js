import { describe, it, expect, vi, afterEach } from 'vitest';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { EncounterManager } from '../../js/managers/EncounterManager.js';
import {
  emptyQuestEventLedger, captureQuestEventLedger, restoreQuestEventLedger,
  recordVerifiedBattleQuestEvent, recordVerifiedMessengerCaptureEvent,
} from '../../js/systems/quest-event-ledger.js';
import { creditQuestObjectivesForVerifiedEvent } from '../../js/systems/quest-event-matcher.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';

afterEach(() => vi.restoreAllMocks());

function quest(templateId, id = 'quest_test', target = {}) {
  const def = QUEST_DEFS.find((d) => d.id === templateId);
  const resolved = JSON.parse(JSON.stringify(def).replace(/\{\{targetRouteId\}\}/g,
    target.targetRouteId || 'route:edirne:bursa').replace(/\{\{targetCityId\}\}/g,
    'edirne').replace(/\{\{targetCommanderId\}\}/g, target.targetCommanderId || 'commander-alpha')
    .replace(/\{\{issuerFactionId\}\}/g, 'ottoman'));
  return {
    ...resolved, id, templateId, status: 'active', createdAt: 3,
    ...target, objectives: resolved.objectives,
  };
}
const setup = (templateId, target = {}) => {
  const overlays = [];
  const rewards = [];
  const manager = new QuestManager({ pushOverlay: (...args) => overlays.push(args) },
    { applyEffect: (effect) => rewards.push(effect) }, null);
  const task = quest(templateId, undefined, target);
  manager.addQuest(task);
  return { task, manager, overlays, rewards, ledger: emptyQuestEventLedger() };
};
const battle = (enemyId = 'bandit-party-1', faction = 'bandits') => ({
  phase: 'result', result: 'victory', resolvedAt: 1795082400000,
  enemyId, battleResult: { result: 'victory', winner: 'player',
    enemyId, enemyFactionId: faction },
});
const route = { id: 'route:edirne:bursa' };

describe('WEB V1.17: source-resolved quest progress', () => {
  it('credits only a bandit battle on the exact registered route; not proximity or generic bandit', () => {
    const { task, manager, overlays, rewards, ledger } = setup('secure_trade_route',
      { targetRouteId: route.id });
    const sourceParty = { id: 'bandit-party-1', factionId: 'bandits',
      encounterType: 'bandit', worldPartyKind: 'bandit', routeId: route.id };
    expect(recordVerifiedBattleQuestEvent(ledger, {
      battle: battle(), currentDay: 4, enemyParty: sourceParty, tradeRoutes: [route],
    })).toBe(true);
    expect(ledger.observed[0].routeId).toBe(route.id);
    const receipts = creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: manager, eventId: ledger.observed[0].eventId,
    });
    expect(receipts).toMatchObject([{ questId: task.id, outcome: 'bandits_defeated' }]);
    expect(task.objectives[0].outcome).toBe('bandits_defeated');
    expect(overlays).toHaveLength(1);
    expect(rewards).toEqual([]);
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: manager, eventId: ledger.observed[0].eventId,
    })).toEqual([]);
  });

  it('does not credit a victory on an unregistered, wrong or inferred route', () => {
    for (const bad of [
      { routeId: route.id, tradeRoutes: [] },
      { routeId: 'route:bursa:edirne', tradeRoutes: [route] },
      { routeId: undefined, tradeRoutes: [route] },
      { routeId: route.id, tradeRoutes: [route], factionId: 'neutral' },
    ]) {
      const { task, manager, ledger } = setup('secure_trade_route', { targetRouteId: route.id });
      recordVerifiedBattleQuestEvent(ledger, {
        battle: battle(), currentDay: 4, tradeRoutes: bad.tradeRoutes,
        enemyParty: { id: 'bandit-party-1', factionId: bad.factionId || 'bandits',
          encounterType: 'bandit', kind: 'bandit', routeId: bad.routeId },
      });
      expect(creditQuestObjectivesForVerifiedEvent({
        ledger, questManager: manager, eventId: ledger.observed[0].eventId,
      })).toEqual([]);
      expect(task.objectives[0].outcome).toBeUndefined();
    }
  });

  it('credits exact registered commander victory but not unknown/captured/retreated paths', () => {
    const { task, manager, ledger } = setup('neutralize_commander',
      { targetCommanderId: 'commander-alpha' });
    recordVerifiedBattleQuestEvent(ledger, {
      battle: battle('enemy-alpha', 'hre'), currentDay: 4,
      enemyParty: { id: 'enemy-alpha', factionId: 'hre', commanderId: 'commander-alpha' },
      commanders: [{ id: 'commander-alpha' }],
    });
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: manager, eventId: ledger.observed[0].eventId,
    })).toMatchObject([{ outcome: 'commander_defeated' }]);
    expect(task.objectives[0].outcome).toBe('commander_defeated');
    expect(manager._isPathAvailable(task, task.completionPaths.find((p) => p.id === 'captured'))).toBe(false);
    expect(manager._isPathAvailable(task, task.completionPaths.find((p) => p.id === 'diplomatic_pressure'))).toBe(false);
  });

  it('guards against registry spoofing and unrelated commander', () => {
    for (const commanders of [[], [{ id: 'commander-beta' }]]) {
      const { task, manager, ledger } = setup('neutralize_commander',
        { targetCommanderId: 'commander-alpha' });
      recordVerifiedBattleQuestEvent(ledger, {
        battle: battle('enemy-alpha', 'hre'), currentDay: 4,
        enemyParty: { id: 'enemy-alpha', factionId: 'hre', commanderId: 'commander-alpha' },
        commanders,
      });
      expect(creditQuestObjectivesForVerifiedEvent({
        ledger, questManager: manager, eventId: ledger.observed[0].eventId,
      })).toEqual([]);
      expect(task.objectives[0].outcome).toBeUndefined();
    }
  });

  it('rejects pending save evidence, future-created quests, expired quests and available quests', () => {
    const { task, manager, ledger } = setup('secure_trade_route',
      { targetRouteId: route.id });
    recordVerifiedBattleQuestEvent(ledger, {
      battle: battle(), currentDay: 4, tradeRoutes: [route],
      enemyParty: { id: 'bandit-party-1', factionId: 'bandits',
        encounterType: 'bandit', kind: 'bandit', routeId: route.id },
    });
    const saved = captureQuestEventLedger(ledger);
    const resumed = restoreQuestEventLedger(saved);
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger: resumed, questManager: manager, eventId: saved.observed[0].eventId,
    })).toEqual([]);
    for (const patch of [{ createdAt: 5 }, { createdAt: 0, timeLimitDays: 2 },
      { status: 'available' }]) {
      Object.assign(task, patch);
      expect(creditQuestObjectivesForVerifiedEvent({
        ledger, questManager: manager, eventId: saved.observed[0].eventId,
      })).toEqual([]);
      task.createdAt = 3; task.timeLimitDays = 12; task.status = 'active';
    }
  });

  it('does not convert unsuccessful seize, stop, read, follow, or a different party into capture', () => {
    const baseline = {
      encounter: { enemyId: 'messenger-1', encounterType: 'messenger' },
      enemyParty: { id: 'messenger-1', factionId: 'neutral',
        encounterType: 'messenger', kind: 'messenger' },
      choice: { id: 'seize', outcome: 'resource' },
      resolution: { optionId: 'seize', success: true },
      currentDay: 4, resolvedAt: 1795082400000,
    };
    for (const invalid of [
      { resolution: { optionId: 'seize', success: false } },
      { choice: { id: 'follow', outcome: 'quest_placeholder' } },
      { choice: { id: 'read', outcome: 'info' } },
      { choice: { id: 'stop', outcome: 'info' } },
      { enemyParty: { ...baseline.enemyParty, encounterType: 'caravan' } },
      { encounter: { enemyId: 'other', encounterType: 'messenger' } },
    ]) {
      const ledger = emptyQuestEventLedger();
      expect(recordVerifiedMessengerCaptureEvent(ledger, { ...baseline, ...invalid })).toBe(false);
      expect(ledger.observed).toHaveLength(0);
    }
  });

  it('real EncounterManager choice resolves and credits a pre-existing active messenger quest', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { task, manager, overlays, rewards, ledger } = setup('intercept_messenger');
    const enemyParty = { id: 'messenger-1', factionId: 'neutral',
      encounterType: 'messenger', kind: 'messenger', x: 0, y: 0 };
    const state = {
      mode: 'encounter', day: 4,
      encounter: { enemyId: 'messenger-1', encounterType: 'messenger' },
      questEventLedger: ledger, selectedFaction: { id: 'ottoman' },
    };
    const encounter = new EncounterManager(state);
    const game = {
      playerParty: { x: 0, y: 0, gold: 200, renown: 0, morale: 80, roster: [] },
      worldManager: {
        enemyParties: [enemyParty], lastEncounterEndTimeByEnemyId: {},
        cleanupTemporaryEnemy: vi.fn(), updateTransientUIState: vi.fn(),
        applyEffect: vi.fn(), findNearestCityId: () => 'edirne',
      },
      questManager: manager,
      questGenerator: { generateFromTemplate: () => null },
      battleManager: { battleCommandsUI: { hide: vi.fn() } },
    };
    encounter.init(game);
    expect(encounter.resolveEncounter('seize')).toBe(true);
    expect(state.mode).toBe('map');
    expect(task.objectives[0].outcome).toBe('messenger_caught');
    expect(ledger.observed).toMatchObject([{
      source: 'encounter_choice', partyType: 'messenger', optionId: 'seize',
      result: 'messenger_caught',
    }]);
    expect(overlays).toHaveLength(1);
    expect(rewards).toEqual([]);
  });

  it('failed real messenger choice never unlocks task', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    const { task, manager, ledger } = setup('intercept_messenger');
    const state = { mode: 'encounter', day: 4,
      encounter: { enemyId: 'messenger-1', encounterType: 'messenger' },
      questEventLedger: ledger };
    const encounter = new EncounterManager(state);
    encounter.init({
      playerParty: { x: 0, y: 0, gold: 100, renown: 0, morale: 90, roster: [] },
      worldManager: {
        enemyParties: [{ id: 'messenger-1', factionId: 'neutral',
          encounterType: 'messenger', kind: 'messenger', x: 0, y: 0 }],
        lastEncounterEndTimeByEnemyId: {}, cleanupTemporaryEnemy: vi.fn(),
        updateTransientUIState: vi.fn(), applyEffect: vi.fn(),
        findNearestCityId: () => 'edirne',
      },
      questManager: manager, questGenerator: { generateFromTemplate: () => null },
      battleManager: { battleCommandsUI: { hide: vi.fn() } },
    });
    expect(encounter.resolveEncounter('seize')).toBe(true);
    expect(task.objectives[0].outcome).toBeUndefined();
    expect(ledger.observed).toEqual([]);
  });
});
