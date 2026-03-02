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
  const typeSalts = {
    ruin: 0x9e3779b9,
    camp: 0x7f4a7c15,
    fort: 0x41c64e6d,
    shrine: 0x632be59b,
    battlefield: 0x1b873593,
    caravan_site: 0x85ebca6b,
  };
  const typeSalt = typeSalts[poi?.type] || typeSalts.ruin;
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

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function pickWeightedLossMode(rand, weights) {
  const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0);
  if (!entries.length) return 'food';
  const total = entries.reduce((sum, [, w]) => sum + Number(w), 0);
  let t = rand() * total;
  for (const [mode, weight] of entries) {
    t -= Number(weight);
    if (t <= 0) return mode;
  }
  return entries[entries.length - 1][0];
}

function pickAmbushLoss(rand) {
  const mode = pickWeightedLossMode(rand, CONST.POI.AMBUSH_LOSS_MODE_WEIGHTS);
  if (mode === 'gold') {
    const [min, max] = CONST.POI.AMBUSH_LOSS_GOLD_RANGE;
    return { mode, amount: randInt(rand, min, max) };
  }
  if (mode === 'morale') {
    const [min, max] = CONST.POI.AMBUSH_MORALE_PENALTY_RANGE;
    return { mode, amount: randInt(rand, min, max) };
  }
  const [min, max] = CONST.POI.AMBUSH_LOSS_FOOD_RANGE;
  return { mode: 'food', amount: randInt(rand, min, max) };
}

function maybeBuildClueOpportunity(rand, clueTarget, day) {
  if (clueTarget?.targetType !== 'settlement') return null;
  if (rand() >= CONST.POI.OPPORTUNITY_CHANCE_FROM_CLUE) return null;
  const items = Array.isArray(CONST.TRADE_ITEMS) ? CONST.TRADE_ITEMS : [];
  if (!items.length) return null;
  const item = items[Math.floor(rand() * items.length)];
  const [minBonus, maxBonus] = CONST.POI.OPPORTUNITY_BONUS_PCT_RANGE;
  const bonusPct = randInt(rand, minBonus, maxBonus);
  const durationDays = Math.max(1, Math.floor(CONST.POI.OPPORTUNITY_DURATION_DAYS));
  return {
    settlementKey: String(clueTarget.settlementKey || `${clueTarget.x},${clueTarget.y}`),
    itemId: item.id,
    bonusPct,
    expiresDay: Number(day ?? 1) + durationDays,
  };
}

function pickClueTarget(poi, context) {
  const map = context?.map;
  if (!map) return null;
  const pois = Array.isArray(map.pois) ? map.pois : [];
  const settlements = Array.isArray(map.settlements) ? map.settlements : [];

  const px = Number(poi?.x ?? 0);
  const py = Number(poi?.y ?? 0);

  let nearestPoi = null;
  let nearestPoiScore = Number.POSITIVE_INFINITY;
  for (const candidate of pois) {
    if (!candidate || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) continue;
    if (candidate.x === px && candidate.y === py && candidate.type === poi?.type) continue;
    const dist = Math.hypot(candidate.x - px, candidate.y - py);
    const weighted = dist * (candidate.type !== poi?.type ? 0.85 : 1);
    if (weighted < nearestPoiScore) {
      nearestPoiScore = weighted;
      nearestPoi = candidate;
    }
  }

  if (nearestPoi) {
    return {
      targetType: 'poi',
      x: nearestPoi.x,
      y: nearestPoi.y,
      label: nearestPoi.type === 'camp' ? 'Yakındaki kamp' : 'Yakındaki harabe',
    };
  }

  let nearestSettlement = null;
  let nearestSettlementDist = Number.POSITIVE_INFINITY;
  for (const settlement of settlements) {
    const sx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor(Number(settlement?.x ?? 0) / CONST.WORLD.TILE_SIZE);
    const sy = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor(Number(settlement?.y ?? 0) / CONST.WORLD.TILE_SIZE);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
    const dist = Math.hypot(sx - px, sy - py);
    if (dist < nearestSettlementDist) {
      nearestSettlementDist = dist;
      nearestSettlement = settlement;
    }
  }

  if (!nearestSettlement) return null;
  const targetX = Number.isFinite(nearestSettlement.tx) ? nearestSettlement.tx : Math.floor(Number(nearestSettlement.x ?? 0) / CONST.WORLD.TILE_SIZE);
  const targetY = Number.isFinite(nearestSettlement.ty) ? nearestSettlement.ty : Math.floor(Number(nearestSettlement.y ?? 0) / CONST.WORLD.TILE_SIZE);
  return {
    targetType: 'settlement',
    settlementId: nearestSettlement.id || null,
    settlementKey: nearestSettlement.id || `${targetX},${targetY}`,
    x: targetX,
    y: targetY,
    label: nearestSettlement.name || nearestSettlement.id || 'Yakın yerleşim',
  };
}

export function rollOutcome({ seed, day, poi, context, tuning } = {}) {
  const cfg = { ...CONST.POI, ...(tuning?.POI || {}) };
  const knownTypes = new Set(Object.values(CONST.POI_TYPES || { RUIN: 'ruin', CAMP: 'camp' }));
  const normalizedType = knownTypes.has(poi?.type) ? poi.type : 'ruin';
  const normalizedPoi = { ...poi, type: normalizedType };
  const rand = createDeterministicRng(seed, day, normalizedPoi);
  const isRuin = normalizedPoi.type === 'ruin';

  if (normalizedType === CONST.POI_TYPES.FORT) {
    const heavyAmbush = clamp01((cfg.AMBUSH_CHANCE_CAMP || 0.2) * 1.6);
    if (rand() < heavyAmbush) {
      const enemyId = `poi-fort-${normalizedPoi?.x ?? 0}-${normalizedPoi?.y ?? 0}-${day ?? 0}`;
      return {
        kind: cfg.OUTCOME.AMBUSH,
        enemyId,
        loss: pickAmbushLoss(rand),
        rewardOnVictory: { gold: randInt(rand, 14, 36), renown: randInt(rand, 3, 7) },
      };
    }
    return {
      kind: cfg.OUTCOME.LOOT,
      loot: { gold: randInt(rand, 18, 42), food: randInt(rand, 1, 3), items: [] },
      renown: randInt(rand, 2, 5),
      regionEffect: 'fort_cleared',
    };
  }

  if (normalizedType === CONST.POI_TYPES.SHRINE) {
    if (rand() < 0.55) {
      return {
        kind: cfg.OUTCOME.CLUE,
        clue: { targetType: 'blessing', label: 'Shrine blessing spread to the region' },
        reward: { gold: randInt(rand, 0, 3), food: randInt(rand, 0, 1) },
        renown: randInt(rand, 2, 4),
        relationBonus: 2,
        donationCost: randInt(rand, 4, 12),
        regionEffect: 'blessing',
      };
    }
    return {
      kind: cfg.OUTCOME.NOTHING,
      message: 'Sessiz bir dua ettin. Yolcuların uğrak yeri olmaya devam ediyor.',
      renown: 1,
      regionEffect: 'blessing',
    };
  }

  if (normalizedType === CONST.POI_TYPES.BATTLEFIELD) {
    if (rand() < 0.42) {
      return {
        kind: cfg.OUTCOME.AMBUSH,
        enemyId: `poi-battlefield-${normalizedPoi?.x ?? 0}-${normalizedPoi?.y ?? 0}-${day ?? 0}`,
        loss: pickAmbushLoss(rand),
        regionEffect: 'ambush',
      };
    }
    return {
      kind: cfg.OUTCOME.LOOT,
      loot: { gold: randInt(rand, 12, 34), food: randInt(rand, 2, 6), items: [] },
      renown: randInt(rand, 1, 3),
      regionEffect: 'loot',
    };
  }

  if (normalizedType === CONST.POI_TYPES.CARAVAN_SITE) {
    const item = (CONST.TRADE_ITEMS || [])[Math.floor(rand() * Math.max(1, CONST.TRADE_ITEMS.length))];
    return {
      kind: cfg.OUTCOME.CLUE,
      clue: { targetType: 'settlement', settlementKey: context?.nearestSettlementId || null, label: 'Ticaret rotası fırsatı' },
      reward: { gold: randInt(rand, 8, 16), food: randInt(rand, 1, 3) },
      opportunity: item
        ? {
          settlementKey: String(context?.nearestSettlementId || `${context?.settlementTx ?? 0},${context?.settlementTy ?? 0}`),
          itemId: item.id,
          bonusPct: randInt(rand, 18, 40),
          expiresDay: Number(day ?? 1) + Math.max(2, Math.floor(CONST.POI.OPPORTUNITY_DURATION_DAYS || 3)),
        }
        : null,
      renown: 1,
    };
  }
  const biomeRiskMult = Number(cfg.BIOME_RISK_MODS?.[context?.biomeKey]) || 1;
  const roadRiskMult = context?.onRoad ? cfg.AMBUSH_RISK_MULT_ON_ROAD : cfg.AMBUSH_RISK_MULT_OFFROAD;
  const settlementTier = Number(context?.settlementTier ?? 2);
  const settlementRiskMult = Number(cfg.AMBUSH_SETTLEMENT_TIER_MULT?.[settlementTier]) || 1;
  const baseAmbushChance = (isRuin ? cfg.AMBUSH_CHANCE_RUIN : cfg.AMBUSH_CHANCE_CAMP) * roadRiskMult * biomeRiskMult * settlementRiskMult;
  const baseClueChance = (isRuin ? cfg.CLUE_CHANCE_RUIN : cfg.CLUE_CHANCE_CAMP) * (context?.onRoad ? 0.9 : 1.1);
  const baseNothingChance = isRuin ? cfg.NOTHING_CHANCE_RUIN : cfg.NOTHING_CHANCE_CAMP;

  const ambushChance = clamp01(baseAmbushChance);
  const clueChance = clamp01(baseClueChance);
  const nothingChance = clamp01(baseNothingChance);
  const total = ambushChance + clueChance + nothingChance;
  const norm = total > 1 ? (1 / total) : 1;
  const ambushFinal = ambushChance * norm;
  const clueFinal = clueChance * norm;
  const nothingFinal = nothingChance * norm;

  const roll = rand();
  if (roll < ambushFinal) {
    const enemyId = `poi-ambush-${normalizedPoi.type}-${normalizedPoi?.x ?? 0}-${normalizedPoi?.y ?? 0}-${day ?? 0}`;
    return { kind: cfg.OUTCOME.AMBUSH, enemyId, loss: pickAmbushLoss(rand) };
  }

  if (roll < ambushFinal + clueFinal) {
    const clueTarget = pickClueTarget(normalizedPoi, context);
    if (!clueTarget) {
      return { kind: cfg.OUTCOME.NOTHING, message: 'Burada kayda değer bir şey yok...' };
    }
    const [clueGoldMin, clueGoldMax] = CONST.POI.CLUE_REWARD_GOLD_RANGE;
    const [clueFoodMin, clueFoodMax] = CONST.POI.CLUE_REWARD_FOOD_RANGE;
    return {
      kind: cfg.OUTCOME.CLUE,
      clue: clueTarget,
      opportunity: maybeBuildClueOpportunity(rand, clueTarget, day),
      reward: {
        gold: randInt(rand, clueGoldMin, clueGoldMax),
        food: randInt(rand, clueFoodMin, clueFoodMax),
      },
    };
  }

  if (roll < ambushFinal + clueFinal + nothingFinal) {
    return { kind: cfg.OUTCOME.NOTHING, message: 'Burada kayda değer bir şey yok...' };
  }

  const [goldMin, goldMax] = CONST.POI.LOOT_GOLD_RANGE;
  const [foodMin, foodMax] = CONST.POI.LOOT_FOOD_RANGE;
  const items = Array.isArray(CONST.TRADE_ITEMS) ? CONST.TRADE_ITEMS : [];
  const picked = items.length ? items[Math.floor(rand() * items.length)] : null;
  let itemQty = randInt(rand, 1, 3);
  let gold = randInt(rand, goldMin, goldMax);
  const food = randInt(rand, foodMin, foodMax);
  let rare = false;

  const rareRoadMult = context?.onRoad ? cfg.RARE_LOOT_ROAD_MULT_ON_ROAD : cfg.RARE_LOOT_ROAD_MULT_OFFROAD;
  const rareSettlementMult = Number(cfg.RARE_LOOT_SETTLEMENT_TIER_MULT?.[settlementTier]) || 1;
  const rareBiomeMult = 1 / Math.max(0.8, biomeRiskMult);
  const rareChance = clamp01(cfg.RARE_BONUS_CHANCE * rareRoadMult * rareSettlementMult * rareBiomeMult);

  if (rand() < rareChance) {
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

  return { kind: cfg.OUTCOME.LOOT, loot, rare };
}

export function markInvestigated(state, poi) {
  ensurePoiState(state);
  const key = keyOfPoi(poi);
  state.poiState[key] = state.poiState[key] || {};
  state.poiState[key].lastVisitedDay = Number(state?.day ?? 1);
  state.poiState[key].discovered = true;
  return state.poiState[key];
}
