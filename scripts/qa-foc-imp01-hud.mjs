#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const output=resolve('output/foc-imp01-hud');
await mkdir(output,{recursive:true});
const report={checks:[],errors:[]};
let browser;
try {
  browser=await chromium.launch({headless:false,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  const check=(name,v)=>{assert.ok(v,name);report.checks.push(name)};
  await page.goto(pathToFileURL(resolve('FOC-Visual-Sandbox/FallOfCavalry_PLAYABLE_RTS.html')).href,{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#btnStartBattleMain').waitFor({state:'visible',timeout:30000});
  await page.locator('#btnStartBattleMain').click({timeout:15000});
  await page.waitForFunction(()=>window.focBattleEngine?.gameState==='IN_BATTLE');
  await page.locator('#btnPauseBattle').click();
  check('live compact HUD visible',await page.locator('#rtsBattleHUD').isVisible());
  check('permanent army counters removed',await page.locator('#hudPlayerCount,#hudEnemyCount').count()===0);
  check('legacy console hidden by default',!(await page.locator('#rtsBottomConsole').isVisible()));
  check('pause is actual engine state',await page.evaluate(()=>window.focBattleEngine.isPaused===true && document.getElementById('btnPauseBattle').textContent==='Devam et'));
  await page.screenshot({path:resolve(output,'live-default.png')});
  await page.locator('#btnToggleLegacyControls').click();
  check('legacy console remains reachable',await page.locator('#rtsBottomConsole').isVisible());
  check('toggle accessibility state',await page.locator('#btnToggleLegacyControls').getAttribute('aria-expanded')==='true');
  await page.evaluate(()=>{const b=window.focBattleEngine;b.selectedSoldierIds=[];const sm=b.controller.renderer.selectionManager;if(sm?.clearSelection)sm.clearSelection();else sm?.clear?.();b.hud.render()});
  check('no selection does not invent army count',await page.locator('#rtsUnitTitle').textContent()==='Birlik seçilmedi');
  check('no selection disables all 14 command and formation controls',await page.locator('#rtsCommandBar button:disabled,#rtsFormationBar button:disabled').count()===14);
  check('no selection has no highlighted command',await page.locator('#rtsCommandBar button.active,#rtsFormationBar button.active').count()===0);
  const mixed=await page.evaluate(()=>{
    const b=window.focBattleEngine, pair=b.playerSoldiers.filter(s=>s.alive&&!s.isReserve).slice(0,2);
    if(pair.length!==2)throw Error('need two live soldiers');
    b.selectedSoldierIds=pair.map(s=>s.id);
    pair[0].currentOrder='move';pair[1].currentOrder='hold';
    pair[0].formation='line';pair[1].formation='column';
    b.hud.render();
    return {order:document.getElementById('rtsUnitOrder').textContent,formation:document.getElementById('rtsUnitFormation').textContent};
  });
  check('mixed live values not falsely homogeneous',mixed.order==='Emir: Karışık'&&mixed.formation==='Diziliş: Karışık');
  check('selected commands enabled',await page.locator('#btnCmdHold').isEnabled());
  await page.evaluate(()=>{
    const b=window.focBattleEngine,r=b.controller.renderer;
    window.__imp01calls={battle:0,preview:0,formation:0,previewFormation:0};
    const orig=b.applyOrderToSelected.bind(b);
    b.applyOrderToSelected=(...a)=>{window.__imp01calls.battle++;return orig(...a)};
    const fo=b.applyFormationToSelected.bind(b);
    b.applyFormationToSelected=(...a)=>{window.__imp01calls.formation++;return fo(...a)};
    if(r.commandManager){const p=r.commandManager.executeCommand.bind(r.commandManager);r.commandManager.executeCommand=(...a)=>{window.__imp01calls.preview++;return p(...a)}}
    if(r.formationManager){const p=r.formationManager.setFormation.bind(r.formationManager);r.formationManager.setFormation=(...a)=>{window.__imp01calls.previewFormation++;return p(...a)}}
  });
  await page.locator('#btnCmdHold').click();
  await page.locator('#btnFormLine').click();
  const outcome=await page.evaluate(()=>{const b=window.focBattleEngine,v=b.hud.snapshot();b.controller._updateRTSHUD();return {calls:window.__imp01calls,order:v.order,formation:v.formation,text:document.getElementById('rtsUnitOrder').textContent}});
  check('live buttons do not run preview command handlers',outcome.calls.battle===1&&outcome.calls.formation===1&&outcome.calls.preview===0&&outcome.calls.previewFormation===0);
  check('card reflects actual state after command',outcome.order==='hold'&&outcome.formation==='line'&&outcome.text==='Emir: Konumu koru');
  await page.screenshot({path:resolve(output,'legacy-opt-in.png')});
  await page.locator('#btnToggleLegacyControls').click();
  check('console can close',!(await page.locator('#rtsBottomConsole').isVisible()));
  await page.evaluate(()=>window.focBattleEngine.returnToMenu());
  check('HUD hidden on return',!(await page.locator('#rtsBattleHUD').isVisible()));
  await page.locator('#btnStartBattleMain').click();
  check('restart resets temporary panel',!(await page.locator('#rtsBottomConsole').isVisible()));
  check('restart resets pause',await page.evaluate(()=>!window.focBattleEngine.isPaused));
  assert.deepEqual(report.errors,[]);
  report.pass=true;
}catch(e){report.pass=false;report.errors.push(String(e.stack||e));process.exitCode=1}
finally{await browser?.close();await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))}
