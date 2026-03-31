import fs from 'node:fs';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';

const OUT_DIR = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
const OUT_JSON = path.join(OUT_DIR, 'phase7-cross-browser.json');
const OUT_MD = path.join(OUT_DIR, 'phase7-cross-browser.md');

fs.mkdirSync(OUT_DIR, { recursive: true });

const browserMatrix = [
  { name: 'chromium', type: chromium },
  { name: 'firefox', type: firefox },
  { name: 'webkit', type: webkit },
];

function asNum(v, fallback = 0) {
  return Number.isFinite(v) ? Number(v) : fallback;
}

function toMarkdown(results) {
  const lines = [
    '# Phase 7 Cross Browser Smoke',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    '',
    '| Browser | Status | Errors | Avg FPS | Avg Ms | Screenshot |',
    '|---|---:|---:|---:|---:|---|',
  ];
  for (const r of results) {
    const avgFps = asNum(r.telemetry?.avgFps, 0).toFixed(2);
    const avgMs = asNum(r.telemetry?.avgMs, 0).toFixed(2);
    const errors = asNum(r.errors?.length, 0);
    const shot = r.screenshotPath ? path.basename(r.screenshotPath) : '-';
    lines.push(`| ${r.browser} | ${r.status} | ${errors} | ${avgFps} | ${avgMs} | ${shot} |`);
    if (r.failureReason) {
      const firstLine = String(r.failureReason).split('\n').find((line) => line.trim().length > 0) || String(r.failureReason);
      const sanitized = firstLine.replace(/[^\x20-\x7E]/g, '').replace(/\|/g, '/');
      lines.push(`| ${r.browser} detail | ${sanitized} | - | - | - | - |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function tryWriteCanvasSnapshot(dataUrl, outPath) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return false;
  const b64 = dataUrl.slice('data:image/png;base64,'.length);
  if (!b64) return false;
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return true;
}

async function runOne(entry) {
  const result = {
    browser: entry.name,
    status: 'fail',
    telemetry: null,
    stageTelemetry: [],
    errors: [],
    screenshotPath: '',
    failureReason: '',
  };
  let browser = null;
  let page = null;
  try {
    browser = await entry.type.launch({
      headless: true,
      ...(entry.name === 'chromium'
        ? { args: ['--use-gl=angle', '--use-angle=swiftshader'] }
        : {}),
    });
    page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(45000);

    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push({ type: 'console', text: msg.text() });
    });
    page.on('pageerror', (err) => {
      errors.push({ type: 'pageerror', text: String(err) });
    });

    await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const boot = document.getElementById('bootNotice');
      if (boot) boot.style.display = 'none';
    });
    console.log(`[cross-browser] ${entry.name}: open`);
    await page.evaluate(() => {
      const g = window.game;
      if (!g?.gameFlowManager) return;
      const ss = g.gameFlowManager.startScreen;
      if (ss?.selectFaction) ss.selectFaction('ottoman');
      if (typeof g.gameFlowManager.startNewGame === 'function') {
        g.gameFlowManager.startNewGame();
      }
    });
    await page.waitForTimeout(1800);
    const modeAfterFastStart = await page.evaluate(() => window.game?.state?.mode || null);
    if (modeAfterFastStart !== 'map') {
      result.status = 'fail';
      result.failureReason = `startNewGame did not enter map mode (mode=${modeAfterFastStart})`;
      result.errors = errors;
      return result;
    }

    const snapshot = await page.evaluate(() => {
      const g = window.game;
      if (!g?.renderManager || !g?.state?.map) return null;
      if (g.state.map.fog instanceof Uint8Array) g.state.map.fog.fill(2);
      g.followParty = false;
      g.renderManager.dimetricWireframeEnabled = false;
      const telemetry = g.renderManager.dimetricPerformance?.getTelemetry?.() || null;
      let canvasDataUrl = '';
      try {
        const list = Array.from(document.querySelectorAll('canvas'));
        if (list.length) {
          const best = list.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
          canvasDataUrl = best?.toDataURL?.('image/png') || '';
        }
      } catch {}
      return {
        telemetry,
        stageTelemetry: Array.isArray(g.renderManager.dimetricStageTelemetry)
          ? g.renderManager.dimetricStageTelemetry
          : [],
        canvasDataUrl,
      };
    });

    const screenshotPath = path.join(OUT_DIR, `phase7-browser-${entry.name}.png`);
    const hasSnapshot = tryWriteCanvasSnapshot(snapshot?.canvasDataUrl || '', screenshotPath);
    console.log(`[cross-browser] ${entry.name}: sampled`);

    result.status = snapshot ? 'pass' : 'fail';
    result.telemetry = snapshot?.telemetry || null;
    result.stageTelemetry = snapshot?.stageTelemetry || [];
    result.errors = errors;
    result.screenshotPath = hasSnapshot ? screenshotPath : '';
    if (!snapshot) result.failureReason = 'game runtime not initialized';
  } catch (err) {
    result.status = 'fail';
    result.failureReason = String(err?.message || err);
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
  return result;
}

const results = [];
for (const entry of browserMatrix) {
  const run = await runOne(entry);
  results.push(run);
}

const payload = {
  timestampIso: new Date().toISOString(),
  results,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));
fs.writeFileSync(OUT_MD, toMarkdown(results));
console.log(JSON.stringify({ ok: true, outJson: OUT_JSON, outMd: OUT_MD, results }, null, 2));
