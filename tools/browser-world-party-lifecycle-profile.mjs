/**
 * V1.42 observational audit of real party creation/removal and the exact
 * 2x-per-tick ensure path. No game source or AI/quest/renderer adjustments.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {summarizePartyLifecycle} from './browser-world-party-lifecycle-core.mjs';
const arg=(flag,value)=>{
  const at=process.argv.indexOf(flag);
  return at>=0&&process.argv[at+1]?process.argv[at+1]:value;
};
const url=arg('--url','http://127.0.0.1:4173');
const out=resolve(arg('--report','output/browser-smoke/party-lifecycle-profile.json'));
const seed=Number(arg('--seed','1337'));
async function realPartyLifecycle(page,frames) {
  return page.evaluate(async count=>{
    const g=window.game,sim=g?.worldManager?.simManager;
    const wm=sim?.worldPartyManager,world=g?.worldManager;
    if(!g?.started||g?.state?.mode!=='map'||!g?.gameLoop?.running||!wm)
      return {ready:false,reason:'Actual map game loop not running'};
    const captures={};
    const restores=[];
    const ensures=[],updates=[];
    let activeEnsure=null;
    const partySnapshot=()=>{
      const ai=world?.worldAi;
      const rows=Array.isArray(ai?.parties)?ai.parties:[];
      const ids=rows.map(p=>String(p?.id??'')).filter(Boolean);
      const kinds={};
      for(const p of rows) {
        const kind=String(p?.kind??'unknown');
        kinds[kind]=(kinds[kind]||0)+1;
      }
      return {
        total:rows.length,live:rows.filter(p=>p?.alive!==false).length,
        ids,kinds,lastRespawnDay:ai?.lastRespawnDay??null,
        stateRefMatches:world?.state?.worldAi===ai,
      };
    };
    const publicSnap=s=>({
      total:s.total,live:s.live,kinds:s.kinds,
      lastRespawnDay:s.lastRespawnDay,
      stateRefMatches:s.stateRefMatches,
      // For initial diagnostic, preserve only tiny examples, not all IDs.
      exampleIds:s.ids.slice(0,5),
    });
    const countDelta=(a,b)=>{
      const previous=new Set(a.ids);
      return new Set(b.ids.filter(id=>!previous.has(id))).size;
    };
    const removed=(a,b)=>{
      const current=new Set(b.ids);
      return new Set(a.ids.filter(id=>!current.has(id))).size;
    };
    const wrap=(holder,key,label,{before,after}={})=>{
      const original=holder?.[key];
      if(typeof original!=='function')return;
      const rows=captures[label]=[];
      holder[key]=function(...params){
        const entered=performance.now();
        const meta=before?.();
        try{return original.apply(this,params);}
        finally{
          const elapsed=performance.now()-entered;
          rows.push(elapsed);
          after?.(meta,elapsed,entered);
        }
      };
      restores.push(()=>{holder[key]=original;});
    };
    // The first quest callback begins immediately AFTER the imported base
    // ensure call: this boundary isolates its inclusive base-phase duration.
    wrap(wm,'ensureWorldParties','ensure',{
      before:()=>{
        const stamp=performance.now();
        const evt={before:partySnapshot(),start:stamp};
        activeEnsure=evt;
        return evt;
      },
      after:(evt,ms)=>{
        evt.afterEnsure=partySnapshot();
        evt.createdIds=countDelta(evt.before,evt.afterEnsure);
        evt.removedIds=removed(evt.before,evt.afterEnsure);
        evt.elapsedMs=ms;
        delete evt.start;
        ensures.push(evt);
        activeEnsure=null;
      },
    });
    wrap(wm,'getWorldAiCfg','getWorldAiCfg');
    wrap(g.economyManager,'ensureTradeRoutes','ensureTradeRoutes');
    wrap(g,'getCurrentEvents','getCurrentEvents');
    wrap(g,'getBanditCapWithEvents','getBanditCapWithEvents');
    wrap(wm,'ensureActiveQuestRouteThreats','routeThreat',{
      before:()=>{
        if(activeEnsure&&!activeEnsure.afterBase) {
          activeEnsure.afterBase=partySnapshot();
          activeEnsure.basePhaseMs=performance.now()-activeEnsure.start;
          activeEnsure.baseCreatedIds=countDelta(
            activeEnsure.before,activeEnsure.afterBase);
          activeEnsure.baseRemovedIds=removed(
            activeEnsure.before,activeEnsure.afterBase);
        }
      },
    });
    wrap(wm,'ensureActiveQuestCaravans','questCaravans');
    wrap(wm,'syncVisiblePartiesToWorld','syncVisible');
    wrap(wm,'processQuestRouteRecon','routeRecon');
    wrap(wm,'processQuestEscortCaravans','escortTicks');
    wrap(wm,'updateWorldParties','worldPartyUpdate',{
      before:()=>({snapshot:partySnapshot(),time:performance.now()}),
      after:(meta,ms)=>{
        const after=partySnapshot();
        updates.push({
          before:publicSnap(meta.snapshot),after:publicSnap(after),
          removedIds:removed(meta.snapshot,after),
          createdIds:countDelta(meta.snapshot,after),
          elapsedMs:ms,
        });
      },
    });
    wrap(sim,'updateMapSimulation','mapSimulation');
    const modeBefore=g.state.mode;
    const start=partySnapshot();
    const intervals=[];
    let currentFrame=0,previous=null;
    const started=performance.now();
    try {
      await new Promise(resolve=>{
        const cb=t=>{
          if(Number.isFinite(previous)&&t>previous)intervals.push(t-previous);
          previous=t;
          currentFrame++;
          if(currentFrame>=count)resolve();
          else requestAnimationFrame(cb);
        };
        requestAnimationFrame(cb);
      });
    } finally {
      for(const restore of restores.reverse())restore();
    }
    const ending=partySnapshot();
    const round=x=>Math.round(x*1000)/1000;
    return {
      ready:true,frameCount:currentFrame,modeBefore,
      modeAfter:g.state.mode,
      msElapsed:round(performance.now()-started),
      rafIntervals:intervals.map(round),
      initial:publicSnap(start),endpoint:publicSnap(ending),
      ensures:ensures.map(e=>({
        before:publicSnap(e.before),
        afterBase:e.afterBase?publicSnap(e.afterBase):null,
        afterEnsure:publicSnap(e.afterEnsure),
        elapsedMs:round(e.elapsedMs),
        basePhaseMs:round(e.basePhaseMs??NaN),
        baseCreatedIds:e.baseCreatedIds??null,
        baseRemovedIds:e.baseRemovedIds??null,
        createdIds:e.createdIds,removedIds:e.removedIds,
      })),
      updates,
      timings:{
        ...captures,
        basePhase:ensures.map(x=>x.basePhaseMs).filter(Number.isFinite),
      },
    };
  },frames);
}
async function run() {
  mkdirSync(dirname(out),{recursive:true});
  const report={
    version:'V1.42',seed,url,
    status:'RUNNING',sourceModified:false,
    scope:'Real full-world game, 32 rAF frames, instrumented party lifecycle',
  };
  let browser;
  try {
    browser=await chromium.launch({
      channel:'chrome',headless:true,timeout:30000,
      args:['--use-gl=angle','--use-angle=swiftshader'],
    });
    const page=await browser.newPage({
      viewport:{width:1366,height:768},deviceScaleFactor:1,
    });
    page.setDefaultTimeout(120000);
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>Boolean(window.game?.initialized),null,{timeout:30000});
    const cards=page.locator('#factionGrid .faction-card');
    await cards.first().waitFor({state:'visible',timeout:30000});
    await page.locator('#seedInput').fill(String(seed));
    await cards.first().click();
    if(!await page.locator('#btnStart').isEnabled())
      throw Error('Start button not enabled');
    await page.locator('#btnStart').click();
    await page.waitForFunction(()=>{
      const g=window.game,m=g?.worldManager?.state?.mapData||g?.state?.mapData;
      return Boolean(g?.started&&g?.state?.mode==='map'
        &&g?.gameLoop?.running&&m?.terrain?.length
        &&m?.settlements?.length&&m?.roads?.length);
    },null,{timeout:120000});
    const scene=await page.evaluate(()=>{
      const g=window.game,m=g?.worldManager?.state?.mapData||g?.state?.mapData;
      return {
        width:m?.width,height:m?.height,tiles:m?.terrain?.length,
        settlements:m?.settlements?.length,roads:m?.roads?.length,
        day:g.state.day,mode:g.state.mode,
      };
    });
    report.scene=scene;
    if(scene.width*scene.height!==scene.tiles||scene.settlements!==881
      ||scene.roads!==304)
      throw Error('V1.42 requires real 881-settlement world');
    await page.evaluate(()=>new Promise(resolve=>{
      let i=0;const next=()=>{if(++i>=24)resolve();else requestAnimationFrame(next);};
      requestAnimationFrame(next);
    }));
    report.raw=await realPartyLifecycle(page,32);
    report.summary=summarizePartyLifecycle(report.raw);
    if(!report.raw.ready||report.summary.status!=='MEASURED'
      ||report.raw.rafIntervals.length!==31||errors.length)
      throw Error('V1.42 incomplete real lifecycle: '+
        JSON.stringify({reason:report.summary.reason,errors}));
    report.status='PASS_DIAGNOSTIC';
    const keySummary={
      ensureCalls:report.summary.ensureCalls,
      updateCalls:report.summary.updateCalls,
      extraEnsureCalls:report.summary.extraEnsureCalls,
      baseCreated:report.summary.basePhaseCreatedIds,
      updateRemoved:report.summary.updateRemovedIds,
      partyBefore:report.raw.initial,partyAfter:report.raw.endpoint,
      timings:report.summary.timing,
      firstEnsures:report.raw.ensures.slice(0,4),
      firstUpdates:report.raw.updates.slice(0,2),
    };
    console.log('[V1.42] '+JSON.stringify(keySummary));
  } catch(e) {
    report.status='FAIL';report.error=String(e);
    console.error('[V1.42] '+report.error);
    process.exitCode=1;
  } finally {
    writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    await browser?.close().catch(()=>{});
  }
}
await run();
