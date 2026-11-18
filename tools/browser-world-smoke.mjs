// Real browser check of the COMPLETE existing game world, not a new pilot world.
// Requires Playwright and Chromium, installed in the GitHub Actions browser job.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const getArg = (key, fallback) => {
  const idx = process.argv.indexOf(key);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
};
const url = getArg('--url', 'http://127.0.0.1:4173');
const out = resolve(getArg('--report', 'output/browser-smoke/report.json'));
const imageDir = resolve('output/browser-smoke/screenshots');
const seed = Number(getArg('--seed', '1337'));
const report = {
  version: 'browser-world-smoke-v1', scope: 'entire existing procedural world, not a data pilot',
  seed, url, stages: [], pageErrors: [], consoleErrors: [], firstPartyFailures: [], map: null, status: 'RUNNING',
};

const stage = (name, details = {}) => {
  report.stages.push({ name, ...details });
  console.log('[browser-world-smoke] ' + name + ' ' + JSON.stringify(details));
};

async function main() {
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(imageDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
    const expectedOrigin = new URL(url).origin;
    page.on('pageerror', err => report.pageErrors.push(String(err)));
    page.on('console', msg => {
      if (msg.type() === 'error') report.consoleErrors.push(msg.text());
    });
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === expectedOrigin &&
          !response.url().endsWith('/favicon.ico')) {
        report.firstPartyFailures.push({ url: response.url(), status: response.status() });
      }
    });
    page.on('requestfailed', request => {
      if (new URL(request.url()).origin === expectedOrigin &&
          !request.url().endsWith('/favicon.ico')) {
        report.firstPartyFailures.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => Boolean(window.game?.initialized), null, { timeout: 30000 });
    const cards = page.locator('#factionGrid .faction-card');
    await cards.first().waitFor({ state: 'visible', timeout: 30000 });
    const factions = await cards.count();
    stage('menu-loaded', { factions });
    await page.screenshot({ path: imageDir + '/01-start-screen.png', fullPage: true });

    await page.locator('#seedInput').fill(String(seed));
    await cards.first().click();
    if (!(await page.locator('#btnStart').isEnabled())) throw new Error('Start button disabled after faction selection');
    await page.locator('#btnStart').click();
    stage('start-button-clicked');

    await page.waitForFunction(() => {
      const g = window.game;
      const world = g?.worldManager?.state?.mapData || g?.state?.mapData;
      return Boolean(g?.started && world?.terrain?.length && world?.width && world?.height);
    }, null, { timeout: 120000 });

    report.map = await page.evaluate(() => {
      const g = window.game, map = g?.worldManager?.state?.mapData || g?.state?.mapData;
      const canvas = document.getElementById('gameCanvas');
      return {
        started: Boolean(g?.started), mode: g?.state?.mode ?? null,
        width: map?.width ?? 0, height: map?.height ?? 0, terrainLength: map?.terrain?.length ?? 0,
        settlements: map?.settlements?.length ?? 0, roads: map?.roads?.length ?? 0,
        worldNpcCount: g?.state?.worldCharacters?.characters?.length ?? 0,
        rivers: map?.rivers?.length ?? 0, crossings: map?.crossings?.length ?? 0,
        canvasWidth: canvas?.width ?? 0, canvasHeight: canvas?.height ?? 0,
        startModalHidden: document.getElementById('startModal')?.classList.contains('hidden') ?? false,
        bootErrorVisible: !(document.getElementById('bootNotice')?.classList.contains('hidden') ?? true),
      };
    });
    stage('full-runtime-world', report.map);
    await page.waitForTimeout(350);
    await page.screenshot({ path: imageDir + '/02-runtime-world.png', fullPage: true });
    if (report.map.width * report.map.height !== report.map.terrainLength) throw new Error('World layer dimensions mismatch');
    if (!report.map.settlements) throw new Error('World has no settlements');
    if (report.map.worldNpcCount !== report.map.settlements * 2) throw new Error('World NPCs not generated for every settlement');
    if (!report.map.canvasWidth || !report.map.canvasHeight) throw new Error('Canvas has zero dimensions');
    if (report.map.bootErrorVisible) throw new Error('Boot error banner visible');
    // CI runs in a disposable browser context: saving is safe and does not touch user files.
    const roundtrip = await page.evaluate(() => {
      const g = window.game;
      const capture = () => {
        const m = g.worldManager?.state?.mapData || g.state?.mapData;
        return {
          day: g.state?.day ?? null,
          gold: g.playerParty?.gold ?? null,
          x: g.playerParty?.x ?? null,
          y: g.playerParty?.y ?? null,
          factionId: g.playerParty?.factionId ?? null,
          worldWidth: m?.width ?? 0,
          worldHeight: m?.height ?? 0,
          settlements: m?.settlements?.length ?? 0,
          worldNpcCount: g.state?.worldCharacters?.characters?.length ?? 0,
          firstWorldNpcId: g.state?.worldCharacters?.characters?.[0]?.id ?? null,
          firstWorldNpcName: g.state?.worldCharacters?.characters?.[0]?.name ?? null,
          mode: g.state?.mode ?? null,
        };
      };
      const before = capture();
      const saveOk = g.saveManager?.quickSave?.() === true;
      const slotExists = g.saveManager?.saveSystem?.hasSlot?.('manual1') === true;
      const loadOk = saveOk ? g.saveManager?.quickLoad?.() === true : false;
      return { saveOk, slotExists, loadOk, before, after: capture() };
    });
    report.saveRoundtrip = roundtrip;
    stage('save-roundtrip', { saveOk: roundtrip.saveOk, slotExists: roundtrip.slotExists, loadOk: roundtrip.loadOk });
    if (!roundtrip.saveOk || !roundtrip.slotExists || !roundtrip.loadOk) {
      throw new Error('Quick save/load failed in disposable browser context');
    }
    for (const key of ['day', 'gold', 'factionId', 'worldWidth', 'worldHeight', 'settlements',
      'worldNpcCount', 'firstWorldNpcId', 'firstWorldNpcName']) {
      if (roundtrip.before[key] !== roundtrip.after[key]) {
        throw new Error('Save round-trip mismatch at ' + key);
      }
    }
    await page.screenshot({ path: imageDir + '/03-after-save-load.png', fullPage: true });

    if (report.pageErrors.length) throw new Error('Uncaught page errors: ' + report.pageErrors.join('; '));
    if (report.firstPartyFailures.length) throw new Error('First-party requests failed');
    report.status = 'PASS_BOOT_WORLD_SAVELOAD';
    stage('completed', { status: report.status, consoleErrorCount: report.consoleErrors.length });
  } catch (error) {
    report.status = 'FAIL';
    report.pageErrors.push(String(error));
    console.error('[browser-world-smoke] ' + String(error));
    process.exitCode = 1;
  } finally {
    writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
}

main().catch(err => {
  report.status = 'FAIL';
  report.pageErrors.push(String(err));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.error(err);
  process.exitCode = 1;
});
