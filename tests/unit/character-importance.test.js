import { describe, expect, it } from 'vitest';
import {
  advanceNamedCharacterImportance, requiredImportanceReviewTier,
} from '../../js/systems/character-importance.js';
import {
  createWorldCharacterRoster, createWorldCharacterSave,
  normalizeWorldCharacters, packWorldCharacters, promoteWorldCharacter,
  restoreWorldCharacterSave, setWorldCharacterRelation,
} from '../../js/systems/world-characters.js';
import { produceCharacterCandidates, registerProducedCharacter } from '../../js/systems/character-production.js';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';

const settlements = [{ id: 'edirne', type: 'city', ownerFactionId: 'ottoman' }];

function setup() {
  const roster = createWorldCharacterRoster({ seed: 1648, settlements });
  const person = roster.characters[0];
  const other = roster.characters[1];
  promoteWorldCharacter(roster, person.id, { day: 5 });
  return { roster, person, other };
}

describe('Character System v2: explicit named-character importance paths (WEB)', () => {
  it('implements only approved paths with their rarity categories; NEVER D to A', () => {
    expect(requiredImportanceReviewTier('D', 'C')).toBe('standard');
    expect(requiredImportanceReviewTier('C', 'B')).toBe('rare');
    expect(requiredImportanceReviewTier('B', 'A')).toBe('standard');
    expect(requiredImportanceReviewTier('C', 'A')).toBe('very-rare');
    for (const end of ['B', 'A', 'D']) {
      expect(requiredImportanceReviewTier('D', end)).toBeNull();
    }
    expect(requiredImportanceReviewTier('A', 'B')).toBeNull();
    expect(requiredImportanceReviewTier('random', 'A')).toBeNull();
  });

  it('advances D → C → B → A only on explicitly reasoned commands, preserving actor and relation identity', () => {
    const { roster, person, other } = setup();
    const originalId = person.id;
    const originalStats = person.stats;
    const originalAge = person.age;
    const originalLocation = person.location;
    expect(setWorldCharacterRelation(roster, person.id, other.id, -22)).toBe(true);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'C', day: 6, reason: 'Goreve atandi',
    })).toBe(true);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'B', day: 7, reason: 'Sehirde one cikti',
    })).toBe(false);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'B', day: 7, reason: 'Sehirde one cikti', reviewTier: 'rare',
    })).toBe(true);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'A', day: 8, reason: 'Yonetim yetkisi kazandi',
    })).toBe(true);
    expect(person.importance).toBe('A');
    expect(person.id).toBe(originalId);
    expect(person.stats).toBe(originalStats);
    expect(person.age).toBe(originalAge);
    expect(person.location).toBe(originalLocation);
    expect(roster.relations).toHaveLength(1);
    expect(person.history.slice(-3)).toEqual([
      { day: 6, type: 'importance', from: 'D', to: 'C', reviewTier: 'standard', reason: 'Goreve atandi' },
      { day: 7, type: 'importance', from: 'C', to: 'B', reviewTier: 'rare', reason: 'Sehirde one cikti' },
      { day: 8, type: 'importance', from: 'B', to: 'A', reviewTier: 'standard', reason: 'Yonetim yetkisi kazandi' },
    ]);
    const delta = createWorldCharacterSave(roster, { seed: 1648, settlements });
    expect(delta.format).toBe('seeded-delta-v1');
    expect(delta.overrides).toHaveLength(1);
    expect(delta.additions).toBeUndefined();
    expect(restoreWorldCharacterSave(JSON.parse(JSON.stringify(delta)), { settlements }))
      .toEqual(normalizeWorldCharacters(roster));
    expect(normalizeWorldCharacters(packWorldCharacters(roster)))
      .toEqual(normalizeWorldCharacters(roster));
  });

  it('permits the very rare C → A shortcut only with a marked rare decision and reason', () => {
    const { roster, person } = setup();
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'C', day: 6, reason: 'Yerel gorev',
    })).toBe(true);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'A', day: 9, reason: 'Olaganustu olay',
    })).toBe(false);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'A', day: 9, reason: 'Olaganustu olay', reviewTier: 'rare',
    })).toBe(false);
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'A', day: 9, reason: 'Olaganustu olay', reviewTier: 'very-rare',
    })).toBe(true);
    expect(person.importance).toBe('A');
  });

  it('rejects generated/dead/missing actors, unreasoned or backdated promotions with no mutations', () => {
    const { roster, person } = setup();
    const generated = roster.characters[1];
    const initial = JSON.stringify(roster);
    expect(advanceNamedCharacterImportance(roster, generated.id, {
      toImportance: 'C', day: 6, reason: 'Bir olay',
    })).toBe(false);
    expect(advanceNamedCharacterImportance(roster, 'npc:missing:1', {
      toImportance: 'C', day: 6, reason: 'Bir olay',
    })).toBe(false);
    for (const option of [
      { toImportance: 'A', day: 6, reason: 'Dogru degil' },
      { toImportance: 'B', day: 6, reason: 'Dogru degil' },
      { toImportance: 'D', day: 6, reason: 'Dogru degil' },
      { toImportance: 'C', day: 4, reason: 'Gecersiz gun' },
      { toImportance: 'C', day: 6, reason: '' },
      { toImportance: 'C', day: 6, reason: '<script>' },
      { toImportance: 'C', day: 6, reason: 'Gorev', reviewTier: 'rare' },
    ]) {
      expect(advanceNamedCharacterImportance(roster, person.id, option)).toBe(false);
    }
    expect(JSON.stringify(roster)).toBe(initial);
    person.status = 'dead';
    expect(advanceNamedCharacterImportance(roster, person.id, {
      toImportance: 'C', day: 6, reason: 'Gorev',
    })).toBe(false);
  });

  it('keeps new source-produced Named(D) advances in sparse additions after save/load', () => {
    const roster = createWorldCharacterRoster({ seed: 1648, settlements });
    const source = { type: 'city', id: 'edirne', settlementId: 'edirne' };
    const production = produceCharacterCandidates({
      worldSeed: 1648, source, settlements, count: 2, day: 3,
    });
    const id = production.candidates[0].id;
    expect(registerProducedCharacter(roster, production, id, {
      settlements, day: 4,
    })).toBeTruthy();
    const flow = new GameFlowManager({ seed: 1648, day: 9, map: { settlements }, worldCharacters: roster });
    expect(flow.advanceWorldCharacterImportance(id, 'C', { reason: 'Sehir olayi' })).toBe(true);
    const other = roster.characters[0];
    expect(setWorldCharacterRelation(roster, other.id, id, 37)).toBe(true);
    const snapshot = normalizeWorldCharacters(roster);
    const save = createWorldCharacterSave(roster, { seed: 1648, settlements });
    expect(save.format).toBe('seeded-delta-v1');
    expect(save.overrides).toHaveLength(0);
    expect(save.additions).toHaveLength(1);
    const restored = restoreWorldCharacterSave(JSON.parse(JSON.stringify(save)), { settlements });
    expect(restored).toEqual(snapshot);
    expect(restored.characters.find((p) => p.id === id)?.importance).toBe('C');
    expect(restored.characters.find((p) => p.id === id)?.history.at(-1)).toMatchObject({
      type: 'importance', from: 'D', to: 'C', reason: 'Sehir olayi',
    });
  });

  it('normalization rejects forged or invalid importance history records without deleting people', () => {
    const { roster, person } = setup();
    person.history.push(
      { day: 7, type: 'importance', from: 'D', to: 'A', reviewTier: 'very-rare', reason: 'Hatali' },
      { day: 7, type: 'importance', from: 'C', to: 'B', reviewTier: 'standard', reason: 'Kural disi' },
      { day: 7, type: 'importance', from: 'D', to: 'C', reviewTier: 'standard', reason: '<bad>' },
      { day: 7, type: 'importance', from: 'D', to: 'C', reviewTier: 'standard', reason: 'Gecerli olay' },
    );
    const normalized = normalizeWorldCharacters(roster);
    const savedActor = normalized.characters.find((p) => p.id === person.id);
    expect(savedActor).toBeDefined();
    expect(savedActor.history.filter((e) => e.type === 'importance')).toEqual([
      { day: 7, type: 'importance', from: 'D', to: 'C',
        reviewTier: 'standard', reason: 'Gecerli olay' },
    ]);
  });
});
