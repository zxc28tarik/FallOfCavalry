import * as CONST from '../constants.js';

export function getBattleMoraleConfig(gameLike) {
  const defaults = CONST.BATTLE_MORALE || {};
  const tuning = gameLike?.getEffectiveTuning?.()?.BATTLE_MORALE || {};
  return { ...defaults, ...tuning };
}

export function clampMorale(unit, cfg) {
  const max = Math.max(1, Number(cfg?.MORALE_MAX ?? CONST.BATTLE_MORALE.MORALE_MAX));
  if (!Number.isFinite(unit.moraleMax) || unit.moraleMax <= 0) unit.moraleMax = max;
  unit.moraleMax = max;
  const next = Number.isFinite(unit.morale) ? unit.morale : max;
  unit.morale = Math.max(0, Math.min(unit.moraleMax, next));
  return unit.morale;
}

export function applyMoraleDamage(unit, damage, cfg, battleTimeSec = 0) {
  if (!unit || unit.dead) return 0;
  const amount = Math.max(0, Number(damage || 0)) * Math.max(0, Number(cfg?.DAMAGE_TO_MORALE ?? 0));
  unit.morale = Math.max(0, (Number(unit.morale) || 0) - amount);
  unit.lastDamageAt = battleTimeSec;
  return amount;
}

export function applyAllyDeathShock(deadUnit, units, cfg) {
  if (!deadUnit || !Array.isArray(units)) return 0;
  const radius = Math.max(1, Number(cfg?.SHOCK_RADIUS ?? 90));
  const radiusSq = radius * radius;
  const shock = Math.max(0, Number(cfg?.ALLY_DEATH_SHOCK ?? 0));
  let hitCount = 0;
  for (const ally of units) {
    if (!ally || ally.dead || ally.hp <= 0 || ally.side !== deadUnit.side || ally.unitId === deadUnit.unitId) continue;
    const dx = (ally.x || 0) - (deadUnit.x || 0);
    const dy = (ally.y || 0) - (deadUnit.y || 0);
    if ((dx * dx) + (dy * dy) > radiusSq) continue;
    ally.morale = Math.max(0, (Number(ally.morale) || 0) - shock);
    hitCount += 1;
  }
  return hitCount;
}

export default {
  getBattleMoraleConfig,
  clampMorale,
  applyMoraleDamage,
  applyAllyDeathShock,
};
