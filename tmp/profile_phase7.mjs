import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT_DIR = 'C:/Users/zxc28/Desktop/FallOfCavalry/output/web-game';
const OUT_JSON = path.join(OUT_DIR, 'phase7-performance-profile.json');
const OUT_MD = path.join(OUT_DIR, 'phase7-performance-profile.md');
const OUT_SNAPSHOT = path.join(OUT_DIR, 'phase7-performance-pass.png');

fs.mkdirSync(OUT_DIR, { recursive: true });

function asNum(v, fallback = 0) {
  return Number.isFinite(v) ? Number(v) : fallback;
}

function avg(list) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

function summarize(samples) {
  const fps = samples.map((s) => asNum(s.telemetry?.avgFps, 0)).filter((v) => v > 0);
  const ms = samples.map((s) => asNum(s.telemetry?.avgMs, 0)).filter((v) => v > 0);
  const manualMs = samples.map((s) => asNum(s.manualRenderMs, 0)).filter((v) => v > 0);
  const worldStage = samples
    .map((s) => {
      const item = (s.stageTelemetry || []).find((x) => x?.stage === 'world');
      return asNum(item?.avgMs, NaN);
    })
    .filter((v) => Number.isFinite(v));
  const fxStage = samples
    .map((s) => {
      const item = (s.stageTelemetry || []).find((x) => x?.stage === 'fx');
      return asNum(item?.avgMs, NaN);
    })
    .filter((v) => Number.isFinite(v));
  const uiStage = samples
    .map((s) => {
      const item = (s.stageTelemetry || []).find((x) => x?.stage === 'ui');
      return asNum(item?.avgMs, NaN);
    })
    .filter((v) => Number.isFinite(v));
  const qualityLevels = samples.map((s) => asNum(s.telemetry?.effectiveLevel, -1)).filter((v) => v >= 0);
  const lodLevels = new Map();
  for (const sample of samples) {
    const key = sample?.lodLevel || 'unknown';
    lodLevels.set(key, (lodLevels.get(key) || 0) + 1);
  }

  return {
    sampleCount: samples.length,
    fps: {
      avg: avg(fps),
      min: fps.length ? Math.min(...fps) : 0,
      max: fps.length ? Math.max(...fps) : 0,
      p50: percentile(fps, 50),
      p95: percentile(fps, 95),
    },
    frameMs: {
      avg: avg(ms),
      min: ms.length ? Math.min(...ms) : 0,
      max: ms.length ? Math.max(...ms) : 0,
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
    },
    manualRenderMs: {
      avg: avg(manualMs),
      min: manualMs.length ? Math.min(...manualMs) : 0,
      max: manualMs.length ? Math.max(...manualMs) : 0,
      p50: percentile(manualMs, 50),
      p95: percentile(manualMs, 95),
    },
    stageMs: {
      worldAvg: avg(worldStage),
      fxAvg: avg(fxStage),
      uiAvg: avg(uiStage),
    },
    quality: {
      avgLevel: avg(qualityLevels),
      minLevel: qualityLevels.length ? Math.min(...qualityLevels) : 0,
      maxLevel: qualityLevels.length ? Math.max(...qualityLevels) : 0,
    },
    lodDistribution: Object.fromEntries(lodLevels.entries()),
  };
}

function toMarkdown(result) {
  const s = result.summary;
  const map = result.mapInfo || {};
  const counts = result.worldCounts || {};
  return [
    '# Phase 7 Performance Profile',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    `- Samples: ${s.sampleCount}`,
    `- Resolution: ${result.viewport.width}x${result.viewport.height}`,
    `- Map: ${map.width || '?'}x${map.height || '?'} tiles`,
    `- World counts: settlements=${counts.settlements || 0}, forests=${counts.forests || 0}, mountains=${counts.mountains || 0}`,
    '',
    '## FPS',
    `- avg=${s.fps.avg.toFixed(2)} min=${s.fps.min.toFixed(2)} max=${s.fps.max.toFixed(2)} p50=${s.fps.p50.toFixed(2)} p95=${s.fps.p95.toFixed(2)}`,
    '',
    '## Frame Time (ms)',
    `- avg=${s.frameMs.avg.toFixed(2)} min=${s.frameMs.min.toFixed(2)} max=${s.frameMs.max.toFixed(2)} p50=${s.frameMs.p50.toFixed(2)} p95=${s.frameMs.p95.toFixed(2)}`,
    '',
    '## Manual Render Time (ms)',
    `- avg=${s.manualRenderMs.avg.toFixed(2)} min=${s.manualRenderMs.min.toFixed(2)} max=${s.manualRenderMs.max.toFixed(2)} p50=${s.manualRenderMs.p50.toFixed(2)} p95=${s.manualRenderMs.p95.toFixed(2)}`,
    '',
    '## Stage Averages (ms)',
    `- world=${s.stageMs.worldAvg.toFixed(2)} fx=${s.stageMs.fxAvg.toFixed(2)} ui=${s.stageMs.uiAvg.toFixed(2)}`,
    '',
    '## Adaptive Quality',
    `- level avg=${s.quality.avgLevel.toFixed(2)} min=${s.quality.minLevel} max=${s.quality.maxLevel}`,
    `- lod distribution=${JSON.stringify(s.lodDistribution)}`,
    '',
  ].join('\n');
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});

const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
page.setDefaultTimeout(45000);

console.log('[profile] open');
await page.goto('http://127.0.0.1:5173', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const boot = document.getElementById('bootNotice');
  if (boot) boot.style.display = 'none';
});
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
  await browser.close();
  throw new Error(`[profile] startNewGame did not enter map mode (mode=${modeAfterFastStart})`);
}
console.log('[profile] map-ready');

const init = await page.evaluate(() => {
  const g = window.game;
  if (!g?.state?.map || !g?.state?.camera || !g?.renderManager) return null;
  const map = g.state.map;
  const tileSize = Number(g.CONST?.WORLD?.TILE_SIZE || 32);

  if (map.fog instanceof Uint8Array) map.fog.fill(2);
  g.followParty = false;
  g.renderManager.dimetricWireframeEnabled = false;

  const countNeighbors = (arr, x, y) => {
    const set = new Set((arr || []).map((p) => `${p.x},${p.y}`));
    let n = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        if (set.has(`${x + dx},${y + dy}`)) n += 1;
      }
    }
    return n;
  };

  let bestForest = null;
  let bestForestScore = -1;
  for (const f of map.forests || []) {
    const score = countNeighbors(map.forests, f.x, f.y);
    if (score > bestForestScore) {
      bestForestScore = score;
      bestForest = f;
    }
  }

  let bestMountain = null;
  let bestMountainScore = -1;
  for (const m of map.mountains || []) {
    const score = countNeighbors(map.mountains, m.x, m.y);
    if (score > bestMountainScore) {
      bestMountainScore = score;
      bestMountain = m;
    }
  }

  const party = g.playerParty;
  const points = [];
  if (party && Number.isFinite(party.x) && Number.isFinite(party.y)) {
    points.push({ x: party.x, y: party.y, tag: 'spawn' });
  }
  if (bestForest) {
    points.push({ x: (bestForest.x + 0.5) * tileSize, y: (bestForest.y + 0.5) * tileSize, tag: 'forest' });
  }
  if (bestMountain) {
    points.push({ x: (bestMountain.x + 0.5) * tileSize, y: (bestMountain.y + 0.5) * tileSize, tag: 'mountain' });
  }
  if (!points.length) {
    points.push({ x: map.width * tileSize * 0.5, y: map.height * tileSize * 0.5, tag: 'center' });
  }

  return {
    points,
    map: { width: map.width, height: map.height },
    counts: {
      settlements: (map.settlements || []).length,
      forests: (map.forests || []).length,
      mountains: (map.mountains || []).length,
    },
  };
});

if (!init) {
  await browser.close();
  throw new Error('Game runtime not initialized for profiling.');
}

await page.evaluate(({ points }) => {
  window.__phase7ProfilePoints = points || [];
}, { points: init.points });

const samples = [];
const tickCount = 8;
console.log('[profile] sampling-start');
const pageSamples = await page.evaluate(({ tickCount }) => {
    const g = window.game;
    const rm = g?.renderManager;
    if (!g?.state?.camera || !rm) return [];
    const points = window.__phase7ProfilePoints || [];
    const zCycle = [0.62, 0.78, 1.0, 1.22];
    const out = [];

    if (typeof rm.dimetricPerformance?.reset === 'function') rm.dimetricPerformance.reset(0);
    rm.dimetricStageTelemetry = [];

    for (let i = 0; i < tickCount; i += 1) {
      const idxA = points.length ? (i % points.length) : 0;
      const idxB = points.length ? ((i + 1) % points.length) : 0;
      const t = (i % 8) / 8;
      const a = points[idxA] || { x: 0, y: 0, tag: 'none' };
      const b = points[idxB] || a;
      const tx = a.x + ((b.x - a.x) * t);
      const ty = a.y + ((b.y - a.y) * t);
      const zoom = zCycle[i % zCycle.length];
      const viewW = Number(g.canvas?.width || 1366);
      const viewH = Number(g.canvas?.height || 768);

      g.state.camera.zoom = zoom;
      g.state.camera.x = Math.max(0, tx - (viewW * 0.5) / zoom);
      g.state.camera.y = Math.max(0, ty - (viewH * 0.5) / zoom);
      if (typeof g.worldManager?.clampCameraToWorld === 'function') g.worldManager.clampCameraToWorld();

      const t0 = performance.now();
      rm.renderMap();
      const t1 = performance.now();

      const telemetry = rm.dimetricPerformance?.getTelemetry?.() || null;
      const stageTelemetry = Array.isArray(rm.dimetricStageTelemetry) ? rm.dimetricStageTelemetry : [];
      const cacheStats = rm.dimetricTerrainCache?.getStats?.() || null;
      out.push({
        tick: i,
        pointA: a.tag,
        pointB: b.tag,
        zoom,
        lodLevel: rm.dimetricLodLevel || 'unknown',
        manualRenderMs: Math.max(0.01, t1 - t0),
        telemetry,
        stageTelemetry,
        cacheStats,
      });
    }

    return out;
  }, { tickCount });
if (Array.isArray(pageSamples)) samples.push(...pageSamples);
console.log('[profile] sampling-done');
const pngBase64 = await page.evaluate(() => {
  try {
    const list = Array.from(document.querySelectorAll('canvas'));
    if (!list.length) return '';
    const best = list.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    const data = best?.toDataURL?.('image/png') || '';
    const idx = data.indexOf(',');
    return idx === -1 ? '' : data.slice(idx + 1);
  } catch {
    return '';
  }
});
if (pngBase64) {
  fs.writeFileSync(OUT_SNAPSHOT, Buffer.from(pngBase64, 'base64'));
}
await browser.close();
console.log('[profile] closed');

const summary = summarize(samples);
const result = {
  timestampIso: new Date().toISOString(),
  viewport: { width: 1366, height: 768 },
  mapInfo: init.map,
  worldCounts: init.counts,
  points: init.points,
  summary,
  samples,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(result, null, 2));
fs.writeFileSync(OUT_MD, toMarkdown(result));
console.log(JSON.stringify({ ok: true, outJson: OUT_JSON, outMd: OUT_MD, sampleCount: samples.length, summary }, null, 2));
