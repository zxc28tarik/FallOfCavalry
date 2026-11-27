import {describe,it,expect} from 'vitest';
import {
  createInitialWorldAiState,ensureWorldParties,updateWorldParties,
} from '../../js/systems/world-ai.js';

const scene={
  width:18,height:12,tileSize:32,roads:[],
  settlements:[
    {id:'s-a',x:32,y:32,ownerFactionId:'ottoman'},
    {id:'s-b',x:224,y:128,ownerFactionId:'venice'},
  ],
};
const config={
  MAX_BANDIT_PARTIES:2,MAX_PATROL_PARTIES:1,MAX_CARAVAN_PARTIES:1,
  RESPAWN_INTERVAL_DAYS:3,
  DESPAWN_DISTANCE:40,
};
const fill=(state,day,opts={})=>ensureWorldParties({
  aiState:state,worldState:scene,factions:{ottoman:{},venice:{}},
  cfg:{...config,...opts.cfg},currentDay:day,
  banditCapOverride:opts.banditCapOverride,tradeRoutes:[],
});
const partyKinds=state=>Object.fromEntries(
  ['bandit','patrol','caravan'].map(kind=>[
    kind,state.parties.filter(x=>x.kind===kind&&x.alive!==false).length,
  ]));

describe('V1.42 — original world AI respawn cadence under empty active party list',()=>{
  it('initializes all original kinds immediately with first fresh-world call',()=>{
    const state=createInitialWorldAiState();
    fill(state,1);
    expect(partyKinds(state)).toEqual({bandit:2,patrol:1,caravan:1});
    expect(state.lastRespawnDay).toBe(1);
    const original=state.parties.map(x=>x.id);
    fill(state,1);
    expect(state.parties.map(x=>x.id)).toEqual(original);
  });
  it('does not recreate all culled parties every frame or before 3 game days',()=>{
    const state=createInitialWorldAiState();
    fill(state,1);
    state.parties=[]; // Mirrors real offscreen death/cull: source list is empty.
    for(let i=0;i<50;i++)fill(state,1);
    expect(state.parties).toHaveLength(0);
    fill(state,2);
    fill(state,3);
    expect(state.parties).toHaveLength(0);
    expect(state.lastRespawnDay).toBe(1);
    fill(state,4);
    expect(partyKinds(state)).toEqual({bandit:2,patrol:1,caravan:1});
    expect(state.lastRespawnDay).toBe(4);
  });
  it('preserves fresh-world initialization after JSON load and later due respawn',()=>{
    const fresh=JSON.parse(JSON.stringify(createInitialWorldAiState()));
    fill(fresh,8);
    expect(fresh.lastRespawnDay).toBe(8);
    expect(fresh.parties).toHaveLength(4);
    const restored=JSON.parse(JSON.stringify({...fresh,parties:[]}));
    fill(restored,9);
    expect(restored.parties).toHaveLength(0);
    fill(restored,11);
    expect(restored.parties).toHaveLength(4);
  });
  it('still accepts explicit 0-day respawn policy and dynamic bandit cap when due',()=>{
    const state=createInitialWorldAiState();
    fill(state,1);
    state.parties=[];
    fill(state,1,{cfg:{RESPAWN_INTERVAL_DAYS:0},banditCapOverride:3});
    expect(partyKinds(state)).toEqual({bandit:3,patrol:1,caravan:1});
  });
  it('does not change an existing live party roster during its normal cooldown',()=>{
    const state=createInitialWorldAiState();
    fill(state,1);
    const remaining=state.parties.slice(0,1);
    state.parties=remaining;
    fill(state,2);
    expect(state.parties).toEqual(remaining);
    fill(state,4);
    expect(partyKinds(state)).toEqual({bandit:2,patrol:1,caravan:1});
  });
  it('keeps actual encounter / movement code active after first population',()=>{
    const state=createInitialWorldAiState();
    fill(state,1);
    const before=state.parties.map(p=>({id:p.id,x:p.x,y:p.y}));
    const encounters=updateWorldParties({
      aiState:state,worldState:scene,playerParty:null,
      factions:{ottoman:{},venice:{}},cfg:config,dtSec:0.1,tradeRoutes:[],
    });
    expect(Array.isArray(encounters)).toBe(true);
    expect(state.parties.length).toBeGreaterThan(0);
    const changed=state.parties.some((p,i)=>
      p.x!==before[i]?.x||p.y!==before[i]?.y);
    expect(changed).toBe(true);
  });
});
