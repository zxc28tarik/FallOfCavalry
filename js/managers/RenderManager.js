/**
 * RenderManager — Phase 7
 * Canvas render methods extracted from main.js (renderStart, renderEncounter,
 * renderCity, renderDebugInfo, renderWorldTerrain, renderMap, renderWorldOverlays).
 * renderBattle() stays as a delegation wrapper in main.js.
 */

import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import * as CONST from '../constants.js';
import * as utils from '../utils.js';
import { getWeatherTint } from '../systems/weather.js';
import { renderWeatherOverlay } from '../rendering/weather-layer.js';
import SpriteLoader from '../rendering/sprite-loader.js';
import h3MapArt from '../data/homm3-map-art.json';

// ══════════════════════════════════════════════════════════════════════════
// HoMM3 + Mount & Blade style overworld helpers (module scope)
// ══════════════════════════════════════════════════════════════════════════

function _dk(hex, amt = 0.44) {
  try {
    const c = parseInt(hex.replace('#',''), 16);
    const f = 1 - amt;
    return `rgb(${Math.round((c>>16)*f)},${Math.round(((c>>8)&0xff)*f)},${Math.round((c&0xff)*f)})`;
  } catch { return '#333'; }
}

function _lt(hex, amt = 0.30) {
  try {
    const c = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, Math.round((c>>16) + 255*amt));
    const g = Math.min(255, Math.round(((c>>8)&0xff) + 255*amt));
    const b = Math.min(255, Math.round((c&0xff) + 255*amt));
    return `rgb(${r},${g},${b})`;
  } catch { return '#ccc'; }
}

function _ellipse(ctx, x, y, radiusX, radiusY, rotation, startAngle, endAngle) {
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle);
    return;
  }
  if (typeof ctx.arc === 'function') {
    ctx.arc(x, y, Math.max(radiusX, radiusY), startAngle, endAngle);
  }
}

function _snap(v, step = 1) {
  return Math.round(v / step) * step;
}

function _clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function _rgb(rgb, alpha = 1) {
  const r = _clampByte(rgb[0]);
  const g = _clampByte(rgb[1]);
  const b = _clampByte(rgb[2]);
  if (alpha >= 0.999) return `rgb(${r},${g},${b})`;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function _shade(rgb, delta) {
  return [
    _clampByte(rgb[0] + delta),
    _clampByte(rgb[1] + delta),
    _clampByte(rgb[2] + delta),
  ];
}

function _mixRgb(a, b, t) {
  return [
    _clampByte(a[0] + (b[0] - a[0]) * t),
    _clampByte(a[1] + (b[1] - a[1]) * t),
    _clampByte(a[2] + (b[2] - a[2]) * t),
  ];
}

function _terrainNoise(x, y, seed = 0) {
  const n = Math.sin((x * 12.9898) + (y * 78.233) + seed * 31.337) * 43758.5453;
  return n - Math.floor(n);
}

const _H3_TERRAIN_DATA = h3MapArt?.terrain || {};
const _H3_PROP_DATA = h3MapArt?.props || {};
const _BIOME_TO_H3_KEY = Object.freeze({
  [CONST.BIOME.SEA]: 'SEA',
  [CONST.BIOME.SHORE]: 'SHORE',
  [CONST.BIOME.PLAINS]: 'PLAINS',
  [CONST.BIOME.FOREST]: 'PLAINS',
  [CONST.BIOME.HILLS]: 'PLAINS',
  [CONST.BIOME.MOUNTAIN]: 'PLAINS',
  [CONST.BIOME.SNOW]: 'SNOW',
});
const _H3_FRAME_CACHE = new Map();

function _decodeBase64Bytes(b64) {
  if (typeof b64 !== 'string' || !b64) return null;
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return null;
}

function _terrainAvgColor(h3Key, fallback) {
  const src = _H3_TERRAIN_DATA?.[h3Key]?.avg;
  if (Array.isArray(src) && src.length === 3) return [_clampByte(src[0]), _clampByte(src[1]), _clampByte(src[2])];
  return fallback;
}

function _frameCacheKey(prefix, key, source, name) {
  return `${prefix}:${key || ''}:${source || ''}:${name || ''}`;
}

function _bitCount4(v) {
  const n = v & 15;
  return ((n >> 0) & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);
}

function _getFrameCanvas(frame, cacheKey) {
  if (!frame || frame.format !== 'rgba32-base64' || !Array.isArray(frame.size) || frame.size.length !== 2) return null;
  if (_H3_FRAME_CACHE.has(cacheKey)) return _H3_FRAME_CACHE.get(cacheKey);
  if (typeof document === 'undefined') {
    _H3_FRAME_CACHE.set(cacheKey, null);
    return null;
  }

  const w = Math.max(1, Number(frame.size[0]) | 0);
  const h = Math.max(1, Number(frame.size[1]) | 0);
  const rgba = _decodeBase64Bytes(frame.data);
  if (!rgba || rgba.length < w * h * 4) {
    _H3_FRAME_CACHE.set(cacheKey, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const cctx = canvas.getContext('2d');
  if (!cctx) {
    _H3_FRAME_CACHE.set(cacheKey, null);
    return null;
  }
  const img = cctx.createImageData(w, h);
  img.data.set(rgba.subarray(0, w * h * 4));
  cctx.putImageData(img, 0, 0);
  _H3_FRAME_CACHE.set(cacheKey, canvas);
  return canvas;
}

function _terrainTransitionMask(h3Key, neighbors) {
  if (!neighbors || !h3Key) return 0;
  let mask = 0;
  const nKey = _BIOME_TO_H3_KEY[neighbors?.n] || h3Key;
  const eKey = _BIOME_TO_H3_KEY[neighbors?.e] || h3Key;
  const sKey = _BIOME_TO_H3_KEY[neighbors?.s] || h3Key;
  const wKey = _BIOME_TO_H3_KEY[neighbors?.w] || h3Key;
  if (nKey !== h3Key) mask |= 1;
  if (eKey !== h3Key) mask |= 2;
  if (sKey !== h3Key) mask |= 4;
  if (wKey !== h3Key) mask |= 8;
  return mask;
}

function _pickTerrainFrame(h3Key, tx, ty, edgeMask = 0) {
  const terrain = _H3_TERRAIN_DATA?.[h3Key];
  const frames = terrain?.frames;
  if (!Array.isArray(frames) || !frames.length) return null;
  const groups = Array.isArray(terrain?.groups) ? terrain.groups : null;
  let pool = Array.isArray(groups?.[edgeMask]) ? groups[edgeMask] : null;
  if (!pool || !pool.length) {
    let best = null;
    for (let i = 0; i < 16; i++) {
      const g = groups?.[i];
      if (!Array.isArray(g) || !g.length) continue;
      const diff = _bitCount4((i ^ edgeMask) & 15) + Math.abs(_bitCount4(i) - _bitCount4(edgeMask)) * 0.15;
      if (!best || diff < best.diff) best = { diff, pool: g };
    }
    pool = best?.pool || null;
  }
  if (!pool || !pool.length) pool = groups?.[0] || null;
  if (!pool || !pool.length) {
    const n = _terrainNoise(tx * 0.317, ty * 0.229, 1943);
    const idx = Math.max(0, Math.min(frames.length - 1, Math.floor(n * frames.length)));
    return frames[idx];
  }
  const n = _terrainNoise(tx * 0.317 + edgeMask * 0.11, ty * 0.229 + edgeMask * 0.07, 1943);
  const pick = Math.max(0, Math.min(pool.length - 1, Math.floor(n * pool.length)));
  const idx = pool[pick];
  if (!Number.isFinite(idx) || idx < 0 || idx >= frames.length) return null;
  return frames[idx];
}

function _pickPropFrame(kind, tx, ty) {
  const frames = _H3_PROP_DATA?.[kind]?.frames;
  if (!Array.isArray(frames) || !frames.length) return null;
  let seed = 2683;
  if (kind === 'FOREST') seed = 2671;
  else if (kind === 'MOUNTAIN_LARGE') seed = 2699;
  const n = _terrainNoise(tx * 0.191, ty * 0.277, seed);
  const idx = Math.max(0, Math.min(frames.length - 1, Math.floor(n * frames.length)));
  return frames[idx];
}

function _drawPropFrame(ctx, entry, px, py, T, fogLevel, tx, ty, kind) {
  if (!entry?.frame) return false;
  const cacheKey = _frameCacheKey('prop', kind, entry.sourceDef, entry.frame.name);
  const canvas = _getFrameCanvas(entry.frame, cacheKey);
  if (!canvas) return false;

  const fw = canvas.width || 1;
  const fh = canvas.height || 1;
  const scaleSeed = kind === 'FOREST' ? 3119 : kind === 'MOUNTAIN_LARGE' ? 3151 : 3137;
  const scaleN = _terrainNoise(tx * 0.39 + 7, ty * 0.33 + 9, scaleSeed);
  const baseScale = kind === 'FOREST'
    ? 1.95
    : kind === 'MOUNTAIN_LARGE'
      ? 3.30
      : 1.65;
  const dynScale = kind === 'FOREST'
    ? 0.34
    : kind === 'MOUNTAIN_LARGE'
      ? 0.34
      : 0.30;
  const targetH = Math.max(8, T * (baseScale + scaleN * dynScale));
  const targetW = targetH * (fw / fh);
  const jitter = kind === 'FOREST' ? 0.20 : kind === 'MOUNTAIN_LARGE' ? 0.22 : 0.14;
  const jitterX = jitter * T * (_terrainNoise(tx * 0.91, ty * 0.73, 3163) - 0.5);
  const dx = _snap(px + (T - targetW) * 0.5 + jitterX, 1);
  const dy = _snap(py + T - targetH, 1);

  ctx.save();
  ctx.globalAlpha = fogLevel === 1 ? 0.62 : 1.0;
  ctx.drawImage(canvas, dx, dy, Math.round(targetW), Math.round(targetH));
  ctx.restore();
  return true;
}

function _macroGroundDelta(tx, ty) {
  const a = (_terrainNoise(tx * 0.23, ty * 0.23, 541) - 0.5) * 16;
  const b = (_terrainNoise(tx * 0.09 + 17, ty * 0.09 + 37, 557) - 0.5) * 10;
  return a + b;
}

const _GROUND_STYLE = Object.freeze({
  [CONST.BIOME.SEA]:      Object.freeze({ base: _terrainAvgColor('SEA', [44, 95, 142]), grain: 8, grainAlpha: 0.11, specks: 2, dotAlpha: 0.10, grass: 0 }),
  [CONST.BIOME.SHORE]:    Object.freeze({ base: _terrainAvgColor('SHORE', [156, 142, 98]), grain: 7, grainAlpha: 0.10, specks: 2, dotAlpha: 0.10, grass: 0 }),
  [CONST.BIOME.PLAINS]:   Object.freeze({ base: _terrainAvgColor('PLAINS', [92, 154, 60]), grain: 10, grainAlpha: 0.12, specks: 3, dotAlpha: 0.11, grass: 1 }),
  [CONST.BIOME.FOREST]:   Object.freeze({ base: _shade(_terrainAvgColor('PLAINS', [92, 154, 60]), -8), grain: 9, grainAlpha: 0.12, specks: 2, dotAlpha: 0.10, grass: 0 }),
  [CONST.BIOME.HILLS]:    Object.freeze({ base: _shade(_terrainAvgColor('PLAINS', [98, 154, 64]), -6), grain: 8, grainAlpha: 0.11, specks: 2, dotAlpha: 0.10, grass: 0 }),
  [CONST.BIOME.MOUNTAIN]: Object.freeze({ base: _shade(_terrainAvgColor('PLAINS', [98, 154, 64]), -12), grain: 7, grainAlpha: 0.10, specks: 2, dotAlpha: 0.10, grass: 0 }),
  [CONST.BIOME.SNOW]:     Object.freeze({ base: _terrainAvgColor('SNOW', [216, 225, 234]), grain: 6, grainAlpha: 0.09, specks: 2, dotAlpha: 0.09, grass: 0 }),
});

const _BIOME_HEIGHT_RANK = Object.freeze({
  [CONST.BIOME.SEA]: 0,
  [CONST.BIOME.SHORE]: 1,
  [CONST.BIOME.PLAINS]: 2,
  [CONST.BIOME.FOREST]: 3,
  [CONST.BIOME.HILLS]: 4,
  [CONST.BIOME.MOUNTAIN]: 5,
  [CONST.BIOME.SNOW]: 6,
});

function _paintRaggedEdge(ctx, px, py, T, tx, ty, side, rgb, alpha) {
  const segments = 6;
  const step = T / segments;
  ctx.fillStyle = _rgb(rgb, alpha);
  for (let i = 0; i < segments; i++) {
    const n = _terrainNoise(tx * 17 + (side === 'n' || side === 's' ? i : 0), ty * 17 + (side === 'e' || side === 'w' ? i : 0), 771 + i * 13);
    const depth = Math.max(1, Math.round((0.03 + n * 0.08) * T));
    if (side === 'n') {
      ctx.fillRect(px + i * step, py, step + 1, depth);
    } else if (side === 's') {
      ctx.fillRect(px + i * step, py + T - depth, step + 1, depth);
    } else if (side === 'w') {
      ctx.fillRect(px, py + i * step, depth, step + 1);
    } else {
      ctx.fillRect(px + T - depth, py + i * step, depth, step + 1);
    }
  }
}

function _paintTransitionBand(ctx, px, py, T, tx, ty, side, fromRgb, toRgb, towardHigher) {
  const segments = 8;
  const step = T / segments;
  for (let i = 0; i < segments; i++) {
    const sx = side === 'n' || side === 's' ? tx * 11 + i * 0.91 : tx * 11;
    const sy = side === 'e' || side === 'w' ? ty * 11 + i * 0.91 : ty * 11;
    const n = _terrainNoise(sx, sy, 901 + i * 17);
    if (n < 0.26) continue;

    const blend = 0.56 + n * 0.32;
    const fill = _mixRgb(fromRgb, toRgb, blend);
    const alpha = towardHigher ? 0.17 : 0.13;
    const span = Math.max(2, Math.round(step * (0.45 + n * 0.75)));
    const depth = Math.max(2, Math.round(T * (0.07 + n * 0.14)));
    const offset = Math.round((step - span) * 0.5);

    let rx;
    let ry;
    let rw = span;
    let rh = depth;
    if (side === 'n') {
      rx = _snap(px + i * step + offset, 1);
      ry = py;
    } else if (side === 's') {
      rx = _snap(px + i * step + offset, 1);
      ry = _snap(py + T - depth, 1);
    } else if (side === 'w') {
      rx = px;
      ry = _snap(py + i * step + offset, 1);
      rw = depth;
      rh = span;
    } else {
      rx = _snap(px + T - depth, 1);
      ry = _snap(py + i * step + offset, 1);
      rw = depth;
      rh = span;
    }

    ctx.fillStyle = _rgb(fill, alpha);
    ctx.fillRect(rx, ry, rw, rh);

    const rim = towardHigher ? _shade(fill, -14) : _shade(fill, 10);
    ctx.fillStyle = _rgb(rim, 0.08);
    if (side === 'n') ctx.fillRect(rx, ry + rh - 1, rw, 1);
    else if (side === 's') ctx.fillRect(rx, ry, rw, 1);
    else if (side === 'w') ctx.fillRect(rx + rw - 1, ry, 1, rh);
    else ctx.fillRect(rx, ry, 1, rh);
  }
}

function _paintCornerTransition(ctx, px, py, T, tx, ty, corner, fromRgb, toRgb) {
  const cidx = corner === 'nw' ? 0 : corner === 'ne' ? 1 : corner === 'se' ? 2 : 3;
  const n = _terrainNoise(tx * 17.3 + cidx * 1.7, ty * 19.9 + cidx * 1.3, 1201);
  if (n < 0.36) return;

  const size = Math.max(3, Math.round(T * (0.11 + n * 0.11)));
  const color = _mixRgb(fromRgb, toRgb, 0.62 + n * 0.22);
  ctx.fillStyle = _rgb(color, 0.10 + n * 0.06);

  for (let d = 0; d < size; d++) {
    const w = Math.max(1, size - d);
    if (corner === 'nw') {
      ctx.fillRect(px, py + d, w, 1);
    } else if (corner === 'ne') {
      ctx.fillRect(px + T - w, py + d, w, 1);
    } else if (corner === 'sw') {
      ctx.fillRect(px, py + T - d - 1, w, 1);
    } else {
      ctx.fillRect(px + T - w, py + T - d - 1, w, 1);
    }
  }
}

function mbTransitionTileSprites(ctx, px, py, T, biome, tx, ty, neighbors, style, baseTone) {
  const base = baseTone || style.base;
  const rank = _BIOME_HEIGHT_RANK[biome] ?? 2;
  const edgeDefs = [
    ['n', neighbors?.n, 0, -1],
    ['e', neighbors?.e, 1, 0],
    ['s', neighbors?.s, 0, 1],
    ['w', neighbors?.w, -1, 0],
  ];

  for (const [side, nb, dx, dy] of edgeDefs) {
    if (nb === biome || !Number.isFinite(nb)) continue;
    const nRank = _BIOME_HEIGHT_RANK[nb] ?? rank;
    const towardHigher = nRank > rank;
    const nbStyle = _GROUND_STYLE[nb] || style;
    const nbBase = _shade(nbStyle.base, _macroGroundDelta(tx + dx, ty + dy));
    const mixed = _mixRgb(base, nbBase, towardHigher ? 0.40 : 0.32);
    const edgeColor = towardHigher ? _shade(mixed, -10) : _shade(mixed, 8);
    _paintRaggedEdge(ctx, px, py, T, tx, ty, side, edgeColor, towardHigher ? 0.11 : 0.08);
    _paintTransitionBand(ctx, px, py, T, tx, ty, side, base, nbBase, towardHigher);
  }

  const cornerDefs = [
    ['nw', neighbors?.nw, neighbors?.n, neighbors?.w, -1, -1],
    ['ne', neighbors?.ne, neighbors?.n, neighbors?.e, 1, -1],
    ['se', neighbors?.se, neighbors?.s, neighbors?.e, 1, 1],
    ['sw', neighbors?.sw, neighbors?.s, neighbors?.w, -1, 1],
  ];
  for (const [corner, diag, a, b, dx, dy] of cornerDefs) {
    if (!Number.isFinite(diag) || diag === biome) continue;
    if (a === biome && b === biome) continue;
    const diagStyle = _GROUND_STYLE[diag] || style;
    const diagBase = _shade(diagStyle.base, _macroGroundDelta(tx + dx, ty + dy));
    _paintCornerTransition(ctx, px, py, T, tx, ty, corner, base, diagBase);
  }
}

function mbGroundTile(ctx, px, py, T, biome, tx, ty, neighbors) {
  const style = _GROUND_STYLE[biome] || _GROUND_STYLE[CONST.BIOME.PLAINS];
  const h3Key = _BIOME_TO_H3_KEY[biome];
  const base = _shade(style.base, _macroGroundDelta(tx, ty) * 0.35);
  const transitionMask = _terrainTransitionMask(h3Key, neighbors);
  const frame = _pickTerrainFrame(h3Key, tx, ty, transitionMask);
  let painted = false;
  if (frame) {
    const cacheKey = _frameCacheKey('terrain', h3Key, _H3_TERRAIN_DATA?.[h3Key]?.sourceDef, frame.name);
    const canvas = _getFrameCanvas(frame, cacheKey);
    if (canvas) {
      ctx.drawImage(canvas, _snap(px, 1), _snap(py, 1), T, T);
      painted = true;
    }
  }
  if (!painted) {
    ctx.fillStyle = _rgb(base);
    ctx.fillRect(px, py, T, T);
  } else {
    ctx.fillStyle = _rgb(base, 0.10);
    ctx.fillRect(px, py, T, T);
  }

  const grainCells = 4;
  const cw = T / grainCells;
  const ch = T / grainCells;
  for (let gy = 0; gy < grainCells; gy++) {
    for (let gx = 0; gx < grainCells; gx++) {
      const wx = tx * grainCells + gx;
      const wy = ty * grainCells + gy;
      const n = _terrainNoise(wx * 0.87, wy * 0.87, 415);
      const tint = _shade(base, (n - 0.5) * style.grain);
      ctx.fillStyle = _rgb(tint, style.grainAlpha);
      ctx.fillRect(_snap(px + gx * cw, 1), _snap(py + gy * ch, 1), Math.ceil(cw), Math.ceil(ch));
    }
  }

  for (let i = 0; i < style.specks; i++) {
    const rx = _terrainNoise(tx * 6.1 + i, ty * 4.9 + i * 0.5, 633);
    const ry = _terrainNoise(tx * 4.7 - i * 0.2, ty * 6.3 + i, 661);
    const cx = _snap(px + rx * T, 1);
    const cy = _snap(py + ry * T, 1);
    const c = _shade(base, _terrainNoise(tx * 3.3 + i, ty * 2.7 - i, 689) > 0.5 ? 16 : -18);
    ctx.fillStyle = _rgb(c, style.dotAlpha);
    ctx.fillRect(cx, cy, 1, 1);
  }

  if (!painted) {
    mbTransitionTileSprites(ctx, px, py, T, biome, tx, ty, neighbors, style, base);
  }

}

// ─── Faction data: [primaryColor, secondaryColor, shadowColor] ───────────
const _FACTION = {
  ottoman:      ['#CC1520', '#FFFFFF', '#7a000d'],
  hre:          ['#FFD700', '#1a1a1a', '#a08a00'],
  polish:       ['#CC0033', '#FFFFFF', '#880022'],
  spanish:      ['#AA151B', '#F1BF00', '#770010'],
  venice:       ['#003399', '#C6A227', '#001860'],
  bandit:       ['#3a0f0f', '#cccccc', '#200a0a'],
  free_company: ['#1a4a8a', '#e8c44c', '#0a2050'],
  aurelian:     ['#7a1818', '#d4af37', '#400808'],
  valen:        ['#1e3d5e', '#c0a860', '#0a1e30'],
  broken:       ['#3d2610', '#c87828', '#1a1005'],
};
function _factionData(fid) { return _FACTION[fid] || _FACTION.bandit; }
function _kindToFaction(kind) {
  return { bandit:'bandit', patrol:'hre', caravan:'venice', scout:'polish' }[kind] || 'bandit';
}

/** Draw faction-specific heraldic symbol at (cx,cy) with given size. */
function _drawFactionSymbol(ctx, fid, cx, cy, sz) {
  const [prim, sec] = _factionData(fid);
  const sym = { ottoman:'crescent', hre:'eagle', polish:'eaglePL',
                spanish:'cross', venice:'lion', bandit:'skull' }[fid] || 'wolf';
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (sym === 'crescent') {
    // Ottoman: white crescent + star
    ctx.fillStyle = sec;
    ctx.beginPath(); ctx.arc(cx, cy, sz*0.40, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = prim;
    ctx.beginPath(); ctx.arc(cx+sz*0.17, cy-sz*0.07, sz*0.31, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = sec;
    const sa = sz*0.12;
    ctx.beginPath();
    for (let i=0;i<5;i++){const a=(i*4*Math.PI/5)-Math.PI/2;const x=cx+sz*0.50+Math.cos(a)*sa;const y=cy-sz*0.17+Math.sin(a)*sa;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
    ctx.closePath(); ctx.fill();

  } else if (sym === 'eagle' || sym === 'eaglePL') {
    // HRE / Polish: eagle silhouette
    ctx.strokeStyle = sec; ctx.lineWidth = sz*0.09;
    ctx.beginPath();
    ctx.moveTo(cx-sz*0.46, cy+sz*0.06);
    ctx.quadraticCurveTo(cx-sz*0.20, cy-sz*0.30, cx, cy-sz*0.02);
    ctx.quadraticCurveTo(cx+sz*0.20, cy-sz*0.30, cx+sz*0.46, cy+sz*0.06);
    ctx.stroke();
    ctx.fillStyle = sec;
    ctx.beginPath(); _ellipse(ctx, cx, cy+sz*0.08, sz*0.10, sz*0.20, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy-sz*0.12, sz*0.09, 0, Math.PI*2); ctx.fill();
    if (sym === 'eaglePL') {
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = sz*0.07;
      ctx.beginPath(); ctx.arc(cx, cy-sz*0.21, sz*0.12, Math.PI, Math.PI*2); ctx.stroke();
    }

  } else if (sym === 'cross') {
    // Spanish: bold cross
    ctx.fillStyle = sec;
    ctx.fillRect(cx-sz*0.08, cy-sz*0.40, sz*0.16, sz*0.80);
    ctx.fillRect(cx-sz*0.36, cy-sz*0.12, sz*0.72, sz*0.16);

  } else if (sym === 'lion') {
    // Venice: lion head
    ctx.fillStyle = sec;
    ctx.beginPath(); _ellipse(ctx, cx, cy+sz*0.06, sz*0.26, sz*0.18, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.20, cy-sz*0.10, sz*0.15, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = sec; ctx.lineWidth = sz*0.10;
    ctx.beginPath(); ctx.arc(cx+sz*0.20, cy-sz*0.10, sz*0.24, 2.8, 0.4); ctx.stroke();

  } else if (sym === 'skull') {
    // Bandit: skull
    ctx.fillStyle = sec;
    ctx.beginPath(); _ellipse(ctx, cx, cy-sz*0.05, sz*0.30, sz*0.28, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = prim;
    ctx.beginPath(); ctx.arc(cx-sz*0.12, cy-sz*0.07, sz*0.09, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.12, cy-sz*0.07, sz*0.09, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = sec;
    for (let i=0;i<3;i++) ctx.fillRect(cx-sz*0.19+i*sz*0.19, cy+sz*0.14, sz*0.12, sz*0.16);

  } else {
    // Wolf head (all player factions)
    ctx.fillStyle = sec;
    ctx.beginPath();
    ctx.moveTo(cx-sz*0.42, cy+sz*0.10);
    ctx.lineTo(cx-sz*0.28, cy-sz*0.16);
    ctx.lineTo(cx-sz*0.08, cy-sz*0.11);
    ctx.lineTo(cx+sz*0.08, cy-sz*0.11);
    ctx.lineTo(cx+sz*0.28, cy-sz*0.16);
    ctx.lineTo(cx+sz*0.42, cy+sz*0.10);
    ctx.lineTo(cx+sz*0.25, cy+sz*0.26);
    ctx.lineTo(cx,         cy+sz*0.20);
    ctx.lineTo(cx-sz*0.25, cy+sz*0.26);
    ctx.closePath(); ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.moveTo(cx-sz*0.28,cy-sz*0.16); ctx.lineTo(cx-sz*0.38,cy-sz*0.40); ctx.lineTo(cx-sz*0.14,cy-sz*0.20); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx+sz*0.28,cy-sz*0.16); ctx.lineTo(cx+sz*0.38,cy-sz*0.40); ctx.lineTo(cx+sz*0.14,cy-sz*0.20); ctx.closePath(); ctx.fill();
    // Eyes (faction primary color)
    ctx.fillStyle = prim;
    ctx.beginPath(); ctx.arc(cx-sz*0.14, cy+sz*0.01, sz*0.065, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+sz*0.14, cy+sz*0.01, sz*0.065, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

/** Draw a single cavalry silhouette (HoMM3 hero feel). */
function _drawCavalrySilhouette(ctx, x, y, s, horseC, riderC) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); _ellipse(ctx, x+s*0.06, y+s*0.17, s*0.30, s*0.09, 0, 0, Math.PI*2); ctx.fill();
  // Horse body
  ctx.fillStyle = horseC;
  ctx.beginPath(); _ellipse(ctx, x, y+s*0.05, s*0.24, s*0.10, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); _ellipse(ctx, x+s*0.22, y-s*0.03, s*0.09, s*0.07, 0.50, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = horseC; ctx.lineWidth = s*0.040; ctx.lineCap = 'round';
  [-s*0.14, s*0.02].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(x+lx, y+s*0.12); ctx.lineTo(x+lx-s*0.03, y+s*0.19); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+lx+s*0.08, y+s*0.11); ctx.lineTo(x+lx+s*0.11, y+s*0.19); ctx.stroke();
  });
  // Rider torso
  ctx.fillStyle = riderC;
  ctx.beginPath(); _ellipse(ctx, x+s*0.04, y-s*0.06, s*0.07, s*0.10, 0.12, 0, Math.PI*2); ctx.fill();
  // Helmet/head
  ctx.beginPath(); ctx.arc(x+s*0.06, y-s*0.17, s*0.065, 0, Math.PI*2); ctx.fill();
  // Spear
  ctx.strokeStyle = _lt(riderC, 0.15); ctx.lineWidth = s*0.022;
  ctx.beginPath(); ctx.moveTo(x+s*0.10, y-s*0.10); ctx.lineTo(x+s*0.20, y-s*0.34); ctx.stroke();
}

/** Draw M&B-style castle/fort/village at world pixel (sx, sy). */
function mbSettlement(ctx, settlement, sx, sy, T, fogAlpha, zoom) {
  const type = settlement.type || 'village';
  ctx.save();
  ctx.globalAlpha = fogAlpha;

  if (type === 'city' || type === 'town' || type === 'fort') {
    const s = T * (type === 'city' ? 0.44 : type === 'town' ? 0.30 : 0.24);
    const wallC  = type === 'fort' ? '#5a5a6a' : '#8a7c6a';
    const towerC = type === 'fort' ? '#4a4a58' : '#7a6c5c';
    const capC   = '#bfb0a0';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); _ellipse(ctx, sx+2, sy+s*0.5+2, s*1.1, s*0.25, 0, 0, Math.PI*2); ctx.fill();

    // Curtain wall
    const ww = s * (type==='city'?1.85:1.50), wh = s * 0.58;
    const wl = sx - ww/2, wt = sy - s*0.05;
    ctx.fillStyle = wallC; ctx.fillRect(wl, wt, ww, wh);
    // Wall crenels
    const mn = Math.max(2, Math.floor(ww/(s*0.22)));
    const mw = ww/(mn*2), mh = s*0.11;
    ctx.fillStyle = capC;
    for (let i=0;i<mn;i++) ctx.fillRect(wl+i*mw*2, wt-mh, mw, mh);

    // Towers
    const tW = s*(type==='city'?0.37:0.30), tH = s*(type==='city'?0.98:0.82);
    const tTop = sy - tH*0.52;
    const towers = type==='city'
      ? [wl-tW*0.25, sx-tW/2, wl+ww-tW*0.75]
      : [wl-tW*0.25, wl+ww-tW*0.75];
    for (const tx of towers) {
      ctx.fillStyle = towerC; ctx.fillRect(tx, tTop, tW, tH);
      const tn=Math.max(2,Math.floor(tW/(s*0.18))), tw2=tW/(tn*2), th2=s*0.12;
      ctx.fillStyle = capC;
      for (let i=0;i<tn;i++) ctx.fillRect(tx+i*tw2*2, tTop-th2, tw2, th2);
      ctx.fillStyle='rgba(0,0,0,0.5)';
      ctx.fillRect(tx+tW*0.37, tTop+tH*0.28, tW*0.13, tH*0.22);
    }
    // Gate
    const gw=s*0.25, gb=wt+wh;
    ctx.fillStyle='rgba(0,0,0,0.60)';
    ctx.beginPath(); ctx.moveTo(sx-gw/2,gb); ctx.lineTo(sx-gw/2,gb-gw*0.8);
    ctx.arc(sx,gb-gw*0.8,gw/2,Math.PI,0); ctx.lineTo(sx+gw/2,gb); ctx.closePath(); ctx.fill();
    // Flag pennant on center/left tower
    const fTX = type==='city' ? towers[1]+tW/2 : towers[0]+tW/2;
    const fTY = tTop, pw=s*0.20, ph=s*0.13;
    ctx.strokeStyle='#5c4020'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(fTX,fTY); ctx.lineTo(fTX,fTY-ph*1.2); ctx.stroke();
    ctx.fillStyle='#e8c44c';
    ctx.beginPath(); ctx.moveTo(fTX,fTY-ph*1.2);
    ctx.lineTo(fTX+pw,fTY-ph*1.2+ph*0.48); ctx.lineTo(fTX,fTY-ph*0.15);
    ctx.closePath(); ctx.fill();
    // Outline
    ctx.strokeStyle='rgba(0,0,0,0.30)'; ctx.lineWidth=1;
    for (const tx of towers) ctx.strokeRect(tx,tTop,tW,tH);
    ctx.strokeRect(wl,wt,ww,wh);
    // Name label
    const labelY = tTop - ph*1.2 - 3;
    _mbLabel(ctx, sx, labelY, settlement.name||'', zoom, 'rgba(255,248,200,0.95)');
  } else {
    // Village
    const s = T * 0.27;
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath(); _ellipse(ctx, sx+1,sy+s*0.55,s*0.85,s*0.20,0,0,Math.PI*2); ctx.fill();
    const houses=[{ox:-s*0.48,oy:s*0.13},{ox:s*0.48,oy:s*0.13},{ox:0,oy:-s*0.10}];
    for (const h of houses) {
      const hx=sx+h.ox, hy=sy+h.oy, hw=s*0.35, hh=s*0.30;
      ctx.fillStyle='#b5956a'; ctx.fillRect(hx-hw/2,hy-hh/2,hw,hh);
      ctx.fillStyle='#8a5a3a';
      ctx.beginPath(); ctx.moveTo(hx,hy-hh/2-hh*0.44);
      ctx.lineTo(hx+hw/2+hw*0.08,hy-hh/2+1); ctx.lineTo(hx-hw/2-hw*0.08,hy-hh/2+1);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.42)';
      ctx.fillRect(hx-hw*0.10,hy-hh/2+hh*0.46,hw*0.20,hh*0.50);
    }
    ctx.strokeStyle='#7a5a3a'; ctx.lineWidth=1.2;
    ctx.setLineDash([s*0.10,s*0.07]);
    ctx.beginPath(); ctx.arc(sx,sy,s*0.73,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    _mbLabel(ctx, sx, sy-s*0.78, settlement.name||'', zoom, 'rgba(255,248,200,0.90)');
  }
  ctx.restore();
}

/** Draw label with dark background pill. */
function _mbLabel(ctx, cx, cy, text, zoom, color='rgba(255,248,200,0.95)') {
  if (!text) return;
  const fs = Math.max(8, Math.round(10 / zoom));
  ctx.save();
  ctx.font = `bold ${fs}px 'Cinzel', serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width;
  const pad = fs * 0.4;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.beginPath();
  const rx = cx - tw/2 - pad, ry = cy - fs - pad*0.5, rw = tw+pad*2, rh = fs+pad;
  const r = fs*0.3;
  ctx.moveTo(rx+r,ry); ctx.lineTo(rx+rw-r,ry); ctx.arcTo(rx+rw,ry,rx+rw,ry+r,r);
  ctx.lineTo(rx+rw,ry+rh-r); ctx.arcTo(rx+rw,ry+rh,rx+rw-r,ry+rh,r);
  ctx.lineTo(rx+r,ry+rh); ctx.arcTo(rx,ry+rh,rx,ry+rh-r,r);
  ctx.lineTo(rx,ry+r); ctx.arcTo(rx,ry,rx+r,ry,r); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,0.72)'; ctx.fillText(text,cx+0.5,cy+0.5);
  ctx.fillStyle=color; ctx.fillText(text,cx,cy);
  ctx.restore();
}

/** Draw lord banner: faction colors + heraldic symbol + 3-cavalry formation. */
function mbLordBanner(ctx, px, py, T, factionId, label, zoom) {
  const s = T * 0.28;
  const [prim, sec, shad] = _factionData(factionId);
  ctx.save();

  // Ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); _ellipse(ctx, px+1, py+s*0.24, s*0.60, s*0.13, 0, 0, Math.PI*2); ctx.fill();

  // Flanking cavalry (2 soldiers behind / beside banner bearer)
  const horseC = _dk(prim, 0.58);
  const riderC = _dk(sec === '#FFFFFF' ? prim : sec, 0.18);
  _drawCavalrySilhouette(ctx, px-s*0.56, py+s*0.12, s*0.80, horseC, riderC);
  _drawCavalrySilhouette(ctx, px+s*0.40, py+s*0.10, s*0.72, horseC, riderC);

  // Banner-bearer horse (main, slightly larger + centered)
  const bc = _dk(prim, 0.52);
  ctx.fillStyle = bc;
  ctx.beginPath(); _ellipse(ctx, px, py+s*0.07, s*0.34, s*0.15, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); _ellipse(ctx, px+s*0.28, py-s*0.10, s*0.11, s*0.09, 0.55, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = bc; ctx.lineWidth = s*0.055; ctx.lineCap = 'round';
  [-s*0.20,-s*0.07,s*0.07,s*0.20].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(px+lx, py+s*0.09); ctx.lineTo(px+lx+(lx>0?s*0.04:-s*0.04), py+s*0.17); ctx.stroke();
  });
  // Rider on banner bearer
  const riderMain = _dk(sec === '#FFFFFF' ? prim : sec, 0.16);
  ctx.fillStyle = riderMain;
  ctx.beginPath(); _ellipse(ctx, px+s*0.04, py-s*0.07, s*0.08, s*0.12, 0.15, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+s*0.07, py-s*0.20, s*0.07, 0, Math.PI*2); ctx.fill();

  // Pole
  const pt = py - s*1.58;
  ctx.strokeStyle = shad; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px-s*0.08, py-s*0.03); ctx.lineTo(px-s*0.08, pt); ctx.stroke();

  // Banner cloth (faction primary)
  const bw = s*0.82, bh = s*0.50;
  ctx.fillStyle = prim;
  ctx.beginPath();
  ctx.moveTo(px-s*0.08, pt); ctx.lineTo(px-s*0.08+bw, pt+bh*0.42); ctx.lineTo(px-s*0.08, pt+bh);
  ctx.closePath(); ctx.fill();
  // Sheen gradient
  const gr = ctx.createLinearGradient(px-s*0.08, pt, px-s*0.08+bw, pt+bh);
  gr.addColorStop(0, 'rgba(255,255,255,0.22)');
  gr.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(px-s*0.08, pt); ctx.lineTo(px-s*0.08+bw, pt+bh*0.42); ctx.lineTo(px-s*0.08, pt+bh);
  ctx.closePath(); ctx.fill();
  // Outline
  ctx.strokeStyle = 'rgba(0,0,0,0.40)'; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(px-s*0.08, pt); ctx.lineTo(px-s*0.08+bw, pt+bh*0.42); ctx.lineTo(px-s*0.08, pt+bh);
  ctx.closePath(); ctx.stroke();

  // Heraldic symbol in center of banner
  _drawFactionSymbol(ctx, factionId, px-s*0.08+bw*0.30, pt+bh*0.50, bh*0.56);

  if (label) _mbLabel(ctx, px, pt-4, label, zoom, '#ffe8a0');
  ctx.restore();
}

/** Draw player banner: faction colors + wolf motif + gold trim + 3-cavalry. */
function mbPlayerBanner(ctx, px, py, T, zoom, playerFaction) {
  const fid = playerFaction || 'free_company';
  const [prim, sec] = _factionData(fid);
  const s = T * 0.30;
  ctx.save();

  // Faction-colored glow halo
  ctx.shadowColor = _lt(prim, 0.25); ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(255,210,0,0.10)';
  ctx.beginPath(); _ellipse(ctx, px, py+s*0.20, s*0.74, s*0.21, 0, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  // Flanking cavalry (faction colors)
  const soldierC = _dk(prim, 0.52);
  const soldierR = _dk(sec === '#FFFFFF' ? prim : sec, 0.18);
  _drawCavalrySilhouette(ctx, px-s*0.60, py+s*0.12, s*0.84, soldierC, soldierR);
  _drawCavalrySilhouette(ctx, px+s*0.44, py+s*0.10, s*0.76, soldierC, soldierR);

  // Main hero horse (dark brown, regal)
  const bc = '#5a3800';
  ctx.fillStyle = bc;
  ctx.beginPath(); _ellipse(ctx, px, py+s*0.08, s*0.36, s*0.16, -0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); _ellipse(ctx, px+s*0.29, py-s*0.09, s*0.11, s*0.09, 0.55, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = bc; ctx.lineWidth = s*0.06; ctx.lineCap = 'round';
  [-s*0.20,-s*0.07,s*0.07,s*0.20].forEach(lx => {
    ctx.beginPath(); ctx.moveTo(px+lx, py+s*0.10); ctx.lineTo(px+lx+(lx>0?s*0.04:-s*0.04), py+s*0.18); ctx.stroke();
  });
  // Armored rider (faction primary)
  ctx.fillStyle = prim;
  ctx.beginPath(); _ellipse(ctx, px+s*0.04, py-s*0.07, s*0.09, s*0.13, 0.12, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(px+s*0.07, py-s*0.21, s*0.075, 0, Math.PI*2); ctx.fill();
  // Sword (player = hero with sword, not spear)
  ctx.strokeStyle = '#d0c080'; ctx.lineWidth = s*0.025;
  ctx.beginPath(); ctx.moveTo(px+s*0.12, py-s*0.12); ctx.lineTo(px+s*0.22, py-s*0.36); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+s*0.14, py-s*0.24); ctx.lineTo(px+s*0.22, py-s*0.24); ctx.stroke();

  // Gold pole with spear tip
  const pt = py - s*1.72;
  ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px-s*0.07, py); ctx.lineTo(px-s*0.07, pt); ctx.stroke();
  ctx.fillStyle = '#d4aa20';
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt-s*0.10); ctx.lineTo(px-s*0.07+s*0.06, pt); ctx.lineTo(px-s*0.07-s*0.06, pt);
  ctx.closePath(); ctx.fill();

  // Banner (faction primary, gold border)
  const bw = s*0.95, bh = s*0.58;
  ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 10;
  ctx.fillStyle = prim;
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt); ctx.lineTo(px-s*0.07+bw, pt+bh*0.42); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  // Sheen
  const gr2 = ctx.createLinearGradient(px-s*0.07, pt, px-s*0.07+bw, pt+bh);
  gr2.addColorStop(0, 'rgba(255,255,255,0.28)'); gr2.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = gr2;
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt); ctx.lineTo(px-s*0.07+bw, pt+bh*0.42); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.fill();
  // Gold border
  ctx.strokeStyle = '#d4aa20'; ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt); ctx.lineTo(px-s*0.07+bw, pt+bh*0.42); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.stroke();

  // Wolf symbol (always wolf for player, using faction's fid so colors match)
  _drawFactionSymbol(ctx, fid, px-s*0.07+bw*0.30, pt+bh*0.50, bh*0.58);

  // Thin secondary-color accent stripe
  ctx.fillStyle = (sec === '#1a1a1a' ? 'rgba(255,255,255,0.12)' : sec + '35');
  ctx.beginPath();
  ctx.moveTo(px-s*0.07, pt+bh*0.30); ctx.lineTo(px-s*0.07+bw*0.52, pt+bh*0.58); ctx.lineTo(px-s*0.07, pt+bh);
  ctx.closePath(); ctx.fill();

  const lbColor = (sec === '#FFFFFF' || sec === '#cccccc') ? '#ffe066' : sec;
  _mbLabel(ctx, px, pt-s*0.14, '⚔ Siz', zoom, lbColor);
  ctx.restore();
}

/** HoMM3-leaning forest tile: fewer, clearer conifers with crisp shading. */
function mbForestTile(ctx, px, py, T, fogLevel, txArg, tyArg) {
  const f = fogLevel === 1 ? 0.58 : 1.0;
  const tx = Number.isFinite(txArg) ? txArg : Math.floor(px / T);
  const ty = Number.isFinite(tyArg) ? tyArg : Math.floor(py / T);
  const propEntry = _pickPropFrame('FOREST', tx, ty);
  if (_drawPropFrame(ctx, propEntry, px, py, T, fogLevel, tx, ty, 'FOREST')) return;

  const rand = (seed) => {
    const n = Math.sin((tx * 12.9898) + (ty * 78.233) + seed * 37.719) * 43758.5453;
    return n - Math.floor(n);
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, T, T);
  ctx.clip();

  ctx.fillStyle = `rgba(${Math.round(20 * f)},${Math.round(34 * f)},${Math.round(16 * f)},0.20)`;
  ctx.fillRect(px, py, T, T);

  const count = 2 + Math.floor(rand(1) * 3);
  const trees = [];
  for (let i = 0; i < count; i++) {
    trees.push({
      cx: _snap(px + T * (0.16 + rand(10 + i * 3) * 0.68), 1),
      cy: _snap(py + T * (0.22 + rand(11 + i * 3) * 0.62), 1),
      s: T * (0.29 + rand(12 + i * 3) * 0.13),
    });
  }
  trees.sort((a, b) => a.cy - b.cy);

  for (const tree of trees) {
    const cx = tree.cx;
    const cy = tree.cy;
    const s = tree.s;

    ctx.fillStyle = `rgba(0,0,0,${0.18 * f})`;
    ctx.beginPath();
    _ellipse(ctx, cx + s * 0.10, cy + s * 0.38, s * 0.50, s * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${Math.round(70 * f)},${Math.round(48 * f)},${Math.round(28 * f)})`;
    ctx.fillRect(_snap(cx - s * 0.07, 1), _snap(cy + s * 0.02, 1), _snap(s * 0.14, 1), _snap(s * 0.42, 1));

    const tiers = [
      { y: 0.03, w: 0.44, h: 0.33 },
      { y: -0.22, w: 0.34, h: 0.30 },
      { y: -0.43, w: 0.25, h: 0.26 },
    ];

    for (let j = 0; j < tiers.length; j++) {
      const t = tiers[j];
      const y = _snap(cy + s * t.y, 1);
      const w = _snap(s * t.w, 1);
      const h = _snap(s * t.h, 1);

      ctx.fillStyle = `rgb(${Math.round((20 + j * 5) * f)},${Math.round((56 + j * 7) * f)},${Math.round((24 + j * 6) * f)})`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx, 1), _snap(y - h, 1));
      ctx.lineTo(_snap(cx + w, 1), _snap(y + h * 0.10, 1));
      ctx.lineTo(_snap(cx - w, 1), _snap(y + h * 0.10, 1));
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(${Math.round((78 + j * 7) * f)},${Math.round((122 + j * 9) * f)},${Math.round((66 + j * 7) * f)},0.56)`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx - w * 0.68, 1), _snap(y + h * 0.02, 1));
      ctx.lineTo(_snap(cx - w * 0.10, 1), _snap(y - h * 0.40, 1));
      ctx.lineTo(_snap(cx - w * 0.02, 1), _snap(y + h * 0.04, 1));
      ctx.closePath();
      ctx.fill();
    }
  }

  if (rand(77) > 0.58) {
    const bx = _snap(px + T * (0.14 + rand(78) * 0.62), 1);
    const by = _snap(py + T * (0.66 + rand(79) * 0.20), 1);
    const br = T * (0.06 + rand(80) * 0.05);
    ctx.fillStyle = `rgb(${Math.round(42 * f)},${Math.round(80 * f)},${Math.round(33 * f)})`;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

/** HoMM3-leaning mountain tile: sharper ridge silhouette and rock contrast. */
function mbMountainTile(ctx, px, py, T, fogLevel, txArg, tyArg, mode = 'normal') {
  const f = fogLevel === 1 ? 0.58 : 1.0;
  const tx = Number.isFinite(txArg) ? txArg : Math.floor(px / T);
  const ty = Number.isFinite(tyArg) ? tyArg : Math.floor(py / T);
  const propKind = mode === 'large' ? 'MOUNTAIN_LARGE' : 'MOUNTAIN';
  const propEntry = _pickPropFrame(propKind, tx, ty);
  if (_drawPropFrame(ctx, propEntry, px, py, T, fogLevel, tx, ty, propKind)) return;

  const rand = (seed) => {
    const n = Math.sin((tx * 19.117) + (ty * 61.731) + seed * 23.171) * 37158.5453;
    return n - Math.floor(n);
  };
  const sx = (v) => _snap(v, 1);

  ctx.save();
  const base = py + T * 1.04;
  const jitter = (seed, mag) => (rand(seed) - 0.5) * mag * T;

  const ridge = [
    [sx(px + T * 0.02), sx(base)],
    [sx(px + T * 0.16), sx(py + T * 0.66 + jitter(5, 0.06))],
    [sx(px + T * 0.29), sx(py + T * 0.24 + jitter(6, 0.05))],
    [sx(px + T * 0.41), sx(py + T * 0.48 + jitter(7, 0.05))],
    [sx(px + T * 0.55), sx(py + T * -0.12 + jitter(8, 0.04))],
    [sx(px + T * 0.68), sx(py + T * 0.34 + jitter(9, 0.05))],
    [sx(px + T * 0.83), sx(py + T * 0.12 + jitter(10, 0.05))],
    [sx(px + T * 0.98), sx(base)],
  ];

  let apexIndex = 1;
  for (let i = 2; i < ridge.length - 1; i++) {
    if (ridge[i][1] < ridge[apexIndex][1]) apexIndex = i;
  }

  ctx.fillStyle = `rgb(${Math.round(82 * f)},${Math.round(88 * f)},${Math.round(99 * f)})`;
  ctx.beginPath();
  ctx.moveTo(ridge[0][0], ridge[0][1]);
  for (let i = 1; i < ridge.length; i++) ctx.lineTo(ridge[i][0], ridge[i][1]);
  ctx.closePath();
  ctx.fill();

  const apex = ridge[apexIndex];
  const leftRef = ridge[Math.max(1, apexIndex - 1)];
  const rightRef = ridge[Math.min(ridge.length - 2, apexIndex + 1)];
  const midBase = [sx(px + T * 0.58), sx(base)];

  ctx.fillStyle = `rgb(${Math.round(154 * f)},${Math.round(162 * f)},${Math.round(175 * f)})`;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(leftRef[0], leftRef[1]);
  ctx.lineTo(sx(px + T * 0.12), sx(base));
  ctx.lineTo(midBase[0], midBase[1]);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round(56 * f)},${Math.round(62 * f)},${Math.round(72 * f)})`;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(rightRef[0], rightRef[1]);
  ctx.lineTo(sx(px + T * 0.92), sx(base));
  ctx.lineTo(midBase[0], midBase[1]);
  ctx.closePath();
  ctx.fill();

  if (rand(21) > 0.52) {
    const sx0 = sx(px + T * (0.70 + rand(22) * 0.12));
    const sy0 = sx(py + T * (0.18 + rand(23) * 0.10));
    const bw = T * (0.14 + rand(24) * 0.06);
    ctx.fillStyle = `rgb(${Math.round(72 * f)},${Math.round(78 * f)},${Math.round(89 * f)})`;
    ctx.beginPath();
    ctx.moveTo(sx0 - bw, base);
    ctx.lineTo(sx0 - bw * 0.18, sy0);
    ctx.lineTo(sx0 + bw * 0.86, base);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(${Math.round(42 * f)},${Math.round(48 * f)},${Math.round(58 * f)},0.82)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(apex[0], apex[1]);
  ctx.lineTo(sx(apex[0] - T * 0.05), sx(apex[1] + T * 0.20));
  ctx.lineTo(sx(apex[0] + T * 0.02), sx(apex[1] + T * 0.35));
  ctx.stroke();

  if (fogLevel === 2) {
    ctx.fillStyle = 'rgba(238,245,255,0.84)';
    ctx.beginPath();
    ctx.moveTo(sx(apex[0] - T * 0.12), sx(apex[1] + T * 0.16));
    ctx.lineTo(apex[0], apex[1]);
    ctx.lineTo(sx(apex[0] + T * 0.15), sx(apex[1] + T * 0.14));
    ctx.lineTo(sx(apex[0] + T * 0.03), sx(apex[1] + T * 0.22));
    ctx.lineTo(sx(apex[0] - T * 0.08), sx(apex[1] + T * 0.22));
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = `rgba(0,0,0,${0.14 * f})`;
  ctx.beginPath();
  _ellipse(ctx, px + T * 0.58, py + T * 1.02, T * 0.52, T * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

const _AI_NAMES = { bandit:'Eşkıya', patrol:'Devriye', caravan:'Kervan', scout:'Keşifci' };
function _aiLabel(p) {
  const str = Math.round(p.strength || p.size || 0);
  return `${_AI_NAMES[p.kind] || p.kind || 'Parti'} [${str}]`;
}

export class RenderManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
    const manifestOverride = this.state?.devMode && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('manifest') || '').trim()
      : '';
    const manifestUrl = manifestOverride || 'assets/manifest.json';
    this.game.spriteLoader = this.game.spriteLoader || new SpriteLoader(manifestUrl, {
      devMode: this.state?.devMode,
      warnOnce: utils.warnOnce,
      devLog: utils.devLog,
    });
  }

  // ─── 7A: Simple render screens ──────────────────────────────────────────────

  renderStart() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#000';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '48px "Cinzel", serif';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('FallOfCavalry', g.canvas.width / 2, g.canvas.height / 2);
    g.ctx.font = '24px "Crimson Text", serif';
    g.ctx.fillText('Select your faction to begin', g.canvas.width / 2, g.canvas.height / 2 + 60);
  }

  renderEncounter() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;

    g.ctx.fillStyle = '#171717';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    const enemyId = this.state?.encounter?.enemyId ?? 'unknown';
    g.ctx.fillStyle = '#ffffff';
    g.ctx.textAlign = 'center';
    g.ctx.font = '40px Arial';
    g.ctx.fillText('Encounter!', g.canvas.width / 2, g.canvas.height / 2 - 20);
    g.ctx.font = '22px Arial';
    g.ctx.fillText(`Enemy: ${enemyId}`, g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.ctx.font = '18px Arial';
    g.ctx.fillText('F = Battle Prep, C = Continue', g.canvas.width / 2, g.canvas.height / 2 + 56);
    if (isCurrentEventsModalOpen()) {
      const currentEvents = g.gameFlowManager.refreshCurrentEventsSummary(this.state?.day ?? 1);
      renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    }
    g.hudManager?.update?.();
  }

  renderCity() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#2a2a2a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '28px Arial';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('City Services', g.canvas.width / 2, g.canvas.height / 2 - 12);
    g.ctx.font = '16px Arial';
    g.ctx.fillText('R Recruit  T Market  H Healer  |  E/Esc leave city', g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.worldManager.updateTransientUIState();
  }

  // ─── 7C: Map orchestrator + world overlays ──────────────────────────────────

  renderMap() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    const camera = g.worldManager.getCameraSafe();
    g.worldManager.clampCameraToWorld();
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.fillStyle = '#1a1a1a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    g.ctx.save();
    g.ctx.scale(camera.zoom, camera.zoom);
    g.ctx.translate(-camera.x, -camera.y);

    this.renderWorldTerrain(g.ctx, camera);
    this.renderWorldOverlays(g.ctx, camera);

    g.ctx.restore();

    const weatherTint = getWeatherTint(g.uiManager.weatherState || this.state?.weatherState, g.uiManager.getWeatherConfig());
    renderWeatherOverlay(g.ctx, g.canvas.width, g.canvas.height, weatherTint);

    if (g.followParty) {
      g.ctx.font = '12px Arial';
      g.ctx.textAlign = 'left';
      g.ctx.fillStyle = 'rgba(255,255,255,0.75)';
      g.ctx.fillText('Follow: ON (F)', 12, g.canvas.height - 12);
    }

    if (this.state?.debug?.enabled) {
      this.renderDebugInfo();
    }

    if (isCurrentEventsModalOpen()) {
      const currentEvents = g.gameFlowManager.refreshCurrentEventsSummary(this.state?.day ?? 1);
      renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    }
    g.hudManager?.update?.();
    g.uiManager.minimapRenderer?.render(g);
  }

  renderWorldOverlays(ctx, camera) {
    const g = this.game;
    if (!ctx || !camera || !g.playerParty) return;

    const lineBase = 2 / camera.zoom;
    const party = g.playerParty;
    const canRenderBanners = typeof ctx.closePath === 'function'
      && typeof ctx.createLinearGradient === 'function'
      && typeof ctx.measureText === 'function'
      && typeof ctx.arcTo === 'function';

    ctx.strokeStyle = 'rgba(255, 228, 130, 0.35)';
    ctx.lineWidth = lineBase;
    ctx.beginPath();
    ctx.arc(party.x, party.y, party.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (party.hasDestination) {
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(party.destX, party.destY);
      ctx.stroke();

      const d = 8;
      ctx.strokeStyle = 'rgba(212,175,55,0.85)';
      ctx.beginPath();
      ctx.moveTo(party.destX - d, party.destY);
      ctx.lineTo(party.destX + d, party.destY);
      ctx.moveTo(party.destX, party.destY - d);
      ctx.lineTo(party.destX, party.destY + d);
      ctx.stroke();
    }

    if (party.selected && g.mode !== 'paused') {
      ctx.strokeStyle = 'rgba(200,220,255,0.28)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(g.mouseWorldX, g.mouseWorldY);
      ctx.stroke();

      const pd = 6;
      ctx.strokeStyle = 'rgba(200,220,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(g.mouseWorldX - pd, g.mouseWorldY);
      ctx.lineTo(g.mouseWorldX + pd, g.mouseWorldY);
      ctx.moveTo(g.mouseWorldX, g.mouseWorldY - pd);
      ctx.lineTo(g.mouseWorldX, g.mouseWorldY + pd);
      ctx.stroke();
    }

    if (party.arrivalFeedbackTimer > 0) {
      const t = party.arrivalFeedbackTimer;
      const pulse = 1 - t;
      const radius = party.radius + 8 + Math.sin(pulse * Math.PI * 4) * 2;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.15 + (t * 0.35)})`;
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player banner with faction colors + wolf motif
    const _rawFid = g.state?.faction ?? g.state?.selectedFaction?.id ?? g.state?.selectedFaction?.name ?? g.state?.playerFaction ?? 'free_company';
    const _playerFid = String(_rawFid).toLowerCase().replace(/\s+/g,'_');
    if (canRenderBanners) {
      mbPlayerBanner(ctx, party.x, party.y, CONST.WORLD.TILE_SIZE, camera.zoom, _playerFid);
    }

    if (party.hovered && !party.selected) {
      ctx.strokeStyle = 'rgba(170,205,255,0.65)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (party.selected) {
      const encounterRadius = party.radius + g.worldManager.encounterMargin;
      ctx.strokeStyle = 'rgba(255,120,120,0.2)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, encounterRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3 / camera.zoom;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lord banners — World AI parties
    if ((g.tuningManager.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED && Array.isArray(g.worldManager.worldAi?.parties)) {
      g.worldManager.worldAi.parties.forEach((party) => {
        if (!party || !Number.isFinite(party.x) || !Number.isFinite(party.y)) return;
        if (canRenderBanners) {
          mbLordBanner(ctx, party.x, party.y, CONST.WORLD.TILE_SIZE, _kindToFaction(party.kind), _aiLabel(party), camera.zoom);
        }
      });
    }

    // Lord banners — enemy parties (faction-specific heraldry)
    if (Array.isArray(g.worldManager.enemyParties)) {
      g.worldManager.enemyParties.forEach((enemy) => {
        if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
        if (Number.isFinite(enemy.radius) && enemy.radius > 0) {
          ctx.strokeStyle = 'rgba(255, 120, 120, 0.35)';
          ctx.lineWidth = lineBase;
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        const str   = Math.round(enemy.strength || enemy.size || 0);
        const fid   = enemy.factionId || enemy.faction || 'bandit';
        const eName = { ottoman:'Osmanlı Beyi', hre:'HRE Lordu', polish:'Leh Beyi', spanish:'İspanyol', venice:'Venedikli', bandit:'Eşkıya Çetesi' }[fid] || 'Düşman Ordusu';
        if (canRenderBanners) {
          mbLordBanner(ctx, enemy.x, enemy.y, CONST.WORLD.TILE_SIZE, fid, `${eName} [${str}]`, camera.zoom);
        }
      });
    }
  }

  // ─── 7B: World terrain ──────────────────────────────────────────────────────

  renderWorldTerrain(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.tiles) || map.tiles.length === 0) return;

    const tileSize = CONST.WORLD.TILE_SIZE;
    const width = Number.isFinite(map.width) ? map.width : CONST.WORLD.MAP_WIDTH;
    const height = Number.isFinite(map.height) ? map.height : CONST.WORLD.MAP_HEIGHT;
    const fog = map.fog instanceof Uint8Array ? map.fog : null;

    const minX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
    const minY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
    const maxX = Math.min(width - 1, Math.ceil((camera.x + (g.canvas.width / camera.zoom)) / tileSize) + 1);
    const maxY = Math.min(height - 1, Math.ceil((camera.y + (g.canvas.height / camera.zoom)) / tileSize) + 1);

    const biomes = map.biomes instanceof Uint8Array ? map.biomes : null;

    const tileToBiome = (tile) => tile?.type === CONST.TERRAIN.TYPE.WATER
      ? CONST.BIOME.SEA
      : tile?.type === CONST.TERRAIN.TYPE.SHORE
        ? CONST.BIOME.SHORE
        : tile?.type === CONST.TERRAIN.TYPE.MOUNTAIN
          ? CONST.BIOME.MOUNTAIN
          : tile?.type === CONST.TERRAIN.TYPE.SNOW
            ? CONST.BIOME.SNOW
            : tile?.type === CONST.TERRAIN.TYPE.FOREST
              ? CONST.BIOME.FOREST
              : CONST.BIOME.PLAINS;

    const resolveBiomeAt = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return CONST.BIOME.SEA;
      const i = y * width + x;
      if (biomes) return biomes[i];
      return tileToBiome(map.tiles[i]);
    };

    // Build fast lookup sets for forests/mountains
    const forestSet   = new Set((map.forests   || []).map(f => f.x+','+f.y));
    const mountainSet = new Set((map.mountains || []).map(m => m.x+','+m.y));
    const featureQueue = [];
    const largeMountainCells = new Set();
    const countSetNeighbors = (set, x, y) => {
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (set.has(`${x + dx},${y + dy}`)) count++;
        }
      }
      return count;
    };

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const idx = ty * width + tx;
        const biome = resolveBiomeAt(tx, ty);
        mbGroundTile(ctx, tx * tileSize, ty * tileSize, tileSize, biome, tx, ty, {
          n: resolveBiomeAt(tx, ty - 1),
          e: resolveBiomeAt(tx + 1, ty),
          s: resolveBiomeAt(tx, ty + 1),
          w: resolveBiomeAt(tx - 1, ty),
          nw: resolveBiomeAt(tx - 1, ty - 1),
          ne: resolveBiomeAt(tx + 1, ty - 1),
          se: resolveBiomeAt(tx + 1, ty + 1),
          sw: resolveBiomeAt(tx - 1, ty + 1),
        });

        const fogLevel = fog ? fog[idx] : 2;
        if (fogLevel === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.92)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        } else if (fogLevel === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        }

        // Queue forest / mountain features for a separate pass (after roads/rivers)
        if (fogLevel > 0) {
          const key = tx+','+ty;
          if (mountainSet.has(key)) {
            const mNeighbors = countSetNeighbors(mountainSet, tx, ty);
            const largeCell = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
            const largeNoise = _terrainNoise(tx * 0.53, ty * 0.47, 7811);
            const isLarge = mNeighbors >= 2 && largeNoise > 0.66 && !largeMountainCells.has(largeCell);
            if (isLarge) {
              largeMountainCells.add(largeCell);
              featureQueue.push({ type: 'mountain_large', tx, ty, fogLevel, depthY: ty + 1.12 });
            } else {
              featureQueue.push({ type: 'mountain', tx, ty, fogLevel, depthY: ty + 0.65 });
            }
          }
          if (forestSet.has(key)) {
            featureQueue.push({ type: 'forest', tx, ty, fogLevel, depthY: ty + 0.72 });
          }
        }
      }
    }

    // Rivers — HoMM3 style: wide, dark-blue outer + bright-blue inner
    (map.rivers || []).forEach((river) => {
      if (!Array.isArray(river) || river.length < 2) return;
      const buildPath = () => {
        ctx.beginPath();
        river.forEach((p, i) => {
          const x = (p.x + 0.5) * tileSize;
          const y = (p.y + 0.5) * tileSize;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Dark bank outline
      ctx.lineWidth = Math.max(4, 8 / camera.zoom);
      ctx.strokeStyle = 'rgba(28,68,130,0.85)';
      buildPath(); ctx.stroke();
      // Main river body
      ctx.lineWidth = Math.max(2.5, 5.5 / camera.zoom);
      ctx.strokeStyle = 'rgba(50,110,200,0.90)';
      buildPath(); ctx.stroke();
      // Light center shimmer
      ctx.lineWidth = Math.max(1, 2 / camera.zoom);
      ctx.strokeStyle = 'rgba(110,170,240,0.60)';
      buildPath(); ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(161,129,88,0.8)';
    (map.roads || []).forEach((road) => {
      const path = road?.path;
      if (!Array.isArray(path) || path.length < 2) return;
      ctx.beginPath();
      path.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    featureQueue.sort((a, b) => (a.depthY - b.depthY) || (a.tx - b.tx));
    for (const feature of featureQueue) {
      const fx = feature.tx * tileSize;
      const fy = feature.ty * tileSize;
      if (feature.type === 'mountain_large') {
        mbMountainTile(ctx, fx, fy, tileSize, feature.fogLevel, feature.tx, feature.ty, 'large');
      } else if (feature.type === 'mountain') {
        mbMountainTile(ctx, fx, fy, tileSize, feature.fogLevel, feature.tx, feature.ty);
      } else {
        mbForestTile(ctx, fx, fy, tileSize, feature.fogLevel, feature.tx, feature.ty);
      }
    }

    (map.pois || []).forEach((poi) => {
      const tx = poi?.x;
      const ty = poi?.y;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const px = (tx + 0.5) * tileSize;
      const py = (ty + 0.5) * tileSize;
      ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, 1.6 / camera.zoom);

      const poiSpriteKey = g.poiManager.getPoiSpriteKey(poi.type);
      const poiScale = Math.max(0.65, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (g.assetsReady) {
        const drawn = g.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
        if (drawn) return;
      }

      if (poi.type === 'camp') {
        const s = Math.max(4, 8 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px - s * 0.8, py + s * 0.7);
        ctx.lineTo(px + s * 0.8, py + s * 0.7);
        ctx.closePath();
        ctx.stroke();
      } else {
        const s = Math.max(4, 7 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px - s, py - s);
        ctx.lineTo(px + s, py + s);
        ctx.moveTo(px + s, py - s);
        ctx.lineTo(px - s, py + s);
        ctx.stroke();
      }
    });

    (map.settlements || []).forEach((settlement) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const sx = Number.isFinite(settlement.x) ? settlement.x : (tx + 0.5) * tileSize;
      const sy = Number.isFinite(settlement.y) ? settlement.y : (ty + 0.5) * tileSize;
      // M&B castle/village icon (always drawn; sprites override not used)
      const fogAlpha = fogLevel === 1 ? 0.55 : 1.0;
      mbSettlement(ctx, settlement, sx, sy, tileSize, fogAlpha, camera.zoom);
    });

    const clue = this.state?.clueMarker;
    if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
      const cx = Number(clue.x);
      const cy = Number(clue.y);
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
        const fogLevel = fog ? fog[cy * width + cx] : 2;
        if (fogLevel > 0) {
          const x = (cx + 0.5) * tileSize;
          const y = (cy + 0.5) * tileSize;
          ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
          ctx.lineWidth = Math.max(1, 2.2 / camera.zoom);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, 11 / camera.zoom), 0, Math.PI * 2);
          ctx.stroke();
          if (camera.zoom >= 0.6) {
            ctx.fillStyle = 'rgba(245,218,96,0.95)';
            ctx.font = `${Math.max(10, 12 / camera.zoom)}px Inter`;
            ctx.fillText(String(clue.label || 'İpucu'), x + (10 / camera.zoom), y - (8 / camera.zoom));
          }
        }
      }
    }
  }

  // ─── 7A: Debug overlay ──────────────────────────────────────────────────────

  renderDebugInfo() {
    const g = this.game;
    if (!this.state || !g.input) return;

    const lines = [
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${this.state.player.gold}`,
      `Mouse: (${g.input.mouse.x.toFixed(0)}, ${g.input.mouse.y.toFixed(0)})`,
    ];

    if (g.dom.debugOverlay) {
      const infoEl = g.dom.debugOverlay.querySelector?.('#debugInfo');
      if (infoEl) infoEl.textContent = lines.join('\n');
      else g.dom.debugOverlay.textContent = lines.join('\n');
    }
  }

  // ─── Phase 12C: Sprite loading ────────────────────────────────────────────────

  async loadSpriteAssets() {
    const g = this.game;
    if (!g.spriteLoader) return false;
    try {
      await g.spriteLoader.loadAll();
      g.assetsReady = true;
    } catch {
      if (this.state?.devMode) utils.devLog(this.state, '[Assets] Sprite pipeline disabled; using fallback rendering.');
      g.assetsReady = false;
    }
    return g.assetsReady;
  }

  async reloadSpriteAssets() {
    const g = this.game;
    g.assetsReady = false;
    g.battleManager?.battleAnimPlayers?.clear();
    return this.loadSpriteAssets();
  }
}

