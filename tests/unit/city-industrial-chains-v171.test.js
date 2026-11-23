import { beforeEach, describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  CITY_MARKET_RECIPES, advanceCityMarketCycle, getCityMarketCyclePreview,
} from '../../js/systems/city-market-cycle.js';
import { getCityBuildingDef } from '../../js/data/city-building-catalog.js';
import {
  auditMarketStockBridge, establishMarketStockBridge,
  snapshotMarketsWithPendingEscorts,
} from '../../js/systems/market-stock-bridge.js';
import {
  inspectMarketMovements, resetMarketMovementJournal,
} from '../../js/systems/market-cargo-report.js';

function fixture({ buildings = [], stocks = {}, population = 0, infra = {} } = {}) {
  const market = {
    stocks: Object.fromEntries(CONST.TRADE_ITEMS.map(good => [good.id, stocks[good.id] ?? 0])),
    demand: Object.fromEntries(CONST.TRADE_ITEMS.map(good => [good.id, 0])),
    momentum: {},
  };
  const city = {
    id: 'city:industry:171', type: 'city', tier: 3, name: 'Sanayi Şehri', population,
    cityState: {
      parcels: buildings.map(id => ({ buildingIds: [id] })),
      infrastructure: {
        installedBuildingIds: infra.installed || [],
        improvementLevels: infra.levels || {},
      },
    },
    marketStock: CONST.TRADE_ITEMS.map(good => ({ id: good.id, qty: market.stocks[good.id] })),
  };
  expect(establishMarketStockBridge(city, market, CONST.TRADE_ITEMS).status).toBe('equal');
  return { city, market };
}
const qty = ({ market }, itemId) => market.stocks[itemId];
const batchesOf = (city, id) => getCityMarketCyclePreview(city)
  .recipes.find(recipe => recipe.buildingId === id)?.maxBatches;

describe('WEB V1.71 — six real industrial craft chains', () => {
  beforeEach(() => resetMarketMovementJournal());

  it('registers only real catalog buildings and canonical goods, never invented dye or wax', () => {
    expect(CITY_MARKET_RECIPES.map(x => x.buildingId)).toEqual([
      'mill', 'bakery', 'tannery', 'weaving_house', 'blacksmith', 'carpenter',
      'paper_mill', 'farrier',
    ]);
    expect(new Set(CITY_MARKET_RECIPES.map(x => x.buildingId)).size)
      .toBe(CITY_MARKET_RECIPES.length);
    for (const recipe of CITY_MARKET_RECIPES) {
      expect(getCityBuildingDef(recipe.buildingId)).toBeTruthy();
      expect(CONST.TRADE_ITEMS.some(good => good.id === recipe.outputId)).toBe(true);
      expect(Object.keys(recipe.inputs).length).toBeGreaterThan(0);
      for (const [good, amount] of Object.entries(recipe.inputs)) {
        expect(CONST.TRADE_ITEMS.some(entry => entry.id === good)).toBe(true);
        expect(Number.isSafeInteger(amount) && amount > 0).toBe(true);
      }
    }
    const { city, market } = fixture({
      buildings: ['dyeworks', 'soapworks', 'chandlery', 'stoneworks'],
      stocks: { cloth: 10, olive_oil: 10, wood: 10, salt: 10, stone: 10 },
    });
    const original = { ...market.stocks };
    expect(getCityMarketCyclePreview(city).recipes.every(row => row.buildingCount === 0)).toBe(true);
    expect(advanceCityMarketCycle(city, market, { day: 1 }).produced).toEqual([]);
    expect(market.stocks).toEqual(original);
  });

  it('weaves wool into cloth and uses that cloth for historically rag-based paper', () => {
    const data = fixture({
      buildings: ['weaving_house', 'paper_mill'],
      stocks: { wool: 4, cloth: 0, paper: 0 },
    });
    const out = advanceCityMarketCycle(data.city, data.market, { day: 2 });
    expect(out.produced.map(({ buildingId, batches }) => [buildingId, batches]))
      .toEqual([['weaving_house', 1], ['paper_mill', 1]]);
    expect(qty(data, 'wool')).toBe(2);
    expect(qty(data, 'cloth')).toBe(0); // output becomes paper input
    expect(qty(data, 'paper')).toBe(1);
    expect(auditMarketStockBridge(data.city, data.market, CONST.TRADE_ITEMS).status).toBe('equal');
    expect(inspectMarketMovements().filter(m => m.kind === 'workshop_output')
      .map(m => m.itemId)).toEqual(['cloth', 'paper']);
    expect(inspectMarketMovements().every(m => m.status === 'equal')).toBe(true);
  });

  it('blacksmith makes tools from iron/wood and carpenter consumes them with timber', () => {
    const data = fixture({
      buildings: ['blacksmith', 'carpenter'],
      stocks: { iron: 4, wood: 4, timber: 3, iron_tools: 0, furniture: 0 },
    });
    const out = advanceCityMarketCycle(data.city, data.market, { day: 3 });
    expect(out.produced.map(r => r.buildingId)).toEqual(['blacksmith', 'carpenter']);
    expect(qty(data, 'iron')).toBe(3);
    expect(qty(data, 'wood')).toBe(3);
    expect(qty(data, 'timber')).toBe(2);
    expect(qty(data, 'iron_tools')).toBe(0);
    expect(qty(data, 'furniture')).toBe(1);
    expect(auditMarketStockBridge(data.city, data.market, CONST.TRADE_ITEMS).status).toBe('equal');
  });

  it('tannery and farrier draw genuine materials and do not affect food or party gold', () => {
    const data = fixture({
      buildings: ['tannery', 'farrier'],
      stocks: { leather: 3, salt: 3, iron: 3, wood: 3, wheat: 5 },
    });
    const out = advanceCityMarketCycle(data.city, data.market, { day: 4 });
    expect(out.produced).toEqual([
      { buildingId: 'tannery', batches: 1, outputId: 'processed_leather', outputQty: 1 },
      { buildingId: 'farrier', batches: 1, outputId: 'horseshoe', outputQty: 2 },
    ]);
    expect(qty(data, 'leather')).toBe(2);
    expect(qty(data, 'salt')).toBe(2);
    expect(qty(data, 'iron')).toBe(2);
    expect(qty(data, 'wood')).toBe(2);
    expect(qty(data, 'processed_leather')).toBe(1);
    expect(qty(data, 'horseshoe')).toBe(2);
    expect(qty(data, 'wheat')).toBe(5);
    expect(out.consumed).toEqual([]);
    expect(auditMarketStockBridge(data.city, data.market, CONST.TRADE_ITEMS).status).toBe('equal');
  });

  it('incomplete inputs and full output depots cannot charge a partial recipe', () => {
    const data = fixture({
      buildings: ['tannery', 'blacksmith', 'carpenter', 'farrier', 'weaving_house', 'paper_mill'],
      stocks: {
        leather: 3, salt: 0, iron: 2, wood: 0, timber: 1, iron_tools: 0,
        wool: 1, cloth: 0, paper: CONST.MARKET.STOCK_CEIL_CITY,
      },
    });
    const original = { ...data.market.stocks };
    const out = advanceCityMarketCycle(data.city, data.market, { day: 5 });
    expect(out.produced).toEqual([]);
    expect(data.market.stocks).toEqual(original);
    expect(inspectMarketMovements()).toEqual([]);
  });

  it('production scaling requires validated built infrastructure upgrades and inputs', () => {
    const data = fixture({
      buildings: ['tannery', 'weaving_house', 'blacksmith', 'carpenter', 'paper_mill', 'farrier'],
      stocks: { leather: 10, salt: 10, wool: 10, iron: 10, wood: 10, timber: 10 },
      infra: {
        installed: ['well', 'drainage_line', 'side_road'],
        levels: { well: 1, drainage_line: 1, side_road: 1 },
      },
    });
    expect(batchesOf(data.city, 'tannery')).toBe(2);
    expect(batchesOf(data.city, 'weaving_house')).toBe(2);
    expect(batchesOf(data.city, 'paper_mill')).toBe(2);
    expect(batchesOf(data.city, 'blacksmith')).toBe(2);
    expect(batchesOf(data.city, 'carpenter')).toBe(2);
    expect(batchesOf(data.city, 'farrier')).toBe(2);
    const out = advanceCityMarketCycle(data.city, data.market, { day: 6 });
    expect(out.produced.every(row => row.batches === 2)).toBe(true);
    expect(data.market.stocks.iron).toBe(6);
    expect(data.market.stocks.wool).toBe(6);
    expect(data.market.stocks.wood).toBe(6);
    expect(data.market.stocks.furniture).toBe(2);
    expect(data.market.stocks.paper).toBe(2);
    expect(auditMarketStockBridge(data.city, data.market, CONST.TRADE_ITEMS).status).toBe('equal');
    data.city.population = 90000;
    expect(batchesOf(data.city, 'blacksmith')).toBe(1);
    expect(batchesOf(data.city, 'tannery')).toBe(1);
    expect(batchesOf(data.city, 'paper_mill')).toBe(1);
  });

  it('ignores forged uninstalled infrastructure and keeps saved once-per-day guard', () => {
    const data = fixture({
      buildings: ['blacksmith'],
      stocks: { iron: 10, wood: 10 },
      infra: { installed: [], levels: { side_road: 999 } },
    });
    expect(batchesOf(data.city, 'blacksmith')).toBe(1);
    const out = advanceCityMarketCycle(data.city, data.market, { day: 7 });
    expect(out.produced).toHaveLength(1);
    const clone = JSON.parse(JSON.stringify(snapshotMarketsWithPendingEscorts(
      { [data.city.id]: data.market }, [data.city], new Map())))[data.city.id];
    const before = JSON.stringify(clone);
    expect(advanceCityMarketCycle(data.city, clone, { day: 7 }))
      .toEqual({ ok: false, reason: 'already_processed' });
    expect(JSON.stringify(clone)).toBe(before);
    expect(auditMarketStockBridge(data.city, clone, CONST.TRADE_ITEMS).status).toBe('equal');
  });
});
