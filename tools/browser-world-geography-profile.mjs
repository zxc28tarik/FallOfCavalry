/**
 * V1.44 — full-world start geography audit. Capture the ORIGINAL party wave
 * before the first real map tick can despawn it, in the genuine browser game.
 * This does not create/move parties, alter time or touch player save files.
 */
import {chromium} from 'playwright';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {inspectPartyGeography} from './browser-world-geography-core.mjs';
const arg=(key,value)=>{const i=process.argv.indexOf(key);return i>=0&&process.argv[i+1]?process.argv[i+1]:value};
const url=arg('--url','http://127.0.0.1:4173');
const seed=Number(arg('--seed','1337'));
const out=resolve(arg('--report','output/browser-smoke/world-geography.json'));
async function run(){
  mkdirSync(dirname(out),{recursive:true});
  let browser;
  const report={
    version:'V1.44',status:'RUNNING',seed,
    scope:'Original real 881-city world and first party wave before first actual update',
    observed:[],afterLive:null,
  };
  try{
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
    await page.waitForFunction(()=>Boolean(window.game?.initialized
      &&window.game?.worldManager?.simManager?.worldPartyManager),null,{timeout:30000});
    await page.locator('#seedInput').fill(String(seed));
    await page.locator('#factionGrid .faction-card').first().click();
    const hooked=await page.evaluate(()=>{
      const g=window.game;
      const mgr=g?.worldManager?.simManager?.worldPartyManager;
      if(!mgr||typeof mgr.ensureWorldParties!=='function')return false;
      const original=mgr.ensureWorldParties;
      const events=[];
      const state=()=>{
        const w=mgr.world,s=w?.state,
          ai=w?.worldAi,pp=g?.playerParty,worldMap=s?.map||{};
        return {
          player:pp&&Number.isFinite(pp.x)&&Number.isFinite(pp.y)
            ?{x:pp.x,y:pp.y,factionId:pp.factionId??null}:null,
          width:worldMap.width??null,height:worldMap.height??null,
          tileSize:worldMap.tileSize??32,
          mapSettlementCount:worldMap.settlements?.length??0,
          roads:worldMap.roads?.length??0,
          settlements:(worldMap.settlements||[]).map(x=>({
            id:x.id,x:x.x,y:x.y,
            ownerFactionId:x.ownerFactionId??x.factionId??null,
          })),
          parties:(ai?.parties||[]).map(p=>({
            id:p.id,kind:p.kind,x:p.x,y:p.y,factionId:p.factionId,
            homeCityId:p.homeCityId,routeId:p.routeId,
            alive:p.alive!==false,
          })),
          lastRespawnDay:ai?.lastRespawnDay??null,
          lastVisibleRespawnDay:ai?.lastVisibleRespawnDay??null,
        };
      };
      mgr.ensureWorldParties=function(...args){
        const before=this.world?.worldAi?.parties?.length??0;
        const result=original.apply(this,args);
        const after=this.world?.worldAi?.parties?.length??0;
        if(after>before&&events.length<3)events.push(state());
        return result;
      };
      window.__v144={events,state,restore:()=>{
        mgr.ensureWorldParties=original;
      }};
      return true;
    });
    if(!hooked)throw Error('No actual pre-start world-party manager to observe');
    await page.locator('#btnStart').click();
    await page.waitForFunction(()=>{
      const g=window.game,m=g?.worldManager?.state?.mapData||g?.state?.mapData;
      return Boolean(g?.started&&g?.gameLoop?.running&&g?.state?.mode==='map'
        &&m?.settlements?.length&&m?.roads?.length);
    },null,{timeout:120000});
    // Do not pause or modify the real AI or the renderer. Let the actual loop
    // run and compare the later party population to the first spawn snapshot.
    await page.evaluate(()=>new Promise(resolve=>{
      let n=0;const next=()=>{
        if(++n>=32)resolve();
        else requestAnimationFrame(next);
      };
      requestAnimationFrame(next);
    }));
    const snapshot=await page.evaluate(()=>{
      const state=window.__v144;
      const events=state.events;
      const after=state.state();
      state.restore();
      delete window.__v144;
      return {events,after};
    });
    const wave=snapshot.events.find(x=>x.player&&x.parties.length>=10);
    if(!wave||wave.mapSettlementCount!==881||wave.roads!==304
      ||!wave.player||errors.length)throw Error('No complete original full-world start wave, errors='+
        errors.slice(0,3).join('; '));
    const radius=40; // Actual default WORLD_AI DESPAWN_DISTANCE (tiles)
    const common=(snapshot,parties)=>({
      player:snapshot.player,settlements:snapshot.settlements,
      tileSize:snapshot.tileSize,despawnTiles:radius,parties,
    });
    const beforeProfile=inspectPartyGeography(common(wave,wave.parties));
    const afterProfile=inspectPartyGeography(common(snapshot.after,snapshot.after.parties));
    report.originalWave={
      player:wave.player,width:wave.width,height:wave.height,
      settlementCount:wave.mapSettlementCount,
      roads:wave.roads,day:wave.lastRespawnDay,
      lastVisibleRespawnDay:wave.lastVisibleRespawnDay,
      geography:beforeProfile,
    };
    report.afterLive={
      worldPartyCount:snapshot.after.parties.length,
      geography:afterProfile,
      lastRespawnDay:snapshot.after.lastRespawnDay,
      lastVisibleRespawnDay:snapshot.after.lastVisibleRespawnDay,
    };
    report.captureEvents=snapshot.events.map(e=>({
      partyCount:e.parties.length,player:e.player,
      lastRespawnDay:e.lastRespawnDay,
      lastVisibleRespawnDay:e.lastVisibleRespawnDay,
    }));
    report.status='PASS_DIAGNOSTIC';
    console.log('[V1.44] '+JSON.stringify({
      status:report.status,
      scene:{settlements:wave.mapSettlementCount,roads:wave.roads,
        worldSize:[wave.width,wave.height],tileSize:wave.tileSize},
      player:wave.player,
      firstWave:beforeProfile,
      after:{
        worldPartyCount:report.afterLive.worldPartyCount,
        nearParties:afterProfile.partiesWithinDespawn,
      },
    }));
  }catch(e){
    report.status='FAIL';report.error=String(e);
    console.error('[V1.44] '+report.error);process.exitCode=1;
  }finally{
    writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    await browser?.close().catch(()=>{});
  }
}
await run();
