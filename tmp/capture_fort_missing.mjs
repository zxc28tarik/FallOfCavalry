import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
const targets = [
  { fid: 'ottoman', tx: 849, ty: 628 },
  { fid: 'hre', tx: 627, ty: 502 },
  { fid: 'venice', tx: 1051, ty: 449 },
];

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.setDefaultTimeout(90000);
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1300);
await page.evaluate(() => {
  const b = document.getElementById('bootNotice');
  if (b) b.style.display = 'none';
});
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2200);
await page.evaluate(() => {
  const g = window.game;
  if (g?.state?.map?.fog instanceof Uint8Array) g.state.map.fog.fill(2);
  if (g) g.followParty = false;
});
for (const t of targets) {
  await page.evaluate((item) => {
    const g = window.game;
    const map = g?.state?.map;
    const T = Number.isFinite(map?.tileSize) ? map.tileSize : 32;
    const cx = item.tx * T + T * 0.5;
    const cy = item.ty * T + T * 0.5;
    g.state.camera.x = Math.max(0, cx - 800);
    g.state.camera.y = Math.max(0, cy - 450);
    g.followParty = false;
  }, t);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, `map-fort-faction-${t.fid}.png`) });
}
await browser.close();
