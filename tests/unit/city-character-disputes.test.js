import {describe,it,expect} from 'vitest';
import {getCityDispute,resolveCityDispute,DISPUTE_CHOICES}
  from '../../js/systems/city-character-disputes.js';
import {normalizeWorldCharacters,getWorldCharacterProfile}
  from '../../js/systems/world-characters.js';
const stats=Object.fromEntries(
  ['intelligence','observation','persuasion','leadership','command',
   'trade','administration','courage','experience'].map(k=>[k,50]));
function npc(id,role,kind='named',city=0){
  return {id,name:id,role,kind,importance:kind==='named'?'D':null,
    cultureId:'ottoman',originFactionId:'ottoman',status:'alive',age:36,
    traits:['cautious'],stats:{...stats},
    loyalty:50,satisfaction:50,reputation:50,standing:50,
    location:{kind:'settlement',settlementId:String(city)},history:[]};
}
const world=()=>({version:1,characters:[
  npc('npc:dispute:1','merchant'),npc('npc:dispute:2','artisan'),
  npc('npc:dispute:3','scholar','generated'),npc('npc:dispute:4','merchant','named',2),
],relations:[]});
describe('V1.55 local important-person disputes',()=>{
  it('previews two genuine named residents without mutating world',()=>{
    const roster=world(),original=JSON.stringify(roster);
    const dispute=getCityDispute({roster,cityId:0,day:8});
    expect(dispute?.first.id).toBe('npc:dispute:1');
    expect(dispute?.second.id).toBe('npc:dispute:2');
    expect(dispute.resolved).toBe(false);
    expect(Object.keys(DISPUTE_CHOICES)).toEqual(['first','second','mediate']);
    expect(JSON.stringify(roster)).toBe(original);
    expect(getCityDispute({roster,cityId:2,day:8})).toBeNull();
  });
  it('supporting first citizen improves them and harms rival relationship',()=>{
    const roster=world(),party={gold:100,renown:5};
    const result=resolveCityDispute({roster,cityId:0,day:4,party,choice:'first'});
    expect(result.ok).toBe(true);
    expect(roster.characters[0].satisfaction).toBe(56);
    expect(roster.characters[1].satisfaction).toBe(44);
    expect(roster.characters[2].satisfaction).toBe(50);
    expect(roster.characters[3].satisfaction).toBe(50);
    expect(roster.relations[0].value).toBe(-8);
    expect(party.gold).toBe(100);
    expect(getWorldCharacterProfile(roster,'npc:dispute:1').relations[0].value).toBe(-8);
    const saved=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
    expect(saved.relations[0].value).toBe(-8);
    expect(saved.characters[0].history[0].reason).toContain('Şehir ihtilafı: first');
    expect(getCityDispute({roster:saved,cityId:0,day:4}).resolved).toBe(true);
    expect(resolveCityDispute({roster:saved,cityId:0,day:4,party,choice:'first'}).ok).toBe(false);
  });
  it('mediation costs gold and increases both peoples satisfaction and relationship',()=>{
    const roster=world(),party={gold:75};
    const result=resolveCityDispute({roster,cityId:0,day:10,party,choice:'mediate'});
    expect(result.ok).toBe(true);
    expect(party.gold).toBe(15);
    expect(roster.characters[0].satisfaction).toBe(53);
    expect(roster.characters[1].satisfaction).toBe(53);
    expect(roster.relations[0].value).toBe(12);
  });
  it('insufficient funds, invalid choice or wrong place cause no effects',()=>{
    const roster=world(),party={gold:15},before=JSON.stringify(roster);
    expect(resolveCityDispute({roster,cityId:0,day:5,party,choice:'mediate'}).ok).toBe(false);
    expect(resolveCityDispute({roster,cityId:0,day:5,party,choice:'invented'}).ok).toBe(false);
    expect(resolveCityDispute({roster,cityId:2,day:5,party,choice:'first'}).ok).toBe(false);
    expect(JSON.stringify(roster)).toBe(before);
    expect(party.gold).toBe(15);
  });
  it('cannot issue a backwards-dated event after a future character state change',()=>{
    const roster=world(),party={gold:100};
    roster.characters[0].history=[{day:12,type:'state-changed',
      metric:'satisfaction',from:45,to:50,reason:'Önceki şehir olayı'}];
    expect(getCityDispute({roster,cityId:0,day:11})).toBeNull();
    expect(resolveCityDispute({roster,cityId:0,day:11,party,choice:'first'}).ok).toBe(false);
  });
});
