/**
 * WEB V1.28 — conservative twin-market stock linkage.
 *
 * settlement.marketStock[] and state.markets[id].stocks{} historically had
 * independent values. NEVER merge or overwrite two conflicting extant
 * ledgers. Link only (a) first creation with one known stock source or
 * (b) complete, equal stock ledgers. All subsequent updates verify the
 * previous value before mirroring; no save-supplied flag is authority.
 */
const validId = id => typeof id === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(id);
const qty = n => Number.isSafeInteger(n) && n >= 0;
const rec = x => x && typeof x === 'object' && !Array.isArray(x);

function catalogIds(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) return [];
  const ids = catalog.map(item => item?.id).filter(validId);
  return new Set(ids).size === ids.length && ids.length === catalog.length
    ? ids : [];
}
function stockArray(settlement, ids) {
  if (!Array.isArray(settlement?.marketStock)) return null;
  const stock = new Map();
  for (const entry of settlement.marketStock) {
    if (!rec(entry) || !validId(entry.id) || !qty(entry.qty)
      || stock.has(entry.id)) return null;
    stock.set(entry.id, entry.qty);
  }
  return ids.every(id => stock.has(id)) ? stock : null;
}
function marketObject(market, ids) {
  const stocks = market?.stocks;
  if (!rec(stocks) || !ids.every(id => qty(stocks[id]))) return null;
  return stocks;
}

export function auditMarketStockBridge(settlement, market, catalog) {
  const ids = catalogIds(catalog);
  if (!ids.length || settlement?.id == null) return { status: 'invalid', diffs: [] };
  const city = stockArray(settlement, ids);
  const source = marketObject(market, ids);
  if (!city || !source) return {
    status: city ? 'missing_market' : source ? 'missing_city' : 'incomplete',
    diffs: [],
  };
  const diffs = ids.filter(id => city.get(id) !== source[id]).map(id => ({
    id, city: city.get(id), market: source[id],
  }));
  return { status: diffs.length ? 'conflict' : 'equal', diffs };
}

/**
 * When a market is first instantiated, preserve a preexisting valid city
 * stock. Otherwise, seed the absent city stock from the existing market.
 * If BOTH already exist and differ, preserve BOTH unchanged (audit only).
 */
export function establishMarketStockBridge(settlement, market, catalog, {
  marketIsNew = false,
} = {}) {
  if (!rec(settlement) || !rec(market) || !rec(market.stocks)
    || settlement.id == null) return { status: 'invalid', diffs: [] };
  const ids = catalogIds(catalog);
  if (!ids.length) return { status: 'invalid', diffs: [] };
  const city = stockArray(settlement, ids);
  const source = marketObject(market, ids);
  if (marketIsNew && city && source) {
    for (const id of ids) market.stocks[id] = city.get(id);
  } else if (!Array.isArray(settlement.marketStock) && source) {
    settlement.marketStock = ids.map(id => ({ id, qty: source[id] }));
  }
  const audit = auditMarketStockBridge(settlement, market, catalog);
  if (audit.status === 'equal') {
    market.stockBridge = { version: 1, settlementId: String(settlement.id) };
  } else {
    // Even a forged saved link cannot make a divergent market authoritative.
    delete market.stockBridge;
  }
  return audit;
}

export function mirrorMarketStockChange(settlement, market, id, before, after) {
  if (!validId(id) || !qty(before) || !qty(after)
    || market?.stockBridge?.version !== 1
    || String(market.stockBridge.settlementId) !== String(settlement?.id)
    || !Array.isArray(settlement?.marketStock)) return false;
  const rows = settlement.marketStock.filter(row => row?.id === id);
  if (rows.length !== 1 || !qty(rows[0].qty)
    || rows[0].qty !== before || market?.stocks?.[id] !== after) {
    delete market.stockBridge;
    return false;
  }
  rows[0].qty = after;
  return true;
}

export function mirrorCityStockChange(settlement, market, id, before, after) {
  if (!validId(id) || !qty(before) || !qty(after)
    || market?.stockBridge?.version !== 1
    || String(market.stockBridge.settlementId) !== String(settlement?.id)
    || !Array.isArray(settlement?.marketStock)) return false;
  const rows = settlement.marketStock.filter(row => row?.id === id);
  if (rows.length !== 1 || rows[0].qty !== after
    || market?.stocks?.[id] !== before) {
    delete market.stockBridge;
    return false;
  }
  market.stocks[id] = after;
  return true;
}

export function snapshotMarketsWithPendingEscorts(markets, settlements, pendingCargo) {
  if (!rec(markets)) return {};
  const byId = new Map((Array.isArray(settlements) ? settlements : [])
    .filter(s => s?.id != null).map(s => [String(s.id), s]));
  return Object.fromEntries(Object.entries(markets).map(([id, market]) => {
    if (!rec(market)) return [id, market];
    const copy = { ...market, stocks: rec(market.stocks) ? { ...market.stocks } : {} };
    const pending = pendingCargo instanceof Map ? pendingCargo.get(id) : null;
    const settlement = byId.get(id);
    if (pending && market?.stockBridge?.version === 1
      && String(market.stockBridge.settlementId) === id
      && Array.isArray(settlement?.marketStock)) {
      // Only refund if each affected ledger was equal immediately before save.
      const verified = [...pending].every(([good, amount]) => {
        const rows = settlement.marketStock.filter(r => r?.id === good);
        return qty(amount) && rows.length === 1 && qty(rows[0].qty)
          && rows[0].qty === market.stocks?.[good];
      });
      if (verified) {
        for (const [good, amount] of pending) copy.stocks[good] += amount;
      } else {
        delete copy.stockBridge;
      }
    }
    return [id, copy];
  }));
}
