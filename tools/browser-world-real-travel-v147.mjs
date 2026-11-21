/**
 * WEB V1.47b/c: actual gameplay movement stress gate. Never assigns player.x/y.
 * Uses canonical player destination + simulation movement on walkable tile
 * centers and leaves real NPC streaming, save and encounters untouched.
 */
import {chromium} from 'playwright';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>=0&&process.argv[i+1]?process.argv[i+1]:d;};
const url=arg('--url','http://127.0.0.1:4173');
const output=resolve(arg('--report','output/browser-smoke/world-v147-travel.json'));
const seed=Number(arg('--seed','1337'));
const report={version:'V1.47c',seed,status:'RUNNING',method:'native destination + updatePlayerParty; no player position assignment'};
let browser;
try{
  mkdirSync(dirname(output),{recursive:true});
  browser=await chromium.launch({channel:'chrome',headless:true,timeout:30000,
    args:['--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  page.setDefaultTimeout(120000);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(window.game?.initialized),null,{timeout:30000});
  await page.locator('#seedInput').fill(String(seed));
  await page.locator('#factionGrid .faction-card').first().click();
  await page.locator('#btnStart').click();
  await page.waitForFunction(()=>Boolean(window.game?.started
    &&window.game?.state?.mode==='map'
    &&window.game?.worldManager?.state?.map?.settlements?.length>100),null,{timeout:120000});

  report.travel=await page.evaluate(()=>{
    const g=window.game,w=g.worldManager,sim=w.simManager,pp=g.playerParty;
    const tile=Number(w.state.map.tileSize||32),start={x:pp.x,y:pp.y};
    const width=Number(w.state.map.width||0),height=Number(w.state.map.height||0);
    const valid=(tx,ty)=>tx>=0&&ty>=0&&tx<width&&ty<height;
    const coord=(tx,ty)=>({x:(tx+0.5)*tile,y:(ty+0.5)*tile});
    const origin={tx:Math.floor(pp.x/tile),ty:Math.floor(pp.y/tile)};
    const key=(tx,ty)=>tx+':'+ty;
    const queue=[{...origin,parent:-1}];
    const seen=new Set([key(origin.tx,origin.ty)]);
    let end=-1;
    // Breadth-first walkability path; never synthesize terrain or roads.
    for(let cursor=0;cursor<queue.length&&queue.length<45000;cursor++){
      const current=queue[cursor];
      const far=Math.hypot(current.tx-origin.tx,current.ty-origin.ty);
      if(far>=112){end=cursor;break;}
      for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
        const tx=current.tx+dx,ty=current.ty+dy,id=key(tx,ty);
        if(!valid(tx,ty)||seen.has(id))continue;
        seen.add(id);
        const point=coord(tx,ty);
        if(w.getMovementContextAt(point.x,point.y)?.blocked)continue;
        queue.push({tx,ty,parent:cursor});
      }
    }
    if(end<0)return {status:'NO_AUTHENTIC_112_TILE_ROUTE',searched:queue.length};
    const route=[];
    for(let i=end;i>=0;i=queue[i].parent)route.push(queue[i]);
    route.reverse();
    let distance=0,blocked=0,steps=0,regions=0,maxDormant=0,maxBytes=0;
    const anchors=new Set();
    const firstIds=new Set((w.worldAi.parties||[]).map(x=>String(x.id)));
    const saveBytes=()=>JSON.stringify(g.saveManager?.buildSavePayload?.()||{}).length;
    const beforeBytes=saveBytes();
    let previous={x:pp.x,y:pp.y};
    for(let i=1;i<route.length;i++){
      const point=coord(route[i].tx,route[i].ty);
      if(!w.setPlayerDestination(point.x,point.y)){blocked++;break;}
      let reached=false;
      for(let j=0;j<40;j++){
        sim.updatePlayerParty(0.12);
        const now={x:pp.x,y:pp.y};
        distance+=Math.hypot(now.x-previous.x,now.y-previous.y)/tile;
        previous=now;
        steps++;
        if(!pp.hasDestination){reached=pp.moveState==='arrived';break;}
      }
      if(!reached){blocked++;break;}
      // Use genuine production streaming entrypoints, not direct state writes.
      const manager=sim.worldPartyManager;
      manager.ensureWorldParties();
      manager.updateWorldParties(0.12);
      const anchor=w.worldAi.regionAnchor;
      if(anchor)anchors.add(Math.round(anchor.x/tile)+':'+Math.round(anchor.y/tile));
      regions=anchors.size;
      maxDormant=Math.max(maxDormant,w.worldAi.dormantParties?.length||0);
      if(i%25===0)maxBytes=Math.max(maxBytes,saveBytes());
    }
    const afterBytes=saveBytes();
    const savedIds=new Set([
      ...(w.worldAi.parties||[]),...(w.worldAi.dormantParties||[]),
    ].map(p=>String(p.id)));
    const savedCargo=new Map([
      ...(w.worldAi.parties||[]),...(w.worldAi.dormantParties||[]),
    ].map(p=>[String(p.id),JSON.stringify(p.cargo??null)]));
    const quickSaved=g.saveManager?.quickSave?.()===true;
    const quickLoaded=quickSaved&&g.saveManager?.quickLoad?.()===true;
    const loadedParties=[
      ...(w.worldAi.parties||[]),...(w.worldAi.dormantParties||[]),
    ];
    const loadedIds=new Set(loadedParties.map(p=>String(p.id)));
    const identityAfterLoad=[...savedIds].every(id=>loadedIds.has(id));
    const cargoAfterLoad=loadedParties.every(p=>savedCargo.has(String(p.id))
      &&savedCargo.get(String(p.id))===JSON.stringify(p.cargo??null));
    let returnDistance=0,returnBlocked=0;
    let returnPrev={x:pp.x,y:pp.y};
    for(let i=route.length-2;i>=0;i--){
      const point=coord(route[i].tx,route[i].ty);
      if(!w.setPlayerDestination(point.x,point.y)){returnBlocked++;break;}
      let reached=false;
      for(let j=0;j<40;j++){
        sim.updatePlayerParty(0.12);
        const now={x:pp.x,y:pp.y};
        returnDistance+=Math.hypot(now.x-returnPrev.x,now.y-returnPrev.y)/tile;
        returnPrev=now;
        if(!pp.hasDestination){reached=pp.moveState==='arrived';break;}
      }
      if(!reached){returnBlocked++;break;}
      sim.worldPartyManager.ensureWorldParties();
      sim.worldPartyManager.updateWorldParties(0.12);
    }
    const finalParties=[
      ...(w.worldAi.parties||[]),...(w.worldAi.dormantParties||[]),
    ];
    const finalIds=new Set(finalParties.map(p=>String(p.id)));
    const restoredInitial=[...firstIds].filter(id=>finalIds.has(id)).length;
    const finalCargoIntact=finalParties.filter(p=>savedCargo.has(String(p.id)))
      .every(p=>savedCargo.get(String(p.id))===JSON.stringify(p.cargo??null));
    const active=new Set((w.worldAi.parties||[]).map(x=>String(x.id)));
    const dormant=new Set((w.worldAi.dormantParties||[]).map(x=>String(x.id)));
    const retained=[...firstIds].filter(id=>active.has(id)||dormant.has(id)).length;
    return {
      status:'MEASURED',routeLengthTiles:route.length-1,
      netTiles:Math.hypot(pp.x-start.x,pp.y-start.y)/tile,
      actualDistanceTiles:distance,steps,blocked,
      regionAnchors:regions,dormantCount:w.worldAi.dormantParties?.length||0,
      maxDormant,quickSaved,quickLoaded,identityAfterLoad,cargoAfterLoad,
      returnDistanceTiles:returnDistance,returnBlocked,
      restoredInitial,finalCargoIntact,
      savePayloadJsonCharsAfterReturn:saveBytes(),
      savePayloadJsonCharsBefore:beforeBytes,
      savePayloadJsonCharsAfter:afterBytes,maxSampledSaveChars:maxBytes,
      initialPartyIds:firstIds.size,initialIdsStillActiveOrDormant:retained,
      caveat:'Synchronous native movement stepping, not real-time hours played, not actual JS heap bytes',
    };
  });
  report.consoleErrors=errors;
  if(report.travel.status!=='MEASURED'
    ||report.travel.actualDistanceTiles<100
    ||report.travel.netTiles<100
    ||report.travel.blocked!==0
    ||report.travel.regionAnchors<2
    ||!report.travel.quickSaved||!report.travel.quickLoaded
    ||!report.travel.identityAfterLoad||!report.travel.cargoAfterLoad
    ||report.travel.returnDistanceTiles<100||report.travel.returnBlocked!==0
    ||report.travel.restoredInitial!==report.travel.initialPartyIds
    ||!report.travel.finalCargoIntact
    ||errors.length)throw Error('Real movement gate: '+JSON.stringify(report.travel));
  report.status='PASS';
  console.log('[V1.47c] '+JSON.stringify(report.travel));
}catch(error){
  report.status='FAIL';report.error=String(error);
  console.error('[V1.47c] '+String(error));process.exitCode=1;
}finally{
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  await browser?.close().catch(()=>{});
}
