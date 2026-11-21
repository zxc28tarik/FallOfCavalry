/**
 * V1.42: pure, conservative diagnostics for authentic world-party lifecycle.
 * Captures counts, not economy/quest IDs or sensitive identities.
 */
const valid=x=>Number.isFinite(x)&&x>=0;
const round=x=>Number.isFinite(x)?Math.round(x*1000)/1000:null;
const aggregate=n=>{
  const a=(n||[]).filter(valid).sort((a,b)=>a-b),sum=a.reduce((x,y)=>x+y,0);
  return {
    calls:a.length,totalMs:round(sum),meanMs:a.length?round(sum/a.length):null,
    p95Ms:a.length?round(a[Math.floor((a.length-1)*0.95)]):null,
    maxMs:a.length?round(a.at(-1)):null,
  };
};
export function summarizePartyLifecycle(raw={}) {
  const frames=raw.frameCount||0,ensures=raw.ensures||[],updates=raw.updates||[];
  if(!Number.isSafeInteger(frames)||frames<16||ensures.length<frames
    ||updates.length<frames||raw.modeBefore!=='map'||raw.modeAfter!=='map')
    return {status:'INCOMPLETE',reason:'Real frames, world map and update lifecycle missing'};
  const groups={};
  for(const [key,rows] of Object.entries(raw.timings||{}))
    groups[key]=aggregate(rows);
  const phaseOrder=['before','afterBase','afterEnsure'];
  const counts=Object.fromEntries(phaseOrder.map(k=>[k,
    ensures.map(x=>x[k]?.total??null)]));
  if(counts.afterBase.some(n=>!valid(n))||counts.afterEnsure.some(n=>!valid(n)))
    return {status:'INCOMPLETE',reason:'Cannot observe base/ensure party boundary'};
  const safeSum=(rows,key)=>rows.reduce((s,row)=>s+(valid(row?.[key])?row[key]:0),0);
  return {
    status:'MEASURED',frames,ensureCalls:ensures.length,updateCalls:updates.length,
    extraEnsureCalls:Math.max(0,ensures.length-updates.length),
    timing:groups,
    partyCounts:{
      before:aggregate(counts.before.filter(valid)),
      afterBase:aggregate(counts.afterBase),
      afterEnsure:aggregate(counts.afterEnsure),
    },
    ensuredCreatedIds:safeSum(ensures,'createdIds'),
    updateRemovedIds:safeSum(updates,'removedIds'),
    basePhaseCreatedIds:safeSum(ensures,'baseCreatedIds'),
    basePhaseRemovedIds:safeSum(ensures,'baseRemovedIds'),
    endpoint:raw.endpoint??null,
    caveat:'Subcall durations inclusive; identity/count snapshots add overhead and cannot establish uninstrumented user FPS. New/removed IDs per phase are observations, not reasons for deletion.',
  };
}
