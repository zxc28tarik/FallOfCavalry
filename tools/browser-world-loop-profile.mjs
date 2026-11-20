/**
 * V1.38 — transparent, temporary instrumentation of REAL browser game-loop
 * methods. No camera changes, disabled AI, renderer skips or tuning tweaks.
 * All wrappers are restored even when an instrumented method throws.
 */
const PROFILE_WINDOW = 56;
const names = Object.freeze([
  'loop.updateMap', 'loop.renderMap',
  'sim.updateMapSimulation', 'sim.worldAI',
  'sim.updatePlayerParty', 'sim.updateTransientUI',
  'render.map', 'render.terrain', 'render.dimetricTerrain',
  'render.overlays', 'render.dimetricOverlays',
  'render.hud',
]);

export function summarizeWorldLoopMeasurements(measurements, maxSamples = PROFILE_WINDOW) {
  const keep = Number.isSafeInteger(maxSamples) && maxSamples > 0
    ? Math.min(maxSamples, 400) : PROFILE_WINDOW;
  const result = {};
  for (const [name, values] of Object.entries(measurements || {})) {
    if (!Array.isArray(values)) continue;
    const samples = values.filter(n => Number.isFinite(n) && n >= 0)
      .slice(-keep).sort((a,b) => a-b);
    const sum = samples.reduce((n,v) => n+v,0);
    const pct = p => samples.length
      ? samples[Math.floor((samples.length-1)*p)] : null;
    const round = n => n == null ? null : Math.round(n*1000)/1000;
    result[name] = {
      calls: samples.length, meanMs: round(samples.length ? sum/samples.length : null),
      p50Ms: round(pct(0.5)),p95Ms: round(pct(0.95)),
      maxMs: round(samples.length ? samples.at(-1) : null),
      totalMs: round(sum),
    };
  }
  return result;
}

export async function profileLiveWorldLoop(page, samples = PROFILE_WINDOW) {
  const count = Number.isSafeInteger(samples)
    ? Math.max(16,Math.min(160,samples)) : PROFILE_WINDOW;
  return page.evaluate(async ({count,names}) => {
    const g = window.game;
    const sim = g?.worldManager?.simManager;
    const rm = g?.renderManager;
    const loop = g?.gameLoop;
    const wm = sim?.worldPartyManager;
    if (!g?.started || g?.state?.mode !== 'map' || !sim
      || !rm || !wm || !loop?.running)
      return {ready:false,reason:'Real world loop/map not running'};
    const readings = Object.fromEntries(names.map(name=>[name,[]]));
    const restores = [];
    const wrap = (holder,key,label) => {
      const original=holder?.[key];
      if(typeof original!=='function')return false;
      holder[key]=function(...args){
        const started=performance.now();
        try{return original.apply(this,args);}
        finally{
          const elapsed=performance.now()-started;
          readings[label].push(elapsed);
          if(readings[label].length>count+8)readings[label].shift();
        }
      };
      restores.push(()=>{holder[key]=original;});
      return true;
    };
    const getSnapshot=()=>{
      const actorCount=Array.isArray(g.worldManager.worldAi?.parties)
        ? g.worldManager.worldAi.parties.length : 0;
      const render=rm.dimetricPerformance?.getTelemetry?.()||null;
      return {
        mode:g.state.mode,day:g.state.day,
        worldParties:actorCount,
        useDimetric:rm.useDimetric===true,
        averageRenderMs:Number(rm.dimetricLastFrameMs)||null,
        dimetricTelemetry:render,
        lastTerrainChunks:Number(rm.dimetricChunkBuildsThisFrame)||0,
        visibleForestCount:Number(rm.dimetricVisibleForestCount)||0,
        visibleMountainCount:Number(rm.dimetricVisibleMountainCount)||0,
      };
    };
    const before=getSnapshot();
    const wrapped = {
      update:wrap(loop.updateHandlers,'map','loop.updateMap'),
      render:wrap(loop.renderHandlers,'map','loop.renderMap'),
      sim:wrap(sim,'updateMapSimulation','sim.updateMapSimulation'),
      ai:wrap(wm,'updateWorldParties','sim.worldAI'),
      player:wrap(sim,'updatePlayerParty','sim.updatePlayerParty'),
      transientUI:wrap(sim,'updateTransientUIState','sim.updateTransientUI'),
      mapDraw:wrap(rm,'renderMap','render.map'),
      terrain:wrap(rm,'renderWorldTerrain','render.terrain'),
      dimetricTerrain:wrap(rm,'renderDimetricWorldTerrain','render.dimetricTerrain'),
      overlays:wrap(rm,'renderWorldOverlays','render.overlays'),
      dimetricOverlays:wrap(rm,'renderDimetricWorldOverlays','render.dimetricOverlays'),
      hud:wrap(g.hudManager,'update','render.hud'),
    };
    const tStart=performance.now();
    let completed=0;
    try{
      await new Promise(resolve=>{
        const frame=()=>{
          completed++;
          if(completed>=count)resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    } finally {
      // Revert in reverse order so no instrumentation persists in gameplay.
      for (const undo of restores.reverse())undo();
    }
    const after=getSnapshot();
    const values={};
    for(const [key,raw] of Object.entries(readings)){
      const sorted=raw.filter(x=>Number.isFinite(x)&&x>=0)
        .sort((a,b)=>a-b);
      const sum=sorted.reduce((s,x)=>s+x,0);
      const pick=q=>sorted.length
        ? sorted[Math.floor((sorted.length-1)*q)]:null;
      const round=x=>x==null?null:Math.round(x*1000)/1000;
      values[key]={calls:sorted.length,
        meanMs:round(sorted.length?sum/sorted.length:null),
        p50Ms:round(pick(0.5)),p95Ms:round(pick(0.95)),
        maxMs:round(sorted.length?sorted.at(-1):null),
        totalMs:round(sum)};
    }
    const mapRender=values['render.map'].meanMs ?? 0;
    const terrain=values['render.terrain'].meanMs ?? 0;
    const overlays=values['render.overlays'].meanMs ?? 0;
    const simTotal=values['sim.updateMapSimulation'].meanMs ?? 0;
    const simAI=values['sim.worldAI'].meanMs ?? 0;
    return {
      ready:true,wrapped,
      sampledRafFrames:completed,wallTimeMs:Math.round((performance.now()-tStart)*1000)/1000,
      before,after,
      stats:values,
      // Inclusive subcalls: do not add terrain+dimetricTerrain together.
      derived:{
        mapFrameDrawMs:mapRender,
        mapTerrainMs:terrain,
        mapOverlaysMs:overlays,
        mapOtherRenderMs:Math.max(0,mapRender-terrain-overlays),
        mapUpdateMs:values['loop.updateMap'].meanMs ?? 0,
        worldAISubsetMs:simAI,
        simulationOtherMs:Math.max(0,simTotal-simAI),
      },
      caveat:'Headless SwiftShader, temporary wrapper overhead, each method time is inclusive, no renderer/AI bypass',
    };
  },{count,names});
}
