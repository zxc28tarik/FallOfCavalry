import { describe, expect, it, vi } from 'vitest';
import { createWorldCharacterRoster, promoteWorldCharacter } from '../../js/systems/world-characters.js';
import { emptyCharacterOrganizationState, startCharacterAssignment } from '../../js/systems/character-organization.js';
import { emptyCharacterQuestBindings, bindNamedCharacterToQuest } from '../../js/systems/character-quest-assignments.js';
import { getCharacterQuestAssignmentView } from '../../js/ui/character-quest-assignment-view.js';
import CityServicesUI from '../../js/ui/city-services.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];

function fixture({ duty = true } = {}) {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const actor = roster.characters.find((person) => person.location?.settlementId === 'edirne');
  promoteWorldCharacter(roster, actor.id, { day: 3 });
  const organization = emptyCharacterOrganizationState();
  if (duty) {
    expect(startCharacterAssignment(organization, actor.id, {
      roster, settlements, branch: 'city_administration',
      assignmentRole: 'quest_agent',
      assignmentLocation: { kind: 'settlement', settlementId: 'edirne' },
      day: 4, reason: 'Explicit town office assignment',
    })).toBe(true);
  }
  const bindings = emptyCharacterQuestBindings();
  const quest = {
    id: 'quest_ui_1', templateId: 'secure_trade_route', status: 'active',
    title: 'Trade route security',
    targetCityId: 'edirne', assignedCharacterId: null,
  };
  const questManager = { activeQuests: [quest] };
  const inputs = {
    roster, characterOrganization: organization, characterQuestBindings: bindings,
    questManager, settlements, characterId: actor.id, settlementId: 'edirne', day: 8,
  };
  return { actor, roster, organization, bindings, quest, questManager, inputs };
}

describe('WEB V1.15: city quest assignment read model', () => {
  it('shows a real active task and Named duty without making a new appointment', () => {
    const f = fixture();
    const prior = JSON.stringify(f.inputs);
    const view = getCharacterQuestAssignmentView(f.inputs);
    expect(view.status).toBe('ready');
    expect(view.duty.assignmentRole).toBe('quest_agent');
    expect(view.quests).toEqual([{
      id: 'quest_ui_1', title: 'Trade route security',
      templateId: 'secure_trade_route', eligible: true, reason: null,
    }]);
    expect(JSON.stringify(f.inputs)).toBe(prior);
    expect(f.organization.memberships).toEqual([]);
  });

  it('never offers assignments to GeneratedPerson, dead Named or actors with no duty', () => {
    const f = fixture({ duty: false });
    expect(getCharacterQuestAssignmentView(f.inputs).status).toBe('no_active_duty');
    expect(getCharacterQuestAssignmentView(f.inputs).quests[0].eligible).toBe(false);
    expect(f.organization.assignments).toEqual([]);
    expect(getCharacterQuestAssignmentView({
      ...f.inputs, characterId: f.roster.characters[1].id,
    })).toMatchObject({ status: 'not_named', quests: [] });
    f.actor.status = 'dead';
    expect(getCharacterQuestAssignmentView(f.inputs).status).toBe('not_alive');
  });

  it('hides fabricated templates and wrong-city quests and disables assigned quests', () => {
    const f = fixture();
    f.questManager.activeQuests.push({
      id: 'quest_forged', templateId: 'magic_quest', status: 'active', targetCityId: 'edirne',
    }, {
      id: 'quest_wrong_city', templateId: 'secure_trade_route',
      status: 'active', targetCityId: 'bursa',
    });
    expect(getCharacterQuestAssignmentView(f.inputs).quests.map((q) => q.id))
      .toEqual(['quest_ui_1']);
    f.quest.assignedCharacterId = f.actor.id;
    expect(getCharacterQuestAssignmentView(f.inputs).quests[0])
      .toMatchObject({ eligible: false });
  });

  it('disables a quest after a genuine binding and retains the history', () => {
    const f = fixture();
    expect(bindNamedCharacterToQuest({
      questManager: f.questManager, bindings: f.bindings, roster: f.roster,
      characterOrganization: f.organization, settlements,
      questId: f.quest.id, characterId: f.actor.id, day: 8,
      reason: 'Explicit mission appointment',
    })).toBe(true);
    const view = getCharacterQuestAssignmentView(f.inputs);
    expect(view.quests[0].eligible).toBe(false);
    expect(view.history).toHaveLength(1);
    expect(view.history[0]).toMatchObject({ status: 'active', questId: f.quest.id });
  });

  it('keeps an explicit two-step UI confirmation and sends the reason only to the callback', () => {
    const f = fixture();
    const onAssignQuest = vi.fn().mockReturnValue(true);
    const handlers = {};
    const panel = {
      innerHTML: '',
      addEventListener: (type, listener) => { handlers[type] = listener; },
    };
    const ui = new CityServicesUI({
      state: {
        day: 8, worldCharacters: f.roster,
        characterOrganization: f.organization, characterQuestBindings: f.bindings,
        map: { settlements },
      },
      party: {}, getQuestManager: () => f.questManager, onAssignQuest,
    });
    ui.bind({ cityPanelBody: panel, cityPanelTitle: {}, cityPanelMeta: {} });
    ui.currentSettlement = settlements[0];
    ui.currentView = { type: 'npc', npcId: f.actor.id };
    ui.render = () => ui.renderNpcProfile(f.actor.id);
    ui.render();
    expect(panel.innerHTML).toContain('Bu göreve ata');
    expect(panel.innerHTML).not.toContain('Atamayı onayla');
    expect(onAssignQuest).not.toHaveBeenCalled();

    handlers.click({
      target: { closest: () => ({
        dataset: { action: 'stage-npc-quest', id: f.quest.id },
      }) },
    });
    expect(panel.innerHTML).toContain('Atamayı onayla');
    expect(onAssignQuest).not.toHaveBeenCalled();

    handlers.click({
      target: { closest: () => ({
        dataset: { action: 'confirm-npc-quest', id: f.quest.id },
        closest: () => ({ querySelector: () => ({ value: 'Explicit player assignment' }) }),
      }) },
    });
    expect(onAssignQuest).toHaveBeenCalledTimes(1);
    expect(onAssignQuest).toHaveBeenCalledWith(
      f.quest.id, f.actor.id, 'Explicit player assignment',
    );
    expect(ui.questAssignmentFeedback).toContain('kaydedildi');
  });
});
