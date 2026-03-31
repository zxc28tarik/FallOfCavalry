import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'map-ottoman-settlement-generated.png');

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(120000);
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.locator('.faction-card').first().click();
await page.locator('#btnStart').click();
await page.waitForTimeout(2800);

const payload = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!g || !map) return null;
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  const target = (map.settlements || []).find((s) => String(s?.name || '').toLowerCase() === 'ankara')
    || (map.settlements || []).find((s) => ['city', 'town'].includes(String(s?.type || '').toLowerCase()))
    || (map.settlements || [])[0];
  if (!target) return null;
  const T = Number.isFinite(map.tileSize) ? map.tileSize : 32;
  const tx = Number.isFinite(target.tx) ? target.tx : Math.floor((target.x || 0) / T);
  const ty = Number.isFinite(target.ty) ? target.ty : Math.floor((target.y || 0) / T);
  const cx = Number.isFinite(target.x) ? target.x : (tx + 0.5) * T;
  const cy = Number.isFinite(target.y) ? target.y : (ty + 0.5) * T;
  g.state.camera.x = Math.max(0, cx - (g.canvas?.width || 1366) * 0.5);
  g.state.camera.y = Math.max(0, cy - (g.canvas?.height || 768) * 0.5);

  const dbg = (window.__codexSettlementDebug || {})[String(target.name)] || null;
  const dataURL = g.canvas?.toDataURL?.('image/png') || null;
  return {
    target: {
      name: target.name,
      owner: target.owner,
      ownerFactionId: target.ownerFactionId,
      type: target.type,
      tx,
      ty,
    },
    debug: dbg,
    dataURL,
  };
});

if (!payload?.dataURL) {
  throw new Error('Failed to capture canvas data URL.');
}

const base64 = payload.dataURL.split(',')[1] || '';
fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
console.log(JSON.stringify({ outPath, target: payload.target, debug: payload.debug }, null, 2));

await browser.close();

