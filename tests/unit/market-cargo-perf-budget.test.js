import { describe, expect, it } from 'vitest';
import { buildMarketCargoReport, queryMarketCargoReportRows,
  marketCargoReportCsv } from '../../js/systems/market-cargo-report.js';

const catalog=[{id:'wheat'},{id:'iron'}];
const city=id=>({id,type:'city',name:'City '+id,
  marketStock:[{id:'wheat',qty:10},{id:'iron',qty:4}]});
const market=()=>({stocks:{wheat:10,iron:4}});
const makeWorld=count=>{
  const settlements=Array.from({length:count},(_,i)=>city(i));
  const markets=Object.fromEntries(settlements.map(s=>[s.id,market()]));
  return {settlements,markets,catalog};
};

describe('WEB V1.37 — stock report allocation and snapshot safety',()=>{
  it('audits the complete 881-city map once and preserves detached value rows',()=>{
    const world=makeWorld(881);
    world.markets[24].stocks.wheat=9;
    const original=JSON.stringify(world);
    const report=buildMarketCargoReport({...world,section:'stock'});
    expect(report.stockAudit.scanned).toBe(true);
    expect(report.stockAudit.settlementCount).toBe(881);
    expect(report.stockAudit.rows).toHaveLength(1762);
    expect(report.stockAudit.conflicts).toBe(1);
    expect(report.stockAudit.unresolved).toBe(1);
    expect(report.stockAudit.counts.conflict).toBe(1);
    expect(report.computedSections).toMatchObject({
      stock:true,movements:false,escorts:false,dispositions:false,
    });
    expect(JSON.stringify(world)).toBe(original);
    const originalRow=report.stockAudit.rows.find(row=>
      row.settlementId==='24' && row.itemId==='wheat');
    expect(originalRow).toMatchObject({
      cityQty:10,marketQty:9,status:'conflict',
    });
    world.markets[24].stocks.wheat=999;
    world.settlements[24].marketStock[0].qty=222;
    // Fresh stock snapshots are values, never raw market row references.
    expect(originalRow.cityQty).toBe(10);
    expect(originalRow.marketQty).toBe(9);
    const page=queryMarketCargoReportRows(report,{
      section:'stock',itemId:'wheat',type:'conflict',pageSize:10,
    });
    expect(page.total).toBe(1);
    page.rows[0].cityQty=45678;
    expect(originalRow.cityQty).toBe(10);
    originalRow.cityQty=50;
    expect(world.settlements[24].marketStock[0].qty).toBe(222);
  });

  it('reconciles mixed conflicts and missing books without an intermediate repair',()=>{
    const world=makeWorld(85);
    for(const id of [2,7,22])world.markets[id].stocks.iron=0;
    delete world.markets[47];
    const before=JSON.stringify(world);
    const report=buildMarketCargoReport({...world,section:'stock'});
    expect(report.stockAudit.conflicts).toBe(3);
    expect(report.stockAudit.counts.missing_market).toBe(2);
    expect(report.stockAudit.unresolved).toBe(5);
    expect(JSON.stringify(world)).toBe(before);
    const csv=marketCargoReportCsv(report,{
      section:'stock',type:'missing_market',
    });
    expect(csv.split('\n')).toHaveLength(4);
    expect(csv).toContain('"47","wheat","missing_market"');
    expect(csv).toContain('"47","iron","missing_market"');
  });

  it('movements-only avoids any stock allocation, even when world contains cities',()=>{
    const world=makeWorld(881);
    const report=buildMarketCargoReport({...world,
      section:'movements',limit:160});
    expect(report.stockAudit.scanned).toBe(false);
    expect(report.stockAudit.rows).toEqual([]);
    expect(report.stockAudit.conflicts).toBe(0);
    expect(report.movements).toEqual([]);
    expect(report.computedSections.stock).toBe(false);
  });
});
