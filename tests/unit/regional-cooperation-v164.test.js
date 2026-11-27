import {describe,it,expect} from 'vitest';
import {recordRegionalCooperation,getRegionalCooperation}
  from '../../js/systems/regional-cooperation.js';
import {generateContractsForCity,acceptContract,emitContractEvent,completeContract,
  setContractsRuntimeContext} from '../../js/systems/contracts.js';
import {getPrice,initMarket} from '../../js/systems/trade.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const stats=Object.fromEntries(['intelligence','observation','persuasion','leadership',
  'command','trade','administration','courage','experience'].map(x=>[x,50]));
const person=(id,role,cityId)=>({id,name:id,kind:'named',importance:'D',
  role,status:'alive',cultureId:'ottoman',originFactionId:'ottoman',age:30,
  location:{kind:'settlement',settlementId:String(cityId)},traits:['cautious'],
  stats:{...stats},loyalty:50,satisfaction:50,reputation:50,standing:50,history:[]});
function create(){
  const aid='ct-regional-0-1-5-food',recovery=`ct-regional-recovery-${aid}`;
  const party={gold:200,renown:0,contracts:[],completedRegionalAid:[aid],
    completedRegionalRecovery:[recovery],completedIntercityTrade:[],
    regionalCooperation:[]};
  const map={settlements:[{id:0,name:'İstanbul',tx:0,ty:0,security:50},
    {id:1,name:'Bursa',tx:10,ty:10,security:45}],pois:[{id:'ruin',type:'ruin'}]};
  const roster=normalizeWorldCharacters({characters:[
    person('npc:crosscity:1','merchant',0),person('npc:crosscity:2','artisan',1)],
    relations:[]});
  const contract={id:recovery,sourceAidId:aid,sourceCityId:0,cityId:1,
    regionalRecoveryKind:'food'};
  setContractsRuntimeContext({party,map,worldSeed:11});
  return {party,map,roster,contract};
}
describe('V1.64 real intercity cooperation after fully redeemed regional recovery',()=>{
  it('creates a single authentic cross-city relationship and saves it',()=>{
    const {party,map,roster,contract}=create();
    const result=recordRegionalCooperation({party,roster,contract,map,day:8});
    expect(result).toMatchObject({before:0,after:10});
    expect(roster.relations).toMatchObject([{value:10}]);
    expect(recordRegionalCooperation({party,roster,contract,map,day:8})).toBeNull();
    const restored=JSON.parse(JSON.stringify(party));
    const savedRoster=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
    expect(getRegionalCooperation({party:restored,roster:savedRoster,cityId:0,day:9}))
      .toMatchObject({sellBonusPct:3,remainingDays:9});
    expect(getRegionalCooperation({party:restored,roster:savedRoster,cityId:1,day:9}))
      .toMatchObject({sellBonusPct:3});
    expect(getRegionalCooperation({party:restored,roster:savedRoster,cityId:0,day:19}))
      .toBeNull();
    expect(getRegionalCooperation({party:restored,roster:savedRoster,cityId:2,day:9}))
      .toBeNull();
  });
  it('does not grant trade benefit without living current-city contacts and positive relation',()=>{
    const {party,map,roster,contract}=create();
    recordRegionalCooperation({party,roster,contract,map,day:8});
    const read=()=>getRegionalCooperation({party,roster,cityId:1,day:9});
    roster.relations[0].value=-1;expect(read()).toBeNull();
    roster.relations[0].value=10;
    roster.characters[0].status='dead';expect(read()).toBeNull();
    roster.characters[0].status='alive';
    roster.characters[1].location.settlementId='0';expect(read()).toBeNull();
    roster.characters[1].location.settlementId='1';
    party.completedRegionalRecovery=[];expect(read()).toBeNull();
  });
  it('does not create agreement without redeemed aid and recovery',()=>{
    const {party,map,roster,contract}=create();
    party.completedRegionalRecovery=[];
    expect(recordRegionalCooperation({party,roster,contract,map,day:8})).toBeNull();
    expect(roster.relations).toHaveLength(0);
    party.completedRegionalRecovery=[contract.id];
    party.completedRegionalAid=[];
    expect(recordRegionalCooperation({party,roster,contract,map,day:8})).toBeNull();
  });
  it('gives a bounded local wheat SALE price benefit, not a buy or global market change',()=>{
    const {party,map,roster,contract}=create();
    recordRegionalCooperation({party,roster,contract,map,day:8});
    const market=initMarket(map.settlements[0],5);
    const before=JSON.stringify(market);
    const old=getPrice(map.settlements[0],market,'wheat','sell');
    const bonus=getRegionalCooperation({party,roster,cityId:0,day:9}).sellBonusPct;
    expect(getPrice(map.settlements[0],market,'wheat','sell',
      {regionalTradeBonusPct:bonus})).toBeGreaterThan(old);
    expect(getPrice(map.settlements[0],market,'wheat','buy',
      {regionalTradeBonusPct:bonus})).toBe(
        getPrice(map.settlements[0],market,'wheat','buy'));
    expect(JSON.stringify(market)).toBe(before);
  });
  it('opens a next-day, three-stage real trade task and prevents reward replay',()=>{
    const {party,map,roster,contract}=create();
    recordRegionalCooperation({party,roster,contract,map,day:8});
    const offers=day=>generateContractsForCity({cityId:0,day,map,seed:11,
      worldState:{worldCharacters:roster,playerParty:party}});
    expect(offers(8).some(c=>c.type==='INTERCITY_TRADE')).toBe(false);
    const offer=offers(9).find(c=>c.type==='INTERCITY_TRADE');
    expect(offer).toMatchObject({cityId:0,targetCityId:1,requiredCount:3});
    const accepted=acceptContract(offer.id,party);
    emitContractEvent({type:'DELIVERED',cityId:1,itemId:'food',qty:9},party);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(accepted.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:1},party);
    expect(accepted.progress).toBe(1);
    emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:9},party);
    expect(accepted.progress).toBe(1);
    emitContractEvent({type:'DELIVERED',cityId:1,itemId:'food',qty:2},party);
    const resumed=JSON.parse(JSON.stringify(party));
    emitContractEvent({type:'DELIVERED',cityId:1,itemId:'food',qty:3},resumed);
    expect(resumed.contracts[0]).toMatchObject({tradeStage:2,progress:2});
    emitContractEvent({type:'CITY_VISITED',cityId:1},resumed);
    expect(resumed.contracts[0].progress).toBe(2);
    emitContractEvent({type:'CITY_VISITED',cityId:0},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:3,completed:true});
    let callbackCount=0;
    expect(completeContract(offer.id,resumed,{onIntercityTrade:()=>callbackCount++})?.type)
      .toBe('INTERCITY_TRADE');
    expect(callbackCount).toBe(1);
    expect(resumed.completedIntercityTrade).toContain(offer.id);
    expect(acceptContract(offer.id,JSON.parse(JSON.stringify(resumed)))).toBeNull();
    expect(offers(10).some(c=>c.type==='INTERCITY_TRADE')).toBe(false);
  });
});
