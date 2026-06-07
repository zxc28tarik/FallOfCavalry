import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  applySavedSettlementCityState,
  canUseCityService,
  constructBuildingOnParcel,
  ensureSettlementCityState,
  initializeGeneratedCityStates,
  listBuildOptionsForParcel,
  serializeAllSettlementCityStates,
} from '../../js/systems/city-state.js';

function makeSettlement(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Bursa',
    type: overrides.type ?? CONST.SETTLEMENT.TYPE.CITY,
    owner: overrides.owner ?? CONST.FACTION.ID.OTTOMAN,
    ownerFactionId: overrides.ownerFactionId ?? CONST.FACTION.ID.PLAYER,
    population: overrides.population ?? 12000,
    garrison: overrides.garrison ?? 220,
    taxRate: overrides.taxRate ?? 0.15,
    ...overrides,
  };
}

describe('city-state initialization', () => {
  it('marks the first city of a faction as capital tier 4', () => {
    const settlements = [
      makeSettlement({ id: 1, name: 'Istanbul', type: CONST.SETTLEMENT.TYPE.CITY, owner: CONST.FACTION.ID.OTTOMAN }),
      makeSettlement({ id: 2, name: 'Bursa', type: CONST.SETTLEMENT.TYPE.CITY, owner: CONST.FACTION.ID.OTTOMAN }),
      makeSettlement({ id: 3, name: 'Edirne Hisar', type: CONST.SETTLEMENT.TYPE.FORT, owner: CONST.FACTION.ID.OTTOMAN }),
    ];
    initializeGeneratedCityStates(settlements);
    expect(settlements[0].cityState.role).toBe('capital');
    expect(settlements[0].cityState.tier).toBe(4);
    expect(settlements[0].cityState.assetRoot).toBe('assets/city-scenes/ottoman');
    expect(settlements[0].cityState.manifestPath).toContain('cityscene_ottoman_full_manifest.template.json');
    const innerCore = settlements[0].cityState.parcels.find((parcel) => parcel.id === 'inner_citadel_core');
    expect(innerCore.fill).toBe('full');
    expect(innerCore.buildingIds).toContain('palace');
    expect(innerCore.buildingIds).toContain('reisulkuttab_office');
    expect(settlements[1].cityState.role).not.toBe('capital');
  });

  it('creates hard-gated services from occupied area buildings', () => {
    const settlement = makeSettlement();
    initializeGeneratedCityStates([settlement]);
    expect(settlement.cityState.services.trade).toBeTruthy();
    expect(typeof settlement.cityState.services.trade.available).toBe('boolean');
    expect(canUseCityService(settlement, 'diplomacy')).toBe(true);
    expect(canUseCityService(settlement, 'tax')).toBe(true);
    expect(settlement.cityState.infrastructure.managerLabel).toBe('Sehir Kethudasi');
  });
});

describe('city-state building construction', () => {
  it('lists build options for a developable area', () => {
    const settlement = makeSettlement();
    initializeGeneratedCityStates([settlement]);
    const targetArea = settlement.cityState.parcels.find((parcel) => listBuildOptionsForParcel(settlement, parcel.id).length > 0);
    expect(targetArea).toBeTruthy();
    const options = listBuildOptionsForParcel(settlement, targetArea.id);
    expect(Array.isArray(options)).toBe(true);
  });

  it('constructs a building on an owned area', () => {
    const settlement = makeSettlement();
    initializeGeneratedCityStates([settlement]);
    const targetParcel = settlement.cityState.parcels.find((parcel) => {
      return listBuildOptionsForParcel(settlement, parcel.id).length > 0;
    });

    expect(targetParcel).toBeTruthy();
    const buildOption = listBuildOptionsForParcel(settlement, targetParcel.id)[0];
    const result = constructBuildingOnParcel(settlement, targetParcel.id, buildOption.id, {
      playerFactionId: CONST.FACTION.ID.PLAYER,
      availableGold: 999,
    });
    expect(result.ok).toBe(true);
    const refreshed = ensureSettlementCityState(settlement).parcels.find((parcel) => parcel.id === targetParcel.id);
    expect(refreshed.buildingIds).toContain(buildOption.id);
  });
});

describe('city-state serialization', () => {
  it('serializes all settlement city states into a dedicated block', () => {
    const settlements = [makeSettlement({ id: 11 }), makeSettlement({ id: 12, owner: CONST.FACTION.ID.HRE })];
    initializeGeneratedCityStates(settlements);
    const payload = serializeAllSettlementCityStates(settlements);
    expect(payload.version).toBe(1);
    expect(payload.settlements).toHaveLength(2);
    expect(payload.settlements[0]).toHaveProperty('cityState.sceneId');
  });

  it('restores saved parcel state', () => {
    const settlement = makeSettlement({ id: 25 });
    initializeGeneratedCityStates([settlement]);
    const serialized = serializeAllSettlementCityStates([settlement]).settlements[0].cityState;
    const firstParcel = serialized.parcels[0];
    firstParcel.overlayAsset = '/art/test-overlay.png';
    firstParcel.notes = ['restored'];
    firstParcel.buildingIds = [...(firstParcel.buildingIds || []), 'court_house'];
    settlement.cityState = null;
    applySavedSettlementCityState(settlement, serialized);
    const restored = ensureSettlementCityState(settlement);
    expect(restored.parcels[0].overlayAsset).toBe('/art/test-overlay.png');
    expect(restored.parcels[0].notes).toContain('restored');
    expect(restored.parcels[0].buildingIds).toContain('court_house');
  });
});
