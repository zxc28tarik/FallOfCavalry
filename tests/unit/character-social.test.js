import { describe, expect, it } from 'vitest';
import {
  emptyCharacterSocialState, normalizeCharacterSocialState,
  linkCharacterToExistingHouse, linkCharacterToExistingClique,
  linkExistingHouseToClique, getCharacterSocialProfile,
} from '../../js/systems/character-social.js';
import {
  createWorldCharacterRoster, createWorldCharacterSave,
  normalizeWorldCharacters, promoteWorldCharacter,
} from '../../js/systems/world-characters.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];

function fixture() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const [person, leader] = roster.characters;
  promoteWorldCharacter(roster, person.id, { day: 3 });
  promoteWorldCharacter(roster, leader.id, { day: 3 });
  // These are explicit TEST FIXTURES, not a runtime historical family dataset.
  const social = {
    version: 1,
    houses: [{ houseId: 'house:test', houseName: 'Test Hanesi',
      houseHeadCharacterId: person.id }],
    cliques: [{ cliqueId: 'clique:test', cliqueName: 'Test Sosyal Çevresi',
      cliqueType: null, parentCliqueId: null, leaderCharacterId: leader.id,
      centerCityId: 'edirne' }],
    houseMemberships: [], cliqueMemberships: [], houseCliqueLinks: [],
  };
  return { roster, person, leader, social };
}

function game() {
  return {
    playerParty: { gold: 20, roster: [] }, settings: {}, itemCatalog: [],
    worldManager: {
      enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
      lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
    }, ensureRosterState: () => {}, ensureInventoryModel: () => {},
  };
}

describe('Character v2: distinct HouseState/CliqueState connections and safe campaign persistence', () => {
  it('starts with no fictional houses/cliques; refuses unknown social group IDs', () => {
    const { roster, person } = fixture();
    const state = emptyCharacterSocialState();
    const before = JSON.stringify(state);
    expect(state).toEqual({ version: 1, houses: [], cliques: [],
      houseMemberships: [], cliqueMemberships: [], houseCliqueLinks: [] });
    expect(linkCharacterToExistingHouse(state, person.id, 'house:phantom', {
      roster, day: 7, reason: 'Not in registry',
    })).toBe(false);
    expect(linkCharacterToExistingClique(state, person.id, 'clique:phantom', {
      roster, day: 7, reason: 'Not in registry',
    })).toBe(false);
    expect(linkExistingHouseToClique(state, 'house:phantom', 'clique:phantom', {
      day: 7, reason: 'No entities',
    })).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('links an explicit family and social circle without converting family into faction/clique', () => {
    const { roster, person, leader, social } = fixture();
    const state = normalizeCharacterSocialState(social, { roster, settlements });
    expect(getCharacterSocialProfile(state, person.id, { roster }).headedHouses)
      .toEqual(['house:test']);
    expect(linkCharacterToExistingHouse(state, person.id, 'house:test', {
      roster, day: 7, reason: 'Documented household member',
    })).toBe(true);
    expect(linkCharacterToExistingClique(state, leader.id, 'clique:test', {
      roster, day: 7, reason: 'Documented clique member',
    })).toBe(true);
    expect(linkExistingHouseToClique(state, 'house:test', 'clique:test', {
      day: 7, reason: 'Explicit house-clique link',
    })).toBe(true);
    expect(linkCharacterToExistingHouse(state, person.id, 'house:test', {
      roster, day: 8, reason: 'Duplicate not allowed',
    })).toBe(false);
    const profile = getCharacterSocialProfile(state, person.id, { roster, settlements });
    expect(profile.houseMemberships).toHaveLength(1);
    expect(profile.cliqueMemberships).toEqual([]);
    expect(profile.houseCliqueLinks).toHaveLength(1);
    expect(getCharacterSocialProfile(state, leader.id, { roster }).cliqueMemberships)
      .toHaveLength(1);
    expect(roster.characters).toHaveLength(4);
  });

  it('rejects generated persons, dead new members, forged reasons and missing group records', () => {
    const { roster, person, social } = fixture();
    const generated = roster.characters.find((p) => p.kind === 'generated');
    const state = normalizeCharacterSocialState(social, { roster, settlements });
    const before = JSON.stringify(state);
    for (const [personId, groupId, reason] of [
      [generated.id, 'house:test', 'Generated ignored'],
      ['npc:ghost:1', 'house:test', 'Missing person'],
      [person.id, 'house:missing', 'Missing house'],
      [person.id, 'house:test', '<script>alert(1)</script>'],
    ]) {
      expect(linkCharacterToExistingHouse(state, personId, groupId, {
        roster, day: 8, reason,
      })).toBe(false);
    }
    expect(JSON.stringify(state)).toBe(before);
    person.status = 'dead';
    expect(linkCharacterToExistingHouse(state, person.id, 'house:test', {
      roster, day: 8, reason: 'Dead actor cannot join',
    })).toBe(false);
  });

  it('preserves deceased important character links; unsafe and duplicated save references are dropped', () => {
    const { roster, person, social } = fixture();
    const candidate = structuredClone(social);
    candidate.houses.push({ houseId: 'house:ghost', houseName: 'Ghost House',
      houseHeadCharacterId: 'npc:ghost:1' });
    candidate.cliques.push({ ...candidate.cliques[0],
      cliqueId: 'clique:ghost', centerCityId: 'fake-city' });
    candidate.houseMemberships.push(
      { characterId: person.id, houseId: 'house:test', joinedDay: 8,
        reason: 'Explicit household' },
      { characterId: person.id, houseId: 'house:test', joinedDay: 8,
        reason: 'Duplicate household' },
      { characterId: 'npc:ghost:1', houseId: 'house:test', joinedDay: 8,
        reason: 'Forged character' },
    );
    candidate.cliqueMemberships.push({ characterId: person.id,
      cliqueId: 'clique:ghost', joinedDay: 8, reason: 'Fake group' });
    const safe = normalizeCharacterSocialState(candidate, { roster, settlements });
    expect(safe.houses).toHaveLength(1);
    expect(safe.cliques).toHaveLength(1);
    expect(safe.houseMemberships).toHaveLength(1);
    expect(safe.cliqueMemberships).toHaveLength(0);
    person.status = 'dead';
    expect(normalizeCharacterSocialState(safe, { roster, settlements })).toEqual(safe);
    expect(getCharacterSocialProfile(safe, person.id, { roster }).houseMemberships)
      .toHaveLength(1);
  });

  it('rejects circular parent-clique relationships without deleting actual group definitions', () => {
    const { roster, social } = fixture();
    social.cliques.push({ cliqueId: 'clique:child', cliqueName: 'Test Alt Kol',
      cliqueType: null, leaderCharacterId: null, centerCityId: 'bursa',
      parentCliqueId: 'clique:test' });
    social.cliques[0].parentCliqueId = 'clique:child';
    const result = normalizeCharacterSocialState(social, { roster, settlements });
    expect(result.cliques).toHaveLength(2);
    expect(result.cliques.every((g) => g.parentCliqueId === null)).toBe(true);
  });

  it('preserves authored groups and explicit social edges through SaveManager and SaveSystem', () => {
    const { roster, person, social } = fixture();
    const state = { seed: 1648, day: 10, mode: 'map',
      map: { settlements }, worldCharacters: roster,
      characterSocial: normalizeCharacterSocialState(social, { roster, settlements }),
      characterSocialAuthority: social };
    const flow = new GameFlowManager(state);
    expect(flow.linkWorldCharacterToHouse(person.id, 'house:test', {
      reason: 'Approved historical association',
    })).toBe(true);
    expect(flow.linkWorldCharacterToClique(person.id, 'clique:test', {
      reason: 'Approved individual clique tie',
    })).toBe(true);
    expect(flow.linkWorldHouseToClique('house:test', 'clique:test', {
      reason: 'Approved house-clique link',
    })).toBe(true);
    const initial = flow.getWorldCharacterSocialProfile(person.id);
    expect(initial.houseMemberships).toHaveLength(1);
    expect(initial.cliqueMemberships).toHaveLength(1);
    expect(initial.houseCliqueLinks).toHaveLength(1);
    const saveManager = new SaveManager(state);
    saveManager.init(game());
    const payload = saveManager.buildSavePayload();
    expect(payload.game.worldCharacters.format).toBe('seeded-delta-v1');
    expect(payload.game.characterSocial.houses).toHaveLength(1);
    expect(payload.game.characterSocial.cliques).toHaveLength(1);
    expect(JSON.stringify(payload.game.characterSocial).length).toBeLessThan(1600);
    const normalized = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(payload)));
    expect(normalized.ok).toBe(true);
    const newState = { mode: 'map', map: { settlements }, characterSocialAuthority: social };
    const loadManager = new SaveManager(newState);
    loadManager.init(game());
    expect(loadManager.applySavePayload(normalized.data)).toBe(true);
    expect(newState.worldCharacters).toEqual(normalizeWorldCharacters(roster));
    expect(newState.characterSocial).toEqual(state.characterSocial);
    expect(new GameFlowManager(newState).getWorldCharacterSocialProfile(person.id))
      .toEqual(initial);
    expect(createWorldCharacterSave(roster, { seed: 1648, settlements }).overrides)
      .toHaveLength(2);
  });

  it('opens legacy saves without inventing a family, clique or marriage', () => {
    const { roster, person } = fixture();
    const old = new SaveSystem().normalizePayload({
      schemaVersion: 1,
      game: { worldCharacters: createWorldCharacterSave(roster, { seed: 1648, settlements }) },
    });
    expect(old.ok).toBe(true);
    expect(old.data.game.characterSocial).toEqual(emptyCharacterSocialState());
    const state = { mode: 'map', map: { settlements } };
    const manager = new SaveManager(state);
    manager.init(game());
    expect(manager.applySavePayload(old.data)).toBe(true);
    expect(state.characterSocial).toEqual(emptyCharacterSocialState());
    expect(new GameFlowManager(state).linkWorldCharacterToHouse(person.id, 'house:none', {
      reason: 'Unregistered family',
    })).toBe(false);
  });
});
