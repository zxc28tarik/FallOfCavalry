import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(90000);
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const b = document.getElementById('bootNotice');
  if (b) b.style.display = 'none';
});
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(1800);

const targets = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!map) return [];
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  const sets = Array.isArray(map.settlements) ? map.settlements : [];
  const city = sets.find(s => ['city','town'].includes(String(s.type || '').toLowerCase()));
  const fort = sets.find(s => String(s.type || '').toLowerCase() === 'fort');
  return [city, fort].filter(Boolean).map((s, i) => ({
    kind: i === 0 ? 'city' : 'fort',
    tx: s.tx,
    ty: s.ty,
  }));
});

for (const t of targets) {
  await page.evaluate((target) => {
    const g = window.game;
    const map = g?.state?.map;
    const T = Number.isFinite(map?.tileSize) ? map.tileSize : 32;
    const cx = target.tx * T + T * 0.5;
    const cy = target.ty * T + T * 0.5;
    g.state.camera.x = Math.max(0, cx - 800);
    g.state.camera.y = Math.max(0, cy - 450);
  }, t);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, `map-settlement-v9-${t.kind}.png`) });
}

await browser.close();
