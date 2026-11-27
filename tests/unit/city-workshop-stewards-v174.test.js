import { describe, expect, it } from 'vitest';
import { createWorldCharacterRoster, promoteWorldCharacter } from '../../js/systems/world-characters.js';
import {
  emptyCharacterOrganizationState, normalizeCharacterOrganizationState,
  startCharacterAssignment, WORKSHOP_STEWARD_ROLE,
} from '../../js/systems/character-organization.js';
import {
  appointCityWorkshopSteward, releaseCityWorkshopSteward, listCityWorkshopStewards,
} from '../../js/systems/city-workshop-assignments.js';
import { getCityWorkshopContacts } from '../../js/systems/city-workshop-contacts.js';
import { getCityMarketCyclePreview } from '../../js/systems/city-market-cycle.js';
import { discoverCharacterProductionSources } from '../../js/systems/character-production-sources.js';
import SaveSystem from '../../js/systems/save-system.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import { ensureSettlementCityState } from '../../js/systems/city-state.js';

function setup({ owner = 'player', building = 'blacksmith', parcelState = 'occupied' } = {}) {
  const city = {
    id: 'edirne-v174', name: 'Edirne', type: 'city', tier: 3, population: 0,
    ownerFactionId: owner,
    cityState: {
      parcels: [{ id: 'forge-one', state: parcelState, buildingIds: [building] }],
      infrastructure: { installedBuildingIds: [], improvementLevels: {} },
    },
  };
  const roster = createWorldCharacterRoster({ seed: 1648, settlements: [city], perSettlement: 2 });
  expect(promoteWorldCharacter(roster, roster.characters[0].id, { day: 2 })).toBe(true);
  expect(promoteWorldCharacter(roster, roster.characters[1].id, { day: 2 })).toBe(true);
  const sourceId = discoverCharacterProductionSources([city])
    .find(source => source.type === 'production')?.id || 'built-ghost';
  const organization = emptyCharacterOrganizationState();
  const party = { factionId: 'player', gold: 500 };
  const options = { city, party, roster, organization, sourceId, day: 5 };
  return { ...options, first: roster.characters[0].id, second: roster.characters[1].id };
}

describe('WEB V1.74 — explicit single-source workshop stewards', () => {
  it('assigns an existing local living NamedCharacter to a single actual workshop', () => {
    const x = setup();
    const beforeGold = x.party.gold;
    const beforeProduction = getCityMarketCyclePreview(x.city);
    const beforeContacts = getCityWorkshopContacts(x.city, x.roster);
    const first = appointCityWorkshopSteward({ ...x, characterId: x.first });
    expect(first.ok).toBe(true);
    const row = x.organization.assignments[0];
    expect(row).toMatchObject({
      characterId: x.first, branch: 'trade_network', assignmentRole: WORKSHOP_STEWARD_ROLE,
      assignmentStatus: 'active', assignmentLocation: { kind: 'settlement', settlementId: x.city.id },
      assignmentSource: { type: 'production', id: x.sourceId, settlementId: x.city.id },
    });
    expect(x.organization.memberships).toEqual([]);
    expect(x.party.gold).toBe(beforeGold);
    expect(getCityMarketCyclePreview(x.city)).toEqual(beforeProduction);
    expect(getCityWorkshopContacts(x.city, x.roster)).toEqual(beforeContacts);
    const summary = listCityWorkshopStewards(x);
    expect(summary.sources).toHaveLength(1);
    expect(summary.sources[0].steward.characterId).toBe(x.first);
    expect(summary.eligible.map(person => person.characterId)).toEqual([x.second]);
  });

  it('rejects second steward at an occupied shop and duplicate active character duty', () => {
    const x = setup();
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(true);
    const before = JSON.stringify(x.organization);
    expect(appointCityWorkshopSteward({ ...x, characterId: x.second }).ok).toBe(false);
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    expect(JSON.stringify(x.organization)).toBe(before);
  });

  it('cannot appoint in a foreign city even when the named character is nearby', () => {
    const x = setup({ owner: 'ottoman' });
    const snapshot = JSON.stringify(x);
    expect(listCityWorkshopStewards(x).canManage).toBe(false);
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    expect(JSON.stringify(x)).toBe(snapshot);
  });

  it('does not assign to locked, imaginary, deleted or mismatched city workshop', () => {
    const x = setup();
    expect(appointCityWorkshopSteward({ ...x, sourceId: 'built-fake', characterId: x.first }).ok)
      .toBe(false);
    const before = JSON.stringify(x.organization);
    x.city.cityState.parcels[0].state = 'locked';
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    x.city.cityState.parcels[0].state = 'occupied';
    x.city.cityState.parcels[0].buildingIds = [];
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    expect(JSON.stringify(x.organization)).toBe(before);
  });

  it('rejects generated, dead, moved-away or already assigned characters', () => {
    const x = setup();
    x.roster.characters[0].kind = 'generated';
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    x.roster.characters[0].kind = 'named';
    x.roster.characters[0].status = 'dead';
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    x.roster.characters[0].status = 'alive';
    x.roster.characters[0].location.settlementId = 'other-city';
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    x.roster.characters[0].location.settlementId = x.city.id;
    expect(startCharacterAssignment(x.organization, x.first, {
      roster: x.roster, settlements: [x.city], day: 4, reason: 'Existing city clerk duty',
      branch: 'city_administration', assignmentRole: 'ledger_clerk',
      assignmentLocation: { kind: 'settlement', settlementId: x.city.id },
    })).toBe(true);
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(false);
    expect(x.organization.assignments).toHaveLength(1);
  });

  it('releases only correct workshop duty and retains completed assignment history', () => {
    const x = setup();
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(true);
    const before = JSON.stringify(x.organization);
    expect(releaseCityWorkshopSteward({ ...x, characterId: x.second, day: 6 }).ok).toBe(false);
    expect(JSON.stringify(x.organization)).toBe(before);
    const release = releaseCityWorkshopSteward({ ...x, characterId: x.first, day: 6 });
    expect(release.ok).toBe(true);
    expect(x.organization.assignments[0]).toMatchObject({
      assignmentStatus: 'completed', endDay: 6, assignmentSource: { id: x.sourceId },
    });
    expect(listCityWorkshopStewards(x).sources[0].occupied).toBe(false);
    expect(appointCityWorkshopSteward({ ...x, characterId: x.second, day: 7 }).ok).toBe(true);
    expect(x.organization.assignments).toHaveLength(2);
    expect(x.organization.assignments.filter(r => r.assignmentStatus === 'active'))
      .toHaveLength(1);
  });

  it('preserves source-bound duty in established save normalization, old duties unchanged', () => {
    const x = setup();
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(true);
    expect(startCharacterAssignment(x.organization, x.second, {
      roster: x.roster, settlements: [x.city], day: 6,
      branch: 'city_administration', assignmentRole: 'ledger_clerk',
      assignmentLocation: { kind: 'settlement', settlementId: x.city.id },
      reason: 'Ledger clerk duty assigned',
    })).toBe(true);
    const before = JSON.stringify(x.organization);
    const restored = normalizeCharacterOrganizationState(
      JSON.parse(before), { roster: x.roster, settlements: [x.city] });
    expect(restored).toEqual(x.organization);
    expect(restored.assignments[0].assignmentSource).toEqual({
      type: 'production', id: x.sourceId, settlementId: x.city.id,
    });
    expect(restored.assignments[1].assignmentSource).toBeUndefined();
    expect(new SaveSystem().normalizePayload({ schemaVersion: 1, game: {
      characterOrganization: restored,
    }}).ok).toBe(true);
  });

  it('sanitizes forged source IDs or unregistered physical workshops on load', () => {
    const x = setup();
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first }).ok).toBe(true);
    const forged = structuredClone(x.organization);
    forged.assignments[0].assignmentSource.id = 'built-another-parcel';
    expect(normalizeCharacterOrganizationState(forged, {
      roster: x.roster, settlements: [x.city],
    }).assignments).toEqual([]);
    x.city.cityState.parcels[0].buildingIds = ['carpenter'];
    expect(normalizeCharacterOrganizationState(x.organization, {
      roster: x.roster, settlements: [x.city],
    }).assignments).toEqual([]);
    expect(x.organization.assignments).toHaveLength(1); // no mutation from normalization
  });

  it('cannot fake workshop steward role without registered source and world registry', () => {
    const x = setup();
    const base = {
      roster: x.roster, settlements: [x.city], day: 5,
      branch: 'trade_network', assignmentRole: WORKSHOP_STEWARD_ROLE,
      assignmentLocation: { kind: 'settlement', settlementId: x.city.id },
      reason: 'Manual workshop steward assignment',
    };
    expect(startCharacterAssignment(x.organization, x.first, base)).toBe(false);
    expect(startCharacterAssignment(x.organization, x.first, {
      ...base, settlements: undefined,
      assignmentSource: { type: 'production', id: x.sourceId, settlementId: x.city.id },
    })).toBe(false);
    expect(startCharacterAssignment(x.organization, x.first, {
      ...base, branch: 'party',
      assignmentSource: { type: 'production', id: x.sourceId, settlementId: x.city.id },
    })).toBe(false);
    expect(startCharacterAssignment(x.organization, x.first, {
      ...base, assignmentRole: 'ledger_clerk',
      assignmentSource: { type: 'production', id: x.sourceId, settlementId: x.city.id },
    })).toBe(false);
    expect(x.organization.assignments).toEqual([]);
  });

  it('survives real SaveManager save/load after City V2 workshop restoration', () => {
    const city = {
      id: 'istanbul-reload-174', name: 'Istanbul', type: 'city', tier: 4,
      ownerFactionId: 'ottoman', historicalFactionId: 'ottoman',
      population: 25000,
    };
    ensureSettlementCityState(city);
    const sourceId = discoverCharacterProductionSources([city])
      .find(source => source.type === 'production')?.id;
    expect(sourceId).toBeTruthy();
    const roster = createWorldCharacterRoster({ seed: 1648, settlements: [city], perSettlement: 2 });
    const person = roster.characters[0];
    expect(promoteWorldCharacter(roster, person.id, { day: 2 })).toBe(true);
    const organization = emptyCharacterOrganizationState();
    expect(appointCityWorkshopSteward({
      city, party: { factionId: 'ottoman', gold: 150 },
      roster, organization, sourceId, characterId: person.id, day: 6,
    }).ok).toBe(true);
    const game = {
      playerParty: { gold: 350, factionId: 'ottoman', roster: [] },
      itemCatalog: [], settings: {},
      worldManager: {
        enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {}, worldEncounterPartyByEnemyId: {},
      },
      ensureInventoryModel: () => {}, ensureRosterState: () => {},
    };
    const state = {
      mode: 'map', day: 6, seed: 1648, map: { settlements: [city] },
      worldCharacters: roster, characterOrganization: organization,
    };
    const manager = new SaveManager(state);
    manager.init(game);
    const payload = manager.buildSavePayload();
    expect(payload.game.characterOrganization.assignments[0].assignmentSource.id)
      .toBe(sourceId);
    const saved = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(payload)));
    expect(saved.ok).toBe(true);
    const loadedCity = {
      id: city.id, name: city.name, type: city.type,
      historicalFactionId: city.historicalFactionId, ownerFactionId: city.ownerFactionId,
      tier: city.tier, population: city.population,
    };
    const loadedState = { mode: 'map', day: 1, map: { settlements: [loadedCity] } };
    const loader = new SaveManager(loadedState);
    loader.init({ ...game, playerParty: { gold: 0, factionId: 'ottoman', roster: [] } });
    expect(loader.applySavePayload(saved.data)).toBe(true);
    expect(discoverCharacterProductionSources([loadedCity])
      .some(source => source.id === sourceId)).toBe(true);
    expect(loadedState.characterOrganization.assignments[0]).toMatchObject({
      characterId: person.id, assignmentRole: WORKSHOP_STEWARD_ROLE,
      assignmentSource: { id: sourceId, type: 'production' },
      assignmentStatus: 'active',
    });
    const view = listCityWorkshopStewards({
      city: loadedCity, party: { factionId: 'ottoman' },
      roster: loadedState.worldCharacters,
      organization: loadedState.characterOrganization,
    });
    expect(view.sources.some(source => source.sourceId === sourceId
      && source.steward?.characterId === person.id)).toBe(true);
  });

  it('rejects an invalid day without changing organization, coins or residents', () => {
    const x = setup();
    const before = JSON.stringify(x);
    expect(appointCityWorkshopSteward({ ...x, characterId: x.first, day: -1 }).ok).toBe(false);
    expect(JSON.stringify(x)).toBe(before);
  });
});
