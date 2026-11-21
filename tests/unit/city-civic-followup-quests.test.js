import {describe,it,expect} from 'vitest';
import {
  generateContractsForCity,setContractsRuntimeContext,
  acceptContract,emitContractEvent,completeContract,
} from '../../js/systems/contracts.js';
const settlements=[
  {id:0,name:'Payitaht',tx:0,ty:0,security:40,ownerFactionId:'ottoman'},
  {id:1,name:'Bursa',tx:10,ty:0,security:30,ownerFactionId:'ottoman'},
  {id:2,name:'Edirne',tx:20,ty:0,security:35,ownerFactionId:'ottoman'},
];
const make=(decisionId,decisionDay=3,today=4)=>{
  const map={settlements:settlements.map(s=>({...s})),pois:[{id:'ruin',type:'ruin'}]};
  map.settlements[0].civicDecision={day:decisionDay,id:decisionId};
  const party={gold:0,renown:0,contracts:[]};
  setContractsRuntimeContext({party,map,worldSeed:1799});
  const offers=generateContractsForCity({cityId:0,day:today,seed:1799,map});
  return {map,party,offers,job:offers.find(o=>o.type==='CIVIC_FOLLOWUP')};
};
describe('V1.51 real council consequences',()=>{
  it('requires an actual previous-day decision, never offers stale or same-day mission',()=>{
    expect(make('patrol',3,4).job).toBeTruthy();
    expect(make('patrol',3,3).job).toBeUndefined();
    expect(make('patrol',3,6).job).toBeUndefined();
    expect(make('unknown',3,4).job).toBeUndefined();
    expect(make('patrol',3,4).offers).toHaveLength(7);
  });
  for(const policy of ['patrol','levy']){
    it(`${policy} sends player to actual destination then back with no shortcut`,()=>{
      const {party,job,map}=make(policy);
      const active=acceptContract(job.id,party);
      expect(map.settlements.some(s=>s.id===active.civicStops[0])).toBe(true);
      expect(active.civicStops[1]).toBe(0);
      emitContractEvent({type:'CITY_VISITED',cityId:0},party);
      expect(active.progress).toBe(0);
      emitContractEvent({type:'CITY_VISITED',cityId:active.civicStops[0]},party);
      expect(active.progress).toBe(1);
      emitContractEvent({type:'CITY_VISITED',cityId:active.civicStops[0]},party);
      expect(active.progress).toBe(1);
      const restored=JSON.parse(JSON.stringify(party));
      emitContractEvent({type:'CITY_VISITED',cityId:0},restored);
      expect(restored.contracts[0].completed).toBe(true);
      let paid=0;
      expect(completeContract(job.id,restored,{onCivicFollowup:()=>paid++}).type)
        .toBe('CIVIC_FOLLOWUP');
      expect(completeContract(job.id,restored)).toBeNull();
      expect(paid).toBe(1);
    });
  }
  it('granary continuation needs real target wheat sale and retains partial count',()=>{
    const {party,job}=make('granary');
    const active=acceptContract(job.id,party);
    emitContractEvent({type:'DELIVERED',cityId:1,itemId:'food',qty:100},party);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'iron',qty:100},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:2},party);
    const restored=JSON.parse(JSON.stringify(party));
    expect(restored.contracts[0].progress).toBe(2);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:4},restored);
    expect(restored.contracts[0]).toMatchObject({progress:6,completed:true});
  });
});
