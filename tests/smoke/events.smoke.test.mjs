import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import {
  createInitialEventState,
  addEvent,
  getActiveEvents,
  rollWarEvents,
  EVENT_TYPES,
} from '../../js/systems/events.js';

const cfg = {
  ENABLED: true,
  MAX_ACTIVE_EVENTS: 2,
  BASE_WAR_EVENT_CHANCE: 1,
  CRISIS_EVENT_CHANCE: 1,
  EVENT_DURATION_DAYS_MIN: 2,
  EVENT_DURATION_DAYS_MAX: 2,
  WAR_TAX_GOLD_MULT: 1.15,
  WAR_TRADE_TARIFF_MULT: 1.2,
  BANDIT_SPIKE_MULT: 1.5,
  REFUGEE_RENOWN_BONUS: 5,
};

describe('events', () => {
  it('block 1', () => {
    const state = createInitialEventState();
    addEvent(state, { id: 'e1', type: EVENT_TYPES.WAR_TAX, startDay: 1, endDay: 1 }, cfg);
    addEvent(state, { id: 'e2', type: EVENT_TYPES.BANDIT_SPIKE, startDay: 1, endDay: 5 }, cfg);
    addEvent(state, { id: 'e3', type: EVENT_TYPES.SIEGE_THREAT, startDay: 1, endDay: 5 }, cfg);
    assert.equal(state.activeEvents.length, 2, 'max active should keep latest two');
    assert.equal(state.history.length, 1, 'overflowed event should be moved to history');

    const activeAtDay3 = getActiveEvents(state, 3);
    assert.equal(activeAtDay3.length, 2, 'unexpired events stay active');

    state.activeEvents.push({ id: 'e4', type: EVENT_TYPES.WAR_FRONT_CRISIS, startDay: 1, endDay: 2 });
    const activeAtDay4 = getActiveEvents(state, 4);
    assert.equal(activeAtDay4.some((ev) => ev.id === 'e4'), false, 'expired event should be removed');
    assert.equal(state.history.some((ev) => ev.id === 'e4'), true, 'expired event should move to history');

    const warEventState = createInitialEventState();
    const rngValues = [0.1, 0.01, 0.2, 0.3, 0.4, 0.5];
    let idx = 0;
    const rng = () => {
      const val = rngValues[idx % rngValues.length];
      idx += 1;
      return val;
    };
    rollWarEvents({
      eventState: warEventState,
      warState: { crisisActive: true, wars: [{ aId: 'player', bId: 'kingdom_a', warscore: 45, active: true }] },
      factionsState: {},
      worldState: { settlements: [{ id: 'front-city', ownerFactionId: 'kingdom_a', tx: 20, ty: 10 }] },
      currentDay: 6,
      cfg,
      rng,
    });
    assert.equal(warEventState.activeEvents.length >= 1, true, 'crisis war should spawn at least one war event');

    const noWarState = createInitialEventState();
    rollWarEvents({
      eventState: noWarState,
      warState: { crisisActive: true, wars: [] },
      factionsState: {},
      worldState: { settlements: [] },
      currentDay: 6,
      cfg,
      rng,
    });
    assert.equal(noWarState.activeEvents.length, 0, 'no wars should not spawn war events');
  });
});
