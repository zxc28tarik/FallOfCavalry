import { describe, expect, it, vi } from 'vitest';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { applyApprovedQuestCharacterOutcome } from '../../js/systems/character-quest-events.js';
import { AUTHORED_CHARACTER_QUEST_OUTCOME_RULES } from '../../js/data/character-quest-outcome-rules.js';
import {
  createWorldCharacterRoster, createWorldCharacterSave, promoteWorldCharacter,
  normalizeWorldCharacters, restoreWorldCharacterSave,
} from '../../js/systems/world-characters.js';
import {
  emptyCharacterOrganizationState, startCharacterAssignment,
} from '../../js/systems/character-organization.js';
import { getNamedCharacterState } from '../../js/systems/named-character-state.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];
function fixture() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const actor = roster.characters[0];
  const other = roster.characters[1];
  expect(promoteWorldCharacter(roster, actor.id, { day: 3 })).toBe(true);
  const organization = emptyCharacterOrganizationState();
  expect(startCharacterAssignment(organization, actor.id, {
    roster, settlements, branch: 'city_administration',
    assignmentRole: 'quest_agent',
    assignmentLocation: { kind: 'settlement', settlementId: 'edirne' },
    reason: 'Explicit campaign task assignment', day: 6,
  })).toBe(true);
  const effects = [];
  const manager = new QuestManager({ pushOverlay: vi.fn() }, {
    applyEffect: (e) => effects.push(e),
  }, { generateFromTemplate: () => null });
  const quest = {
    id: 'quest_qa1', templateId: 'secure_trade_route', status: 'active',
    assignedCharacterId: actor.id, targetCityId: 'edirne',
    objectives: [{ id: 'resolve_bandit_threat', outcome: 'bandits_defeated' }],
    completionPaths: [{
      id: 'defeat_bandits', requiredOutcome: 'bandits_defeated',
      rewards: { gold: 300, reputation: 3 }, worldEffects: [],
    }],
  };
  const rule = {
    ruleId: 'rule:qa-command',
    reviewStatus: 'approved', templateId: 'secure_trade_route',
    pathId: 'defeat_bandits',
    assignmentBranch: 'city_administration',
    assignmentRole: 'quest_agent',
    metric: 'stats.experience', delta: 1,
    reason: 'Explicit completed task credit',
  };
  manager.addQuest(quest);
  const receipt = () => ({
    questId: quest.id, templateId: quest.templateId,
    pathId: 'defeat_bandits', assignedCharacterId: quest.assignedCharacterId,
  });
  const apply = (options = {}) => applyApprovedQuestCharacterOutcome({
    receipt: receipt(), questManager: manager, roster,
    characterOrganization: organization, day: 8, rules: [rule],
    ...options,
  });
  return { roster, actor, other, organization, effects, manager, quest, rule, receipt, apply };
}

describe('WEB V1.12: completion authority to explicit character outcome, no automatic bonuses', () => {
  it('ships with NO unauthorized skill, influence, reputation or loyalty awards', () => {
    expect(AUTHORED_CHARACTER_QUEST_OUTCOME_RULES).toEqual([]);
    const f = fixture();
    const before = JSON.stringify(f.roster);
    const observed = [];
    f.manager.onQuestCompleted = (receipt) => {
      observed.push(receipt);
      return applyApprovedQuestCharacterOutcome({
        receipt, questManager: f.manager, roster: f.roster,
        characterOrganization: f.organization, day: 8,
      });
    };
    expect(f.manager.completeQuest(f.quest.id, 'defeat_bandits')).toBe(true);
    expect(observed).toHaveLength(1);
    expect(observed[0]).toEqual(f.receipt());
    expect(f.manager.completedQuests).toHaveLength(1);
    expect(JSON.stringify(f.roster)).toBe(before);
    expect(f.effects).toEqual([
      { type: 'change_player_gold', amount: 300 },
      { type: 'change_player_reputation', amount: 3 },
    ]);
    expect(f.manager.completeQuest(f.quest.id, 'defeat_bandits')).toBeUndefined();
    expect(observed).toHaveLength(1);
  });

  it('applies a fixture-only fully reviewed rule after actual completion with matching assigned named actor', () => {
    const f = fixture();
    const original = structuredClone(f.actor);
    const results = [];
    f.manager.onQuestCompleted = (receipt) => results.push(f.apply({ receipt }));
    expect(f.manager.completeQuest(f.quest.id, 'defeat_bandits')).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      status: 'applied', applied: true, characterId: f.actor.id,
      metric: 'stats.experience', from: original.stats.experience,
      to: original.stats.experience + 1,
    });
    expect(f.actor.stats.experience).toBe(original.stats.experience + 1);
    expect(f.actor.name).toBe(original.name);
    expect(f.actor.cultureId).toBe(original.cultureId);
    expect(f.actor.originFactionId).toBe(original.originFactionId);
    expect(f.actor.importance).toBe(original.importance);
    expect(f.actor.history.at(-1)).toMatchObject({
      day: 8, metric: 'stats.experience',
      from: original.stats.experience, to: original.stats.experience + 1,
    });
    const delta = createWorldCharacterSave(f.roster, { seed: 1648, settlements });
    expect(delta.format).toBe('seeded-delta-v1');
    const restored = restoreWorldCharacterSave(delta, { settlements });
    expect(restored).toEqual(normalizeWorldCharacters(f.roster));
    expect(f.apply().status).toBe('already_applied');
  });

  it('refuses a forged event, a noncompleted quest, wrong outcome, or a wrong participant', () => {
    const f = fixture();
    const prior = JSON.stringify(f.roster);
    expect(f.apply()).toEqual({ status: 'unverified_completion', applied: false });
    expect(f.manager.completeQuest(f.quest.id, 'not-an-official-path')).toBeUndefined();
    expect(f.manager.completedQuests).toHaveLength(0);
    expect(f.apply()).toEqual({ status: 'unverified_completion', applied: false });
    expect(f.manager.completeQuest(f.quest.id, 'defeat_bandits')).toBe(true);
    expect(f.apply({ receipt: { ...f.receipt(), assignedCharacterId: f.other.id } }))
      .toEqual({ status: 'unverified_completion', applied: false });
    expect(f.apply({ receipt: { ...f.receipt(), pathId: 'intimidate_bandits' } }))
      .toEqual({ status: 'unverified_completion', applied: false });
    expect(JSON.stringify(f.roster)).toBe(prior);

    const f2 = fixture();
    f2.quest.objectives[0].outcome = 'bandits_intimidated';
    expect(f2.manager.completeQuest(f2.quest.id, 'defeat_bandits')).toBeUndefined();
    expect(f2.apply().status).toBe('unverified_completion');
  });

  it('requires an ACTIVE actual organization assignment and the real destination', () => {
    const f = fixture();
    f.manager.completeQuest(f.quest.id, 'defeat_bandits');
    expect(f.apply({ characterOrganization: emptyCharacterOrganizationState() }).status)
      .toBe('missing_active_assignment');
    const mismatched = structuredClone(f.organization);
    mismatched.assignments[0].assignmentRole = 'army_commander';
    expect(f.apply({ characterOrganization: mismatched }).status)
      .toBe('missing_active_assignment');
    const cityMismatch = structuredClone(f.organization);
    cityMismatch.assignments[0].assignmentLocation.settlementId = 'bursa';
    expect(f.apply({ characterOrganization: cityMismatch }).status)
      .toBe('assignment_location_mismatch');
    expect(f.actor.history.filter((e) => e.type === 'state-changed')).toHaveLength(0);
  });

  it('rejects unreviewed, duplicated, invalid or over-range game rules', () => {
    const f = fixture();
    f.manager.completeQuest(f.quest.id, 'defeat_bandits');
    expect(f.apply({ rules: [] }).status).toBe('no_approved_rules');
    expect(f.apply({ rules: [{ ...f.rule, reviewStatus: 'draft' }] }).status)
      .toBe('no_matching_rule');
    expect(f.apply({ rules: [f.rule, { ...f.rule }] }).status)
      .toBe('ambiguous_policy');
    for (const broken of [
      { metric: 'age' }, { metric: 'stats.__proto__' },
      { delta: 0 }, { delta: 101 }, { delta: 1.5 },
      { assignmentBranch: 'invented_network' }, { reason: '<script>' },
    ]) {
      expect(f.apply({ rules: [{ ...f.rule, ...broken }] }).status).toBe('invalid_rule');
    }
    expect(f.actor.history.filter((e) => e.type === 'state-changed')).toHaveLength(0);
  });

  it('rejects dead and transient generated people even after a valid quest completion', () => {
    const f = fixture();
    f.manager.completeQuest(f.quest.id, 'defeat_bandits');
    f.actor.status = 'dead';
    expect(f.apply().status).toBe('unavailable_actor');
    const f2 = fixture();
    f2.quest.assignedCharacterId = f2.other.id;
    f2.manager.completeQuest(f2.quest.id, 'defeat_bandits');
    expect(f2.apply().status).toBe('unavailable_actor');
  });

  it('never clips values or invents balance rules at the 0–100 boundary', () => {
    const f = fixture();
    f.manager.completeQuest(f.quest.id, 'defeat_bandits');
    f.actor.stats.experience = 100;
    expect(f.apply().status).toBe('out_of_range');
    expect(f.actor.stats.experience).toBe(100);
  });

  it('optional observer failure cannot undo actual gold, player reputation, completed quest, or chain', () => {
    const f = fixture();
    f.manager.onQuestCompleted = () => { throw new Error('Test observer exception'); };
    expect(f.manager.completeQuest(f.quest.id, 'defeat_bandits')).toBe(true);
    expect(f.manager.lastCompletionObserverError).toContain('Test observer exception');
    expect(f.manager.activeQuests).toHaveLength(0);
    expect(f.manager.completedQuests).toHaveLength(1);
    expect(f.effects).toHaveLength(2);
  });

  it('the real GameFlowManager observer remains inert without approved rules', () => {
    const f = fixture();
    const state = {
      day: 8, worldCharacters: f.roster,
      characterOrganization: f.organization,
    };
    const flow = new GameFlowManager(state);
    flow.init({ questManager: f.manager, settings: {} });
    const before = JSON.stringify(f.roster);
    f.manager.onQuestCompleted = (receipt) => flow.applyVerifiedQuestCharacterOutcome(receipt);
    expect(f.manager.completeQuest(f.quest.id, 'defeat_bandits')).toBe(true);
    expect(JSON.stringify(f.roster)).toBe(before);
    expect(f.manager.lastCompletionObserverError).toBeNull();
  });
});
