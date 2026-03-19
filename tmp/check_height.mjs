import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(1200);
const stats = await page.evaluate(() => {
  const tiles = window.game?.state?.map?.tiles || [];
  let min = 1e9, max = -1e9;
  for (const t of tiles) { const h = Number(t?.height); if (Number.isFinite(h)) { if (h < min) min = h; if (h > max) max = h; } }
  return { min, max, count: tiles.length };
});
console.log(JSON.stringify(stats));
await browser.close();
