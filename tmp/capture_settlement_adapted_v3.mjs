import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(120000);
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2200);

const targets = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!map) return { list: [], tileSize: 32 };
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  const tileSize = Number.isFinite(map.tileSize)
    ? map.tileSize
    : (Number.isFinite(window?.CONST?.WORLD?.TILE_SIZE) ? window.CONST.WORLD.TILE_SIZE : 32);
  const settlements = Array.isArray(map.settlements) ? map.settlements : [];
  const pick = (kinds) => settlements.find((s) => kinds.includes(String(s?.type || 'village').toLowerCase()));
  const city = pick(['city', 'town']);
  const fort = pick(['fort']);
  const village = pick(['village']);
  const list = [
    city ? { kind: 'city', tx: city.tx, ty: city.ty, name: city.name } : null,
    fort ? { kind: 'fort', tx: fort.tx, ty: fort.ty, name: fort.name } : null,
    village ? { kind: 'village', tx: village.tx, ty: village.ty, name: village.name } : null,
  ].filter(Boolean);
  return { list, tileSize };
});

console.log(JSON.stringify(targets, null, 2));

const canvas = page.locator('canvas').first();
for (const t of targets.list) {
  await page.evaluate((target) => {
    const g = window.game;
    if (!g?.state?.camera) return;
    const map = g?.state?.map;
    const T = Number.isFinite(map?.tileSize)
      ? map.tileSize
      : (Number.isFinite(window?.CONST?.WORLD?.TILE_SIZE) ? window.CONST.WORLD.TILE_SIZE : 32);
    const cx = target.tx * T + T * 0.5;
    const cy = target.ty * T + T * 0.5;
    g.state.camera.x = Math.max(0, cx - 800);
    g.state.camera.y = Math.max(0, cy - 450);
    g.followParty = false;
  }, t);
  await page.waitForTimeout(900);
  await canvas.screenshot({ path: path.join(outDir, `map-settlement-adapted-v3-${t.kind}.png`) });
}

await canvas.screenshot({ path: path.join(outDir, 'map-settlement-adapted-v3-full.png') });
await browser.close();
