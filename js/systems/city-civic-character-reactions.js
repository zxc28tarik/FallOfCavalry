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

export function previewCouncilReactions({roster,cityId,decisionId}={}){
  const rules=COUNCIL_REACTION_RULES[decisionId];
  if(!rules||cityId==null)return [];
  return getSettlementCharacters(roster,cityId)
    .filter(person=>person.kind==='named'&&person.status==='alive'
      &&Number.isSafeInteger(person.satisfaction))
    .map(person=>({
      characterId:person.id,name:person.name,role:person.role,
      delta:rules[person.role]??0,from:person.satisfaction,
      to:Math.max(0,Math.min(100,person.satisfaction+(rules[person.role]??0))),
    }))
    .filter(entry=>entry.from!==entry.to)
    .sort((a,b)=>a.characterId.localeCompare(b.characterId,'en'));
}

/** Call only AFTER a successful council action; never for a menu preview. */
export function applyCouncilReactions({roster,cityId,decisionId,day}={}){
  if(!Number.isSafeInteger(day)||day<1)return [];
  const records=previewCouncilReactions({roster,cityId,decisionId});
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
