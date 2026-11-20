import { describe, expect, it } from 'vitest';
import {
  buildMarketCargoReport, observeMarketMovement,
  queryMarketCargoReportRows, resetMarketMovementJournal,
} from '../../js/systems/market-cargo-report.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import { spawnPartyBandit } from '../../js/systems/world-ai.js';
import {
  reserveEscortCargo, recordEscortCargoRaid, inspectLiveBanditCargo,
  disposeLiveBanditCargo, inspectCargoDispositions,
  resetCargoDispositionJournal, auditLiveEscortCargoConservation,
  outstandingEscortCargoForSave,
} from '../../js/systems/quest-escort-cargo.js';

const catalog=[{id:'wheat',unitValue:8},{id:'iron',unitValue:20}];
const city=(id,qty=12)=>({id,type:'city',name:'City '+id,
  x:144+id*192,y:208,tx:4+id*6,ty:6,
  marketStock:[{id:'wheat',qty},{id:'iron',qty:8}]});
const market=(wheat=12,iron=8)=>({stocks:{wheat,iron}});

describe('WEB V1.36 — selective read-only computation / session boundaries',()=>{
  it('a movements-only read never enumerates the 881 cities, markets or WorldAI',()=>{
    resetMarketMovementJournal();
    const cityList=new Proxy(Array.from({length:881},(_,i)=>city(i)),{
      get(target,key,receiver){
        if(key===Symbol.iterator)throw Error('Unexpected settlement scan');
        return Reflect.get(target,key,receiver);
      },
    });
    const marketBook=new Proxy({},{
      ownKeys(){throw Error('Unexpected market enumeration');},
      get(){throw Error('Unexpected market lookup');},
    });
    const worldAi={get parties(){throw Error('Unexpected worldAI access');}};
    const snapshot=buildMarketCargoReport({
      settlements:cityList,markets:marketBook,worldAi,catalog,
      section:'movements',
    });
    expect(snapshot.stockAudit.scanned).toBe(false);
    expect(snapshot.stockAudit.rows).toEqual([]);
    expect(snapshot.escorts).toEqual([]);
    expect(snapshot.cargoDispositions).toEqual([]);
    expect(snapshot.computedSections).toEqual({
      stock:false,movements:true,escorts:false,dispositions:false,
    });
    expect(queryMarketCargoReportRows(snapshot,{section:'movements'})
      .total).toBe(0);
  });

  it('stock-only audit does not access worldAI or process-only dispositions',()=>{
    const worldAi={get parties(){throw Error('Escorts must remain lazy');}};
    const settlements=[city(0),city(1)];
    const markets={'0':market(),'1':market(10,8)};
    const snapshot=buildMarketCargoReport({
      settlements,markets,catalog,worldAi,section:'stock',
    });
    expect(snapshot.stockAudit.scanned).toBe(true);
    expect(snapshot.stockAudit.conflicts).toBe(1);
    expect(snapshot.stockAudit.rows).toHaveLength(4);
    expect(snapshot.movements).toEqual([]);
    expect(snapshot.escorts).toEqual([]);
    expect(snapshot.computedSections.movements).toBe(false);
  });

  it('legacy all-mode and selected sections have the same actual rows',()=>{
    resetMarketMovementJournal();
    const settlements=[city(0),city(1)];
    const markets={'0':market(),'1':market()};
    markets['0'].stocks.wheat=11;
    observeMarketMovement({kind:'modern_buy',ledger:'market',
      settlement:settlements[0],market:markets['0'],itemId:'wheat',
      before:12,after:11,day:8});
    const options={settlements,markets,catalog,worldAi:{parties:[]}};
    const all=buildMarketCargoReport(options);
    const stock=buildMarketCargoReport({...options,section:'stock'});
    const movements=buildMarketCargoReport({...options,section:'movements'});
    expect(stock.stockAudit).toMatchObject({
      scanned:true,rows:all.stockAudit.rows,counts:all.stockAudit.counts,
    });
    expect(movements.movements).toEqual(all.movements);
    expect(movements.stockAudit.scanned).toBe(false);
    expect(queryMarketCargoReportRows(stock,{section:'stock',
      type:'conflict'}).total).toBe(1);
    expect(queryMarketCargoReportRows(movements,{section:'movements',
      type:'modern_buy'}).total).toBe(1);
  });

  it('dispositions-only preview needs no settlement scan or worldAI traversal',()=>{
    const unreachable=new Proxy([city(0)],{
      get(target,key,receiver){
        if(key===Symbol.iterator)throw Error('Unexpected full map iteration');
        return Reflect.get(target,key,receiver);
      },
    });
    const worldAi={get parties(){throw Error('Unexpected live NPC scan');}};
    const snapshot=buildMarketCargoReport({
      settlements:unreachable,markets:{},catalog,worldAi,
      section:'dispositions',
    });
    expect(snapshot.computedSections).toMatchObject({
      stock:false,movements:false,escorts:false,dispositions:true,
    });
    expect(snapshot.stockAudit.rows).toEqual([]);
    expect(snapshot.escorts).toEqual([]);
  });

  it('clears only observational NPC loss history, never restores or mints goods',()=>{
    resetCargoDispositionJournal();
    const origin={...city(0),x:144,tx:4};
    const destination={...city(1),x:336,tx:10};
    const worldState={
      width:30,height:20,tileSize:32,
      settlements:[origin,destination],
      roads:[{from:0,to:1,path:[
        {x:4,y:6},{x:7,y:7},{x:10,y:6},
      ]}],
    };
    const routes=[{
      id:'route:0:1',fromCityId:0,toCityId:1,roadBacked:true,
    }];
    const def=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
    const quest={
      ...JSON.parse(JSON.stringify(def)
        .replaceAll('{{targetRouteId}}','route:0:1')
        .replaceAll('{{issuerFactionId}}','ottoman')),
      id:'v136-custody',templateId:def.id,status:'active',
      createdAt:3,issuerFactionId:'ottoman',targetRouteId:'route:0:1',
    };
    const caravan=spawnQuestEscortCaravan(quest,worldState,routes,4);
    const reserved=reserveEscortCargo({
      caravan,quest,worldState,tradeRoutes:routes,currentDay:4,catalog,
    });
    expect(reserved.reduce((sum,item)=>sum+item.qty,0)).toBe(20);
    const bandit=spawnPartyBandit(worldState,{}, {},{tradeRoutes:routes});
    const gained=recordEscortCargoRaid({
      caravan,bandit,remainingPercent:75,
    });
    expect(gained.reduce((sum,item)=>sum+item.qty,0)).toBe(5);
    const ai={parties:[caravan,bandit]};
    const reservedBefore=JSON.stringify(origin.marketStock);
    const outstandingBefore=outstandingEscortCargoForSave(ai.parties);
    bandit.alive=false;
    const disposal=disposeLiveBanditCargo({bandit,reason:'patrol_kill'});
    expect(disposal).toMatchObject({kind:'unrecovered_loss',
      reason:'patrol_kill'});
    const cargoBefore=auditLiveEscortCargoConservation({caravan,worldAi:ai});
    expect(cargoBefore).toMatchObject({status:'balanced',gap:0});
    expect(inspectCargoDispositions(128).some(r=>r.banditId===bandit.id))
      .toBe(true);
    resetCargoDispositionJournal();
    expect(inspectCargoDispositions(128)).toEqual([]);
    expect(inspectLiveBanditCargo(bandit)).toEqual([]);
    expect(auditLiveEscortCargoConservation({caravan,worldAi:ai}))
      .toEqual(cargoBefore);
    expect(JSON.stringify(origin.marketStock)).toBe(reservedBefore);
    expect(outstandingBefore.get('0')).toBeTruthy();
    expect(recordEscortCargoRaid({
      caravan,bandit,remainingPercent:50,
    })).toEqual([]);
  });
});
