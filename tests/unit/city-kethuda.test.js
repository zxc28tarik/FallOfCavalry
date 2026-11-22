import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  applySavedSettlementCityState,
  initializeGeneratedCityStates,
  serializeSettlementCityState,
} from '../../js/systems/city-state.js';
import {
  executeKethudaProject,
  getKethudaCivicDiscount,
  getKethudaStatus,
  listKethudaProjects,
} from '../../js/systems/city-kethuda.js';
import { applyCivicDecision, getEffectiveCivicDecision } from '../../js/systems/city-civic-decisions.js';

const make = (overrides = {}) => {
  const city = {
    id: 6, name: 'Bursa', type: CONST.SETTLEMENT.TYPE.CITY,
    owner: CONST.FACTION.ID.OTTOMAN,
    ownerFactionId: CONST.FACTION.ID.PLAYER,
    population: 2000, security: 50, ...overrides,
  };
  initializeGeneratedCityStates([city]);
  return city;
};
const party = () => ({
  factionId: CONST.FACTION.ID.PLAYER, gold: 1000, renown: 0,
});

describe('V1.68 Kethuda real infrastructure', () => {
  it('provides nine actual catalog projects and dynamic population need', () => {
    const city = make();
    const projects = listKethudaProjects({ city, party: party(), day: 4 });
    expect(projects).toHaveLength(9);
    expect(projects.map(p => p.id)).toContain('sewer_canal');
    expect(projects.every(p => p.cost > 0)).toBe(true);
    const before = getKethudaStatus(city);
    city.population = 45000;
    const after = getKethudaStatus(city);
    expect(after.need).toBeGreaterThan(before.need);
    expect(after.unmet).toBeGreaterThanOrEqual(before.unmet);
  });

  it('constructs a missing service with real gold, capacity and save roundtrip', () => {
    const city = make();
    const ruler = party();
    const before = getKethudaStatus(city);
    const candidate = listKethudaProjects({ city, party: ruler, day: 3 })
      .find(p => p.available && !p.installed);
    expect(candidate).toBeTruthy();
    const result = executeKethudaProject({ city, party: ruler, day: 3, buildingId: candidate.id });
    expect(result.ok).toBe(true);
    expect(ruler.gold).toBe(1000 - candidate.cost);
    expect(getKethudaStatus(city).installedIds).toContain(candidate.id);
    expect(getKethudaStatus(city).capacity).toBe(before.capacity + 1);
    const saved = serializeSettlementCityState(city);
    city.cityState = null;
    applySavedSettlementCityState(city, saved);
    expect(getKethudaStatus(city).installedIds).toContain(candidate.id);
    expect(getKethudaStatus(city).lastWorkDay).toBe(3);
    expect(executeKethudaProject({ city, party: ruler, day: 3, buildingId: candidate.id }).ok).toBe(false);
  });

  it('upgrades an existing service and pays only once, reducing an actual civic charge', () => {
    const city = make();
    const ruler = party();
    const service = listKethudaProjects({ city, party: ruler, day: 1 })
      .find(p => p.installed && ['well', 'fountain', 'cistern', 'aqueduct_channel',
        'paved_main_road', 'side_road', 'bridge_crossing', 'drainage_line', 'sewer_canal'].includes(p.id));
    expect(service).toBeTruthy();
    const before = getKethudaStatus(city);
    const result = executeKethudaProject({ city, party: ruler, day: 1, buildingId: service.id });
    expect(result.ok).toBe(true);
    expect(getKethudaStatus(city).capacity).toBe(before.capacity + 1);
    const decision = ['paved_main_road', 'side_road', 'bridge_crossing'].includes(service.id)
      ? 'patrol' : 'granary';
    expect(getKethudaCivicDiscount(city, decision)).toBe(5);
    const offer = getEffectiveCivicDecision({ city, party: ruler, day: 2, decisionId: decision });
    expect(offer.kethudaDiscount).toBe(5);
    const beforeGold = ruler.gold;
    const applied = applyCivicDecision({ city, party: ruler, day: 2, decisionId: decision });
    expect(applied.ok).toBe(true);
    expect(ruler.gold).toBe(beforeGold - offer.cost);
  });

  it('rejects foreign cities, unaffordable, invalid, repeated and backdated work atomically', () => {
    const city = make();
    const foreign = party();
    foreign.factionId = CONST.FACTION.ID.HRE;
    const id = listKethudaProjects({ city, party: party(), day: 2 })[0].id;
    const before = JSON.stringify(serializeSettlementCityState(city));
    expect(executeKethudaProject({ city, party: foreign, day: 2, buildingId: id }).ok).toBe(false);
    const poor = party();
    poor.gold = 0;
    expect(executeKethudaProject({ city, party: poor, day: 2, buildingId: id }).ok).toBe(false);
    expect(executeKethudaProject({ city, party: party(), day: 2, buildingId: 'fake-service' }).ok).toBe(false);
    expect(executeKethudaProject({ city, party: party(), day: -1, buildingId: id }).ok).toBe(false);
    expect(JSON.stringify(serializeSettlementCityState(city))).toBe(before);
    const ruler = party();
    expect(executeKethudaProject({ city, party: ruler, day: 2, buildingId: id }).ok).toBe(true);
    const after = JSON.stringify(serializeSettlementCityState(city));
    expect(executeKethudaProject({ city, party: ruler, day: 2, buildingId: id }).ok).toBe(false);
    expect(executeKethudaProject({ city, party: ruler, day: 1, buildingId: id }).ok).toBe(false);
    expect(JSON.stringify(serializeSettlementCityState(city))).toBe(after);
  });

  it('does not accept forged service ids or uninstalled improvements from saved state', () => {
    const city = make();
    const saved = serializeSettlementCityState(city);
    saved.infrastructure.installedBuildingIds.push('fake-bridge');
    saved.infrastructure.improvementLevels = {
      'fake-bridge': 2, 'sewer_canal': 999, 'paved_main_road': -6,
    };
    saved.infrastructure.lastWorkDay = '999999';
    city.cityState = null;
    applySavedSettlementCityState(city, saved);
    const status = getKethudaStatus(city);
    expect(status.installedIds).not.toContain('fake-bridge');
    expect(status.improvementLevels['fake-bridge']).toBeUndefined();
    expect(status.improvementLevels.paved_main_road).toBeGreaterThanOrEqual(0);
    expect(status.lastWorkDay).toBe(0);
    expect(getKethudaCivicDiscount(city, 'levy')).toBe(0);
  });

  it('never gives a discount merely for starter infrastructure', () => {
    const city = make();
    expect(getKethudaCivicDiscount(city, 'patrol')).toBe(0);
    expect(getKethudaCivicDiscount(city, 'granary')).toBe(0);
    expect(getKethudaCivicDiscount(city, 'levy')).toBe(0);
  });
});
