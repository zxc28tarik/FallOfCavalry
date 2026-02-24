import * as CONST from '../constants.js';

export function keyOfPoi(poi) {
  return `${poi?.x},${poi?.y},${poi?.type}`;
}

export function ensurePoiState(state) {
  if (!state || typeof state !== 'object') return {};
  if (!state.poiState || typeof state.poiState !== 'object' || Array.isArray(state.poiState)) {
    state.poiState = {};
  }
  return state.poiState;
}

export function getNearestPoi(map, partyX, partyY, tileSize) {
  if (!map || !Array.isArray(map.pois) || map.pois.length === 0) return null;
  const pois = Array.isArray(map?.pois) ? map.pois : [];
  if (!pois.length || !Number.isFinite(partyX) || !Number.isFinite(partyY)) return null;

  const normalizedTileSize = Number.isFinite(tileSize) && tileSize > 0 ? tileSize : CONST.WORLD.TILE_SIZE;
  let nearest = null;

  for (const poi of pois) {
    if (!poi || !Number.isFinite(poi.x) || !Number.isFinite(poi.y)) continue;
    const wx = poi.x * normalizedTileSize + normalizedTileSize * 0.5;
    const wy = poi.y * normalizedTileSize + normalizedTileSize * 0.5;
    const distPx = Math.hypot((partyX - wx), (partyY - wy));
    const distTiles = distPx / normalizedTileSize;
    if (!nearest || distTiles < nearest.distTiles) {
      nearest = { poi, distTiles };
    }
  }

  return nearest;
}

export function getCooldownRemainingDays(state, poi) {
  const poiState = ensurePoiState(state);
  const key = keyOfPoi(poi);
  const lastVisitedDay = Number(poiState?.[key]?.lastVisitedDay ?? -99999);
  const day = Number(state?.day ?? 1);
  return Math.max(0, CONST.POI.COOLDOWN_DAYS - (day - lastVisitedDay));
}

export function canInteract(state, poi) {
  return getCooldownRemainingDays(state, poi) <= 0;
}

function createDeterministicRng(seed, day, poi) {
  const typeSalt = poi?.type === 'ruin' ? 0x9e3779b9 : 0x7f4a7c15;
  let s = (Number(seed) | 0)
    ^ (((Number(poi?.x) || 0) * 73856093) | 0)
    ^ (((Number(poi?.y) || 0) * 19349663) | 0)
    ^ (((Number(day) || 0) * 83492791) | 0)
    ^ typeSalt;
  if (!Number.isFinite(s)) s = 1337;
  s >>>= 0;

  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function randInt(rand, min, max) {
  const lo = Math.floor(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rand() * (hi - lo + 1));
}

export function rollOutcome({ seed, day, poi, context } = {}) {
  const normalizedType = (poi?.type === 'camp' || poi?.type === 'ruin') ? poi.type : 'ruin';
  const normalizedPoi = { ...poi, type: normalizedType };
  const rand = createDeterministicRng(seed, day, normalizedPoi);
  const isRuin = normalizedPoi.type === 'ruin';
  const baseAmbushChance = isRuin ? CONST.POI.AMBUSH_CHANCE_RUIN : CONST.POI.AMBUSH_CHANCE_CAMP;
  const riskMult = context?.onRoad ? CONST.POI.AMBUSH_RISK_MULT_ON_ROAD : CONST.POI.AMBUSH_RISK_MULT_OFFROAD;
  const ambushChance = Math.max(0, Math.min(1, baseAmbushChance * riskMult));

  if (rand() < ambushChance) {
    const enemyId = `poi-ambush-${normalizedPoi.type}-${normalizedPoi?.x ?? 0}-${normalizedPoi?.y ?? 0}-${day ?? 0}`;
    return { kind: 'ambush', enemyId };
  }

  const [goldMin, goldMax] = CONST.POI.LOOT_GOLD_RANGE;
  const [foodMin, foodMax] = CONST.POI.LOOT_FOOD_RANGE;
  const items = Array.isArray(CONST.TRADE_ITEMS) ? CONST.TRADE_ITEMS : [];
  const picked = items.length ? items[Math.floor(rand() * items.length)] : null;
  let itemQty = randInt(rand, 1, 3);
  let gold = randInt(rand, goldMin, goldMax);
  const food = randInt(rand, foodMin, foodMax);
  let rare = false;

  if (rand() < CONST.POI.RARE_BONUS_CHANCE) {
    const [rareGoldMin, rareGoldMax] = CONST.POI.RARE_BONUS_GOLD_RANGE;
    const [rareQtyMin, rareQtyMax] = CONST.POI.RARE_BONUS_ITEM_QTY_RANGE;
    gold += randInt(rand, rareGoldMin, rareGoldMax);
    itemQty += randInt(rand, rareQtyMin, rareQtyMax);
    rare = true;
  }

  const loot = {
    gold,
    food,
    items: picked ? [{ id: picked.id, qty: itemQty }] : [],
  };

  return { kind: 'loot', loot, rare };
}

export function markInvestigated(state, poi) {
  ensurePoiState(state);
  const key = keyOfPoi(poi);
  state.poiState[key] = state.poiState[key] || {};
  state.poiState[key].lastVisitedDay = Number(state?.day ?? 1);
  state.poiState[key].discovered = true;
  return state.poiState[key];
}
