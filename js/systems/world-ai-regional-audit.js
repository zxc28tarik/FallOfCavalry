/**
 * WEB V1.47: read-only diagnostics for regional-stream storage growth.
 * This module neither prunes persistent parties nor changes spawn policy.
 * Use measured trends before considering any save format or aging changes.
 */
const validId=p=>p?.id!=null&&String(p.id).length>0;
const bytes=text=>{
  let total=0;
  for(const character of text){
    const cp=character.codePointAt(0);
    total+=cp<=0x7f?1:cp<=0x7ff?2:cp<=0xffff?3:4;
  }
  return total;
};
const unique=(rows)=>new Set(rows.filter(validId).map(p=>String(p.id)));
const safeArray=rows=>Array.isArray(rows)?rows:[];

export function auditWorldAiRegionalStorage(aiState={}) {
  const active=safeArray(aiState?.parties);
  const dormant=safeArray(aiState?.dormantParties);
  const regions=safeArray(aiState?.regionHistory);
  const activeIds=unique(active),dormantIds=unique(dormant);
  const duplicateActive=active.filter(validId).length-activeIds.size;
  const duplicateDormant=dormant.filter(validId).length-dormantIds.size;
  const overlap=[...activeIds].filter(id=>dormantIds.has(id));
  const invalid=active.concat(dormant).filter(p=>!validId(p));
  const serialized={parties:active,dormantParties:dormant,regionHistory:regions};
  let snapshotBytes=null,serializationError=null;
  try {snapshotBytes=bytes(JSON.stringify(serialized));}
  catch(error){serializationError=String(error?.message||error);}
  return {
    status:invalid.length||duplicateActive||duplicateDormant||overlap.length
      ||serializationError?'INVALID':'MEASURED',
    activeCount:active.length,dormantCount:dormant.length,
    regionStampCount:regions.length,
    uniquePartyIds:new Set([...activeIds,...dormantIds]).size,
    duplicateActive,duplicateDormant,overlapCount:overlap.length,
    invalidIdCount:invalid.length,snapshotBytes,serializationError,
    note:'Subset JSON UTF-8 size, not compressed disk-save size or heap usage; no eviction or aging applied.',
  };
}
