import {describe,it,expect} from 'vitest';
import {streamWorldAiRegion} from '../../js/systems/world-ai-regional-stream.js';
import {auditWorldAiRegionalStorage} from '../../js/systems/world-ai-regional-audit.js';

const city=(id,tx)=>({id,x:(tx+0.5)*32,y:10.5*32,ownerFactionId:'ottoman'});
const cities=[10,70,130,190,250].map((tx,i)=>city(i,tx));
const world={tileSize:32,settlements:cities};
const cfg={DESPAWN_DISTANCE:40,RESPAWN_INTERVAL_DAYS:3,MAX_CARAVAN_PARTIES:3};
const part=(city,index)=>({
  id:`source-${city.id}-${index}`,kind:'caravan',alive:true,
  x:city.x,y:city.y,homeCityId:city.id,
  cargo:[{goodId:'grain',quantity:index+1}],
  completedRoadLegs:index,
});
const stream=(state,loc)=>streamWorldAiRegion({
  aiState:state,worldState:world,
  playerParty:{x:loc.x,y:loc.y},cfg,currentDay:1,
});

describe('V1.47 — sustained region identity and storage diagnostics',()=>{
  it('revisits five real city regions across 480 tiles without ID or cargo loss',()=>{
    const ai={parties:[],dormantParties:[],regionHistory:[]};
    const original=new Map();
    stream(ai,cities[0]);
    for(const [index,loc] of cities.entries()){
      if(index)stream(ai,loc);
      const fresh=[part(loc,0),part(loc,1)];
      fresh.forEach(p=>original.set(p.id,p));
      ai.parties.push(...fresh);
      const audit=auditWorldAiRegionalStorage(ai);
      expect(audit.status).toBe('MEASURED');
      expect(audit.uniquePartyIds).toBe(original.size);
      expect(audit.regionStampCount).toBeLessThanOrEqual(128);
    }
    for(const loc of [...cities].reverse()){
      const transition=stream(ai,loc);
      expect(transition.restored).toBe(loc.id===4?0:2);
      expect(ai.parties.map(p=>p.id).sort())
        .toEqual([0,1].map(i=>`source-${loc.id}-${i}`));
      for(const p of ai.parties){
        expect(p).toBe(original.get(p.id));
        expect(p.cargo).toEqual(original.get(p.id).cargo);
      }
      expect(auditWorldAiRegionalStorage(ai).status).toBe('MEASURED');
    }
    const a=auditWorldAiRegionalStorage(ai);
    expect(a.uniquePartyIds).toBe(10);
    expect(a.activeCount).toBe(2);
    expect(a.dormantCount).toBe(8);
    expect(a.snapshotBytes).toBeGreaterThan(0);
  });

  it('reports exactly the corrupt identities instead of silently deleting anything',()=>{
    const ai={parties:[{id:'same'},{id:'same'},{id:null}],
      dormantParties:[{id:'same'},{id:'else'}],regionHistory:[]};
    const before=JSON.stringify(ai);
    const report=auditWorldAiRegionalStorage(ai);
    expect(report).toMatchObject({
      status:'INVALID',duplicateActive:1,duplicateDormant:0,
      overlapCount:1,invalidIdCount:1,uniquePartyIds:2,
    });
    expect(JSON.stringify(ai)).toBe(before);
  });

  it('measures UTF-8 JSON bytes deterministically without claiming live heap use',()=>{
    const ai={parties:[],dormantParties:[{
      id:'ç-1',kind:'caravan',cargo:[{goodId:'silk',quantity:3}],
    }],regionHistory:[{x:1,y:2,lastDay:1}]};
    const a=auditWorldAiRegionalStorage(ai);
    expect(a.status).toBe('MEASURED');
    expect(a.snapshotBytes).toBe(new TextEncoder().encode(
      JSON.stringify({parties:ai.parties,dormantParties:ai.dormantParties,
        regionHistory:ai.regionHistory}),
    ).length);
    expect(a.note).toContain('not compressed disk-save size');
  });
});
