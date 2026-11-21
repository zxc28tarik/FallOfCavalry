import { describe, expect, it } from 'vitest';
import { EconomyManager } from '../../js/managers/EconomyManager.js';
import {
  auditCampaignMarketStocks, auditSavedMarketStocks, marketStockAuditCsv,
} from '../../js/systems/market-stock-audit.js';

const catalog = Object.freeze([{ id: 'wheat' }, { id: 'iron' }]);
const settlement = (id, rows) => ({ id, marketStock: rows });
const sample = () => ({
  settlements: [
    settlement(0, [{ id: 'wheat', qty: 10 }, { id: 'iron', qty: 5 }]),
    settlement(1, [{ id: 'wheat', qty: 7 }, { id: 'iron', qty: 2 }]),
    settlement(2, undefined),
    settlement(3, [{ id: 'wheat', qty: 1 }, { id: 'iron', qty: 2 }]),
    settlement(4, [{ id: 'wheat', qty: -1 }, { id: 'iron', qty: 0 }]),
    settlement(5, [{ id: 'wheat', qty: 3 }, { id: 'wheat', qty: 3 },
      { id: 'iron', qty: 0 }]),
  ],
  markets: {
    '0': { stocks: { wheat: 10, iron: 5 } },
    '1': { stocks: { wheat: 11, iron: 2 } },
    '2': { stocks: { wheat: 4, iron: 3 } },
    '4': { stocks: { wheat: 2, iron: 0 } },
    '5': { stocks: { wheat: 3, iron: 0 } },
    '99': { stocks: { wheat: 9, iron: 4 } },
  },
});
const row = (report, id, item) => report.rows.find(r =>
  r.settlementId === String(id) && r.itemId === item);

describe('WEB V1.29 — read-only campaign/save market stock audit', () => {
  it('reports exact conflicts and untouched equal quantities, including city id 0', () => {
    const data = sample();
    const before = structuredClone(data);
    const report = auditCampaignMarketStocks({ ...data, catalog });
    expect(report.readOnly).toBe(true);
    expect(report.settlementCount).toBe(6);
    expect(row(report, 0, 'wheat')).toMatchObject({
      status: 'equal', cityQty: 10, marketQty: 10,
    });
    expect(row(report, 1, 'wheat')).toMatchObject({
      status: 'conflict', cityQty: 7, marketQty: 11,
    });
    expect(report.counts.conflict).toBe(1);
    expect(data).toEqual(before); // An audit is never a migration.
  });

  it('distinguishes missing ledgers and orphan market from false zeroes', () => {
    const report = auditCampaignMarketStocks({ ...sample(), catalog });
    expect(row(report, 2, 'wheat')).toMatchObject({
      status: 'missing_city', cityQty: null, marketQty: 4,
    });
    expect(row(report, 3, 'iron')).toMatchObject({
      status: 'missing_market', cityQty: 2, marketQty: null,
    });
    expect(row(report, 99, 'wheat')).toMatchObject({
      status: 'orphan_market', cityQty: null, marketQty: 9,
    });
    expect(report.counts.missing_city).toBe(2);
    expect(report.counts.missing_market).toBe(2);
    expect(report.counts.orphan_market).toBe(2);
  });

  it('flags duplicate city items and non-integer, NaN or negative values', () => {
    const data = sample();
    data.settlements[4].marketStock[1].qty = Number.NaN;
    const report = auditCampaignMarketStocks({ ...data, catalog });
    expect(row(report, 4, 'wheat').status).toBe('invalid_quantity');
    expect(row(report, 4, 'iron').cityIssue).toBe('non_finite');
    expect(row(report, 5, 'wheat').status).toBe('duplicate_city_item');
    expect(row(report, 5, 'iron').status).toBe('equal');
  });

  it('does not silently include unknown inventory goods or duplicate settlement identities', () => {
    const data = sample();
    data.settlements[0].marketStock.push({ id: 'made_up_goods', qty: 50 });
    data.settlements.push(settlement(0, [{ id: 'wheat', qty: 999 }]));
    const report = auditCampaignMarketStocks({ ...data, catalog });
    expect(row(report, 0, 'made_up_goods').status).toBe('unknown_item');
    expect(report.rows.some(r => r.status === 'duplicate_settlement')).toBe(true);
    expect(data.settlements[0].marketStock[0].qty).toBe(10);
  });

  it('audits saved snapshots directly without replaying or loading their assertions', () => {
    const payload = { game: {
      settlementsMarkets: [
        { settlementId: 0, marketStock: [
          { id: 'wheat', qty: 10 }, { id: 'iron', qty: 5 },
        ] },
        { settlementId: '7', marketStock: [
          { id: 'wheat', qty: 8 }, { id: 'iron', qty: 3 },
        ] },
        { settlementId: '7', marketStock: [
          { id: 'wheat', qty: 500 }, { id: 'iron', qty: 500 },
        ] },
      ],
      markets: {
        '0': { stocks: { wheat: 10, iron: 5 } },
        '7': { stocks: { wheat: 5, iron: 3 } },
      },
    } };
    const before = JSON.stringify(payload);
    const report = auditSavedMarketStocks(payload, catalog);
    expect(row(report, 0, 'wheat').status).toBe('equal');
    expect(row(report, 7, 'wheat')).toMatchObject({
      status: 'conflict', cityQty: 8, marketQty: 5,
    });
    expect(report.counts.duplicate_settlement).toBe(1);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it('exports stable RFC-style quoted CSV and neutralizes spreadsheet formula injection', () => {
    const report = auditCampaignMarketStocks({
      settlements: [{ id: '=1+1', marketStock: [
        { id: 'wheat', qty: 2 }, { id: 'iron', qty: 3 },
      ] }],
      markets: { '=1+1': { stocks: { wheat: 5, iron: 3 } } },
      catalog,
    });
    const csv = marketStockAuditCsv(report, { conflictsOnly: true });
    expect(csv).toContain('settlementId,itemId,status,cityQty,marketQty,cityIssue,marketIssue');
    expect(csv).toContain('"\'=1+1","wheat","conflict","2","5"');
    expect(csv).not.toContain('"iron","equal"');
    expect(csv.endsWith('\n')).toBe(true);
  });

  it('exposes an audit through the real manager without market initialization', () => {
    const data = sample();
    const state = { map: { settlements: data.settlements }, markets: data.markets };
    const manager = new EconomyManager(state);
    manager.itemCatalog = catalog;
    const original = JSON.stringify(state);
    const report = manager.auditMarketStocks();
    expect(report.counts.conflict).toBe(1);
    expect(state.markets['3']).toBeUndefined();
    expect(JSON.stringify(state)).toBe(original);
  });
});
