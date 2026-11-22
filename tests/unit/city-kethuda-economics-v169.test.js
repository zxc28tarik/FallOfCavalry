import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  initializeGeneratedCityStates, listBuildOptionsForParcel,
  constructBuildingOnParcel, serializeSettlementCityState,
  applySavedSettlementCityState,
} from '../../js/systems/city-state.js';
import {
  KETHUDA_SERVICE_GROUPS, getKethudaServiceCoverage,
  getKethudaConstructionQuote,
} from '../../js/systems/city-infrastructure-benefits.js';
import {
  executeKethudaProject, getKethudaStatus, listKethudaProjects,
} from '../../js/systems/city-kethuda.js';

const make = (overrides = {}) => {
  const city = {
    id: 201, name: 'Edirne', type: CONST.SETTLEMENT.TYPE.CITY,
    owner: CONST.FACTION.ID.OTTOMAN,
    ownerFactionId: CONST.FACTION.ID.PLAYER,
    population: 12000, ...overrides,
  };
  initializeGeneratedCityStates([city]);
  return city;
};
const player = () => ({ factionId: CONST.FACTION.ID.PLAYER, gold: 5000 });
const buildOption = city => {
  for (const parcel of city.cityState.parcels) {
    const options = listBuildOptionsForParcel(city, parcel.id);
    const option = options.find(item => item.buildCostGold > 0);
    if (option) return { parcelId: parcel.id, option };
  }
  return null;
};

describe('WEB V1.69 — real city service demand and construction pricing', () => {
  it('derives three services from nine actual registered elements', () => {
    const city = make();
    const groups = getKethudaServiceCoverage(city);
    expect(Object.keys(groups)).toEqual(['water', 'roads', 'sanitation']);
    expect(Object.values(groups).every(g => g.need >= 1 && g.capacity >= 0)).toBe(true);
    expect(Object.values(groups).every(g => g.coveragePct >= 0 && g.coveragePct <= 100)).toBe(true);
    expect(Object.values(KETHUDA_SERVICE_GROUPS).flatMap(g => g.ids)).toHaveLength(9);
    expect(getKethudaStatus(city).serviceCoverage).toEqual(groups);
  });

  it('rising population increases demand without minting goods, gold, or infrastructure', () => {
    const city = make();
    const old = getKethudaServiceCoverage(city);
    const original = JSON.stringify(serializeSettlementCityState(city));
    const initialStock = JSON.stringify(city.marketStock);
    city.population = 72000;
    const next = getKethudaServiceCoverage(city);
    expect(next.water.need).toBeGreaterThan(old.water.need);
    expect(next.roads.need).toBeGreaterThan(old.roads.need);
    expect(next.sanitation.need).toBeGreaterThan(old.sanitation.need);
    expect(next.water.capacity).toBe(old.water.capacity);
    expect(JSON.stringify(serializeSettlementCityState(city))).toBe(original);
    expect(JSON.stringify(city.marketStock)).toBe(initialStock);
  });

  it('new valid road upgrades yield a bounded actual construction discount', () => {
    const city = make();
    const party = player();
    const target = buildOption(city);
    expect(target).toBeTruthy();
    const before = getKethudaConstructionQuote(city, target.option.id);
    expect(before).toBeTruthy();
    expect(before.discount).toBe(0);

    const chosen = listKethudaProjects({ city, party, day: 1 })
      .find(p => ['paved_main_road', 'side_road', 'bridge_crossing'].includes(p.id) && p.installed)
      || listKethudaProjects({ city, party, day: 1 }).find(p => p.id === 'side_road');
    expect(chosen.available).toBe(true);
    const first = executeKethudaProject({ city, party, day: 1, buildingId: chosen.id });
    expect(first.ok).toBe(true);
    if (!chosen.installed) {
      expect(executeKethudaProject({ city, party, day: 2, buildingId: chosen.id }).ok).toBe(true);
    }
    const price = getKethudaConstructionQuote(city, target.option.id);
    expect(price.discount).toBeGreaterThan(0);
    expect(price.cost).toBeLessThan(price.baseCost);
    expect(price.discountRate).toBeLessThanOrEqual(0.15);
    const beforeGold = party.gold;
    const rejected = constructBuildingOnParcel(city, target.parcelId, target.option.id, {
      playerFactionId: party.factionId, availableGold: price.cost - 1,
    });
    expect(rejected.ok).toBe(false);
    const built = constructBuildingOnParcel(city, target.parcelId, target.option.id, {
      playerFactionId: party.factionId, availableGold: price.cost,
    });
    expect(built.ok).toBe(true);
    expect(built.cost).toBe(price.cost);
    expect(built.baseCost).toBe(price.baseCost);
    expect(built.kethudaDiscount).toBe(price.discount);
    expect(party.gold).toBe(beforeGold); // Domain never silently charges party twice.
  });

  it('reloaded canonical city infrastructure gives the same construction quote', () => {
    const city = make();
    const party = player();
    const target = buildOption(city);
    let first = listKethudaProjects({ city, party, day: 1 })
      .find(p => ['paved_main_road', 'side_road', 'bridge_crossing'].includes(p.id) && p.installed);
    if (!first) first = listKethudaProjects({ city, party, day: 1 }).find(p => p.id === 'side_road');
    expect(executeKethudaProject({ city, party, day: 1, buildingId: first.id }).ok).toBe(true);
    if (!first.installed) {
      expect(executeKethudaProject({ city, party, day: 2, buildingId: first.id }).ok).toBe(true);
    }
    const price = getKethudaConstructionQuote(city, target.option.id);
    const serialized = serializeSettlementCityState(city);
    city.cityState = null;
    applySavedSettlementCityState(city, serialized);
    expect(getKethudaConstructionQuote(city, target.option.id)).toEqual(price);
  });

  it('rejects inappropriate infrastructure tier, culture, and unknown projects without charge', () => {
    const village = make({ type: CONST.SETTLEMENT.TYPE.VILLAGE });
    const party = player();
    const projects = listKethudaProjects({ city: village, party, day: 1 });
    const sewer = projects.find(p => p.id === 'sewer_canal');
    expect(sewer.available).toBe(false);
    const before = JSON.stringify(serializeSettlementCityState(village));
    expect(executeKethudaProject({ city: village, party, day: 1, buildingId: sewer.id }).ok).toBe(false);
    expect(party.gold).toBe(5000);
    expect(JSON.stringify(serializeSettlementCityState(village))).toBe(before);
    const nonOttoman = make({ owner: CONST.FACTION.ID.HRE, ownerFactionId: CONST.FACTION.ID.PLAYER });
    expect(listKethudaProjects({ city: nonOttoman, party, day: 1 })
      .filter(p => p.available)).toHaveLength(0);
    expect(getKethudaConstructionQuote(village, 'not-a-real-building')).toBeNull();
    expect(getKethudaConstructionQuote(village, 'well')).toBeNull();
  });

  it('uninstalled and forged improvement levels cannot grant free savings', () => {
    const city = make();
    const target = buildOption(city);
    const baseline = getKethudaConstructionQuote(city, target.option.id);
    city.cityState.infrastructure.improvementLevels = {
      not_a_road: 900, bridge_crossing: 900, paved_main_road: 900, side_road: 900,
    };
    const quote = getKethudaConstructionQuote(city, target.option.id);
    expect(quote.cost).toBeGreaterThanOrEqual(Math.floor(quote.baseCost * 0.85));
    expect(quote.discountRate).toBeLessThanOrEqual(0.15);
    const installed = new Set(city.cityState.infrastructure.installedBuildingIds);
    if (![...installed].some(id => ['bridge_crossing', 'paved_main_road', 'side_road'].includes(id))) {
      expect(quote).toEqual(baseline);
    }
  });
});
