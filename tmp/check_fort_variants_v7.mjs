import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport:{width:1280,height:720} });
await page.goto('http://127.0.0.1:5173', { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1200);
await page.click('.faction-card');
await page.click('#btnStart');
await page.waitForTimeout(1800);
const result = await page.evaluate(() => {
  const settlements = window.game?.state?.map?.settlements || [];
  const hash32 = (text) => {
    const s = String(text || '');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i) & 255;
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };
  const seedOf = (settlement, salt = 1709) => {
    let h = (0x9e3779b9 ^ (salt >>> 0)) >>> 0;
    const id = Number.isFinite(settlement?.id) ? settlement.id : 0;
    const tx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor((settlement?.x || 0) / 32);
    const ty = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor((settlement?.y || 0) / 32);
    h ^= Math.imul((id + 31) >>> 0, 2246822519) >>> 0;
    h ^= Math.imul((tx + 131) >>> 0, 3266489917) >>> 0;
    h ^= Math.imul((ty + 911) >>> 0, 668265263) >>> 0;
    h ^= hash32(`${settlement?.name || ''}:${settlement?.ownerFactionId || settlement?.owner || ''}`);
    return h >>> 0;
  };
  const lenByFaction = { ottoman:7, hre:7, polish:7, spanish:7, venice:7, bandit:7 };
  const counts = {};
  for (const s of settlements) {
    if (String(s?.type || '').toLowerCase() !== 'fort') continue;
    const fid = String(s?.ownerFactionId || s?.owner || 'bandit').toLowerCase();
    const len = lenByFaction[fid] || 7;
    const v = seedOf(s) % len;
    if (!counts[fid]) counts[fid] = new Set();
    counts[fid].add(v);
  }
  const out = {};
  for (const [k, set] of Object.entries(counts)) out[k] = [...set].sort((a,b)=>a-b);
  return out;
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
