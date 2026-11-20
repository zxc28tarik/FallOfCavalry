import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnQuestEscortCaravan, tickQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import { spawnPartyBandit, updateWorldParties } from '../../js/systems/world-ai.js';
import {
  reserveEscortCargo, recordEscortCargoRaid, inspectLiveBanditCargo,
  auditLiveEscortCargoConservation, outstandingEscortCargoForSave,
  classifyRetiredEscortCargo, deliverEscortCargo,
  witnessBanditCargoBattleVictory, recoverWitnessedBanditCargo,
  disposeLiveBanditCargo,
} from '../../js/systems/quest-escort-cargo.js';
import { snapshotMarketsWithPendingEscorts,
  establishMarketStockBridge } from '../../js/systems/market-stock-bridge.js';

const catalog = [
  { id: 'wheat', name: 'Wheat', unitValue: 10 },
  { id: 'iron', name: 'Iron', unitValue: 20 },
  { id: 'cloth', name: 'Cloth', unitValue: 30 },
];
const routes = [{ id:'route:0:1', fromCityId:0,toCityId:1,roadBacked:true }];
const sum = rows => rows.reduce((n,x)=>n+x.qty,0);
const qtyOf = (stock,id) => stock.find(row=>row.id===id)?.qty || 0;
const world = (wheat=12) => ({
  width: 30,height:20,tileSize:32,
  settlements:[
    { id:0,type:'city',tx:4,ty:6,x:144,y:208,
      marketStock:[{id:'wheat',qty:wheat},{id:'iron',qty:8},
        {id:'cloth',qty:4}] },
    { id:1,type:'city',tx:10,ty:6,x:336,y:208,
      marketStock:[{id:'wheat',qty:3},{id:'iron',qty:2},
        {id:'cloth',qty:1}] },
  ],
  roads:[{from:0,to:1,path:[
    {x:4,y:6},{x:7,y:7},{x:10,y:6},
  ]}],
});
const quest = id => {
  const def=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
  return {...JSON.parse(JSON.stringify(def)
    .replaceAll('{{targetRouteId}}','route:0:1')
    .replaceAll('{{issuerFactionId}}','ottoman')),
  id,templateId:def.id,createdAt:3,status:'active',
  issuerFactionId:'ottoman',targetRouteId:'route:0:1'};
};
const setup = (wheat=12) => {
  const map=world(wheat);
  const q=quest('v133-escort');
  const caravan=spawnQuestEscortCaravan(q,map,routes,4,2);
  const baseline=Object.fromEntries(catalog.map(item=>[
    item.id,qtyOf(map.settlements[0].marketStock,item.id)
      +qtyOf(map.settlements[1].marketStock,item.id),
  ]));
  const reserved=reserveEscortCargo({
    caravan,quest:q,worldState:map,tradeRoutes:routes,
    currentDay:4,catalog,
  });
  if(!reserved)throw Error('Missing real convoy stock');
  const bandit=spawnPartyBandit(map,{}, {BANDIT_SPEED:0.01},
    {tradeRoutes:routes});
  const ai={parties:[caravan,bandit]};
  const audit=()=>auditLiveEscortCargoConservation({caravan,worldAi:ai});
  const accountWorld=()=>{
    const book=audit();
    for(const row of book.rows) {
      const held=qtyOf(map.settlements[0].marketStock,row.id)
        +qtyOf(map.settlements[1].marketStock,row.id)
        +row.inCaravan+row.inBandits+row.inPlayer+row.unrecovered;
      expect(held).toBe(baseline[row.id]);
    }
    return book;
  };
  const raid=(remainingPercent=75)=>recordEscortCargoRaid({
    caravan,bandit,remainingPercent,
  });
  const receipt=()=> {
    const enemyId=`wai-${bandit.id}`;
    const battle={phase:'result',result:'victory',
      resolvedAt:1795169999000,enemyId,
      battleResult:{result:'victory',enemyId}};
    expect(witnessBanditCargoBattleVictory({
      battle,bandit,worldAi:ai,enemyId,
      linkedWorldPartyId:bandit.id,worldState:map,tradeRoutes:routes,
    })).toBe(true);
    return {battle,enemyId};
  };
  const arrive=(day=7)=> {
    const player={x:caravan.x,y:caravan.y};
    let status;
    for(let i=0;i<500;i++){
      player.x=caravan.x;player.y=caravan.y;
      status=tickQuestEscortCaravan(caravan,{
        quest:q,worldState:map,tradeRoutes:routes,
        currentDay:day,dtSec:0.25,playerParty:player,threat:false,
      }).status;
      if(status==='arrived')break;
    }
    expect(status).toBe('arrived');
    return deliverEscortCargo({
      caravan,quest:q,worldState:map,tradeRoutes:routes,currentDay:day,
    });
  };
  return {map,q,caravan,bandit,ai,baseline,reserved,audit,
    accountWorld,raid,receipt,arrive};
};

describe('WEB V1.33 — source-backed multi-day per-item conservation', () => {
  it('remains balanced across 3 game days of actual escort ticks and repeated live save snapshots',()=>{
    const p=setup();const stolen=p.raid();
    expect(sum(stolen)).toBe(6);
    const before=structuredClone(p.map.settlements);
    const market={stocks:{wheat:0,iron:0,cloth:0}};
    expect(establishMarketStockBridge(
      p.map.settlements[0],market,catalog).status).toBe('equal');
    for(const day of [4,5,6]){
      const playerParty={x:p.caravan.x,y:p.caravan.y};
      const step=tickQuestEscortCaravan(p.caravan,{
        quest:p.q,worldState:p.map,tradeRoutes:routes,
        currentDay:day,dtSec:0.2,playerParty,threat:true,
      });
      expect(['under_threat','awaiting_player']).toContain(step.status);
      const check=p.accountWorld();
      expect(check).toMatchObject({status:'balanced',reserved:24,
        accounted:24,gap:0});
      expect(check.rows.reduce((n,x)=>n+x.inBandits,0)).toBe(6);
      const snapshotGoods=outstandingEscortCargoForSave(p.ai.parties);
      const snapshot=snapshotMarketsWithPendingEscorts(
        {'0':market},[p.map.settlements[0]],snapshotGoods);
      expect(snapshot['0'].stocks).toEqual({wheat:12,iron:8,cloth:4});
      expect(market.stocks).toEqual({wheat:0,iron:0,cloth:0});
      expect(p.map.settlements).toEqual(before);
    }
  });

  it('balances real road arrival with unclaimed stolen cargo, and snapshot restores only it',()=>{
    const p=setup();p.raid();
    const delivered=p.arrive();
    expect(sum(delivered)).toBe(18);
    const audit=p.accountWorld();
    expect(audit.status).toBe('balanced');
    expect(sum(audit.rows.map(x=>({qty:x.atDestination})))).toBe(18);
    expect(sum(audit.rows.map(x=>({qty:x.inBandits})))).toBe(6);
    expect(deliverEscortCargo({
      caravan:p.caravan,quest:p.q,worldState:p.map,
      tradeRoutes:routes,currentDay:7,
    })).toBeNull();
    const refund=outstandingEscortCargoForSave(p.ai.parties).get('0');
    expect(Object.fromEntries(refund)).toEqual({wheat:6});
  });

  it('accounts for verified player recovery after legitimate tactical victory',()=>{
    const p=setup();p.raid();
    const {battle,enemyId}=p.receipt();
    const playerParty={inventory:{items:[]}};
    const recovered=recoverWitnessedBanditCargo({
      battle,bandit:p.bandit,worldAi:p.ai,enemyId,
      linkedWorldPartyId:p.bandit.id,playerParty,catalog,
    });
    expect(sum(recovered)).toBe(6);
    expect(playerParty.inventory.items).toMatchObject([
      {id:'wheat',qty:6},
    ]);
    let audit=p.accountWorld();
    expect(audit.rows.find(x=>x.id==='wheat').inPlayer).toBe(6);
    expect(audit.rows.find(x=>x.id==='wheat').inBandits).toBe(0);
    expect(outstandingEscortCargoForSave(p.ai.parties).get('0').get('wheat'))
      .toBe(6);
    p.bandit.alive=false;
    p.ai.parties=p.ai.parties.filter(x=>x!==p.bandit);
    p.arrive(7);
    audit=p.accountWorld();
    expect(audit.status).toBe('balanced');
    expect(audit.rows.find(x=>x.id==='wheat')).toMatchObject({
      inPlayer:6,inBandits:0,atDestination:6,inCaravan:0,gap:0,
    });
  });

  it('patrol-killed bandit becomes accounted unrecovered loss, never ghost inventory',()=>{
    const p=setup();p.raid();
    p.bandit.alive=false;
    expect(disposeLiveBanditCargo({
      bandit:p.bandit,reason:'patrol_kill',
    })).toMatchObject({kind:'unrecovered_loss',reason:'patrol_kill'});
    p.ai.parties=p.ai.parties.filter(x=>x!==p.bandit);
    const report=p.accountWorld();
    expect(report.rows.find(x=>x.id==='wheat')).toMatchObject({
      unrecovered:6,inBandits:0,inCaravan:6,gap:0,
    });
    expect(outstandingEscortCargoForSave(p.ai.parties).get('0').get('wheat'))
      .toBe(6);
  });

  it('missing bandit without witnessed death is a mismatch, not invented returned goods',()=>{
    const p=setup();p.raid();
    const origin=structuredClone(p.map.settlements[0].marketStock);
    p.ai.parties=[p.caravan];
    const report=p.audit();
    expect(report.status).toBe('mismatch');
    expect(report.rows.find(x=>x.id==='wheat').gap).toBe(6);
    expect(p.map.settlements[0].marketStock).toEqual(origin);
    expect(auditLiveEscortCargoConservation({
      caravan:{...p.caravan},worldAi:p.ai,
    }).status).toBe('unverified');
  });

  it('retiring an authentic failed convoy classifies remaining cargo once',()=>{
    const p=setup();p.raid();
    p.caravan.alive=false;
    const write=classifyRetiredEscortCargo({
      caravan:p.caravan,reason:'escort_failed',
    });
    expect(sum(write)).toBe(18);
    expect(classifyRetiredEscortCargo({
      caravan:p.caravan,reason:'escort_failed',
    })).toEqual([]);
    const report=p.accountWorld();
    expect(report.status).toBe('balanced');
    expect(report.retiredReason).toBe('escort_failed');
    expect(report.rows.find(x=>x.id==='wheat')).toMatchObject({
      inCaravan:0,inBandits:6,unrecovered:6,gap:0,
    });
    expect(outstandingEscortCargoForSave(p.ai.parties).get('0').get('wheat'))
      .toBe(6); // only the living bandit's stolen units in save escrow
  });

  it('genuine but unexpectedly destroyed convoy is flagged rather than counted as live',()=>{
    const p=setup();p.caravan.alive=false;
    const report=p.audit();
    expect(report.status).toBe('mismatch');
    expect(report.gap).toBe(24);
    expect(report.rows.every(x=>x.inCaravan===0)).toBe(true);
  });

  it('source-specific audit records remain isolated across two real convoys',()=>{
    const p=setup(48);
    const second=quest('v133-second');
    const secondCaravan=spawnQuestEscortCaravan(second,p.map,routes,4);
    expect(sum(reserveEscortCargo({
      caravan:secondCaravan,quest:second,worldState:p.map,
      tradeRoutes:routes,currentDay:4,catalog,
    }))).toBe(24);
    p.ai.parties.push(secondCaravan);
    expect(sum(p.raid())).toBe(6);
    const stolenSecond=recordEscortCargoRaid({
      caravan:secondCaravan,bandit:p.bandit,remainingPercent:75,
    });
    expect(sum(stolenSecond)).toBe(6);
    const secondAudit=()=>auditLiveEscortCargoConservation({
      caravan:secondCaravan,worldAi:p.ai,
    });
    expect(p.audit().status).toBe('balanced');
    expect(secondAudit().status).toBe('balanced');
    const {battle,enemyId}=p.receipt();
    const playerParty={inventory:{items:[]}};
    expect(sum(recoverWitnessedBanditCargo({
      battle,bandit:p.bandit,worldAi:p.ai,enemyId,
      linkedWorldPartyId:p.bandit.id,playerParty,catalog,
    }))).toBe(12);
    expect(p.audit().rows[0].inPlayer).toBe(6);
    expect(secondAudit().rows[0].inPlayer).toBe(6);
    expect(p.audit().gap).toBe(0);
    expect(secondAudit().gap).toBe(0);
  });
});
