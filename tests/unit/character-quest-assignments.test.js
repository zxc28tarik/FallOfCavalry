import { describe, expect, it, vi } from 'vitest';
import {
  bindNamedCharacterToQuest, emptyCharacterQuestBindings,
  normalizeCharacterQuestBindings, recordNamedCharacterQuestResult,
  getNamedCharacterQuestRecords,
} from '../../js/systems/character-quest-assignments.js';
import { emptyCharacterOrganizationState, startCharacterAssignment } from '../../js/systems/character-organization.js';
import { createWorldCharacterRoster, promoteWorldCharacter } from '../../js/systems/world-characters.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];
const QUEST_ID = 'quest_qa_1';

function fixture({ withAppointment = true, targetCityId = 'edirne' } = {}) {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const [person, generated] = roster.characters;
  expect(promoteWorldCharacter(roster, person.id, { day: 3 })).toBe(true);
  const organization = emptyCharacterOrganizationState();
  if (withAppointment) {
    expect(startCharacterAssignment(organization, person.id, {
      roster, settlements, branch: 'city_administration',
      assignmentRole: 'quest_agent',
      assignmentLocation: { kind: 'settlement', settlementId: 'edirne' },
      day: 4, reason: 'Explicit mission representative',
    })).toBe(true);
  }
  const results = [];
  const manager = new QuestManager({ pushOverlay: vi.fn() }, {
    applyEffect: (effect) => results.push(effect),
  }, { generateFromTemplate: () => null });
  const quest = {
    id: QUEST_ID, templateId: 'secure_trade_route', status: 'active',
    targetCityId, objectives: [{ id: 'resolve_bandit_threat', outcome: 'bandits_defeated' }],
    completionPaths: [{
      id: 'defeat_bandits', requiredOutcome: 'bandits_defeated',
      rewards: { gold: 300, reputation: 3 }, worldEffects: [],
    }],
  };
  manager.addQuest(quest);
  const state = {
    mode: 'map', day: 8, seed: 1648,
    map: { settlements }, worldCharacters: roster,
    characterOrganization: organization,
    characterQuestBindings: emptyCharacterQuestBindings(),
  };
  const flow = new GameFlowManager(state);
  flow.init({ settings: {}, questManager: manager });
  manager.onQuestCompleted = (receipt) => flow.applyVerifiedQuestCharacterOutcome(receipt);
  manager.onQuestFailed = (receipt) => flow.recordVerifiedQuestCharacterFailure(receipt);
  return { roster, person, generated, organization, results, quest, manager, state, flow };
}

const bind = (f, personId = f.person.id) =>
  f.flow.assignWorldCharacterToQuest(QUEST_ID, personId, {
    reason: 'Explicit council assignment to this quest',
  });
const fakeGame = (questManager) => ({
  questManager, playerParty: { gold: 100, roster: [] },
  settings: {}, itemCatalog: [],
  worldManager: {
    enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
    lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
  },
  ensureInventoryModel: () => {}, ensureRosterState: () => {},
});

describe('Character System v2 V1.13: real NamedCharacter <-> actual quest binding', () => {
  it('keeps new/legacy campaign empty without inventing participants or roles', () => {
    const f = fixture();
    expect(f.state.characterQuestBindings).toEqual({ version: 1, entries: [] });
    expect(f.quest.assignedCharacterId).toBeUndefined();
    expect(f.flow.getWorldCharacterQuestRecords(f.person.id)).toEqual([]);
    expect(f.flow.getWorldCharacterQuestRecords(f.generated.id)).toBeNull();
    expect(normalizeCharacterQuestBindings(undefined)).toEqual(emptyCharacterQuestBindings());
    expect(new SaveSystem().normalizePayload({ schemaVersion: 1, game: {} })
      .data.game.characterQuestBindings).toEqual(emptyCharacterQuestBindings());
  });

  it('binds only a real active quest to living Named with an existing location-matching active duty', () => {
    const f = fixture();
    const before = JSON.stringify(f.roster);
    expect(bind(f)).toBe(true);
    expect(f.quest.assignedCharacterId).toBe(f.person.id);
    expect(f.flow.getWorldCharacterQuestRecords(f.person.id)).toEqual([{
      questId: QUEST_ID, templateId: 'secure_trade_route',
      characterId: f.person.id, branch: 'city_administration',
      assignmentRole: 'quest_agent', settlementId: 'edirne', assignedDay: 8,
      reason: 'Explicit council assignment to this quest', status: 'active',
    }]);
    expect(bind(f)).toBe(false);
    expect(f.flow.assignWorldCharacterToQuest(QUEST_ID, f.generated.id, {
      reason: 'Generated cannot join',
    })).toBe(false);
    expect(JSON.stringify(f.roster)).toBe(before);
    // Branch membership is independent and remains empty.
    expect(f.organization.memberships).toEqual([]);
    expect(f.state.characterOrganization).toEqual(f.organization);
  });

  it('refuses missing quest, generated/dead/unknown person, missing duty or wrong location atomically', () => {
    const f = fixture({ withAppointment: false });
    const original = JSON.stringify(f.state);
    expect(bind(f)).toBe(false);
    expect(JSON.stringify(f.state)).toBe(original);
    const g = fixture({ targetCityId: 'bursa' });
    expect(bind(g)).toBe(false);
    expect(g.quest.assignedCharacterId).toBeUndefined();
    expect(g.state.characterQuestBindings.entries).toEqual([]);
    const h = fixture();
    h.quest.status = 'available';
    expect(bind(h)).toBe(false);
    h.quest.status = 'active';
    expect(h.flow.assignWorldCharacterToQuest('quest_missing', h.person.id, {
      reason: 'Forged or missing quest',
    })).toBe(false);
    expect(bind(h, h.generated.id)).toBe(false);
    expect(bind(h, 'npc:imaginary:1')).toBe(false);
    h.person.status = 'dead';
    expect(bind(h)).toBe(false);
    expect(h.state.characterQuestBindings.entries).toEqual([]);
    const forged = fixture();
    forged.quest.templateId = 'fictional_quest_template';
    expect(bind(forged)).toBe(false);
    expect(forged.quest.assignedCharacterId).toBeUndefined();
  });

  it('tracks a real completed path only once while keeping player reward vs NPC stat separate', () => {
    const f = fixture();
    const before = JSON.stringify(f.roster);
    expect(bind(f)).toBe(true);
    expect(f.manager.completeQuest(QUEST_ID, 'defeat_bandits')).toBe(true);
    expect(f.results).toEqual([
      { type: 'change_player_gold', amount: 300 },
      { type: 'change_player_reputation', amount: 3 },
    ]);
    expect(f.state.characterQuestBindings.entries[0]).toMatchObject({
      status: 'completed', pathId: 'defeat_bandits', endedDay: 8,
      characterId: f.person.id,
    });
    expect(f.flow.getWorldCharacterQuestRecords(f.person.id)[0].status).toBe('completed');
    expect(JSON.stringify(f.roster)).toBe(before);
    expect(f.manager.completeQuest(QUEST_ID, 'defeat_bandits')).toBeUndefined();
    expect(f.state.characterQuestBindings.entries).toHaveLength(1);
  });

  it('does not treat an unbound/forged receipt as the assigned NPC even for an existing completed quest', () => {
    const f = fixture();
    f.quest.assignedCharacterId = f.person.id; // simulate a forged external quest object
    expect(f.manager.completeQuest(QUEST_ID, 'defeat_bandits')).toBe(true);
    expect(f.state.characterQuestBindings.entries).toEqual([]);
    expect(f.flow.applyVerifiedQuestCharacterOutcome({
      questId: QUEST_ID, templateId: 'secure_trade_route',
      pathId: 'defeat_bandits', assignedCharacterId: f.person.id,
    }).status).toBe('unbound_quest');
  });

  it('records a genuine quest failure, including expiration, without stat changes', () => {
    const f = fixture();
    expect(bind(f)).toBe(true);
    expect(f.manager.failQuest(QUEST_ID, 'mission-failed')).toBe(true);
    expect(f.state.characterQuestBindings.entries[0]).toMatchObject({
      status: 'failed', endReason: 'mission-failed', endedDay: 8,
    });
    expect(f.results).toEqual([]);
    const g = fixture();
    expect(bind(g)).toBe(true);
    g.quest.createdAt = 1;
    g.quest.timeLimitDays = 4;
    g.manager.expireQuests(8);
    expect(g.state.characterQuestBindings.entries[0]).toMatchObject({
      status: 'failed', endReason: 'expired', endedDay: 8,
    });
  });

  it('refuses fake completion or failure results, repeat mutations, and backdated entries', () => {
    const f = fixture();
    expect(bind(f)).toBe(true);
    const input = f.state.characterQuestBindings;
    const before = JSON.stringify(input);
    expect(recordNamedCharacterQuestResult(input, {
      questId: QUEST_ID, templateId: 'secure_trade_route',
      assignedCharacterId: f.person.id, pathId: 'defeat_bandits',
    }, { questManager: f.manager, day: 8, outcome: 'completed' })).toBe(false);
    expect(recordNamedCharacterQuestResult(input, {
      questId: QUEST_ID, templateId: 'secure_trade_route',
      assignedCharacterId: f.person.id, reason: 'expired',
    }, { questManager: f.manager, day: 8, outcome: 'failed' })).toBe(false);
    expect(recordNamedCharacterQuestResult(input, {}, {
      questManager: f.manager, day: 1, outcome: 'completed',
    })).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('persists completion history but SUSPENDS live quests across a save without quest hydration', () => {
    const f = fixture();
    expect(bind(f)).toBe(true);
    const manager = new SaveManager(f.state);
    manager.init(fakeGame(f.manager));
    const raw = manager.buildSavePayload();
    expect(raw.game.characterQuestBindings.entries[0].status).toBe('active');
    expect(raw.game.worldCharacters.format).toBe('seeded-delta-v1');
    const normalized = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(raw)));
    expect(normalized.ok).toBe(true);
    expect(normalized.data.game.characterQuestBindings.entries[0].status).toBe('active');
    const newState = { map: { settlements }, mode: 'map' };
    const load = new SaveManager(newState);
    load.init(fakeGame(new QuestManager()));
    expect(load.applySavePayload(normalized.data)).toBe(true);
    expect(newState.characterQuestBindings.entries[0].status).toBe('suspended');
    expect(newState.characterQuestBindings.entries[0].characterId).toBe(f.person.id);
    const loadedFlow = new GameFlowManager(newState);
    expect(loadedFlow.getWorldCharacterQuestRecords(f.person.id)[0].status).toBe('suspended');
    expect(loadedFlow.applyVerifiedQuestCharacterOutcome({
      questId: QUEST_ID, templateId: 'secure_trade_route',
      pathId: 'defeat_bandits', assignedCharacterId: f.person.id,
    }).status).toBe('unbound_quest');
    expect(load.game.playerParty.roster).toEqual([]);
    expect(f.state.characterQuestBindings.entries[0].status).toBe('active');
    // Now complete an ORIGINAL game session and retain its historical receipt.
    expect(f.manager.completeQuest(QUEST_ID, 'defeat_bandits')).toBe(true);
    const finishedSave = new SaveSystem().normalizePayload(
      manager.buildSavePayload(),
    ).data;
    const loadedFinish = new SaveManager({ map: { settlements }, mode: 'map' });
    loadedFinish.init(fakeGame(new QuestManager()));
    expect(loadedFinish.applySavePayload(finishedSave)).toBe(true);
    expect(loadedFinish.state.characterQuestBindings.entries[0].status).toBe('completed');
    expect(loadedFinish.state.characterQuestBindings.entries[0].pathId)
      .toBe('defeat_bandits');
  });

  it('filters fabricated save IDs/duplicates/invalid roles and never grants active authority', () => {
    const f = fixture();
    expect(bind(f)).toBe(true);
    const forged = structuredClone(f.state.characterQuestBindings);
    forged.entries.push({ ...forged.entries[0] });
    forged.entries.push({ ...forged.entries[0], questId: 'quest_ghost',
      characterId: 'npc:ghost:1' });
    forged.entries.push({ ...forged.entries[0], questId: 'quest_wrong',
      settlementId: 'fake-city' });
    forged.entries.push({ ...forged.entries[0], questId: 'quest_inject',
      assignmentRole: '<script>' });
    const normalized = normalizeCharacterQuestBindings(forged, {
      roster: f.roster, settlements, forLoad: true,
    });
    expect(normalized.entries).toHaveLength(1);
    expect(normalized.entries[0].status).toBe('suspended');
    expect(normalizeCharacterQuestBindings({ entries: [
      { ...forged.entries[0], status: 'completed' },
    ] }, { roster: f.roster }).entries).toEqual([]);
  });
});
