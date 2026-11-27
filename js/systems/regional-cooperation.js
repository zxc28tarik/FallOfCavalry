/**
 * V1.64 — bounded cooperation between two EXISTING named people in the two
 * REAL settlements following a redeemed regional aid + recovery chain.
 * This is a civic trade contact, not an invented guild or legal organization.
 */
import {getSettlementCharacters,setWorldCharacterRelation} from './world-characters.js';
const REGIONAL=/^ct-regional-(\d+)-(\d+)-(\d+)-(food|security)$/;
const WINDOW=10;
const acceptable=['merchant','artisan'];

const validPeople=(roster,cityId)=>getSettlementCharacters(roster,cityId)
  .filter(p=>p.kind==='named'&&p.status==='alive'&&acceptable.includes(p.role))
  .sort((a,b)=>(a.role==='merchant'?0:1)-(b.role==='merchant'?0:1)
    ||a.id.localeCompare(b.id,'en'));

export function recordRegionalCooperation({party,roster,contract,map,day}={}){
  if(!party||!roster||!contract||!Number.isSafeInteger(day)||day<1)return null;
  const aid=REGIONAL.exec(String(contract.sourceAidId||''));
  if(!aid||contract.id!==`ct-regional-recovery-${contract.sourceAidId}`
    ||String(contract.cityId)!==aid[2]||String(contract.sourceCityId)!==aid[1]
    ||String(contract.regionalRecoveryKind)!==aid[4]
    ||!party.completedRegionalAid?.includes(contract.sourceAidId)
    ||!party.completedRegionalRecovery?.includes(contract.id))return null;
  if(!Array.isArray(map?.settlements)||!map.settlements.some(x=>String(x.id)===aid[1])
    ||!map.settlements.some(x=>String(x.id)===aid[2]))return null;
  const existing=Array.isArray(party.regionalCooperation)?party.regionalCooperation:[];
  if(existing.some(x=>x.sourceRecoveryId===contract.id))return null;
  const first=validPeople(roster,aid[1])[0];
  const second=validPeople(roster,aid[2])[0];
  if(!first||!second||first.id===second.id)return null;
  const relation=(roster.relations||[]).find(r=>
    [r.firstId,r.secondId].includes(first.id)&&[r.firstId,r.secondId].includes(second.id));
  const before=Number(relation?.value??0);
  const after=Math.min(100,Math.max(-100,Math.round(before)+10));
  if(!setWorldCharacterRelation(roster,first.id,second.id,after))return null;
  const record={sourceRecoveryId:contract.id,sourceAidId:contract.sourceAidId,
    sourceCityId:aid[1],targetCityId:aid[2],characterIds:[first.id,second.id],
    day,kind:aid[4]};
  party.regionalCooperation=[...existing,record].slice(-64);
  return {record,before,after};
}

export function getRegionalCooperation({party,roster,cityId,day}={}){
  if(cityId==null||!Number.isSafeInteger(day)||day<1)return null;
  const rows=Array.isArray(party?.regionalCooperation)?party.regionalCooperation:[];
  const eligible=rows.filter(row=>{
    if(!row||!REGIONAL.test(String(row.sourceAidId||''))||!Number.isSafeInteger(row.day)
      ||day<row.day||day-row.day>WINDOW
      ||!party?.completedRegionalRecovery?.includes(row.sourceRecoveryId)
      ||!party?.completedRegionalAid?.includes(row.sourceAidId)
      ||row.sourceRecoveryId!==`ct-regional-recovery-${row.sourceAidId}`
      ||!Array.isArray(row.characterIds)||row.characterIds.length!==2
      ||!['merchant','artisan'].some(role=>roster?.characters?.some(p=>p.role===role
        &&row.characterIds.includes(p.id))))return false;
    const aid=REGIONAL.exec(row.sourceAidId);
    if(row.sourceCityId!==aid[1]||row.targetCityId!==aid[2]
      ||(String(cityId)!==aid[1]&&String(cityId)!==aid[2]))return false;
    const pair=row.characterIds.map((id,index)=>roster?.characters?.find(p=>
      p.id===id&&p.kind==='named'&&p.status==='alive'
      &&String(p.location?.settlementId)===(index===0?aid[1]:aid[2])
      &&acceptable.includes(p.role)));
    if(pair.some(p=>!p))return false;
    const rel=(roster.relations||[]).find(r=>
      [r.firstId,r.secondId].includes(pair[0].id)
      &&[r.firstId,r.secondId].includes(pair[1].id));
    return Number(rel?.value??-100)>=0;
  }).sort((a,b)=>b.day-a.day||a.sourceRecoveryId.localeCompare(b.sourceRecoveryId,'en'));
  if(!eligible.length)return null;
  const record=eligible[0];
  return {...record,remainingDays:WINDOW-(day-record.day),sellBonusPct:3};
}
