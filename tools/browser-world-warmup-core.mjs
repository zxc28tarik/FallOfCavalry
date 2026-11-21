/**
 * V1.41 pure summaries of observed same-process map warmup windows.
 * Never infer graphics performance from headless CI, nor treat absent data
 * as 0ms. Inclusive subcalls MUST NOT be added.
 */
const finite=x=>Number.isFinite(x);
const round=x=>finite(x)?Math.round(x*1000)/1000:null;
export function assessWorldWarmupWindows(windows) {
  const labels=['early','middle','late'];
  if(!Array.isArray(windows)||windows.length!==3
    ||windows.some((w,i)=>w?.label!==labels[i]||w?.profile?.ready!==true))
    return {status:'INCOMPLETE',reason:'Three completed map windows required'};
  const a=windows[0],b=windows[1],c=windows[2];
  const base=a?.mapIdentity;
  if(!base||windows.some(w=>w.mapIdentity!==base
    ||w?.profile?.before?.mode!=='map'||w?.profile?.after?.mode!=='map'))
    return {status:'WORLD_MISMATCH',reason:'Not the same live map'};
  const collect=key=>windows.map(w=>w.profile?.stats?.[key]?.meanMs??null);
  const update=collect('loop.updateMap');
  const draw=collect('loop.renderMap');
  const ai=collect('sim.worldAI');
  const raf=windows.map(w=>w.profile?.rafIntervals?.meanMs??null);
  const script=windows.map(w=>w.cdp?.scriptMs??null);
  const tasks=windows.map(w=>w.cdp?.taskMs??null);
  const complete=[...update,...draw,...ai,...raf,...script,...tasks]
    .every(finite);
  if(!complete)
    return {status:'INCOMPLETE',reason:'At least one mandatory timing unavailable'};
  const ratio=(first,last)=>finite(first)&&finite(last)&&last>0
    ?round(first/last):null;
  return {
    status:'MEASURED',
    phaseLabels:labels,
    updateMeanMs:update,renderMeanMs:draw,worldAiMeanMs:ai,
    rafMeanMs:raf,cdpScriptTotalMs:script,cdpTaskTotalMs:tasks,
    earlyToLateUpdateRatio:ratio(update[0],update[2]),
    earlyToLateScriptRatio:ratio(script[0],script[2]),
    earlyToLateRafRatio:ratio(raf[0],raf[2]),
    sceneConditions:windows.map(w=>({
      label:w.label,gameDay:w.profile?.before?.day,
      partyCountBefore:w.profile?.before?.worldParties,
      partyCountAfter:w.profile?.after?.worldParties,
      measureFrameCount:w.profile?.sampledRafFrames,
    })),
    limitation:'Observational, same browser/seed only; different world-party counts or state changes can alter load. Inclusive timings overlap. CI software Chrome != player hardware.',
  };
}
