import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import EconomyManager from '../../js/managers/EconomyManager.js';
import * as trade from '../../js/systems/trade.js';
import {
  auditMarketStockBridge, establishMarketStockBridge,
  mirrorCityStockChange, mirrorMarketStockChange,
  snapshotMarketsWithPendingEscorts,
} from '../../js/systems/market-stock-bridge.js';

const catalog = [{ id: 'wheat' }, { id: 'iron' }];
const fixture = (id = 0) => ({
  id, type: 'city', tier: 3, tx: 2, ty: 3,
  marketStock: [{ id: 'wheat', qty: 10 }, { id: 'iron', qty: 5 }],
});
const micro = () => ({
  stocks: { wheat: 10, iron: 5 },
  demand: {}, momentum: {},
});
const stock = (city, item = 'wheat') =>
  city.marketStock.find(row => row.id === item).qty;

describe('WEB V1.28 — audited dual market stock bridge', () => {
  it('links complete equal ledgers including valid numeric city ID zero', () => {
    const settlement = fixture();
    const market = micro();
    expect(establishMarketStockBridge(settlement, market, catalog))
      .toEqual({ status: 'equal', diffs: [] });
    expect(market.stockBridge).toEqual({ version: 1, settlementId: '0' });
    market.stocks.wheat = 9;
    expect(mirrorMarketStockChange(settlement, market, 'wheat', 10, 9)).toBe(true);
    expect(stock(settlement)).toBe(9);
    settlement.marketStock[0].qty = 8;
    expect(mirrorCityStockChange(settlement, market, 'wheat', 9, 8)).toBe(true);
    expect(market.stocks.wheat).toBe(8);
  });

  it('preserves conflicting legacy ledgers without automatic merge or sum', () => {
    const settlement = fixture(7);
    const market = micro();
    market.stocks.wheat = 30;
    const beforeCity = structuredClone(settlement.marketStock);
    const audit = establishMarketStockBridge(settlement, market, catalog);
    expect(audit).toEqual({
      status: 'conflict', diffs: [{ id: 'wheat', city: 10, market: 30 }],
    });
    expect(settlement.marketStock).toEqual(beforeCity);
    expect(market.stocks.wheat).toBe(30);
    expect(market.stockBridge).toBeUndefined();
    market.stocks.wheat = 29;
    expect(mirrorMarketStockChange(settlement, market, 'wheat', 30, 29)).toBe(false);
    expect(stock(settlement)).toBe(10);
  });

  it('never follows a forged link after an unexpected stock change', () => {
    const settlement = fixture(7);
    const market = micro();
    establishMarketStockBridge(settlement, market, catalog);
    settlement.marketStock[0].qty = 4;
    market.stocks.wheat = 9;
    expect(mirrorMarketStockChange(settlement, market, 'wheat', 10, 9)).toBe(false);
    expect(market.stockBridge).toBeUndefined();
    expect(stock(settlement)).toBe(4);
  });

  it('seeds only absent stock from a live market, not a conflicting existing one', () => {
    const city = { id: 0, type: 'city' };
    const market = micro();
    expect(establishMarketStockBridge(city, market, catalog).status).toBe('equal');
    expect(city.marketStock).toEqual([{ id: 'wheat', qty: 10 }, { id: 'iron', qty: 5 }]);
    const existingCity = fixture(2);
    const newlyGenerated = { ...micro(), stocks: { wheat: 25, iron: 30 } };
    expect(establishMarketStockBridge(
      existingCity, newlyGenerated, catalog, { marketIsNew: true },
    ).status).toBe('equal');
    expect(newlyGenerated.stocks).toEqual({ wheat: 10, iron: 5 });
  });

  it('rejects invalid and incomplete stock rather than minting goods', () => {
    const city = fixture();
    const market = micro();
    city.marketStock[0].qty = -3;
    expect(auditMarketStockBridge(city, market, catalog).status).toBe('missing_city');
    expect(establishMarketStockBridge(city, market, catalog).status).toBe('missing_city');
    expect(city.marketStock[0].qty).toBe(-3);
    const missing = fixture();
    missing.marketStock.pop();
    expect(establishMarketStockBridge(missing, micro(), catalog).status)
      .toBe('missing_city');
    expect(missing.marketStock).toHaveLength(1);
  });

  it('mirrors genuine market buy, sell and daily production without doubling stock', () => {
    const state = { seed: 1337, day: 2, markets: {} };
    const manager = new EconomyManager(state);
    const settlement = { id: 0, type: 'city', tier: 3, tx: 0, ty: 0 };
    const market = manager.getOrCreateMarketForSettlement(settlement);
    const item = CONST.TRADE_ITEMS.find(x => x.id === 'wheat');
    expect(item).toBeTruthy();
    const original = market.stocks.wheat;
    expect(stock(settlement)).toBe(original);
    expect(market.stockBridge).toEqual({ version: 1, settlementId: '0' });
    expect(state.markets['0']).toBe(market);
    const party = { gold: 1000, inventory: { items: [] } };
    const purchased = trade.buy(party, market, settlement, 'wheat', 2);
    expect(purchased.ok).toBe(true);
    expect(purchased.qty).toBe(2);
    expect(stock(settlement)).toBe(original - 2);
    expect(market.stocks.wheat).toBe(original - 2);
    const sold = trade.sell(party, market, settlement, 'wheat', 1);
    expect(sold.ok).toBe(true);
    expect(stock(settlement)).toBe(original - 1);
    expect(market.stocks.wheat).toBe(original - 1);
    trade.advanceMarketOneDay(settlement, market, { day: 2, seed: 1337 });
    expect(stock(settlement)).toBe(market.stocks.wheat);
    expect(auditMarketStockBridge(settlement, market, CONST.TRADE_ITEMS).status)
      .toBe('equal');
  });

  it('keeps pending goods in both saved copies only when markets still agree', () => {
    const city = fixture();
    const market = micro();
    establishMarketStockBridge(city, market, catalog);
    const pending = new Map([['0', new Map([['wheat', 4]])]]);
    const saved = snapshotMarketsWithPendingEscorts(
      { '0': market }, [city], pending,
    );
    expect(saved['0'].stocks.wheat).toBe(14);
    expect(market.stocks.wheat).toBe(10);
    expect(stock(city)).toBe(10);
    // A divergent old save is not merged or credited.
    market.stocks.wheat = 50;
    const rejected = snapshotMarketsWithPendingEscorts(
      { '0': market }, [city], pending,
    );
    expect(rejected['0'].stocks.wheat).toBe(50);
    expect(rejected['0'].stockBridge).toBeUndefined();
  });
});
