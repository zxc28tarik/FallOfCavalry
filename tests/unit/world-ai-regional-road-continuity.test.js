import {describe,it,expect} from 'vitest';
import {
  streamWorldAiRegion,
} from '../../js/systems/world-ai-regional-stream.js';
import {
  nextCanonicalCityLeg,verifiedRoadLegPath,
} from '../../js/systems/world-ai-local-sources.js';
import {
  spawnPartyCaravan,spawnPartyPatrol,ensureWorldParties,
  createInitialWorldAiState,updateWorldParties,
} from '../../js/systems/world-ai.js';
import {validBanditRoute} from '../../js/systems/quest-world-party-links.js';
import {SaveManager} from '../../js/managers/SaveManager.js';
import WorldPartyManager from '../../js/managers/WorldPartyManager.js';

const city=(id,tx,ty,owner='ottoman')=>({
  id,tx,ty,x:(tx+0.5)*32,y:(ty+0.5)*32,ownerFactionId:owner,
});
const a=city('a',10,10),b=city('b',20,10),c=city('c',30,10);
const d=city('d',120,10,'venice'),e=city('e',132,10,'venice');
const map={
  width:180,height:80,tileSize:32,
  settlements:[a,b,c,d,e],
  roads:[
    {from:'a',to:'b',path:[{x:10,y:10},{x:15,y:10},{x:20,y:10}]},
    {from:'b',to:'c',path:[{x:20,y:10},{x:25,y:10},{x:30,y:10}]},
    {from:'d',to:'e',path:[{x:120,y:10},{x:126,y:10},{x:132,y:10}]},
  ],
};
const nearA={x:a.x,y:a.y,factionId:'ottoman'};
const nearD={x:d.x,y:d.y,factionId:'venice'};
const cfg={
  MAX_BANDIT_PARTIES:2,MAX_PATROL_PARTIES:1,MAX_CARAVAN_PARTIES:1,
  MAX_REFUGEE_PARTIES:2,MAX_TRAVELING_MERCHANT_PARTIES:2,
  MAX_MESSENGER_PARTIES:2,MAX_VILLAGER_PARTIES:2,MAX_NOBLE_PARTIES:1,
  DESPAWN_DISTANCE:40,RESPAWN_INTERVAL_DAYS:3,
};
const distance=(p,player)=>Math.hypot(p.x-player.x,p.y-player.y)/32;
const row=(id,kind,home,x,y,extra={})=>({
  id,kind,homeCityId:home,alive:true,x,y,
  targetX:x,targetY:y,factionId:kind==='bandit'?'bandits':'ottoman',
  path:null,pathIndex:0,...extra,
});
const init=(parties=[])=>({
  parties, lastRespawnDay:1,lastVisibleRespawnDay:1,
});
const move=(ai,player,day=1,routeIds=[])=>streamWorldAiRegion({
  aiState:ai,worldState:map,playerParty:player,cfg,
  currentDay:day,protectedRouteIds:routeIds,
});
const fill=(ai,player,day=1,forceRegionPopulation=false)=>ensureWorldParties({
  aiState:ai,worldState:map,playerParty:player,
  factions:{ottoman:{},venice:{}},tradeRoutes:[],
  currentDay:day,cfg,forceRegionPopulation,
});

describe('V1.46 — real canonical multileg travel',()=>{
  it('selects a second real road leg from city b to c, not backtracking b to a',()=>{
    const next=nextCanonicalCityLeg(map,'b','a');
    expect(next.fromCityId).toBe('b');
    expect(next.toCityId).toBe('c');
    expect(next.path).toEqual([
      {x:b.x,y:b.y},{x:(25.5)*32,y:b.y},{x:c.x,y:c.y},
    ]);
    expect(next.roadId).toBe('route:b:c');
  });
  it('uses real reverse road on a true dead end instead of random jump',()=>{
    const next=nextCanonicalCityLeg(map,'c','b');
    expect(next.toCityId).toBe('b');
    expect(next.path.at(-1)).toEqual({x:b.x,y:b.y});
    expect(nextCanonicalCityLeg(map,'nonexistent','a')).toBeNull();
  });
  it('reconstructs only registered waypoints when a saved caravan resumes mid-leg',()=>{
    const mid={x:(25.5)*32,y:b.y};
    expect(verifiedRoadLegPath(map,'b','c',mid)).toEqual([
      mid,{x:c.x,y:c.y},
    ]);
    expect(verifiedRoadLegPath(map,'b','d',mid)).toEqual([]);
  });
  it('caravan actually completes the road a→b→c, then reverses from dead end',()=>{
    const p=spawnPartyCaravan(map,{},'ottoman',cfg,{playerParty:nearA});
    // A or B could be chosen as the home; establish the A→B source leg
    // explicitly without modifying any canonical road geometry.
    p.x=a.x;p.y=a.y;p.homeCityId='a';p.currentCityId='a';
    p.targetX=b.x;p.targetY=b.y;
    p.path=verifiedRoadLegPath(map,'a','b',p);p.pathIndex=0;
    const ai=init([p]);
    for(let i=0;i<4;i++)updateWorldParties({
      aiState:ai,worldState:map,playerParty:null,
      cfg,dtSec:60,tradeRoutes:[],
    });
    expect(p.completedRoadLegs).toBeGreaterThanOrEqual(1);
    expect(p.currentCityId).toBe('b');
    expect([p.targetX,p.targetY]).toEqual([c.x,c.y]);
    expect(p.routeId).toBeUndefined();
    for(let i=0;i<4;i++)updateWorldParties({
      aiState:ai,worldState:map,playerParty:null,
      cfg,dtSec:60,tradeRoutes:[],
    });
    expect(p.currentCityId).toBe('c');
    expect([p.targetX,p.targetY]).toEqual([b.x,b.y]);
    expect(p.completedRoadLegs).toBeGreaterThanOrEqual(2);
  });
  it('patrol takes a real neighboring-road destination after arriving at b',()=>{
    const p=spawnPartyPatrol(map,{},'ottoman',cfg,{playerParty:nearA});
    p.x=a.x;p.y=a.y;p.homeCityId='a';p.currentCityId='a';
    p.targetX=b.x;p.targetY=b.y;
    p.path=verifiedRoadLegPath(map,'a','b',p);p.pathIndex=0;
    const ai=init([p]);
    for(let i=0;i<4;i++)updateWorldParties({
      aiState:ai,worldState:map,playerParty:null,cfg,dtSec:60,
    });
    expect(p.currentCityId).toBe('b');
    expect([p.targetX,p.targetY]).toEqual([c.x,c.y]);
    expect(p.factionId).toBe('ottoman');
  });
});

describe('V1.46 — reversible regional party streaming',()=>{
  it('does not spawn an enemy patrol directly onto a player at a real town',()=>{
    for(let i=0;i<12;i++){
      const patrol=spawnPartyPatrol(map,{},'ottoman',cfg,{
        playerParty:nearA,
      });
      const from=map.settlements.find(s=>s.id===patrol.homeCityId);
      expect(from).toBeDefined();
      expect(distance(patrol,nearA)).toBeGreaterThanOrEqual(8);
      expect(patrol.factionId).toBe('ottoman');
    }
  });
  it('regional hostile grace prevents immediate fights but expires during real simulation',()=>{
    const party=row('foreign-patrol','patrol','d',nearD.x,nearD.y,{
      factionId:'venice',speed:0.01,
      targetX:nearD.x+20,targetY:nearD.y,
      path:[{x:nearD.x+20,y:nearD.y}],pathIndex:0,
      regionEntryGraceSeconds:6,
    });
    const ai=init([party]);
    const before=updateWorldParties({
      aiState:ai,worldState:map,playerParty:nearA,
      cfg,dtSec:1,
    });
    // The party is far from nearA, so no false encounter is fabricated.
    expect(before).toEqual([]);
    const ai2=init([{
      ...party,x:nearD.x,y:nearD.y,alive:true,
      path:[{x:nearD.x+20,y:nearD.y}],pathIndex:0,
      regionEntryGraceSeconds:6,
    }]);
    const hostilePlayer={...nearD,factionId:'ottoman'};
    const first=updateWorldParties({
      aiState:ai2,worldState:map,playerParty:hostilePlayer,
      cfg,dtSec:1,
    });
    expect(first).toHaveLength(0);
    expect(ai2.parties[0].regionEntryGraceSeconds).toBe(5);
    const later=updateWorldParties({
      aiState:ai2,worldState:map,playerParty:hostilePlayer,
      cfg,dtSec:5.5,
    });
    expect(later.some(e=>e.partyId==='foreign-patrol')).toBe(true);
  });
  it('parks gradual out-of-range departures without route-bandit loot disposal',()=>{
    const p=row('slow-leaving-bandit','bandit','a',a.x,a.y,
      {targetX:b.x,targetY:b.y});
    const ai=init([p]);
    ai.dormantParties=[];
    let disposal=0;
    updateWorldParties({
      aiState:ai,worldState:map,playerParty:nearD,cfg,dtSec:0.016,
      onBanditRemoved:()=>{disposal++;},
    });
    expect(ai.parties).toHaveLength(0);
    expect(ai.dormantParties).toHaveLength(1);
    expect(ai.dormantParties[0]).toBe(p);
    expect(p.alive).toBe(true);
    expect(disposal).toBe(0);
  });
  it('never schedules surprise encounters while stationary inspecting markets',()=>{
    const manager=new WorldPartyManager();
    let triggered=0;
    const world={
      state:{mode:'map',encounter:null},
      enemyParties:[],
      getMovementContextAt:()=>({encounterMult:99}),
      simManager:{triggerEncounter:()=>{triggered++;return true;}},
    };
    const game={playerParty:{
      x:a.x,y:a.y,hasDestination:false,moveState:'idle',vx:0,vy:0,
    }};
    manager.init(world,game);
    for(let i=0;i<200;i++)
      expect(manager.checkSurpriseEncounters()).toBe(false);
    expect(triggered).toBe(0);
  });
  it('parks ordinary distant parties with their original objects instead of killing them',()=>{
    const near=row('old-patrol','patrol','a',a.x,a.y);
    const ai=init([near]);
    move(ai,nearA);
    const stage=move(ai,nearD);
    expect(stage).toMatchObject({changed:true,parked:1,restored:0,
      forcePopulation:true});
    expect(ai.parties).toHaveLength(0);
    expect(ai.dormantParties).toHaveLength(1);
    expect(ai.dormantParties[0]).toBe(near);
    expect(near.alive).toBe(true);
    expect(ai.lastRespawnDay).toBe(1);
  });
  it('restores the same party ID and source city when player returns the same day',()=>{
    const near=row('old-patrol','patrol','a',a.x,a.y,
      {completedRoadLegs:7,currentCityId:'a'});
    const ai=init([near]);
    move(ai,nearA);
    move(ai,nearD);
    const back=move(ai,nearA);
    expect(back).toMatchObject({changed:true,restored:1,
      forcePopulation:false});
    expect(ai.parties[0]).toBe(near);
    expect(ai.parties[0]).toMatchObject({
      id:'old-patrol',homeCityId:'a',completedRoadLegs:7,
    });
    expect(ai.dormantParties).toHaveLength(0);
  });
  it('does not stream on repeated same-region renders or small camera movements',()=>{
    const ai=init([row('one','caravan','a',a.x,a.y)]);
    move(ai,nearA);
    for(let i=0;i<75;i++){
      const x=nearA.x+((i%5)*32);
      expect(move(ai,{...nearA,x})).toMatchObject({
        changed:false,parked:0,restored:0,
      });
    }
    expect(ai.parties).toHaveLength(1);
    expect(ai.dormantParties).toHaveLength(0);
  });
  it('fills the new region once without resetting the global 3-day timer',()=>{
    const ai=createInitialWorldAiState();
    fill(ai,nearA,1);
    expect(ai.parties).toHaveLength(4);
    expect(ai.lastRespawnDay).toBe(1);
    move(ai,nearA);
    const switchResult=move(ai,nearD);
    expect(switchResult.forcePopulation).toBe(true);
    fill(ai,nearD,1,switchResult.forcePopulation);
    expect(ai.parties).toHaveLength(4);
    expect(ai.dormantParties.length).toBeGreaterThan(0);
    expect(ai.parties.every(p=>distance(p,nearD)<=40)).toBe(true);
    expect(ai.lastRespawnDay).toBe(1);
    const ids=ai.parties.map(p=>p.id);
    for(let n=0;n<30;n++)fill(ai,nearD,1);
    expect(ai.parties.map(p=>p.id)).toEqual(ids);
  });
  it('never invents a local population when real map contains no local city',()=>{
    const ai=init([row('one','patrol','a',a.x,a.y)]);
    move(ai,nearA);
    const empty={x:4000,y:2100,factionId:'ottoman'};
    expect(move(ai,empty).forcePopulation).toBe(false);
    expect(ai.parties).toHaveLength(0);
    expect(ai.dormantParties[0].id).toBe('one');
  });
  it('honors active source-backed quest route party as protected from parking',()=>{
    const protectedBandit=row('quest-threat','bandit','a',a.x,a.y,{
      routeId:'route:a:b',targetX:b.x,targetY:b.y,
    });
    const normal=row('normal-caravan','caravan','a',a.x,a.y);
    const ai=init([protectedBandit,normal]);
    move(ai,nearA);
    const transition=move(ai,nearD,1,['route:a:b']);
    expect(transition.parked).toBe(1);
    expect(ai.parties).toContain(protectedBandit);
    expect(ai.dormantParties).toContain(normal);
    updateWorldParties({
      aiState:ai,worldState:map,playerParty:nearD,
      cfg,tradeRoutes:[{id:'route:a:b',fromCityId:'a',toCityId:'b'}],
      protectedRouteIds:['route:a:b'],dtSec:0.1,
    });
    expect(ai.parties).toContain(protectedBandit);
    expect(protectedBandit.alive).toBe(true);
  });
  it('keeps two genuine distant regions in a JSON save roundtrip',()=>{
    const ai=init([row('real-001','caravan','a',a.x,a.y,{
      currentCityId:'a',previousCityId:'b',completedRoadLegs:2,
    })]);
    move(ai,nearA);
    move(ai,nearD);
    const saved=JSON.parse(JSON.stringify(ai));
    expect(saved.dormantParties[0].id).toBe('real-001');
    move(saved,nearA);
    expect(saved.parties[0]).toMatchObject({
      id:'real-001',homeCityId:'a',
      currentCityId:'a',previousCityId:'b',completedRoadLegs:2,
    });
  });
  it('persists and reloads dormant sources, regional history and 0 city ID',()=>{
    const worldAi=init([]);
    worldAi.dormantParties=[
      row('historic-0','caravan',0,450,450,{
        currentCityId:0,previousCityId:1,completedRoadLegs:4,
      }),
    ];
    worldAi.regionAnchor={x:d.x,y:d.y};
    worldAi.regionHistory=[
      {x:a.x,y:a.y,lastDay:1},{x:d.x,y:d.y,lastDay:2},
    ];
    const state={mode:'map',day:2,map:{...map,settlements:[
      {...a,id:0},{...b,id:1},c,d,e,
    ]}};
    const game={
      playerParty:{x:d.x,y:d.y,gold:1,roster:[]},
      itemCatalog:[],settings:{},
      worldManager:{worldAi,enemyParties:[],
        lastEncounterEndTimeByEnemyId:{},
        syncBuildingStateToMap:()=>null},
      ensureRosterState:()=>{},ensureInventoryModel:()=>{},
    };
    const saver=new SaveManager(state);
    saver.init(game);
    const payload=saver.buildSavePayload();
    expect(payload.game.worldAi.dormantParties[0]).toMatchObject({
      id:'historic-0',homeCityId:0,currentCityId:0,
      previousCityId:1,completedRoadLegs:4,
    });
    expect(payload.game.worldAi.regionHistory).toHaveLength(2);
    game.worldManager.worldAi=init([]);
    expect(saver.applySavePayload(JSON.parse(JSON.stringify(payload)))).toBe(true);
    expect(game.worldManager.worldAi.dormantParties[0]).toMatchObject({
      id:'historic-0',homeCityId:0,completedRoadLegs:4,
    });
    expect(game.worldManager.worldAi.regionHistory).toHaveLength(2);
    const importedPatrol={
      id:'imported-hostile',kind:'patrol',factionId:'venice',
      x:d.x,y:d.y,targetX:e.x,targetY:e.y,homeCityId:'d',
    };
    expect(game.worldManager.worldAi.dormantParties[0].regionEntryGraceSeconds)
      .toBe(0); // the saved caravan itself is non-hostile
    // A hostile record is granted short safe handoff on load only.
    game.worldManager.worldAi.parties.push(importedPatrol);
    const payload2=saver.buildSavePayload();
    saver.applySavePayload(JSON.parse(JSON.stringify(payload2)));
    expect(game.worldManager.worldAi.parties.find(p=>
      p.id==='imported-hostile').regionEntryGraceSeconds).toBe(6);
  });
});
