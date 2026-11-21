import {describe,it,expect} from 'vitest';
import {answerCharacterPetition,getCharacterPetition,PETITION_BY_ROLE}
  from '../../js/systems/city-character-petitions.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

function person(id,kind='named',role='merchant',city='0'){
  return {id,name:'Mehmed Çelebi',kind,importance:kind==='named'?'D':null,
    cultureId:'ottoman',originFactionId:'ottoman',role,age:32,
    traits:['cautious'],stats:Object.fromEntries(
      ['intelligence','observation','persuasion','leadership','command',
      'trade','administration','courage','experience'].map(k=>[k,50])),
    loyalty:50,satisfaction:50,reputation:50,standing:50,
    status:'alive',location:{kind:'settlement',settlementId:city},history:[]};
}
const create=()=>({version:1,relations:[],characters:[
  person('npc:petition:1'),person('npc:petition:2','generated'),
  person('npc:petition:3','named','artisan','2'),
]});
describe('V1.53 role-specific named character petitions',()=>{
  it('shows distinct role costs and preview does not mutate roster',()=>{
    const roster=create(),before=JSON.stringify(roster);
    expect(Object.keys(PETITION_BY_ROLE)).toHaveLength(6);
    const view=getCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',day:10});
    expect(view.cost).toBe(80);
    expect(view.answered).toBe(false);
    expect(JSON.stringify(roster)).toBe(before);
    expect(getCharacterPetition({roster,cityId:0,characterId:'npc:petition:2',day:10})).toBeNull();
    expect(getCharacterPetition({roster,cityId:0,characterId:'npc:petition:3',day:10})).toBeNull();
  });
  it('supports once, costs genuine money and survives canonical packed save',()=>{
    const roster=create(),party={gold:150,renown:0};
    const first=answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:3,party,decision:'support'});
    expect(first.ok).toBe(true);
    expect(party.gold).toBe(70);
    expect(roster.characters[0].satisfaction).toBe(58);
    const restored=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
    expect(restored.characters[0].satisfaction).toBe(58);
    expect(restored.characters[0].history[0].reason).toContain('desteklendi');
    const second=answerCharacterPetition({roster:restored,cityId:0,characterId:'npc:petition:1',
      day:3,party,decision:'support'});
    expect(second.ok).toBe(false);
    expect(party.gold).toBe(70);
    const third=answerCharacterPetition({roster:restored,cityId:0,characterId:'npc:petition:1',
      day:4,party,decision:'decline'});
    expect(third.ok).toBe(true);
    expect(restored.characters[0].satisfaction).toBe(53);
  });
  it('refusal costs no money, has a real satisfaction consequence and repeats cannot earn rewards',()=>{
    const roster=create(),party={gold:15};
    expect(answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:6,party,decision:'support'}).ok).toBe(false);
    const denied=answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:6,party,decision:'decline'});
    expect(denied.ok).toBe(true);
    expect(roster.characters[0].satisfaction).toBe(45);
    expect(party.gold).toBe(15);
    expect(answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:6,party,decision:'decline'}).ok).toBe(false);
    expect(answerCharacterPetition({roster,cityId:2,characterId:'npc:petition:1',
      day:7,party,decision:'decline'}).ok).toBe(false);
  });
  it('invalid inputs and satisfied or discontented limits cannot cause duplicate effects',()=>{
    const roster=create(),party={gold:1000};
    roster.characters[0].satisfaction=100;
    expect(answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:7,party,decision:'support'}).ok).toBe(false);
    expect(party.gold).toBe(1000);
    roster.characters[0].satisfaction=0;
    expect(answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:7,party,decision:'decline'}).ok).toBe(false);
    expect(answerCharacterPetition({roster,cityId:0,characterId:'npc:petition:1',
      day:7,party,decision:'bribe'}).ok).toBe(false);
  });
});
