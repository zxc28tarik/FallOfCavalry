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
