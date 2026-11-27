/**
 * V1.29 — READ-ONLY reconciliation audit for the two historical stock ledgers.
 * This code reports discrepancies. It NEVER selects an authority, repairs
 * stock, validates save claims as game receipts, or mutates either input.
 */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isQty = value => Number.isSafeInteger(value) && value >= 0;
const asKey = id => id == null ? null : String(id);
const compareId = (a,b) => a.localeCompare(b, 'en', { numeric: true });
const invalidValue = value => {
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (typeof value === 'number' && !Number.isFinite(value)) return 'non_finite';
  if (!isQty(value)) return 'invalid_quantity';
  return null;
};

function rowsOfCity(settlement) {
  const result = new Map();
  const duplicates = new Set();
  if (!Array.isArray(settlement?.marketStock)) return { rows: result, duplicates, missing: true };
  for (const item of settlement.marketStock) {
    const id = typeof item?.id === 'string' ? item.id : null;
    if (!id) continue;
    if (result.has(id)) duplicates.add(id);
    else result.set(id, item.qty);
  }
  return { rows: result, duplicates, missing: false };
}

function catalogIds(catalog) {
  return [...new Set((Array.isArray(catalog) ? catalog : [])
    .map(item => item?.id)
    .filter(id => typeof id === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(id)))];
}

export function auditCampaignMarketStocks({
  settlements = [], markets = {}, catalog = [],
} = {}) {
  const items = catalogIds(catalog);
  const known = new Set(items);
  const locations = Array.isArray(settlements) ? settlements : [];
  const marketBook = isObject(markets) ? markets : {};
  const result = [];
  const seen = new Set();
  const push = (settlementId, itemId, status, cityQty, marketQty) => {
    result.push({ settlementId, itemId, status,
      cityQty: isQty(cityQty) ? cityQty : null,
      marketQty: isQty(marketQty) ? marketQty : null,
      cityIssue: invalidValue(cityQty),
      marketIssue: invalidValue(marketQty) });
  };
  for (const settlement of locations) {
    const settlementId = asKey(settlement?.id);
    if (settlementId === null) continue;
    if (seen.has(settlementId)) {
      push(settlementId, '', 'duplicate_settlement', null, null);
      continue;
    }
    seen.add(settlementId);
    const city = rowsOfCity(settlement);
    const market = marketBook[settlementId];
    const micro = isObject(market?.stocks) ? market.stocks : null;
    const itemIds = [...new Set([...items, ...city.rows.keys(),
      ...Object.keys(micro || {})])].sort(compareId);
    // A city which has never opened a market should not be reported as a
    // discrepancy against an invented "zero" market. Use a missing status.
    if (!itemIds.length) {
      push(settlementId, '', 'no_catalog', undefined, undefined);
      continue;
    }
    for (const id of itemIds) {
      const cityQty = city.rows.get(id);
      const marketQty = micro?.[id];
      const status = !known.has(id) ? 'unknown_item'
        : city.duplicates.has(id) ? 'duplicate_city_item'
          : city.missing || cityQty === undefined ? 'missing_city'
            : !micro || marketQty === undefined ? 'missing_market'
              : !isQty(cityQty) || !isQty(marketQty) ? 'invalid_quantity'
                : cityQty !== marketQty ? 'conflict' : 'equal';
      push(settlementId, id, status, cityQty, marketQty);
    }
  }
  for (const id of Object.keys(marketBook).filter(id => !seen.has(id)).sort(compareId)) {
    const market = marketBook[id];
    const stock = isObject(market?.stocks) ? market.stocks : {};
    for (const itemId of [...new Set([...items, ...Object.keys(stock)])].sort(compareId)) {
      push(id, itemId, 'orphan_market', undefined, stock[itemId]);
    }
  }
  const counts = {};
  for (const row of result) counts[row.status] = (counts[row.status] || 0) + 1;
  return { version: 1, readOnly: true, settlementCount: seen.size,
    catalogCount: items.length, rowCount: result.length, counts, rows: result };
}

export function auditSavedMarketStocks(payload, catalog) {
  const data = payload?.game;
  const byId = new Map();
  const duplicate = new Set();
  const entries = Array.isArray(data?.settlementsMarkets) ? data.settlementsMarkets : [];
  for (const row of entries) {
    const id = asKey(row?.settlementId);
    if (id == null) continue;
    if (byId.has(id)) duplicate.add(id);
    else byId.set(id, { id, marketStock: row.marketStock });
  }
  // No attempt to use the regenerated world map as a source of market stock.
  const snapshot = auditCampaignMarketStocks({
    settlements: [...byId.values()],
    markets: data?.markets,
    catalog,
  });
  for (const id of duplicate) snapshot.rows.push({
    settlementId: id, itemId: '', status: 'duplicate_settlement',
    cityQty: null, marketQty: null, cityIssue: null, marketIssue: null,
  });
  snapshot.rows.sort((a,b) => compareId(a.settlementId,b.settlementId)
    || compareId(a.itemId,b.itemId));
  snapshot.rowCount = snapshot.rows.length;
  if (duplicate.size) snapshot.counts.duplicate_settlement =
    (snapshot.counts.duplicate_settlement || 0) + duplicate.size;
  return snapshot;
}

function csvValue(value) {
  // CSV is intended for spreadsheet readers; neutralize formula injection.
  const str = String(value ?? '');
  const safe = /^[\s]*[=+@-]/.test(str) ? `'${str}` : str;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function marketStockAuditCsv(audit, { conflictsOnly = false } = {}) {
  const rows = (Array.isArray(audit?.rows) ? audit.rows : [])
    .filter(row => !conflictsOnly || row.status !== 'equal');
  const fields = ['settlementId', 'itemId', 'status',
    'cityQty', 'marketQty', 'cityIssue', 'marketIssue'];
  return [fields.join(','), ...rows.map(row =>
    fields.map(field => csvValue(row[field])).join(','))].join('\n') + '\n';
}
