/**
 * V1.41 — real fresh-to-warmed WEB map observations. Runs after the entire
 * pre-existing browser acceptance chain; no code/path/AI/render shortcuts.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {profileLiveWorldLoop} from './browser-world-loop-profile.mjs';
import {summarizeChromiumMetrics} from './browser-world-frame-trace.mjs';
import {assessWorldWarmupWindows} from './browser-world-warmup-core.mjs';
const arg=(flag,fallback)=>{
  const idx=process.argv.indexOf(flag);
  return idx>=0&&process.argv[idx+1]?process.argv[idx+1]:fallback;
};
const url=arg('--url','http://127.0.0.1:4173');
const seed=Number(arg('--seed','1337'));
const out=resolve(arg('--report','output/browser-smoke/warmup-profile.json'));
const KEEP_METRICS=['TaskDuration','ScriptDuration','LayoutDuration',
  'RecalcStyleDuration','JSHeapUsedSize'];
const metrics=async session=>{
  const {metrics:rows}=await session.send('Performance.getMetrics');
  return Object.fromEntries(rows.filter(x=>KEEP_METRICS.includes(x.name)
    &&Number.isFinite(x.value)).map(x=>[x.name,x.value]));
};
const advanceFrames=(page,n)=>page.evaluate(count=>new Promise(resolve=>{
  let completed=0;
  const onFrame=()=>{
    completed++;
    if(completed===count)resolve();
    else requestAnimationFrame(onFrame);
  };
  requestAnimationFrame(onFrame);
}),n);
async function mapSnapshot(page) {
  return page.evaluate(()=>{
    const game=window.game,map=game?.worldManager?.state?.mapData
      ||game?.state?.mapData;
    const p=game?.playerParty,canvas=document.getElementById('gameCanvas');
    return {
      ready:Boolean(game?.started&&game?.state?.mode==='map'
        &&game?.gameLoop?.running&&map?.terrain?.length),
      mode:game?.state?.mode||null,day:game?.state?.day??null,
      faction:p?.factionId||null,
      width:map?.width??null,height:map?.height??null,
      tiles:map?.terrain?.length??null,
      settlements:map?.settlements?.length??null,
      roads:map?.roads?.length??null,
      rivers:map?.rivers?.length??null,
      crossings:map?.crossings?.length??null,
      canvasWidth:canvas?.width??0,canvasHeight:canvas?.height??0,
      worldParties:game?.worldManager?.worldAi?.parties?.length??null,
    };
  });
}
const identity=(snapshot,seedValue)=>JSON.stringify({
  seed:seedValue,faction:snapshot.faction,
  width:snapshot.width,height:snapshot.height,tiles:snapshot.tiles,
  settlements:snapshot.settlements,roads:snapshot.roads,
  rivers:snapshot.rivers,crossings:snapshot.crossings,
  canvasWidth:snapshot.canvasWidth,canvasHeight:snapshot.canvasHeight,
});
async function sampleWindow(page,session,label,mapId) {
  const before=await mapSnapshot(page);
  const initial=await metrics(session);
  const profile=await profileLiveWorldLoop(page,32);
  const final=await metrics(session);
  const after=await mapSnapshot(page);
  const cdp=summarizeChromiumMetrics(initial,final);
  const valid=before.ready&&after.ready
    &&identity(before,seed)===mapId&&identity(after,seed)===mapId
    &&profile.ready&&profile.sampledRafFrames===32
    &&profile.rafIntervals?.samples===31
    &&Number.isFinite(profile.stats['loop.updateMap']?.meanMs)
    &&Number.isFinite(profile.stats['loop.renderMap']?.meanMs)
    &&Number.isFinite(profile.stats['sim.worldAI']?.meanMs)
    &&Number.isFinite(cdp.taskMs)&&Number.isFinite(cdp.scriptMs);
  return {
    label,valid,mapIdentity:mapId,before,after,profile,cdp,
  };
}
async function run() {
  mkdirSync(dirname(out),{recursive:true});
  const report={
    version:'V1.41',scope:'real 881-city WEB game map, one Chrome process',
    seed,requestedBackend:['--use-gl=angle','--use-angle=swiftshader'],
    windows:[],summary:null,status:'RUNNING',
    caveat:'Headless Chrome/SwiftShader; these are successive, non-frozen game-state windows, not a real GPU player benchmark.',
  };
  let browser;
  try {
    browser=await chromium.launch({
      channel:'chrome',headless:true,
      args:report.requestedBackend,timeout:30000,
    });
    const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
    page.setDefaultTimeout(120000);
    const errors=[];
    page.on('pageerror',err=>errors.push(String(err)));
    page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>Boolean(window.game?.initialized),null,{timeout:30000});
    const cards=page.locator('#factionGrid .faction-card');
    await cards.first().waitFor({state:'visible',timeout:30000});
    await page.locator('#seedInput').fill(String(seed));
    await cards.first().click();
    if(!await page.locator('#btnStart').isEnabled())throw Error('Start button disabled');
    await page.locator('#btnStart').click();
    await page.waitForFunction(()=>{
      const g=window.game,map=g?.worldManager?.state?.mapData||g?.state?.mapData;
      return Boolean(g?.started&&g?.gameLoop?.running&&g?.state?.mode==='map'
        &&map?.terrain?.length&&map?.settlements?.length&&map?.roads?.length);
    },null,{timeout:120000});
    const first=await mapSnapshot(page);
    if(!first.ready||first.width*first.height!==first.tiles
      ||first.settlements!==881||first.roads!==304)
      throw Error('Expected full generated original 881-settlement/304-road world');
    const mapId=identity(first,seed);
    // Fixed frame counts advance only through the game's natural
    // requestAnimationFrame loop. No synthetic world ticks or AI bypass.
    await advanceFrames(page,24);
    const session=await page.context().newCDPSession(page);
    try {
      await session.send('Performance.enable');
      for(const [label,preFrames] of [
        ['early',0],['middle',64],['late',96],
      ]) {
        if(preFrames)await advanceFrames(page,preFrames);
        const result=await sampleWindow(page,session,label,mapId);
        report.windows.push(result);
        console.log('[V1.41] '+JSON.stringify({
          label,valid:result.valid,day:result.before.day,
          partyCount:result.before.worldParties,
          updateMs:result.profile.stats?.['loop.updateMap']?.meanMs,
          worldAiMs:result.profile.stats?.['sim.worldAI']?.meanMs,
          renderMs:result.profile.stats?.['loop.renderMap']?.meanMs,
          rafMs:result.profile.rafIntervals?.meanMs,
          cdpScriptTotalMs:result.cdp.scriptMs,
          cdpTaskTotalMs:result.cdp.taskMs,
        }));
        if(!result.valid)
          throw Error('V1.41 incomplete real '+label+' map measurement');
      }
    } finally {await session.detach().catch(()=>{});}
    if(errors.length)throw Error('New browser errors: '+errors.slice(0,5).join('; '));
    report.summary=assessWorldWarmupWindows(report.windows);
    if(report.summary.status!=='MEASURED')
      throw Error('V1.41 incomparable windows: '+report.summary.reason);
    report.status='PASS_OBSERVATIONAL';
    console.log('[V1.41] summary='+JSON.stringify(report.summary));
  } catch(error) {
    report.status='FAIL';report.error=String(error);
    console.error('[V1.41] '+report.error);
    process.exitCode=1;
  } finally {
    writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    await browser?.close().catch(()=>{});
  }
}
await run();
