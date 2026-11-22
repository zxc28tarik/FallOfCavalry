/**
 * V1.52 — Council reaction of existing named citizens.
 * A real council vote is the only trigger; no generated person is promoted,
 * appointed, relocated or awarded a combat/quest stat by this system.
 * Reactions are gameplay content rules, not an inferred social simulation.
 */
import {getSettlementCharacters} from './world-characters.js';
import {changeNamedCharacterMetric} from './named-character-state.js';

export const COUNCIL_REACTION_RULES=Object.freeze({
  patrol:Object.freeze({administrator:2,commander:3,merchant:1,artisan:1,scholar:0,traveler:1}),
  granary:Object.freeze({administrator:2,commander:0,merchant:2,artisan:3,scholar:2,traveler:2}),
  levy:Object.freeze({administrator:-1,commander:0,merchant:-3,artisan:-4,scholar:-2,traveler:-2}),
});

/**
 * V1.61 — City conditions and an explicitly redeemed accord can amplify
 * EXISTING role reactions; these are temporary civic constituencies, not
 * newly created legal factions or invented organizational memberships.
 */
export function getCouncilInterestEffects({city,decisionId,legacy}={}){
  const security=Number(city?.security??50);
  const grain=Array.isArray(city?.marketStock)
    ?city.marketStock.find(x=>x?.id==='wheat'||x?.id==='food'):null;
  const stock=Number(grain?.qty);
  const wheat=Number(city?.priceMultiplier?.wheat??1);
  const effects={};
  if(Number.isFinite(security)&&security<40){
    if(decisionId==='patrol')effects.commander=2;
    if(decisionId==='levy')effects.commander=-2;
  }
  if(grain&&Number.isFinite(stock)&&stock<10){
    if(decisionId==='granary')effects.artisan=(effects.artisan||0)+2;
    if(decisionId==='levy')effects.artisan=(effects.artisan||0)-2;
  }
  if(Number.isFinite(wheat)&&wheat>1.14){
    if(decisionId==='granary')effects.merchant=(effects.merchant||0)+1;
    if(decisionId==='levy')effects.merchant=(effects.merchant||0)-2;
  }
  if(legacy){
    if(decisionId==='granary')effects.merchant=(effects.merchant||0)+1;
    if(decisionId==='patrol')effects.administrator=(effects.administrator||0)+1;
    if(decisionId==='levy'){
      effects.merchant=(effects.merchant||0)-1;
      effects.artisan=(effects.artisan||0)-1;
    }
  }
  return effects;
}

export function previewCouncilReactions({roster,cityId,decisionId,city,legacy}={}){
  const rules=COUNCIL_REACTION_RULES[decisionId];
  if(!rules||cityId==null)return [];
  const extras=getCouncilInterestEffects({city,decisionId,legacy});
  return getSettlementCharacters(roster,cityId)
    .filter(person=>person.kind==='named'&&person.status==='alive'
      &&Number.isSafeInteger(person.satisfaction))
    .map(person=>({
      characterId:person.id,name:person.name,role:person.role,
      delta:Math.max(-100,Math.min(100,(rules[person.role]??0)+(extras[person.role]??0))),
      from:person.satisfaction,
      to:Math.max(0,Math.min(100,person.satisfaction+(rules[person.role]??0)+(extras[person.role]??0))),
    }))
    .filter(entry=>entry.from!==entry.to)
    .sort((a,b)=>a.characterId.localeCompare(b.characterId,'en'));
}

/** Call only AFTER a successful council action; never for a menu preview. */
export function applyCouncilReactions({roster,cityId,decisionId,day,city,legacy}={}){
  if(!Number.isSafeInteger(day)||day<1)return [];
  const records=previewCouncilReactions({roster,cityId,decisionId,city,legacy});
  const results=[];
  for(const row of records){
    const changed=changeNamedCharacterMetric(roster,row.characterId,{
      metric:'satisfaction',value:row.to,day,
      reason:`Şehir meclisi kararı: ${decisionId}`,
    });
    if(changed)results.push(row);
  }
  return results;
}
