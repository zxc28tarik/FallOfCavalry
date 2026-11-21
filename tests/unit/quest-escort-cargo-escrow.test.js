import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnPartyBandit } from '../../js/systems/world-ai.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import { spawnEscortNpcGuards, runEscortNpcSkirmish } from '../../js/systems/quest-escort-npc-guards.js';
import {
  reserveEscortCargo, recordEscortCargoRaid, inspectLiveEscortCargo,
  inspectLiveBanditCargo, returnGuardRecoveredEscortCargo,
  outstandingEscortCargoForSave,
  witnessBanditCargoBattleVictory, recoverWitnessedBanditCargo,
} from '../../js/systems/quest-escort-cargo.js';
import {
  snapshotMarketsWithPendingEscorts, establishMarketStockBridge,
} from '../../js/systems/market-stock-bridge.js';

const catalog = [
  { id:'wheat',name:'Wheat',unitValue:8 },
  { id:'iron',name:'Iron',unitValue:15 },
  { id:'cloth',name:'Cloth',unitValue:20 },
];
const routes = [{
  id:'route:0:1',fromCityId:0,toCityId:1,roadBacked:true,
}];
const fixture = () => {
  const worldState = {
    width:30,height:20,tileSize:32,
    settlements:[
      { id:0,type:'city',x:144,y:208,tx:4,ty:6,
        marketStock:[
          {id:'wheat',qty:20},{id:'iron',qty:20},{id:'cloth',qty:20},
        ] },
      { id:1,type:'city',x:336,y:208,tx:10,ty:6,
        marketStock:[
          {id:'wheat',qty:4},{id:'iron',qty:4},{id:'cloth',qty:4},
        ] },
    ],
    roads:[{from:0,to:1,path:[
      {x:4,y:6},{x:7,y:7},{x:10,y:6},
    ]}],
  };
  const def=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
  const quest={
    ...JSON.parse(JSON.stringify(def)
      .replaceAll('{{targetRouteId}}','route:0:1')
      .replaceAll('{{issuerFactionId}}','ottoman')),
    id:'quest_guard_recapture',templateId:def.id,status:'active',
    createdAt:3,issuerFactionId:'ottoman',targetRouteId:'route:0:1',
  };
  const caravan=spawnQuestEscortCaravan(quest,worldState,routes,4);
  const reserved=reserveEscortCargo({
    caravan,quest,worldState,tradeRoutes:routes,currentDay:4,catalog,
  });
  if(!reserved?.length)throw Error('Missing genuine source cargo');
  const bandit=spawnPartyBandit(worldState,{},{},{tradeRoutes:routes});
  const parties=[caravan,bandit];
  return { worldState,quest,caravan,reserved,bandit,parties };
};
const total = rows => rows.reduce((sum,item)=>sum+item.qty,0);
const saveAmounts = (parties) => {
  const map=outstandingEscortCargoForSave(parties);
  return Object.fromEntries([...(map.get('0') || new Map())]);
};

describe('WEB V1.31 — same-source guard recapture and save-safe stolen cargo', () => {
  it('returns only real stolen cargo after authentic NPC guard victory, exactly once', () => {
    const f=fixture();
    spawnEscortNpcGuards(f.caravan,f.parties);
    f.caravan.escortStarted=true;
    f.bandit.x=f.caravan.x+24;
    f.bandit.y=f.caravan.y;
    let won=null,stolenEver=false;
    for(let tick=0;tick<40 && f.bandit.alive!==false;tick++){
      const state=runEscortNpcSkirmish({
        caravan:f.caravan,quest:f.quest,parties:f.parties,
        worldState:f.worldState,tradeRoutes:routes,currentDay:4,dtSec:0.2,
      });
      stolenEver ||= total(inspectLiveBanditCargo(f.bandit))>0;
      if(state.status==='defended')won=state;
    }
    expect(stolenEver).toBe(true);
    expect(f.bandit.alive).toBe(false);
    expect(won?.returnedUnits).toBeGreaterThan(0);
    expect(total(won.returnedCargo)).toBe(won.returnedUnits);
    expect(total(inspectLiveEscortCargo(f.caravan))).toBe(24);
    expect(inspectLiveBanditCargo(f.bandit)).toEqual([]);
    expect(returnGuardRecoveredEscortCargo({
      caravan:f.caravan,bandit:f.bandit,quest:f.quest,
      worldState:f.worldState,tradeRoutes:routes,currentDay:4,
    })).toEqual([]);
    expect(total(inspectLiveEscortCargo(f.caravan))).toBe(24);
    expect(f.caravan.escortCargo).toBe(100);
  });

  it('does not return a different genuine caravan’s loot from the same bandit', () => {
    const a=fixture();
    const other={...a.quest,id:'quest_other_caravan'};
    const caravan2=spawnQuestEscortCaravan(other,a.worldState,routes,4);
    const reserved2=reserveEscortCargo({
      caravan:caravan2,quest:other,worldState:a.worldState,
      tradeRoutes:routes,currentDay:4,catalog,
    });
    expect(total(reserved2)).toBeGreaterThan(0);
    const stolenA=recordEscortCargoRaid({
      caravan:a.caravan,bandit:a.bandit,remainingPercent:75,
    });
    const stolenB=recordEscortCargoRaid({
      caravan:caravan2,bandit:a.bandit,remainingPercent:75,
    });
    expect(total(stolenA)).toBeGreaterThan(0);
    expect(total(stolenB)).toBeGreaterThan(0);
    a.bandit.alive=false; // Mark outcome; function also checks source-route and quest.
    const returned=returnGuardRecoveredEscortCargo({
      caravan:a.caravan,bandit:a.bandit,quest:a.quest,
      worldState:a.worldState,tradeRoutes:routes,currentDay:4,
    });
    expect(returned).toEqual(stolenA);
    expect(total(inspectLiveEscortCargo(a.caravan))).toBe(24);
    expect(total(inspectLiveEscortCargo(caravan2)))
      .toBe(total(reserved2)-total(stolenB));
    expect(inspectLiveBanditCargo(a.bandit)).toEqual(stolenB);
  });

  it('rejects fake bandit, wrong route, unverified death, and wrong quest', () => {
    const f=fixture();
    recordEscortCargoRaid({
      caravan:f.caravan,bandit:f.bandit,remainingPercent:75,
    });
    const before=inspectLiveEscortCargo(f.caravan);
    const args={caravan:f.caravan,bandit:f.bandit,quest:f.quest,
      worldState:f.worldState,tradeRoutes:routes,currentDay:4};
    expect(returnGuardRecoveredEscortCargo(args)).toEqual([]);
    f.bandit.alive=false;
    expect(returnGuardRecoveredEscortCargo({...args,bandit:{...f.bandit}}))
      .toEqual([]);
    expect(returnGuardRecoveredEscortCargo({...args,quest:{
      ...f.quest,id:'fake',
    }})).toEqual([]);
    expect(returnGuardRecoveredEscortCargo({
      ...args,tradeRoutes:[],
    })).toEqual([]);
    expect(inspectLiveEscortCargo(f.caravan)).toEqual(before);
  });

  it('refunds genuine unclaimed NPC stolen units only into the SAVE snapshot', () => {
    const f=fixture();
    const stolen=recordEscortCargoRaid({
      caravan:f.caravan,bandit:f.bandit,remainingPercent:75,
    });
    expect(total(stolen)).toBe(6);
    const inTransit=saveAmounts([f.caravan]);
    expect(Object.values(inTransit).reduce((a,b)=>a+b,0)).toBe(18);
    const all=saveAmounts([f.caravan,f.bandit]);
    expect(Object.values(all).reduce((a,b)=>a+b,0)).toBe(24);
    expect(total(inspectLiveEscortCargo(f.caravan))).toBe(18);
    expect(total(inspectLiveBanditCargo(f.bandit))).toBe(6);
    expect(f.worldState.settlements[0].marketStock[0].qty).toBe(0);
    // Saving a genuine live bandit must NOT persist a "loot" claim.
    const savedParty=JSON.parse(JSON.stringify(f.bandit));
    expect(savedParty).not.toHaveProperty('loot');
    expect(saveAmounts([f.caravan,savedParty]))
      .toEqual(inTransit); // Clone cannot authorize escrow refund.
  });

  it('mirrors escrow into both validated market ledgers with no runtime mutation', () => {
    const f=fixture();
    const origin=f.worldState.settlements[0];
    const market={stocks:{wheat:0,iron:20,cloth:20}};
    // Source reservation was 20 wheat + 4 iron; city now has wheat 0, iron 16.
    market.stocks.iron=origin.marketStock.find(x=>x.id==='iron').qty;
    market.stocks.cloth=origin.marketStock.find(x=>x.id==='cloth').qty;
    expect(establishMarketStockBridge(origin,market,catalog).status).toBe('equal');
    const stolen=recordEscortCargoRaid({
      caravan:f.caravan,bandit:f.bandit,remainingPercent:75,
    });
    expect(total(stolen)).toBe(6);
    const expected=outstandingEscortCargoForSave([f.caravan,f.bandit]);
    const saved=snapshotMarketsWithPendingEscorts(
      {'0':market},[origin],expected,
    );
    expect(saved['0'].stocks.wheat).toBe(20);
    expect(saved['0'].stocks.iron).toBe(20);
    expect(market.stocks.wheat).toBe(0);
    expect(origin.marketStock.find(x=>x.id==='wheat').qty).toBe(0);
    expect(saved['0'].stockBridge).toBeTruthy();
  });

  it('does not refund unclaimed loot once player genuinely claimed it', () => {
    const f=fixture();
    const stolen=recordEscortCargoRaid({
      caravan:f.caravan,bandit:f.bandit,remainingPercent:75,
    });
    const enemyId=`wai-${f.bandit.id}`;
    const battle={phase:'result',result:'victory',
      resolvedAt:1795165000000,enemyId,
      battleResult:{result:'victory',enemyId}};
    expect(witnessBanditCargoBattleVictory({
      battle,bandit:f.bandit,worldAi:{parties:f.parties},enemyId,
      linkedWorldPartyId:f.bandit.id,worldState:f.worldState,tradeRoutes:routes,
    })).toBe(true);
    const playerParty={inventory:{items:[]}};
    expect(total(recoverWitnessedBanditCargo({
      battle,bandit:f.bandit,worldAi:{parties:f.parties},enemyId,
      linkedWorldPartyId:f.bandit.id,playerParty,catalog,
    }))).toBe(total(stolen));
    expect(Object.values(saveAmounts(f.parties)).reduce((a,b)=>a+b,0))
      .toBe(18);
    expect(total(playerParty.inventory.items)).toBe(6);
  });

  it('does not credit missing, dead or cloned bandit as a live save escrow', () => {
    const f=fixture();
    recordEscortCargoRaid({
      caravan:f.caravan,bandit:f.bandit,remainingPercent:75,
    });
    const base=saveAmounts([f.caravan]);
    expect(saveAmounts([f.caravan,{...f.bandit}])).toEqual(base);
    f.bandit.alive=false;
    expect(saveAmounts([f.caravan,f.bandit])).toEqual(base);
    f.bandit.alive=true;
    expect(Object.values(saveAmounts([f.caravan,f.bandit]))
      .reduce((sum,v)=>sum+v,0)).toBe(24);
  });
});
