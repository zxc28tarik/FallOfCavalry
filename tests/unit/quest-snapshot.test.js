import { describe, expect, it, vi } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { QuestGenerator } from '../../js/systems/QuestGenerator.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import {
  emptyQuestSnapshot, captureQuestSnapshot,
  normalizeQuestSnapshot, restoreQuestSnapshot,
} from '../../js/systems/quest-snapshot.js';
import { createWorldCharacterRoster, promoteWorldCharacter } from '../../js/systems/world-characters.js';
import { emptyCharacterOrganizationState, startCharacterAssignment } from '../../js/systems/character-organization.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';
import { applyApprovedQuestCharacterOutcome } from '../../js/systems/character-quest-events.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];
const tradeRoutes = [{
  id: 'route:edirne:bursa', fromCityId: 'edirne', toCityId: 'bursa',
}];
const context = { settlements, tradeRoutes, commanders: [], regionIds: [] };
const makeGenerator = () => new QuestGenerator({
  getCurrentDay: () => 5,
}, {
  pickQuestTargetCity: () => 'edirne',
}, {
  pickQuestTargetRoute: () => 'route:edirne:bursa',
}, {
  pickQuestIssuerFaction: () => 'ottoman',
});

function manager(effects = []) {
  return new QuestManager({ pushOverlay: vi.fn() }, {
    applyEffect: (effect) => effects.push(effect),
  }, { generateFromTemplate: () => null });
}
function newQuest() {
  const quest = makeGenerator().generateFromTemplate('secure_trade_route', {
    issuerFactionId: 'ottoman',
  });
  expect(quest).toMatchObject({
    templateId: 'secure_trade_route', targetCityId: 'edirne',
    targetRouteId: 'route:edirne:bursa', createdAt: 5, status: 'available',
  });
  return quest;
}

function setup() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const actor = roster.characters[0];
  promoteWorldCharacter(roster, actor.id, { day: 3 });
  const characterOrganization = emptyCharacterOrganizationState();
  expect(startCharacterAssignment(characterOrganization, actor.id, {
    roster, settlements, branch: 'city_administration',
    assignmentRole: 'quest_agent',
    assignmentLocation: { kind: 'settlement', settlementId: 'edirne' },
    day: 4, reason: 'Assigned to real council office',
  })).toBe(true);
  const effects = [];
  const questManager = manager(effects);
  const quest = newQuest();
  questManager.addQuest(quest);
  questManager.activateQuest(quest.id);
  const state = {
    seed: 1648, day: 6, mode: 'map', map: { settlements },
    worldCharacters: roster, characterOrganization,
  };
  const flow = new GameFlowManager(state);
  flow.init({ questManager, settings: {} });
  expect(flow.assignWorldCharacterToQuest(quest.id, actor.id, {
    reason: 'Explicit city mission appointment',
  })).toBe(true);
  return { roster, actor, questManager, quest, state, flow, effects };
}

const fakeGame = (questManager) => ({
  settings: {}, itemCatalog: [], questManager,
  economyManager: { ensureTradeRoutes: () => tradeRoutes },
  playerParty: { gold: 200, roster: [] },
  worldManager: {
    enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
    lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
  },
  ensureRosterState: () => {}, ensureInventoryModel: () => {},
});

describe('Character v2 V1.14: canonical active quest save and trustworthy rehydration', () => {
  it('keeps the default snapshot empty; previously saved campaigns need no quest migration', () => {
    expect(emptyQuestSnapshot()).toEqual({
      version: 1, active: [], completed: [], failed: [],
    });
    const normalized = new SaveSystem().normalizePayload({
      schemaVersion: 1, game: {},
    });
    expect(normalized.ok).toBe(true);
    expect(normalized.data.game.questSnapshot).toEqual(emptyQuestSnapshot());
    const qm = manager();
    expect(restoreQuestSnapshot(qm, normalized.data.game.questSnapshot, {
      ...context, currentDay: 8,
    })).toMatchObject({ restored: 0, rejected: 0, acceptedIds: [] });
  });

  it('rehydrates canonical world settlements with the real one-digit IDs (0, 1)', () => {
    const source = normalizeQuestSnapshot({
      version: 1, completed: [], failed: [],
      active: [{
        id: 'quest_world_city_0', templateId: 'secure_trade_route',
        status: 'active', createdAt: 5,
        targets: {
          targetCityId: 0, targetRouteId: 'route:0:1',
          issuerFactionId: 'ottoman',
        },
        objectiveClaims: [],
      }],
    });
    expect(source.active).toHaveLength(1);
    expect(source.active[0].targets.targetCityId).toBe('0');
    const qm = manager();
    const restored = restoreQuestSnapshot(qm, source, {
      settlements: [{ id: 0, type: 'city' }, { id: 1, type: 'town' }],
      tradeRoutes: [{ id: 'route:0:1' }],
      currentDay: 6,
    });
    expect(restored.restored).toBe(1);
    expect(qm.activeQuests[0].targetCityId).toBe('0');
    expect(qm.activeQuests[0].completionPaths[0].worldEffects[0].cityId).toBe('0');
  });

  it('snapshots ONLY IDs/targets and pending objective claims, never game rewards or world effects', () => {
    const questManager = manager();
    const quest = newQuest();
    questManager.addQuest(quest);
    questManager.activateQuest(quest.id);
    questManager.updateObjective(quest.id, 'resolve_bandit_threat', 'bandits_defeated');
    const snap = captureQuestSnapshot(questManager);
    expect(snap.active).toHaveLength(1);
    expect(snap.active[0]).toMatchObject({
      id: quest.id, templateId: quest.templateId, status: 'active',
      createdAt: 5,
      targets: { targetCityId: 'edirne', targetRouteId: 'route:edirne:bursa' },
      objectiveClaims: [
        { objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated' },
      ],
    });
    expect(JSON.stringify(snap)).not.toContain('"rewards"');
    expect(JSON.stringify(snap)).not.toContain('"worldEffects"');
  });

  it('rebuilds live quest rules from shipped QUEST_DEFS; old objective outcomes are INERT', () => {
    const initial = manager();
    const quest = newQuest();
    initial.addQuest(quest);
    initial.activateQuest(quest.id);
    initial.updateObjective(quest.id, 'resolve_bandit_threat', 'bandits_defeated');
    const save = captureQuestSnapshot(initial);
    save.active[0].rewards = { gold: 999999999 };
    save.active[0].completionPaths = [{
      id: 'defeat_bandits', requiredOutcome: null,
      rewards: { gold: 999999999 },
    }];
    const effects = [];
    const resumed = manager(effects);
    const report = restoreQuestSnapshot(resumed, save, { ...context, currentDay: 6 });
    expect(report).toMatchObject({ restored: 1, rejected: 0 });
    expect(resumed.activeQuests).toHaveLength(1);
    const loaded = resumed.activeQuests[0];
    const canonical = QUEST_DEFS.find((q) => q.id === 'secure_trade_route');
    expect(loaded.completionPaths[0].rewards).toEqual(canonical.completionPaths[0].rewards);
    expect(loaded.objectives[0].outcome).toBeUndefined();
    expect(loaded.pendingObjectiveClaims).toEqual([
      { objectiveId: 'resolve_bandit_threat', outcome: 'bandits_defeated' },
    ]);
    expect(resumed.completeQuest(loaded.id, 'defeat_bandits')).toBeUndefined();
    expect(effects).toEqual([]);
    // The outcome must be established AGAIN by real gameplay after the load.
    resumed.updateObjective(loaded.id, 'resolve_bandit_threat', 'bandits_defeated');
    expect(resumed.completeQuest(loaded.id, 'defeat_bandits')).toBe(true);
    expect(effects).toContainEqual({ type: 'change_player_gold', amount: 300 });
    expect(resumed.completeQuest(loaded.id, 'defeat_bandits')).toBeUndefined();
    expect(resumed.addQuest({ ...newQuest(), id: loaded.id })).toBe(false);
  });

  it('refuses forged source, unknown city/route, expired quest and future timestamps', () => {
    const questManager = manager();
    const quest = newQuest();
    questManager.addQuest(quest);
    questManager.activateQuest(quest.id);
    const valid = captureQuestSnapshot(questManager);
    for (const edit of [
      (s) => { s.active[0].templateId = 'fake_source'; },
      (s) => { s.active[0].targets.targetCityId = 'imaginary_city'; },
      (s) => { s.active[0].targets.targetRouteId = 'route:ghost:bursa'; },
      (s) => { s.active[0].createdAt = 40; },
      (s) => { s.active[0].status = 'deleted'; },
      (s) => { s.active[0].objectiveClaims = [
        { objectiveId: 'resolve_bandit_threat', outcome: 'forged_victory' },
      ]; },
    ]) {
      const forged = structuredClone(valid);
      edit(forged);
      const resumed = manager();
      restoreQuestSnapshot(resumed, forged, { ...context, currentDay: 8 });
      expect(resumed.activeQuests).toEqual([]);
    }
    const expired = structuredClone(valid);
    expect(restoreQuestSnapshot(manager(), expired, {
      ...context, currentDay: 25,
    }).rejected).toBe(1);
  });

  it('preserves completed/failed archival IDs, but NEVER executes their effects on hydration', () => {
    const effects = [];
    const old = manager(effects);
    const first = newQuest();
    old.addQuest(first);
    old.activateQuest(first.id);
    old.updateObjective(first.id, 'resolve_bandit_threat', 'bandits_defeated');
    old.completeQuest(first.id, 'defeat_bandits');
    const other = { ...newQuest(), id: 'quest_second_leg' };
    old.addQuest(other);
    old.activateQuest(other.id);
    old.failQuest(other.id, 'expired');
    const priorEffects = effects.length;
    const snap = captureQuestSnapshot(old);
    const resumedEffects = [];
    const target = manager(resumedEffects);
    restoreQuestSnapshot(target, snap, { ...context, currentDay: 8 });
    expect(target.activeQuests).toEqual([]);
    expect(target.completedQuests).toMatchObject([{
      id: first.id, status: 'completed', archived: true, objectives: [],
    }]);
    expect(target.failedQuests).toMatchObject([{
      id: other.id, status: 'failed', archived: true,
    }]);
    expect(resumedEffects).toEqual([]);
    expect(effects.length).toBe(priorEffects);
    expect(target.addQuest({ ...newQuest(), id: first.id })).toBe(false);
    expect(target.addQuest({ ...newQuest(), id: other.id })).toBe(false);
    expect(target.completeQuest(first.id, 'defeat_bandits')).toBeUndefined();
    expect(applyApprovedQuestCharacterOutcome({
      receipt: {
        questId: first.id, templateId: first.templateId,
        pathId: 'defeat_bandits', assignedCharacterId: 'npc:ghost:1',
      },
      questManager: target, rules: [{
        ruleId: 'fixture_rule', reviewStatus: 'approved',
        templateId: first.templateId, pathId: 'defeat_bandits',
      }], day: 8,
    }).applied).toBe(false);
  });

  it('restores same active quest and previously bound NamedCharacter only with matching live duty', () => {
    const f = setup();
    const managerBefore = new SaveManager(f.state);
    managerBefore.init(fakeGame(f.questManager));
    const clean = new SaveSystem().normalizePayload(
      JSON.parse(JSON.stringify(managerBefore.buildSavePayload())),
    );
    expect(clean.ok).toBe(true);
    expect(clean.data.game.questSnapshot.active).toHaveLength(1);
    expect(clean.data.game.characterQuestBindings.entries[0].status).toBe('active');
    const loadedState = { mode: 'map', map: { settlements } };
    const loadedQuestManager = manager();
    const loaded = new SaveManager(loadedState);
    loaded.init(fakeGame(loadedQuestManager));
    expect(loaded.applySavePayload(clean.data)).toBe(true);
    expect(loadedState.questRestoreReport).toMatchObject({
      restored: 1, rejected: 0, restoredBindings: 1,
    });
    const active = loadedQuestManager.activeQuests[0];
    expect(active.id).toBe(f.quest.id);
    expect(active.assignedCharacterId).toBe(f.actor.id);
    expect(loadedState.characterQuestBindings.entries[0].status).toBe('active');
    expect(new GameFlowManager(loadedState).getWorldCharacterQuestRecords(f.actor.id))
      .toHaveLength(1);
    expect(loadedQuestManager.completedQuests).toEqual([]);
    expect(loaded.game.playerParty.roster).toEqual([]);
  });

  it('holds V1.13 pre-snapshot bindings SUSPENDED, never invented or implicitly active', () => {
    const f = setup();
    const saved = new SaveManager(f.state);
    saved.init(fakeGame(f.questManager));
    const payload = saved.buildSavePayload();
    delete payload.game.questSnapshot; // Old V1.13 save
    const clean = new SaveSystem().normalizePayload(payload).data;
    const loadedState = { map: { settlements }, mode: 'map' };
    const loadedQuestManager = manager();
    const loaded = new SaveManager(loadedState);
    loaded.init(fakeGame(loadedQuestManager));
    expect(loaded.applySavePayload(clean)).toBe(true);
    expect(loadedQuestManager.activeQuests).toEqual([]);
    expect(loadedState.characterQuestBindings.entries[0].status).toBe('suspended');
    expect(loadedState.questRestoreReport.restoredBindings).toBe(0);
  });

  it('does not reactivate an ineligible, deceased or mismatched participant from a save', () => {
    const f = setup();
    const saved = new SaveManager(f.state);
    saved.init(fakeGame(f.questManager));
    const clean = new SaveSystem().normalizePayload(saved.buildSavePayload()).data;
    const scenarios = [
      (game) => { game.characterQuestBindings.entries[0].characterId = 'npc:ghost:1'; },
      (game) => { game.characterQuestBindings.entries[0].assignmentRole = 'false_role'; },
      (game) => { game.characterQuestBindings.entries[0].settlementId = 'bursa'; },
      (game) => { game.characterQuestBindings.entries[0].status = 'suspended'; },
    ];
    for (const patch of scenarios) {
      const copy = structuredClone(clean);
      patch(copy.game);
      const state = { map: { settlements }, mode: 'map' };
      const qm = manager();
      const loaded = new SaveManager(state);
      loaded.init(fakeGame(qm));
      expect(loaded.applySavePayload(copy)).toBe(true);
      expect(state.questRestoreReport.restored).toBe(1);
      expect(state.questRestoreReport.restoredBindings).toBe(0);
      expect(qm.activeQuests[0].assignedCharacterId).toBeUndefined();
    }
  });

  it('keeps full active-quest state out of the soldier/army roster and packed NPC save', () => {
    const f = setup();
    const save = new SaveManager(f.state);
    save.init(fakeGame(f.questManager));
    const data = save.buildSavePayload().game;
    expect(data.questSnapshot.active).toHaveLength(1);
    expect(data.roster).toEqual([]);
    expect(data.worldCharacters.format).toBe('seeded-delta-v1');
    expect(data.worldCharacters.characters).toBeUndefined();
    expect(JSON.stringify(data.questSnapshot)).not.toContain('characterSocial');
    expect(JSON.stringify(data.questSnapshot)).not.toContain('stats.experience');
  });
});
