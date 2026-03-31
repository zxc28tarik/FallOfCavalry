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
await page.waitForSelector('.faction-card');
await page.locator('.faction-card').first().click();
await page.waitForSelector('#btnStart');
await page.locator('#btnStart').click();
await page.waitForTimeout(2600);

const target = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!g || !map) return null;
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  const settlements = Array.isArray(map.settlements) ? map.settlements : [];
  const wanted = settlements.find((s) => {
    const owner = String(s?.owner || s?.ownerFactionId || '').toLowerCase();
    const type = String(s?.type || '').toLowerCase();
    return owner === 'ottoman' && (type === 'city' || type === 'town' || type === 'fort');
  }) || settlements.find((s) => String(s?.type || '').toLowerCase() === 'city') || settlements[0];
  if (!wanted) return null;
  const T = Number.isFinite(map.tileSize) ? map.tileSize : 32;
  const tx = Number.isFinite(wanted.tx) ? wanted.tx : Math.floor((wanted.x || 0) / T);
  const ty = Number.isFinite(wanted.ty) ? wanted.ty : Math.floor((wanted.y || 0) / T);
  const cx = Number.isFinite(wanted.x) ? wanted.x : (tx + 0.5) * T;
  const cy = Number.isFinite(wanted.y) ? wanted.y : (ty + 0.5) * T;
  const viewW = Number(g.canvas?.width) || 1366;
  const viewH = Number(g.canvas?.height) || 768;
  g.state.camera.x = Math.max(0, cx - viewW * 0.5);
  g.state.camera.y = Math.max(0, cy - viewH * 0.5);
  return { name: wanted.name, owner: wanted.owner, ownerFactionId: wanted.ownerFactionId, type: wanted.type, tx, ty };
});

await page.waitForTimeout(900);
const outPath = path.join(outDir, 'map-ottoman-settlement-generated.png');
await page.screenshot({ path: outPath, fullPage: false });
console.log(JSON.stringify({ outPath, target }, null, 2));

await browser.close();

