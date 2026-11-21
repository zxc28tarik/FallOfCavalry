import {describe,it,expect} from 'vitest';
import {
  generateContractsForCity,acceptContract,emitContractEvent,
  completeContract,setContractsRuntimeContext,
} from '../../js/systems/contracts.js';

const world={
  settlements:[
    {id:0,name:'Payitaht',tx:10,ty:10,security:65,ownerFactionId:'ottoman'},
    {id:1,name:'Bursa',tx:24,ty:10,security:22,ownerFactionId:'ottoman'},
    {id:2,name:'Edirne',tx:45,ty:11,security:35,ownerFactionId:'ottoman'},
    {id:3,name:'Sofya',tx:54,ty:12,security:50,ownerFactionId:'ottoman'},
  ],
  pois:[{id:'ruin-1',type:'ruin'}],
};
const setup=(day=2)=>{
  const party={gold:100,renown:0,contracts:[]};
  setContractsRuntimeContext({party,map:world,worldSeed:1729});
  const offers=generateContractsForCity({
    cityId:0,day,seed:1729,map:world,worldState:{},factions:{},warState:{},
  });
  return {party,offers};
};

describe('V1.48 — playable civil city job board',()=>{
  it('offers five source-registered, distinct jobs instead of only three',()=>{
    const {offers}=setup();
    expect(offers).toHaveLength(5);
    expect(new Set(offers.map(o=>o.type)).size).toBe(5);
    expect(offers.map(o=>o.type)).toContain('COURIER');
    expect(offers.map(o=>o.type)).toContain('RELIEF');
    for(const job of offers.filter(o=>o.targetCityId!=null)){
      expect(world.settlements.some(city=>String(city.id)===String(job.targetCityId))).toBe(true);
    }
  });

  it('does not credit courier until visiting the actual destination, even if city ID is 0',()=>{
    const {party,offers}=setup(4);
    const offer=offers.find(o=>o.type==='COURIER');
    expect(offer.cityId).toBe(0);
    const job=acceptContract(offer.id,party);
    expect(job.completed).toBe(false);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(job.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:999999},party);
    expect(job.completed).toBe(false);
    emitContractEvent({type:'CITY_VISITED',cityId:offer.targetCityId},party);
    expect(job).toMatchObject({progress:1,completed:true});
    const before=party.gold;
    expect(completeContract(job.id,party)).toMatchObject({type:'COURIER'});
    expect(party.gold).toBeGreaterThan(before);
    expect(completeContract(job.id,party)).toBeNull();
  });

  it('relief requires verified wheat delivery in real target city, preserves progress on save',()=>{
    const {party,offers}=setup(5);
    const offer=offers.find(o=>o.type==='RELIEF');
    const job=acceptContract(offer.id,party);
    const half=Math.max(1,Math.floor(job.requiredAmount/2));
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:0,qty:100},party);
    emitContractEvent({type:'DELIVERED',itemId:'iron',cityId:job.targetCityId,qty:100},party);
    expect(job.progress).toBe(0);
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:job.targetCityId,qty:half},party);
    expect(job.progress).toBe(half);
    const restored=JSON.parse(JSON.stringify(party));
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:job.targetCityId,qty:job.requiredAmount},restored);
    expect(restored.contracts[0].completed).toBe(true);
    const city=world.settlements.find(s=>s.id===job.targetCityId);
    let calls=0;
    const oldSecurity=city.security;
    const result=completeContract(job.id,restored,{
      onCivicRelief:(contract)=>{
        calls++;
        city.security=Math.min(100,city.security+contract.civicSecurityBonus);
      },
    });
    expect(result.type).toBe('RELIEF');
    expect(city.security).toBe(oldSecurity+3);
    expect(calls).toBe(1);
    expect(completeContract(job.id,restored)).toBeNull();
    expect(calls).toBe(1);
  });

  it('leaves wartime contracts available alongside civilian work',()=>{
    const {party}=setup(7);
    const offers=generateContractsForCity({
      cityId:0,day:7,seed:1729,map:world,
      warState:{wars:[{a:'ottoman',b:'venice',active:true}]},
    });
    expect(offers.some(o=>o.type==='DEFEND'||o.type==='ASSASSINATE')).toBe(true);
    expect(offers.some(o=>o.type==='COURIER')).toBe(true);
    expect(offers.some(o=>o.type==='RELIEF')).toBe(true);
    expect(party.contracts).toEqual([]);
  });
});
