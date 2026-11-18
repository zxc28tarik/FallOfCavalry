import { describe, expect, it } from 'vitest';
import {
  compileCharacterDefinitionManifest, emptyCharacterDefinitionManifest,
  getTrustedCharacterDefinitions, getTrustedCharacterDefinition,
} from '../../js/systems/character-definitions.js';
import {
  CHARACTER_STAT_KEYS, createWorldCharacterRoster, createWorldCharacterSave,
  normalizeWorldCharacters, packWorldCharacters, restoreWorldCharacterSave,
} from '../../js/systems/world-characters.js';
import { advanceNamedCharacterImportance } from '../../js/systems/character-importance.js';
import { compileCharacterSocialSourceManifest } from '../../js/systems/character-social-source-manifest.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];
const stableId = 'npc:authored-test-elder:1';
const stats = Object.fromEntries(CHARACTER_STAT_KEYS.map((key) => [key, 50]));
const source = {
  sourceId: 'ref:test-edition', title: 'Synthetic character source',
  locator: 'qa-fixture:character-row-1', reviewStatus: 'approved',
};

function manifest() {
  return {
    version: 1, sources: [structuredClone(source)],
    definitions: [{
      personKey: 'person:qa-elder', characterId: stableId,
      sourceId: source.sourceId,
      name: 'Deneme İdarecisi', title: 'Deneme Unvanı',
      cultureId: 'ottoman', originFactionId: 'ottoman',
      religionId: null, sectId: null,
      importance: 'B', role: 'administrator', age: 42,
      traits: ['cautious'],
      stats: structuredClone(stats),
      loyalty: 50, satisfaction: 50, reputation: 50, standing: 50,
      status: 'alive', settlementId: 'edirne',
    }],
  };
}
const compile = (doc, options = {}) =>
  compileCharacterDefinitionManifest(doc, { settlements, ...options });
const baseRoster = () => createWorldCharacterRoster({ seed: 1648, settlements });
function game() {
  return {
    playerParty: { gold: 150, roster: [] }, itemCatalog: [], settings: {},
    worldManager: {
      enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
      lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
    },
    ensureInventoryModel: () => {}, ensureRosterState: () => {},
  };
}

describe('Character System v2 V2.0: authored CharacterDefinition separate from seeded GeneratedPerson', () => {
  it('starts with EMPTY authored catalog; does not turn culture names into historical identities', () => {
    const empty = getTrustedCharacterDefinitions({ settlements });
    expect(empty.accepted).toBe(true);
    expect(empty.definitions).toEqual([]);
    expect(empty.characters).toEqual([]);
    expect(emptyCharacterDefinitionManifest()).toEqual({
      version: 1, sources: [], definitions: [],
    });
    const prior = baseRoster();
    const current = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: empty.characters,
    });
    expect(current).toEqual(prior);
    expect(current.characters).toHaveLength(4);
    expect(current.characters.every((p) => p.kind === 'generated')).toBe(true);
    expect(getTrustedCharacterDefinition(stableId, { settlements })).toBeNull();
  });

  it('compiles only approved, exact-ID, fully authored Named(A/B/C) records with no random stats', () => {
    const input = manifest();
    const snapshot = JSON.stringify(input);
    const output = compile(input);
    expect(output.accepted).toBe(true);
    expect(output.diagnostics).toEqual([]);
    expect(output.definitions).toEqual([{
      version: 1, personKey: 'person:qa-elder',
      characterId: stableId, name: 'Deneme İdarecisi',
      title: 'Deneme Unvanı', cultureId: 'ottoman',
      originFactionId: 'ottoman', religionId: null, sectId: null,
      sourceId: 'ref:test-edition', importance: 'B',
      roleProfile: 'administrator', settlementId: 'edirne',
    }]);
    expect(output.characters).toHaveLength(1);
    expect(output.characters[0]).toMatchObject({
      id: stableId, kind: 'named', name: 'Deneme İdarecisi',
      importance: 'B', age: 42,
      traits: ['cautious'], stats, status: 'alive',
      history: [{ day: 1, type: 'created' }],
    });
    expect(Object.hasOwn(output.characters[0], 'title')).toBe(false);
    expect(Object.hasOwn(output.characters[0], 'religionId')).toBe(false);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('rejects incomplete attributes, missing sources and claimed review before materialization', () => {
    for (const update of [
      (m) => { m.sources[0].reviewStatus = 'draft'; },
      (m) => { m.sources[0].locator = ''; },
      (m) => { m.definitions[0].stats.trade = undefined; },
      (m) => { m.definitions[0].age = undefined; },
      (m) => { m.definitions[0].importance = 'D'; },
      (m) => { m.definitions[0].importance = 'Z'; },
      (m) => { m.definitions[0].settlementId = 'missing'; },
      (m) => { m.definitions[0].name = '<script>'; },
      (m) => { m.definitions[0].role = 'unapproved_profession'; },
      (m) => { m.definitions[0].sourceId = 'ref:nonexistent'; },
      (m) => { m.definitions[0].status = undefined; },
      (m) => { m.definitions[0].characterId = 'npc:edirne:1'; },
    ]) {
      const input = manifest();
      update(input);
      const result = compile(input);
      expect(result.accepted).toBe(false);
      expect(result.characters).toEqual([]);
      expect(result.definitions).toEqual([]);
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });

  it('is atomic: one bad item rejects all, including other otherwise valid people', () => {
    const input = manifest();
    input.definitions.push({
      ...structuredClone(input.definitions[0]),
      personKey: 'person:second', characterId: 'npc:authored-second-person:1',
      stats: { ...stats, trade: 101 },
    });
    const output = compile(input);
    expect(output.accepted).toBe(false);
    expect(output.characters).toEqual([]);
    expect(output.definitions).toEqual([]);
    const duplicate = manifest();
    duplicate.definitions.push({ ...duplicate.definitions[0], personKey: 'person:other' });
    expect(compile(duplicate).diagnostics.map((d) => d.code))
      .toContain('invalid_or_duplicate_character_identity');
  });

  it('rejects collision against actual registered IDs and refuses inconsistent duplicates at insertion', () => {
    const input = manifest();
    const bad = compile(input, { existingCharacterIds: [stableId] });
    expect(bad.accepted).toBe(false);
    const result = compile(input);
    const original = baseRoster();
    const withAuthored = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: result.characters,
    });
    expect(withAuthored.characters).toHaveLength(original.characters.length + 1);
    for (const person of original.characters) {
      expect(withAuthored.characters.find((p) => p.id === person.id)).toEqual(person);
    }
    expect(() => createWorldCharacterRoster({
      seed: 1648, settlements,
      authoredCharacters: [...result.characters, ...result.characters],
    })).toThrow(/Authored character/);
    expect(() => createWorldCharacterRoster({
      seed: 1648, settlements,
      authoredCharacters: [{ ...result.characters[0], id: original.characters[0].id }],
    })).toThrow();
  });

  it('includes authored baseline in sparse v1 delta without duplication or renumbering', () => {
    const compiled = compile(manifest());
    const roster = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    const baseNpcIds = baseRoster().characters.map((p) => p.id);
    expect(roster.characters.filter((p) => p.id !== stableId).map((p) => p.id))
      .toEqual(baseNpcIds);
    const save = createWorldCharacterSave(roster, {
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    expect(save.format).toBe('seeded-delta-v1');
    expect(save.overrides).toEqual([]);
    expect(save.additions).toBeUndefined();
    expect(restoreWorldCharacterSave(JSON.parse(JSON.stringify(save)), {
      settlements, authoredCharacters: compiled.characters,
    })).toEqual(normalizeWorldCharacters(roster));
    expect(roster.relations).toEqual([]);
  });

  it('restores saved dynamic importance/history but prevents an authored ID from changing identity', () => {
    const compiled = compile(manifest());
    const roster = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    expect(advanceNamedCharacterImportance(roster, stableId, {
      toImportance: 'A', day: 11, reason: 'QA validated role change',
    })).toBe(true);
    const save = createWorldCharacterSave(roster, {
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    expect(save.overrides).toHaveLength(1);
    const restored = restoreWorldCharacterSave(save, {
      settlements, authoredCharacters: compiled.characters,
    });
    const who = restored.characters.find((p) => p.id === stableId);
    expect(who.importance).toBe('A');
    expect(who.history.at(-1)).toMatchObject({ from: 'B', to: 'A' });
    expect(who.name).toBe('Deneme İdarecisi');

    // Save data must not impersonate a verified authored identity.
    const malicious = structuredClone(save);
    const override = malicious.overrides.find((row) => row[0] === stableId);
    override[2] = 'Sahte İdareci';
    override[4] = 'venice';
    const rejected = restoreWorldCharacterSave(malicious, {
      settlements, authoredCharacters: compiled.characters,
    });
    expect(rejected.characters.find((p) => p.id === stableId))
      .toEqual(compiled.characters[0]);
  });

  it('adds a newly approved CharacterDefinition when loading an old seeded-delta save', () => {
    const before = baseRoster();
    const oldSave = createWorldCharacterSave(before, { seed: 1648, settlements });
    expect(oldSave.format).toBe('seeded-delta-v1');
    const compiled = compile(manifest());
    const after = restoreWorldCharacterSave(oldSave, {
      settlements, authoredCharacters: compiled.characters,
    });
    expect(after.characters).toHaveLength(before.characters.length + 1);
    expect(after.characters.find((p) => p.id === stableId)).toEqual(compiled.characters[0]);
    for (const original of before.characters) {
      expect(after.characters.find((p) => p.id === original.id)).toEqual(original);
    }
  });

  it('does not admit forged authored IDs from untrusted seeded-delta additions', () => {
    const compiled = compile(manifest());
    const baseline = baseRoster();
    const cleanSave = createWorldCharacterSave(baseline, { seed: 1648, settlements });
    const injected = packWorldCharacters({ characters: compiled.characters, relations: [] }).people;
    const bad = { ...cleanSave, additions: injected };
    const restored = restoreWorldCharacterSave(bad, { settlements });
    expect(restored.characters.find((p) => p.id === stableId)).toBeUndefined();
    const approved = restoreWorldCharacterSave(bad, {
      settlements, authoredCharacters: compiled.characters,
    });
    expect(approved.characters.find((p) => p.id === stableId))
      .toEqual(compiled.characters[0]);
  });

  it('maintains exact authored identity for the social source preflight, never by name similarity', () => {
    const compiled = compile(manifest());
    const roster = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    const socialSource = {
      version: 1, sources: [structuredClone(source)],
      people: [{
        personKey: 'person:qa-elder', characterId: stableId,
        expectedName: 'Deneme İdarecisi', sourceId: source.sourceId,
      }],
      houses: [{
        houseId: 'house:qa', houseName: 'Deneme Hanesi',
        houseHeadPersonKey: 'person:qa-elder', sourceId: source.sourceId,
      }],
      cliques: [],
    };
    const match = compileCharacterSocialSourceManifest(socialSource, { roster, settlements });
    expect(match.accepted).toBe(true);
    expect(match.catalog.houses[0].houseHeadCharacterId).toBe(stableId);
    socialSource.people[0].characterId = roster.characters.find((p) => p.id !== stableId).id;
    const wrong = compileCharacterSocialSourceManifest(socialSource, { roster, settlements });
    expect(wrong.accepted).toBe(false);
  });

  it('survives SaveManager/SaveSystem cycle without ever saving the authority manifest', () => {
    const catalog = manifest();
    const compiled = compile(catalog);
    const roster = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    const state = { seed: 1648, mode: 'map', day: 12,
      map: { settlements }, characterDefinitionAuthority: catalog, worldCharacters: roster };
    const manager = new SaveManager(state);
    manager.init(game());
    const save = manager.buildSavePayload();
    expect(save.game.worldCharacters.format).toBe('seeded-delta-v1');
    expect(save.game.worldCharacters.additions).toBeUndefined();
    expect(save.game.characterDefinitionAuthority).toBeUndefined();
    const normalized = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(save)));
    expect(normalized.ok).toBe(true);
    const destination = {
      mode: 'map', map: { settlements }, characterDefinitionAuthority: catalog,
    };
    const loadedManager = new SaveManager(destination);
    loadedManager.init(game());
    expect(loadedManager.applySavePayload(normalized.data)).toBe(true);
    expect(destination.worldCharacters).toEqual(normalizeWorldCharacters(roster));
    const flow = new GameFlowManager(destination);
    expect(flow.getWorldCharacterDefinition(stableId)).toMatchObject({
      characterId: stableId, title: 'Deneme Unvanı', roleProfile: 'administrator',
    });
    expect(flow.getWorldCharacterDefinition('npc:edirne:1')).toBeNull();
    expect(destination.characterDefinitionDiagnostics).toEqual([]);
    expect(loadedManager.game.playerParty.roster).toEqual([]);
  });

  it('preserves uncatalogued historical records by full-save fallback, instead of lossy additions', () => {
    const compiled = compile(manifest());
    const roster = createWorldCharacterRoster({
      seed: 1648, settlements, authoredCharacters: compiled.characters,
    });
    const save = createWorldCharacterSave(roster, { seed: 1648, settlements });
    expect(save.format).toBe('packed-v1');
    expect(save.people.some((row) => row[0] === stableId)).toBe(true);
  });
});
