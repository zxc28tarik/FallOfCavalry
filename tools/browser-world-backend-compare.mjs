// V1.40 — separate real Chrome processes, same existing 881-city full-world
// game, unchanged source/AI/rendering. Runs after the canonical browser smoke.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {profileChromiumWorldFrames} from './browser-world-frame-trace.mjs';
import {BACKEND_MODES,browserGpuIdentity,compareBackendProfiles}
  from './browser-world-backend-compare-core.mjs';

const arg=(flag,def)=>{
  const i=process.argv.indexOf(flag);
  return i>=0&&process.argv[i+1]?process.argv[i+1]:def;
};
const url=arg('--url','http://127.0.0.1:4173');
const output=resolve(arg('--report','output/browser-smoke/backend-compare.json'));
const seed=Number(arg('--seed','1337'));
const round=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;
const pauseFrames=(page,count)=>page.evaluate(frames=>new Promise(resolve=>{
  let seen=0;
  const tick=()=>{if(++seen>=frames)resolve();else requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
}),count);

async function sceneSnapshot(page) {
  return page.evaluate((s)=>{
    const g=window.game;
    const map=g?.worldManager?.state?.mapData||g?.state?.mapData;
    const p=g?.playerParty;
    const canvas=document.getElementById('gameCanvas');
    const settlements=map?.settlements||[];
    const tag=x=>x==null?null:String(x.id??x.name??'');
    return {
      started:Boolean(g?.started),seed:s,
      faction:p?.factionId??null,mode:g?.state?.mode??null,
      width:map?.width??0,height:map?.height??0,
      terrainLength:map?.terrain?.length??0,
      settlements:settlements.length,roads:map?.roads?.length??0,
      rivers:map?.rivers?.length??0,
      crossings:map?.crossings?.length??0,
      canvasWidth:canvas?.width??0,canvasHeight:canvas?.height??0,
      firstSettlement:tag(settlements[0]),lastSettlement:tag(settlements.at(-1)),
      day:g?.state?.day??null,
      playerPosition:{
        x:Number.isFinite(p?.x)?Math.round(p.x*100)/100:null,
        y:Number.isFinite(p?.y)?Math.round(p.y*100)/100:null,
      },
    };
  },seed);
}
async function gpuReport(browser) {
  const session=await browser.newBrowserCDPSession();
  try {
    const [gpuResult,versionResult]=await Promise.allSettled([
      session.send('SystemInfo.getInfo'),
      session.send('Browser.getVersion'),
    ]);
    return {
      gpu:gpuResult.status==='fulfilled'
        ? browserGpuIdentity(gpuResult.value)
        : browserGpuIdentity(null),
      gpuSource:gpuResult.status==='fulfilled'?'SystemInfo.getInfo':'UNAVAILABLE',
      gpuError:gpuResult.status==='rejected'?String(gpuResult.reason).slice(0,300):null,
      chromeVersion:versionResult.status==='fulfilled'
        ? versionResult.value.product:null,
    };
  } finally {await session.detach().catch(()=>{});}
}
async function runBackend(mode) {
  const entry={id:mode.id,requestedFlags:[...mode.args],status:'STARTING'};
  let browser=null;
  try {
    browser=await chromium.launch({
      channel:'chrome',headless:true,timeout:30000,args:mode.args,
    });
    const version=await gpuReport(browser);
    entry.gpu=version.gpu;
    entry.gpuSource=version.gpuSource;
    entry.gpuError=version.gpuError;
    entry.chromeVersion=version.chromeVersion;
    const page=await browser.newPage({
      viewport:{width:1366,height:768},deviceScaleFactor:1,
    });
    page.setDefaultTimeout(120000);
    const errors=[];
    page.on('pageerror',err=>errors.push('page:'+String(err)));
    page.on('console',msg=>{
      if(msg.type()==='error')errors.push('console:'+msg.text());
    });
    const origin=new URL(url).origin;
    page.on('response',response=>{
      if(response.status()>=400&&new URL(response.url()).origin===origin
        &&!response.url().endsWith('/favicon.ico'))
        errors.push('http:'+response.status()+':'+response.url());
    });
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>Boolean(window.game?.initialized),
      null,{timeout:30000});
    const cards=page.locator('#factionGrid .faction-card');
    await cards.first().waitFor({state:'visible',timeout:30000});
    await page.locator('#seedInput').fill(String(seed));
    await cards.first().click();
    if(!await page.locator('#btnStart').isEnabled())
      throw new Error('Game start button disabled');
    await page.locator('#btnStart').click();
    await page.waitForFunction(()=>{
      const g=window.game;
      const map=g?.worldManager?.state?.mapData||g?.state?.mapData;
      return Boolean(g?.started && g?.state?.mode==='map'
        && g?.gameLoop?.running&&map?.terrain?.length
        &&map?.settlements?.length&&map?.roads?.length);
    },null,{timeout:120000});
    // Warm a consistent number of actual game frames rather than freeze
    // WorldSimManager/AI or advance synthetic clock ticks.
    await pauseFrames(page,24);
    const scene=await sceneSnapshot(page);
    if(scene.width*scene.height!==scene.terrainLength||!scene.canvasWidth
      ||scene.settlements<1||scene.roads<1)
      throw new Error('Generated full-world scene failed real-map invariant');
    const profile=await profileChromiumWorldFrames(page,{samples:32});
    const after=await sceneSnapshot(page);
    if(!profile.ready||profile.frameCount!==32
      ||profile.rafIntervals.samples!==31
      ||!Number.isFinite(profile.rafIntervals.meanMs)
      ||!Number.isFinite(profile.cdpMetrics?.deltas?.taskMs)
      ||after.mode!=='map'
      ||errors.length)
      throw new Error('Real Chrome diagnostic incomplete: '+JSON.stringify({
        ready:profile.ready,frames:profile.frameCount,
        intervalSamples:profile.rafIntervals.samples,
        taskMs:profile.cdpMetrics?.deltas?.taskMs,
        mode:after.mode,errors:errors.slice(0,4),
      }));
    entry.status='MEASURED';
    entry.scene=scene;
    entry.after={
      day:after.day,playerPosition:after.playerPosition,mode:after.mode,
    };
    entry.profile=profile;
    entry.consoleErrors=errors;
    const swap=profile.trace?.topEvents?.find(x=>
      x.name==='SkiaOutputSurfaceImplOnGpu::SwapBuffers');
    console.log('[V1.40] '+JSON.stringify({
      id:entry.id,status:entry.status,
      renderer:entry.gpu?.glRenderer||entry.gpu?.deviceName||'UNKNOWN',
      meanRafMs:profile.rafIntervals.meanMs,
      taskMs:profile.cdpMetrics.deltas.taskMs,
      swapBufferInclusiveMs:swap?.inclusiveTotalMs??null,
      traceAvailable:profile.trace?.available===true,
      settlements:scene.settlements,roads:scene.roads,
    }));
  } catch(error) {
    entry.status='UNSUPPORTED_OR_FAILED';
    entry.error=String(error).slice(0,1000);
    console.log('[V1.40] '+JSON.stringify({
      id:entry.id,status:entry.status,error:entry.error,
    }));
  } finally {
    await browser?.close().catch(()=>{});
  }
  return entry;
}
async function main() {
  mkdirSync(dirname(output),{recursive:true});
  const report={
    version:'web-v1.40-chromium-backend-compare',
    scope:'same authentic full-game map, independent browser processes',
    environment:'CI headless Chrome — NOT Windows gaming GPU',
    seed,url,worldUnchanged:true,gameplayCodeUnchanged:true,
    attemptedModes:BACKEND_MODES,
    attempts:[],comparison:null,status:'RUNNING',
  };
  try {
    for(const mode of BACKEND_MODES) {
      report.attempts.push(await runBackend(mode));
    }
    report.comparison=compareBackendProfiles(report.attempts);
    const baseline=report.attempts[0];
    if(baseline.status!=='MEASURED')
      throw new Error('Mandatory real SwiftShader baseline failed: '+baseline.error);
    report.status=report.comparison.status==='DISTINCT_OBSERVED_BACKENDS'
      ? 'PASS_DISTINCT_DIAGNOSTIC'
      : 'PASS_NO_VERIFIED_DISTINCT_BACKEND';
    console.log('[V1.40] comparison='+JSON.stringify(report.comparison));
  } catch(error) {
    report.status='FAIL';
    report.error=String(error);
    console.error('[V1.40] '+report.error);
    process.exitCode=1;
  } finally {
    writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  }
}
await main();
