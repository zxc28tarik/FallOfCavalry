import {describe,it,expect} from 'vitest';
import {
  previewCouncilReactions,applyCouncilReactions,getCouncilInterestEffects,
} from '../../js/systems/city-civic-character-reactions.js';
import {applyCivicDecision} from '../../js/systems/city-civic-decisions.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const stats=Object.fromEntries(['intelligence','observation','persuasion','leadership',
  'command','trade','administration','courage','experience'].map(key=>[key,50]));
function npc(id,role,kind='named',city=0){
  return {id,name:id,kind,role,status:'alive',importance:kind==='named'?'D':null,
    cultureId:'ottoman',originFactionId:'ottoman',age:30,traits:['cautious'],
    stats:{...stats},location:{kind:'settlement',settlementId:String(city)},
    satisfaction:50,loyalty:50,reputation:50,standing:50,history:[]};
}
const scenario=()=>({
  roster:{version:1,relations:[],characters:[
    npc('npc:v161:artisan','artisan'),npc('npc:v161:commander','commander'),
    npc('npc:v161:merchant','merchant'),npc('npc:v161:administrator','administrator'),
    npc('npc:v161:other','artisan','generated'),npc('npc:v161:away','merchant','named',4),
  ]},
  party:{gold:500,renown:5},
  city:{id:0,security:30,marketStock:[{id:'wheat',qty:3}],
    priceMultiplier:{wheat:1.2}},
});
describe('V1.61 authentic city-interest reactions',()=>{
  it('combines multiple actual city pressures without inventing groups',()=>{
    const {city,roster}=scenario();
    expect(getCouncilInterestEffects({city,decisionId:'levy'})).toEqual({
      commander:-2,artisan:-2,merchant:-2,
    });
    const before=JSON.stringify(roster);
    const rows=previewCouncilReactions({roster,cityId:0,city,decisionId:'levy'});
    expect(Object.fromEntries(rows.map(x=>[x.role,x.delta]))).toMatchObject({
      commander:-2,artisan:-6,merchant:-5,administrator:-1,
    });
    expect(rows).toHaveLength(4);
    expect(JSON.stringify(roster)).toBe(before);
  });
  it('matches preview with applied character histories and survives save normalization',()=>{
    const {roster,party,city}=scenario();
    const expected=previewCouncilReactions({roster,cityId:0,city,decisionId:'granary'});
    const cityBefore={...city};
    expect(applyCivicDecision({city,party,day:12,decisionId:'granary'}).ok).toBe(true);
    const actual=applyCouncilReactions({roster,cityId:0,city:cityBefore,day:12,decisionId:'granary'});
    expect(actual).toEqual(expected);
    expect(roster.characters[0].satisfaction).toBe(55);
    expect(roster.characters[2].satisfaction).toBe(53);
    expect(roster.characters[4].satisfaction).toBe(50);
    const saved=normalizeWorldCharacters(JSON.parse(JSON.stringify(roster)));
    expect(saved.characters.find(p=>p.id==='npc:v161:artisan')?.satisfaction).toBe(55);
  });
  it('uses verified accord legacy only as a modifier to actual named citizens',()=>{
    const {city,roster}=scenario();
    const base=previewCouncilReactions({roster,cityId:0,city,decisionId:'levy'});
    const saved=JSON.stringify(roster);
    const withLegacy=previewCouncilReactions({roster,cityId:0,city,
      decisionId:'levy',legacy:{id:'ct-accord-0-5-trade'}});
    const diff=(role)=>{
      const get=(list)=>list.find(x=>x.role===role)?.delta;
      return get(withLegacy)-get(base);
    };
    expect(diff('merchant')).toBe(-1);
    expect(diff('artisan')).toBe(-1);
    expect(JSON.stringify(roster)).toBe(saved);
  });
  it('keeps ordinary conditions exactly backward compatible',()=>{
    const {roster}=scenario();
    const plain=previewCouncilReactions({roster,cityId:0,decisionId:'patrol'});
    const neutral=previewCouncilReactions({roster,cityId:0,
      city:{id:0,security:60,marketStock:[{id:'wheat',qty:30}],
        priceMultiplier:{wheat:1.01}},decisionId:'patrol'});
    expect(neutral).toEqual(plain);
    expect(applyCouncilReactions({roster,cityId:0,day:0,decisionId:'levy'})).toEqual([]);
  });
});
