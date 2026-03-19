import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(120000);
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2200);

const targets = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!map) return { targets: [], counts: { forests: 0, mountains: 0 } };
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;

  const setFrom = (arr) => new Set((arr || []).map((p) => `${p.x},${p.y}`));
  const mset = setFrom(map.mountains);
  const fset = setFrom(map.forests);
  const score = (x, y, set) => {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (set.has(`${x + dx},${y + dy}`)) n++;
      }
    }
    return n;
  };

  let bestM = null; let bestMS = -1;
  for (const m of map.mountains || []) {
    const s = score(m.x, m.y, mset);
    if (s > bestMS) { bestMS = s; bestM = m; }
  }
  let bestF = null; let bestFS = -1;
  for (const f of map.forests || []) {
    const s = score(f.x, f.y, fset);
    if (s > bestFS) { bestFS = s; bestF = f; }
  }

  const t = [];
  if (bestM) t.push({ kind: 'mountain', x: bestM.x, y: bestM.y, score: bestMS });
  if (bestF) t.push({ kind: 'forest', x: bestF.x, y: bestF.y, score: bestFS });
  return { targets: t, counts: { forests: (map.forests || []).length, mountains: (map.mountains || []).length } };
});

console.log(JSON.stringify(targets, null, 2));

const canvas = page.locator('canvas').first();
for (const target of targets.targets) {
  await page.evaluate((t) => {
    const g = window.game;
    if (!g?.state?.camera) return;
    g.followParty = false;
    const T = g.CONST?.WORLD?.TILE_SIZE || 60;
    const cx = t.x * T + T * 0.5;
    const cy = t.y * T + T * 0.5;
    g.state.camera.x = Math.max(0, cx - 640);
    g.state.camera.y = Math.max(0, cy - 360);
  }, target);
  await page.waitForTimeout(900);
  await canvas.screenshot({ path: path.join(outDir, `map-style-${target.kind}.png`) });
}

await canvas.screenshot({ path: path.join(outDir, 'map-style-current.png') });
await browser.close();
