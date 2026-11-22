/**
 * V1.59 — A time-limited civic legacy from a genuinely redeemed accord.
 * An accord's completed ID is authoritative; the bounded record only
 * preserves WHEN and WHO so subsequent decisions can reflect the outcome.
 */
const WINDOW_DAYS=14;
const DISCOUNT=20;
const LEVY_PENALTY=3;
const accordId=/^ct-accord-(.+)-([1-9][0-9]*)-(security|scarcity|trade|civic)$/;

export function appendAccordLegacy({party,contract,day}={}){
  if(!party||!Array.isArray(party.completedDisputeRemedies)
    ||!party.completedDisputeRemedies.includes(contract?.sourceRemedyId)
    ||!Array.isArray(contract?.accordCharacters)||contract.accordCharacters.length!==2
    ||contract.accordCharacters[0]===contract.accordCharacters[1]
    ||!Number.isSafeInteger(day)||day<1)return false;
  const match=accordId.exec(String(contract.id||''));
  if(!match||String(contract.cityId)!==match[1]||match[3]!==contract.accordCause
    ||!String(contract.sourceRemedyId).startsWith(`ct-dispute-${match[1]}-${match[2]}-`))return false;
  const existing=Array.isArray(party.accordLegacies)?party.accordLegacies:[];
  if(existing.some(e=>e.id===contract.id))return false;
  party.accordLegacies=[...existing,{
    id:contract.id,cityId:String(contract.cityId),day,
    characterIds:[...contract.accordCharacters],cause:contract.accordCause,
  }].slice(-64);
  return true;
}

export function getCityAccordLegacy({party,roster,cityId,day}={}){
  if(cityId==null||!Number.isSafeInteger(day)||day<1)return null;
  const entries=Array.isArray(party?.accordLegacies)?party.accordLegacies:[];
  const completed=Array.isArray(party?.completedDisputeAccords)?party.completedDisputeAccords:[];
  const residents=Array.isArray(roster?.characters)?roster.characters:[];
  const relations=Array.isArray(roster?.relations)?roster.relations:[];
  const eligible=entries.filter(entry=>{
    if(!entry||!accordId.test(String(entry.id||''))||String(entry.cityId)!==String(cityId)
      ||!completed.includes(entry.id)||!Number.isSafeInteger(entry.day)
      ||entry.day>day||day-entry.day>WINDOW_DAYS
      ||!Array.isArray(entry.characterIds)||entry.characterIds.length!==2
      ||entry.characterIds[0]===entry.characterIds[1])return false;
    const people=entry.characterIds.map(id=>residents.find(p=>p.id===id
      &&p.kind==='named'&&p.status==='alive'
      &&String(p.location?.settlementId)===String(cityId)));
    if(people.some(p=>!p))return false;
    const rel=relations.find(r=>
      [r.firstId,r.secondId].includes(entry.characterIds[0])
      &&[r.firstId,r.secondId].includes(entry.characterIds[1]));
    return Number(rel?.value??0)>=0;
  }).sort((a,b)=>b.day-a.day||a.id.localeCompare(b.id,'en'));
  const record=eligible[0];
  if(!record)return null;
  return {
    id:record.id,day:record.day,remainingDays:WINDOW_DAYS-(day-record.day),
    characterIds:[...record.characterIds],
    discount:DISCOUNT,levyPenalty:LEVY_PENALTY,cause:record.cause,
  };
}

export function getLegacyCivicImpact(legacy,decisionId){
  if(!legacy)return {goldDiscount:0,securityPenalty:0};
  if(decisionId==='patrol'||decisionId==='granary')
    return {goldDiscount:legacy.discount,securityPenalty:0};
  if(decisionId==='levy')
    return {goldDiscount:0,securityPenalty:legacy.levyPenalty};
  return {goldDiscount:0,securityPenalty:0};
}
