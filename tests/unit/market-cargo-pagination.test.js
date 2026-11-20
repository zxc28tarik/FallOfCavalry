import { beforeEach, describe, expect, it } from 'vitest';
import {
  observeMarketMovement, resetMarketMovementJournal,
  buildMarketCargoReport, queryMarketCargoReportRows,
  marketCargoReportCsv, REPORT_COLUMNS, REPORT_SECTIONS,
} from '../../js/systems/market-cargo-report.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import { spawnPartyBandit } from '../../js/systems/world-ai.js';
import {
  reserveEscortCargo, recordEscortCargoRaid,
  disposeLiveBanditCargo,
} from '../../js/systems/quest-escort-cargo.js';

const catalog=[{id:'wheat',name:'Buğday',unitValue:8},
  {id:'iron',name:'Demir',unitValue:22}];
const settlement=(id,qty=12,name='Şehir '+id)=>({
  id,name,type:'city',x:(4+id)*32,y:208,tx:4+id,ty:6,
  marketStock:[{id:'wheat',qty},{id:'iron',qty:8}],
});
const market=(qty=12)=>({stocks:{wheat:qty,iron:8},demand:{},momentum:{}});
const report=(settlements,markets,options={})=>buildMarketCargoReport({
  settlements,markets,catalog,limit:160,...options,
});
beforeEach(resetMarketMovementJournal);

describe('WEB V1.35 — global paginated diagnostics and safe CSV',()=>{
  it('paginates all 881 cities without truncating the complete stock audit',()=>{
    const settlements=Array.from({length:881},(_,id)=>settlement(id));
    const markets=Object.fromEntries(settlements.map(s=>[s.id,market()]));
    const original=JSON.stringify({settlements,markets});
    const snapshot=report(settlements,markets);
    expect(snapshot.stockAudit.settlementCount).toBe(881);
    const first=queryMarketCargoReportRows(snapshot,{
      section:'stock',page:1,pageSize:17,
    });
    const last=queryMarketCargoReportRows(snapshot,{
      section:'stock',page:10000,pageSize:17,
    });
    expect(first.total).toBe(1762);
    expect(first.rows).toHaveLength(17);
    expect(first.pageCount).toBe(104);
    expect(last.page).toBe(104);
    expect(last.rows).toHaveLength(11);
    expect(first.rows[0]).toMatchObject({
      settlementId:'0',itemId:'iron',status:'equal',
    });
    expect(last.rows.at(-1).settlementId).toBe('880');
    expect(JSON.stringify({settlements,markets})).toBe(original);
  });

  it('filters conflicts across the whole map without auto-selecting stock authority',()=>{
    const settlements=Array.from({length:100},(_,id)=>settlement(id));
    const markets=Object.fromEntries(settlements.map(s=>[s.id,market()]));
    for(const id of [0,5,50,72,99])markets[id].stocks.wheat=13;
    const before=JSON.stringify({settlements,markets});
    const snapshot=report(settlements,markets);
    const filtered=queryMarketCargoReportRows(snapshot,{
      section:'stock',type:'conflict',pageSize:2,page:2,
    });
    expect(filtered.total).toBe(5);
    expect(filtered.pageCount).toBe(3);
    expect(filtered.rows.map(r=>r.settlementId)).toEqual(['50','72']);
    const csv=marketCargoReportCsv(snapshot,{
      section:'stock',type:'conflict',pageSize:2,page:2,
    });
    expect(csv.split('\n')).toHaveLength(7); // header + 5 conflicts + final newline
    expect(csv).toContain('"99","wheat","conflict","12","13"');
    expect(csv).not.toContain('"iron","equal"');
    expect(JSON.stringify({settlements,markets})).toBe(before);
  });

  it('supports exact product filtering, type selection and free-text searching',()=>{
    const a=settlement(1),b=settlement(2);
    const ma=market(),mb=market();
    const events=[
      {s:a,m:ma,id:'wheat',kind:'modern_buy',qty:11},
      {s:a,m:ma,id:'iron',kind:'day_drift',qty:7},
      {s:b,m:mb,id:'wheat',kind:'modern_sell',qty:13},
    ];
    for(const {s,m,id,kind,qty} of events){
      const before=m.stocks[id];m.stocks[id]=qty;
      observeMarketMovement({kind,ledger:'market',settlement:s,
        market:m,itemId:id,before,after:qty,day:7});
    }
    const snapshot=report([a,b],{1:ma,2:mb});
    const wheat=queryMarketCargoReportRows(snapshot,{
      section:'movements',itemId:'WHEAT',
    });
    expect(wheat.total).toBe(2);
    expect(wheat.rows.map(x=>x.kind)).toEqual(['modern_sell','modern_buy']);
    const selected=queryMarketCargoReportRows(snapshot,{
      section:'movements',itemId:'wheat',type:'modern_buy',
      search:'şehir 1',
    });
    expect(selected.total).toBe(1);
    expect(selected.rows[0].settlementId).toBe('1');
    expect(queryMarketCargoReportRows(snapshot,{
      section:'movements',search:'nonesuch',
    }).total).toBe(0);
    expect(queryMarketCargoReportRows(snapshot,{
      section:'movements',page:100,pageSize:10,
    }).page).toBe(1);
  });

  it('exports every retained transaction matching filters, not merely page one',()=>{
    const city=settlement(3),m=market();
    for(let i=0;i<175;i++){
      const before=m.stocks.wheat;
      m.stocks.wheat=before+1;
      observeMarketMovement({kind:'day_drift',ledger:'market',
        settlement:city,market:m,itemId:'wheat',
        before,after:before+1,day:10});
    }
    const snapshot=report([city],{'3':m});
    const page=queryMarketCargoReportRows(snapshot,{
      section:'movements',page:2,pageSize:10,
    });
    expect(page.total).toBe(160);
    expect(page.rows).toHaveLength(10);
    expect(page.rows[0].sequence).toBe(165);
    const csv=marketCargoReportCsv(snapshot,{
      section:'movements',page:2,pageSize:10,
    });
    expect(csv.split('\n')).toHaveLength(162);
    expect(csv).toContain('"175","10","day_drift"');
    expect(csv).toContain('"16","10","day_drift"');
    expect(csv).not.toContain('"15","10","day_drift"');
  });

  it('escapes spreadsheet formula payloads, quotes, commas and newlines',()=>{
    const s=settlement('=2+2',12,'=HYPERLINK("https://x", "x")\nnew');
    const m=market();
    m.stocks.wheat=11;
    observeMarketMovement({kind:'modern_buy',ledger:'market',
      settlement:s,market:m,itemId:'wheat',
      before:12,after:11,day:4});
    const snapshot=report([s],{'=2+2':m});
    const csv=marketCargoReportCsv(snapshot,{section:'movements'});
    expect(csv).toContain('"\u0027=2+2"');
    expect(csv).toContain('"\u0027=HYPERLINK(""https://x"", ""x"")');
    expect(csv).toContain('new"');
    const stockCsv=marketCargoReportCsv(snapshot,{section:'stock'});
    expect(stockCsv).toContain('"\u0027=2+2"');
    expect(csv.startsWith(REPORT_COLUMNS.movements.join(','))).toBe(true);
  });

  it('flattens real world caravan goods with individual fate quantities',()=>{
    const a={...settlement(1),x:144,y:208,tx:4,ty:6};
    const b={...settlement(2),x:336,y:208,tx:10,ty:6};
    const worldState={width:30,height:20,tileSize:32,
      settlements:[a,b],roads:[{from:1,to:2,path:[
        {x:4,y:6},{x:7,y:7},{x:10,y:6},
      ]}]};
    const routes=[{id:'route:1:2',fromCityId:1,toCityId:2,roadBacked:true}];
    const def=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
    const q={...JSON.parse(JSON.stringify(def)
      .replaceAll('{{targetRouteId}}','route:1:2')
      .replaceAll('{{issuerFactionId}}','ottoman')),
    id:'v135-caravan',templateId:def.id,status:'active',
    createdAt:3,issuerFactionId:'ottoman',targetRouteId:'route:1:2'};
    const caravan=spawnQuestEscortCaravan(q,worldState,routes,4);
    const reserved=reserveEscortCargo({
      caravan,quest:q,worldState,tradeRoutes:routes,currentDay:4,catalog,
    });
    expect(reserved.length).toBe(2);
    const micro=market();micro.stocks.wheat=0;micro.stocks.iron=3;
    const snapshot=report([a,b],{1:micro},{
      settlementId:1,worldAi:{parties:[caravan]},
    });
    const page=queryMarketCargoReportRows(snapshot,{
      section:'escorts',pageSize:10,
    });
    expect(page.total).toBe(2);
    expect(page.rows.reduce((n,row)=>n+row.reserved,0)).toBe(17);
    expect(page.rows.every(x=>x.status==='balanced'&&x.gap===0)).toBe(true);
    const csv=marketCargoReportCsv(snapshot,{section:'escorts',itemId:'iron'});
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"v135-caravan"');
    expect(csv).toContain('"iron"');
  });

  it('preserves verified source identities in itemized stolen-goods CSV',()=>{
    const a={...settlement(1),x:144,y:208,tx:4,ty:6};
    const b={...settlement(2),x:336,y:208,tx:10,ty:6};
    const worldState={width:30,height:20,tileSize:32,
      settlements:[a,b],roads:[{from:1,to:2,path:[
        {x:4,y:6},{x:7,y:7},{x:10,y:6},
      ]}]};
    const routes=[{id:'route:1:2',fromCityId:1,toCityId:2,roadBacked:true}];
    const def=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
    const q={...JSON.parse(JSON.stringify(def)
      .replaceAll('{{targetRouteId}}','route:1:2')
      .replaceAll('{{issuerFactionId}}','ottoman')),
    id:'v135-bandit',templateId:def.id,status:'active',
    createdAt:3,issuerFactionId:'ottoman',targetRouteId:'route:1:2'};
    const caravan=spawnQuestEscortCaravan(q,worldState,routes,4);
    reserveEscortCargo({caravan,quest:q,worldState,tradeRoutes:routes,
      currentDay:4,catalog});
    const bandit=spawnPartyBandit(worldState,{}, {},{tradeRoutes:routes});
    const stolen=recordEscortCargoRaid({
      caravan,bandit,remainingPercent:75,
    });
    expect(stolen.length).toBeGreaterThan(0);
    bandit.alive=false;
    const disposal=disposeLiveBanditCargo({bandit,reason:'patrol_kill'});
    expect(disposal).toBeTruthy();
    const snapshot=report([a,b],{},{settlementId:1});
    const rows=queryMarketCargoReportRows(snapshot,{
      section:'dispositions',type:'patrol_kill',
    });
    expect(rows.total).toBe(stolen.length);
    expect(rows.rows.every(x=>x.fromId==='1'&&x.questId===q.id)).toBe(true);
    const csv=marketCargoReportCsv(snapshot,{
      section:'dispositions',type:'patrol_kill',
    });
    expect(csv).toContain('"v135-bandit"');
    expect(csv).toContain('"patrol_kill"');
    expect(csv.split('\n')).toHaveLength(stolen.length+2);
  });

  it('keeps empty, invalid page and unknown categories safe',()=>{
    const snapshot=report([settlement(1)],{'1':market()});
    expect(REPORT_SECTIONS).toEqual([
      'stock','movements','escorts','dispositions',
    ]);
    const blank=queryMarketCargoReportRows(snapshot,{
      section:'dispositions',page:-100,pageSize:0,
      itemId:'made_up',
    });
    expect(blank.rows).toEqual([]);
    expect(blank.page).toBe(1);
    expect(blank.pageCount).toBe(1);
    expect(marketCargoReportCsv(snapshot,{section:'dispositions',
      itemId:'made_up'})).toBe(
      REPORT_COLUMNS.dispositions.join(',')+'\n');
    const unknown=queryMarketCargoReportRows(snapshot,{section:'bad'});
    expect(unknown.section).toBe('movements');
    expect(Object.isFrozen(REPORT_SECTIONS)).toBe(true);
  });
});
