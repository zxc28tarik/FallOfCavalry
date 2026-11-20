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
  const n = Number.isSafeInteger(limit) ? Math.max(0,Math.min(MAX_EVENTS,limit)) : 25;
  return {
    readOnly: true, sessionOnly: true,
    settlementId: id, stockAudit: {
      settlementCount: stockAudit.settlementCount,
      counts: { ...stockAudit.counts },
      conflicts: goods.filter(x => x.status === 'conflict').length,
      unresolved: goods.length,
      // Include world-wide rows for on-demand V1.35 page queries and CSV.
      // Never render the full array into the DOM in a single operation.
      rows: stockAudit.rows.map(row => ({ ...row })),
    },
    movements: inspectMarketMovements(n, id),
    escorts, cargoDispositions: n ? dispositionRows.slice(-Math.min(128,n)) : [],
    // These are intentionally separate facts. Do not subtract market drift
    // from stolen cargo or equate market stock conflicts with stolen units.
  };
}

/**
 * V1.35 — one bounded, reproducible query surface for the four separate
 * accounting categories. Pages only affect presentation; CSV downloads every
 * matching retained row and never reads/writes game state.
 */
export const REPORT_SECTIONS = Object.freeze([
  'stock', 'movements', 'escorts', 'dispositions',
]);
export const REPORT_COLUMNS = Object.freeze({
  stock: ['settlementId','itemId','status','cityQty','marketQty',
    'cityIssue','marketIssue'],
  movements: ['sequence','day','kind','ledger','settlementId',
    'settlementName','itemId','before','after','delta','cityQty',
    'marketQty','status','questId','routeId'],
  escorts: ['questId','fromId','toId','retiredReason','status',
    'itemId','reserved','inCaravan','inBandits','inPlayer',
    'atDestination','unrecovered','accounted','gap'],
  dispositions: ['sequence','kind','reason','banditId','routeId',
    'questId','fromId','itemId','qty'],
});
const reportRowsForSection = (report, section) => {
  if (!REPORT_SECTIONS.includes(section)) return [];
  if (section === 'stock') return report?.stockAudit?.rows || [];
  if (section === 'movements') return [...(report?.movements || [])].reverse();
  if (section === 'escorts') return (report?.escorts || []).flatMap(escort =>
    (escort.rows || []).map(item => ({
      questId: escort.questId, fromId: escort.fromId, toId: escort.toId,
      retiredReason: escort.retiredReason, status: item.status,
      itemId: item.id, reserved: item.reserved,
      inCaravan: item.inCaravan, inBandits: item.inBandits,
      inPlayer: item.inPlayer, atDestination: item.atDestination,
      unrecovered: item.unrecovered, accounted: item.accounted,
      gap: item.gap,
    })));
  return [...(report?.cargoDispositions || [])].reverse().flatMap(event => {
    // Multiple caravans can share a bandit. Preserve actual provenance when
    // displaying a stolen unit; no source means UNKNOWN, never fake city.
    const sources = Array.isArray(event.sources) && event.sources.length
      ? event.sources : [null];
    return (event.goods || []).flatMap(item => sources.flatMap(source => {
      const qty = source?.goods?.find(row => row.id === item.id)?.qty;
      if (source && (!validQty(qty) || qty === 0)) return [];
      return [{
        sequence: event.sequence, kind: event.kind, reason: event.reason,
        banditId: event.banditId, routeId: event.routeId,
        questId: source?.questId ?? null, fromId: source?.fromId ?? null,
        itemId: item.id, qty: source ? qty : item.qty,
      }];
    }));
  });
};
function safePageInt(value, fallback, max) {
  return Number.isSafeInteger(value) && value > 0
    ? Math.min(value, max) : fallback;
}
export function queryMarketCargoReportRows(report, {
  section = 'movements', itemId = '', type = '', search = '',
  page = 1, pageSize = 20,
} = {}) {
  const category = REPORT_SECTIONS.includes(section) ? section : 'movements';
  const term = String(search || '').trim().toLocaleLowerCase('tr').slice(0,80);
  const good = String(itemId || '').trim().toLocaleLowerCase('tr').slice(0,80);
  const selectedType = String(type || '').trim();
  const matching = reportRowsForSection(report, category).filter(row => {
    if (good && String(row.itemId || '').toLocaleLowerCase('tr') !== good)
      return false;
    if (selectedType && row.status !== selectedType
      && row.kind !== selectedType && row.reason !== selectedType)
      return false;
    if (!term) return true;
    // Explicit searchable columns: avoid JSON of arbitrary attacker-controlled
    // objects and keep large-world filtering bounded.
    return ['itemId','settlementId','settlementName','questId',
      'routeId','banditId','kind','reason','status'].some(key =>
      String(row[key] ?? '').toLocaleLowerCase('tr').includes(term));
  });
  const perPage = safePageInt(pageSize, 20, 100);
  const pageCount = Math.max(1, Math.ceil(matching.length / perPage));
  const actualPage = Math.min(safePageInt(page, 1, pageCount), pageCount);
  return {
    section: category, columns: REPORT_COLUMNS[category],
    total: matching.length, page: actualPage, pageCount, pageSize: perPage,
    first: matching.length ? (actualPage - 1) * perPage + 1 : 0,
    last: Math.min(actualPage * perPage, matching.length),
    rows: matching.slice((actualPage - 1) * perPage, actualPage * perPage)
      .map(row => ({ ...row })),
  };
}
function csvCell(value) {
  const input = String(value ?? '');
  const safe = /^\s*[=+@-]/.test(input) ? `'${input}` : input;
  return `"${safe.replaceAll('"','""')}"`;
}
/** All matching rows, not just the visible page, in stable UTF-8-safe CSV. */
export function marketCargoReportCsv(report, options = {}) {
  const category = REPORT_SECTIONS.includes(options.section)
    ? options.section : 'movements';
  // Page selection is deliberately ignored. The journal itself remains
  // bounded (160 movements / 128 dispositions); the CSV cannot resurrect
  // lost session history or invent stock.
  const rows = reportRowsForSection(report, category).filter(row => {
    const itemId = String(options.itemId || '').trim().toLocaleLowerCase('tr');
    const type = String(options.type || '').trim();
    const term = String(options.search || '').trim().toLocaleLowerCase('tr').slice(0,80);
    if (itemId && String(row.itemId || '').toLocaleLowerCase('tr') !== itemId)
      return false;
    if (type && row.status !== type && row.kind !== type && row.reason !== type)
      return false;
    return !term || ['itemId','settlementId','settlementName','questId',
      'routeId','banditId','kind','reason','status'].some(key =>
      String(row[key] ?? '').toLocaleLowerCase('tr').includes(term));
  });
  const columns = REPORT_COLUMNS[category];
  return [columns.join(','), ...rows.map(row => columns.map(key =>
    csvCell(row[key])).join(','))].join('\n') + '\n';
}
