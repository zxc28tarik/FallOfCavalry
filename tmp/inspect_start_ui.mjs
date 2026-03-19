import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const data = await page.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const faction = document.querySelector('.faction-card')?.getBoundingClientRect();
  const startBtnEl = document.querySelector('#btnStart');
  const startBtn = startBtnEl?.getBoundingClientRect();
  return {
    canvases,
    faction: faction ? { x: faction.x, y: faction.y, w: faction.width, h: faction.height } : null,
    startBtn: startBtn
      ? { x: startBtn.x, y: startBtn.y, w: startBtn.width, h: startBtn.height, disabled: Boolean(startBtnEl?.disabled) }
      : null,
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
