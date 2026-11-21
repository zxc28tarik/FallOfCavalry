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
      const first=events.find(x=>x.player&&x.parties.length>=10
        &&x.mapSettlementCount===881&&x.roads===304);
      if(first)return {events,after,wave:first,source:'LIVE_PRE_CULL'};
      // WorldAI may initialize BEFORE the user clicks "Start" (and before
      // an observer can be installed). The 881-city map is already live:
      // invoke the UNMODIFIED, actual WorldPartyManager implementation on
      // an isolated state clone. This is NOT an observed original initial
      // wave: label it as a real-engine geography replay.
      const g=window.game,real=g.worldManager;
      const wm=real.simManager.worldPartyManager;
      const ai={parties:[],lastRespawnDay:0,lastVisibleRespawnDay:null};
      const detachedWorld={
        state:{...real.state,worldAi:ai,aiParties:[]},
        worldAi:ai,enemyParties:[],
      };
      const detachedGame=Object.create(g);
      detachedGame.worldManager=detachedWorld;
      detachedGame.enemyParties=[];
      detachedGame.getWorldAiCfgWithRegionMods=()=>
        g.getWorldAiCfgWithRegionMods?.()||{};
      detachedGame.getCurrentEvents=(...args)=>g.getCurrentEvents?.(...args)||[];
      detachedGame.getBanditCapWithEvents=(...args)=>
        g.getBanditCapWithEvents?.(...args);
      const clonedManager=Object.create(Object.getPrototypeOf(wm));
      clonedManager.init(detachedWorld,detachedGame);
      clonedManager.ensureWorldParties();
      const map=detachedWorld.state.map||{};
      const wave={
        ...after,
        width:map.width,height:map.height,tileSize:map.tileSize??32,
        mapSettlementCount:map.settlements?.length??0,
        roads:map.roads?.length??0,
        settlements:(map.settlements||[]).map(s=>({
          id:s.id,x:s.x,y:s.y,
          ownerFactionId:s.ownerFactionId??s.factionId??null,
        })),
        parties:ai.parties.map(p=>({
          id:p.id,kind:p.kind,x:p.x,y:p.y,factionId:p.factionId,
          homeCityId:p.homeCityId,routeId:p.routeId,alive:p.alive!==false,
        })),
        lastRespawnDay:ai.lastRespawnDay,
        lastVisibleRespawnDay:ai.lastVisibleRespawnDay,
      };
      return {events,after,wave,source:'REAL_ENGINE_DETACHED_REPLAY'};
    });
    const wave=snapshot.wave;
    report.captureEvents=snapshot.events.map(e=>({
      partyCount:e.parties.length,player:e.player,
      settlements:e.mapSettlementCount,roads:e.roads,
      lastRespawnDay:e.lastRespawnDay,
      lastVisibleRespawnDay:e.lastVisibleRespawnDay,
    }));
    report.snapshotSource=snapshot.source;
    report.replayCaveat=snapshot.source==='REAL_ENGINE_DETACHED_REPLAY'
      ?'Real unmodified spawner on detached state and authentic live map; generated after start, not the historical first spawn wave.'
      :'Original first party wave observed before first real map tick';
    if(!wave||wave.mapSettlementCount!==881||wave.roads!==304
      ||!wave.player||wave.parties.length<10||errors.length)
      throw Error('V1.44 no complete world party sample: '+
        JSON.stringify({source:snapshot.source,
          partyCount:wave?.parties?.length,
          cities:wave?.mapSettlementCount,roads:wave?.roads,
          events:report.captureEvents,errors:errors.slice(0,3)}));
    const radius=40; // Actual default WORLD_AI DESPAWN_DISTANCE (tiles)
    // A new campaign selects the faction start tile AFTER its initial world
    // generation; compare every original spawn with the ACTUAL final player
    // position, not an earlier constructor/menu fallback (often 320,320).
    const actualPlayer=snapshot.after.player;
    if(!actualPlayer)throw Error('Post-start real player location unavailable');
    const common=(snapshot,parties)=>({
      player:actualPlayer,settlements:snapshot.settlements,
      tileSize:snapshot.tileSize,despawnTiles:radius,parties,
    });
    const beforeProfile=inspectPartyGeography(common(wave,wave.parties));
    const afterProfile=inspectPartyGeography(common(snapshot.after,snapshot.after.parties));
    report.originalWave={
      spawnTimePlayer:wave.player,player:actualPlayer,width:wave.width,height:wave.height,
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
    // Gameplay regression: the chosen faction must start on a valid world
    // location, not the empty (0,0) corner. Noncombat local civilians must
    // survive a real 32-frame map update with real sourced home-city IDs.
    const chosen=actualPlayer.factionId;
    const owned=(snapshot.after.settlements||[]).filter(city=>
      (city.ownerFactionId===chosen)
      &&Number.isFinite(city.x)&&Number.isFinite(city.y));
    report.ownedCityCount=owned.length;
    const localExtraKinds=new Set([
      'refugee','merchant','messenger','villagers','noble',
    ]);
    const extras=snapshot.after.parties.filter(p=>localExtraKinds.has(p.kind));
    const cityById=new Map(snapshot.after.settlements.map(city=>[
      String(city.id),city,
    ]));
    const sourcedExtras=extras.filter(p=>{
      const home=cityById.get(String(p.homeCityId));
      return home&&Math.hypot(home.x-actualPlayer.x,home.y-actualPlayer.y)
        <= 40*snapshot.after.tileSize;
    });
    report.localPopulationGate={
      chosenFaction:chosen,ownedCityCount:owned.length,
      extraParties:extras.length,
      extraWithGenuineLocalCity:sourcedExtras.length,
      playerIsMapOrigin:actualPlayer.x===0&&actualPlayer.y===0,
      nearestSettlementTiles:afterProfile.nearestSettlementTiles,
    };
    if(owned.length>0 && (actualPlayer.x===0&&actualPlayer.y===0
      || afterProfile.settlementsWithinDespawn<1
      || extras.length<7 || sourcedExtras.length!==extras.length))
      throw Error('V1.44 real start/world population regression: '+
        JSON.stringify(report.localPopulationGate));
    if(!owned.length)
      throw Error('V1.44 selected faction owns no real city in the full world: '+
        chosen);
    // V1.45 — the real initial world wave must source its ten base combat,
    // patrol and caravan parties inside the authentic local region, NOT a
    // detached replay. The 3+3+4 quotas stay unchanged. Patrols may naturally
    // defeat nearby bandits; the living end-state must retain all three kinds.
    const baseKinds=['bandit','patrol','caravan'];
    const originalBase=wave.parties.filter(p=>baseKinds.includes(p.kind));
    const afterBase=snapshot.after.parties.filter(p=>baseKinds.includes(p.kind));
    const activeRadiusPx=40*snapshot.after.tileSize;
    const inside=p=>Math.hypot(
      p.x-actualPlayer.x,p.y-actualPlayer.y)<=activeRadiusPx;
    const validCity=p=>cityById.has(String(p.homeCityId));
    const quotas=Object.fromEntries(baseKinds.map(kind=>[
      kind,originalBase.filter(p=>p.kind===kind).length,
    ]));
    const surviving=Object.fromEntries(baseKinds.map(kind=>[
      kind,afterBase.filter(p=>p.kind===kind).length,
    ]));
    report.basePopulationGate={
      capturedLive:snapshot.source==='LIVE_PRE_CULL',
      originalBaseCount:originalBase.length,
      originalInsideRange:originalBase.filter(inside).length,
      originalRealCitySources:originalBase.filter(validCity).length,
      baseAfter32Frames:afterBase.length,
      afterInsideRange:afterBase.filter(inside).length,
      afterRealCitySources:afterBase.filter(validCity).length,
      originalByKind:quotas,survivorsByKind:surviving,
      routeLinkedBandits:originalBase.filter(p=>p.kind==='bandit'
        &&p.routeId!=null).length,
    };
    if(!report.basePopulationGate.capturedLive
      ||originalBase.length!==10
      ||quotas.bandit!==4||quotas.patrol!==3||quotas.caravan!==3
      ||report.basePopulationGate.originalInsideRange!==10
      ||report.basePopulationGate.originalRealCitySources!==10
      ||afterBase.length<6
      ||report.basePopulationGate.afterInsideRange!==afterBase.length
      ||report.basePopulationGate.afterRealCitySources!==afterBase.length
      ||baseKinds.some(kind=>surviving[kind]<1))
      throw Error('V1.45 real source-valid base world population failed: '+
        JSON.stringify(report.basePopulationGate));
    // V1.46: in a disposable Chromium page, move the ACTUAL production
    // game player between two real world cities. This is a controlled
    // cross-region scenario (not a claim that the player walked there).
    // Test parking, real local replenishment, quick-save restore, and same-ID
    // reactivation on the return leg. Existing V1.44/45 observations above
    // were collected before this test-specific position change.
    report.regionContinuity=await page.evaluate(()=>{
      const game=window.game,world=game.worldManager;
      const manager=world?.simManager?.worldPartyManager;
      const player=game.playerParty,home={x:player.x,y:player.y};
      const cities=world.state.map.settlements;
      const tile=world.state.map.tileSize||32;
      const target=cities.find(s=>s?.id!=null
        &&Number.isFinite(s.x)&&Number.isFinite(s.y)
        &&Math.hypot(s.x-home.x,s.y-home.y)>110*tile
        &&Math.hypot(s.x-home.x,s.y-home.y)<240*tile
        &&world.state.map.roads.some(r=>String(r.from)===String(s.id)
          ||String(r.to)===String(s.id)));
      if(!target||!manager)throw Error('No real second region or party manager');
      const initialIds=world.worldAi.parties.map(p=>p.id);
      player.x=target.x;player.y=target.y;
      manager.ensureWorldParties();
      manager.updateWorldParties(0.016);
      const afterMove=world.worldAi.parties.map(p=>p.id);
      const dormantAfterMove=world.worldAi.dormantParties?.map(p=>p.id)||[];
      const secondHasOwnCitySources=world.worldAi.parties
        .filter(p=>['bandit','patrol','caravan'].includes(p.kind))
        .every(p=>cities.some(s=>String(s.id)===String(p.homeCityId)));
      const saved=game.saveManager?.quickSave?.()===true;
      const loaded=saved&&game.saveManager?.quickLoad?.()===true;
      player.x=home.x;player.y=home.y;
      manager.ensureWorldParties();
      manager.updateWorldParties(0.016);
      const restoredIds=world.worldAi.parties.map(p=>p.id);
      const revivedInitial=initialIds.filter(id=>restoredIds.includes(id));
      return {
        targetCityId:target.id,
        targetDistanceTiles:Math.hypot(target.x-home.x,target.y-home.y)/tile,
        beforeCount:initialIds.length,
        awayCount:afterMove.length,
        dormantAfterMove:dormantAfterMove.length,
        newIdsAway:afterMove.filter(id=>!initialIds.includes(id)).length,
        secondHasOwnCitySources,
        saved,loaded,
        revivedInitial:revivedInitial.length,
        returnCount:restoredIds.length,
        dormantAfterReturn:world.worldAi.dormantParties?.length??0,
        sameDayGlobalStamp:world.worldAi.lastRespawnDay===1,
      };
    });
    if(!report.regionContinuity.saved||!report.regionContinuity.loaded
      ||report.regionContinuity.dormantAfterMove<12
      ||report.regionContinuity.newIdsAway<5
      ||!report.regionContinuity.secondHasOwnCitySources
      ||report.regionContinuity.revivedInitial<15
      ||!report.regionContinuity.sameDayGlobalStamp)
      throw Error('V1.46 regional save/return/ID regression: '+
        JSON.stringify(report.regionContinuity));
    console.log('[V1.46] '+JSON.stringify(report.regionContinuity));
    report.status='PASS_REGRESSION';
    console.log('[V1.44] '+JSON.stringify({
      status:report.status,source:report.snapshotSource,
      localPopulationGate:report.localPopulationGate,
      basePopulationGate:report.basePopulationGate,
      scene:{settlements:wave.mapSettlementCount,roads:wave.roads,
        worldSize:[wave.width,wave.height],tileSize:wave.tileSize},
      spawnTimePlayer:wave.player,actualPlayer,
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
