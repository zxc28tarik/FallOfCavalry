import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport:{width:1200,height:800} });
await page.goto('http://127.0.0.1:5173', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(2000);
const result = await page.evaluate(() => {
  const settlements = window.game?.state?.map?.settlements || [];
  const cityRegionVariant = (s, count = 6) => {
    const tx = Number.isFinite(s?.tx) ? s.tx : Math.floor((s?.x || 0) / 32);
    const ty = Number.isFinite(s?.ty) ? s.ty : Math.floor((s?.y || 0) / 32);
    const gx = Math.floor(tx / 96);
    const gy = Math.floor(ty / 84);
    const owner = s?.ownerFactionId || s?.owner || 'bandit';
    const text = `${owner}:${gx}:${gy}`;
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i) & 255;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return Math.max(0, h % Math.max(1, count));
  };
  const out = {};
  for (const s of settlements) {
    const t = String(s?.type || '').toLowerCase();
    if (t !== 'city' && t !== 'town') continue;
    const fid = String(s?.ownerFactionId || s?.owner || 'bandit').toLowerCase();
    const rv = cityRegionVariant(s, 6);
    if (!out[fid]) out[fid] = new Set();
    out[fid].add(rv);
  }
  const plain = {};
  for (const [k, set] of Object.entries(out)) plain[k] = [...set].sort((a,b)=>a-b);
  return plain;
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
