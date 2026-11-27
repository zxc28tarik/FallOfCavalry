import {describe,it,expect} from 'vitest';
import {
  createInitialWorldAiState,ensureWorldParties,spawnPartyBandit,
  spawnPartyPatrol,spawnPartyCaravan,updateWorldParties,
} from '../../js/systems/world-ai.js';
import {validBanditRoute,spawnBanditOnRegisteredRoute}
  from '../../js/systems/quest-world-party-links.js';
import {
  nearbyActualCities,selectLocalCity,localRoadFromCity,localWorldRadius,
} from '../../js/systems/world-ai-local-sources.js';
import {roadWorldWaypoints} from '../../js/systems/world-trade-road-topology.js';

const city=(id,tx,ty,ownerFactionId)=>({
  id,tx,ty,x:(tx+0.5)*32,y:(ty+0.5)*32,ownerFactionId,
});
const a=city('a',12,12,'ottoman');
const b=city('b',24,12,'ottoman');
const c=city('c',18,24,'venice');
const d=city('d',63,63,'hre');
const e=city('e',68,63,'hre');
const world={
  width:80,height:80,tileSize:32,
  settlements:[a,b,c,d,e],
  roads:[
    {from:'a',to:'b',path:[
      {x:12,y:12},{x:18,y:12},{x:24,y:12},
    ]},
    {from:'d',to:'e',path:[
      {x:63,y:63},{x:65,y:63},{x:68,y:63},
    ]},
  ],
};
const tradeRoutes=[
  {id:'route:a:b',fromCityId:'a',toCityId:'b',roadBacked:true},
  {id:'route:d:e',fromCityId:'d',toCityId:'e',roadBacked:true},
];
const playerParty={x:a.x,y:a.y,factionId:'ottoman'};
const cfg={
  MAX_BANDIT_PARTIES:4,MAX_PATROL_PARTIES:3,MAX_CARAVAN_PARTIES:3,
  DESPAWN_DISTANCE:40,RESPAWN_INTERVAL_DAYS:3,
};
const within=p=>Math.hypot(p.x-playerParty.x,p.y-playerParty.y)
  <=cfg.DESPAWN_DISTANCE*world.tileSize;
const fill=(ai,day=1,opts={})=>ensureWorldParties({
  aiState:ai,worldState:world,factions:{ottoman:{},venice:{},hre:{}},
  cfg:{...cfg,...opts.cfg},currentDay:day,tradeRoutes:opts.routes??tradeRoutes,
  playerParty:opts.playerParty??playerParty,
});
describe('V1.45 — local canonical road and real city sources of base world parties',()=>{
  it('sources 4 bandits, 3 patrols and 3 caravans from player region',()=>{
    const ai=createInitialWorldAiState();
    fill(ai);
    expect(ai.parties).toHaveLength(10);
    expect(ai.parties.filter(p=>p.kind==='bandit')).toHaveLength(4);
    expect(ai.parties.filter(p=>p.kind==='patrol')).toHaveLength(3);
    expect(ai.parties.filter(p=>p.kind==='caravan')).toHaveLength(3);
    expect(ai.parties.every(within)).toBe(true);
    expect(ai.parties.every(p=>
      world.settlements.some(s=>String(s.id)===String(p.homeCityId)))).toBe(true);
    expect(ai.lastRespawnDay).toBe(1);
  });
  it('anchors route-backed bandits to real local road waypoints, not far damaged road',()=>{
    const far=tradeRoutes[1];
    const preferred=[tradeRoutes[0],{...far,recentLoss:true,damage:5}];
    const source=spawnBanditOnRegisteredRoute(world,preferred,0,{playerParty,cfg});
    expect(source.routeId).toBe('route:a:b');
    expect(roadWorldWaypoints(world,world.roads[0]))
      .toContainEqual({x:source.x,y:source.y});
    const party=spawnPartyBandit(world,{},cfg,{tradeRoutes:preferred,playerParty});
    expect(party.routeId).toBe('route:a:b');
    expect(validBanditRoute(party,world,preferred)).not.toBeNull();
    expect(within(party)).toBe(true);
  });
  it('does not mislabel a nearby bandit as a distant real trade-route threat',()=>{
    const remote=[tradeRoutes[1]];
    expect(spawnBanditOnRegisteredRoute(world,remote,0,{playerParty,cfg})).toBeNull();
    const party=spawnPartyBandit(world,{},cfg,{tradeRoutes:remote,playerParty});
    expect(party.routeId).toBeUndefined();
    expect(['a','b','c']).toContain(party.homeCityId);
    expect(validBanditRoute(party,world,remote)).toBeNull();
    expect(within(party)).toBe(true);
  });
  it('a forged trade route never receives canonical on-road authority',()=>{
    const fake=[{id:'route:fake:fake',fromCityId:'a',toCityId:'b'}];
    const p=spawnPartyBandit(world,{},cfg,{tradeRoutes:fake,playerParty});
    expect(p.routeId).toBeUndefined();
    expect(p.homeCityId).not.toBeUndefined();
  });
  it('does not force a route-bandit encounter beside the starting city',()=>{
    const near=city('near',17,12,'ottoman');
    const shortWorld={
      ...world,settlements:[a,near],
      roads:[{from:'a',to:'near',path:[
        {x:12,y:12},{x:15,y:12},{x:17,y:12},
      ]}],
    };
    const shortRoutes=[{
      id:'route:a:near',fromCityId:'a',toCityId:'near',roadBacked:true,
    }];
    const route=spawnBanditOnRegisteredRoute(
      shortWorld,shortRoutes,0,{playerParty,cfg});
    expect(route).toBeNull(); // Every real road anchor falls inside 8 tiles.
    const bandit=spawnPartyBandit(shortWorld,{},cfg,{
      tradeRoutes:shortRoutes,playerParty,
    });
    expect(bandit.routeId).toBeUndefined();
    expect(['a','near']).toContain(bandit.homeCityId);
    const distanceTiles=Math.hypot(
      bandit.x-playerParty.x,bandit.y-playerParty.y)/32;
    expect(distanceTiles).toBeGreaterThanOrEqual(7.99);
    expect(distanceTiles).toBeLessThan(40);
  });
  it('keeps source city and patrol faction consistent with real local ownership',()=>{
    for(let i=0;i<10;i++){
      const p=spawnPartyPatrol(world,{},null,cfg,{playerParty});
      const home=world.settlements.find(s=>s.id===p.homeCityId);
      expect(home).toBeDefined();
      expect(p.factionId).toBe(home.ownerFactionId);
      expect(within(p)).toBe(true);
      expect(world.settlements.some(s=>s.x===p.targetX&&s.y===p.targetY))
        .toBe(true);
      expect(p.routeId).toBeUndefined();
    }
  });
  it('connects local caravans with actual registered roads when a canonical road exists',()=>{
    const road=localRoadFromCity(world,a,playerParty,cfg);
    expect(road?.city.id).toBe('b');
    expect(road.path).toEqual(roadWorldWaypoints(world,world.roads[0]));
    const p=spawnPartyCaravan(world,{},'ottoman',cfg,{playerParty});
    expect(['a','b']).toContain(p.homeCityId);
    expect(p.factionId).toBe('ottoman');
    expect(within(p)).toBe(true);
    expect(world.settlements.some(s=>s.x===p.targetX&&s.y===p.targetY))
      .toBe(true);
    expect(p.routeId).toBeUndefined(); // route provenance is NOT invented
    if(p.path)expect(p.path.length).toBeGreaterThanOrEqual(2);
  });
  it('preserves live parties and original respawn cooldown across repeated frames',()=>{
    const ai=createInitialWorldAiState();
    fill(ai);
    const ids=ai.parties.map(p=>p.id);
    for(let i=0;i<50;i++)fill(ai);
    expect(ai.parties.map(p=>p.id)).toEqual(ids);
    const snapshot=JSON.parse(JSON.stringify(ai));
    expect(snapshot.lastRespawnDay).toBe(1);
    for(let i=0;i<25;i++)fill(snapshot,2);
    expect(snapshot.parties.map(p=>p.id)).toEqual(ids);
  });
  it('uses ordinary existing world-wide spawn when no city is genuinely local',()=>{
    const away={x:999999,y:999999,factionId:'ottoman'};
    expect(nearbyActualCities(world,away,cfg)).toEqual([]);
    expect(selectLocalCity(world,away,cfg)).toBeNull();
    const ai=createInitialWorldAiState();
    fill(ai,1,{playerParty:away});
    expect(ai.parties).toHaveLength(10);
    expect(ai.parties.every(p=>world.settlements.some(s=>s.id===p.homeCityId)))
      .toBe(true);
  });
  it('keeps physically valid road bandit encounter and patrol movement alive',()=>{
    const b=spawnPartyBandit(world,{},cfg,{tradeRoutes,playerParty});
    const start={x:b.x,y:b.y};
    const ai={parties:[b],lastRespawnDay:1};
    let encounters=[];
    for(let i=0;i<6;i++)encounters=updateWorldParties({
      aiState:ai,worldState:world,tradeRoutes,playerParty,
      cfg,factions:{},dtSec:0.1,
    });
    expect(Array.isArray(encounters)).toBe(true);
    expect(ai.parties).toHaveLength(1);
    expect(within(ai.parties[0])).toBe(true);
    expect(validBanditRoute(ai.parties[0],world,tradeRoutes)).not.toBeNull();
    expect(Math.hypot(ai.parties[0].x-start.x,ai.parties[0].y-start.y))
      .toBeGreaterThan(0);
  });
  it('honors active radius in tiles and rejects fake nearby city positions',()=>{
    expect(localWorldRadius(world,cfg)).toBe(36*32);
    const input={...world,settlements:[
      {id:'bad',x:NaN,y:100,ownerFactionId:'ottoman'},
      a,d,
    ]};
    expect(nearbyActualCities(input,playerParty,cfg).map(p=>p.id)).toEqual(['a']);
  });
});
