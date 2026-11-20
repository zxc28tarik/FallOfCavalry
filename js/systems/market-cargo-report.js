/**
 * V1.34 - read-only reconciliation VIEW and process-local observation journal.
 * Never drives inventory, prices, quests, payments, or save migration.
 * Ledger entries record ALREADY completed engine operations, not entitlements.
 */
import { auditCampaignMarketStocks } from './market-stock-audit.js';
import { inspectCargoDispositions, auditLiveEscortCargoConservation } from './quest-escort-cargo.js';

const MAX_EVENTS = 160;
const movements = [];
const validId = id => typeof id === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(id);
const validQty = x => Number.isSafeInteger(x) && x >= 0;
const kinds = new Set([
  'legacy_buy', 'legacy_sell', 'modern_buy', 'modern_sell',
  'day_drift', 'escort_reserved', 'escort_delivered',
]);
const sources = new Set(['city', 'market']);
const cityQty = (city, id) => {
  const rows = (Array.isArray(city?.marketStock) ? city.marketStock : [])
    .filter(row => row?.id === id);
  return rows.length === 1 && validQty(rows[0].qty) ? rows[0].qty : null;
};
const marketQty = (market, id) => validQty(market?.stocks?.[id])
  ? market.stocks[id] : null;
const compare = (a,b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const cloneMovement = row => ({ ...row });

/** Only called AFTER a real city/micro-market stock write has completed. */
export function observeMarketMovement({
  kind, ledger, settlement, market, itemId, before, after,
  day, questId = null, routeId = null,
} = {}) {
  if (!kinds.has(kind) || !sources.has(ledger)
    || settlement?.id == null || !validId(itemId)
    || !validQty(before) || !validQty(after) || before === after
    || !Number.isSafeInteger(day) || day < 1) return null;
  const cityNow = cityQty(settlement, itemId);
  const marketNow = marketQty(market, itemId);
  const actual = ledger === 'city' ? cityNow : marketNow;
  if (actual !== after || !Number.isSafeInteger(after - before)) return null;
  const isLinked = cityNow !== null && marketNow !== null
    && cityNow === marketNow;
  const status = isLinked ? 'equal' : cityNow === null
    ? 'missing_city' : marketNow === null ? 'missing_market' : 'conflict';
  const event = {
    sequence: (movements.at(-1)?.sequence || 0) + 1,
    day, kind, ledger, settlementId: String(settlement.id),
    settlementName: String(settlement.name || settlement.id),
    itemId, before, after, delta: after - before,
    cityQty: cityNow, marketQty: marketNow, status,
    questId: questId == null ? null : String(questId),
    routeId: routeId == null ? null : String(routeId),
  };
  movements.push(event);
  if (movements.length > MAX_EVENTS) movements.shift();
  return cloneMovement(event);
}

/** The journal describes this RUN only; never serialize or replay it. */
export function inspectMarketMovements(limit = 35, settlementId = null) {
  const n = Number.isSafeInteger(limit) ? Math.max(0, Math.min(MAX_EVENTS, limit)) : 35;
  if (!n) return [];
  const filtered = settlementId == null ? movements
    : movements.filter(row => row.settlementId === String(settlementId));
  return filtered.slice(-n).map(cloneMovement);
}

export function resetMarketMovementJournal() {
  movements.length = 0;
}

/** A current-world, unmodified, scoped view of independent ledgers. */
export function buildMarketCargoReport({
  settlements = [], markets = {}, catalog = [], worldAi,
  settlementId = null, limit = 25,
} = {}) {
  const id = settlementId == null ? null : String(settlementId);
  const places = Array.isArray(settlements) ? settlements : [];
  const selected = id === null ? places : places.filter(s => String(s?.id) === id);
  const books = markets && typeof markets === 'object' && !Array.isArray(markets)
    ? markets : {};
  const scopedMarkets = id === null ? books
    : Object.fromEntries(Object.entries(books).filter(([key]) => key === id));
  const stockAudit = auditCampaignMarketStocks({
    settlements: selected, markets: scopedMarkets, catalog,
  });
  const goods = stockAudit.rows.filter(x => x.status !== 'equal');
  const parties = Array.isArray(worldAi?.parties) ? worldAi.parties : [];
  const escorts = parties.filter(p => p?.escortQuestId
    && p.kind === 'caravan' && !p.escortGuardOf
    && (id === null || String(p.homeCityId) === id
      || String(p.escortDestinationCityId) === id))
    .map(caravan => auditLiveEscortCargoConservation({caravan,worldAi}))
    .filter(row => row.status !== 'unverified')
    .sort((a,b) => compare(a.questId,b.questId));
  const dispositionRows = inspectCargoDispositions(128).filter(row =>
    id === null || row.sources.some(source => String(source.fromId) === id));
  const n = Number.isSafeInteger(limit) ? Math.max(0,Math.min(128,limit)) : 25;
  return {
    readOnly: true, sessionOnly: true,
    settlementId: id, stockAudit: {
      settlementCount: stockAudit.settlementCount,
      counts: { ...stockAudit.counts },
      conflicts: goods.filter(x => x.status === 'conflict').length,
      unresolved: goods.length,
      rows: id === null ? [] : stockAudit.rows.map(row => ({...row})),
    },
    movements: inspectMarketMovements(n, id),
    escorts, cargoDispositions: n ? dispositionRows.slice(-n) : [],
    // These are intentionally separate facts. Do not subtract market drift
    // from stolen cargo or equate market stock conflicts with stolen units.
  };
}
