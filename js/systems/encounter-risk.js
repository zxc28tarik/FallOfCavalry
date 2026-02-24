import * as CONST from '../constants.js';

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function computeRiskMultiplier({ state, movementCtx, biomeKey, inCamp, supplies, market } = {}) {
  const tuning = { ...CONST.ENCOUNTER_RISK, ...(state?.tuning?.ENCOUNTER_RISK || {}) };
  let mult = Number(tuning.BASE) || 1;

  const onRoad = Boolean(movementCtx?.onRoad);
  mult *= onRoad ? Number(tuning.ROAD_MULT) || 1 : Number(tuning.OFFROAD_MULT) || 1;

  const biomeRisk = Number(tuning.BIOME_MULT?.[biomeKey]) || 1;
  mult *= biomeRisk;

  if (state?.status?.starving) {
    mult *= Number(tuning.STARVING_MULT) || 1;
  }

  const food = Number(supplies?.food);
  if (Number.isFinite(food) && food < Number(tuning.LOW_SUPPLIES_THRESHOLD ?? 2)) {
    mult *= Number(tuning.LOW_SUPPLIES_MULT) || 1;
  }

  if (inCamp) {
    mult *= Number(tuning.CAMP_ACTIVE_MULT) || 1;
  }

  const scarcityThreshold = Number(tuning.SCARCITY_STOCK_THRESHOLD ?? 4);
  const grainStock = Number(market?.stocks?.grain);
  const meatStock = Number(market?.stocks?.meat);
  const hasScarcity = (Number.isFinite(grainStock) && grainStock < scarcityThreshold)
    || (Number.isFinite(meatStock) && meatStock < scarcityThreshold);
  if (hasScarcity) {
    mult *= Number(tuning.MARKET_SCARCITY_MULT) || 1;
  }

  return clamp(mult, Number(tuning.MIN_MULT ?? 0.4), Number(tuning.MAX_MULT ?? 2.5));
}

export function riskLabel(mult) {
  const value = Number(mult);
  if (!Number.isFinite(value)) return 'Orta';
  if (value <= Number(CONST.ENCOUNTER_RISK_UI.LOW_MAX ?? 0.85)) return 'Düşük';
  if (value >= Number(CONST.ENCOUNTER_RISK_UI.HIGH_MIN ?? 1.2)) return 'Yüksek';
  return 'Orta';
}
