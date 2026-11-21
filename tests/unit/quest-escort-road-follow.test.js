import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import { chooseEscortRoadFollowTarget } from '../../js/systems/quest-escort-road-follow.js';

const tile = (x,y) => ({ x, y });
const world = {
  width: 40, height: 40, tileSize: 32,
  settlements: [
    {id:1, type:'city', x:144, y:208, tx:4, ty:6},
    {id:2, type:'city', x:528, y:400, tx:16, ty:12},
  ],
  roads:[{from:1,to:2,path:[
    tile(4,6),tile(7,6),tile(10,6),
    tile(10,9),tile(10,12),tile(13,12),tile(16,12),
  ]}],
};
const routes=[{id:'route:1:2',fromCityId:1,toCityId:2,roadBacked:true}];
const quest=()=>{
  const def=QUEST_DEFS.find(x=>x.id==='escort_first_caravan');
  const copy=JSON.parse(JSON.stringify(def)
    .replaceAll('{{targetRouteId}}',routes[0].id)
    .replaceAll('{{issuerFactionId}}','ottoman'));
  return {...copy,id:'quest-curve-v125',templateId:def.id,
    status:'active',createdAt:1,targetRouteId:routes[0].id};
};
const escort=()=>{
  const p=spawnQuestEscortCaravan(quest(),world,routes,2,1.2);
  if(!p)throw Error('failed to spawn source road');
  p.x=528;p.y=400;p.pathIndex=p.path.length-1;
  return p;
};
const safe=()=>({blocked:false, speedMult:1});
const follow=(playerParty,caravan,terrainAt=safe)=>chooseEscortRoadFollowTarget({
  playerParty,caravan,worldState:world,terrainAt,
});
describe('WEB V1.25 — live escort road waypoint follower',()=>{
  it('uses real turn of a seven-point physical polyline, not a direct diagonal to the convoy',()=>{
    const p=escort();
    const choice=follow({x:336,y:208},p);
    expect(choice.status).toBe('moving');
    expect(choice.stage).toBe('road');
    expect(choice.target.x).toBeCloseTo(336,4);
    expect(choice.target.y).toBeGreaterThan(208);
    expect(choice.target.y).toBeLessThan(280);
    expect(Math.hypot(choice.target.x-336,choice.target.y-208)).toBeLessThanOrEqual(41);
    expect(Math.hypot(choice.target.x-p.x,choice.target.y-p.y)).toBeGreaterThan(100);
  });
  it('advances by bounded real road waypoints for the full long-turn journey',()=>{
    const p=escort();
    const player={x:144,y:208};
    const goals=[];
    for(let i=0;i<80;i++) {
      const r=follow(player,p);
      if(r.status==='near')break;
      expect(r.status).toBe('moving');
      const step=Math.hypot(player.x-r.target.x,player.y-r.target.y);
      expect(step).toBeLessThan(65);
      expect(step).toBeGreaterThanOrEqual(2);
      goals.push({...r.target});
      player.x=r.target.x;player.y=r.target.y;
    }
    expect(goals.length).toBeGreaterThan(9);
    expect(player.x).toBeGreaterThan(480);
    expect(player.y).toBeGreaterThan(350);
    expect(goals.some(pos=>Math.abs(pos.x-336)<0.01 && pos.y>225)).toBe(true);
  });
  it('first joins road rather than cutting across a distant bend',()=>{
    const p=escort();
    const choice=follow({x:180,y:128},p);
    expect(choice).toMatchObject({status:'moving',stage:'joining_road'});
    expect(choice.target.y).toBeCloseTo(208);
    expect(choice.target.x).toBeCloseTo(180);
  });
  it('won’t issue a target across an impassable strip when the road is physically blocked',()=>{
    const p=escort();
    const player={x:300,y:208};
    const terrainAt=(x,y)=>({blocked:x>=307 && x<=350 && y>=195 && y<=260});
    let choice;
    for (let i=0;i<15;i++) {
      choice=follow(player,p,terrainAt);
      if (choice.status === 'blocked') break;
      expect(choice.status).toBe('moving');
      expect(choice.target.x).toBeLessThan(307);
      player.x=choice.target.x;
      player.y=choice.target.y;
    }
    expect(choice.status).toBe('blocked');
    expect(choice.target).toBeUndefined();
  });
  it('never accepts a JSON-cloned caravan or malformed source path',()=>{
    const p=escort();
    expect(follow({x:144,y:208},{...p}).status).toBe('invalid');
    const malformed=p.path;
    p.path=[{x:NaN,y:4},{x:300,y:300}];
    expect(follow({x:144,y:208},p).status).toBe('no_road');
    p.path=malformed;
    expect(follow({x:p.x,y:p.y},p).status).toBe('near');
  });
  it('obeys route direction if player has overtaken the convoy',()=>{
    const p=escort();
    p.x=336;p.y=320;
    const choice=follow({x:528,y:400},p);
    expect(choice.status).toBe('moving');
    expect(choice.target.x).toBeLessThan(528);
    expect(choice.target.y).toBeCloseTo(400);
  });
});
