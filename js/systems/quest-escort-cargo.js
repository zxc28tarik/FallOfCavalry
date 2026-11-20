/**
 * V1.27 — quest cargo backed by the existing settlement.marketStock model.
 *
 * Goods are debited only from an actual registered source settlement and a
 * canonical item catalog. The manifest/loot receipt is in-process WeakMap
 * authority: neither an imported party nor a saved clone can mint goods.
 */
import { validEscortQuest, isLiveEscortParty } from './quest-caravan-escort.js';
import { isRuntimeRouteBandit } from './quest-route-recon.js';
import { validBanditRoute } from './quest-world-party-links.js';

const liveCargo = new WeakMap();
const banditCargo = new WeakMap();
// Only the real battle-resolution path can preauthorize a loot recovery.
// The receipt is not serialized; a saved battle/party ID never becomes proof.
const battleRecoveryReceipts = new WeakMap();
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
    const record = banditCargo.get(bandit) || {
      routeId: bandit.routeId, goods: new Map(), claimed: false,
    };
    // Stolen goods cannot be relabeled to another road or a spent receipt.
    if (record.routeId !== bandit.routeId || record.claimed) return [];
    for (const item of gained) record.goods.set(item.id,
      (record.goods.get(item.id) || 0) + item.qty);
    banditCargo.set(bandit, record);
  }
  return gained;
}

export function inspectLiveBanditCargo(bandit) {
  if (!isRuntimeRouteBandit(bandit)) return [];
  const record = banditCargo.get(bandit);
  if (!record || record.claimed) return [];
  return [...record.goods].map(([id, qty]) => ({ id, qty }));
}

/**
 * V1.30 first proof: the engine completed an actual victory against exactly
 * one live, registered worldAI bandit with sourced cargo. A JSON-restored
 * bandit or a battle-result claim cannot create this process-local receipt.
 */
export function witnessBanditCargoBattleVictory({
  battle, bandit, worldAi, enemyId, linkedWorldPartyId,
  worldState, tradeRoutes,
} = {}) {
  if (!battle || typeof battle !== 'object'
    || battleRecoveryReceipts.has(battle)
    || battle.phase !== 'result'
    || battle.result !== 'victory'
    || battle.battleResult?.result !== 'victory'
    || !Number.isSafeInteger(battle.resolvedAt)
    || !Array.isArray(worldAi?.parties)
    || !worldAi.parties.includes(bandit)
    || !isRuntimeRouteBandit(bandit) || bandit.alive === false
    || bandit?.id == null || bandit.kind !== 'bandit'
    || enemyId !== battle.enemyId
    || enemyId !== battle.battleResult.enemyId
    || enemyId !== `wai-${bandit.id}`
    || linkedWorldPartyId !== bandit.id
    || !validBanditRoute(bandit, worldState, tradeRoutes)?.road)
    return false;
  const source = banditCargo.get(bandit);
  if (!source || source.claimed || source.routeId !== bandit.routeId
    || source.goods.size === 0) return false;
  battleRecoveryReceipts.set(battle, {
    bandit, enemyId, linkedWorldPartyId, consumed: false,
  });
  return true;
}

/**
 * Called ONLY while BattleManager is leaving that exact victorious battle,
 * BEFORE the bandit world party is removed. Goods move atomically into the
 * existing player inventory; SaveManager already persists this inventory.
 * No generated loot, currency, quest completion or new item type is minted.
 */
export function recoverWitnessedBanditCargo({
  battle, bandit, worldAi, enemyId, linkedWorldPartyId,
  playerParty, catalog,
} = {}) {
  const receipt = battleRecoveryReceipts.get(battle);
  if (!receipt || receipt.consumed || receipt.bandit !== bandit
    || receipt.enemyId !== enemyId
    || receipt.linkedWorldPartyId !== linkedWorldPartyId
    || !Array.isArray(worldAi?.parties) || !worldAi.parties.includes(bandit)
    || !isRuntimeRouteBandit(bandit) || bandit.alive === false
    || battle.phase !== 'result' || battle.result !== 'victory'
    || battle.battleResult?.result !== 'victory'
    || battle.enemyId !== enemyId || battle.battleResult.enemyId !== enemyId
    || !Array.isArray(playerParty?.inventory?.items)
    || !Array.isArray(catalog)) return [];
  const source = banditCargo.get(bandit);
  if (!source || source.claimed || source.routeId !== bandit.routeId
    || source.goods.size === 0) return [];
  const byId = new Map(catalog.filter(x =>
    typeof x?.id === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(x.id))
    .map(x => [x.id, x]));
  const incoming = [...source.goods].map(([id, qty]) => ({ id, qty }));
  if (!incoming.every(item => byId.has(item.id)
    && safeQty(item.qty) && item.qty > 0)) return [];
  const current = playerParty.inventory.items;
  const next = current.map(item => ({ ...item }));
  for (const { id, qty } of incoming) {
    const matches = next.filter(item => item?.id === id);
    if (matches.length > 1) return [];
    const row = matches[0];
    if (row) {
      if (!safeQty(row.qty) || !Number.isSafeInteger(row.qty + qty)) return [];
      row.qty += qty;
    } else {
      const definition = byId.get(id);
      next.push({
        id, name: definition.name || id, qty,
        unitValue: Number.isFinite(definition.unitValue)
          ? definition.unitValue : Number(definition.basePrice ?? 1),
      });
    }
  }
  // One synchronous state write; never partly credit goods and then fail.
  playerParty.inventory.items = next;
  receipt.consumed = true;
  source.claimed = true;
  source.goods.clear();
  return incoming;
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
