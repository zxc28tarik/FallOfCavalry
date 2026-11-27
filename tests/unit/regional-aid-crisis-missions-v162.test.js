import {describe,it,expect} from 'vitest';
import {
  generateContractsForCity,acceptContract,emitContractEvent,completeContract,setContractsRuntimeContext,
} from '../../js/systems/contracts.js';

function create({kind='food',oneCity=false}={}){
  const origin={id:0,name:'Payitaht',tx:0,ty:0,security:65,ownerFactionId:'ottoman',
    marketStock:[{id:'wheat',qty:30}]};
  const target={id:1,name:'Bursa',tx:8,ty:5,security:kind==='security'?20:55,
    ownerFactionId:'ottoman',marketStock:[{id:'wheat',qty:kind==='food'?3:30}]};
  const distant={id:2,name:'Edirne',tx:90,ty:20,security:55,
    ownerFactionId:'ottoman',marketStock:[{id:'wheat',qty:30}]};
  const map={settlements:oneCity?[origin]:[origin,target,distant],pois:[{id:'ruin',type:'ruin'}]};
  const party={gold:100,renown:0,contracts:[],completedRegionalAid:[]};
  setContractsRuntimeContext({map,party,worldSeed:42});
  const offers=generateContractsForCity({cityId:0,day:9,seed:42,map,worldState:{playerParty:party}});
  return {origin,target,map,party,offer:offers.find(row=>row.type==='REGIONAL_AID')};
}
describe('V1.62 real-world cross-city assistance',()=>{
  it('finds genuine closest neighboring scarcity without inventing cities',()=>{
    const {offer,target}=create();
    expect(offer).toMatchObject({type:'REGIONAL_AID',targetCityId:target.id,
      regionalAidKind:'food',requiredAmount:6,cityId:0});
    expect(create({oneCity:true}).offer).toBeUndefined();
  });
  it('requires accepted contract and actual target wheat sales, supports save resume',()=>{
    const {party,offer}=create();
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:1,qty:8},party);
    const active=acceptContract(offer.id,party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:0,qty:9},party);
    emitContractEvent({type:'DELIVERED',itemId:'iron',cityId:1,qty:9},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:1,qty:2},party);
    expect(active.progress).toBe(2);
    const resumed=JSON.parse(JSON.stringify(party));
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:1,qty:4},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:6,completed:true});
    let applied=0;
    expect(completeContract(offer.id,resumed,{onRegionalAid:()=>applied++})?.type).toBe('REGIONAL_AID');
    expect(applied).toBe(1);
    expect(resumed.completedRegionalAid).toContain(offer.id);
    expect(completeContract(offer.id,resumed)).toBeNull();
    expect(acceptContract(offer.id,JSON.parse(JSON.stringify(resumed)))).toBeNull();
  });
  it('requires security inspector to visit target before returning to origin',()=>{
    const {party,offer}=create({kind:'security'});
    expect(offer).toMatchObject({regionalAidKind:'security',requiredCount:2});
    const active=acceptContract(offer.id,party);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:1},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'CITY_VISITED',cityId:2},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(active).toMatchObject({progress:2,completed:true});
  });
  it('does not fabricate market stock or danger and prioritizes nearest eligible city',()=>{
    const {map,party}=create();
    map.settlements[1].marketStock=[];
    map.settlements[1].security=70;
    map.settlements[2].security=15;
    const offers=generateContractsForCity({cityId:0,day:10,map,seed:42,worldState:{playerParty:party}});
    expect(offers.find(c=>c.type==='REGIONAL_AID')).toMatchObject({
      targetCityId:2,regionalAidKind:'security',
    });
    map.settlements[2].security=70;
    expect(generateContractsForCity({cityId:0,day:11,map,seed:42,worldState:{playerParty:party}})
      .some(c=>c.type==='REGIONAL_AID')).toBe(false);
  });
});
