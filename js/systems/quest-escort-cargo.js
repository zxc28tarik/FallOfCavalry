/**
 * V1.27 — quest cargo backed by the existing settlement.marketStock model.
 *
 * Goods are debited only from an actual registered source settlement and a
 * canonical item catalog. The manifest/loot receipt is in-process WeakMap
 * authority: neither an imported party nor a saved clone can mint goods.
 */
import { validEscortQuest, isLiveEscortParty } from './quest-caravan-escort.js';
import { isRuntimeRouteBandit } from './quest-route-recon.js';

const liveCargo = new WeakMap();
const banditCargo = new WeakMap();
const safeQty = value => Number.isSafeInteger(value) && value >= 0;
const same = (a, b) => a != null && b != null && String(a) === String(b);
const isLiveCargo = party => isLiveEscortParty(party) && liveCargo.has(party);
const cloneItems = items => items.map(x => ({ id: x.id, qty: x.qty }));
const itemCount = items => items.reduce((sum, x) => sum + x.qty, 0);

/** Inventory is reserved when the live quest convoy is spawned, not forged on load. */
export function reserveEscortCargo({
  caravan, quest, worldState, tradeRoutes, currentDay, catalog, maxUnits = 24,
} = {}) {
  const route = validEscortQuest(quest, worldState, tradeRoutes, currentDay);
  if (!route?.road || !isLiveEscortParty(caravan)
    || caravan.alive === false || liveCargo.has(caravan)
    || !same(caravan.escortQuestId, quest.id)
    || !same(caravan.routeId, route.routeId)
    || !same(caravan.homeCityId, route.from.id)
    || !same(caravan.escortDestinationCityId, route.to.id)
    || !Number.isSafeInteger(maxUnits) || maxUnits < 1 || maxUnits > 100
    || !Array.isArray(catalog) || !Array.isArray(route.from.marketStock))
    return null;
  const allowed = new Set(catalog.map(x => x?.id)
    .filter(id => typeof id === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(id)));
  const selected = [];
  let capacity = maxUnits;
  // Only genuine existing stock entries; do not invent item IDs or negative goods.
  for (const stock of route.from.marketStock) {
    if (selected.length >= 3 || capacity === 0) break;
    if (!allowed.has(stock?.id) || !safeQty(stock?.qty)
      || stock.qty === 0 || selected.some(x => x.id === stock.id)) continue;
    const qty = Math.min(capacity, stock.qty);
    selected.push({ id: stock.id, qty, stock });
    capacity -= qty;
  }
  if (!selected.length) return null;
  const goods = selected.map(({ id, qty }) => ({ id, qty }));
  // The reservation is a single synchronous action after full validation.
  for (const row of selected) row.stock.qty -= row.qty;
  liveCargo.set(caravan, {
    questId: quest.id, routeId: route.routeId,
    fromId: route.from.id, toId: route.to.id,
    goods, total: itemCount(goods), lost: 0, delivered: false,
  });
  return cloneItems(goods);
}

/** Remaining typed inventory; this is display data, not a save receipt. */
export function inspectLiveEscortCargo(caravan) {
  if (!isLiveCargo(caravan)) return [];
  const rec = liveCargo.get(caravan);
  if (rec.delivered) return [];
  return cloneItems(rec.goods);
}

/**
 * Convert cumulative hull-independent percentage loss into real whole units.
 * The source bandit receives the goods only in this JS process.
 */
export function recordEscortCargoRaid({
  caravan, bandit, remainingPercent,
} = {}) {
  if (!isLiveCargo(caravan) || !isRuntimeRouteBandit(bandit)
    || bandit.alive === false || !same(bandit.routeId, caravan.routeId)
    || !Number.isFinite(remainingPercent)
    || remainingPercent < 0 || remainingPercent > 100)
    return [];
  const rec = liveCargo.get(caravan);
  if (rec.delivered) return [];
  const targetLost = Math.min(rec.total,
    Math.round(rec.total * (100 - remainingPercent) / 100));
  let toMove = Math.max(0, targetLost - rec.lost);
  const gained = [];
  for (const row of rec.goods) {
    if (toMove === 0) break;
    const qty = Math.min(row.qty, toMove);
    if (qty === 0) continue;
    row.qty -= qty;
    toMove -= qty;
    rec.lost += qty;
    gained.push({ id: row.id, qty });
  }
  if (gained.length) {
    const loot = banditCargo.get(bandit) || new Map();
    for (const item of gained) loot.set(item.id, (loot.get(item.id) || 0) + item.qty);
    banditCargo.set(bandit, loot);
  }
  return gained;
}

export function inspectLiveBanditCargo(bandit) {
  if (!isRuntimeRouteBandit(bandit)) return [];
  return [...(banditCargo.get(bandit) || new Map())]
    .map(([id, qty]) => ({ id, qty }));
}

/** After an authentic witnessed arrival, surviving stock goes to the real destination. */
export function deliverEscortCargo({
  caravan, quest, worldState, tradeRoutes, currentDay,
} = {}) {
  if (!isLiveCargo(caravan) || caravan.alive === false
    || caravan.escortArrived !== true || caravan.escortFailed) return null;
  const route = validEscortQuest(quest, worldState, tradeRoutes, currentDay);
  const rec = liveCargo.get(caravan);
  if (!route?.road || rec.delivered || !same(rec.questId, quest.id)
    || !same(rec.routeId, route.routeId)
    || !same(rec.fromId, route.from.id)
    || !same(rec.toId, route.to.id)
    || !Array.isArray(route.to.marketStock)) return null;
  const goods = cloneItems(rec.goods).filter(row => row.qty > 0);
  for (const row of goods) {
    const dest = route.to.marketStock.find(entry => entry?.id === row.id);
    if (dest) {
      if (!safeQty(dest.qty)) return null;
    }
  }
  for (const row of goods) {
    const dest = route.to.marketStock.find(entry => entry?.id === row.id);
    if (dest) dest.qty += row.qty;
    else route.to.marketStock.push({ id: row.id, qty: row.qty });
  }
  rec.delivered = true;
  rec.goods = [];
  return goods;
}

/**
 * In-flight escort parties are excluded from SaveData. Return their remaining
 * un-delivered goods to the origin in the SAVE SNAPSHOT ONLY, so reloading an
 * active quest does not reserve the same stock twice. Runtime stock is untouched.
 */
export function outstandingEscortCargoForSave(parties = []) {
  const result = new Map();
  if (!Array.isArray(parties)) return result;
  for (const caravan of parties) {
    if (!isLiveCargo(caravan)) continue;
    const rec = liveCargo.get(caravan);
    if (rec.delivered || caravan.escortArrived || caravan.escortFailed
      || caravan.alive === false) continue;
    const key = String(rec.fromId);
    const stock = result.get(key) || new Map();
    for (const row of rec.goods) {
      if (row.qty > 0) stock.set(row.id, (stock.get(row.id) || 0) + row.qty);
    }
    result.set(key, stock);
  }
  return result;
}
