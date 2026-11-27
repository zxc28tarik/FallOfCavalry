import {describe,it,expect} from 'vitest';
import {
  generateContractsForCity,acceptContract,emitContractEvent,
  completeContract,setContractsRuntimeContext,
} from '../../js/systems/contracts.js';
import {answerCharacterPetition} from '../../js/systems/city-character-petitions.js';
import {changeNamedCharacterMetric} from '../../js/systems/named-character-state.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const cities=[
  {id:0,name:'Payitaht',tx:0,ty:0,security:45,ownerFactionId:'ottoman'},
  {id:1,name:'Bursa',tx:10,ty:0,security:50,ownerFactionId:'ottoman'},
  {id:2,name:'Edirne',tx:21,ty:0,security:40,ownerFactionId:'ottoman'},
];
const stats=Object.fromEntries([
  'intelligence','observation','persuasion','leadership','command',
  'trade','administration','courage','experience',
].map(key=>[key,50]));
function actor(role='merchant',kind='named',location=0,id='npc:commission:1'){
  return {
    id,kind,name:'Mehmed Çelebi',importance:kind==='named'?'D':null,
    cultureId:'ottoman',originFactionId:'ottoman',role,age:35,
    status:'alive',location:{kind:'settlement',settlementId:String(location)},
    traits:['cautious'],stats:{...stats},
    loyalty:50,satisfaction:50,reputation:50,standing:50,history:[],
  };
}
function scenario(role='merchant',supported=true){
  const map={settlements:cities.map(city=>({...city})),pois:[{id:'ruin',type:'ruin'}]};
  const roster={version:1,characters:[actor(role)],relations:[]};
  const party={gold:500,renown:0,contracts:[]};
  if(supported){
    const result=answerCharacterPetition({roster,cityId:0,
      characterId:'npc:commission:1',day:5,party,decision:'support'});
    expect(result.ok).toBe(true);
  }
  setContractsRuntimeContext({party,map,worldSeed:1588});
  const generate=day=>generateContractsForCity({
    cityId:0,day,seed:1588,map,worldState:{worldCharacters:roster},
  });
  return {map,roster,party,generate};
}
describe('V1.54 verified character-commission game content',()=>{
  it('only a verified previous-day supported named petition unlocks a role mission',()=>{
    const {generate}=scenario();
    const offers=generate(6);
    const contract=offers.find(c=>c.type==='CHARACTER_COMMISSION');
    expect(contract).toMatchObject({
      cityId:0,characterId:'npc:commission:1',
      characterRole:'merchant',commissionKind:'correspondence',
    });
    expect(offers).toHaveLength(7);
    expect(generate(5).some(c=>c.type==='CHARACTER_COMMISSION')).toBe(false);
    expect(generate(7).some(c=>c.type==='CHARACTER_COMMISSION')).toBe(false);
    expect(scenario('merchant',false).generate(6)
      .some(c=>c.type==='CHARACTER_COMMISSION')).toBe(false);
  });
  it('travel commission requires visiting actual target and return in order',()=>{
    const {generate,party,roster,map}=scenario('merchant');
    const offer=generate(6).find(c=>c.type==='CHARACTER_COMMISSION');
    expect(map.settlements.some(city=>city.id===offer.targetCityId)).toBe(true);
    const accepted=acceptContract(offer.id,party);
    emitContractEvent({type:'CITY_VISITED',cityId:0},party);
    expect(accepted.progress).toBe(0);
    emitContractEvent({type:'CITY_VISITED',cityId:offer.targetCityId},party);
    expect(accepted.progress).toBe(1);
    const resumed=JSON.parse(JSON.stringify(party));
    emitContractEvent({type:'CITY_VISITED',cityId:0},resumed);
    expect(resumed.contracts[0]).toMatchObject({progress:2,completed:true});
    let callbacks=0;
    const initial=roster.characters[0].satisfaction;
    const completed=completeContract(offer.id,resumed,{
      onCharacterCommission:contract=>{
        callbacks++;
        expect(contract.characterId).toBe('npc:commission:1');
        changeNamedCharacterMetric(roster,contract.characterId,{
          metric:'satisfaction',value:Math.min(100,initial+4),
          day:6,reason:'Kişisel görev tamamlandı: şehir hizmeti',
        });
      },
    });
    expect(completed.type).toBe('CHARACTER_COMMISSION');
    expect(roster.characters[0].satisfaction).toBe(initial+4);
    expect(normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)))
      .characters[0].satisfaction).toBe(initial+4);
    expect(callbacks).toBe(1);
    expect(completeContract(offer.id,resumed)).toBeNull();
  });
  for(const role of ['artisan','commander','traveler']){
    it(`${role} task requires real wheat sale at the exact destination`,()=>{
      const {generate,party}=scenario(role);
      const offer=generate(6).find(c=>c.type==='CHARACTER_COMMISSION');
      expect(offer.commissionKind).toBe('supply');
      const accepted=acceptContract(offer.id,party);
      emitContractEvent({type:'DELIVERED',cityId:0,itemId:'food',qty:20},party);
      emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'iron',qty:20},party);
      expect(accepted.progress).toBe(0);
      emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'food',qty:2},party);
      const restored=JSON.parse(JSON.stringify(party));
      expect(restored.contracts[0].progress).toBe(2);
      emitContractEvent({type:'DELIVERED',cityId:offer.targetCityId,itemId:'food',qty:4},restored);
      expect(restored.contracts[0]).toMatchObject({progress:6,completed:true});
    });
  }
  it('does not fabricate a destination where there is only one real city',()=>{
    const {map,generate}=scenario();
    map.settlements=map.settlements.slice(0,1);
    expect(generate(6).some(c=>c.type==='CHARACTER_COMMISSION')).toBe(false);
  });
});
