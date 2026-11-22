import {describe,it,expect} from 'vitest';
import {appendAccordLegacy,getAccordTradeBonus}
  from '../../js/systems/city-accord-legacy.js';
import {getPrice,initMarket} from '../../js/systems/trade.js';

function scenario(){
  const actor=(id,role)=>({id,kind:'named',role,status:'alive',
    location:{kind:'settlement',settlementId:'0'}});
  const roster={characters:[
    actor('npc:trade-accord:1','merchant'),actor('npc:trade-accord:2','artisan')],
    relations:[{firstId:'npc:trade-accord:1',secondId:'npc:trade-accord:2',value:12}]};
  const id='ct-accord-0-5-trade';
  const party={gold:500,completedDisputeRemedies:['ct-dispute-0-5-trade'],
    completedDisputeAccords:[id],accordLegacies:[]};
  const contract={id,sourceRemedyId:'ct-dispute-0-5-trade',cityId:0,
    accordCause:'trade',accordCharacters:roster.characters.map(p=>p.id)};
  expect(appendAccordLegacy({party,contract,day:8})).toBe(true);
  const options=()=>getAccordTradeBonus({party,roster,cityId:0,day:9});
  const settlement={id:0,tx:1,ty:1,type:'city'};
  const market=initMarket(settlement,21);
  return {party,roster,settlement,market,options};
}
describe('V1.60 commercial opportunity from real named merchant-artisan reconciliation',()=>{
  it('gives an 8% locally derived wheat-sale premium with matching quoted pricing',()=>{
    const {settlement,market,options}=scenario();
    expect(options().bonusPct).toBe(8);
    const baseSell=getPrice(settlement,market,'wheat','sell');
    const boostedSell=getPrice(settlement,market,'wheat','sell',
      {accordTradeBonusPct:options().bonusPct});
    expect(boostedSell).toBeGreaterThan(baseSell);
    const baseBuy=getPrice(settlement,market,'wheat','buy');
    expect(getPrice(settlement,market,'wheat','buy',
      {accordTradeBonusPct:options().bonusPct})).toBe(baseBuy);
    expect(getPrice(settlement,market,'iron','sell',
      {accordTradeBonusPct:options().bonusPct}))
      .toBe(getPrice(settlement,market,'iron','sell'));
  });
  it('requires two real living current-city named people and a nonnegative relationship',()=>{
    const {roster,options}=scenario();
    expect(options().bonusPct).toBe(8);
    roster.relations[0].value=-1;expect(options().bonusPct).toBe(0);
    roster.relations[0].value=2;roster.characters[1].status='dead';
    expect(options().bonusPct).toBe(0);
    roster.characters[1].status='alive';roster.characters[1].location.settlementId='1';
    expect(options().bonusPct).toBe(0);
  });
  it('honors role-specific opportunity, expiry, location and saved redemption',()=>{
    const {party,roster}=scenario();
    roster.characters[1].role='scholar';
    expect(getAccordTradeBonus({party,roster,cityId:0,day:9}).bonusPct).toBe(4);
    roster.characters[0].role='commander';
    expect(getAccordTradeBonus({party,roster,cityId:0,day:9}).bonusPct).toBe(0);
    roster.characters[1].role='artisan';
    expect(getAccordTradeBonus({party,roster,cityId:0,day:9}).bonusPct).toBe(4);
    expect(getAccordTradeBonus({party,roster,cityId:1,day:9}).bonusPct).toBe(0);
    expect(getAccordTradeBonus({party,roster,cityId:0,day:23}).bonusPct).toBe(0);
    party.completedDisputeAccords=[];
    expect(getAccordTradeBonus({party,roster,cityId:0,day:9}).bonusPct).toBe(0);
  });
  it('retains exact benefit after JSON save without creating new global market opportunities',()=>{
    const {party,roster,settlement,market}=scenario();
    const frozenBefore=JSON.stringify(market);
    const restored=JSON.parse(JSON.stringify(party));
    expect(getAccordTradeBonus({party:restored,roster,cityId:0,day:12}).bonusPct).toBe(8);
    getPrice(settlement,market,'wheat','sell',{accordTradeBonusPct:8});
    expect(JSON.stringify(market)).toBe(frozenBefore);
  });
});
