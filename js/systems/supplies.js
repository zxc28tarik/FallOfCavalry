import * as CONST from '../constants.js';

export function ensureSuppliesState(state) {
  if (!state) return;
  if (!state.supplies || typeof state.supplies !== 'object') {
    state.supplies = { food: 30 };
  }
  if (!Number.isFinite(state.supplies.food)) state.supplies.food = 30;
  if (!state.status || typeof state.status !== 'object') state.status = {};
  if (typeof state.status.starving !== 'boolean') state.status.starving = false;
}

export function computeDailyConsumption(party) {
  const units = Array.isArray(party?.roster) ? party.roster.length : 0;
  return CONST.SUPPLIES.DAILY_BASE_CONSUMPTION + (units * CONST.SUPPLIES.DAILY_PER_UNIT_CONSUMPTION);
}

export function applyEndOfDay(state, party, { inCamp = false } = {}) {
  ensureSuppliesState(state);
  const mult = inCamp ? CONST.CAMP.CAMP_CONSUMPTION_MULT : 1;
  const consumed = computeDailyConsumption(party) * mult;

  state.supplies.food = Math.max(0, Number((state.supplies.food - consumed).toFixed(2)));

  let moraleDelta = 0;
  let starved = false;
  if (state.supplies.food <= 0) {
    starved = true;
    moraleDelta = -Math.abs(CONST.SUPPLIES.STARVATION_MORALE_PENALTY);
    if (party) {
      party.morale = Math.max(0, Math.floor((party.morale ?? 50) + moraleDelta));
    }
  }

  state.status.starving = starved;
  return { consumed, starved, moraleDelta };
}

export default {
  ensureSuppliesState,
  computeDailyConsumption,
  applyEndOfDay,
};
