import {describe,it,expect} from 'vitest';
import {getDisputeCause,getCityDispute,resolveCityDispute}
  from '../../js/systems/city-character-disputes.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';
const skills=Object.fromEntries(['intelligence','observation','persuasion','leadership',
  'command','trade','administration','courage','experience'].map(x=>[x,50]));
function npc(id,role){
  return {id,name:id,kind:'named',importance:'D',cultureId:'ottoman',
    originFactionId:'ottoman',role,age:30,status:'alive',traits:['cautious'],
    location:{kind:'settlement',settlementId:'5'},stats:{...skills},
    loyalty:50,satisfaction:50,reputation:50,standing:50,history:[]};
}
const make=()=>({
  roster:{version:1,characters:[
    npc('npc:dispute-ec:1','merchant'),npc('npc:dispute-ec:2','artisan'),
  ],relations:[]},
  party:{gold:120,renown:0},
  city:{id:5,security:55,marketStock:[{id:'wheat',qty:25}],
    priceMultiplier:{wheat:1.02}},
});
describe('V1.56 real settlement dispute causes and consequences',()=>{
  it('classifies from actual safety, wheat stock and trading price in priority order',()=>{
    const {city,roster}=make();
    expect(getDisputeCause(city)).toBe('civic');
    city.priceMultiplier.wheat=1.24;
    expect(getDisputeCause(city)).toBe('trade');
    city.marketStock[0].qty=2;
    expect(getDisputeCause(city)).toBe('scarcity');
    city.security=23;
    expect(getDisputeCause(city)).toBe('security');
    expect(getCityDispute({roster,cityId:5,day:5,city}).causeTitle).toBe('Mahalle Asayişi');
  });
  it('security intervention has a durable security effect besides person relation',()=>{
    const {city,party,roster}=make();
    city.security=28;
    const r=resolveCityDispute({roster,cityId:5,day:5,city,party,choice:'mediate'});
    expect(r).toMatchObject({ok:true,cause:'security',citySecurity:34});
    expect(city).toMatchObject({security:34,civicDirty:true});
    expect(party.gold).toBe(60);
    expect(resolveCityDispute({roster,cityId:5,day:5,city,party,choice:'mediate'}).ok).toBe(false);
    expect(party.gold).toBe(60);
  });
  it('trade arbitration changes wheat pricing in the existing market ledger',()=>{
    const {city,party,roster}=make();
    city.priceMultiplier.wheat=1.2;
    const r=resolveCityDispute({roster,cityId:5,day:5,city,party,choice:'mediate'});
    expect(r).toMatchObject({ok:true,cause:'trade',wheatPrice:1.14});
    const restored=JSON.parse(JSON.stringify(city));
    expect(restored.priceMultiplier.wheat).toBe(1.14);
    expect(normalizeWorldCharacters(JSON.parse(JSON.stringify(roster))).relations[0].value).toBe(12);
  });
  it('scarcity dispute side choice worsens market conditions with no invented stock',()=>{
    const {city,party,roster}=make();
    city.marketStock[0].qty=0;
    const initialQty=city.marketStock[0].qty;
    const r=resolveCityDispute({roster,cityId:5,day:5,city,party,choice:'first'});
    expect(r).toMatchObject({ok:true,cause:'scarcity',wheatPrice:1.06});
    expect(city.security).toBe(54);
    expect(city.marketStock[0].qty).toBe(initialQty);
  });
  it('failed action leaves city, treasury and NPC state untouched',()=>{
    const {city,party,roster}=make();
    party.gold=5;
    const snapshot=JSON.stringify({city,party,roster});
    expect(resolveCityDispute({roster,cityId:5,day:6,city,party,choice:'mediate'}).ok).toBe(false);
    expect(JSON.stringify({city,party,roster})).toBe(snapshot);
  });
});
