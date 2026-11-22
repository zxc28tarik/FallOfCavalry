import {describe,it,expect} from 'vitest';
import {recordRegionalAidOutcome,getRegionalAidLegacy}
  from '../../js/systems/regional-aid-legacy.js';
import {getEffectiveCivicDecision,applyCivicDecision}
  from '../../js/systems/city-civic-decisions.js';
import {generateContractsForCity,acceptContract,emitContractEvent,
  completeContract,setContractsRuntimeContext} from '../../js/systems/contracts.js';

const build=(kind='food')=>{
  const id=`ct-regional-0-1-5-${kind}`;
  const party={gold:600,renown:0,contracts:[],
    completedRegionalAid:[id],completedRegionalRecovery:[],regionalAidOutcomes:[]};
  const source={id:0,name:'Payitaht',tx:0,ty:0,security:60};
  const target={id:1,name:'Bursa',tx:12,ty:7,security:55};
  const map={settlements:[source,target],pois:[{id:'ruin',type:'ruin'}]};
  const contract={id,type:'REGIONAL_AID',cityId:0,targetCityId:1,regionalAidKind:kind};
  setContractsRuntimeContext({party,map,worldSeed:123});
  return {party,map,target,source,contract};
};
describe('V1.63 regional aid consequences, follow-up and city benefits',()=>{
  it('writes only claim-proven aid and validates seven-day beneficiary window',()=>{
    const {party,contract}=build();
    expect(recordRegionalAidOutcome({party,contract,day:7})).toBe(true);
    expect(recordRegionalAidOutcome({party,contract,day:7})).toBe(false);
    expect(getRegionalAidLegacy({party,cityId:1,day:8})).toMatchObject({
      kind:'food',remainingDays:6,discount:10,sourceCityId:'0',targetCityId:'1',
    });
    expect(getRegionalAidLegacy({party,cityId:0,day:8})).toBeNull();
    expect(getRegionalAidLegacy({party,cityId:1,day:6})).toBeNull();
    expect(getRegionalAidLegacy({party,cityId:1,day:14})).not.toBeNull();
    expect(getRegionalAidLegacy({party,cityId:1,day:15})).toBeNull();
    const restored=JSON.parse(JSON.stringify(party));
    expect(getRegionalAidLegacy({party:restored,cityId:1,day:10})?.kind).toBe('food');
    restored.completedRegionalAid=[];
    expect(getRegionalAidLegacy({party:restored,cityId:1,day:10})).toBeNull();
  });
  it('beneficiary policy discounts stack with normal civic rules and not origin',()=>{
    const {party,target,source,contract}=build();
    recordRegionalAidOutcome({party,contract,day:7});
    expect(getEffectiveCivicDecision({city:target,party,day:8,decisionId:'granary'}))
      .toMatchObject({cost:80,regionalDiscount:10});
    expect(getEffectiveCivicDecision({city:target,party,day:8,decisionId:'patrol'}).cost)
      .toBe(120);
    expect(getEffectiveCivicDecision({city:source,party,day:8,decisionId:'granary'}).cost)
      .toBe(90);
    const result=applyCivicDecision({city:target,party,day:8,decisionId:'granary'});
    expect(result).toMatchObject({ok:true,gold:520,regionalLegacyApplied:true,discount:10});
    expect(applyCivicDecision({city:target,party,day:8,decisionId:'levy'}).ok).toBe(false);
  });
  it('security help discounts patrol only and does not change tax',()=>{
    const {party,target,contract}=build('security');
    recordRegionalAidOutcome({party,contract,day:5});
    expect(getEffectiveCivicDecision({city:target,party,day:6,decisionId:'patrol'}).cost)
      .toBe(110);
    expect(getEffectiveCivicDecision({city:target,party,day:6,decisionId:'granary'}).cost)
      .toBe(90);
    expect(getEffectiveCivicDecision({city:target,party,day:6,decisionId:'levy'}).cost)
      .toBe(-75);
  });
  it('food follow-up is unlocked next day by actual redeemed aid and requires ordered travel then wheat',()=>{
    const {party,map,contract}=build('food');
    recordRegionalAidOutcome({party,contract,day:7});
    const offers=day=>generateContractsForCity({cityId:1,day,seed:123,map,
      worldState:{playerParty:party}});
    expect(offers(7).some(c=>c.type==='REGIONAL_RECOVERY')).toBe(false);
    const offer=offers(8).find(c=>c.type==='REGIONAL_RECOVERY');
    expect(offer).toMatchObject({cityId:1,sourceCityId:0,requiredCount:2,
      regionalRecoveryKind:'food'});
    const active=acceptContract(offer.id,party);
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:1,qty:50},party);
    emitContractEvent({type:'CITY_VISITED',cityId:1},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:0,qty:20},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:1,qty:2},party);
    const restored=JSON.parse(JSON.stringify(party));
    expect(restored.contracts[0]).toMatchObject({recoveryDelivered:2,progress:1});
    emitContractEvent({type:'DELIVERED',itemId:'food',cityId:1,qty:2},restored);
    expect(restored.contracts[0]).toMatchObject({recoveryStage:2,progress:2,completed:true});
    let invoked=0;
    expect(completeContract(offer.id,restored,{onRegionalRecovery:()=>invoked++})?.type)
      .toBe('REGIONAL_RECOVERY');
    expect(invoked).toBe(1);
    expect(restored.completedRegionalRecovery).toContain(offer.id);
    expect(acceptContract(offer.id,JSON.parse(JSON.stringify(restored)))).toBeNull();
    expect(offers(9).some(c=>c.type==='REGIONAL_RECOVERY')).toBe(false);
  });
  it('security follow-up visits actual source then returns to beneficiary',()=>{
    const {party,map,contract}=build('security');
    recordRegionalAidOutcome({party,contract,day:7});
    const offer=generateContractsForCity({cityId:1,day:8,seed:123,map,
      worldState:{playerParty:party}}).find(c=>c.type==='REGIONAL_RECOVERY');
    expect(offer.regionalRecoveryKind).toBe('security');
    const active=acceptContract(offer.id,party);
    emitContractEvent({type:'CITY_VISITED',cityId:1},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(active.progress).toBe(1);
    emitContractEvent({type:'CITY_VISITED',cityId:1},party);
    expect(active).toMatchObject({progress:2,completed:true});
  });
  it('rejects claimed-looking but unsupported aid IDs and missing real source city',()=>{
    const {party,contract,map}=build();
    party.completedRegionalAid=[];
    expect(recordRegionalAidOutcome({party,contract,day:8})).toBe(false);
    party.completedRegionalAid=[contract.id];
    recordRegionalAidOutcome({party,contract,day:8});
    map.settlements.splice(0,1);
    expect(generateContractsForCity({cityId:1,day:9,seed:123,map,
      worldState:{playerParty:party}}).some(c=>c.type==='REGIONAL_RECOVERY'))
      .toBe(false);
  });
});
