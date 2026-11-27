#!/usr/bin/env node
// FOC-MESH-11 browser gate. Requires Playwright + Chrome under Xvfb.
// Captures ACTUAL WebGL frames; does not alter the playable HTML or game logic.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const reportDir = resolve(process.env.FOC_QA_DIR || 'output/foc-mesh11-webgl');
const html = resolve(process.argv[2] || 'FOC-Visual-Sandbox/FallOfCavalry_PLAYABLE_RTS.html');
await mkdir(reportDir, { recursive: true });

const results = { source: html, browserWebGL: false, renderPath: null, sectors: [], errors: [], fpsApprox: null };
let browser;
try {
  browser = await chromium.launch({
    headless: false, // Explicit Xvfb display is necessary for SwiftShader WebGL.
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl',
      '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader']
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => results.errors.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') results.errors.push('console: ' + message.text());
  });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);
  const gl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl');
    const ext = context?.getExtension('WEBGL_debug_renderer_info');
    return {
      ok: Boolean(context),
      maxVertexAttributes: context?.getParameter(context.MAX_VERTEX_ATTRIBS) || 0,
      renderer: context && ext ? context.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null
    };
  });
  results.browserWebGL = gl.ok;
  results.webGL = gl;
  if (!gl.ok) throw Error('REAL WebGL unavailable in CI: cannot verify screenshots');
  const start = page.locator('#btnStartBattleMain');
  await start.waitFor({ state: 'visible', timeout: 30000 });
  await start.click({ timeout: 15000 });
  await page.waitForTimeout(4000);
  results.renderPath = await page.locator('#rtsBattleHUD').evaluate(el => getComputedStyle(el).display);
  if (results.renderPath === 'none') throw Error('Battle HUD did not become visible');
  const canvasCount = await page.locator('canvas').count();
  if (!canvasCount) throw Error('Battle canvas missing');
  // rAF rate is a browser cadence indicator, NOT a precise GPU FPS measurement.
  results.fpsApprox = await page.evaluate(async () => {
    let frames = 0;
    const a = performance.now();
    await new Promise(resolve => {
      const tick = () => {
        frames++;
        if (performance.now() - a > 2500) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return Math.round(1000 * frames / (performance.now() - a));
  });
  await page.screenshot({ path: resolve(reportDir, 'battle-sector0.png'), fullPage: true, timeout: 30000 });
  results.sectors.push({ sector: 0, screenshot: 'battle-sector0.png' });

  // Switch through existing sector controls without changing simulation code.
  for (let i = 1; i <= 2; i++) {
    await page.locator('#btnSector' + i).evaluate(el => el.click());
    await page.waitForTimeout(1200);
    const file = 'battle-sector' + i + '.png';
    await page.screenshot({ path: resolve(reportDir, file), fullPage: true, timeout: 30000 });
    results.sectors.push({ sector: i, screenshot: file });
  }
  // Capture enlarged anatomy from the actual in-game model showcase.
  await page.locator('#btnOpenArmory').evaluate(el => el.click());
  await page.locator('#rtsShowcaseOverlay').waitFor({ state: 'visible', timeout: 20000 });
  await page.waitForTimeout(1700);
  // The battle simulation must not overwrite the showcase's isolated registry.
  results.showcaseRegistry = await page.evaluate(() => {
    const ctrl = window.__focBattle3DPreview;
    const s = window.focShowcase;
    return {
      isOpen: Boolean(s?.isOpen),
      keys: Array.from(ctrl?.renderer?.soldierRegistry?.records?.keys() || []),
      batchCount: ctrl?.renderer?.soldierRegistry?.batchGroup?.batches?.length || 0,
      camera: ctrl?.renderer?.cameraController?.current || null
    };
  });
  if (!results.showcaseRegistry.isOpen ||
      !results.showcaseRegistry.keys.some(k => k.startsWith('SHOWCASE:')) ||
      !results.showcaseRegistry.batchCount) {
    throw Error('Showcase soldier missing or replaced by battle simulation: ' +
      JSON.stringify(results.showcaseRegistry));
  }
  await page.screenshot({ path: resolve(reportDir, 'showcase-ottoman-idle.png'), fullPage: true, timeout: 30000 });
  results.showcase = ['showcase-ottoman-idle.png'];

  await page.locator('#btnShowcaseAnimWalk').evaluate(el => el.click());
  await page.waitForTimeout(1300);
  await page.screenshot({ path: resolve(reportDir, 'showcase-ottoman-walk.png'), fullPage: true, timeout: 30000 });
  results.showcase.push('showcase-ottoman-walk.png');

  await page.locator('#btnShowcaseAnimAttack').evaluate(el => el.click());
  await page.waitForTimeout(1300);
  await page.screenshot({ path: resolve(reportDir, 'showcase-ottoman-attack.png'), fullPage: true, timeout: 30000 });
  results.showcase.push('showcase-ottoman-attack.png');

  await page.locator('#btnShowcaseEuropean').evaluate(el => el.click());
  await page.waitForTimeout(1300);
  await page.screenshot({ path: resolve(reportDir, 'showcase-european-attack.png'), fullPage: true, timeout: 30000 });
  results.showcase.push('showcase-european-attack.png');

  // MESH-12D: lower body close-up; hide only the info card in QA screenshots.
  results.kneeShowcase = [];
  const card = page.locator('#showcaseInfoCard');
  const previousVisibility = await card.evaluate(el => el.style.visibility);
  await card.evaluate(el => { el.style.visibility = 'hidden'; });
  for (const sample of [
    { culture: 'Ottoman', label: 'Yeniçeri', template: 'fixed:ottoman_janissary_musket', tag: 'janissary' },
    { culture: 'European', label: 'Zırhlı piyade', template: 'fixed:euro_armored_infantry', tag: 'armored' }
  ]) {
    await page.locator('#btnShowcase' + sample.culture).evaluate(el => el.click());
    await page.locator('#showcaseUnitList .showcase-unit-item').filter({
      has: page.getByText(sample.label, { exact: true })
    }).first().evaluate(el => el.click());
    await page.locator('#btnShowcaseVariant1').evaluate(el => el.click());
    for (const anim of ['Idle', 'Walk']) {
      await page.locator('#btnShowcaseAnim' + anim).evaluate(el => el.click());
      const state = await page.evaluate(() => {
        const r=window.__focBattle3DPreview?.renderer;
        const cam=r?.cameraController;
        if(!cam) throw Error('Knee camera missing');
        const view={targetX:0,targetY:.46,targetZ:0,distance:2.25,yaw:.54,pitch:.12};
        Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform?.(1);
        const reg=r.soldierRegistry,u=reg.records.get('SHOWCASE:U1');
        return { templateKey:u?.templateKey, legs:(reg.templates[u?.templateKey]||[]).filter(p=>p.prim.startsWith('focLeg_')).length };
      });
      if(state.templateKey!==sample.template || state.legs<4) throw Error('Wrong knee showcase: '+JSON.stringify(state));
      await page.waitForTimeout(900);
      const file='showcase-knee-'+sample.tag+'-'+anim.toLowerCase()+'.png';
      await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
      results.kneeShowcase.push({...state,anim,screenshot:file});
    }
  }
  await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);

  // MESH-12C: mounted anatomy gate. Select actual existing fixed archetypes
  // through the showcase UI, capture their whole body and check active mesh data.
  results.mountedShowcase = [];
  for (const sample of [
    { culture: 'Ottoman', label: 'Sipahi', template: 'fixed:ottoman_sipahi_lance', tag: 'sipahi' },
    { culture: 'European', label: 'Kürassier', template: 'fixed:euro_curassier_sword', tag: 'cuirassier' }
  ]) {
    await page.locator('#btnShowcase' + sample.culture).evaluate(el => el.click());
    await page.locator('#showcaseUnitList .showcase-unit-item').filter({
      has: page.getByText(sample.label, { exact: true })
    }).first().evaluate(el => el.click());
    await page.locator('#btnShowcaseVariant1').evaluate(el => el.click());
    for (const anim of ['Idle', 'Walk']) {
      await page.locator('#btnShowcaseAnim' + anim).evaluate(el => el.click());
      await page.waitForTimeout(1200);
      const state = await page.evaluate(() => {
        const r = window.__focBattle3DPreview?.renderer?.soldierRegistry;
        const unit = r?.records?.get('SHOWCASE:U1');
        const parts = r?.templates?.[unit?.templateKey] || [];
        return {
          templateKey: unit?.templateKey,
          horseParts: parts.filter(p => p.prim.startsWith('focEquine_')).length,
          activeBatches: r?.batchGroup?.batches?.length || 0,
          selectedAnim: window.focShowcase?.selectedAnim
        };
      });
      if (state.templateKey !== sample.template || state.horseParts < 6 ||
          !state.activeBatches || state.selectedAnim !== anim.toLowerCase()) {
        throw Error('Wrong/missing mounted showcase model: ' + JSON.stringify({sample, state}));
      }
      const file = 'showcase-' + sample.tag + '-' + anim.toLowerCase() + '.png';
      await page.screenshot({ path: resolve(reportDir, file), fullPage: true, timeout: 30000 });
      results.mountedShowcase.push({ ...state, screenshot: file });
    }
    // A quarter-side idle view exposes horse neck, shoulder and rear leg contours.
    await page.locator('#btnShowcaseAnimIdle').evaluate(el => el.click());
    await page.evaluate(() => {
      const cam = window.__focBattle3DPreview?.renderer?.cameraController;
      if (!cam) throw Error('Mounted camera missing');
      Object.assign(cam.desired, { yaw: 1.10, distance: 5.8, targetY: 1.30, pitch: .16 });
      Object.assign(cam.current, { yaw: 1.10, distance: 5.8, targetY: 1.30, pitch: .16 });
      cam.syncTransform?.(1);
    });
    await page.waitForTimeout(1000);
    const file = 'showcase-' + sample.tag + '-quarter.png';
    await page.screenshot({ path: resolve(reportDir, file), fullPage: true, timeout: 30000 });
    results.mountedShowcase.push({ templateKey: sample.template, selectedAnim: 'idle', view: 'quarter', screenshot: file });
    // Capture a close side view of actual tack rather than the info-card covered legs.
    const tack = await page.evaluate(() => {
      const r=window.__focBattle3DPreview?.renderer, reg=r?.soldierRegistry;
      const u=reg?.records?.get('SHOWCASE:U1'), parts=reg?.templates?.[u?.templateKey]||[];
      const view={targetX:0,targetY:1.25,targetZ:.25,distance:3.5,yaw:1.26,pitch:.10};
      Object.assign(r.cameraController.desired,view);Object.assign(r.cameraController.current,view);
      r.cameraController.syncTransform?.(1);
      return {template:u?.templateKey,reins:parts.filter(p=>p.prim.startsWith('focRein_')).length,
        stirrups:parts.filter(p=>p.prim.startsWith('focStirrup_')).length,
        saddle:parts.filter(p=>p.prim.startsWith('focTack_')).length};
    });
    if(tack.template!==sample.template||tack.reins!==2||tack.stirrups!==2||tack.saddle!==2)throw Error('Tack showcase incomplete '+JSON.stringify(tack));
    await card.evaluate(el=>{el.style.visibility='hidden';});
    await page.waitForTimeout(900);
    const tackFile='showcase-'+sample.tag+'-tack.png';
    await page.screenshot({path:resolve(reportDir,tackFile),fullPage:true,timeout:30000});
    await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);
    (results.tackShowcase ||= []).push({...tack,screenshot:tackFile});
  }
  if (results.mountedShowcase.length !== 6) throw Error('Mounted showcase coverage incomplete');

  if (results.errors.some(x => /shader|WebGL|context lost|uncaught/i.test(x))) {
    throw Error('WebGL-related console/page errors: ' + results.errors.slice(0, 3).join(' | '));
  }
  results.ok = true;
} catch (error) {
  results.ok = false;
  results.failure = String(error && error.stack || error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(resolve(reportDir, 'report.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}
