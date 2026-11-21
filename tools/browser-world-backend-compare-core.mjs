/**
 * V1.40: compare measured graphics backends only when the runtime GPU IDs
 * differ and the complete production world signature agrees. Pure helpers.
 */
const finite = x=>Number.isFinite(x);
const rounded = x=>finite(x)?Math.round(x*1000)/1000:null;
export const BACKEND_MODES=Object.freeze([
  {id:'forced-angle-swiftshader',args:['--use-gl=angle','--use-angle=swiftshader']},
  {id:'chrome-default',args:[]},
  {id:'requested-angle-gl',args:['--use-gl=angle','--use-angle=gl']},
]);
const nonempty = x=>typeof x==='string'&&x.trim()?x.trim():null;
export function browserGpuIdentity(info) {
  const gpu=info?.gpu||{},attrs=gpu.auxAttributes||{},
    devices=Array.isArray(gpu.devices)?gpu.devices:[];
  const primary=devices[0]||{};
  const glRenderer=nonempty(attrs.glRenderer)||nonempty(attrs.glRendererString);
  const glVendor=nonempty(attrs.glVendor);
  const deviceName=nonempty(primary.deviceString)||nonempty(primary.vendorString);
  const deviceIds=finite(primary.vendorId)&&finite(primary.deviceId)
    ? String(primary.vendorId)+':'+String(primary.deviceId):null;
  const hardwareFingerprint=glRenderer
    ? ['GL',glRenderer,glVendor||''].join('|')
    : (deviceName&&deviceIds?['DEV',deviceIds,deviceName].join('|'):null);
  return {
    known:Boolean(hardwareFingerprint),fingerprint:hardwareFingerprint,
    glRenderer,glVendor,deviceName,deviceIds,
    // Do not infer that requested Chrome flags actually selected this backend.
    softwareLikely:/swiftshader|llvmpipe|softpipe|software/i.test(
      [glRenderer,deviceName].filter(Boolean).join(' ')),
  };
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function worldSceneMatches(a,b) {
  if(!a||!b||a.started!==true||b.started!==true)return false;
  const keys=['seed','faction','mode','width','height','terrainLength',
    'settlements','roads','rivers','crossings','canvasWidth','canvasHeight',
    'firstSettlement','lastSettlement'];
  return keys.every(key=>a[key]===b[key]);
}
function swapTrace(profile) {
  return profile?.trace?.available
    ? profile.trace.topEvents?.find(x=>x.name==='SkiaOutputSurfaceImplOnGpu::SwapBuffers')||null
    : null;
}
export function compareBackendProfiles(attempts) {
  const baseline=attempts?.find(x=>x.id==='forced-angle-swiftshader');
  const candidates=(attempts||[]).filter(x=>x.id!=='forced-angle-swiftshader');
  if(!baseline||baseline.status!=='MEASURED')
    return {status:'NO_BASELINE',reason:'Forced software backend did not measure'};
  const facts=candidates.map(entry=>{
    if(entry.status!=='MEASURED')
      return {id:entry.id,status:'UNSUPPORTED',reason:entry.error||'Not measured'};
    if(!worldSceneMatches(baseline.scene,entry.scene))
      return {id:entry.id,status:'SCENE_MISMATCH',reason:'World/viewport signature differs'};
    if(!baseline.gpu?.known||!entry.gpu?.known)
      return {id:entry.id,status:'UNKNOWN_BACKEND',reason:'Chrome GPU identity unavailable'};
    if(baseline.gpu.fingerprint===entry.gpu.fingerprint)
      return {id:entry.id,status:'SAME_BACKEND',reason:'Different launch flags resolved to identical GPU identity'};
    const baseMean=baseline.profile?.rafIntervals?.meanMs;
    const candidateMean=entry.profile?.rafIntervals?.meanMs;
    if(!finite(baseMean)||!finite(candidateMean)||baseMean<=0)
      return {id:entry.id,status:'INVALID_SAMPLES',reason:'No valid rAF means'};
    return {
      id:entry.id,status:'DISTINCT_OBSERVED_BACKENDS',
      frameIntervalRatio:rounded(candidateMean/baseMean),
      deltaFrameIntervalMs:rounded(candidateMean-baseMean),
      // Inclusive native events are informative, not additive GPU compute time.
      swapBufferBaseline:swapTrace(baseline.profile),
      swapBufferCandidate:swapTrace(entry.profile),
      note:'Single CI observation only: no FPS gain/loss or player-hardware claim',
    };
  });
  const distinct=facts.filter(x=>x.status==='DISTINCT_OBSERVED_BACKENDS');
  return {
    status:distinct.length?'DISTINCT_OBSERVED_BACKENDS':'NO_VERIFIED_DISTINCT_BACKEND',
    baseline:baseline.id,candidates:facts,
    caveat:'Scene signature excludes transient AI/clock state; sequential Chrome runs, headless and instrumentation overhead mean NOT a controlled hardware-performance benchmark.',
  };
}
