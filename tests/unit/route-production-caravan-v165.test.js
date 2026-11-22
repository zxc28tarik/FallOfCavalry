import {describe,it,expect} from 'vitest';
import {selectCooperationCaravan} from '../../js/systems/route-production-cooperation.js';
import {generateContractsForCity,acceptContract,emitContractEvent,
  completeContract,setContractsRuntimeContext} from '../../js/systems/contracts.js';
import {getPrice,initMarket} from '../../js/systems/trade.js';

function scenario(){
  const aid='ct-regional-0-1-5-food',recovery='ct-regional-recovery-'+aid;
  const source={id:0,name:'Payitaht',tx:0,ty:0,x:16,y:16,biome:'PLAINS',
    marketStock:[{id:'wheat',qty:9},{id:'flour',qty:4}],security:50};
  const target={id:1,name:'Bursa',tx:10,ty:0,x:336,y:16,biome:'HILLS',
    marketStock:[{id:'iron',qty:9}],security:40};
  const map={tileSize:32,settlements:[source,target],roads:[{
    from:0,to:1,path:[{x:0,y:0},{x:5,y:0},{x:10,y:0}],
  }],pois:[{id:'ruin',type:'ruin'}]};
  const roster={characters:[
    {id:'npc:prod:1',kind:'named',role:'merchant',status:'alive',
      location:{settlementId:'0'}},
    {id:'npc:prod:2',kind:'named',role:'artisan',status:'alive',
      location:{settlementId:'1'}},
  ],relations:[{firstId:'npc:prod:1',secondId:'npc:prod:2',value:10}]};
  const party={gold:500,renown:0,contracts:[],completedRegionalAid:[aid],
    completedRegionalRecovery:[recovery],regionalCooperation:[{
      sourceRecoveryId:recovery,sourceAidId:aid,sourceCityId:'0',
      targetCityId:'1',characterIds:['npc:prod:1','npc:prod:2'],day:7,kind:'food',
    }],completedProductionCaravans:[]};
  setContractsRuntimeContext({party,map,worldSeed:17});
  return {map,source,target,party,roster};
}
describe('WEB V1.65 authenticated production-road caravan',()=>{
  it('chooses available positive-biome output on an actual generated road',()=>{
    const {map,party,roster}=scenario();
    expect(selectCooperationCaravan({map,party,roster,cityId:0,day:9}))
      .toMatchObject({itemId:'wheat',biome:'PLAINS',routeId:'route:0:1'});
    expect(selectCooperationCaravan({map,party,roster,cityId:1,day:9})).toBeNull();
    map.roads[0].path=[{x:40,y:40},{x:90,y:90}];
    expect(selectCooperationCaravan({map,party,roster,cityId:0,day:9})).toBeNull();
  });
  it('does not generate imaginary production goods or goods with no real stock',()=>{
    const {map,party,roster}=scenario();
    map.settlements[0].biome='UNKNOWN';
    expect(selectCooperationCaravan({map,party,roster,cityId:0,day:9})).toBeNull();
    map.settlements[0].biome='PLAINS';
    map.settlements[0].marketStock=[];
    expect(selectCooperationCaravan({map,party,roster,cityId:0,day:9})).toBeNull();
  });
  it('requires 3 real purchases, destination visit, 3 true item sales in that order',()=>{
    const {map,party,roster}=scenario();
    const offers=generateContractsForCity({cityId:0,day:9,map,seed:17,
      worldState:{playerParty:party,worldCharacters:roster}});
    const offer=offers.find(c=>c.type==='PRODUCTION_CARAVAN');
    expect(offer).toMatchObject({cargoItemId:'wheat',requiredCount:3,routeId:'route:0:1'});
    const active=acceptContract(offer.id,party);
    emitContractEvent({type:'CITY_VISITED',cityId:1},party);
    emitContractEvent({type:'TRADE_GOOD_SOLD',cityId:1,itemId:'wheat',qty:5},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'TRADE_GOOD_BOUGHT',cityId:1,itemId:'wheat',qty:9},party);
    emitContractEvent({type:'TRADE_GOOD_BOUGHT',cityId:0,itemId:'iron',qty:9},party);
    expect(active.progress).toBe(0);
    emitContractEvent({type:'TRADE_GOOD_BOUGHT',cityId:0,itemId:'wheat',qty:1},party);
    const resumed=JSON.parse(JSON.stringify(party));
    expect(resumed.contracts[0].caravanBought).toBe(1);
    emitContractEvent({type:'TRADE_GOOD_BOUGHT',cityId:0,itemId:'wheat',qty:2},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:1,caravanStage:1});
    emitContractEvent({type:'TRADE_GOOD_SOLD',cityId:1,itemId:'wheat',qty:9},resumed);
    expect(resumed.contracts[0].progress).toBe(1);
    emitContractEvent({type:'CITY_VISITED',cityId:1},resumed);
    expect(resumed.contracts[0].progress).toBe(2);
    emitContractEvent({type:'TRADE_GOOD_SOLD',cityId:0,itemId:'wheat',qty:9},resumed);
    expect(resumed.contracts[0].progress).toBe(2);
    emitContractEvent({type:'TRADE_GOOD_SOLD',cityId:1,itemId:'wheat',qty:2},resumed);
    expect(resumed.contracts[0].caravanSold).toBe(2);
    emitContractEvent({type:'TRADE_GOOD_SOLD',cityId:1,itemId:'wheat',qty:1},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:3,completed:true,caravanStage:3});
    let calls=0;
    expect(completeContract(offer.id,resumed,{onProductionCaravan:()=>calls++})?.type)
      .toBe('PRODUCTION_CARAVAN');
    expect(calls).toBe(1);
    expect(resumed.completedProductionCaravans).toContain(offer.id);
    expect(completeContract(offer.id,resumed)).toBeNull();
    expect(acceptContract(offer.id,JSON.parse(JSON.stringify(resumed)))).toBeNull();
  });
  it('only transports goods from an active agreement and will not affect buying prices',()=>{
    const {map,party,roster}=scenario();
    party.completedRegionalRecovery=[];
    expect(selectCooperationCaravan({map,party,roster,cityId:0,day:9})).toBeNull();
    const market=initMarket(map.settlements[0],4);
    expect(getPrice(map.settlements[0],market,'wheat','buy'))
      .toBe(getPrice(map.settlements[0],market,'wheat','buy',{regionalTradeBonusPct:3}));
  });
});
