import { beforeEach, describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import { getPrice } from '../../js/systems/trade.js';
import {
  advanceCityMarketCycle, planCityMarketProduction,
} from '../../js/systems/city-market-cycle.js';
import { getCityWorkshopOperatingReport } from '../../js/systems/city-workshop-accounts.js';
import {
  auditMarketStockBridge, establishMarketStockBridge, snapshotMarketsWithPendingEscorts,
} from '../../js/systems/market-stock-bridge.js';
import {
  inspectMarketMovements, resetMarketMovementJournal,
} from '../../js/systems/market-cargo-report.js';

function setup({ built = [], stock = {}, population = 0, cityId = 'city:accounts:172',
  ownerFactionId = 'ottoman' } = {}) {
  const market = {
    stocks: Object.fromEntries(CONST.TRADE_ITEMS.map(g => [g.id, stock[g.id] ?? 0])),
    demand: Object.fromEntries(CONST.TRADE_ITEMS.map(g => [g.id, 0])),
    momentum: {},
  };
  const city = {
    id: cityId, type: 'city', tier: 3, name: 'İşletme Şehri',
    ownerFactionId, population,
    cityState: {
      parcels: built.map(building => ({ buildingIds: [building] })),
      infrastructure: { installedBuildingIds: [], improvementLevels: {} },
    },
    marketStock: CONST.TRADE_ITEMS.map(g => ({ id: g.id, qty: market.stocks[g.id] })),
  };
  expect(establishMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
  return { city, market };
}

describe('WEB V1.72 — owner-safe real workshop accounting and shared planning', () => {
  beforeEach(() => resetMarketMovementJournal());

  it('forecasts real chained production without mutating market, city, or party wealth', () => {
    const { city, market } = setup({
      built: ['weaving_house', 'paper_mill', 'blacksmith', 'carpenter'],
      stock: { wool: 6, cloth: 0, iron: 3, wood: 3, timber: 3 },
    });
    const player = { gold: 185, factionId: 'player' };
    const before = JSON.stringify({ city, market, player });
    const plan = planCityMarketProduction(city, market);
    expect(plan.ok).toBe(true);
    expect(plan.totalBatches).toBe(4);
    expect(plan.rows.filter(r => r.plannedBatches > 0).map(r => r.buildingId))
      .toEqual(['weaving_house', 'blacksmith', 'carpenter', 'paper_mill']);
    const accounts = getCityWorkshopOperatingReport(city, market, { day: 3 });
    expect(accounts.totalBatches).toBe(4);
    expect(accounts.ownerFactionId).toBe('ottoman');
    expect(accounts.workshopOwnerCharacterId).toBeNull();
    expect(accounts.wagesGold).toBeNull();
    expect(accounts.upkeepGold).toBeNull();
    expect(accounts.monetaryTransactions).toBe(0);
    expect(JSON.stringify({ city, market, player })).toBe(before);
    expect(inspectMarketMovements()).toEqual([]);
  });

  it('uses the same plan for the actual market tick, conserving every raw good', () => {
    const { city, market } = setup({
      built: ['mill', 'bakery', 'tannery', 'farrier'],
      stock: {
        wheat: 10, flour: 0, wood: 4, bread: 0,
        leather: 5, salt: 5, iron: 4, horseshoe: 0,
      },
    });
    const plan = planCityMarketProduction(city, market);
    const expected = plan.rows.filter(r => r.plannedBatches > 0)
      .map(r => ({ buildingId: r.buildingId, batches: r.plannedBatches,
        outputId: r.outputId, outputQty: r.outputQty * r.plannedBatches }));
    const outcome = advanceCityMarketCycle(city, market, { day: 5 });
    expect(outcome.ok).toBe(true);
    expect(outcome.produced).toEqual(expected);
    expect(market.stocks.wheat).toBe(8);
    expect(market.stocks.flour).toBe(0);
    expect(market.stocks.bread).toBe(1);
    expect(market.stocks.leather).toBe(4);
    expect(market.stocks.salt).toBe(4);
    expect(market.stocks.horseshoe).toBe(2);
    expect(auditMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
    expect(inspectMarketMovements().every(m => m.status === 'equal')).toBe(true);
  });

  it('shows why a workshop cannot operate: no building, no material, or full storage', () => {
    const { city, market } = setup({
      built: ['blacksmith', 'paper_mill'],
      stock: { iron: 2, wood: 0, cloth: 3, paper: CONST.MARKET.STOCK_CEIL_CITY },
    });
    const plan = planCityMarketProduction(city, market);
    const forge = plan.rows.find(row => row.buildingId === 'blacksmith');
    const paper = plan.rows.find(row => row.buildingId === 'paper_mill');
    const bakery = plan.rows.find(row => row.buildingId === 'bakery');
    expect([forge.plannedBatches, forge.blockedReason, forge.missingInputId])
      .toEqual([0, 'missing_input', 'wood']);
    expect([paper.plannedBatches, paper.blockedReason])
      .toEqual([0, 'storage_full']);
    expect([bakery.plannedBatches, bakery.blockedReason])
      .toEqual([0, 'not_built']);
    expect(getCityWorkshopOperatingReport(city, market).totalBatches).toBe(0);
    expect(market.stocks.iron).toBe(2);
    expect(market.stocks.cloth).toBe(3);
  });

  it('uses existing live-market buy/sell prices, without calling them on live state', () => {
    const { city, market } = setup({
      built: ['farrier'],
      stock: { iron: 9, wood: 6 },
    });
    market.demand.iron = 0.3;
    market.demand.horseshoe = -0.2;
    const before = JSON.stringify(market);
    const snapshot = {
      stocks: { ...market.stocks }, demand: { ...market.demand },
      momentum: { ...market.momentum },
    };
    const sourceCost = getPrice(city, snapshot, 'iron', 'buy')
      + getPrice(city, snapshot, 'wood', 'buy');
    const saleEquivalent = getPrice(city, snapshot, 'horseshoe', 'sell') * 2;
    const accounts = getCityWorkshopOperatingReport(city, market);
    const row = accounts.rows.find(r => r.buildingId === 'farrier');
    expect(row.plannedBatches).toBe(1);
    expect(row.inputValueGold).toBe(sourceCost);
    expect(row.outputValueGold).toBe(saleEquivalent);
    expect(accounts.inputValueGold).toBe(sourceCost);
    expect(accounts.outputValueGold).toBe(saleEquivalent);
    expect(accounts.grossTradeSpreadGold).toBe(saleEquivalent - sourceCost);
    expect(JSON.stringify(market)).toBe(before);
  });

  it('preserves zero income and zero deductions for both owned and foreign cities', () => {
    for (const ownerFactionId of ['player', 'ottoman', 'hre']) {
      const { city, market } = setup({
        built: ['mill'], ownerFactionId, stock: { wheat: 9 }, population: 0,
      });
      const party = { factionId: 'player', gold: 1040 };
      const before = JSON.stringify({ city, market, party });
      const report = getCityWorkshopOperatingReport(city, market);
      expect(report.ownerFactionId).toBe(ownerFactionId);
      expect(report.workshopOwnerCharacterId).toBeNull();
      expect(report.monetaryTransactions).toBe(0);
      expect(report.wagesGold).toBeNull();
      expect(report.upkeepGold).toBeNull();
      expect(JSON.stringify({ city, market, party })).toBe(before);
    }
  });

  it('missing/invalid market reports are read-only and never invent an account', () => {
    const { city, market } = setup({ built: ['mill'], stock: { wheat: 5 } });
    expect(getCityWorkshopOperatingReport(city, null)).toMatchObject({
      ok: false, reason: 'market_unavailable',
      totalBatches: 0, monetaryTransactions: 0,
    });
    expect(getCityWorkshopOperatingReport(city, { stocks: [] }).ok).toBe(false);
    expect(market.mcDay).toBeUndefined();
    expect(inspectMarketMovements()).toEqual([]);
  });

  it('reports are not persisted; real save only keeps actual market stock and day guard', () => {
    const { city, market } = setup({
      built: ['weaving_house', 'paper_mill'],
      stock: { wool: 6 },
    });
    const quotedBefore = getCityWorkshopOperatingReport(city, market);
    expect(quotedBefore.totalBatches).toBe(2);
    const real = advanceCityMarketCycle(city, market, { day: 9 });
    expect(real.produced).toHaveLength(2);
    const saved = JSON.parse(JSON.stringify(snapshotMarketsWithPendingEscorts(
      { [city.id]: market }, [city], new Map())))[city.id];
    expect(saved.mcDay).toBe(9);
    expect(saved.operatingReport).toBeUndefined();
    expect(saved.workshopOwnerCharacterId).toBeUndefined();
    expect(advanceCityMarketCycle(city, saved, { day: 9 }).ok).toBe(false);
    expect(auditMarketStockBridge(city, saved, CONST.TRADE_ITEMS).status).toBe('equal');
    expect(getCityWorkshopOperatingReport(city, saved, { day: 9 }).processedToday).toBe(true);
  });
});
