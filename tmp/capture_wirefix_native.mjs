import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(120000);

await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

await page.evaluate(() => {
  const boot = document.getElementById('bootNotice');
  if (boot) boot.style.display = 'none';
});

await page.locator('.faction-card').first().click();
await page.locator('#btnStart').click();
await page.waitForTimeout(2400);

await page.evaluate(() => {
  const g = window.game;
  if (!g?.state?.map || !g?.state?.camera) return;

  if (g.state.map.fog instanceof Uint8Array) g.state.map.fog.fill(2);
  g.followParty = false;
  if (g.renderManager) g.renderManager.dimetricWireframeEnabled = false;

  const party = g.playerParty;
  const tileSize = g.CONST?.WORLD?.TILE_SIZE || 32;
  const viewW = Number(g.canvas?.width) || 1366;
  const viewH = Number(g.canvas?.height) || 768;
  if (party && Number.isFinite(party.x) && Number.isFinite(party.y)) {
    g.state.camera.x = Math.max(0, party.x - (viewW * 0.5));
    g.state.camera.y = Math.max(0, party.y - (viewH * 0.5));
  } else {
    const mx = (g.state.map.width || 200) * tileSize * 0.5;
    const my = (g.state.map.height || 120) * tileSize * 0.5;
    g.state.camera.x = Math.max(0, mx - (viewW * 0.5));
    g.state.camera.y = Math.max(0, my - (viewH * 0.5));
  }
});

await page.waitForTimeout(900);
await page.screenshot({
  path: path.join(outDir, 'map-style-stronghold-native-fixed.png'),
  fullPage: false,
});

await browser.close();
