import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  getCityWorkshopContacts,
} from '../../js/systems/city-workshop-contacts.js';
import {
  discoverCharacterProductionSources,
} from '../../js/systems/character-production-sources.js';
import {
  produceCharacterCandidates, registerProducedCharacter,
} from '../../js/systems/character-production.js';
import {
  createWorldCharacterRoster,
} from '../../js/systems/world-characters.js';
import {
  advanceCityMarketCycle, getCityMarketCyclePreview,
} from '../../js/systems/city-market-cycle.js';
import {
  auditMarketStockBridge, establishMarketStockBridge,
} from '../../js/systems/market-stock-bridge.js';

function scene({ cityId = 'edirne-173', parcelId = 'industrial', buildingId = 'tannery',
  state = 'active' } = {}) {
  const city = {
    id: cityId, name: 'Edirne', type: 'city', tier: 3,
    cultureId: 'generic', ownerFactionId: 'ottoman', population: 0,
    cityState: {
      parcels: [{ id: parcelId, state, buildingIds: [buildingId] }],
      infrastructure: { installedBuildingIds: [], improvementLevels: {} },
    },
  };
  const settlements = [city];
  const sources = discoverCharacterProductionSources(settlements);
  const roster = createWorldCharacterRoster({ seed: 1648, settlements, perSettlement: 0 });
  return { city, settlements, sources, roster };
}

function register(data, { day = 2 } = {}) {
  const source = data.sources.find(entry => entry.type === 'production');
  expect(source).toBeTruthy();
  const production = produceCharacterCandidates({
    worldSeed: 1648, source, settlements: data.settlements,
    registeredSources: data.sources, count: 1, day,
  });
  const character = registerProducedCharacter(
    data.roster, production, production.candidates[0].id, {
      day: day + 1, settlements: data.settlements,
      registeredSources: data.sources,
    },
  );
  expect(character).toBeTruthy();
  expect(character.kind).toBe('named');
  return character;
}

function marketFor(city, stock = {}) {
  const market = {
    stocks: Object.fromEntries(CONST.TRADE_ITEMS.map(item =>
      [item.id, stock[item.id] ?? 0])),
    demand: Object.fromEntries(CONST.TRADE_ITEMS.map(item => [item.id, 0])),
    momentum: {},
  };
  city.marketStock = CONST.TRADE_ITEMS.map(item =>
    ({ id: item.id, qty: market.stocks[item.id] }));
  expect(establishMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
  return market;
}

describe('WEB V1.73 — canonical workshop source to living character provenance', () => {
  it('links exactly registered named character to a real existing industry parcel', () => {
    const data = scene();
    const person = register(data);
    const result = getCityWorkshopContacts(data.city, data.roster);
    expect(result.cityId).toBe(String(data.city.id));
    expect(result.sourceCount).toBe(1);
    expect(result.contactCount).toBe(1);
    expect(result.sources[0]).toMatchObject({
      buildingId: 'tannery', parcelId: 'industrial',
      contacts: [{ characterId: person.id, name: person.name, role: person.role }],
    });
    expect(result.sources[0].sourceId).toBe(data.sources[0].id);
  });

  it('never treats an ordinary town resident or matching profession as workshop staff', () => {
    const data = scene({ buildingId: 'blacksmith' });
    const regular = createWorldCharacterRoster({
      seed: 2026, settlements: data.settlements, perSettlement: 2,
    });
    for (const person of regular.characters) person.role = 'artisan';
    const report = getCityWorkshopContacts(data.city, regular);
    expect(report.sourceCount).toBe(1);
    expect(report.contactCount).toBe(0);
    expect(report.sources[0].contacts).toEqual([]);
  });

  it('does not trust fabricated source history on an unrelated NPC identity', () => {
    const data = scene();
    const contact = register(data);
    const spoof = structuredClone(contact);
    spoof.id = 'npc:some-other-origin:1';
    spoof.name = 'Sahte Usta';
    data.roster.characters.push(spoof);
    // Even a valid source history cannot prove a mismatched actor identity.
    const result = getCityWorkshopContacts(data.city, data.roster);
    expect(result.contactCount).toBe(1);
    expect(result.sources[0].contacts.map(x => x.characterId)).toEqual([contact.id]);
    contact.history = [{ day: 1, type: 'created', sourceType: 'city', sourceId: 'edirne-173' }];
    expect(getCityWorkshopContacts(data.city, data.roster).contactCount).toBe(0);
  });

  it('does not claim former contacts as present after death or relocation', () => {
    const data = scene();
    const person = register(data);
    person.location = { kind: 'settlement', settlementId: 'istanbul' };
    expect(getCityWorkshopContacts(data.city, data.roster).contactCount).toBe(0);
    person.location.settlementId = data.city.id;
    person.status = 'dead';
    expect(getCityWorkshopContacts(data.city, data.roster).contactCount).toBe(0);
    person.status = 'alive';
    expect(getCityWorkshopContacts(data.city, data.roster).contactCount).toBe(1);
  });

  it('closed or removed real workshop does not produce or expose stale contacts', () => {
    const data = scene();
    register(data);
    const market = marketFor(data.city, { leather: 5, salt: 5 });
    expect(getCityMarketCyclePreview(data.city).recipes.find(r => r.buildingId === 'tannery').buildingCount)
      .toBe(1);
    data.city.cityState.parcels[0].state = 'locked';
    expect(getCityWorkshopContacts(data.city, data.roster).contactCount).toBe(0);
    expect(getCityMarketCyclePreview(data.city).recipes.find(r => r.buildingId === 'tannery').buildingCount)
      .toBe(0);
    expect(advanceCityMarketCycle(data.city, market, { day: 4 }).produced).toEqual([]);
    expect(market.stocks.leather).toBe(5);
    expect(market.stocks.processed_leather).toBe(0);
    expect(auditMarketStockBridge(data.city, market, CONST.TRADE_ITEMS).status).toBe('equal');
    data.city.cityState.parcels[0].state = 'active';
    data.city.cityState.parcels[0].buildingIds = [];
    expect(getCityWorkshopContacts(data.city, data.roster).sourceCount).toBe(0);
    expect(getCityMarketCyclePreview(data.city).recipes.find(r => r.buildingId === 'tannery').maxBatches)
      .toBe(0);
  });

  it('does not turn food workshops, markets or fake buildings into direct production sources', () => {
    for (const buildingId of ['mill', 'bakery', 'fish_market', 'market', 'not_a_building']) {
      const data = scene({ buildingId });
      expect(getCityWorkshopContacts(data.city, data.roster).sourceCount).toBe(0);
      expect(getCityWorkshopContacts(data.city, data.roster).contactCount).toBe(0);
    }
  });

  it('supports canonical zero numeric settlement and parcel IDs without identity mixup', () => {
    const data = scene({ cityId: 0, parcelId: 0, buildingId: 'blacksmith' });
    const person = register(data);
    const result = getCityWorkshopContacts(data.city, data.roster);
    expect(result.cityId).toBe('0');
    expect(result.sourceCount).toBe(1);
    expect(result.contactCount).toBe(1);
    expect(result.sources[0].parcelId).toBe('0');
    expect(result.sources[0].contacts[0].characterId).toBe(person.id);
  });

  it('reports only immutable source observations, never ownership, wages or assignments', () => {
    const data = scene({ buildingId: 'weaving_house' });
    const person = register(data);
    const party = { factionId: 'player', gold: 900 };
    const state = { data, party, personnelAssignments: [] };
    const before = JSON.stringify(state);
    const report = getCityWorkshopContacts(data.city, data.roster);
    expect(report.contactCount).toBe(1);
    expect(report.sources[0].contacts[0]).not.toHaveProperty('workshopOwnerCharacterId');
    expect(report.sources[0].contacts[0]).not.toHaveProperty('wagesGold');
    expect(report.sources[0].contacts[0]).not.toHaveProperty('employmentStatus');
    expect(JSON.stringify(state)).toBe(before);
    expect(person).not.toHaveProperty('workshopOwnerCharacterId');
    expect(party.gold).toBe(900);
  });
});
