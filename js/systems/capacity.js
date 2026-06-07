import * as CONST from '../constants.js';

const DEFAULT_WEIGHTS = Object.freeze({
  wheat: 3,
  flour: 3,
  bread: 2,
  meat: 2,
  fish: 2,
  wood: 4,
  iron: 5,
  cloth: 2,
  salt: 1,
});

function itemWeight(itemId) {
  const normalizedId = CONST.normalizeTradeGoodId?.(itemId) || itemId;
  const fromConst = (CONST.TRADE_ITEMS || []).find((it) => it.id === normalizedId)?.weight;
  if (Number.isFinite(fromConst)) return fromConst;
  return DEFAULT_WEIGHTS[normalizedId] ?? 1;
}

export function computeCarryWeight(inventory) {
  const items = Array.isArray(inventory?.items) ? inventory.items : [];
  return items.reduce((sum, it) => {
    const qty = Math.max(0, Math.floor(it?.qty ?? 0));
    return sum + (qty * itemWeight(it?.id));
  }, 0);
}

export function computeCapacity(party) {
  const rosterCount = Array.isArray(party?.roster) ? party.roster.length : 0;
  return CONST.CAPACITY.BASE_CAPACITY + (rosterCount * CONST.CAPACITY.PER_UNIT_CAPACITY);
}

export function computeOvercapSpeedMult(weight, cap) {
  const safeCap = Math.max(1, Number(cap || 1));
  const safeWeight = Math.max(0, Number(weight || 0));
  if (safeWeight <= safeCap) return 1;
  const ratio = (safeWeight - safeCap) / safeCap;
  const mult = 1 - Math.min(0.45, ratio * 0.5);
  return Math.max(CONST.CAPACITY.OVERCAP_SPEED_MULT_MIN, Number(mult.toFixed(3)));
}

export default {
  computeCarryWeight,
  computeCapacity,
  computeOvercapSpeedMult,
};
