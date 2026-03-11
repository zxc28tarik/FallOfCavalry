import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import {
  createInitialWarState,
  ensureWar,
  addWarscore,
  evaluateWarOutcome,
  captureCity,
  updateCrisisFlag,
} from '../../js/systems/faction-wars.js';

const cfg = {
  WARSCORE_TO_FORCE_PEACE: 60,
  WARSCORE_TO_FORCE_LOSS: -60,
  CITY_CAPTURE_WARSCORE: 20,
  CRISIS_WAR_COUNT_THRESHOLD: 2,
};

describe('faction-wars', () => {
  it('block 1', () => {
    const warState = createInitialWarState();
    const war = ensureWar(warState, 'player', 'kingdom_a', 3);
    assert.ok(war, 'ensureWar should create record');
    assert.equal(war.warscore, 0, 'new war starts at zero warscore');

    addWarscore(warState, 'player', 'kingdom_a', 65, cfg);
    assert.equal(evaluateWarOutcome(warState, war, cfg), 'force_win', 'high positive score should force win');

    addWarscore(warState, 'player', 'kingdom_a', -200, cfg);
    assert.equal(evaluateWarOutcome(warState, war, cfg), 'force_loss', 'high negative score should force loss');

    const city = { id: 'c1', ownerFactionId: 'kingdom_a' };
    const captured = captureCity({ city, newOwnerFactionId: 'player', warState, factionsState: {}, cfg, currentDay: 4 });
    assert.equal(captured, true, 'captureCity should return true when ownership changes');
    assert.equal(city.ownerFactionId, 'player', 'captureCity should update city owner');

    ensureWar(warState, 'player', 'kingdom_b', 5);
    warState.wars[0].active = true;
    warState.wars[1].active = true;
    updateCrisisFlag(warState, {}, cfg);
    assert.equal(warState.crisisActive, true, 'crisis should be active at threshold');
    warState.wars[1].active = false;
    updateCrisisFlag(warState, {}, cfg);
    assert.equal(warState.crisisActive, false, 'crisis should clear below threshold');
  });
});
