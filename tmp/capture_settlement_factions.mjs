import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1300);
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2200);

const data = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!map) return { T: 32, cities: [], forts: [] };
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  const T = Number.isFinite(map.tileSize) ? map.tileSize : 32;
  const settlements = Array.isArray(map.settlements) ? map.settlements : [];
  const byFactionType = (types) => {
    const out = new Map();
    for (const s of settlements) {
      const t = String(s?.type || '').toLowerCase();
      if (!types.includes(t)) continue;
      const fid = String(s?.ownerFactionId || s?.owner || 'bandit').toLowerCase();
      if (!out.has(fid)) out.set(fid, s);
    }
    return [...out.entries()].map(([fid, s]) => ({ fid, tx: s.tx, ty: s.ty, name: s.name, type: s.type }));
  };
  return {
    T,
    cities: byFactionType(['city','town']),
    forts: byFactionType(['fort']),
  };
});

console.log(JSON.stringify(data, null, 2));
const canvas = page.locator('canvas').first();

const cap = async (item, prefix) => {
  await page.evaluate(({ tx, ty }) => {
    const g = window.game;
    const map = g?.state?.map;
    const T = Number.isFinite(map?.tileSize) ? map.tileSize : 32;
    const cx = tx * T + T * 0.5;
    const cy = ty * T + T * 0.5;
    g.state.camera.x = Math.max(0, cx - 800);
    g.state.camera.y = Math.max(0, cy - 450);
    g.followParty = false;
  }, item);
  await page.waitForTimeout(750);
  const fn = `${prefix}-${item.fid}.png`;
  await canvas.screenshot({ path: path.join(outDir, fn) });
};

for (const c of data.cities) await cap(c, 'map-city-faction');
for (const f of data.forts) await cap(f, 'map-fort-faction');

await browser.close();
