import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1420, height: 860 } });
page.setDefaultTimeout(120000);

await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

const factionCard = page.locator('.faction-card').first();
if (await factionCard.count()) await factionCard.click();
if (await page.locator('#btnStart').count()) await page.click('#btnStart');
await page.waitForTimeout(2600);

const diag = await page.evaluate(() => {
  const g = window.game;
  const map = g?.state?.map;
  if (!map) return { ok: false, reason: 'map missing' };
  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  return {
    ok: true,
    size: [map.width, map.height],
    settlements: (map.settlements || []).length,
    zones: (map.factionZones || []).map((z) => ({ owner: z.owner, x: z.x, y: z.y, w: z.w, h: z.h })),
  };
});

await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, 'minimap-zones-full.png') });
const mini = page.locator('#hudMiniMap');
if (await mini.count()) {
  await mini.screenshot({ path: path.join(outDir, 'minimap-zones-panel.png') });
}

console.log(JSON.stringify(diag, null, 2));
await browser.close();
