/**
 * V1.63 — source-linked aftermath of a redeemed V1.62 regional-aid contract.
 * This is player campaign history, not a new city faction or simulated treaty.
 */
const AID_ID=/^ct-regional-(\d+)-(\d+)-(\d+)-(food|security)$/;
const WINDOW=7;

export function recordRegionalAidOutcome({party,contract,day}={}){
  if(!party||!contract||!Number.isSafeInteger(day)||day<1)return false;
  const match=AID_ID.exec(String(contract.id||''));
  if(!match||String(contract.cityId)!==match[1]
    ||String(contract.targetCityId)!==match[2]
    ||contract.regionalAidKind!==match[4]
    ||!Array.isArray(party.completedRegionalAid)
    ||party.completedRegionalAid.includes(contract.id)===false
    ||day<Number(match[3]))return false;
  const saved=Array.isArray(party.regionalAidOutcomes)?party.regionalAidOutcomes:[];
  if(saved.some(r=>r.id===contract.id))return false;
  party.regionalAidOutcomes=[...saved,{
    id:contract.id,sourceCityId:String(contract.cityId),
    targetCityId:String(contract.targetCityId),kind:contract.regionalAidKind,day,
  }].slice(-64);
  return true;
}

export function getRegionalAidLegacy({party,cityId,day}={}){
  if(cityId==null||!Number.isSafeInteger(day)||day<1)return null;
  const claimed=Array.isArray(party?.completedRegionalAid)?party.completedRegionalAid:[];
  const records=Array.isArray(party?.regionalAidOutcomes)?party.regionalAidOutcomes:[];
  const relevant=records.filter(row=>{
    const match=AID_ID.exec(String(row?.id||''));
    return match&&claimed.includes(row.id)
      &&row.sourceCityId===match[1]&&row.targetCityId===match[2]
      &&row.kind===match[4]&&String(cityId)===row.targetCityId
      &&Number.isSafeInteger(row.day)&&row.day>=Number(match[3])
      &&row.day<=day&&day-row.day<=WINDOW;
  }).sort((a,b)=>b.day-a.day||a.id.localeCompare(b.id,'en'));
  if(!relevant.length)return null;
  const recent=relevant[0];
  return {id:recent.id,kind:recent.kind,sourceCityId:recent.sourceCityId,
    targetCityId:recent.targetCityId,day:recent.day,
    remainingDays:WINDOW-(day-recent.day),discount:10};
}
