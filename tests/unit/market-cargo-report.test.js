import { beforeEach, describe, expect, it } from 'vitest';
import * as trade from '../../js/systems/trade.js';
import { establishMarketStockBridge } from '../../js/systems/market-stock-bridge.js';
import {
  buildMarketCargoReport, inspectMarketMovements,
  observeMarketMovement, resetMarketMovementJournal,
} from '../../js/systems/market-cargo-report.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import { reserveEscortCargo } from '../../js/systems/quest-escort-cargo.js';

const catalog = [
  {id:'wheat',name:'Buğday',unitValue:10},
  {id:'iron',name:'Demir',unitValue:20},
];
const city = (id=1) => ({id,name:'Denetim Şehri',type:'city',
  x:144,y:208,tx:4,ty:6,marketStock:[
    {id:'wheat',qty:9},{id:'iron',qty:8},
  ]});
const micro = () => ({stocks:{wheat:9,iron:8},demand:{},momentum:{}});
const report = (settlement,market,{settlementId=null,worldAi}={}) =>
  buildMarketCargoReport({settlements:[settlement],
    markets:{[settlement.id]:market},catalog,worldAi,settlementId,limit:50});
beforeEach(resetMarketMovementJournal);

describe('WEB V1.34 — readonly market + convoy observability',()=>{
  it('captures only actual completed verified stock movements, never creates a trade',()=>{
    const s=city(),m=micro(),before=JSON.stringify({s,m});
    expect(observeMarketMovement({
      kind:'modern_buy',ledger:'market',settlement:s,market:m,
      itemId:'wheat',before:9,after:8,day:4,
    })).toBeNull();
    expect(observeMarketMovement({
      kind:'invented_kind',ledger:'market',settlement:s,market:m,
      itemId:'wheat',before:9,after:8,day:4,
    })).toBeNull();
    expect(inspectMarketMovements()).toEqual([]);
    expect(JSON.stringify({s,m})).toBe(before);
    m.stocks.wheat=8;
    const event=observeMarketMovement({
      kind:'modern_buy',ledger:'market',settlement:s,market:m,
      itemId:'wheat',before:9,after:8,day:4,
    });
    expect(event).toMatchObject({kind:'modern_buy',ledger:'market',
      before:9,after:8,delta:-1,status:'conflict',
      cityQty:9,marketQty:8});
    expect(JSON.stringify({s,m})).not.toBe(before);
    expect(report(s,m).stockAudit.conflicts).toBe(1);
  });

  it('shows equal ledgers and separate actual modern BUY/SELL operations',()=>{
    const s=city(),m=micro();
    expect(establishMarketStockBridge(s,m,catalog).status).toBe('equal');
    const player={gold:10000,inventory:{items:[]}};
    const buy=trade.buy(player,m,s,'wheat',2,{day:4});
    expect(buy.ok).toBe(true);
    const sell=trade.sell(player,m,s,'wheat',1,{day:4});
    expect(sell.ok).toBe(true);
    expect(s.marketStock.find(x=>x.id==='wheat').qty).toBe(8);
    expect(m.stocks.wheat).toBe(8);
    const a=report(s,m,{settlementId:1});
    expect(a.stockAudit.conflicts).toBe(0);
    expect(a.movements.map(x=>x.kind)).toEqual(['modern_buy','modern_sell']);
    expect(a.movements.map(x=>x.delta)).toEqual([-2,1]);
    expect(a.movements.every(x=>x.status==='equal')).toBe(true);
    expect(a.readOnly).toBe(true);
  });

  it('preserves conflicting old city and market ledgers without automatic migration',()=>{
    const s=city();const m=micro();m.stocks.wheat=4;
    const original=JSON.stringify({s,m});
    const a=report(s,m,{settlementId:1});
    expect(a.stockAudit.conflicts).toBe(1);
    expect(a.stockAudit.rows.find(x=>x.itemId==='wheat'))
      .toMatchObject({cityQty:9,marketQty:4,status:'conflict'});
    expect(a.stockAudit.rows.find(x=>x.itemId==='iron').status).toBe('equal');
    expect(JSON.stringify({s,m})).toBe(original);
    expect(m.stockBridge).toBeUndefined();
  });

  it('keeps city filter, history and missing markets distinguishable',()=>{
    const a=city(1),b=city(2),market=micro();
    market.stocks.wheat=8;
    observeMarketMovement({
      kind:'modern_buy',ledger:'market',settlement:a,market,
      itemId:'wheat',before:9,after:8,day:5,
    });
    const all=buildMarketCargoReport({settlements:[a,b],markets:{1:market},
      catalog,limit:5});
    const selected=buildMarketCargoReport({settlements:[a,b],
      markets:{1:market},catalog,settlementId:2,limit:5});
    expect(all.movements).toHaveLength(1);
    expect(selected.movements).toHaveLength(0);
    expect(selected.stockAudit.conflicts).toBe(0);
    expect(selected.stockAudit.counts.missing_market).toBe(2);
    expect(all.stockAudit.conflicts).toBe(1);
  });

  it('observes real daily market changes separately from sourced convoy stock',()=>{
    const s=city(),m=micro();
    establishMarketStockBridge(s,m,catalog);
    const old=JSON.stringify({s,m});
    const out=trade.advanceMarketOneDay(s,m,{seed:1337,day:6});
    expect(out).toBeUndefined();
    const daily=inspectMarketMovements().filter(x=>x.kind==='day_drift');
    expect(daily.length).toBeGreaterThan(0);
    expect(daily.every(x=>x.ledger==='market' && x.day===6)).toBe(true);
    const a=report(s,m);
    expect(a.stockAudit.conflicts).toBe(0);
    expect(a.escorts).toHaveLength(0);
    expect(JSON.stringify({s,m})).not.toBe(old);
  });

  it('reports actual authenticated convoy manifest separately from city stock',()=>{
    const worldState={width:30,height:20,tileSize:32,
      settlements:[
        { ...city(1),x:144,y:208,tx:4,ty:6 },
        { ...city(2),x:336,y:208,tx:10,ty:6 },
      ],
      roads:[{from:1,to:2,path:[{x:4,y:6},{x:7,y:7},{x:10,y:6}]}],
    };
    const routes=[{id:'route:1:2',fromCityId:1,toCityId:2,roadBacked:true}];
    const template=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
    const q={...JSON.parse(JSON.stringify(template)
      .replaceAll('{{targetRouteId}}','route:1:2')
      .replaceAll('{{issuerFactionId}}','ottoman')),
    id:'v134_real_caravan',templateId:template.id,status:'active',
    createdAt:3,issuerFactionId:'ottoman',targetRouteId:'route:1:2'};
    const caravan=spawnQuestEscortCaravan(q,worldState,routes,4);
    const reserved=reserveEscortCargo({
      caravan,quest:q,worldState,tradeRoutes:routes,currentDay:4,catalog,
    });
    expect(reserved.length).toBe(2);
    const worldAi={parties:[caravan]};
    const m=micro();m.stocks.wheat=0;m.stocks.iron=0;
    const a=buildMarketCargoReport({
      settlements:worldState.settlements,
      markets:{1:m},catalog,worldAi,settlementId:1,
    });
    expect(a.escorts).toHaveLength(1);
    expect(a.escorts[0]).toMatchObject({
      status:'balanced',reserved:17,accounted:17,gap:0,
      questId:q.id,
    });
    expect(a.movements).toEqual([]);
    expect(worldState.settlements[0].marketStock.every(x=>x.qty===0)).toBe(true);
  });

  it('journal is bounded, defensive-copied, and resettable on save/load',()=>{
    const s=city(),m=micro();
    for(let i=0;i<190;i++){
      m.stocks.wheat=i+10;
      observeMarketMovement({kind:'day_drift',ledger:'market',
        settlement:s,market:m,itemId:'wheat',
        before:i+9,after:i+10,day:5});
    }
    expect(inspectMarketMovements(1000)).toHaveLength(160);
    expect(inspectMarketMovements(0)).toEqual([]);
    const rows=inspectMarketMovements(2);
    rows[0].after=99999;
    expect(inspectMarketMovements(2)[0].after).not.toBe(99999);
    resetMarketMovementJournal();
    expect(inspectMarketMovements()).toEqual([]);
    expect(report(s,m).movements).toEqual([]);
  });

  it('rejects invalid quantity/id/day; scoped report does not modify inventory',()=>{
    const s=city(),m=micro();
    m.stocks.wheat=8;
    const invalid=[
      {day:0},{itemId:'=1+1'},{after:8.2},{before:NaN},
      {ledger:'guest'},{kind:'fake_escort_delivered'},
    ];
    for(const x of invalid)expect(observeMarketMovement({
      kind:'modern_buy',ledger:'market',settlement:s,market:m,
      itemId:'wheat',before:9,after:8,day:3,...x,
    })).toBeNull();
    const before=JSON.stringify({s,m});
    const out=report(s,m,{settlementId:1});
    expect(out.escorts).toEqual([]);
    expect(out.stockAudit.conflicts).toBe(1);
    expect(JSON.stringify({s,m})).toBe(before);
    expect(inspectMarketMovements()).toEqual([]);
  });
});
