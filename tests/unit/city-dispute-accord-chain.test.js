import {describe,it,expect} from 'vitest';
import {generateContractsForCity,acceptContract,emitContractEvent,completeContract,
  setContractsRuntimeContext} from '../../js/systems/contracts.js';
import {resolveCityDispute} from '../../js/systems/city-character-disputes.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const skills=Object.fromEntries(['intelligence','observation','persuasion','leadership',
  'command','trade','administration','courage','experience'].map(k=>[k,50]));
function person(id,role){
  return {id,name:id,kind:'named',importance:'D',cultureId:'ottoman',originFactionId:'ottoman',
    role,age:31,status:'alive',location:{kind:'settlement',settlementId:'0'},
    traits:['cautious'],stats:{...skills},loyalty:50,satisfaction:50,reputation:50,standing:50,history:[]};
}
function create({claimed=true,worldCityCount=3}={}){
  const city={id:0,name:'Payitaht',tx:0,ty:0,security:21,marketStock:[{id:'wheat',qty:3}],
    priceMultiplier:{wheat:1},ownerFactionId:'ottoman'};
  const all=[city,{id:1,name:'Bursa',tx:10,ty:0,ownerFactionId:'ottoman'},
    {id:2,name:'Edirne',tx:19,ty:0,ownerFactionId:'ottoman'}];
  const map={settlements:all.slice(0,worldCityCount),pois:[{id:'ruin',type:'ruin'}]};
  const roster={version:1,characters:[person('npc:accord:1','merchant'),person('npc:accord:2','artisan')],relations:[]};
  const party={gold:500,renown:0,contracts:[],
    completedDisputeRemedies:claimed?['ct-dispute-0-5-security']:[],
    completedDisputeAccords:[]};
  expect(resolveCityDispute({roster,cityId:0,day:4,party,choice:'mediate'}).ok).toBe(true);
  const savedRoster=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
  setContractsRuntimeContext({party,map,worldSeed:6060});
  const generate=day=>generateContractsForCity({
    cityId:0,day,seed:6060,map,worldState:{worldCharacters:savedRoster,playerParty:party},
  });
  return {map,roster:savedRoster,party,generate};
}
describe('V1.58 three-stage important-person settlement accords',()=>{
  it('unlocks only after a redeemed remedy with real recorded actors',()=>{
    const {generate}=create();
    const chain=generate(6).find(x=>x.type==='DISPUTE_ACCORD');
    expect(chain).toMatchObject({cityId:0,accordCause:'security',
      accordCharacters:['npc:accord:1','npc:accord:2'],requiredCount:3});
    expect(generate(4).some(x=>x.type==='DISPUTE_ACCORD')).toBe(false);
    expect(create({claimed:false}).generate(6)
      .some(x=>x.type==='DISPUTE_ACCORD')).toBe(false);
    expect(create({worldCityCount:1}).generate(6)
      .some(x=>x.type==='DISPUTE_ACCORD')).toBe(false);
  });
  it('requires other city meeting, then real wheat sales there, then homecoming',()=>{
    const {generate,party}=create();
    const offer=generate(6).find(x=>x.type==='DISPUTE_ACCORD');
    const active=acceptContract(offer.id,party);
    expect(active).toBeTruthy();
    emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'food',qty:10},party);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:offer.targetCityId},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:10},party);
    emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'iron',qty:10},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'food',qty:2},party);
    expect(active.accordDelivered).toBe(2);
    const resumed=JSON.parse(JSON.stringify(party));
    emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'food',qty:2},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:2,accordStage:2});
    emitContractEvent({type:'CITY_VISITED',cityId:offer.targetCityId},resumed);
    expect(resumed.contracts[0].progress).toBe(2);
    emitContractEvent({type:'CITY_VISITED',cityId:0},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:3,completed:true});
    let completionEvents=0;
    expect(completeContract(offer.id,resumed,{onDisputeAccord:()=>completionEvents++})?.type)
      .toBe('DISPUTE_ACCORD');
    expect(completionEvents).toBe(1);
    expect(resumed.completedDisputeAccords).toContain(offer.id);
    expect(completeContract(offer.id,resumed)).toBeNull();
    expect(acceptContract(offer.id,resumed)).toBeNull();
    const reloaded=JSON.parse(JSON.stringify(resumed));
    expect(acceptContract(offer.id,reloaded)).toBeNull();
  });
  it('cannot forge a chain from unclaimed previous-day civil claims',()=>{
    const {generate,party}=create({claimed:false});
    party.completedDisputeRemedies.push('ct-dispute-1-5-security');
    expect(generate(6).some(x=>x.type==='DISPUTE_ACCORD')).toBe(false);
  });
});
