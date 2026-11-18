import { describe, expect, it } from 'vitest';
import {
  CHARACTER_STAT_KEYS, createWorldCharacterRoster, createWorldCharacterSave,
  normalizeWorldCharacters, packWorldCharacters, promoteWorldCharacter,
  restoreWorldCharacterSave,
} from '../../js/systems/world-characters.js';
import {
  NAMED_CHARACTER_STATE_VERSION, changeNamedCharacterMetric,
  getNamedCharacterState, isNamedCharacterMetricPath,
} from '../../js/systems/named-character-state.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const settlements = [
  { id: 'edirne', type: 'city', ownerFactionId: 'ottoman' },
  { id: 'bursa', type: 'city', ownerFactionId: 'ottoman' },
];
const seed = 1648;
const statKey = CHARACTER_STAT_KEYS[0];
const statPath = 'stats.' + statKey;

function setup() {
  const roster = createWorldCharacterRoster({ seed, settlements });
  const [person, generated] = roster.characters;
  expect(promoteWorldCharacter(roster, person.id, { day: 4 })).toBe(true);
  return { roster, person, generated };
}
function authoredFixture() {
  const original = createWorldCharacterRoster({ seed, settlements }).characters[0];
  return {
    ...structuredClone(original), id: 'npc:authored-state-fixture:1',
    kind: 'named', importance: 'B',
  };
}
function game() {
  return {
    playerParty: { gold: 100, roster: [] }, settings: {}, itemCatalog: [],
    worldManager: {
      enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
      lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
    }, ensureInventoryModel: () => {}, ensureRosterState: () => {},
  };
}

describe('WEB Character System v2 V1.11: immutable definition and mutable state adapter', () => {
  it('returns a by-value NamedCharacterState, not a generated person or a mutable definition', () => {
    const { roster, person, generated } = setup();
    const original = structuredClone(person);
    const state = getNamedCharacterState(roster, person.id);
    expect(state).toEqual({
      version: NAMED_CHARACTER_STATE_VERSION, characterId: person.id,
      importance: person.importance, roleProfile: person.role,
      stats: person.stats, traits: person.traits,
      currentLoyalty: person.loyalty, satisfaction: person.satisfaction,
      currentReputation: person.reputation, currentStanding: person.standing,
      status: person.status, location: person.location, history: person.history,
    });
    state.stats[statKey] = 0;
    state.history.push({ type: 'fake' });
    state.location.settlementId = 'bursa';
    expect(person).toEqual(original);
    expect(getNamedCharacterState(roster, generated.id)).toBeNull();
    expect(getNamedCharacterState(roster, 'npc:ghost:1')).toBeNull();
  });

  it('changes one explicit current value with a reason; keeps name, origin, age, place and role', () => {
    const { roster, person } = setup();
    const before = structuredClone(person);
    const target = person.loyalty === 100 ? 99 : person.loyalty + 1;
    expect(changeNamedCharacterMetric(roster, person.id, {
      metric: 'loyalty', value: target, day: 9,
      reason: 'Approved outcome from a task',
    })).toBe(true);
    expect(person.loyalty).toBe(target);
    expect(person.history.at(-1)).toEqual({
      day: 9, type: 'state-changed', metric: 'loyalty',
      from: before.loyalty, to: target, reason: 'Approved outcome from a task',
    });
    for (const key of ['id', 'name', 'originFactionId', 'cultureId', 'age', 'role', 'location',
      'importance', 'traits']) expect(person[key]).toEqual(before[key]);
    expect(roster.relations).toEqual([]);
  });

  it('changes a listed stat only, without a hidden levelling curve', () => {
    const { roster, person } = setup();
    const before = { ...person.stats };
    const value = before[statKey] === 100 ? 99 : before[statKey] + 1;
    expect(isNamedCharacterMetricPath(statPath)).toBe(true);
    expect(changeNamedCharacterMetric(roster, person.id, {
      metric: statPath, value, day: 10, reason: 'Explicit training result',
    })).toBe(true);
    expect(person.stats).toEqual({ ...before, [statKey]: value });
    expect(person.history.at(-1)).toMatchObject({
      type: 'state-changed', metric: statPath, from: before[statKey], to: value,
    });
    for (const name of ['importance', 'BaseLoyalty', 'age', 'stats.__proto__',
      'stats.unknown', 'role']) expect(isNamedCharacterMetricPath(name)).toBe(false);
  });

  it('rejects forged field, no-op, past day, illegal value, generated/deceased actors atomically', () => {
    const { roster, person, generated } = setup();
    const value = person.reputation === 100 ? 99 : person.reputation + 1;
    const before = JSON.stringify(roster);
    for (const options of [
      { metric: 'importance', value: 30, day: 8, reason: 'Bad field' },
      { metric: 'reputation', value: -1, day: 8, reason: 'Out of range' },
      { metric: 'reputation', value: 101, day: 8, reason: 'Out of range' },
      { metric: 'reputation', value: 9.2, day: 8, reason: 'Fractional' },
      { metric: 'reputation', value, day: 3, reason: 'Backdated event' },
      { metric: 'reputation', value, day: 8, reason: '<script>' },
      { metric: 'reputation', value, day: 8, reason: '' },
      { metric: 'reputation', value: person.reputation, day: 8, reason: 'No change' },
    ]) {
      expect(changeNamedCharacterMetric(roster, person.id, options)).toBe(false);
    }
    expect(changeNamedCharacterMetric(roster, generated.id, {
      metric: 'reputation', value, day: 8, reason: 'Generated actor',
    })).toBe(false);
    expect(changeNamedCharacterMetric(roster, 'npc:ghost:1', {
      metric: 'reputation', value, day: 8, reason: 'Missing actor',
    })).toBe(false);
    expect(JSON.stringify(roster)).toBe(before);
    person.status = 'dead';
    expect(changeNamedCharacterMetric(roster, person.id, {
      metric: 'reputation', value, day: 8, reason: 'Dead actor',
    })).toBe(false);
  });

  it('preserves changes and history in packed-v1 and seeded-delta-v1 without changing save version', () => {
    const { roster, person } = setup();
    expect(changeNamedCharacterMetric(roster, person.id, {
      metric: 'satisfaction', value: 14, day: 9, reason: 'Documented city event',
    })).toBe(true);
    const packed = packWorldCharacters(roster);
    expect(packed.people.find((row) => row[0] === person.id)[16].at(-1))
      .toEqual([9, 'state-changed', 'satisfaction',
        person.history.at(-1).from, 14, 'Documented city event']);
    expect(normalizeWorldCharacters(JSON.parse(JSON.stringify(packed))))
      .toEqual(normalizeWorldCharacters(roster));
    const delta = createWorldCharacterSave(roster, { seed, settlements });
    expect(delta.format).toBe('seeded-delta-v1');
    expect(delta.overrides).toHaveLength(1);
    const restored = restoreWorldCharacterSave(JSON.parse(JSON.stringify(delta)), { settlements });
    expect(restored).toEqual(normalizeWorldCharacters(roster));
    expect(getNamedCharacterState(restored, person.id).history.at(-1))
      .toEqual(person.history.at(-1));
  });

  it('persists an authored Named(B) current change but never changes authored identity', () => {
    const authored = authoredFixture();
    const roster = createWorldCharacterRoster({ seed, settlements, authoredCharacters: [authored] });
    const actor = roster.characters.find((p) => p.id === authored.id);
    const original = { name: actor.name, age: actor.age, cultureId: actor.cultureId };
    expect(changeNamedCharacterMetric(roster, actor.id, {
      metric: 'standing', value: 67, day: 12, reason: 'Authorized council decision',
    })).toBe(true);
    const save = createWorldCharacterSave(roster, {
      seed, settlements, authoredCharacters: [authored],
    });
    expect(save.format).toBe('seeded-delta-v1');
    expect(save.overrides).toHaveLength(1);
    expect(save.additions).toBeUndefined();
    const restored = restoreWorldCharacterSave(save, {
      settlements, authoredCharacters: [authored],
    });
    const found = restored.characters.find((p) => p.id === actor.id);
    expect(found).toMatchObject({ ...original, standing: 67 });
    expect(found.history.at(-1)).toMatchObject({
      type: 'state-changed', metric: 'standing', from: authored.standing, to: 67,
    });
  });

  it('filters forged or corrupt state history on save normalization', () => {
    const { roster, person } = setup();
    person.history.push(
      { day: 10, type: 'state-changed', metric: 'age', from: 10, to: 20,
        reason: 'Invalid field' },
      { day: 10, type: 'state-changed', metric: 'stats.__proto__', from: 10, to: 20,
        reason: 'Unsafe field' },
      { day: 10, type: 'state-changed', metric: 'loyalty', from: 10, to: 150,
        reason: 'Invalid value' },
      { day: 10, type: 'state-changed', metric: 'reputation', from: 10, to: 20,
        reason: '<bad>' },
      { day: 10, type: 'state-changed', metric: 'reputation', from: 10, to: 20,
        reason: 'Valid event' },
    );
    const actor = normalizeWorldCharacters(roster).characters.find((p) => p.id === person.id);
    expect(actor).toBeTruthy();
    expect(actor.history.filter((e) => e.type === 'state-changed')).toEqual([{
      day: 10, type: 'state-changed', metric: 'reputation',
      from: 10, to: 20, reason: 'Valid event',
    }]);
  });

  it('provides game-flow read/change APIs with no changes to role assignments or troop roster', () => {
    const { roster, person } = setup();
    const state = { seed, day: 8, map: { settlements }, worldCharacters: roster };
    const flow = new GameFlowManager(state);
    expect(flow.changeWorldCharacterMetric(person.id, 'reputation', 73, {
      reason: 'Campaign report accepted',
    })).toBe(true);
    expect(flow.getWorldNamedCharacterState(person.id).currentReputation).toBe(73);
    expect(person.history.at(-1).day).toBe(8);
    expect(state.characterOrganization).toBeUndefined();
    expect(state.characterSocial).toBeUndefined();
  });

  it('roundtrips a full SaveManager/SaveSystem campaign and old saves without a new sidecar', () => {
    const { roster, person } = setup();
    const state = { seed, day: 9, mode: 'map', map: { settlements }, worldCharacters: roster };
    const manager = new SaveManager(state);
    manager.init(game());
    expect(changeNamedCharacterMetric(roster, person.id, {
      metric: 'reputation', value: 77, day: 9, reason: 'Completed campaign task',
    })).toBe(true);
    const save = manager.buildSavePayload();
    expect(save.game.worldCharacters.format).toBe('seeded-delta-v1');
    expect(save.game.namedCharacterStates).toBeUndefined();
    expect(save.game.roster).toEqual([]);
    const sanitized = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(save)));
    expect(sanitized.ok).toBe(true);
    const loadedState = { mode: 'map', map: { settlements } };
    const loadedManager = new SaveManager(loadedState);
    loadedManager.init(game());
    expect(loadedManager.applySavePayload(sanitized.data)).toBe(true);
    expect(loadedState.worldCharacters).toEqual(normalizeWorldCharacters(roster));
    expect(getNamedCharacterState(loadedState.worldCharacters, person.id).currentReputation)
      .toBe(77);
    expect(loadedManager.game.playerParty.roster).toEqual([]);
    const legacy = createWorldCharacterRoster({ seed, settlements });
    promoteWorldCharacter(legacy, legacy.characters[0].id, { day: 4 });
    const oldSave = createWorldCharacterSave(legacy, { seed, settlements });
    expect(restoreWorldCharacterSave(oldSave, { settlements }))
      .toEqual(normalizeWorldCharacters(legacy));
  });
});
