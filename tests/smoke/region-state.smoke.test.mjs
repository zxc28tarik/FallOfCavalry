import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import {
  createInitialRegionState,
  addRegionModifier,
  getActiveRegionModifiers,
  applyPOIOutcomeToRegion,
} from '../../js/systems/region-state.js';
import { POI_TYPES, REGION_MODIFIERS } from '../../js/constants.js';

describe('region-state', () => {
  it('block 1', () => {
    const state = createInitialRegionState();

    addRegionModifier(state, {
      id: REGION_MODIFIERS.FAMINE.id,
      regionId: 'region-a',
      startDay: 1,
      endDay: 3,
    });
    assert.equal(getActiveRegionModifiers(state, 'region-a', 2).length, 1, 'modifier active during duration');
    assert.equal(getActiveRegionModifiers(state, 'region-a', 4).length, 0, 'modifier expires after endDay');

    applyPOIOutcomeToRegion({
      regionState: state,
      poi: { type: POI_TYPES.SHRINE, regionId: 'region-b' },
      outcomeType: 'blessing',
      currentDay: 7,
    });
    assert.equal(
      getActiveRegionModifiers(state, 'region-b', 7).some((entry) => entry.id === REGION_MODIFIERS.PILGRIMAGE.id),
      true,
      'shrine adds pilgrimage',
    );

    addRegionModifier(state, {
      id: REGION_MODIFIERS.HIGH_BANDITRY.id,
      regionId: 'region-c',
      startDay: 3,
      endDay: 14,
    });
    applyPOIOutcomeToRegion({
      regionState: state,
      poi: { type: POI_TYPES.FORT, regionId: 'region-c' },
      outcomeType: 'fort_cleared',
      currentDay: 4,
    });
    assert.equal(
      getActiveRegionModifiers(state, 'region-c', 5).some((entry) => entry.id === REGION_MODIFIERS.HIGH_BANDITRY.id),
      false,
      'fort clearing removes high banditry',
    );

    applyPOIOutcomeToRegion({
      regionState: state,
      poi: { type: POI_TYPES.BATTLEFIELD, regionId: 'region-d' },
      outcomeType: 'ambush',
      currentDay: 8,
    });
    assert.equal(
      getActiveRegionModifiers(state, 'region-d', 8).some((entry) => entry.id === REGION_MODIFIERS.FAMINE.id),
      true,
      'battlefield ambush can add famine',
    );
  });
});
