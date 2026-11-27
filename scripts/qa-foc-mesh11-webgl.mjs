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

  // MESH-12H: close front and three-quarter face views of both cultures.
  results.faceShowcase=[];
  await card.evaluate(el=>{el.style.visibility='hidden';});
  for(const sample of [
    {culture:'Ottoman',label:'Yeniçeri',template:'fixed:ottoman_janissary_musket',tag:'janissary'},
    {culture:'European',label:'Zırhlı piyade',template:'fixed:euro_armored_infantry',tag:'armored'}
  ]){
    await page.locator('#btnShowcase'+sample.culture).evaluate(el=>el.click());
    await page.locator('#showcaseUnitList .showcase-unit-item').filter({has:page.getByText(sample.label,{exact:true})}).first().evaluate(el=>el.click());
    await page.locator('#btnShowcaseVariant1').evaluate(el=>el.click());
    await page.locator('#btnShowcaseAnimIdle').evaluate(el=>el.click());
    for(const [viewName,yaw] of [['front',0],['quarter',.66]]){
      const state=await page.evaluate(yaw=>{
        const r=window.__focBattle3DPreview.renderer,cam=r.cameraController,reg=r.soldierRegistry;
        const u=reg.records.get('SHOWCASE:U1'),parts=reg.templates[u.templateKey];
        const head=parts.find(p=>p.prim.startsWith('focHead_')&&p.prim.endsWith('_skin'));
        const view={targetX:0,targetY:head.localMat[13],targetZ:0,distance:1.35,yaw,pitch:.025};
        Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
        return {template:u.templateKey,faceParts:parts.filter(p=>p.prim.startsWith('focHead_')).length};
      },yaw);
      if(state.template!==sample.template||state.faceParts!==6)throw Error('Incorrect face showcase '+JSON.stringify(state));
      await page.waitForTimeout(900);
      const file='showcase-face-'+sample.tag+'-'+viewName+'.png';
      await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
      results.faceShowcase.push({...state,view:viewName,screenshot:file});
    }
  }
  await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);

  // MESH-12I: torso details on Ottoman and European infantry.
  results.garmentShowcase=[];
  await card.evaluate(el=>{el.style.visibility='hidden';});
  for(const sample of [
    {culture:'Ottoman',label:'Yeniçeri',template:'fixed:ottoman_janissary_musket',tag:'janissary'},
    {culture:'European',label:'Zırhlı piyade',template:'fixed:euro_armored_infantry',tag:'armored'}
  ]){
    await page.locator('#btnShowcase'+sample.culture).evaluate(el=>el.click());
    await page.locator('#showcaseUnitList .showcase-unit-item').filter({has:page.getByText(sample.label,{exact:true})}).first().evaluate(el=>el.click());
    await page.locator('#btnShowcaseVariant1').evaluate(el=>el.click());
    await page.locator('#btnShowcaseAnimIdle').evaluate(el=>el.click());
    for(const [name,yaw] of [['front',0],['quarter',.77]]){
      const state=await page.evaluate(yaw=>{
        const r=window.__focBattle3DPreview.renderer,cam=r.cameraController,reg=r.soldierRegistry;
        const u=reg.records.get('SHOWCASE:U1'),parts=reg.templates[u.templateKey];
        const view={targetX:0,targetY:1.06,targetZ:0,distance:1.85,yaw,pitch:.08};
        Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
        return {template:u.templateKey,trim:parts.filter(p=>p.prim.startsWith('focGarment_')&&p.prim.endsWith('_trim')).length};
      },yaw);
      if(state.template!==sample.template||state.trim!==1)throw Error('Incorrect garment showcase '+JSON.stringify(state));
      await page.waitForTimeout(900);
      const file='showcase-garment-'+sample.tag+'-'+name+'.png';
      await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
      results.garmentShowcase.push({...state,view:name,screenshot:file});
    }
  }
  await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);

  // MESH-12J: show weapon silhouette and hand attachment in actual browser frames.
  results.weaponShowcase=[];
  await card.evaluate(el=>{el.style.visibility='hidden';});
  for(const sample of [
    {culture:'Ottoman',label:'Yeniçeri',template:'fixed:ottoman_janissary_musket',tag:'janissary'},
    {culture:'European',label:'Zırhlı piyade',template:'fixed:euro_armored_infantry',tag:'armored'}
  ]){
    await page.locator('#btnShowcase'+sample.culture).evaluate(el=>el.click());
    await page.locator('#showcaseUnitList .showcase-unit-item').filter({has:page.getByText(sample.label,{exact:true})}).first().evaluate(el=>el.click());
    await page.locator('#btnShowcaseVariant1').evaluate(el=>el.click());
    for(const anim of ['Idle','Attack']){
      await page.locator('#btnShowcaseAnim'+anim).evaluate(el=>el.click());
      const state=await page.evaluate(()=>{
        const r=window.__focBattle3DPreview.renderer,cam=r.cameraController,reg=r.soldierRegistry;
        const u=reg.records.get('SHOWCASE:U1'),parts=reg.templates[u.templateKey];
        const view={targetX:0,targetY:1.22,targetZ:.35,distance:2.7,yaw:1.03,pitch:.14};
        Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
        return {template:u.templateKey,weaponParts:parts.filter(p=>p.prim.startsWith('focWeapon_')).map(p=>p.prim)};
      });
      if(state.template!==sample.template||state.weaponParts.length<3)throw Error('Incorrect weapon showcase '+JSON.stringify(state));
      await page.waitForTimeout(900);
      const file='showcase-weapon-'+sample.tag+'-'+anim.toLowerCase()+'.png';
      await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
      results.weaponShowcase.push({...state,anim,screenshot:file});
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

  // MESH-12 final coverage: every fixed archetype, same idle camera angles.
  // Derive the selection from the real showcase catalog, not a duplicate model list.
  results.allFixedShowcase = [];
  const catalog = await page.evaluate(() => {
    const s=window.focShowcase,reg=window.__focBattle3DPreview.renderer.soldierRegistry;
    const expected=Object.keys(reg.geometries).filter(k=>k.startsWith('focHead_')&&k.endsWith('_skin')).map(k=>'fixed:'+k.slice(8,-5)).sort();
    const selections=new Map();
    for(const [culture,units] of Object.entries(s.unitCatalog)){
      for(const unit of units)for(const variant of [1,2]){
        const key=s.getTemplateKey(culture,unit.key,variant);
        if(key?.startsWith('fixed:')&&!selections.has(key)){
          const parts=reg.templates[key]||[];
          selections.set(key,{culture,label:unit.name,variant,key,mounted:parts.some(p=>p.rigGroup==='horseBody')});
        }
      }
    }
    const actual=Array.from(selections.keys()).sort();
    if(expected.length!==24||JSON.stringify(actual)!==JSON.stringify(expected))throw Error('Fixed showcase coverage mismatch '+JSON.stringify({expected,actual}));
    return Array.from(selections.values());
  });
  await card.evaluate(el=>{el.style.visibility='hidden';});
  try{
    for(const sample of catalog){
      await page.locator('#btnShowcase'+(sample.culture==='ottoman'?'Ottoman':'European')).evaluate(el=>el.click());
      await page.locator('#showcaseUnitList .showcase-unit-item').filter({has:page.getByText(sample.label,{exact:true})}).first().evaluate(el=>el.click());
      await page.locator('#btnShowcaseVariant'+sample.variant).evaluate(el=>el.click());
      await page.locator('#btnShowcaseAnimIdle').evaluate(el=>el.click());
      for(const [angle,yaw] of [['front',0],['quarter',.92]]){
        const state=await page.evaluate(({sample,yaw})=>{
          const r=window.__focBattle3DPreview.renderer,reg=r.soldierRegistry,cam=r.cameraController;
          const rec=reg.records.get('SHOWCASE:U1'),parts=reg.templates[rec?.templateKey]||[];
          const view={targetX:0,targetY:sample.mounted?1.22:.91,targetZ:0,distance:sample.mounted?6.1:3.8,yaw,pitch:.12};
          Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
          return {template:rec?.templateKey,records:reg.records.size,batches:reg.batchGroup.batches.length,
            mounted:parts.some(p=>p.rigGroup==='horseBody'),faces:parts.filter(p=>p.prim.startsWith('focHead_')).length,
            surfaceClasses:[...new Set(reg.batchGroup.batches.map(b=>b.surfaceClass||0))].sort()};
        },{sample,yaw});
        if(state.template!==sample.key||state.records!==1||state.batches<1||state.mounted!==sample.mounted||state.faces!==6||!state.surfaceClasses.includes(5)||state.surfaceClasses.some(c=>c<0||c>5))throw Error('Incorrect fixed showcase '+JSON.stringify({sample,state}));
        // Await an actual browser frame following the camera change.
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const file='all-fixed-'+sample.key.slice(6)+'-'+angle+'.png';
        await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
        results.allFixedShowcase.push({...state,angle,screenshot:file});
      }
    }
  }finally{await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);}
  if(results.allFixedShowcase.length!==48||new Set(results.allFixedShowcase.map(x=>x.template)).size!==24)throw Error('Incomplete 24-model two-angle screenshot coverage');

  const surfaceClasses=[...new Set(results.allFixedShowcase.flatMap(x=>x.surfaceClasses))].sort();
  if(![1,2,3,4,5].every(c=>surfaceClasses.includes(c)))throw Error('Missing MESH-13A surface class '+surfaceClasses);
  results.surfaceCoverage=surfaceClasses;

  // MESH-13B: close shoulder/upper arm views in the same idle and attack poses.
  results.shoulderShowcase=[];
  await card.evaluate(el=>{el.style.visibility='hidden';});
  try{
    for(const sample of [
      {culture:'Ottoman',label:'Yeniçeri',template:'fixed:ottoman_janissary_musket',tag:'janissary',mounted:false},
      {culture:'European',label:'Zırhlı piyade',template:'fixed:euro_armored_infantry',tag:'armored',mounted:false},
      {culture:'Ottoman',label:'Sipahi',template:'fixed:ottoman_sipahi_lance',tag:'sipahi',mounted:true},
      {culture:'European',label:'Kürassier',template:'fixed:euro_curassier_sword',tag:'cuirassier',mounted:true}
    ]){
      await page.locator('#btnShowcase'+sample.culture).evaluate(el=>el.click());
      await page.locator('#showcaseUnitList .showcase-unit-item').filter({has:page.getByText(sample.label,{exact:true})}).first().evaluate(el=>el.click());
      await page.locator('#btnShowcaseVariant1').evaluate(el=>el.click());
      for(const anim of ['Idle','Attack']){
        await page.locator('#btnShowcaseAnim'+anim).evaluate(el=>el.click());
        const state=await page.evaluate(sample=>{
          const r=window.__focBattle3DPreview.renderer,reg=r.soldierRegistry,cam=r.cameraController;
          const rec=reg.records.get('SHOWCASE:U1'),parts=reg.templates[rec?.templateKey]||[];
          const view={targetX:0,targetY:sample.mounted?1.78:1.24,targetZ:.10,distance:2.25,yaw:.71,pitch:.08};
          Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
          return {template:rec?.templateKey,sleeves:parts.filter(p=>p.prim.startsWith('focArm_')&&p.prim.endsWith('_sleeve')).length};
        },sample);
        if(state.template!==sample.template||state.sleeves!==2)throw Error('Wrong shoulder showcase '+JSON.stringify(state));
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const file='showcase-shoulder-'+sample.tag+'-'+anim.toLowerCase()+'.png';
        await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
        results.shoulderShowcase.push({...state,anim,screenshot:file});
      }
    }
  }finally{await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);}
  if(results.shoulderShowcase.length!==8)throw Error('Incomplete shoulder screenshot coverage');

  // MESH-13C: inspect horse chest/neck and upper leg roots in the 10 mounted models.
  results.horseRootShowcase=[];
  await card.evaluate(el=>{el.style.visibility='hidden';});
  try{
    for(const sample of catalog.filter(x=>x.mounted)){
      await page.locator('#btnShowcase'+(sample.culture==='ottoman'?'Ottoman':'European')).evaluate(el=>el.click());
      await page.locator('#showcaseUnitList .showcase-unit-item').filter({has:page.getByText(sample.label,{exact:true})}).first().evaluate(el=>el.click());
      await page.locator('#btnShowcaseVariant'+sample.variant).evaluate(el=>el.click());
      await page.locator('#btnShowcaseAnimIdle').evaluate(el=>el.click());
      const state=await page.evaluate(()=>{
        const r=window.__focBattle3DPreview.renderer,reg=r.soldierRegistry,cam=r.cameraController;
        const rec=reg.records.get('SHOWCASE:U1'),parts=reg.templates[rec?.templateKey]||[];
        const view={targetX:0,targetY:1.08,targetZ:.12,distance:3.65,yaw:1.06,pitch:.06};
        Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
        return {template:rec?.templateKey,neck:parts.filter(p=>p.prim.startsWith('focEquine_')&&p.prim.endsWith('_neck')).length,
          upperLegs:parts.filter(p=>p.prim.startsWith('focEquine_')&&/^horseLeg[HF][LR]$/.test(p.rigGroup)).length};
      });
      if(state.template!==sample.key||state.neck!==1||state.upperLegs!==4)throw Error('Wrong horse root showcase '+JSON.stringify(state));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const file='showcase-horse-root-'+sample.key.slice(6)+'.png';
      await page.screenshot({path:resolve(reportDir,file),fullPage:true,timeout:30000});
      results.horseRootShowcase.push({...state,screenshot:file});
    }
  }finally{await card.evaluate((el,v)=>{el.style.visibility=v;},previousVisibility);}
  if(results.horseRootShowcase.length!==10)throw Error('Incomplete horse root screenshot coverage');

  // MESH-12G: controlled real WebGL workload after all normal screenshots.
  // Freeze normal game ticks only in this QA session; no production behavior change.
  if(process.env.FOC_QA_PERF300==='1'){
  results.perf300 = await page.evaluate(() => {
    const r=window.__focBattle3DPreview.renderer,reg=r.soldierRegistry,webgl=r.renderer,gl=webgl.gl;
    r._stopAnimationLoop();
    reg.clear();
    const keys=Object.keys(reg.geometries).filter(k=>k.startsWith('focHead_')&&k.endsWith('_skin')).map(k=>'fixed:'+k.slice(8,-5));
    if(keys.length!==24)throw Error('Expected 24 fixed templates, got '+keys.length);
    const soldiers=Array.from({length:300},(_,i)=>{
      const templateKey=keys[i%keys.length],mounted=reg.templates[templateKey].some(p=>p.rigGroup==='horseBody');
      return {viewId:'PERF:'+i,soldierId:'p'+i,side:i<150?'player':'enemy',templateKey,
        bodyType:mounted?'mounted':'human',mountType:mounted?'horse':'foot',
        activeWeapon:mounted?'war_lance':'matchlock_musket',state:'idle',
        position:{x:(i%20-9.5)*2.5,y:0,z:(Math.floor(i/20)-7)*2.5},facingYaw:i<150?0:Math.PI};
    });
    reg.sync({sectorId:'PERF',soldiers});
    if(reg.records.size!==300)throw Error('Missing performance fixture soldiers');
    const cam=r.cameraController;
    const view={targetX:0,targetY:0,targetZ:0,distance:46,pitch:.85,yaw:.28};
    Object.assign(cam.desired,view);Object.assign(cam.current,view);cam.syncTransform(1);
    const batches=reg.batchGroup.batches;
    const report={soldiers:reg.records.size,batches:batches.length,instances:reg.batchGroup.totalInstances,
      submittedSoldierTriangles:batches.reduce((n,b)=>n+b.count*b.geometry.indices.length/3,0),
      fullInstanceBytes:batches.reduce((n,b)=>n+b.instanceData.byteLength,0),cases:[]};
    let uploadBytes=0,uploadCalls=0;
    const sub=gl.bufferSubData.bind(gl);
    gl.bufferSubData=(target,offset,data)=>{uploadBytes+=data.byteLength;uploadCalls++;return sub(target,offset,data);};
    try{
      webgl.render(r.scene,cam.camera);gl.finish();
      for(const [label,active] of [['idle',0],['one-moving',1],['mixed-30',30],['all-300',300]]){
        const samples=[];
        for(let f=1;f<=3;f++){
          let i=0;
          for(const rec of reg.records.values()){
            rec.walkBlend=i<active?.8:0;rec.trotBlend=i<active?.5:0;
            rec.walkPhase=f*.19+i*.01;rec.actionBlend=i<active?.6:0;rec.actionMode='attack';rec.actionPhase=f*.11;i++;
          }
          uploadBytes=0;uploadCalls=0;
          const t0=performance.now();reg._updateBatchBuffersInPlace();const t1=performance.now();
          webgl.render(r.scene,cam.camera);const t2=performance.now();gl.finish();const t3=performance.now();
          samples.push({cpuInstanceMs:t1-t0,renderSubmissionMs:t2-t1,gpuSyncWaitMs:t3-t2,
            totalMs:t3-t0,uploadBytes,uploadCalls,drawCalls:webgl.drawCallsLastFrame,renderMode:webgl.lastRenderMode,
            changedRecords:reg._focPerf?.changedRecords,rigEvaluations:reg._focPerf?.rigEvaluations});
        }
        report.cases.push({label,active,samples});
      }
      if(report.cases[0].samples.slice(1).some(x=>x.uploadBytes!==0))throw Error('Idle instance upload still occurring');
      report.glError=gl.getError();if(report.glError!==gl.NO_ERROR)throw Error('WebGL benchmark error '+report.glError);
      return report;
    }finally{gl.bufferSubData=sub;}
  });
  await page.screenshot({path:resolve(reportDir,'perf-300-soldiers.png'),fullPage:true,timeout:30000});
  }else{results.perf300={status:'deferred',reason:'visual quality phase; opt in with FOC_QA_PERF300=1'};}

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
