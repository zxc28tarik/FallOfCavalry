import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport:{width:1200,height:800} });
await page.goto('http://127.0.0.1:5173', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2000);
const data = await page.evaluate(() => {
  const g = window.game;
  const T = g?.CONST?.WORLD?.TILE_SIZE;
  const settlements = (g?.state?.map?.settlements || []).slice(0, 8).map(s => ({
    name: s.name, type: s.type, tx: s.tx, ty: s.ty, x: s.x, y: s.y,
  }));
  const city = (g?.state?.map?.settlements || []).find(s => ['city','town'].includes(String(s.type).toLowerCase()));
  const fort = (g?.state?.map?.settlements || []).find(s => String(s.type).toLowerCase()==='fort');
  const village = (g?.state?.map?.settlements || []).find(s => String(s.type).toLowerCase()==='village');
  return { T, camera: g?.state?.camera, city, fort, village, sample:settlements };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
