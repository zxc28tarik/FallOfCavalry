import { describe, expect, it } from 'vitest';
import {
  CHARACTER_STAT_KEYS,
  createWorldCharacterRoster,
  createWorldCharacterSave,
  getSettlementCharacters,
  normalizeWorldCharacters,
  packWorldCharacters,
  promoteWorldCharacter,
  restoreWorldCharacterSave,
  setWorldCharacterRelation,
} from '../../js/systems/world-characters.js';
import SaveSystem from '../../js/systems/save-system.js';
import { SaveManager } from '../../js/managers/SaveManager.js';

const settlements = [
  { id: 'istanbul', ownerFactionId: 'ottoman', type: 'city' },
  { id: 'wien', ownerFactionId: 'hre', type: 'city' },
  { id: 'venezia', ownerFactionId: 'venice', type: 'port' },
];

function roster(seed = 1648) {
  return createWorldCharacterRoster({ seed, settlements });
}

describe('Web campaign world NPCs (not player units or visual soldiers)', () => {
  it('creates deterministic NPCs for every actual settlement, independent of settlement order', () => {
    const a = roster();
    const b = createWorldCharacterRoster({ seed: 1648, settlements: [...settlements].reverse() });
    expect(b).toEqual(a);
    expect(a.characters).toHaveLength(6);
    expect(new Set(a.characters.map((person) => person.id)).size).toBe(6);
    expect(a.characters.every((person) => person.id.startsWith('npc:'))).toBe(true);
    expect(a.characters.every((person) => person.kind === 'generated' && person.importance === null)).toBe(true);
    expect(a.relations).toEqual([]);
    expect(getSettlementCharacters(a, 'istanbul')).toHaveLength(2);
    expect(getSettlementCharacters(a, 'unknown')).toHaveLength(0);
  });

  it('different campaign seeds produce different people; extra settlements do not reroll existing NPCs', () => {
    expect(roster(1649).characters).not.toEqual(roster(1648).characters);
    const expanded = createWorldCharacterRoster({
      seed: 1648,
      settlements: [...settlements, { id: 'porto', ownerFactionId: 'spanish' }],
    });
    expect(getSettlementCharacters(expanded, 'istanbul')).toEqual(getSettlementCharacters(roster(), 'istanbul'));
  });

  it('preserves identity/ethnicity-free culture tags, role, stat and morale bounds', () => {
    const people = roster().characters;
    for (const person of people) {
      expect(person.age).toBeGreaterThanOrEqual(18);
      expect(person.age).toBeLessThanOrEqual(65);
      expect(person.name.length).toBeGreaterThanOrEqual(2);
      expect(person.traits).toHaveLength(2);
      expect(new Set(person.traits).size).toBe(2);
      for (const key of CHARACTER_STAT_KEYS) {
        expect(person.stats[key]).toBeGreaterThanOrEqual(0);
        expect(person.stats[key]).toBeLessThanOrEqual(100);
      }
      for (const key of ['loyalty', 'satisfaction', 'reputation', 'standing']) {
        expect(person[key]).toBeGreaterThanOrEqual(0);
        expect(person[key]).toBeLessThanOrEqual(100);
      }
      expect(person.location.kind).toBe('settlement');
      expect(person.history).toEqual([{ day: 1, type: 'created' }]);
    }
    expect(getSettlementCharacters(roster(), 'istanbul').every((npc) => npc.cultureId === 'ottoman')).toBe(true);
    expect(getSettlementCharacters(roster(), 'wien').every((npc) => npc.cultureId === 'hre')).toBe(true);
  });

  it('ignores duplicate settlement identifiers and limits huge batches without touching combat roster', () => {
    const repeated = createWorldCharacterRoster({ seed: 1, settlements: [settlements[0], settlements[0]] });
    expect(repeated.characters).toHaveLength(2);
    expect(() => createWorldCharacterRoster({ settlements, perSettlement: 9 })).toThrow(RangeError);
    expect(() => createWorldCharacterRoster({
      settlements: Array.from({ length: 2100 }, (_, id) => ({ id: String(id) })),
    })).toThrow(RangeError);
  });

  it('promotes a generated person to Named(D) without replacing their ID/stats/location/relations', () => {
    const data = roster();
    const person = data.characters[0];
    const originalId = person.id;
    const originalStats = person.stats;
    const originalLocation = person.location;
    const otherId = data.characters[1].id;
    expect(setWorldCharacterRelation(data, person.id, otherId, -24)).toBe(true);
    expect(promoteWorldCharacter(data, person.id, { day: 5 })).toBe(true);
    expect(person.kind).toBe('named');
    expect(person.importance).toBe('D');
    expect(person.id).toBe(originalId);
    expect(person.stats).toBe(originalStats);
    expect(person.location).toBe(originalLocation);
    expect(data.characters.find((npc) => npc.id === originalId)).toBe(person);
    expect(data.relations).toEqual([{ firstId: originalId, secondId: otherId, value: -24 }].map(
      ({ firstId, secondId, value }) => ({
        firstId: [firstId, secondId].sort()[0],
        secondId: [firstId, secondId].sort()[1],
        value,
      }),
    ));
    expect(person.history).toEqual([{ day: 1, type: 'created' }, { day: 5, type: 'promoted' }]);
    expect(promoteWorldCharacter(data, person.id, { day: 6 })).toBe(false);
  });

  it('stores only explicit sparse relations, updates canonical pair and rejects invalid endpoints', () => {
    const data = roster();
    const [a, b] = data.characters;
    expect(data.relations).toHaveLength(0);
    expect(setWorldCharacterRelation(data, b.id, a.id, 15)).toBe(true);
    expect(setWorldCharacterRelation(data, a.id, b.id, 60)).toBe(true);
    expect(data.relations).toHaveLength(1);
    expect(data.relations[0].value).toBe(60);
    expect(setWorldCharacterRelation(data, a.id, 'not-an-npc', 50)).toBe(false);
    expect(() => setWorldCharacterRelation(data, a.id, b.id, 101)).toThrow(RangeError);
  });

  it('normalizes old empty saves and drops malformed or duplicated entries/relations', () => {
    expect(normalizeWorldCharacters(undefined)).toEqual({ version: 1, characters: [], relations: [] });
    const data = roster();
    const [a, b] = data.characters;
    const changed = { ...data, characters: [a, a, { ...b, age: 'old' }, { ...b, age: 35 }], relations: [
      { firstId: a.id, secondId: b.id, value: 40 },
      { firstId: b.id, secondId: a.id, value: 9 },
      { firstId: a.id, secondId: 'nonexistent', value: 4 },
    ] };
    const clean = normalizeWorldCharacters(changed);
    expect(clean.characters).toHaveLength(2);
    expect(clean.relations).toHaveLength(1);
    expect(clean.relations[0].value).toBe(40);
    expect(clean.characters[0]).not.toBe(a);
    expect(clean.characters[0].stats).not.toBe(a.stats);
  });

  it('packs and unpacks a large NPC roster losslessly with lower localStorage footprint', () => {
    const large = createWorldCharacterRoster({
      seed: 1337,
      settlements: Array.from({ length: 881 }, (_, id) => ({
        id: `city-${id}`, ownerFactionId: id % 2 ? 'ottoman' : 'venice',
      })),
    });
    const [a, b] = large.characters;
    expect(setWorldCharacterRelation(large, a.id, b.id, 75)).toBe(true);
    expect(promoteWorldCharacter(large, a.id, { day: 45 })).toBe(true);
    const compact = packWorldCharacters(large);
    expect(compact.people).toHaveLength(1762);
    expect(normalizeWorldCharacters(JSON.parse(JSON.stringify(compact)))).toEqual(normalizeWorldCharacters(large));
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(large).length * 0.6);
  });

  it('seeds all 1762 people at load without recording unchanged people in localStorage', () => {
    const cities = Array.from({ length: 881 }, (_, id) => ({ id: `city-${id}`, ownerFactionId: 'ottoman' }));
    const people = createWorldCharacterRoster({ seed: 1337, settlements: cities });
    const first = people.characters[0];
    const other = people.characters[1];
    expect(promoteWorldCharacter(people, first.id, { day: 15 })).toBe(true);
    expect(setWorldCharacterRelation(people, first.id, other.id, 28)).toBe(true);
    const save = createWorldCharacterSave(people, { seed: 1337, settlements: cities });
    expect(save.format).toBe('seeded-delta-v1');
    expect(save.overrides).toHaveLength(1);
    expect(save.relations).toHaveLength(1);
    expect(JSON.stringify(save).length).toBeLessThan(500);
    expect(restoreWorldCharacterSave(JSON.parse(JSON.stringify(save)), { settlements: cities }))
      .toEqual(normalizeWorldCharacters(people));
    expect(restoreWorldCharacterSave(undefined, { settlements: cities }).characters).toEqual([]);
  });

  it('survives SaveSystem normalization and SaveManager build/load without creating a player character', () => {
    const npcState = roster();
    promoteWorldCharacter(npcState, npcState.characters[0].id, { day: 7 });
    const state = { mode: 'map', day: 7, seed: 1648, worldCharacters: npcState, map: { settlements } };
    const game = {
      playerParty: { gold: 350, roster: [] },
      itemCatalog: [],
      settings: {},
      worldManager: {
        enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
      },
      ensureInventoryModel: () => {},
      ensureRosterState: () => {},
    };
    const manager = new SaveManager(state);
    manager.init(game);
    const payload = manager.buildSavePayload();
    expect(payload.game.worldCharacters.format).toBe('seeded-delta-v1');
    expect(payload.game.worldCharacters.overrides).toHaveLength(1);
    expect(restoreWorldCharacterSave(payload.game.worldCharacters, { settlements })).toEqual(normalizeWorldCharacters(npcState));
    const migrated = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(payload)));
    expect(migrated.ok).toBe(true);
    expect(migrated.data.game.worldCharacters).toEqual(payload.game.worldCharacters);
    const loadedState = { mode: 'map', day: 1, map: { settlements } };
    const loadedManager = new SaveManager(loadedState);
    loadedManager.init({ ...game, playerParty: { gold: 0, roster: [] } });
    expect(loadedManager.applySavePayload(migrated.data)).toBe(true);
    expect(loadedState.worldCharacters).toEqual(normalizeWorldCharacters(npcState));
    expect(loadedManager.game.playerParty.character).toBeUndefined();
    expect(new SaveSystem().normalizePayload({ schemaVersion: 1, game: {} }).data.game.worldCharacters.characters).toEqual([]);
  });
});
