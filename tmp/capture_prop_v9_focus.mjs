import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(120000);
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const b = document.getElementById('bootNotice');
  if (b) b.style.display = 'none';
});
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2200);

const targets = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!map) return null;
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
  return {
    tileSize: Number.isFinite(map.tileSize) ? map.tileSize : 32,
    mountain: bestM ? { x: bestM.x, y: bestM.y, score: bestMS } : null,
    forest: bestF ? { x: bestF.x, y: bestF.y, score: bestFS } : null,
  };
});

console.log(JSON.stringify(targets, null, 2));
const cap = async (name, t) => {
  if (!t) return;
  await page.evaluate(({ t }) => {
    const g = window.game;
    const map = g?.state?.map;
    const T = Number.isFinite(map?.tileSize) ? map.tileSize : 32;
    const cx = t.x * T + T * 0.5;
    const cy = t.y * T + T * 0.5;
    g.state.camera.x = Math.max(0, cx - 800);
    g.state.camera.y = Math.max(0, cy - 450);
    g.followParty = false;
  }, { t });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, `map-prop-v9-${name}.png`) });
};

await cap('mountain', targets?.mountain);
await cap('forest', targets?.forest);

await browser.close();
