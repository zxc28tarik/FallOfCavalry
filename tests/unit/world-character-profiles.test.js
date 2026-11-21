import { describe, expect, it, vi } from 'vitest';
import CityServicesUI from '../../js/ui/city-services.js';
import { changeNamedCharacterMetric } from '../../js/systems/named-character-state.js';
import {
  createWorldCharacterRoster,
  createWorldCharacterSave,
  getSettlementCharacters,
  getWorldCharacterAge,
  getWorldCharacterProfile,
  moveWorldCharacter,
  normalizeWorldCharacters, promoteWorldCharacter,
  restoreWorldCharacterSave,
  setWorldCharacterRelation,
} from '../../js/systems/world-characters.js';

const settlements = [
  { id: 'edirne', ownerFactionId: 'ottoman' },
  { id: 'venice', ownerFactionId: 'venice' },
];

function setup() {
  const roster = createWorldCharacterRoster({ seed: 42, settlements });
  return { roster, first: roster.characters.find((person) => person.location.settlementId === 'edirne') };
}

describe('Web world NPC profiles / read-only life stage', () => {
  it('derives age from campaign day without writing age changes to all NPCs', () => {
    const { first, roster } = setup();
    const before = JSON.stringify(roster);
    expect(getWorldCharacterAge(first, 1)).toBe(first.age);
    expect(getWorldCharacterAge(first, 365)).toBe(first.age);
    expect(getWorldCharacterAge(first, 366)).toBe(first.age + 1);
    expect(getWorldCharacterAge(first, 731)).toBe(first.age + 2);
    expect(getWorldCharacterAge(first, -5)).toBe(first.age);
    expect(getWorldCharacterAge(null, 400)).toBeNull();
    expect(JSON.stringify(roster)).toBe(before);
    expect(createWorldCharacterSave(roster, { seed: 42, settlements }).overrides).toHaveLength(0);
  });

  it('profile contains only explicit relationships, with stable identity and no invented kinship', () => {
    const { first, roster } = setup();
    const another = roster.characters.find((person) => person.id !== first.id);
    expect(getWorldCharacterProfile(roster, first.id)).toEqual({ person: first, age: first.age, relations: [] });
    expect(setWorldCharacterRelation(roster, first.id, another.id, -31)).toBe(true);
    const profile = getWorldCharacterProfile(roster, first.id, { day: 366 });
    expect(profile.person).toBe(first);
    expect(profile.age).toBe(first.age + 1);
    expect(profile.relations).toEqual([{ id: another.id, name: another.name, value: -31 }]);
    expect(getWorldCharacterProfile(roster, 'nonexistent')).toBeNull();
  });

  it('moves an NPC only to an existing settlement via explicit command', () => {
    const { first, roster } = setup();
    const oldId = first.id;
    expect(moveWorldCharacter(roster, first.id, 'fake-city', { settlements, day: 10 })).toBe(false);
    expect(moveWorldCharacter(roster, first.id, 'edirne', { settlements, day: 10 })).toBe(false);
    expect(moveWorldCharacter(roster, first.id, 'venice', { settlements, day: 0 })).toBe(false);
    expect(first.location.settlementId).toBe('edirne');
    expect(moveWorldCharacter(roster, first.id, 'venice', { settlements, day: 10 })).toBe(true);
    expect(first.id).toBe(oldId);
    expect(first.location).toEqual({ kind: 'settlement', settlementId: 'venice' });
    expect(first.history).toEqual([{ day: 1, type: 'created' }, { day: 10, type: 'moved', settlementId: 'venice' }]);
    expect(getSettlementCharacters(roster, 'edirne')).not.toContain(first);
    expect(getSettlementCharacters(roster, 'venice')).toContain(first);
    expect(moveWorldCharacter(roster, first.id, 'edirne', { settlements, day: 8 })).toBe(false);
    const delta = createWorldCharacterSave(roster, { seed: 42, settlements });
    expect(delta.format).toBe('seeded-delta-v1');
    expect(delta.overrides).toHaveLength(1);
    expect(restoreWorldCharacterSave(JSON.parse(JSON.stringify(delta)), { settlements })).toEqual(normalizeWorldCharacters(roster));
  });

  it('profile view shows all nine stats, traits, event history and explicit relations', () => {
    const { first, roster } = setup();
    const another = roster.characters.find((person) => person.id !== first.id);
    setWorldCharacterRelation(roster, first.id, another.id, 22);
    const ui = new CityServicesUI({ state: { worldCharacters: roster, day: 366 }, party: {} });
    ui.currentSettlement = settlements[0];
    const panel = { innerHTML: '' };
    const title = { textContent: '' };
    const meta = { innerHTML: '' };
    ui.dom = { cityPanelBody: panel, cityPanelTitle: title, cityPanelMeta: meta };
    ui.renderNpcProfile(first.id);
    expect(title.textContent).toContain(first.name);
    expect(meta.innerHTML).toContain('Sıradan dünya karakteri');
    expect(panel.innerHTML).toContain('Şehre dön');
    expect(panel.innerHTML).toContain('Rol profili');
    expect(panel.innerHTML).toContain('Zekâ');
    expect(panel.innerHTML).toContain('Tecrübe');
    expect(panel.innerHTML).toContain('Kişilik');
    expect(panel.innerHTML).toContain('Sadakat');
    expect(panel.innerHTML).toContain(another.name);
    expect(panel.innerHTML).toContain('+22');
    expect(panel.innerHTML).toContain('Gün 1');
    expect(panel.innerHTML).toContain(String(first.age + 1));
    expect(ui.currentView.type).toBe('overview');
  });

  it('renders the NamedCharacterState adapter with explicit current value and a safe event audit', () => {
    const { first, roster } = setup();
    expect(promoteWorldCharacter(roster, first.id, { day: 4 })).toBe(true);
    const newValue = first.reputation === 99 ? 98 : 99;
    expect(changeNamedCharacterMetric(roster, first.id, {
      metric: 'reputation', value: newValue, day: 8,
      reason: 'Visible audit reason & council',
    })).toBe(true);
    const ui = new CityServicesUI({
      state: { worldCharacters: roster, day: 8 }, party: {},
    });
    ui.currentSettlement = settlements[0];
    const panel = { innerHTML: '' };
    ui.dom = {
      cityPanelBody: panel, cityPanelTitle: { textContent: '' },
      cityPanelMeta: { innerHTML: '' },
    };
    ui.renderNpcProfile(first.id);
    expect(panel.innerHTML).toContain('Önemli karakter (D)');
    expect(panel.innerHTML).toContain('İtibar</span><strong>' + newValue + '/100');
    expect(panel.innerHTML).toContain('Özellik değişti');
    expect(panel.innerHTML).toContain('Visible audit reason &amp; council');
    expect(panel.innerHTML).not.toContain('Visible audit reason & council');
    expect(panel.innerHTML).toContain('Gün 8');
    expect(panel.innerHTML).toContain('Gün 4');
  });

  it('city click selects only real resident NPC; unknown character does not open a profile', () => {
    const { first, roster } = setup();
    const state = { worldCharacters: roster, day: 1 };
    const ui = new CityServicesUI({ state, party: {} });
    ui.currentSettlement = settlements[0];
    let onClick;
    const target = { addEventListener: vi.fn((name, handler) => { if (name === 'click') onClick = handler; }) };
    ui.bind({ cityPanelBody: target });
    ui.render = vi.fn();
    const click = (id) => onClick({
      target: { closest: () => ({ dataset: { action: 'open-npc', id } }) },
    });
    click('unknown');
    expect(ui.currentView.type).toBe('overview');
    click(first.id);
    expect(ui.currentView).toEqual({ type: 'npc', npcId: first.id });
    ui.currentView = { type: 'overview' };
    const outsider = roster.characters.find((person) => person.location.settlementId === 'venice');
    click(outsider.id);
    expect(ui.currentView.type).toBe('overview');
    expect(ui.render).toHaveBeenCalled();
  });

  it('escapes untrusted character display strings in the HTML panel', () => {
    const { first, roster } = setup();
    first.name = '<img src=x onerror=alert(1)>';
    const ui = new CityServicesUI({ state: { worldCharacters: roster, day: 1 }, party: {} });
    ui.currentSettlement = settlements[0];
    const panel = { innerHTML: '' };
    const title = { textContent: '' };
    ui.dom = { cityPanelBody: panel, cityPanelTitle: title, cityPanelMeta: { innerHTML: '' } };
    ui.renderNpcProfile(first.id);
    expect(panel.innerHTML).not.toContain('<img');
    expect(panel.innerHTML).toContain('&lt;img');
    expect(title.textContent).toBe('Karakter: <img src=x onerror=alert(1)>');
  });
});
