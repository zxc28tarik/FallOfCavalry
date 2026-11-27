import { describe, it, expect, vi } from 'vitest';
import { QuestGenerator } from '../../js/systems/QuestGenerator.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import {
  planLegacyTradeRouteRecovery, reissueLegacyTradeRouteQuest,
  describePendingQuestClaims, canRetireLegacyRouteQuest,
  retireUnsupportedLegacyRouteQuest,
} from '../../js/systems/legacy-trade-route-recovery.js';
import { captureQuestSnapshot, restoreQuestSnapshot } from '../../js/systems/quest-snapshot.js';

const settlements = [
  { id: 'edirne', name: 'Edirne', type: 'city' },
  { id: 'bursa', name: 'Bursa', type: 'city' },
  { id: 'sofia', name: 'Sofya', type: 'city' },
];
const legacyRoute = {
  id: 'route:edirne:sofia', fromCityId: 'edirne',
  toCityId: 'sofia', roadBacked: false,
};
const realRoute = {
  id: 'route:edirne:bursa', fromCityId: 'edirne',
  toCityId: 'bursa', roadBacked: true,
};
const routes = [realRoute, legacyRoute];
const gen = new QuestGenerator(
  { getCurrentDay: () => 8 },
  { pickQuestTargetCity: () => 'edirne' },
  { pickQuestTargetRoute: () => legacyRoute.id },
  { pickQuestIssuerFaction: () => 'ottoman' },
);
const createQuest = (templateId = 'secure_trade_route') => {
  const q = gen.generateFromTemplate(templateId, {
    targetCityId: 'edirne', targetRouteId: legacyRoute.id,
    issuerFactionId: 'ottoman',
  });
  if (!q) throw new Error('Expected canonical quest template');
  q.status = 'active';
  q.createdAt = 3;
  return q;
};
const makeManager = (quest = createQuest()) => {
  const effects = [];
  const m = new QuestManager({ pushOverlay: vi.fn() },
    { applyEffect: (effect) => effects.push(effect) }, gen);
  expect(m.addQuest(quest)).toBe(true);
  return { m, effects, quest };
};
const options = (quest) => ({
  quest, tradeRoutes: routes, settlements, currentDay: 8,
});
const reissue = (m, questId) => reissueLegacyTradeRouteQuest({
  questManager: m, questId, tradeRoutes: routes,
  settlements, currentDay: 8,
});

describe('WEB V1.21 — explicitly authorized legacy road quest recovery', () => {
  it('proposes a real connected route, preserving city and identifying legacy ID', () => {
    const q = createQuest();
    expect(planLegacyTradeRouteRecovery(options(q))).toMatchObject({
      questId: q.id, previousRouteId: legacyRoute.id,
      newRouteId: realRoute.id, targetCityId: 'edirne',
      connectedCityName: 'Bursa', currentDay: 8,
    });
  });

  it('changes a route only on deliberate reissue, retaining the quest ID and approved agent', () => {
    const { m, effects, quest } = makeManager();
    quest.assignedCharacterId = 'npc:source-city~0:1';
    quest.pendingObjectiveClaims = [{
      objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated',
    }];
    const initial = captureQuestSnapshot(m);
    expect(initial.active[0].targets.targetRouteId).toBe(legacyRoute.id);
    const result = reissue(m, quest.id);
    expect(result).toMatchObject({ ok: true, newRouteId: realRoute.id });
    expect(m.activeQuests).toHaveLength(1);
    const replacement = m.activeQuests[0];
    expect(replacement).not.toBe(quest);
    expect(replacement.id).toBe(quest.id);
    expect(replacement.assignedCharacterId).toBe('npc:source-city~0:1');
    expect(replacement.createdAt).toBe(8);
    expect(replacement.targetRouteId).toBe(realRoute.id);
    expect(replacement.targetCityId).toBe('edirne');
    expect(replacement.objectives[0].targetRouteId).toBe(realRoute.id);
    expect(replacement.objectives[0].outcome).toBeUndefined();
    expect(replacement.completionPaths[0].worldEffects[1].routeId).toBe(realRoute.id);
    expect(replacement.pendingObjectiveClaims).toHaveLength(1);
    expect(replacement.legacyRouteRecovery.previousRouteId).toBe(legacyRoute.id);
    expect(effects).toEqual([]);
    expect(m.completedQuests).toEqual([]);
    expect(m.failedQuests).toEqual([]);
    expect(reissue(m, quest.id).ok).toBe(false);
    expect(captureQuestSnapshot(m).active[0].targets.targetRouteId).toBe(realRoute.id);
  });

  it('restores a reissued quest from official templates and never credits old claims', () => {
    const { m, effects, quest } = makeManager();
    quest.pendingObjectiveClaims = [{
      objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated',
    }];
    expect(reissue(m, quest.id).ok).toBe(true);
    const saved = captureQuestSnapshot(m);
    const target = saved.active[0].targets.targetRouteId;
    expect(target).toBe(realRoute.id);
    const result = restoreQuestSnapshot(m, saved, {
      currentDay: 9, tradeRoutes: routes, settlements,
    });
    expect(result.restored).toBe(1);
    expect(m.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(m.activeQuests[0].pendingObjectiveClaims).toHaveLength(1);
    expect(effects).toEqual([]);
  });

  it('never migrates automatically: absent button action leaves quest untouched', () => {
    const { m, quest } = makeManager();
    expect(planLegacyTradeRouteRecovery(options(quest))).toBeTruthy();
    expect(m.activeQuests[0].targetRouteId).toBe(legacyRoute.id);
    expect(m.activeQuests[0].createdAt).toBe(3);
  });

  it('rejects available, expired, already-progressed and noncanonical old route quests', () => {
    const cases = [
      { status: 'available' },
      { createdAt: -10 },
      { objectives: [{ id: 'resolve_bandit_threat',
        type: 'resolve_threat', threatType: 'bandit',
        targetRouteId: legacyRoute.id, outcome: 'bandits_defeated' }] },
      { templateId: 'forged-template' },
      { targetRouteId: realRoute.id,
        objectives: [{ id: 'resolve_bandit_threat', type: 'resolve_threat',
          threatType: 'bandit', targetRouteId: realRoute.id }] },
    ];
    for (const patch of cases) {
      const { m, quest } = makeManager();
      Object.assign(quest, patch);
      expect(planLegacyTradeRouteRecovery(options(quest))).toBeNull();
      expect(reissue(m, quest.id).ok).toBe(false);
    }
  });

  it('rejects unrelated city and no matching real road without guessing destinations', () => {
    const q = createQuest();
    q.targetCityId = 'sofia';
    expect(planLegacyTradeRouteRecovery(options(q))).toBeNull();
    expect(planLegacyTradeRouteRecovery({
      quest: createQuest(), tradeRoutes: [legacyRoute], settlements,
      currentDay: 8,
    })).toBeNull();
    expect(planLegacyTradeRouteRecovery({
      quest: createQuest(), tradeRoutes: [
        legacyRoute, { id: 'route:bursa:sofia',
          fromCityId: 'bursa', toCityId: 'sofia', roadBacked: true },
      ], settlements, currentDay: 8,
    })).toBeNull();
  });

  it('will not make unreleased escort/missing-caravan objectives earn rewards', () => {
    const q = createQuest('escort_first_caravan');
    expect(planLegacyTradeRouteRecovery(options(q))).toBeNull();
    const { m, effects } = makeManager(q);
    expect(reissue(m, q.id).ok).toBe(false);
    expect(effects).toEqual([]);
  });

  it('rejects a deceptive generator response pointing at a different route', () => {
    const q = createQuest();
    const { m } = makeManager(q);
    m.questGenerator = {
      generateFromTemplate: () => ({
        ...q, templateId: q.templateId,
        targetRouteId: 'route:unrelated', targetCityId: 'edirne',
        objectives: [{ id: 'resolve_bandit_threat',
          targetRouteId: 'route:unrelated', type: 'resolve_threat',
          threatType: 'bandit' }],
      }),
    };
    expect(reissue(m, q.id)).toMatchObject({
      ok: false, reason: 'generator_target_mismatch',
    });
    expect(m.activeQuests[0]).toBe(q);
  });

  it('archives unsupported legacy escort only on explicit user consent without penalty', () => {
    const q = createQuest('escort_first_caravan');
    const { m, effects } = makeManager(q);
    const characterHistory = vi.fn();
    m.onQuestFailed = characterHistory;
    expect(canRetireLegacyRouteQuest({ quest: q, tradeRoutes: routes, currentDay: 8 }))
      .toBe(true);
    expect(m.activeQuests).toHaveLength(1);
    expect(retireUnsupportedLegacyRouteQuest({
      questManager: m, questId: q.id, tradeRoutes: routes, currentDay: 8,
    })).toBe(true);
    expect(m.activeQuests).toHaveLength(0);
    expect(m.completedQuests).toHaveLength(0);
    expect(m.failedQuests).toMatchObject([{
      id: q.id, status: 'failed', failReason: 'legacy_route_retired',
    }]);
    expect(effects).toEqual([]); // No template failure effects (route damage).
    expect(characterHistory).toHaveBeenCalledOnce();
    expect(captureQuestSnapshot(m).failed).toMatchObject([{
      id: q.id, reason: 'legacy_route_retired',
    }]);
    expect(retireUnsupportedLegacyRouteQuest({
      questManager: m, questId: q.id, tradeRoutes: routes, currentDay: 8,
    })).toBe(false);
  });

  it('does not retire playable, completed, wrong or expired target claims', () => {
    for (const patch of [
      { targetRouteId: realRoute.id },
      { status: 'available' },
      { createdAt: -9 },
      { templateId: 'nonexistent' },
      { objectives: [{
        id: 'deliver_caravan_safely', targetRouteId: legacyRoute.id,
        outcome: 'caravan_arrived', type: 'escort_party',
      }] },
    ]) {
      const q = createQuest('escort_first_caravan');
      Object.assign(q, patch);
      const { m, effects } = makeManager(q);
      expect(retireUnsupportedLegacyRouteQuest({
        questManager: m, questId: q.id, tradeRoutes: routes, currentDay: 8,
      })).toBe(false);
      expect(m.activeQuests).toHaveLength(1);
      expect(effects).toEqual([]);
    }
  });

  it('describes pending claim counts for UI, never interpreting them as achievements', () => {
    const { m, quest } = makeManager();
    quest.pendingObjectiveClaims = [{
      objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated',
    }];
    expect(describePendingQuestClaims(m.activeQuests))
      .toMatchObject([{ questId: quest.id, count: 1 }]);
    quest.status = 'available';
    expect(describePendingQuestClaims(m.activeQuests)).toEqual([]);
    expect(QUEST_DEFS.some(d => d.id === quest.templateId)).toBe(true);
  });
});
