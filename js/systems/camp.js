import * as CONST from '../constants.js';

export function ensureCampState(state) {
  if (!state) return;
  if (!state.camp || typeof state.camp !== 'object') {
    state.camp = { active: false, watch: 'med' };
  }
  if (typeof state.camp.active !== 'boolean') state.camp.active = false;
  if (!['low', 'med', 'high'].includes(state.camp.watch)) state.camp.watch = 'med';
}

export function toggleCamp(state) {
  ensureCampState(state);
  state.camp.active = !state.camp.active;
  return state.camp.active;
}

export function setWatch(state, level) {
  ensureCampState(state);
  if (!['low', 'med', 'high'].includes(level)) return false;
  state.camp.watch = level;
  return true;
}

export function rollRaid(state, rng = Math.random) {
  ensureCampState(state);
  const mult = CONST.CAMP.WATCH_MULT[state.camp.watch] ?? 1;
  const chance = CONST.CAMP.RAID_BASE_CHANCE * mult;
  return rng() < chance;
}

export function applyCampBenefits(party) {
  if (!party) return;
  if (Array.isArray(party.roster)) {
    party.roster.forEach((u) => {
      if (!u) return;
      const hp = Math.max(1, Math.floor(u.hp ?? u.maxHp ?? 1));
      const maxHp = Math.max(1, Math.floor(u.maxHp ?? hp));
      u.hp = Math.min(maxHp, hp + CONST.CAMP.CAMP_HEAL_PER_DAY);
      if (typeof u.wounded === 'boolean') {
        u.wounded = (u.hp / maxHp) <= 0.35;
      }
    });
  }
  party.morale = Math.min(100, Math.floor((party.morale ?? 50) + 1));
}

export default {
  ensureCampState,
  toggleCamp,
  setWatch,
  rollRaid,
  applyCampBenefits,
};
