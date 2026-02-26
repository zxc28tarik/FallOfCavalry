import * as CONST from '../constants.js';

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export function computeUnitCohesion(unit, allies, radius = CONST.BATTLE_FORMATION.COHESION_RADIUS, cap = CONST.BATTLE_FORMATION.COHESION_ALLY_CAP) {
  if (!unit || !Array.isArray(allies) || allies.length <= 1) return 0;
  const safeRadius = Math.max(1, Number(radius) || 1);
  const safeCap = Math.max(1, Number(cap) || 1);
  let nearby = 0;
  for (const ally of allies) {
    if (!ally || ally === unit || ally.dead || ally.hp <= 0) continue;
    const d = Math.hypot((ally.x || 0) - (unit.x || 0), (ally.y || 0) - (unit.y || 0));
    if (d <= safeRadius) nearby += 1;
  }
  return clamp01(nearby / safeCap);
}

export function getFormationMultipliers(unit, cohesion, tuning = CONST.BATTLE_FORMATION) {
  const c = clamp01(cohesion);
  const formation = unit?.formation || CONST.FORMATION.LINE;
  const slot = Math.max(0, Math.floor(unit?.formSlot ?? 999));
  const frontSlots = Math.max(1, Number(tuning.WEDGE_FRONT_SLOTS) || 1);

  const result = {
    formationAtkMult: 1,
    formationDefMult: 1,
    formationSpeedMult: 1,
    formationRangedTakenMult: 1,
    formationMoraleShockMult: 1,
  };

  if (formation === CONST.FORMATION.LINE) {
    result.formationDefMult = 1 + (Number(tuning.LINE_DEF_BONUS) * c);
  } else if (formation === CONST.FORMATION.COLUMN) {
    result.formationSpeedMult = 1 + (Number(tuning.COLUMN_SPEED_BONUS) * c);
  } else if (formation === CONST.FORMATION.WEDGE) {
    const bonus = slot < frontSlots ? Number(tuning.WEDGE_FRONT_ATK_BONUS) : Number(tuning.WEDGE_REAR_ATK_BONUS);
    result.formationAtkMult = 1 + (bonus * c);
  } else if (formation === CONST.FORMATION.SCATTER) {
    result.formationRangedTakenMult = 1 - (Number(tuning.SCATTER_RANGED_TAKEN_REDUCTION) * c);
    result.formationMoraleShockMult = 1 - (Number(tuning.SCATTER_ALLY_DEATH_SHOCK_REDUCTION) * c);
  }

  return result;
}
