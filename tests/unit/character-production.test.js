import { describe, expect, it } from 'vitest';
import { GameFlowManager } from '../../js/managers/GameFlowManager.js';
import { discoverCharacterProductionSources } from '../../js/systems/character-production-sources.js';
import {
  produceCharacterCandidates,
  registerProducedCharacter,
} from '../../js/systems/character-production.js';
import {
  CHARACTER_SOURCE_ROLES, CHARACTER_SOURCE_TYPES,
} from '../../js/data/character-production-catalog.js';
import {
  createWorldCharacterRoster, createWorldCharacterSave,
  normalizeWorldCharacters, normalizeWorldCharacterSave,
  restoreWorldCharacterSave,
} from '../../js/systems/world-characters.js';

const settlements = [
  { id: 0, type: 'city', ownerFactionId: 'ottoman' },
  { id: 'village-1', type: 'village', ownerFactionId: 'ottoman' },
  { id: 'town-1', type: 'town', ownerFactionId: 'venice' },
  { id: 'fort-1', type: 'fort', ownerFactionId: 'ottoman' },
];
const city = { type: 'city', id: 0, settlementId: 0, cultureId: 'ottoman' };
const village = { type: 'village', id: 'village-1', settlementId: 'village-1' };
const fort = { type: 'fort', id: 'fort-1', settlementId: 'fort-1' };
const inn = { type: 'inn', id: 'inn-01', settlementId: 'town-1', cultureId: 'venice' };
const registeredSources = [{ type: 'inn', id: 'inn-01', settlementId: 'town-1' }];

function produce(source = city, extra = {}) {
  return produceCharacterCandidates({ worldSeed: 1648, source, settlements, ...extra });
}

describe('Character System v2: source-based character production (WEB)', () => {
  it('keeps world candidates transient until explicit registration', () => {
    const existing = createWorldCharacterRoster({ seed: 1648, settlements });
    const initial = JSON.stringify(existing);
    const draft = produce();
    expect(draft.revision).toBe(1);
    expect(draft.candidates).toHaveLength(2);
    expect(draft.candidates.every((person) =>
      person.kind === 'generated' && person.importance === null)).toBe(true);
    expect(draft.recruitment).toEqual({
      canJoinParty: false, canBeAssigned: false,
      canJoinTradeNetwork: false, canJoinDiplomacyNetwork: false,
    });
    expect(JSON.stringify(existing)).toBe(initial);
    expect(draft.candidates.every((person) => !existing.characters.some((actor) => actor.id === person.id))).toBe(true);
    expect(existing.relations).toEqual([]);
  });

  it('produces deterministic identity/stats by source + world seed + slot, independent of query order', () => {
    const a = produce(city, { count: 3 });
    const b = produce(city, { count: 3 });
    const c = produce(city, { count: 2, firstSlot: 2 });
    expect(a).toEqual(b);
    expect(c.candidates).toEqual(a.candidates.slice(1));
    expect(produce(city, { worldSeed: 1649 }).candidates).not.toEqual(a.candidates.slice(0, 2));
    expect(produce(village).candidates[0].id).not.toEqual(a.candidates[0].id);
    expect(a.candidates[0].id).toBe('npc:source-city~0:1');
    expect(a.candidates[0].cultureId).toBe('ottoman');
    expect(a.candidates[0].originFactionId).toBeNull();
    expect(a.candidates[0].history).toEqual([
      { day: 1, type: 'created', sourceType: 'city', sourceId: '0' },
    ]);
  });

  it('uses the real source role constraints, never an identical all-source roll', () => {
    const policy = {
      ...CHARACTER_SOURCE_ROLES,
      village: { artisan: 1 },
      fort: { commander: 1 },
    };
    const a = produce(village, { rolePolicy: policy });
    const b = produce(fort, { rolePolicy: policy });
    expect(a.candidates.every((person) => person.role === 'artisan')).toBe(true);
    expect(b.candidates.every((person) => person.role === 'commander')).toBe(true);
    expect(CHARACTER_SOURCE_TYPES).toContain('caravanserai');
    expect(CHARACTER_SOURCE_TYPES).toContain('military-training');
    expect(CHARACTER_SOURCE_TYPES).toContain('quest');
    expect(CHARACTER_SOURCE_TYPES).toContain('event');
    for (const person of [...a.candidates, ...b.candidates]) {
      expect(person.age).toBeGreaterThanOrEqual(18);
      expect(person.age).toBeLessThanOrEqual(65);
      expect(person.traits).toHaveLength(2);
      expect(new Set(person.traits).size).toBe(2);
      expect(Object.values(person.stats).every((value) => value >= 0 && value <= 100)).toBe(true);
    }
  });

  it('rejects fictitious settlement/facility sources, including mismatched types', () => {
    expect(() => produce({ type: 'city', id: 'village-1', settlementId: 'village-1' })).toThrow(RangeError);
    expect(() => produce({ type: 'city', id: 0, settlementId: 'town-1' })).toThrow(RangeError);
    expect(() => produce({ type: 'city', id: 'missing', settlementId: 'missing' })).toThrow(RangeError);
    expect(() => produce(inn)).toThrow(RangeError);
    expect(() => produce(inn, { registeredSources })).not.toThrow();
    expect(() => produce({ ...inn, id: 'inn-fake' }, { registeredSources })).toThrow(RangeError);
    expect(() => produce({ ...inn, type: 'port' }, { registeredSources })).toThrow(RangeError);
    expect(() => produce({ ...inn, type: 'teleporter' }, { registeredSources })).toThrow(RangeError);
  });

  it('does not infer religion, ethnicity or owner membership from culture and source', () => {
    const produced = produce(city, {
      namePools: { ottoman: ['Mahmud Reis', 'Safiye Hanım'], generic: ['Zeynep'] },
    });
    expect(produced.candidates.every((person) =>
      ['Mahmud Reis', 'Safiye Hanım'].includes(person.name))).toBe(true);
    const data = produced.candidates[0];
    expect(data.originFactionId).toBeNull();
    expect(data.religionId).toBeUndefined();
    expect(data.sectId).toBeUndefined();
    expect(data.houseId).toBeUndefined();
    expect(data.cliqueId).toBeUndefined();
  });

  it('registers only selected actors as Named(D), preserving source, ID and no auto relation/assignment', () => {
    const roster = createWorldCharacterRoster({ seed: 1648, settlements });
    const production = produce(inn, { registeredSources, day: 5 });
    const original = production.candidates[1];
    const beforeCount = roster.characters.length;
    const committed = registerProducedCharacter(roster, production, original.id, {
      day: 7, settlements, registeredSources,
    });
    expect(committed).toBeTruthy();
    expect(committed.id).toBe(original.id);
    expect(committed.kind).toBe('named');
    expect(committed.importance).toBe('D');
    expect(committed.role).toBe(original.role);
    expect(committed.stats).toEqual(original.stats);
    expect(committed.history).toEqual([
      { day: 5, type: 'created', sourceType: 'inn', sourceId: 'inn-01' },
      { day: 7, type: 'promoted' },
    ]);
    expect(roster.characters.length).toBe(beforeCount + 1);
    expect(roster.relations).toHaveLength(0);
    expect(roster.characters.some((person) => person.id === production.candidates[0].id)).toBe(false);
    expect(registerProducedCharacter(roster, production, original.id, {
      day: 8, settlements, registeredSources,
    })).toBe(false);
  });

  it('does not accept edited candidates, duplicate identity, past-dated registration or absent source', () => {
    const roster = createWorldCharacterRoster({ seed: 1648, settlements });
    const production = produce(inn, { registeredSources, day: 20 });
    const id = production.candidates[0].id;
    expect(registerProducedCharacter(roster, production, id, { day: 21, settlements })).toBe(false);
    expect(registerProducedCharacter(roster, production, id, {
      day: 18, settlements, registeredSources,
    })).toBe(false);
    const invalid = structuredClone(production);
    invalid.candidates[0].stats.trade = 100;
    expect(registerProducedCharacter(roster, invalid, id, {
      day: 21, settlements, registeredSources,
    })).toBe(false);
    expect(roster.characters.length).toBe(8);
  });

  it('persists new Named(D) characters without writing all generated candidates into localStorage', () => {
    const roster = createWorldCharacterRoster({ seed: 1648, settlements });
    const production = produce(inn, { registeredSources, day: 4, count: 4 });
    const actor = registerProducedCharacter(roster, production, production.candidates[0].id, {
      day: 4, settlements, registeredSources,
    });
    const save = createWorldCharacterSave(roster, { seed: 1648, settlements });
    expect(save.format).toBe('seeded-delta-v1');
    expect(save.overrides).toEqual([]);
    expect(save.additions).toHaveLength(1);
    expect(save.relations).toEqual([]);
    expect(JSON.stringify(save).length).toBeLessThan(500);
    const wire = normalizeWorldCharacterSave(JSON.parse(JSON.stringify(save)));
    expect(wire.additions).toHaveLength(1);
    const restored = restoreWorldCharacterSave(wire, { settlements });
    expect(restored).toEqual(normalizeWorldCharacters(roster));
    expect(restored.characters.find((person) => person.id === actor.id)?.history[0]).toEqual(
      { day: 4, type: 'created', sourceType: 'inn', sourceId: 'inn-01' },
    );
  });

  it('does not revive or inject a forged extra into nonexistent settlements on save restore', () => {
    const roster = createWorldCharacterRoster({ seed: 1648, settlements });
    const result = produce(inn, { registeredSources });
    registerProducedCharacter(roster, result, result.candidates[0].id, {
      settlements, registeredSources,
    });
    const save = createWorldCharacterSave(roster, { seed: 1648, settlements });
    const rows = structuredClone(save);
    rows.additions[0][15] = 'nonexistent';
    const restored = restoreWorldCharacterSave(rows, { settlements });
    expect(restored.characters.some((person) => person.id === result.candidates[0].id)).toBe(false);
    expect(restored.characters).toHaveLength(8);
  });

  it('runs the production pipeline through the actual campaign manager without touching player units', () => {
    const state = {
      seed: 1648, day: 7, map: { settlements },
      worldCharacters: createWorldCharacterRoster({ seed: 1648, settlements }),
    };
    const manager = new GameFlowManager(state);
    const before = state.worldCharacters.characters.length;
    const proposal = manager.previewWorldCharacterCandidates(city, { count: 2 });
    expect(state.worldCharacters.characters.length).toBe(before);
    expect(proposal.candidates[0].history[0].day).toBe(7);
    const chosen = manager.retainWorldCharacter(proposal, proposal.candidates[0].id);
    expect(chosen.kind).toBe('named');
    expect(chosen.importance).toBe('D');
    expect(chosen.id).toBe(proposal.candidates[0].id);
    expect(state.worldCharacters.characters.length).toBe(before + 1);
    const saved = createWorldCharacterSave(state.worldCharacters, { seed: 1648, settlements });
    expect(saved.format).toBe('seeded-delta-v1');
    expect(saved.additions).toHaveLength(1);
    expect(saved.overrides).toHaveLength(0);
  });

  it('discovers actual built inns/caravanserais/production sites without inventing sources', () => {
    const cityWithBuildings = {
      id: 'istanbul', type: 'city',
      cityState: { parcels: [
        { id: 'caravan', state: 'occupied', buildingIds: ['han', 'merchant_han', 'caravanserai'] },
        { id: 'industry', state: 'occupied', buildingIds: ['tannery', 'blacksmith', 'bakery'] },
        { id: 'market', state: 'occupied', buildingIds: ['bazaar_market', 'bedesten', 'customs_office'] },
        { id: 'locked', state: 'locked', buildingIds: ['han'] },
        { id: 'ghost', state: 'occupied', buildingIds: ['fictional_lighthouse'] },
      ] },
    };
    const snapshot = JSON.stringify(cityWithBuildings);
    const sources = discoverCharacterProductionSources([cityWithBuildings]);
    expect(sources).toHaveLength(7);
    expect(sources.map((entry) => entry.type).sort()).toEqual([
      'caravanserai', 'city', 'inn', 'inn', 'production', 'production', 'production',
    ]);
    expect(sources.every((entry) => entry.settlementId === 'istanbul')).toBe(true);
    expect(sources.every((entry) => !entry.id.includes('bazaar_market')
      && !entry.id.includes('bedesten') && !entry.id.includes('customs_office'))).toBe(true);
    expect(sources.every((entry) => !entry.id.includes('fictional_lighthouse'))).toBe(true);
    expect(JSON.stringify(cityWithBuildings)).toBe(snapshot);
    expect(discoverCharacterProductionSources([cityWithBuildings])).toEqual(sources);
    expect(discoverCharacterProductionSources([])).toEqual([]);
  });

  it('shows built sources through real GameFlow and invalidates an actor when its source disappears', () => {
    const built = {
      id: 'town-built', type: 'town',
      cityState: { parcels: [{ id: 'caravan', state: 'occupied', buildingIds: ['han'] }] },
    };
    const state = {
      seed: 1648, day: 15, map: { settlements: [built] },
      worldCharacters: createWorldCharacterRoster({ seed: 1648, settlements: [built] }),
    };
    const flow = new GameFlowManager(state);
    const sources = flow.listWorldCharacterProductionSources();
    expect(sources.map((source) => source.type)).toEqual(['inn', 'town']);
    const innSource = sources.find((source) => source.type === 'inn');
    const production = flow.previewWorldCharacterCandidates(innSource);
    expect(production.candidates).toHaveLength(2);
    // Building is destroyed/removed between discovery and offer selection.
    built.cityState.parcels[0].buildingIds = [];
    expect(flow.retainWorldCharacter(production, production.candidates[0].id)).toBe(false);
    expect(state.worldCharacters.characters).toHaveLength(2);
    built.cityState.parcels[0].buildingIds = ['han'];
    const kept = flow.retainWorldCharacter(production, production.candidates[0].id);
    expect(kept).toBeTruthy();
    expect(kept.kind).toBe('named');
    expect(kept.id).toBe(production.candidates[0].id);
    expect(createWorldCharacterSave(state.worldCharacters, {
      seed: 1648, settlements: [built],
    }).additions).toHaveLength(1);
  });

  it('supports capital/castle aliases and does not mutate untouched city state', () => {
    const map = [
      { id: 'capital-a', type: 'capital' },
      { id: 'castle-a', type: 'castle' },
      { id: 'village-a', type: 'village' },
    ];
    expect(discoverCharacterProductionSources(map).map((entry) => entry.type))
      .toEqual(['city', 'fort', 'village']);
    expect(map.every((entry) => entry.cityState === undefined)).toBe(true);
  });

  it('namespaces identical facility IDs in different settlements without collisions', () => {
    const twoCities = [
      { id: 'town-1', type: 'town' },
      { id: 'town-2', type: 'town' },
    ];
    const facilities = [
      { type: 'inn', id: 'inn-01', settlementId: 'town-1' },
      { type: 'inn', id: 'inn-01', settlementId: 'town-2' },
    ];
    const a = produceCharacterCandidates({
      worldSeed: 1648, source: facilities[0], settlements: twoCities,
      registeredSources: facilities,
    });
    const b = produceCharacterCandidates({
      worldSeed: 1648, source: facilities[1], settlements: twoCities,
      registeredSources: facilities,
    });
    expect(a.candidates[0].id).toBe('npc:source-inn~town-1~inn-01:1');
    expect(b.candidates[0].id).toBe('npc:source-inn~town-2~inn-01:1');
    expect(a.candidates[0].id).not.toBe(b.candidates[0].id);
    const roster = createWorldCharacterRoster({ seed: 1648, settlements: twoCities });
    for (const offer of [a, b]) {
      expect(registerProducedCharacter(roster, offer, offer.candidates[0].id, {
        settlements: twoCities, registeredSources: facilities,
      })).toBeTruthy();
    }
    const saved = createWorldCharacterSave(roster, { seed: 1648, settlements: twoCities });
    expect(saved.additions).toHaveLength(2);
    expect(restoreWorldCharacterSave(saved, { settlements: twoCities })).toEqual(normalizeWorldCharacters(roster));
  });

  it('rejects candidates from a different campaign seed before any roster mutation', () => {
    const state = {
      seed: 1648, day: 12, map: { settlements },
      worldCharacters: createWorldCharacterRoster({ seed: 1648, settlements }),
    };
    const flow = new GameFlowManager(state);
    const offSeed = produce(city, { worldSeed: 1649 });
    const before = JSON.stringify(state.worldCharacters);
    expect(flow.retainWorldCharacter(offSeed, offSeed.candidates[0].id)).toBe(false);
    expect(JSON.stringify(state.worldCharacters)).toBe(before);
    const valid = flow.previewWorldCharacterCandidates(city, { count: 1 });
    expect(flow.retainWorldCharacter(valid, valid.candidates[0].id)).toBeTruthy();
  });

  it('campaign facade rejects caller-forged facilities and cannot override its source registry', () => {
    const state = {
      seed: 1648, day: 12, map: { settlements },
      worldCharacters: createWorldCharacterRoster({ seed: 1648, settlements }),
    };
    const flow = new GameFlowManager(state);
    expect(() => flow.previewWorldCharacterCandidates(inn, {
      registeredSources: [inn],
    })).toThrow(RangeError);
    const fabricated = produce(inn, { registeredSources });
    expect(flow.retainWorldCharacter(fabricated, fabricated.candidates[0].id)).toBe(false);
    expect(state.worldCharacters.characters).toHaveLength(8);
  });

  it('defines a safe capability contract for each of the fourteen production source kinds', () => {
    const settlementSources = [
      { type: 'city', id: 0, settlementId: 0 },
      { type: 'village', id: 'village-1', settlementId: 'village-1' },
      { type: 'town', id: 'town-1', settlementId: 'town-1' },
      { type: 'fort', id: 'fort-1', settlementId: 'fort-1' },
    ];
    const nonSettlementSources = CHARACTER_SOURCE_TYPES.filter((type) =>
      !['city', 'village', 'town', 'fort'].includes(type)).map((type) => ({
      type, id: 'test-' + type, settlementId: 'town-1',
    }));
    const all = [...settlementSources, ...nonSettlementSources];
    expect(all).toHaveLength(14);
    const seen = new Set();
    for (const source of all) {
      const data = produce(source, {
        count: 1,
        registeredSources: nonSettlementSources,
      });
      expect(data.candidates).toHaveLength(1);
      expect(data.sourceContract).toEqual({
        sourceLocationId: String(source.settlementId),
        sourceCultureId: 'generic',
        possibleRoleTags: Object.keys(CHARACTER_SOURCE_ROLES[source.type]),
        possibleImportanceClasses: ['D'],
        staysInLocation: true,
        isUnavailableForRecruitment: true,
      });
      expect(data.sourceContract.possibleRoleTags).toContain(data.candidates[0].role);
      expect(seen.has(data.candidates[0].id)).toBe(false);
      seen.add(data.candidates[0].id);
    }
  });

  it('uses source-authored culture, never unapproved owner-derived or caller-supplied culture', () => {
    const authored = [{
      id: 'cultural-city', type: 'city', cultureId: 'venice',
      ownerFactionId: 'ottoman',
    }];
    const state = {
      seed: 1648, day: 2, map: { settlements: authored },
      worldCharacters: createWorldCharacterRoster({ seed: 1648, settlements: authored }),
    };
    const flow = new GameFlowManager(state);
    const sources = flow.listWorldCharacterProductionSources();
    expect(sources).toHaveLength(1);
    expect(sources[0].cultureId).toBe('venice');
    const untrustedInput = {
      type: 'city', id: 'cultural-city', settlementId: 'cultural-city',
      cultureId: 'ottoman', originFactionId: 'ottoman',
    };
    const produced = flow.previewWorldCharacterCandidates(untrustedInput);
    expect(produced.source.cultureId).toBe('venice');
    expect(produced.source.originFactionId).toBeNull();
    expect(produced.candidates.every((person) => person.cultureId === 'venice')).toBe(true);
    const changed = structuredClone(produced);
    changed.source.cultureId = 'ottoman';
    expect(flow.retainWorldCharacter(changed, changed.candidates[0].id)).toBe(false);
    expect(flow.retainWorldCharacter(produced, produced.candidates[0].id)).toBeTruthy();
    const unapproved = [{
      id: 'no-culture', type: 'village', ownerFactionId: 'ottoman',
    }];
    const defaults = new GameFlowManager({
      seed: 1648, day: 1, map: { settlements: unapproved },
      worldCharacters: createWorldCharacterRoster({ seed: 1648, settlements: unapproved }),
    }).listWorldCharacterProductionSources();
    expect(defaults[0].cultureId).toBe('generic');
  });

  it('enforces finite bounded candidate counts, slots, weights and name catalog', () => {
    expect(() => produce(city, { count: 9 })).toThrow(RangeError);
    expect(() => produce(city, { count: 0 })).toThrow(RangeError);
    expect(() => produce(city, { firstSlot: 9999999, count: 2 })).toThrow(RangeError);
    expect(() => produce(city, { day: 0 })).toThrow(RangeError);
    expect(() => produce(city, { rolePolicy: { ...CHARACTER_SOURCE_ROLES, city: { commander: 0 } } })).toThrow(RangeError);
    expect(() => produce(city, { rolePolicy: { ...CHARACTER_SOURCE_ROLES, city: { mystic: 10 } } })).toThrow(RangeError);
    expect(() => produce(city, { namePools: { ottoman: ['<evil>'] } })).toThrow(RangeError);
  });
});
