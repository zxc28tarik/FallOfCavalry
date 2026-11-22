import {describe,it,expect} from 'vitest';
import {resolveCityDispute} from '../../js/systems/city-character-disputes.js';
import {
  generateContractsForCity,acceptContract,emitContractEvent,
  completeContract,setContractsRuntimeContext,
} from '../../js/systems/contracts.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const skills=Object.fromEntries(['intelligence','observation','persuasion','leadership',
  'command','trade','administration','courage','experience'].map(x=>[x,50]));
const actor=(id,role)=>({id,name:id,kind:'named',importance:'D',
  cultureId:'ottoman',originFactionId:'ottoman',role,age:31,
  status:'alive',traits:['cautious'],stats:{...skills},
  loyalty:50,satisfaction:50,reputation:50,standing:50,
  location:{kind:'settlement',settlementId:'0'},history:[]});
const create=(cause)=>{
  const city={id:0,name:'Payitaht',tx:0,ty:0,security:60,
    ownerFactionId:'ottoman',marketStock:[{id:'wheat',qty:30}],
    priceMultiplier:{wheat:1}};
  if(cause==='security')city.security=25;
  if(cause==='scarcity')city.marketStock[0].qty=3;
  if(cause==='trade')city.priceMultiplier.wheat=1.2;
  const map={settlements:[city,
    {id:1,name:'Bursa',tx:10,ty:0,security:60,ownerFactionId:'ottoman'},
    {id:2,name:'Edirne',tx:20,ty:0,security:60,ownerFactionId:'ottoman'}],
    pois:[{id:'ruin',type:'ruin'}]};
  const roster={version:1,characters:[
    actor('npc:remedy:1','merchant'),actor('npc:remedy:2','artisan')],relations:[]};
  const party={gold:500,renown:0,contracts:[]};
  const resolution=resolveCityDispute({roster,cityId:0,day:4,
    city,party,choice:'mediate'});
  expect(resolution.ok).toBe(true);
  expect(resolution.cause).toBe(cause);
  const savedRoster=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
  setContractsRuntimeContext({party,map,worldSeed:1985});
  const generate=day=>generateContractsForCity({cityId:0,day,seed:1985,map,
    worldState:{worldCharacters:savedRoster}});
  return {city,map,roster:savedRoster,party,generate};
};
describe('V1.57 aftermath from real city disputes',()=>{
  for(const cause of ['security','trade','civic']){
    it(`${cause} causes next-day ordered city route and return`,()=>{
      const {party,generate,map}=create(cause);
      const offers=generate(5);
      const offer=offers.find(c=>c.type==='DISPUTE_REMEDY');
      expect(offer).toMatchObject({disputeCause:cause,cityId:0,requiredCount:2});
      expect(map.settlements.some(c=>c.id===offer.targetCityId)).toBe(true);
      expect(offer.targetCityId).not.toBe(0);
      expect(generate(4).some(c=>c.type==='DISPUTE_REMEDY')).toBe(false);
      expect(generate(6).some(c=>c.type==='DISPUTE_REMEDY')).toBe(false);
      // Restore day-five offer registry before accepting it.
      generate(5);
      const accepted=acceptContract(offer.id,party);
      emitContractEvent({type:'CITY_VISITED',cityId:0},party);
      expect(accepted.progress).toBe(0);
      emitContractEvent({type:'CITY_VISITED',cityId:offer.targetCityId},party);
      expect(accepted.progress).toBe(1);
      const restored=JSON.parse(JSON.stringify(party));
      emitContractEvent({type:'CITY_VISITED',cityId:0},restored);
      expect(restored.contracts[0]).toMatchObject({progress:2,completed:true});
      let callbackCount=0;
      const completed=completeContract(offer.id,restored,{
        onDisputeRemedy:()=>callbackCount++,
      });
      expect(completed.type).toBe('DISPUTE_REMEDY');
      expect(callbackCount).toBe(1);
      expect(completeContract(offer.id,restored)).toBeNull();
    });
  }
  it('scarcity needs real wheat sale in the issuing settlement, not a menu click',()=>{
    const {party,generate}=create('scarcity');
    const offer=generate(5).find(c=>c.type==='DISPUTE_REMEDY');
    expect(offer).toMatchObject({disputeCause:'scarcity',requiredAmount:8,targetCityId:0});
    const accepted=acceptContract(offer.id,party);
    emitContractEvent({type:'DELIVERED',cityId:1,itemId:'food',qty:15},party);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'iron',qty:15},party);
    expect(accepted.progress).toBe(0);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:3},party);
    const resumed=JSON.parse(JSON.stringify(party));
    expect(resumed.contracts[0].progress).toBe(3);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:5},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:8,completed:true});
  });
  it('requires a verified saved dispute, not a guessed city condition',()=>{
    const {map,party,generate}=create('security');
    map.settlements[0].security=1;
    expect(generate(8).some(c=>c.type==='DISPUTE_REMEDY')).toBe(false);
    party.contracts=[];
  });
  it('does not invent a travel destination for a one-city world',()=>{
    const {map,generate}=create('trade');
    map.settlements.splice(1);
    expect(generate(5).some(c=>c.type==='DISPUTE_REMEDY')).toBe(false);
  });
});
