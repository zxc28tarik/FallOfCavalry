import { beforeEach, describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import * as trade from '../../js/systems/trade.js';
import { advanceCityMarketCycle, getCityMarketCyclePreview } from '../../js/systems/city-market-cycle.js';
import {
  auditMarketStockBridge, establishMarketStockBridge,
  snapshotMarketsWithPendingEscorts,
} from '../../js/systems/market-stock-bridge.js';
import {
  inspectMarketMovements, resetMarketMovementJournal,
} from '../../js/systems/market-cargo-report.js';

const mk = ({
  population = 0, buildings = [], infrastructure = null, stocks = {},
  cityId = 'edirne-170',
} = {}) => {
  const market = {
    stocks: Object.fromEntries(CONST.TRADE_ITEMS.map(item => [item.id, stocks[item.id] ?? 0])),
    demand: Object.fromEntries(CONST.TRADE_ITEMS.map(item => [item.id, 0])),
    momentum: {},
  };
  const city = {
    id: cityId, name: 'Edirne', type: 'city', tier: 3,
    population,
    cityState: { parcels: buildings.map(buildingId => ({ buildingIds: [buildingId] })),
      infrastructure: infrastructure ?? { installedBuildingIds: [], improvementLevels: {} } },
    marketStock: CONST.TRADE_ITEMS.map(item => ({ id: item.id, qty: market.stocks[item.id] })),
  };
  expect(establishMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
  return { city, market };
};

describe('WEB V1.70 — actual city-market production and civilian consumption', () => {
  beforeEach(() => resetMarketMovementJournal());

  it('mills wheat into flour and bakes flour using wood, atomically on linked stock', () => {
    const { city, market } = mk({
      buildings: ['mill', 'bakery'],
      stocks: { wheat: 8, flour: 1, wood: 3, bread: 0 },
    });
    const result = advanceCityMarketCycle(city, market, { day: 7 });
    expect(result.ok).toBe(true);
    expect(result.produced).toEqual([
      { buildingId: 'mill', batches: 1, outputId: 'flour', outputQty: 1 },
      { buildingId: 'bakery', batches: 1, outputId: 'bread', outputQty: 1 },
    ]);
    expect([market.stocks.wheat, market.stocks.flour, market.stocks.wood, market.stocks.bread])
      .toEqual([6, 1, 2, 1]);
    expect(auditMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
    const moves = inspectMarketMovements();
    expect(moves.filter(m => m.kind === 'workshop_input')).toHaveLength(3);
    expect(moves.filter(m => m.kind === 'workshop_output')).toHaveLength(2);
    expect(moves.every(m => m.status === 'equal' && m.day === 7)).toBe(true);
  });

  it('does not fabricate outputs when a building, raw material, or storage is absent', () => {
    const noShop = mk({ stocks: { wheat: 5, flour: 5, wood: 5 } });
    const first = advanceCityMarketCycle(noShop.city, noShop.market, { day: 1 });
    expect(first.produced).toHaveLength(0);
    expect(noShop.market.stocks.flour).toBe(5);
    expect(noShop.market.mcDay).toBeUndefined(); // zero-need cities stay sparse
    const empty = mk({ buildings: ['mill', 'bakery'], stocks: { wheat: 1, flour: 0, wood: 0 } });
    const second = advanceCityMarketCycle(empty.city, empty.market, { day: 1 });
    expect(second.produced).toHaveLength(0);
    expect(empty.market.stocks.flour).toBe(0);
    expect(empty.market.stocks.bread).toBe(0);
    expect(inspectMarketMovements().filter(m => m.kind.startsWith('workshop'))).toHaveLength(0);
  });

  it('consumes existing market food by resident population, with mirrored audit', () => {
    const { city, market } = mk({
      population: 50000,
      stocks: { bread: 1, flour: 1, wheat: 1, meat: 5 },
    });
    expect(getCityMarketCyclePreview(city).dailyFoodNeed).toBe(3);
    const result = advanceCityMarketCycle(city, market, { day: 4 });
    expect(result.consumed).toEqual([
      { itemId: 'bread', qty: 1 }, { itemId: 'flour', qty: 1 },
      { itemId: 'wheat', qty: 1 },
    ]);
    expect(result.shortageUnits).toBe(0);
    expect(market.stocks.bread).toBe(0);
    expect(market.stocks.flour).toBe(0);
    expect(market.stocks.wheat).toBe(0);
    expect(market.stocks.meat).toBe(5);
    expect(market.demand.bread).toBeGreaterThan(0);
    expect(auditMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
    expect(inspectMarketMovements().filter(m => m.kind === 'population_consumption')).toHaveLength(3);
  });

  it('shortage raises existing market demand but never mints food or goes negative', () => {
    const { city, market } = mk({ population: 45000 });
    const result = advanceCityMarketCycle(city, market, { day: 2 });
    expect(result.dailyFoodNeed).toBe(3);
    expect(result.consumed).toEqual([]);
    expect(result.shortageUnits).toBe(3);
    expect(market.stocks.wheat).toBe(0);
    expect(market.stocks.flour).toBe(0);
    expect(market.stocks.bread).toBe(0);
    expect(market.demand.wheat).toBeCloseTo(0.06);
    expect(market.demand.flour).toBeCloseTo(0.06);
    expect(market.demand.bread).toBeCloseTo(0.06);
    const saved = JSON.parse(JSON.stringify(snapshotMarketsWithPendingEscorts(
      { [city.id]: market }, [city], new Map())));
    expect(saved[city.id].mcDay).toBe(2);
    expect(advanceCityMarketCycle(city, saved[city.id], { day: 2 }))
      .toEqual({ ok: false, reason: 'already_processed' });
    expect(advanceCityMarketCycle(city, saved[city.id], { day: 1 }).ok).toBe(false);
    expect(saved[city.id].stocks.wheat).toBe(0);
  });

  it('infrastructure coverage can increase throughput only by consuming extra inputs', () => {
    const { city, market } = mk({
      buildings: ['mill', 'bakery'],
      infrastructure: {
        installedBuildingIds: ['well', 'drainage_line'],
        improvementLevels: { well: 1, drainage_line: 1 },
      },
      stocks: { wheat: 10, flour: 2, wood: 4 },
    });
    const preview = getCityMarketCyclePreview(city);
    expect(preview.recipes.map(r => r.maxBatches)).toEqual([2, 2]);
    const result = advanceCityMarketCycle(city, market, { day: 4 });
    expect(result.produced.map(row => row.batches)).toEqual([2, 2]);
    expect(market.stocks.wheat).toBe(6);
    expect(market.stocks.wood).toBe(2);
    expect(market.stocks.bread).toBe(2);
    expect(auditMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
    city.population = 90000;
    expect(getCityMarketCyclePreview(city).recipes.map(r => r.maxBatches)).toEqual([1, 1]);
  });

  it('existing daily trade tick calls the same flow, not a second inventory system', () => {
    const { city, market } = mk({
      population: 25000, buildings: ['mill', 'bakery'],
      stocks: { wheat: 15, flour: 10, wood: 10, bread: 8 },
    });
    const result = trade.advanceMarketOneDay(city, market, {
      seed: 1337, day: 10, biomeKey: 'PLAINS',
    });
    expect(result.ok).toBe(true);
    expect(result.day).toBe(10);
    expect(result.dailyFoodNeed).toBe(2);
    expect(market.mcDay).toBe(10);
    expect(auditMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
    expect(inspectMarketMovements().some(m => m.kind === 'day_drift')).toBe(true);
    expect(inspectMarketMovements().some(m => m.kind === 'population_consumption')).toBe(true);
    const before = JSON.stringify(market);
    expect(advanceCityMarketCycle(city, market, { day: 10 }).ok).toBe(false);
    expect(JSON.stringify(market)).toBe(before);
  });

  it('an unsaved/missing city has no fake workshops and cannot operate a daily market', () => {
    expect(advanceCityMarketCycle(null, { stocks: {}, demand: {} }, { day: 1 }).ok).toBe(false);
    expect(advanceCityMarketCycle({ id: 1 }, null, { day: 1 }).ok).toBe(false);
    const { city, market } = mk({ population: 0, buildings: ['imaginary_mill'] });
    expect(getCityMarketCyclePreview(city).recipes.every(r => r.buildingCount === 0)).toBe(true);
    expect(advanceCityMarketCycle(city, market, { day: 1 }).produced).toEqual([]);
    expect(market.mcDay).toBeUndefined();
  });
});
