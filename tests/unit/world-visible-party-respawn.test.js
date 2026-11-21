import {describe,it,expect} from 'vitest';
import WorldPartyManager from '../../js/managers/WorldPartyManager.js';
import {createInitialWorldAiState} from '../../js/systems/world-ai.js';

const EXTRA_COUNTS={
  refugee:2,merchant:2,messenger:2,villagers:2,noble:1,
};
const EXTRA_KINDS=Object.keys(EXTRA_COUNTS);
function makeWorld({ai=createInitialWorldAiState(),day=1,interval=3,maxOverride={}}={}) {
  const world={
    worldAi:ai,enemyParties:[],
    state:{
      day,paused:false,mode:'map',commanders:[],
      factions:{ottoman:{},venice:{}},
      map:{
        width:30,height:30,tileSize:32,roads:[],
        settlements:[
          {id:'capital',x:120,y:160,ownerFactionId:'ottoman'},
          {id:'port',x:480,y:360,ownerFactionId:'venice'},
        ],
      },
    },
  };
  const game={
    playerParty:{x:100000,y:100000,factionId:'ottoman'},
    economyManager:{ensureTradeRoutes:()=>[]},
    questManager:{activeQuests:[]},
    getWorldAiCfgWithRegionMods:()=>({
      MAX_BANDIT_PARTIES:0,MAX_PATROL_PARTIES:0,MAX_CARAVAN_PARTIES:0,
      RESPAWN_INTERVAL_DAYS:interval,DESPAWN_DISTANCE:40,...maxOverride,
    }),
    getBanditCapWithEvents:()=>0,getCurrentEvents:()=>[],
  };
  const manager=new WorldPartyManager();
  manager.init(world,game);
  return {manager,world,game};
}
const tally=ai=>Object.fromEntries(EXTRA_KINDS.map(k=>[
  k,ai.parties.filter(p=>p.alive!==false&&p.kind===k).length,
]));
const extraCount=ai=>ai.parties.filter(p=>EXTRA_KINDS.includes(p.kind)).length;
describe('V1.43 visible-party respawn contract',()=>{
  it('does not spawn world parties or begin cooldown before the start menu finishes',()=>{
    const {manager,world}=makeWorld();
    world.state.mode='start';
    manager.ensureWorldParties();
    expect(world.worldAi.parties).toHaveLength(0);
    expect(world.worldAi.lastRespawnDay).toBe(0);
    expect(world.worldAi.lastVisibleRespawnDay).toBeNull();
    world.state.mode='map';
    manager.ensureWorldParties();
    expect(tally(world.worldAi)).toEqual(EXTRA_COUNTS);
    expect(world.worldAi.lastVisibleRespawnDay).toBe(1);
  });
  it('creates all nine original visible parties immediately in a fresh world',()=>{
    const {manager,world}=makeWorld();
    manager.ensureWorldParties();
    expect(tally(world.worldAi)).toEqual(EXTRA_COUNTS);
    expect(world.worldAi.lastVisibleRespawnDay).toBe(1);
    expect(world.enemyParties).toHaveLength(9);
    expect(world.state.worldAi).toBe(world.worldAi);
  });
  it('never creates a new party during 50 repeated same-day ensures',()=>{
    const {manager,world}=makeWorld();
    manager.ensureWorldParties();
    const ids=world.worldAi.parties.map(p=>p.id);
    for(let n=0;n<50;n++)manager.ensureWorldParties();
    expect(world.worldAi.parties.map(p=>p.id)).toEqual(ids);
  });
  it('preserves normal off-screen despawn but blocks immediate refill',()=>{
    const {manager,world}=makeWorld();
    manager.ensureWorldParties();
    const encounters=manager.updateWorldParties(0.1);
    expect(encounters).toEqual([]);
    expect(extraCount(world.worldAi)).toBe(0);
    for(let n=0;n<50;n++)manager.ensureWorldParties();
    expect(extraCount(world.worldAi)).toBe(0);
    expect(world.worldAi.lastVisibleRespawnDay).toBe(1);
  });
  it('repopulates all five extra kinds on day four, not days two or three',()=>{
    const {manager,world}=makeWorld();
    manager.ensureWorldParties();
    world.worldAi.parties=[];
    for(const day of [1,2,3]){
      world.state.day=day;
      manager.ensureWorldParties();
      expect(extraCount(world.worldAi)).toBe(0);
    }
    world.state.day=4;
    manager.ensureWorldParties();
    expect(tally(world.worldAi)).toEqual(EXTRA_COUNTS);
    expect(world.worldAi.lastVisibleRespawnDay).toBe(4);
  });
  it('preserves existing live extra party IDs when refilling only missing kinds',()=>{
    const {manager,world}=makeWorld();
    manager.ensureWorldParties();
    const survivor=world.worldAi.parties.find(p=>p.kind==='noble');
    world.worldAi.parties=[survivor];
    world.state.day=4;
    manager.ensureWorldParties();
    expect(world.worldAi.parties.find(p=>p.kind==='noble')).toBe(survivor);
    expect(world.worldAi.parties.filter(p=>p.id===survivor.id)).toHaveLength(1);
    expect(tally(world.worldAi)).toEqual(EXTRA_COUNTS);
  });
  it('supports legacy save without timestamp, but not repeated refills after it',()=>{
    const oldAi={parties:[],lastRespawnDay:1};
    const {manager,world}=makeWorld({ai:oldAi,day:6});
    manager.ensureWorldParties();
    expect(extraCount(world.worldAi)).toBe(9);
    expect(world.worldAi.lastVisibleRespawnDay).toBe(6);
    world.worldAi.parties=[];
    manager.ensureWorldParties();
    expect(extraCount(world.worldAi)).toBe(0);
  });
  it('honors persisted stamp after serialization and reload',()=>{
    const {manager,world}=makeWorld({day:8});
    manager.ensureWorldParties();
    const serialized=JSON.parse(JSON.stringify(world.worldAi));
    expect(serialized.lastVisibleRespawnDay).toBe(8);
    const restored=makeWorld({ai:{...serialized,parties:[]},day:9});
    restored.manager.ensureWorldParties();
    expect(extraCount(restored.world.worldAi)).toBe(0);
    restored.world.state.day=11;
    restored.manager.ensureWorldParties();
    expect(extraCount(restored.world.worldAi)).toBe(9);
  });
  it('preserves explicit zero-day policy and dynamic per-kind max caps',()=>{
    const {manager,world}=makeWorld({
      interval:0,maxOverride:{MAX_REFUGEE_PARTIES:1,MAX_NOBLE_PARTIES:0},
    });
    manager.ensureWorldParties();
    expect(tally(world.worldAi)).toEqual({
      refugee:1,merchant:2,messenger:2,villagers:2,noble:0,
    });
    world.worldAi.parties=[];
    manager.ensureWorldParties();
    expect(extraCount(world.worldAi)).toBe(7);
  });
  it('does not create extras if all configured visible-party caps are zero',()=>{
    const override=Object.fromEntries([
      'REFUGEE','TRAVELING_MERCHANT','MESSENGER','VILLAGER','NOBLE',
    ].map(kind=>['MAX_'+kind+'_PARTIES',0]));
    const {manager,world}=makeWorld({maxOverride:override});
    manager.ensureWorldParties();
    expect(extraCount(world.worldAi)).toBe(0);
    expect(world.worldAi.lastVisibleRespawnDay).toBeNull();
  });
});
