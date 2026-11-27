import {describe,it,expect} from 'vitest';
import {appendAccordLegacy,getCityAccordLegacy,getLegacyCivicImpact}
  from '../../js/systems/city-accord-legacy.js';
import {applyCivicDecision,getEffectiveCivicDecision}
  from '../../js/systems/city-civic-decisions.js';
import {normalizeWorldCharacters} from '../../js/systems/world-characters.js';

const actor=(id)=>({id,kind:'named',status:'alive',
  location:{kind:'settlement',settlementId:'0'}});
function setup(){
  const id='ct-accord-0-5-security';
  const roster={characters:[actor('npc:legacy:1'),actor('npc:legacy:2')],
    relations:[{firstId:'npc:legacy:1',secondId:'npc:legacy:2',value:16}]};
  const city={id:0,security:55};
  const party={gold:500,renown:0,completedDisputeRemedies:['ct-dispute-0-5-security'],
    completedDisputeAccords:[id],accordLegacies:[]};
  const contract={id,cityId:0,sourceRemedyId:'ct-dispute-0-5-security',
    accordCause:'security',accordCharacters:['npc:legacy:1','npc:legacy:2']};
  return {id,roster,city,party,contract};
}
describe('V1.59 persistent accord council legacy',()=>{
  it('requires redeemed provenance and stores a bounded event only once',()=>{
    const {party,contract}=setup();
    expect(appendAccordLegacy({party,contract,day:8})).toBe(true);
    expect(appendAccordLegacy({party,contract,day:8})).toBe(false);
    expect(party.accordLegacies).toHaveLength(1);
    expect(party.accordLegacies[0]).toMatchObject({cityId:'0',day:8});
    const invalid=setup();invalid.party.completedDisputeRemedies=[];
    expect(appendAccordLegacy({party:invalid.party,contract,day:8})).toBe(false);
  });
  it('discounts real civic costs, never two rewards, and has fixed 14-day validity',()=>{
    const {party,roster,city,contract}=setup();
    appendAccordLegacy({party,contract,day:8});
    const persistedParty=JSON.parse(JSON.stringify(party));
    const legacy=getCityAccordLegacy({party:persistedParty,roster,cityId:0,day:9});
    expect(legacy).toMatchObject({discount:20,remainingDays:13});
    expect(getLegacyCivicImpact(legacy,'patrol')).toEqual({goldDiscount:20,securityPenalty:0});
    expect(getEffectiveCivicDecision({city,party:persistedParty,roster,day:9,
      decisionId:'patrol'}).cost).toBe(100);
    const outcome=applyCivicDecision({city,party:persistedParty,roster,day:9,decisionId:'patrol'});
    expect(outcome).toMatchObject({ok:true,discount:20,security:63,gold:400});
    expect(applyCivicDecision({city,party:persistedParty,roster,day:9,decisionId:'granary'}).ok)
      .toBe(false);
    expect(getCityAccordLegacy({party:persistedParty,roster,cityId:0,day:22})).not.toBeNull();
    expect(getCityAccordLegacy({party:persistedParty,roster,cityId:0,day:23})).toBeNull();
  });
  it('taxing a reconciled city has a visible and actual extra security penalty',()=>{
    const {party,roster,city,contract}=setup();
    appendAccordLegacy({party,contract,day:5});
    const view=getEffectiveCivicDecision({city,party,roster,day:7,decisionId:'levy'});
    expect(view).toMatchObject({cost:-75,security:-12,penalty:3});
    const result=applyCivicDecision({city,party,roster,day:7,decisionId:'levy'});
    expect(result).toMatchObject({ok:true,penalty:3,security:43,gold:575});
  });
  it('expires if either real person leaves, dies, relationship turns negative or ID is unclaimed',()=>{
    const {party,roster,contract}=setup();
    appendAccordLegacy({party,contract,day:8});
    const read=()=>getCityAccordLegacy({party,roster,cityId:0,day:9});
    expect(read()).not.toBeNull();
    roster.relations[0].value=-1;expect(read()).toBeNull();
    roster.relations[0].value=3;roster.characters[0].status='dead';expect(read()).toBeNull();
    roster.characters[0].status='alive';
    roster.characters[1].location.settlementId='1';expect(read()).toBeNull();
    roster.characters[1].location.settlementId='0';
    party.completedDisputeAccords=[];expect(read()).toBeNull();
    expect(getCityAccordLegacy({party,roster,cityId:1,day:9})).toBeNull();
  });
  it('does not grant a benefit from malformed history or unredeemed contract',()=>{
    const {party,roster,city}=setup();
    party.accordLegacies=[{id:'ct-accord-0-5-security',cityId:'0',day:5,
      characterIds:['npc:legacy:1','npc:legacy:2'],cause:'security'}];
    party.completedDisputeAccords=[];
    expect(getEffectiveCivicDecision({city,party,roster,day:6,decisionId:'granary'}).cost).toBe(90);
    expect(getCityAccordLegacy({party,roster,cityId:0,day:6})).toBeNull();
  });
});
