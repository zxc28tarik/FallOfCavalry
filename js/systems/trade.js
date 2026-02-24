import * as CONST from '../constants.js';

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

export function initMarket(settlement, seed) {
  const tier = Number.isFinite(settlement?.tier)
    ? settlement.tier
    : CONST.SETTLEMENT_TIER[String(settlement?.type || '').toLowerCase()] || CONST.SETTLEMENT_TIER.village;
  const rng = mulberry32(hashSeed(`${settlement?.id || 'settlement'}:${seed || 1}:market`));
  const stocks = {};
  const demand = {};
  (CONST.TRADE_ITEMS || []).forEach((item, index) => {
    stocks[item.id] = Math.max(1, Math.floor((4 + tier * 2) + rng() * (8 + index % 3)));
    demand[item.id] = Number((0.85 + rng() * 0.5).toFixed(2));
  });
  return { stocks, demand };
}

export function getPrice(settlement, market, itemId, side = 'buy', options = null) {
  const item = (CONST.TRADE_ITEMS || []).find((it) => it.id === itemId);
  if (!item) return 1;
  const tier = Number.isFinite(settlement?.tier)
    ? settlement.tier
    : CONST.SETTLEMENT_TIER[String(settlement?.type || '').toLowerCase()] || CONST.SETTLEMENT_TIER.village;
  const demand = Number(market?.demand?.[itemId] ?? 1);
  const stock = Number(market?.stocks?.[itemId] ?? 0);
  const scarcity = stock <= 0
    ? 1 + CONST.TRADE_PRICE_PARAMS.maxScarcityBoost
    : 1 + Math.max(-CONST.TRADE_PRICE_PARAMS.maxScarcityBoost, Math.min(CONST.TRADE_PRICE_PARAMS.maxScarcityBoost, (4 - stock) * CONST.TRADE_PRICE_PARAMS.supplyWeight));
  const tierMult = 1 + ((tier - 2) * CONST.TRADE_PRICE_PARAMS.tierWeight);
  const biomeMult = 1 + ((settlement?.biomeMod || 0) * CONST.TRADE_PRICE_PARAMS.biomeWeight);

  let price = item.basePrice * demand * scarcity * tierMult * biomeMult;
  if (side === 'sell') {
    price *= CONST.TRADE_PRICE_PARAMS.sellFactor;
    const opportunity = getActiveOpportunity(settlement, itemId, options);
    if (opportunity) {
      const baseSellPrice = price;
      const boosted = baseSellPrice * (1 + (Number(opportunity.bonusPct) / 100));
      const baseRounded = Math.max(1, Math.round(baseSellPrice));
      price = Math.round(boosted) <= baseRounded ? (baseRounded + 1) : boosted;
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
  if (!opportunity || opportunity.itemId !== itemId) return null;
  const day = Number(data?.day ?? 1);
  if (Number.isFinite(opportunity.expiresDay) && day > Number(opportunity.expiresDay)) return null;
  return opportunity;
}

export function buy(party, market, settlement, itemId, qty, options) {
  ensureInventory(party);
  const count = Math.max(1, Math.floor(qty || 1));
  const stock = Math.max(0, Math.floor(market?.stocks?.[itemId] ?? 0));
  if (stock <= 0) return { ok: false, message: 'Stok yok.' };
  const amount = Math.min(stock, count);
  const price = getPrice(settlement, market, itemId, 'buy', options);
  const total = price * amount;
  if ((party.gold || 0) < total) return { ok: false, message: 'Altın yetersiz.' };

  party.gold -= total;
  market.stocks[itemId] = stock - amount;
  const item = (CONST.TRADE_ITEMS || []).find((it) => it.id === itemId);
  const existing = party.inventory.items.find((it) => it.id === itemId);
  if (existing) existing.qty = Math.max(0, Math.floor(existing.qty || 0)) + amount;
  else party.inventory.items.push({ id: itemId, name: item?.name || itemId, qty: amount });
  return { ok: true, message: `${item?.name || itemId} x${amount} alındı.` };
}

export function sell(party, market, settlement, itemId, qty, options) {
  ensureInventory(party);
  const count = Math.max(1, Math.floor(qty || 1));
  const entry = party.inventory.items.find((it) => it.id === itemId);
  const have = Math.max(0, Math.floor(entry?.qty ?? 0));
  if (have <= 0) return { ok: false, message: 'Envanterde yok.' };

  const amount = Math.min(have, count);
  const price = getPrice(settlement, market, itemId, 'sell', options);
  const total = price * amount;
  party.gold = Math.max(0, Math.floor((party.gold || 0) + total));
  entry.qty = have - amount;
  if (entry.qty <= 0) {
    party.inventory.items = party.inventory.items.filter((it) => it.id !== itemId);
  }
  market.stocks[itemId] = Math.max(0, Math.floor(market?.stocks?.[itemId] ?? 0)) + amount;
  const item = (CONST.TRADE_ITEMS || []).find((it) => it.id === itemId);
  return { ok: true, message: `${item?.name || itemId} x${amount} satıldı.` };
}

export default {
  initMarket,
  getPrice,
  buy,
  sell,
};
