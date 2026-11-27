import * as CONST from '../constants.js';
import { mirrorMarketStockChange } from './market-stock-bridge.js';
import { observeMarketMovement } from './market-cargo-report.js';
import { advanceCityMarketCycle } from './city-market-cycle.js';
import { getStance } from './factions.js';
import { getWarTradeTariffMultiplier } from './events.js';

function hashSeed(input) {
  const str = String(input || 'seed');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureInventory(party) {
  if (!party.inventory || typeof party.inventory !== 'object') party.inventory = { items: [], capacity: null };
  if (!Array.isArray(party.inventory.items)) party.inventory.items = [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMarket(market) {
  if (!market || typeof market !== 'object') return;
  if (!market.stocks || typeof market.stocks !== 'object') market.stocks = {};
  if (!market.demand || typeof market.demand !== 'object') market.demand = {};
  if (!market.momentum || typeof market.momentum !== 'object') market.momentum = {};
  const migrateMap = (map, combine = (a, b) => a + b) => {
    Object.entries(CONST.TRADE_GOOD_ID_ALIASES || {}).forEach(([fromId, toId]) => {
      if (!Object.prototype.hasOwnProperty.call(map, fromId)) return;
      if (Object.prototype.hasOwnProperty.call(map, toId)) map[toId] = combine(Number(map[toId] ?? 0), Number(map[fromId] ?? 0));
      else map[toId] = map[fromId];
      delete map[fromId];
    });
  };
  migrateMap(market.stocks);
  migrateMap(market.demand, (a, b) => Number(((a + b) / 2).toFixed(2)));
  migrateMap(market.momentum, (a, b) => Number(((a + b) / 2).toFixed(2)));
}

function settlementTier(settlement) {
  return Number.isFinite(settlement?.tier)
    ? settlement.tier
    : CONST.SETTLEMENT_TIER[String(settlement?.type || '').toLowerCase()] || CONST.SETTLEMENT_TIER.village;
}

function resolveMarketCfg(ctx) {
  return { ...CONST.MARKET, ...(ctx?.tuning?.MARKET || {}) };
}

function getDiplomacyTradeMultiplier(options) {
  const ownerFactionId = options?.ownerFactionId;
  const playerFactionId = options?.playerFactionId || 'player';
  const factions = options?.factions;
  if (!ownerFactionId || !factions) return 1;
  const relationsCfg = options?.diplomacyRelations || CONST.DIPLOMACY_RELATIONS;
  const stance = getStance(factions, playerFactionId, ownerFactionId, relationsCfg);
  const dipCfg = options?.diplomacyCfg || CONST.DIPLOMACY_ACTIONS;
  if (stance === 'WAR') return Number(dipCfg.WAR_TRADE_PENALTY_MULT ?? 1);
  if (stance === 'ALLY') return Number(dipCfg.ALLY_TRADE_DISCOUNT_MULT ?? 1);
  return 1;
}


function getRegionTradePriceMult(itemId, options) {
  const mods = Array.isArray(options?.activeRegionModifiers) ? options.activeRegionModifiers : [];
  if (!mods.length) return 1;
  let mult = 1;
  mods.forEach((mod) => {
    if (mod?.id === 'famine' && ['wheat', 'flour', 'bread', 'meat', 'fish'].includes(CONST.normalizeTradeGoodId?.(itemId) || itemId)) mult *= 1.4;
    if (mod?.id === 'prosperity') mult *= 0.9;
  });
  return Math.max(0.5, Math.min(2.5, mult));
}

function clampMomentum(raw, cfg = CONST.MARKET) {
  return clamp(raw, -Number(cfg.MOMENTUM_MAX_ABS), Number(cfg.MOMENTUM_MAX_ABS));
}

export function initMarket(settlement, seed) {
  const tier = settlementTier(settlement);
  const rng = mulberry32(hashSeed(`${settlement?.id || 'settlement'}:${seed || 1}:market`));
  const stocks = {};
  const demand = {};
  const momentum = {};
  (CONST.TRADE_ITEMS || []).forEach((item, index) => {
    stocks[item.id] = Math.max(1, Math.floor((4 + tier * 2) + rng() * (8 + index % 3)));
    demand[item.id] = Number((-0.12 + rng() * 0.24).toFixed(2));
    momentum[item.id] = 0;
  });
  return { stocks, demand, momentum };
}

export function getPrice(settlement, market, itemId, side = 'buy', options = null) {
  normalizeMarket(market);
  const normalizedId = CONST.normalizeTradeGoodId?.(itemId) || itemId;
  const item = (CONST.TRADE_ITEMS || []).find((it) => it.id === normalizedId);
  if (!item) return 1;
  const tier = settlementTier(settlement);
  const demandShift = Number(market?.demand?.[normalizedId] ?? 0);
  const demand = Math.max(0.2, 1 + demandShift);
  const stock = Number(market?.stocks?.[normalizedId] ?? 0);
  const scarcity = stock <= 0
    ? 1 + CONST.TRADE_PRICE_PARAMS.maxScarcityBoost
    : 1 + Math.max(-CONST.TRADE_PRICE_PARAMS.maxScarcityBoost, Math.min(CONST.TRADE_PRICE_PARAMS.maxScarcityBoost, (4 - stock) * CONST.TRADE_PRICE_PARAMS.supplyWeight));
  const tierMult = 1 + ((tier - 2) * CONST.TRADE_PRICE_PARAMS.tierWeight);
  const biomeMult = 1 + ((settlement?.biomeMod || 0) * CONST.TRADE_PRICE_PARAMS.biomeWeight);

  let price = item.basePrice * demand * scarcity * tierMult * biomeMult;
  const cfg = resolveMarketCfg(options);
  const momentum = clampMomentum(Number(market?.momentum?.[normalizedId] ?? 0), cfg);
  price *= side === 'buy' ? (1 + momentum) : (1 - (momentum * 0.5));
  price *= getDiplomacyTradeMultiplier(options);
  price *= getRegionTradePriceMult(normalizedId, options);
  price *= getWarTradeTariffMultiplier(options?.worldEvents, settlement, options?.ownerFactionId, options?.eventsCfg || CONST.EVENTS);
  if (side === 'sell') {
    price *= CONST.TRADE_PRICE_PARAMS.sellFactor;
    const opportunity = getActiveOpportunity(settlement, normalizedId, options);
    if (opportunity) {
      const baseSellPrice = price;
      const boosted = baseSellPrice * (1 + (Number(opportunity.bonusPct) / 100));
      const baseRounded = Math.max(1, Math.round(baseSellPrice));
      price = Math.round(boosted) <= baseRounded ? (baseRounded + 1) : boosted;
    }
  }
  // V1.60 local accord premium is applied only to successful wheat SALES.
  // The city manager resolves eligibility from actual saved NPC relationships.
  if(side==='sell'&&normalizedId==='wheat'){
    const bonus=Math.max(0,Math.min(11,
      Math.max(0,Math.min(8,Number(options?.accordTradeBonusPct)||0))
      +Math.max(0,Math.min(3,Number(options?.regionalTradeBonusPct)||0))));
    if(bonus>0){
      const current=Math.max(1,Math.round(price));
      price=Math.max(current+1,Math.round(price*(1+bonus/100)));
    }
  }
  return Math.max(1, Math.round(price));
}

function getActiveOpportunity(settlement, itemId, options) {
  const data = options && typeof options === 'object' ? options : null;
  const opportunities = data?.marketOpportunities;
  if (!opportunities || typeof opportunities !== 'object') return null;
  const settlementKey = data.settlementKey || settlement?.id || `${settlement?.tx},${settlement?.ty}`;
  const opportunity = opportunities[settlementKey];
  if (!opportunity) return null;
  const normalizedId = CONST.normalizeTradeGoodId?.(itemId) || itemId;
  const opportunityId = CONST.normalizeTradeGoodId?.(opportunity.itemId) || opportunity.itemId;
  if (opportunityId !== normalizedId) return null;
  const day = Number(data?.day ?? 1);
  if (Number.isFinite(opportunity.expiresDay) && day > Number(opportunity.expiresDay)) return null;
  return opportunity;
}

export function buy(party, market, settlement, itemId, qty, options) {
  ensureInventory(party);
  normalizeMarket(market);
  const normalizedId = CONST.normalizeTradeGoodId?.(itemId) || itemId;
  const count = Math.max(1, Math.floor(qty || 1));
  const stock = Math.max(0, Math.floor(market?.stocks?.[normalizedId] ?? 0));
  if (stock <= 0) return { ok: false, message: 'Stok yok.' };
  const amount = Math.min(stock, count);
  const price = getPrice(settlement, market, normalizedId, 'buy', options);
  const total = price * amount;
  if ((party.gold || 0) < total) return { ok: false, message: 'Altın yetersiz.' };

  party.gold -= total;
  market.stocks[normalizedId] = stock - amount;
  mirrorMarketStockChange(settlement, market, normalizedId, stock, stock - amount);
  observeMarketMovement({
    kind: 'modern_buy', ledger: 'market', settlement, market,
    itemId: normalizedId, before: stock, after: stock - amount,
    day: Math.max(1, Math.floor(Number(options?.day) || 1)),
  });
  const item = (CONST.TRADE_ITEMS || []).find((it) => it.id === normalizedId);
  const existing = party.inventory.items.find((it) => it.id === normalizedId);
  if (existing) existing.qty = Math.max(0, Math.floor(existing.qty || 0)) + amount;
  else party.inventory.items.push({ id: normalizedId, name: item?.name || normalizedId, qty: amount });
  const cfg = resolveMarketCfg(options);
  const momentumDelta = Number(cfg.MOMENTUM_PER_QTY) * amount;
  market.momentum[normalizedId] = clampMomentum(Number(market?.momentum?.[normalizedId] ?? 0) + momentumDelta, cfg);
  return {
    ok: true,
    message: `${item?.name || itemId} x${amount} alındı.`,
    qty: amount,
    spentGold: total,
    deltaGold: -total,
  };
}

export function sell(party, market, settlement, itemId, qty, options) {
  ensureInventory(party);
  normalizeMarket(market);
  const normalizedId = CONST.normalizeTradeGoodId?.(itemId) || itemId;
  const count = Math.max(1, Math.floor(qty || 1));
  const entry = party.inventory.items.find((it) => (CONST.normalizeTradeGoodId?.(it.id) || it.id) === normalizedId);
  const have = Math.max(0, Math.floor(entry?.qty ?? 0));
  if (have <= 0) return { ok: false, message: 'Envanterde yok.' };

  const amount = Math.min(have, count);
  const price = getPrice(settlement, market, normalizedId, 'sell', options);
  const total = price * amount;
  const item = (CONST.TRADE_ITEMS || []).find((it) => it.id === normalizedId);
  party.gold = Math.max(0, Math.floor((party.gold || 0) + total));
  entry.id = normalizedId;
  entry.name = item?.name || entry.name || normalizedId;
  entry.qty = have - amount;
  if (entry.qty <= 0) {
    party.inventory.items = party.inventory.items.filter((it) => (CONST.normalizeTradeGoodId?.(it.id) || it.id) !== normalizedId);
  }
  const stockBefore = Math.max(0, Math.floor(market?.stocks?.[normalizedId] ?? 0));
  market.stocks[normalizedId] = stockBefore + amount;
  mirrorMarketStockChange(settlement, market, normalizedId, stockBefore, stockBefore + amount);
  observeMarketMovement({
    kind: 'modern_sell', ledger: 'market', settlement, market,
    itemId: normalizedId, before: stockBefore, after: stockBefore + amount,
    day: Math.max(1, Math.floor(Number(options?.day) || 1)),
  });
  const cfg = resolveMarketCfg(options);
  const momentumDelta = Number(cfg.MOMENTUM_PER_QTY) * amount;
  market.momentum[normalizedId] = clampMomentum(Number(market?.momentum?.[normalizedId] ?? 0) - momentumDelta, cfg);
  return {
    ok: true,
    message: `${item?.name || itemId} x${amount} satıldı.`,
    qty: amount,
    earnedGold: total,
    deltaGold: total,
  };
}

function getTierStockCeil(settlement) {
  const tier = settlementTier(settlement);
  if (tier >= CONST.SETTLEMENT_TIER.city) return CONST.MARKET.STOCK_CEIL_CITY;
  if (tier >= CONST.SETTLEMENT_TIER.town) return CONST.MARKET.STOCK_CEIL_TOWN;
  return CONST.MARKET.STOCK_CEIL_VILLAGE;
}

export function advanceMarketOneDay(settlement, market, ctx = {}) {
  if (!market || typeof market !== 'object') return;
  normalizeMarket(market);

  const day = Number.isFinite(ctx?.day) ? ctx.day : 1;
  const settlementKey = ctx?.settlementKey || settlement?.id || `${settlement?.tx},${settlement?.ty}`;
  const seedBase = `${ctx?.seed ?? 'seed'}:${day}:${settlementKey}`;
  const rng = mulberry32(hashSeed(seedBase));
  const cfg = resolveMarketCfg(ctx);
  const biomeKey = String(ctx?.biomeKey || settlement?.biomeKey || 'PLAINS').toUpperCase();
  const biomeBiasMap = CONST.MARKET_BIOME_PRODUCTION?.[biomeKey] || {};
  const tierStockCeil = getTierStockCeil(settlement);

  for (const item of (CONST.TRADE_ITEMS || [])) {
    const itemId = item.id;

    const stockMin = Number(cfg.DRIFT_STOCK_STEP_RANGE?.[0] ?? -3);
    const stockMax = Number(cfg.DRIFT_STOCK_STEP_RANGE?.[1] ?? 5);
    const stockStep = Math.floor(rng() * (stockMax - stockMin + 1)) + stockMin;
    const biomeBias = Number(biomeBiasMap[itemId] ?? 0);
    const previousStock = market.stocks[itemId];
    const nextStock = Math.floor(Number(previousStock ?? 0) + stockStep + biomeBias);
    market.stocks[itemId] = clamp(nextStock, Number(cfg.STOCK_FLOOR), tierStockCeil);
    mirrorMarketStockChange(settlement, market, itemId,
      previousStock, market.stocks[itemId]);
    observeMarketMovement({
      kind: 'day_drift', ledger: 'market', settlement, market,
      itemId, before: previousStock, after: market.stocks[itemId],
      day: Math.max(1, Math.floor(Number(ctx?.day) || 1)),
    });

    const demandMin = Number(cfg.DRIFT_DEMAND_STEP_RANGE?.[0] ?? -0.08);
    const demandMax = Number(cfg.DRIFT_DEMAND_STEP_RANGE?.[1] ?? 0.10);
    const demandStep = demandMin + (rng() * (demandMax - demandMin));
    let demand = Number(market.demand[itemId] ?? 0) + demandStep;
    demand += (0 - demand) * Number(cfg.DEMAND_MEAN_REVERT);
    market.demand[itemId] = clamp(demand, -0.6, 0.6);

    const momentum = Number(market.momentum[itemId] ?? 0) * Number(cfg.MOMENTUM_DECAY);
    market.momentum[itemId] = clampMomentum(momentum, cfg);
  }

  // V1.70: operate only real placed mills and bakeries on the real market
  // ledger, then consume the population's existing food stocks. Keep the
  // established daily market drift and all trade pricing behavior intact.
  advanceCityMarketCycle(settlement, market, { day: Math.floor(day) });
}

export default {
  initMarket,
  getPrice,
  buy,
  sell,
  advanceMarketOneDay,
};
