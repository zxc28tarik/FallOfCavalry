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

const _SETTLEMENT_PALETTE = Object.freeze({
  stoneDark: '#343a42',
  stoneMid: '#505965',
  stoneLight: '#6a7484',
  roofDark: '#6b1f21',
  roofMid: '#8f2a2c',
  roofLight: '#b03a3c',
  woodDark: '#4f3018',
  woodMid: '#734a24',
  woodLight: '#9f6a32',
  plaster: '#b7a184',
  pathDark: '#6e4f2d',
  pathLight: '#9a7444',
  outline: 'rgba(0,0,0,0.6)',
});
const _SETTLEMENT_SPRITE_CACHE = new Map();
const _SETTLEMENT_H3_ADAPTED_CACHE = new Map();

const _SETTLEMENT_FACTION_STYLE = Object.freeze({
  ottoman: Object.freeze({
    stoneDark: '#5a5147',
    stoneMid: '#7c6f60',
    stoneLight: '#a69279',
    roofDark: '#7b3b2a',
    roofMid: '#a65338',
    roofLight: '#cf8a61',
    domeDark: '#2d5568',
    domeMid: '#427d98',
    domeLight: '#69a8c5',
    plaster: '#d4c2a8',
    accent: '#1b6c8b',
  }),
  hre: Object.freeze({
    stoneDark: '#3f4653',
    stoneMid: '#586274',
    stoneLight: '#808b9e',
    roofDark: '#542a2d',
    roofMid: '#744047',
    roofLight: '#9f5d66',
    domeDark: '#4f5f75',
    domeMid: '#6c829f',
    domeLight: '#95abc7',
    plaster: '#b9b2a9',
    accent: '#c2a14a',
  }),
  polish: Object.freeze({
    stoneDark: '#5e5c69',
    stoneMid: '#7d7889',
    stoneLight: '#a9a2b6',
    roofDark: '#73292e',
    roofMid: '#9b3942',
    roofLight: '#c7706e',
    domeDark: '#405f94',
    domeMid: '#6085c1',
    domeLight: '#8eb1e2',
    plaster: '#d2c2ad',
    accent: '#345cad',
  }),
  spanish: Object.freeze({
    stoneDark: '#695948',
    stoneMid: '#8e765f',
    stoneLight: '#b89a79',
    roofDark: '#80412a',
    roofMid: '#b25d3b',
    roofLight: '#d98d5f',
    domeDark: '#6d5c48',
    domeMid: '#957355',
    domeLight: '#bf946d',
    plaster: '#e1cba8',
    accent: '#9a2f28',
  }),
  venice: Object.freeze({
    stoneDark: '#63584f',
    stoneMid: '#87786b',
    stoneLight: '#b59f8d',
    roofDark: '#6a3a30',
    roofMid: '#8f5245',
    roofLight: '#bf7e65',
    domeDark: '#3f6670',
    domeMid: '#5b8793',
    domeLight: '#83b5c1',
    plaster: '#dfc8b5',
    accent: '#2d6784',
  }),
  bandit: Object.freeze({
    stoneDark: '#463f39',
    stoneMid: '#5b5048',
    stoneLight: '#7a6d61',
    roofDark: '#4f321e',
    roofMid: '#69462c',
    roofLight: '#8d6241',
    domeDark: '#3f4f56',
    domeMid: '#5c6f78',
    domeLight: '#7f95a1',
    plaster: '#a7937b',
    accent: '#7b2626',
  }),
});

const _FORT_LAYOUTS_BY_FACTION = Object.freeze({
  ottoman: Object.freeze([
    Object.freeze({ wallW: 0.64, wallH: 0.24, towers: 2, keep: true, bastion: false, round: true, minaret: true, domeKeep: true }),
    Object.freeze({ wallW: 0.68, wallH: 0.22, towers: 3, keep: false, bastion: true, round: false, minaret: false, gateArch: true }),
    Object.freeze({ wallW: 0.60, wallH: 0.23, towers: 2, keep: true, bastion: true, round: true, minaret: true, barbican: true }),
    Object.freeze({ wallW: 0.58, wallH: 0.22, towers: 1, keep: true, bastion: false, round: false, minaret: false, splitWall: true }),
    Object.freeze({ wallW: 0.66, wallH: 0.21, towers: 2, keep: true, bastion: true, round: true, minaret: true, splitWall: true }),
    Object.freeze({ wallW: 0.56, wallH: 0.25, towers: 2, keep: false, bastion: true, round: false, minaret: true, gateArch: true }),
    Object.freeze({ wallW: 0.62, wallH: 0.24, towers: 3, keep: true, bastion: false, round: false, minaret: true, barbican: true }),
  ]),
  hre: Object.freeze([
    Object.freeze({ wallW: 0.64, wallH: 0.24, towers: 2, keep: true, bastion: false, round: false, spireKeep: true }),
    Object.freeze({ wallW: 0.70, wallH: 0.22, towers: 3, keep: true, bastion: true, round: false, splitWall: true }),
    Object.freeze({ wallW: 0.58, wallH: 0.24, towers: 2, keep: false, bastion: true, round: true, gateArch: true }),
    Object.freeze({ wallW: 0.62, wallH: 0.23, towers: 1, keep: true, bastion: false, round: false, barbican: true }),
    Object.freeze({ wallW: 0.66, wallH: 0.22, towers: 2, keep: true, bastion: true, round: false, spireKeep: true }),
    Object.freeze({ wallW: 0.60, wallH: 0.25, towers: 3, keep: false, bastion: false, round: false, splitWall: true }),
    Object.freeze({ wallW: 0.56, wallH: 0.24, towers: 2, keep: true, bastion: true, round: true, gateArch: true }),
  ]),
  polish: Object.freeze([
    Object.freeze({ wallW: 0.62, wallH: 0.23, towers: 2, keep: true, bastion: false, round: true, onion: true }),
    Object.freeze({ wallW: 0.68, wallH: 0.22, towers: 3, keep: false, bastion: true, round: false, onion: true, splitWall: true }),
    Object.freeze({ wallW: 0.58, wallH: 0.24, towers: 2, keep: true, bastion: true, round: false, onion: true, barbican: true }),
    Object.freeze({ wallW: 0.60, wallH: 0.23, towers: 1, keep: true, bastion: false, round: false, onion: false, gateArch: true }),
    Object.freeze({ wallW: 0.66, wallH: 0.22, towers: 2, keep: true, bastion: true, round: true, onion: true }),
    Object.freeze({ wallW: 0.56, wallH: 0.25, towers: 2, keep: false, bastion: true, round: false, onion: false, splitWall: true }),
    Object.freeze({ wallW: 0.64, wallH: 0.24, towers: 3, keep: true, bastion: false, round: false, onion: true, barbican: true }),
  ]),
  spanish: Object.freeze([
    Object.freeze({ wallW: 0.66, wallH: 0.23, towers: 2, keep: true, bastion: false, round: false, alcazar: true }),
    Object.freeze({ wallW: 0.70, wallH: 0.21, towers: 3, keep: false, bastion: true, round: false, alcazar: true, splitWall: true }),
    Object.freeze({ wallW: 0.58, wallH: 0.24, towers: 2, keep: true, bastion: true, round: true, alcazar: true, gateArch: true }),
    Object.freeze({ wallW: 0.62, wallH: 0.23, towers: 1, keep: true, bastion: false, round: false, alcazar: false, barbican: true }),
    Object.freeze({ wallW: 0.64, wallH: 0.22, towers: 2, keep: true, bastion: true, round: false, alcazar: true, splitWall: true }),
    Object.freeze({ wallW: 0.56, wallH: 0.25, towers: 2, keep: false, bastion: true, round: false, alcazar: false, gateArch: true }),
    Object.freeze({ wallW: 0.60, wallH: 0.24, towers: 3, keep: true, bastion: false, round: true, alcazar: true }),
  ]),
  venice: Object.freeze([
    Object.freeze({ wallW: 0.60, wallH: 0.24, towers: 2, keep: true, bastion: false, round: false, campanile: true }),
    Object.freeze({ wallW: 0.66, wallH: 0.22, towers: 3, keep: false, bastion: true, round: false, campanile: true, splitWall: true }),
    Object.freeze({ wallW: 0.58, wallH: 0.23, towers: 2, keep: true, bastion: true, round: true, campanile: false, gateArch: true }),
    Object.freeze({ wallW: 0.62, wallH: 0.22, towers: 1, keep: true, bastion: false, round: false, campanile: true, barbican: true }),
    Object.freeze({ wallW: 0.64, wallH: 0.21, towers: 2, keep: true, bastion: true, round: false, campanile: true }),
    Object.freeze({ wallW: 0.56, wallH: 0.25, towers: 2, keep: false, bastion: true, round: false, campanile: false, splitWall: true }),
    Object.freeze({ wallW: 0.62, wallH: 0.24, towers: 3, keep: true, bastion: false, round: true, campanile: true }),
  ]),
  bandit: Object.freeze([
    Object.freeze({ wallW: 0.56, wallH: 0.24, towers: 1, keep: false, bastion: false, round: false }),
    Object.freeze({ wallW: 0.60, wallH: 0.23, towers: 2, keep: false, bastion: true, round: false }),
    Object.freeze({ wallW: 0.54, wallH: 0.25, towers: 1, keep: true, bastion: false, round: false }),
    Object.freeze({ wallW: 0.62, wallH: 0.22, towers: 2, keep: false, bastion: true, round: true }),
    Object.freeze({ wallW: 0.58, wallH: 0.23, towers: 2, keep: true, bastion: false, round: false, splitWall: true }),
    Object.freeze({ wallW: 0.60, wallH: 0.24, towers: 3, keep: false, bastion: false, round: false }),
    Object.freeze({ wallW: 0.56, wallH: 0.24, towers: 2, keep: true, bastion: true, round: false, barbican: true }),
  ]),
});

function _settlementHash32(text) {
  const s = String(text || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 255;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function _settlementSeed(settlement, salt = 0) {
  let h = (0x9e3779b9 ^ (salt >>> 0)) >>> 0;
  const id = Number.isFinite(settlement?.id) ? settlement.id : 0;
  const tx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor((settlement?.x || 0) / 32);
  const ty = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor((settlement?.y || 0) / 32);
  h ^= Math.imul((id + 31) >>> 0, 2246822519) >>> 0;
  h ^= Math.imul((tx + 131) >>> 0, 3266489917) >>> 0;
  h ^= Math.imul((ty + 911) >>> 0, 668265263) >>> 0;
  h ^= _settlementHash32(`${settlement?.name || ''}:${settlement?.ownerFactionId || settlement?.owner || ''}`);
  return h >>> 0;
}

function _seedRand(seed, idx = 0) {
  let s = (seed + Math.imul((idx + 1) >>> 0, 747796405)) >>> 0;
  s = Math.imul((s ^ (s >>> 15)) >>> 0, 2246822519) >>> 0;
  s = (s ^ (s >>> 13)) >>> 0;
  return (s >>> 0) / 4294967295;
}

function _settlementFactionStyle(fid) {
  return _SETTLEMENT_FACTION_STYLE[fid] || _SETTLEMENT_FACTION_STYLE.bandit;
}

function _fortLayoutsForFaction(fid) {
  return _FORT_LAYOUTS_BY_FACTION[fid] || _FORT_LAYOUTS_BY_FACTION.bandit;
}

function _cityRegionVariant(settlement, count = 6) {
  const tx = Number.isFinite(settlement?.tx) ? settlement.tx : Math.floor((settlement?.x || 0) / 32);
  const ty = Number.isFinite(settlement?.ty) ? settlement.ty : Math.floor((settlement?.y || 0) / 32);
  const gx = Math.floor(tx / 96);
  const gy = Math.floor(ty / 84);
  const owner = settlement?.ownerFactionId || settlement?.owner || 'bandit';
  const h = _settlementHash32(`${owner}:${gx}:${gy}`);
  return Math.max(0, h % Math.max(1, count));
}

function _settlementPalette(fid) {
  const style = _settlementFactionStyle(fid);
  return {
    stoneDark: style.stoneDark,
    stoneMid: style.stoneMid,
    stoneLight: style.stoneLight,
    roofDark: style.roofDark,
    roofMid: style.roofMid,
    roofLight: style.roofLight,
    woodDark: _hexShade(style.roofDark, -0.12),
    woodMid: _hexShade(style.roofMid, -0.02),
    woodLight: _hexShade(style.roofLight, 0.10),
    plaster: style.plaster,
    pathDark: '#6e4f2d',
    pathLight: '#9a7444',
    outline: 'rgba(0,0,0,0.6)',
    accent: style.accent,
    domeDark: style.domeDark,
    domeMid: style.domeMid,
    domeLight: style.domeLight,
  };
}

function _tintSettlementPalette(basePal, stoneDelta = 0, roofDelta = 0, plasterDelta = 0) {
  const pal = { ...basePal };
  pal.stoneDark = _hexShade(basePal.stoneDark, stoneDelta - 0.04);
  pal.stoneMid = _hexShade(basePal.stoneMid, stoneDelta);
  pal.stoneLight = _hexShade(basePal.stoneLight, stoneDelta + 0.05);
  pal.roofDark = _hexShade(basePal.roofDark, roofDelta - 0.04);
  pal.roofMid = _hexShade(basePal.roofMid, roofDelta);
  pal.roofLight = _hexShade(basePal.roofLight, roofDelta + 0.06);
  pal.plaster = _hexShade(basePal.plaster, plasterDelta);
  pal.woodDark = _hexShade(basePal.woodDark, roofDelta * 0.35);
  pal.woodMid = _hexShade(basePal.woodMid, roofDelta * 0.38);
  pal.woodLight = _hexShade(basePal.woodLight, roofDelta * 0.42);
  pal.pathDark = _hexShade(basePal.pathDark, stoneDelta * 0.35);
  pal.pathLight = _hexShade(basePal.pathLight, stoneDelta * 0.35);
  pal.domeDark = _hexShade(basePal.domeDark, roofDelta * 0.30);
  pal.domeMid = _hexShade(basePal.domeMid, roofDelta * 0.35);
  pal.domeLight = _hexShade(basePal.domeLight, roofDelta * 0.40);
  return pal;
}

function _cityPaletteByRegion(basePal, fid, rv) {
  const idx = Math.max(0, rv | 0) % 6;
  const table = {
    ottoman: [
      [0.00, 0.03, 0.04],
      [-0.04, -0.02, -0.01],
      [0.06, 0.00, 0.06],
      [0.02, 0.07, 0.03],
      [-0.02, 0.10, 0.00],
      [0.05, -0.03, 0.03],
    ],
    hre: [
      [0.00, 0.04, 0.00],
      [0.05, -0.02, 0.05],
      [-0.06, 0.06, -0.03],
      [0.04, 0.08, 0.02],
      [-0.02, -0.04, 0.00],
      [0.07, 0.00, 0.06],
    ],
    polish: [
      [0.03, 0.05, 0.03],
      [-0.03, 0.10, -0.02],
      [0.06, -0.01, 0.06],
      [0.00, 0.07, 0.01],
      [-0.05, 0.03, -0.04],
      [0.04, -0.03, 0.03],
    ],
    spanish: [
      [0.01, 0.09, 0.06],
      [-0.03, 0.04, 0.01],
      [0.06, -0.02, 0.08],
      [0.04, 0.12, 0.04],
      [-0.04, 0.00, -0.02],
      [0.08, 0.03, 0.09],
    ],
    venice: [
      [0.02, 0.04, 0.08],
      [-0.02, 0.08, 0.02],
      [0.06, -0.02, 0.10],
      [0.00, 0.10, 0.04],
      [-0.05, 0.02, -0.02],
      [0.07, 0.00, 0.12],
    ],
    bandit: [
      [-0.06, -0.04, -0.05],
      [-0.04, 0.00, -0.03],
      [0.00, -0.02, -0.01],
      [-0.02, 0.02, -0.01],
      [0.03, -0.01, 0.00],
      [0.05, 0.04, 0.02],
    ],
  };
  const row = table[fid] || table.bandit;
  const triple = row[idx] || row[0];
  return _tintSettlementPalette(basePal, triple[0], triple[1], triple[2]);
}

function _fortPaletteByVariant(basePal, fid, variant) {
  const idx = Math.max(0, variant | 0) % 7;
  const table = {
    ottoman: [[0.02, 0.06, 0.05], [-0.03, 0.00, -0.01], [0.06, -0.03, 0.06], [0.00, 0.09, 0.02], [0.04, 0.02, 0.07], [-0.05, 0.05, -0.03], [0.08, -0.01, 0.09]],
    hre: [[0.00, 0.04, 0.00], [0.05, -0.02, 0.04], [-0.04, 0.07, -0.04], [0.03, 0.09, 0.02], [-0.02, -0.05, -0.02], [0.07, 0.01, 0.06], [0.02, 0.11, 0.03]],
    polish: [[0.02, 0.08, 0.02], [-0.03, 0.02, -0.03], [0.06, -0.01, 0.05], [0.00, 0.10, 0.01], [-0.05, 0.04, -0.04], [0.05, -0.03, 0.03], [0.08, 0.01, 0.08]],
    spanish: [[0.01, 0.11, 0.07], [-0.03, 0.04, 0.00], [0.06, -0.02, 0.09], [0.04, 0.13, 0.03], [-0.04, 0.00, -0.03], [0.08, 0.03, 0.10], [0.02, 0.07, 0.05]],
    venice: [[0.03, 0.05, 0.09], [-0.02, 0.08, 0.01], [0.07, -0.01, 0.11], [0.00, 0.11, 0.03], [-0.05, 0.03, -0.03], [0.06, 0.00, 0.12], [0.02, 0.09, 0.07]],
    bandit: [[-0.07, -0.05, -0.06], [-0.05, -0.01, -0.04], [-0.02, 0.01, -0.02], [0.00, 0.03, -0.01], [0.03, -0.01, 0.00], [0.04, 0.02, 0.01], [0.06, 0.04, 0.03]],
  };
  const row = table[fid] || table.bandit;
  const triple = row[idx] || row[0];
  return _tintSettlementPalette(basePal, triple[0], triple[1], triple[2]);
}

function _settlementColorTriplet(color) {
  if (typeof color === 'string') {
    const s = color.trim();
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16) || 0,
          parseInt(hex[1] + hex[1], 16) || 0,
          parseInt(hex[2] + hex[2], 16) || 0,
        ];
      }
      if (hex.length >= 6) {
        return [
          parseInt(hex.slice(0, 2), 16) || 0,
          parseInt(hex.slice(2, 4), 16) || 0,
          parseInt(hex.slice(4, 6), 16) || 0,
        ];
      }
    }
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(',').map((x) => Number.parseFloat(x.trim()));
      if (parts.length >= 3) {
        return [_clampByte(parts[0]), _clampByte(parts[1]), _clampByte(parts[2])];
      }
    }
  }
  return [128, 128, 128];
}

function _rgbLuma(r, g, b) {
  return (r * 77 + g * 150 + b * 29) >> 8;
}

function _norm01(v) {
  return Math.max(0, Math.min(1, v));
}

function _looksStoneLike(r, g, b) {
  return Math.abs(r - g) <= 20 && Math.abs(g - b) <= 20;
}

function _looksWarmRoofLike(r, g, b) {
  return r > (g + 10) && r > (b + 8) && r >= 54;
}

function _looksPlasterLike(r, g, b) {
  return r >= 68 && g >= 50 && b >= 34 && r > g && g > b && (r - b) <= 80;
}

function _looksAccentLike(r, g, b) {
  const strongRed = r >= 140 && g <= 122 && b <= 122;
  const strongBlue = b >= 130 && r <= 130 && g <= 140;
  return strongRed || strongBlue;
}

function _hexShade(hex, delta = 0) {
  try {
    const n = parseInt(String(hex || '').replace('#', ''), 16);
    if (!Number.isFinite(n)) return hex || '#888888';
    const d = Math.round(delta * 255);
    const r = _clampByte((n >> 16) + d);
    const g = _clampByte(((n >> 8) & 255) + d);
    const b = _clampByte((n & 255) + d);
    return `rgb(${r},${g},${b})`;
  } catch {
    return hex || '#888888';
  }
}

function _settlementSpriteRect(ctx, color, x, y, w, h) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.max(1, Math.round(w));
  const rh = Math.max(1, Math.round(h));
  ctx.fillStyle = color;
  ctx.fillRect(rx, ry, rw, rh);
}

function _settlementSpriteFrame(ctx, x, y, w, h, light, dark) {
  const sx = Math.round(x);
  const sy = Math.round(y);
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));
  _settlementSpriteRect(ctx, light, sx, sy, sw, 1);
  _settlementSpriteRect(ctx, light, sx, sy, 1, sh);
  _settlementSpriteRect(ctx, dark, sx, sy + sh - 1, sw, 1);
  _settlementSpriteRect(ctx, dark, sx + sw - 1, sy, 1, sh);
}

function _settlementSpriteDither(ctx, x, y, w, h, colorA, colorB, seed = 0) {
  const sx = Math.round(x);
  const sy = Math.round(y);
  const ex = sx + Math.max(1, Math.round(w));
  const ey = sy + Math.max(1, Math.round(h));
  const b4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];
  for (let yy = sy; yy < ey; yy++) {
    for (let xx = sx; xx < ex; xx++) {
      const idx = ((yy + (seed & 3)) & 3) * 4 + ((xx + ((seed >>> 2) & 3)) & 3);
      const b = b4[idx];
      const n = (Math.imul(xx + seed * 3, 1103515245) + Math.imul(yy + seed * 7, 12345)) >>> 0;
      const threshold = (n >>> 28) & 15;
      const useA = b <= threshold;
      ctx.fillStyle = useA ? colorA : colorB;
      ctx.fillRect(xx, yy, 1, 1);
    }
  }
}

function _settlementSpriteCrenels(ctx, x, y, w, light, dark) {
  const sx = Math.round(x);
  const sy = Math.round(y);
  const width = Math.max(2, Math.round(w));
  _settlementSpriteRect(ctx, _hexShade(light, 0.08), sx, sy - 3, width, 1);
  for (let i = 0; i < width; i += 3) {
    _settlementSpriteRect(ctx, light, sx + i, sy - 2, Math.min(2, width - i), 2);
  }
  _settlementSpriteRect(ctx, _hexShade(dark, -0.10), sx, sy, width, 1);
  _settlementSpriteRect(ctx, dark, sx, sy + 1, width, 1);
}

function _settlementSpriteTower(ctx, x, y, w, h, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark) {
  _settlementSpriteRect(ctx, wallMain, x, y, w, h);
  _settlementSpriteDither(ctx, x, y, w, h, wallLight, wallDark, (Math.round(x) + Math.round(y)) & 15);
  _settlementSpriteFrame(ctx, x, y, w, h, _hexShade(wallLight, 0.08), _hexShade(wallDark, -0.10));
  _settlementSpriteCrenels(ctx, x, y, w, wallLight, wallDark);
  _settlementSpriteRect(ctx, wallDark, x, y + h - 1, w, 1);
  _settlementSpriteRect(ctx, 'rgba(0,0,0,0.55)', x + Math.floor(w * 0.38), y + Math.floor(h * 0.34), Math.max(2, Math.floor(w * 0.22)), Math.max(4, Math.floor(h * 0.44)));

  const cx = x + Math.floor(w * 0.5);
  const roofH = Math.max(4, Math.floor(w * 0.95));
  ctx.fillStyle = roofDark;
  ctx.beginPath();
  ctx.moveTo(x - 1, y);
  ctx.lineTo(cx, y - roofH);
  ctx.lineTo(x + w + 1, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = roofMain;
  ctx.beginPath();
  ctx.moveTo(x, y + 1);
  ctx.lineTo(cx, y - roofH + 1);
  ctx.lineTo(x + w, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = roofLight;
  ctx.beginPath();
  ctx.moveTo(cx, y - roofH + 1);
  ctx.lineTo(x + Math.floor(w * 0.45), y + 1);
  ctx.lineTo(x + Math.floor(w * 0.67), y + 1);
  ctx.closePath();
  ctx.fill();
  _settlementSpriteRect(ctx, _hexShade(roofDark, -0.12), x - 1, y, w + 2, 1);
  _settlementSpriteRect(ctx, _hexShade(roofLight, 0.10), cx, y - roofH + 1, 1, roofH);
}

function _settlementSpriteHouse(ctx, x, y, w, h, wallColor, roofBase, roofMid, roofLight) {
  _settlementSpriteRect(ctx, wallColor, x, y, w, h);
  _settlementSpriteDither(
    ctx,
    x + 1,
    y + 1,
    Math.max(1, w - 2),
    Math.max(1, h - 2),
    _hexShade(wallColor, 0.04),
    _hexShade(wallColor, -0.08),
    (Math.round(x) * 3 + Math.round(y) * 5) & 15,
  );
  _settlementSpriteFrame(ctx, x, y, w, h, _hexShade(wallColor, 0.12), _hexShade(wallColor, -0.20));
  _settlementSpriteRect(ctx, _hexShade(wallColor, -0.18), x, y + h - 1, w, 1);
  _settlementSpriteRect(ctx, 'rgba(30,20,10,0.62)', x + Math.floor(w * 0.42), y + Math.floor(h * 0.42), Math.max(2, Math.floor(w * 0.18)), Math.max(3, Math.floor(h * 0.58)));

  const cx = x + Math.floor(w * 0.5);
  const roofH = Math.max(3, Math.floor(h * 0.82));
  ctx.fillStyle = roofBase;
  ctx.beginPath();
  ctx.moveTo(x - 1, y);
  ctx.lineTo(cx, y - roofH);
  ctx.lineTo(x + w + 1, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = roofMid;
  ctx.beginPath();
  ctx.moveTo(x, y + 1);
  ctx.lineTo(cx, y - roofH + 1);
  ctx.lineTo(x + w, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = roofLight;
  ctx.beginPath();
  ctx.moveTo(cx, y - roofH + 1);
  ctx.lineTo(x + Math.floor(w * 0.45), y + 1);
  ctx.lineTo(x + Math.floor(w * 0.62), y + 1);
  ctx.closePath();
  ctx.fill();
  _settlementSpriteRect(ctx, _hexShade(roofBase, -0.10), x - 1, y, w + 2, 1);
  _settlementSpriteRect(ctx, _hexShade(roofLight, 0.12), cx, y - roofH + 1, 1, roofH);
}

function _settlementSpritePennant(ctx, x, y, color) {
  const flagColor = color || '#c0392b';
  _settlementSpriteRect(ctx, '#3b2816', x, y - 5, 1, 6);
  _settlementSpriteRect(ctx, _hexShade(flagColor, -0.10), x + 1, y - 5, 5, 3);
  _settlementSpriteRect(ctx, flagColor, x + 1, y - 4, 5, 2);
  _settlementSpriteRect(ctx, _hexShade(flagColor, 0.18), x + 2, y - 4, 2, 1);
  _settlementSpriteRect(ctx, 'rgba(255,255,255,0.55)', x + 2, y - 3, 1, 1);
}

function _spriteTriangle(ctx, color, x1, y1, x2, y2, x3, y3) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fill();
}

function _spriteDome(ctx, dark, mid, light, cx, cy, rx, ry) {
  ctx.fillStyle = dark;
  ctx.beginPath();
  _ellipse(ctx, cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mid;
  ctx.beginPath();
  _ellipse(ctx, cx, cy + 1, rx * 0.88, ry * 0.82, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  _ellipse(ctx, cx - rx * 0.28, cy - ry * 0.20, rx * 0.34, ry * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
}

function _drawCityRegionMotif(ctx, fid, pal, rv, seed, wallX, wallY, wallW, wallH, w, h) {
  const bandY = wallY + wallH - 2;
  if (rv === 0) {
    const stallW = 7;
    const gap = 4;
    const start = wallX + Math.max(2, Math.floor((wallW - (stallW * 3 + gap * 2)) * 0.5));
    for (let i = 0; i < 3; i++) {
      const sx = start + i * (stallW + gap);
      _settlementSpriteRect(ctx, pal.plaster, sx, bandY + 1, stallW, 4);
      _spriteTriangle(ctx, pal.roofMid, sx - 1, bandY + 1, sx + Math.floor(stallW * 0.5), bandY - 3, sx + stallW + 1, bandY + 1);
      _settlementSpriteRect(ctx, _hexShade(pal.roofLight, 0.08), sx + 1, bandY - 1, stallW - 2, 1);
    }
    return;
  }

  if (rv === 1) {
    const tw = Math.max(7, Math.floor(w * 0.10));
    const th = Math.max(14, Math.floor(h * 0.24));
    const tx = wallX + Math.max(2, Math.floor((fid === 'venice' ? wallW - tw - 3 : 3)));
    const ty = wallY - th + 5;
    _settlementSpriteRect(ctx, pal.stoneMid, tx, ty, tw, th);
    _settlementSpriteDither(ctx, tx, ty, tw, th, pal.stoneLight, pal.stoneDark, 2);
    if (fid === 'ottoman') {
      _spriteTriangle(ctx, pal.roofDark, tx - 1, ty + 1, tx + Math.floor(tw * 0.5), ty - 5, tx + tw + 1, ty + 1);
    } else if (fid === 'polish') {
      _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, tx + Math.floor(tw * 0.5), ty + 1, Math.floor(tw * 0.44), Math.floor(tw * 0.33));
    } else {
      _spriteTriangle(ctx, pal.roofMid, tx - 1, ty + 1, tx + Math.floor(tw * 0.5), ty - 7, tx + tw + 1, ty + 1);
    }
    _settlementSpriteRect(ctx, 'rgba(28,20,12,0.70)', tx + Math.floor(tw * 0.38), ty + Math.floor(th * 0.36), Math.max(2, Math.floor(tw * 0.20)), 3);
    return;
  }

  if (rv === 2) {
    const cx = wallX + Math.floor(wallW * 0.50);
    const cy = bandY + 1;
    const rw = Math.max(12, Math.floor(wallW * 0.36));
    _settlementSpriteRect(ctx, pal.stoneDark, cx - Math.floor(rw * 0.5), cy, rw, 3);
    _settlementSpriteRect(ctx, pal.stoneMid, cx - Math.floor(rw * 0.5), cy - 1, rw, 1);
    _settlementSpriteRect(ctx, pal.plaster, cx - 2, cy - 7, 4, 6);
    if (fid === 'ottoman' || fid === 'venice') {
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, cx, cy - 8, 4, 3);
    } else {
      _spriteTriangle(ctx, pal.roofMid, cx - 4, cy - 7, cx, cy - 12, cx + 4, cy - 7);
    }
    return;
  }

  if (rv === 3) {
    const laneY = bandY + 2;
    _settlementSpriteRect(ctx, _hexShade(pal.pathDark, 0.04), wallX + 2, laneY, wallW - 4, 2);
    for (let i = 0; i < 4; i++) {
      const px = wallX + 5 + i * Math.floor((wallW - 12) / 4);
      _settlementSpriteRect(ctx, _hexShade(pal.pathLight, -0.08), px, laneY + (i & 1), 2, 1);
    }
    return;
  }

  if (rv === 4) {
    const fx = wallX + Math.floor(wallW * 0.22);
    const fy = wallY + Math.floor(wallH * 0.18);
    _settlementSpriteRect(ctx, pal.stoneMid, fx, fy, 10, 7);
    _settlementSpriteRect(ctx, pal.stoneLight, fx + 1, fy + 1, 8, 5);
    _settlementSpriteRect(ctx, pal.stoneDark, fx + 4, fy - 5, 2, 5);
    _settlementSpriteRect(ctx, pal.roofDark, fx + 3, fy - 5, 4, 1);
    _settlementSpriteRect(ctx, _hexShade(pal.roofLight, 0.05), fx + 2, fy + 3, 6, 1);
    return;
  }

  const rowY = wallY + Math.max(1, Math.floor(wallH * 0.20));
  for (let i = 0; i < 5; i++) {
    const hx = wallX + 4 + i * Math.floor((wallW - 10) / 5);
    const hw = 5 + ((i + (seed & 3)) % 2);
    _settlementSpriteHouse(ctx, hx, rowY + (i & 1), hw, 5, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
  }
}

function _drawFactionCitySprite(ctx, fid, pal, seed, factionColor, w, h, regionVariant = 0) {
  let wallX = Math.floor(w * 0.14);
  let wallY = Math.floor(h * 0.42);
  let wallW = Math.floor(w * 0.72);
  let wallH = Math.floor(h * 0.28);
  const rv = Math.max(0, regionVariant | 0) % 6;

  if (rv === 1) {
    wallY -= 2;
    wallH += 2;
  } else if (rv === 2) {
    wallX -= 2;
    wallW += 4;
  } else if (rv === 3) {
    wallY += 1;
    wallH -= 1;
  } else if (rv === 4) {
    wallY -= 1;
    wallH += 1;
    wallW -= 2;
    wallX += 1;
  } else if (rv === 5) {
    wallX -= 1;
    wallW += 2;
  }

  _settlementSpriteRect(ctx, pal.stoneMid, wallX, wallY, wallW, wallH);
  _settlementSpriteDither(ctx, wallX, wallY, wallW, wallH, pal.stoneLight, pal.stoneDark, seed & 3);
  _settlementSpriteCrenels(ctx, wallX, wallY, wallW, pal.stoneLight, pal.stoneDark);
  _settlementSpriteRect(ctx, 'rgba(22,18,14,0.70)', wallX + Math.floor(wallW * 0.46), wallY + Math.floor(wallH * 0.35), Math.max(4, Math.floor(w * 0.06)), Math.max(6, Math.floor(h * 0.13)));

  if (rv === 2) {
    const ux = wallX + Math.floor(wallW * 0.14);
    const uw = Math.floor(wallW * 0.72);
    _settlementSpriteRect(ctx, _hexShade(pal.stoneMid, 0.05), ux, wallY - 6, uw, 6);
    _settlementSpriteCrenels(ctx, ux, wallY - 6, uw, _hexShade(pal.stoneLight, 0.03), pal.stoneDark);
  } else if (rv === 4) {
    const tx = wallX + 3;
    const tw = wallW - 6;
    _settlementSpriteRect(ctx, _hexShade(pal.stoneDark, 0.08), tx, wallY + Math.floor(wallH * 0.55), tw, Math.max(2, Math.floor(wallH * 0.18)));
    for (let i = 0; i < 3; i++) {
      const sx = tx + 3 + i * Math.floor((tw - 8) / 3);
      _settlementSpriteRect(ctx, _hexShade(pal.stoneLight, -0.02), sx, wallY + Math.floor(wallH * 0.60), 2, 1);
    }
  } else if (rv === 5) {
    const lx = wallX + Math.floor(wallW * 0.28);
    const rx = wallX + Math.floor(wallW * 0.62);
    _settlementSpriteRect(ctx, pal.stoneMid, lx, wallY - 7, 6, 7);
    _settlementSpriteRect(ctx, pal.stoneMid, rx, wallY - 7, 6, 7);
    _spriteTriangle(ctx, pal.roofMid, lx - 1, wallY - 7, lx + 3, wallY - 12, lx + 7, wallY - 7);
    _spriteTriangle(ctx, pal.roofMid, rx - 1, wallY - 7, rx + 3, wallY - 12, rx + 7, wallY - 7);
  }

  if (fid === 'ottoman') {
    const minaretW = Math.max(4, Math.floor(w * 0.05));
    const minaretH = Math.max(18, Math.floor(h * (rv === 2 ? 0.38 : 0.34)));
    const leftX = wallX + (rv === 1 ? 8 : 2);
    const rightX = wallX + wallW - minaretW - (rv === 1 ? 8 : 2);
    const topY = wallY - minaretH + 2;
    _settlementSpriteRect(ctx, pal.plaster, leftX, topY, minaretW, minaretH);
    _settlementSpriteRect(ctx, pal.plaster, rightX, topY, minaretW, minaretH);
    _spriteTriangle(ctx, pal.roofDark, leftX - 1, topY + 1, leftX + Math.floor(minaretW * 0.5), topY - Math.floor(minaretW * 0.9), leftX + minaretW + 1, topY + 1);
    _spriteTriangle(ctx, pal.roofDark, rightX - 1, topY + 1, rightX + Math.floor(minaretW * 0.5), topY - Math.floor(minaretW * 0.9), rightX + minaretW + 1, topY + 1);
    if (rv === 0) {
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.50), wallY + 1, Math.floor(w * 0.13), Math.floor(h * 0.11));
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.30), wallY + 4, Math.floor(w * 0.09), Math.floor(h * 0.08));
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.70), wallY + 4, Math.floor(w * 0.09), Math.floor(h * 0.08));
    } else if (rv === 1) {
      _settlementSpriteRect(ctx, pal.plaster, wallX + 11, wallY - 8, wallW - 22, 9);
      for (let i = 0; i < 4; i++) _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.20), wallX + 13 + i * 10, wallY - 5, 6, 2);
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.50), wallY + 2, Math.floor(w * 0.09), Math.floor(h * 0.07));
    } else if (rv === 2) {
      _settlementSpriteRect(ctx, pal.stoneMid, wallX + Math.floor(wallW * 0.43), wallY - 16, Math.floor(w * 0.14), 18);
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.50), wallY - 16, Math.floor(w * 0.08), Math.floor(h * 0.06));
      _settlementSpriteRect(ctx, pal.stoneDark, wallX + Math.floor(wallW * 0.22), wallY - 4, Math.floor(w * 0.10), 5);
      _settlementSpriteRect(ctx, pal.stoneDark, wallX + Math.floor(wallW * 0.68), wallY - 4, Math.floor(w * 0.10), 5);
    } else {
      _settlementSpriteTower(ctx, wallX + 2, wallY - 11, 10, 20, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
      _settlementSpriteTower(ctx, wallX + wallW - 12, wallY - 11, 10, 20, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.50), wallY + 2, Math.floor(w * 0.10), Math.floor(h * 0.08));
    }
  } else if (fid === 'hre') {
    if (rv === 0) {
      _settlementSpriteTower(ctx, wallX + 1, wallY - 13, 11, 24, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
      _settlementSpriteTower(ctx, wallX + Math.floor(wallW * 0.42), wallY - 20, 12, 30, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
      _settlementSpriteTower(ctx, wallX + wallW - 12, wallY - 13, 11, 24, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    } else if (rv === 1) {
      _settlementSpriteRect(ctx, pal.plaster, wallX + 10, wallY - 9, wallW - 20, 10);
      _spriteTriangle(ctx, pal.roofMid, wallX + 8, wallY - 9, wallX + Math.floor(wallW * 0.5), wallY - 20, wallX + wallW - 8, wallY - 9);
      _settlementSpriteTower(ctx, wallX + wallW - 14, wallY - 18, 12, 28, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    } else if (rv === 2) {
      _settlementSpriteRect(ctx, pal.stoneMid, wallX + 2, wallY - 12, wallW - 4, 10);
      _settlementSpriteCrenels(ctx, wallX + 2, wallY - 12, wallW - 4, pal.stoneLight, pal.stoneDark);
      _settlementSpriteTower(ctx, wallX + 3, wallY - 18, 10, 26, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
      _settlementSpriteTower(ctx, wallX + wallW - 13, wallY - 18, 10, 26, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    } else {
      _settlementSpriteTower(ctx, wallX + Math.floor(wallW * 0.43), wallY - 21, 13, 31, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
      _settlementSpriteRect(ctx, pal.plaster, wallX + 8, wallY - 5, wallW - 16, 6);
      for (let i = 0; i < 4; i++) _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.18), wallX + 11 + i * 9, wallY - 2, 4, 3);
    }
    _settlementSpriteHouse(ctx, wallX + 16, wallY + wallH - 7, 12, 8, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
    _settlementSpriteHouse(ctx, wallX + wallW - 29, wallY + wallH - 7, 12, 8, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
  } else if (fid === 'polish') {
    const onionRx = Math.max(4, Math.floor(w * 0.06));
    const onionRy = Math.max(3, Math.floor(h * 0.05));
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + 3, wallY - 11, 8, 16);
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + wallW - 11, wallY - 11, 8, 16);
    _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, wallX + 7, wallY - 11, onionRx, onionRy);
    _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, wallX + wallW - 7, wallY - 11, onionRx, onionRy);
    if (rv === 0) {
      _settlementSpriteRect(ctx, pal.plaster, wallX + Math.floor(wallW * 0.37), wallY - 8, Math.floor(w * 0.18), 12);
      _spriteTriangle(ctx, pal.roofMid, wallX + Math.floor(wallW * 0.34), wallY - 7, wallX + Math.floor(wallW * 0.46), wallY - 16, wallX + Math.floor(wallW * 0.58), wallY - 7);
    } else if (rv === 1) {
      _settlementSpriteRect(ctx, pal.stoneMid, wallX + 14, wallY - 12, wallW - 28, 9);
      _settlementSpriteCrenels(ctx, wallX + 14, wallY - 12, wallW - 28, pal.stoneLight, pal.stoneDark);
    } else if (rv === 2) {
      _settlementSpriteHouse(ctx, wallX + 20, wallY - 9, 16, 10, pal.plaster, pal.roofDark, pal.roofMid, pal.roofLight);
    } else {
      _settlementSpriteRect(ctx, pal.plaster, wallX + 17, wallY - 9, wallW - 34, 9);
      for (let i = 0; i < 3; i++) _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.18), wallX + 20 + i * 10, wallY - 6, 6, 2);
    }
  } else if (fid === 'spanish') {
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + 2, wallY - 10, wallW - 4, 11);
    _settlementSpriteCrenels(ctx, wallX + 2, wallY - 10, wallW - 4, pal.stoneLight, pal.stoneDark);
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + 1, wallY - 15, 8, 18);
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + wallW - 9, wallY - 15, 8, 18);
    _spriteTriangle(ctx, pal.roofMid, wallX, wallY - 15, wallX + 5, wallY - 21, wallX + 10, wallY - 15);
    _spriteTriangle(ctx, pal.roofMid, wallX + wallW - 10, wallY - 15, wallX + wallW - 5, wallY - 21, wallX + wallW, wallY - 15);
    if (rv === 0) {
      for (let i = 0; i < 3; i++) {
        const wx = wallX + 12 + i * 12;
        _settlementSpriteRect(ctx, 'rgba(25,18,14,0.58)', wx, wallY + 4, 3, 5);
      }
    } else if (rv === 1) {
      _settlementSpriteRect(ctx, pal.plaster, wallX + 14, wallY - 8, wallW - 28, 8);
      _spriteTriangle(ctx, pal.roofMid, wallX + 12, wallY - 8, wallX + Math.floor(wallW * 0.5), wallY - 18, wallX + wallW - 12, wallY - 8);
    } else if (rv === 2) {
      _settlementSpriteTower(ctx, wallX + Math.floor(wallW * 0.43), wallY - 18, 12, 28, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    } else {
      _settlementSpriteRect(ctx, pal.stoneDark, wallX + 15, wallY - 4, wallW - 30, 4);
      _settlementSpriteRect(ctx, pal.stoneMid, wallX + 22, wallY - 13, wallW - 44, 9);
    }
  } else if (fid === 'venice') {
    _settlementSpriteRect(ctx, pal.plaster, wallX + 6, wallY - 8, wallW - 12, 11);
    _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.12), wallX + 6, wallY + 2, wallW - 12, 1);
    for (let i = 0; i < 4; i++) {
      const ax = wallX + 8 + i * 11;
      _settlementSpriteRect(ctx, pal.stoneDark, ax, wallY + 4, 2, 6);
      _settlementSpriteRect(ctx, pal.plaster, ax + 1, wallY + 4, 4, 6);
    }
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + wallW - 15, wallY - 18, 9, 21);
    _settlementSpriteCrenels(ctx, wallX + wallW - 15, wallY - 18, 9, pal.stoneLight, pal.stoneDark);
    _spriteTriangle(ctx, pal.roofMid, wallX + wallW - 17, wallY - 18, wallX + wallW - 11, wallY - 26, wallX + wallW - 5, wallY - 18);
    if (rv === 1) {
      _settlementSpriteRect(ctx, pal.stoneDark, wallX + 14, wallY - 2, 18, 3);
      _settlementSpriteRect(ctx, pal.stoneMid, wallX + 20, wallY - 6, 6, 4);
    } else if (rv === 2) {
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.38), wallY - 6, Math.floor(w * 0.07), Math.floor(h * 0.05));
      _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, wallX + Math.floor(wallW * 0.57), wallY - 6, Math.floor(w * 0.07), Math.floor(h * 0.05));
    } else if (rv === 3) {
      _settlementSpriteTower(ctx, wallX + 4, wallY - 14, 10, 24, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    }
  } else {
    _settlementSpriteTower(ctx, wallX + 1, wallY - 12, 10, 22, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    _settlementSpriteTower(ctx, wallX + wallW - 11, wallY - 12, 10, 22, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    if (rv >= 2) _settlementSpriteTower(ctx, wallX + Math.floor(wallW * 0.46), wallY - 16, 9, 26, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
  }

  const houseCount = 2 + Math.floor(_seedRand(seed, 10) * 3);
  for (let i = 0; i < houseCount; i++) {
    const hx = wallX + 5 + Math.floor(_seedRand(seed, 20 + i) * (wallW - 20));
    const hw = 9 + Math.floor(_seedRand(seed, 30 + i) * 4);
    const hh = 6 + Math.floor(_seedRand(seed, 40 + i) * 3);
    _settlementSpriteHouse(ctx, hx, wallY + wallH - hh + 1, hw, hh, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
  }

  _drawCityRegionMotif(ctx, fid, pal, rv, seed, wallX, wallY, wallW, wallH, w, h);

  // City-specific micro signature (seed-coded facade lights) to keep each city visually unique.
  const sigY = wallY + Math.max(3, Math.floor(wallH * 0.18));
  for (let i = 0; i < 8; i++) {
    const bit = ((seed >>> i) & 1) === 1;
    const sx = wallX + 6 + i * 6;
    _settlementSpriteRect(ctx, bit ? 'rgba(245,214,118,0.86)' : 'rgba(31,24,18,0.48)', sx, sigY + (i & 1), 2, 2);
  }
  _settlementSpritePennant(ctx, wallX + Math.floor(wallW * 0.52), wallY - 2, factionColor);
}

function _drawFortFactionMotif(ctx, fid, pal, layout, seed, wallX, wallY, wallW, wallH, w, h) {
  const bandY = wallY + Math.floor(wallH * 0.26);
  if (fid === 'ottoman') {
    const domeX = wallX + Math.floor(wallW * 0.50);
    const domeY = wallY - Math.max(6, Math.floor(h * 0.10));
    _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, domeX, domeY, Math.max(4, Math.floor(w * 0.06)), Math.max(3, Math.floor(h * 0.04)));
    _settlementSpriteRect(ctx, pal.plaster, domeX - 3, domeY, 6, 4);
    for (let i = 0; i < 4; i++) {
      const wx = wallX + 5 + i * Math.floor((wallW - 10) / 4);
      _settlementSpriteRect(ctx, 'rgba(34,25,18,0.65)', wx, bandY + (i & 1), 2, 2);
    }
    return;
  }
  if (fid === 'hre') {
    for (let i = 0; i < 3; i++) {
      const bx = wallX + 8 + i * Math.floor((wallW - 16) / 3);
      _settlementSpriteRect(ctx, pal.plaster, bx, bandY + 2, 6, 5);
      _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.20), bx + 2, bandY + 1, 2, 1);
      _settlementSpriteRect(ctx, pal.woodDark, bx + 1, bandY + 4, 1, 3);
      _settlementSpriteRect(ctx, pal.woodDark, bx + 4, bandY + 4, 1, 3);
    }
    return;
  }
  if (fid === 'polish') {
    const chapelX = wallX + Math.floor(wallW * 0.46);
    const chapelY = wallY - Math.max(8, Math.floor(h * 0.14));
    _settlementSpriteRect(ctx, pal.stoneMid, chapelX - 4, chapelY, 8, 8);
    _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, chapelX, chapelY, 4, 3);
    _settlementSpriteRect(ctx, pal.roofLight, chapelX - 1, chapelY - 2, 2, 2);
    return;
  }
  if (fid === 'spanish') {
    const courtX = wallX + Math.floor(wallW * 0.24);
    const courtW = Math.max(10, Math.floor(wallW * 0.52));
    _settlementSpriteRect(ctx, _hexShade(pal.pathLight, -0.04), courtX, wallY + Math.floor(wallH * 0.48), courtW, 3);
    for (let i = 0; i < 3; i++) {
      const px = courtX + 2 + i * Math.floor((courtW - 4) / 3);
      _settlementSpriteRect(ctx, pal.plaster, px, wallY + Math.floor(wallH * 0.42), 2, 2);
    }
    return;
  }
  if (fid === 'venice') {
    const canalY = wallY + wallH + 1;
    _settlementSpriteRect(ctx, _hexShade(pal.domeDark, -0.10), wallX + 2, canalY, wallW - 4, 2);
    for (let i = 0; i < 3; i++) {
      const ax = wallX + 8 + i * Math.floor((wallW - 16) / 3);
      _settlementSpriteRect(ctx, pal.plaster, ax, wallY + Math.floor(wallH * 0.34), 4, 4);
      _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.16), ax + 1, wallY + Math.floor(wallH * 0.36), 2, 2);
    }
    return;
  }
  if (layout.gateArch) {
    _settlementSpriteRect(ctx, _hexShade(pal.stoneDark, -0.05), wallX + Math.floor(wallW * 0.40), wallY + Math.floor(wallH * 0.58), Math.max(6, Math.floor(wallW * 0.20)), 2);
  }
  if ((seed & 1) === 1) {
    _settlementSpriteRect(ctx, pal.plaster, wallX + Math.floor(wallW * 0.18), wallY + Math.floor(wallH * 0.26), 5, 4);
  }
}

function _drawFactionFortSprite(ctx, fid, pal, variant, seed, factionColor, w, h) {
  const layouts = _fortLayoutsForFaction(fid);
  const layout = layouts[variant % layouts.length];
  const wallW = Math.floor(w * layout.wallW);
  const wallH = Math.floor(h * layout.wallH);
  const wallX = Math.floor((w - wallW) * 0.5);
  const wallY = Math.floor(h * 0.46);

  if (layout.splitWall) {
    const leftW = Math.floor(wallW * 0.42);
    const rightW = Math.floor(wallW * 0.42);
    const gap = wallW - leftW - rightW;
    _settlementSpriteRect(ctx, pal.stoneMid, wallX, wallY, leftW, wallH);
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + leftW + gap, wallY, rightW, wallH);
    _settlementSpriteDither(ctx, wallX, wallY, leftW, wallH, pal.stoneLight, pal.stoneDark, (seed >>> 3) & 3);
    _settlementSpriteDither(ctx, wallX + leftW + gap, wallY, rightW, wallH, pal.stoneLight, pal.stoneDark, (seed >>> 5) & 3);
    _settlementSpriteCrenels(ctx, wallX, wallY, leftW, pal.stoneLight, pal.stoneDark);
    _settlementSpriteCrenels(ctx, wallX + leftW + gap, wallY, rightW, pal.stoneLight, pal.stoneDark);
    _settlementSpriteRect(ctx, pal.stoneDark, wallX + leftW, wallY + Math.floor(wallH * 0.35), gap, Math.max(2, Math.floor(wallH * 0.50)));
  } else {
    _settlementSpriteRect(ctx, pal.stoneMid, wallX, wallY, wallW, wallH);
    _settlementSpriteDither(ctx, wallX, wallY, wallW, wallH, pal.stoneLight, pal.stoneDark, (seed >>> 3) & 3);
    _settlementSpriteCrenels(ctx, wallX, wallY, wallW, pal.stoneLight, pal.stoneDark);
  }

  if (layout.bastion) {
    _settlementSpriteRect(ctx, pal.stoneDark, wallX - 5, wallY + Math.floor(wallH * 0.35), 7, Math.floor(wallH * 0.78));
    _settlementSpriteRect(ctx, pal.stoneDark, wallX + wallW - 2, wallY + Math.floor(wallH * 0.35), 7, Math.floor(wallH * 0.78));
  }

  const towerW = Math.max(8, Math.floor(w * 0.12));
  const towerH = Math.max(14, Math.floor(h * 0.28));
  const towerTop = wallY - towerH + 3;
  const slots = [];
  if (layout.towers === 1) slots.push(Math.floor(w * 0.5 - towerW * 0.5));
  else if (layout.towers === 2) slots.push(wallX - 1, wallX + wallW - towerW + 1);
  else slots.push(wallX - 1, Math.floor(w * 0.5 - towerW * 0.5), wallX + wallW - towerW + 1);

  for (let i = 0; i < slots.length; i++) {
    const tx = slots[i];
    if (layout.round && i !== 1) {
      _settlementSpriteRect(ctx, pal.stoneMid, tx + 1, towerTop + 2, towerW - 2, towerH);
      if (layout.onion) {
        _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, tx + Math.floor(towerW * 0.5), towerTop + 1, Math.floor(towerW * 0.46), Math.floor(towerW * 0.38));
      } else {
        _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, tx + Math.floor(towerW * 0.5), towerTop + 2, Math.floor(towerW * 0.46), Math.floor(towerW * 0.34));
      }
    } else if ((fid === 'ottoman' || layout.minaret) && i !== 1) {
      _settlementSpriteRect(ctx, pal.plaster, tx + 2, towerTop + 2, towerW - 4, towerH);
      _spriteTriangle(ctx, pal.roofDark, tx + 1, towerTop + 3, tx + Math.floor(towerW * 0.5), towerTop - 6, tx + towerW - 1, towerTop + 3);
    } else {
      _settlementSpriteTower(ctx, tx, towerTop, towerW, towerH, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    }
  }

  if (layout.keep) {
    const keepW = Math.max(12, Math.floor(w * 0.18));
    const keepH = Math.max(14, Math.floor(h * 0.25));
    const keepX = Math.floor(w * 0.5 - keepW * 0.5);
    const keepY = wallY - keepH + 5;
    _settlementSpriteRect(ctx, pal.stoneMid, keepX, keepY, keepW, keepH);
    _settlementSpriteDither(ctx, keepX, keepY, keepW, keepH, pal.stoneLight, pal.stoneDark, 1);
    if (layout.domeKeep || fid === 'venice' || fid === 'polish') {
      _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, keepX + Math.floor(keepW * 0.5), keepY + 1, Math.floor(keepW * 0.35), Math.floor(keepW * 0.26));
    } else if (layout.onion) {
      _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, keepX + Math.floor(keepW * 0.5), keepY + 1, Math.floor(keepW * 0.30), Math.floor(keepW * 0.30));
      _settlementSpriteRect(ctx, pal.roofLight, keepX + Math.floor(keepW * 0.46), keepY - 2, Math.max(2, Math.floor(keepW * 0.08)), 2);
    } else if (layout.spireKeep) {
      _spriteTriangle(ctx, pal.roofMid, keepX - 2, keepY + 1, keepX + Math.floor(keepW * 0.50), keepY - Math.floor(keepW * 0.70), keepX + keepW + 2, keepY + 1);
      _settlementSpriteRect(ctx, pal.roofLight, keepX + Math.floor(keepW * 0.48), keepY - Math.floor(keepW * 0.70) - 3, 2, 3);
    } else {
      _spriteTriangle(ctx, pal.roofMid, keepX - 1, keepY + 1, keepX + Math.floor(keepW * 0.5), keepY - Math.floor(keepW * 0.52), keepX + keepW + 1, keepY + 1);
    }
  }

  if (layout.barbican) {
    const bx = wallX + Math.floor(wallW * 0.40);
    const bw = Math.max(8, Math.floor(wallW * 0.20));
    const by = wallY + Math.floor(wallH * 0.25);
    _settlementSpriteRect(ctx, pal.stoneDark, bx, by, bw, Math.max(5, Math.floor(wallH * 0.72)));
    _settlementSpriteCrenels(ctx, bx, by, bw, pal.stoneLight, pal.stoneDark);
  }
  if (layout.campanile) {
    const cx = wallX + wallW - Math.max(9, Math.floor(w * 0.12));
    const cw = Math.max(8, Math.floor(w * 0.11));
    const ch = Math.max(18, Math.floor(h * 0.34));
    const cy = wallY - ch + 4;
    _settlementSpriteRect(ctx, pal.plaster, cx, cy, cw, ch);
    _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.18), cx, cy + ch - 1, cw, 1);
    _spriteTriangle(ctx, pal.roofMid, cx - 1, cy + 1, cx + Math.floor(cw * 0.5), cy - Math.floor(cw * 0.9), cx + cw + 1, cy + 1);
  }
  if (layout.alcazar) {
    _settlementSpriteRect(ctx, pal.plaster, wallX + 8, wallY - 8, wallW - 16, 7);
    _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.14), wallX + 8, wallY - 1, wallW - 16, 1);
  }
  _drawFortFactionMotif(ctx, fid, pal, layout, seed, wallX, wallY, wallW, wallH, w, h);

  const gateH = Math.max(5, Math.floor(h * 0.13));
  const gateX = wallX + Math.floor(wallW * 0.47);
  const gateW = Math.max(3, Math.floor(w * 0.05));
  if (layout.gateArch) {
    _settlementSpriteRect(ctx, 'rgba(24,18,14,0.72)', gateX, wallY + Math.floor(wallH * 0.36), gateW, gateH);
    _spriteDome(ctx, '#2a2018', '#35281f', '#483124', gateX + Math.floor(gateW * 0.5), wallY + Math.floor(wallH * 0.36), Math.max(2, Math.floor(gateW * 0.5)), Math.max(1, Math.floor(gateW * 0.25)));
  } else {
    _settlementSpriteRect(ctx, 'rgba(24,18,14,0.72)', gateX, wallY + Math.floor(wallH * 0.30), gateW, gateH);
  }
  _settlementSpritePennant(ctx, wallX + Math.floor(wallW * (0.42 + _seedRand(seed, 77) * 0.18)), wallY - 1, factionColor);
}

function _drawHut(ctx, pal, x, y, w, h, tallRoof = false) {
  _settlementSpriteRect(ctx, pal.plaster, x, y, w, h);
  _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.14), x, y + h - 1, w, 1);
  const roofH = tallRoof ? Math.max(4, Math.floor(h * 1.0)) : Math.max(3, Math.floor(h * 0.78));
  _spriteTriangle(ctx, pal.woodMid, x - 1, y + 1, x + Math.floor(w * 0.5), y - roofH, x + w + 1, y + 1);
  _spriteTriangle(ctx, pal.woodLight, x + Math.floor(w * 0.42), y + 1, x + Math.floor(w * 0.5), y - roofH, x + Math.floor(w * 0.68), y + 1);
  _settlementSpriteRect(ctx, 'rgba(28,20,14,0.62)', x + Math.floor(w * 0.42), y + Math.floor(h * 0.44), Math.max(2, Math.floor(w * 0.16)), Math.max(3, Math.floor(h * 0.56)));
}

function _drawVillageSprite(ctx, pal, variant, seed, factionColor, w, h) {
  const v = variant % 15;
  const baseY = Math.floor(h * 0.58);
  const hutPal = { ...pal };
  if (v === 12) {
    hutPal.plaster = '#a89072';
    hutPal.woodMid = '#8a6a3b';
    hutPal.woodLight = '#b48d5d';
  } else if (v === 13) {
    hutPal.plaster = '#b9b6b1';
    hutPal.woodMid = '#5f4b39';
    hutPal.woodLight = '#7f6650';
  }

  if (v === 3) {
    _drawHut(ctx, hutPal, 10, baseY + 1, 12, 9, false);
    _drawHut(ctx, hutPal, 38, baseY + 2, 12, 8, false);
    _settlementSpriteRect(ctx, hutPal.woodDark, 27, baseY - 12, 2, 22);
    _settlementSpriteRect(ctx, hutPal.woodMid, 23, baseY - 5, 10, 2);
    _settlementSpriteRect(ctx, hutPal.woodMid, 26, baseY - 10, 2, 12);
  } else if (v === 4) {
    _drawHut(ctx, hutPal, 10, baseY + 2, 12, 8, false);
    _drawHut(ctx, hutPal, 38, baseY + 2, 12, 8, false);
    _settlementSpriteRect(ctx, pal.stoneMid, 25, baseY - 8, 8, 18);
    _spriteDome(ctx, pal.roofDark, pal.roofMid, pal.roofLight, 29, baseY - 8, 5, 3);
  } else if (v === 5) {
    _drawHut(ctx, hutPal, 9, baseY + 2, 16, 9, false);
    _drawHut(ctx, hutPal, 33, baseY + 3, 16, 8, false);
    _settlementSpriteRect(ctx, pal.woodDark, 28, baseY + 1, 2, 10);
    _settlementSpriteRect(ctx, pal.woodLight, 27, baseY + 3, 4, 1);
  } else if (v === 6) {
    _drawHut(ctx, hutPal, 9, baseY + 2, 14, 8, false);
    _settlementSpriteRect(ctx, pal.woodDark, 29, baseY + 4, 18, 6);
    _settlementSpriteRect(ctx, pal.woodLight, 29, baseY + 3, 18, 1);
    _spriteTriangle(ctx, pal.woodMid, 28, baseY + 4, 38, baseY - 5, 48, baseY + 4);
  } else if (v === 7) {
    _drawHut(ctx, hutPal, 10, baseY + 3, 13, 8, false);
    _drawHut(ctx, hutPal, 38, baseY + 3, 13, 8, false);
    for (let i = 0; i < 6; i++) _settlementSpriteRect(ctx, pal.woodDark, 24 + i * 2, baseY + 8, 1, 3);
  } else if (v === 8) {
    _drawHut(ctx, hutPal, 9, baseY + 2, 12, 8, false);
    _drawHut(ctx, hutPal, 39, baseY + 2, 12, 8, false);
    for (let i = 0; i < 7; i++) _settlementSpriteRect(ctx, pal.woodMid, 23 + i * 4, baseY - 3 + (i & 1), 2, 12);
  } else if (v === 9) {
    _drawHut(ctx, hutPal, 11, baseY + 2, 13, 8, false);
    _drawHut(ctx, hutPal, 26, baseY + 3, 12, 7, false);
    _drawHut(ctx, hutPal, 40, baseY + 2, 13, 8, false);
  } else if (v === 10) {
    _drawHut(ctx, hutPal, 12, baseY + 2, 12, 8, false);
    _drawHut(ctx, hutPal, 26, baseY + 2, 12, 8, false);
    _drawHut(ctx, hutPal, 40, baseY + 2, 12, 8, false);
    _settlementSpriteRect(ctx, pal.stoneMid, 26, baseY - 5, 2, 6);
  } else if (v === 11) {
    _drawHut(ctx, hutPal, 12, baseY + 3, 15, 7, false);
    _drawHut(ctx, hutPal, 33, baseY + 3, 15, 7, false);
    _settlementSpriteRect(ctx, pal.woodDark, 28, baseY + 4, 3, 6);
  } else if (v === 12) {
    _spriteDome(ctx, pal.woodDark, pal.woodMid, pal.woodLight, 18, baseY + 5, 7, 4);
    _spriteDome(ctx, pal.woodDark, pal.woodMid, pal.woodLight, 34, baseY + 6, 8, 5);
    _spriteDome(ctx, pal.woodDark, pal.woodMid, pal.woodLight, 48, baseY + 5, 7, 4);
  } else if (v === 13) {
    _drawHut(ctx, hutPal, 10, baseY + 3, 14, 7, true);
    _drawHut(ctx, hutPal, 25, baseY + 2, 15, 8, true);
    _drawHut(ctx, hutPal, 42, baseY + 3, 13, 7, true);
  } else if (v === 14) {
    _drawHut(ctx, hutPal, 11, baseY + 3, 12, 7, false);
    _drawHut(ctx, hutPal, 25, baseY + 2, 12, 8, false);
    _drawHut(ctx, hutPal, 39, baseY + 3, 12, 7, false);
    for (let i = 0; i < 4; i++) _settlementSpriteRect(ctx, pal.woodDark, 24 + i * 4, baseY + 8, 2, 2);
  } else {
    _drawHut(ctx, hutPal, 9, baseY + 2, 13, 8, false);
    _drawHut(ctx, hutPal, 24, baseY + 1, 14, 9, false);
    _drawHut(ctx, hutPal, 40, baseY + 2, 13, 8, false);
  }

  _settlementSpritePennant(ctx, 31 + Math.floor(_seedRand(seed, 120) * 8) - 4, baseY - 4, factionColor);
}

function _buildSettlementSprite(type, factionColor, design = {}) {
  if (typeof document === 'undefined') return null;
  const dims = {
    city: [88, 66],
    town: [80, 60],
    fort: [74, 56],
    village: [64, 50],
  }[type] || [64, 50];
  const [w, h] = dims;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const cctx = canvas.getContext('2d');
  if (!cctx) return null;
  cctx.imageSmoothingEnabled = false;

  const fid = design.factionId || 'bandit';
  const basePal = _settlementPalette(fid);
  const seed = design.seed >>> 0;
  const variant = Number.isFinite(design.variant) ? design.variant : 0;
  const cityRegion = Number.isFinite(design.cityRegion) ? design.cityRegion : 0;
  const pal = (type === 'city' || type === 'town')
    ? _cityPaletteByRegion(basePal, fid, cityRegion)
    : (type === 'fort')
      ? _fortPaletteByVariant(basePal, fid, variant)
      : basePal;

  _settlementSpriteRect(cctx, 'rgba(0,0,0,0.20)', 6, h - 9, w - 12, 6);
  _settlementSpriteRect(cctx, pal.pathDark, Math.floor(w * 0.44), h - 12, Math.max(6, Math.floor(w * 0.15)), 11);
  _settlementSpriteRect(cctx, pal.pathLight, Math.floor(w * 0.47), h - 11, Math.max(3, Math.floor(w * 0.08)), 10);
  _settlementSpriteRect(cctx, _hexShade(pal.pathDark, -0.08), Math.floor(w * 0.18), h - 8, Math.floor(w * 0.64), 2);

  if (type === 'city' || type === 'town') {
    _drawFactionCitySprite(cctx, fid, pal, seed, factionColor, w, h, cityRegion);
  } else if (type === 'fort') {
    _drawFactionFortSprite(cctx, fid, pal, variant, seed, factionColor, w, h);
  } else {
    _drawVillageSprite(cctx, pal, variant, seed, factionColor, w, h);
  }

  _settlementSpriteRect(cctx, pal.outline, 0, h - 1, w, 1);
  return canvas;
}

function _getSettlementSprite(settlement, type, factionId, factionColor) {
  const baseSeed = _settlementSeed(settlement, 1709);
  let variant;
  const cityRegion = _cityRegionVariant(settlement, 6);
  let key = `s:v9:${type}:${factionId || 'bandit'}:`;
  if (type === 'fort') {
    const fortLayouts = _fortLayoutsForFaction(factionId || 'bandit');
    variant = baseSeed % Math.max(1, fortLayouts.length);
    key += `fort-${variant}`;
  } else if (type === 'city' || type === 'town') {
    const cityKey = Number.isFinite(settlement?.id)
      ? `id${settlement.id}`
      : `${settlement?.name || 'city'}:${settlement?.tx || 0}:${settlement?.ty || 0}`;
    variant = baseSeed >>> 0;
    key += `city-${cityRegion}-${cityKey}`;
  } else {
    variant = baseSeed % 15;
    key += `village-${variant}`;
  }

  if (_SETTLEMENT_SPRITE_CACHE.has(key)) return _SETTLEMENT_SPRITE_CACHE.get(key);
  const sprite = _buildSettlementSprite(type, factionColor, {
    factionId: factionId || 'bandit',
    seed: baseSeed,
    variant,
    cityRegion,
  });
  _SETTLEMENT_SPRITE_CACHE.set(key, sprite || null);
  return sprite;
}

function _settlementH3Kind(type) {
  void type;
  return null;
}

function _pickFromPool(pool, fallbackLen, tx, ty, seed = 0) {
  const list = Array.isArray(pool) && pool.length
    ? pool.filter((n) => Number.isFinite(n) && n >= 0 && n < fallbackLen)
    : [];
  if (!list.length) {
    const n = _terrainNoise(tx * 0.173 + 1.7, ty * 0.211 + 2.3, 9901 + seed);
    return Math.max(0, Math.min(fallbackLen - 1, Math.floor(n * fallbackLen)));
  }
  const n = _terrainNoise(tx * 0.163 + 3.1, ty * 0.197 + 5.7, 9917 + seed);
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(n * list.length)))];
}

function _settlementH3BaseIndex(type, factionId, frameCount, tx, ty) {
  const fid = String(factionId || '').toLowerCase();
  if (type === 'city' || type === 'town') {
    // Curated medieval pool: avoid fantasy outliers for visual consistency.
    if (fid === 'spanish' || fid === 'ottoman') return _pickFromPool([6], frameCount, tx, ty, 1);
    if (fid === 'venice') return _pickFromPool([1, 0], frameCount, tx, ty, 2);
    if (fid === 'hre' || fid === 'polish') return _pickFromPool([0, 1], frameCount, tx, ty, 3);
    return _pickFromPool([0, 1, 6], frameCount, tx, ty, 4);
  }
  if (type === 'fort') {
    return _pickFromPool([0, 1], frameCount, tx, ty, 5);
  }
  // Villages use a calmer city/town frame subset (still HoMM3-authentic style).
  if (type === 'village') {
    if (fid === 'spanish' || fid === 'ottoman') return _pickFromPool([1, 6], frameCount, tx, ty, 6);
    return _pickFromPool([1, 0], frameCount, tx, ty, 7);
  }
  return _pickFromPool([0, 1], frameCount, tx, ty, 8);
}

function _pickSettlementH3Frame(type, factionId, tx, ty) {
  const kind = _settlementH3Kind(type);
  if (!kind) return null;
  const frames = _H3_PROP_DATA?.[kind]?.frames;
  if (!Array.isArray(frames) || !frames.length) return null;
  const base = _settlementH3BaseIndex(type, factionId, frames.length, tx, ty) % frames.length;
  return frames[base];
}

function _settlementAdaptedSize(type) {
  switch (type) {
    case 'city': return [120, 90];
    case 'town': return [110, 82];
    case 'fort': return [104, 74];
    default: return [104, 78];
  }
}

function _buildAdaptedSettlementH3Canvas(entry, type, design = {}) {
  if (!entry?.frame || typeof document === 'undefined') return null;
  const frameKey = _frameCacheKey('settlement-src', type, entry.sourceDef, entry.frame.name);
  const src = _getFrameCanvas(entry.frame, frameKey);
  if (!src) return null;

  const fid = String(design?.factionId || 'bandit').toLowerCase();
  const pal = _settlementPalette(fid);
  const roofDark = _settlementColorTriplet(pal.roofDark);
  const roofLight = _settlementColorTriplet(pal.roofLight);
  const stoneDark = _settlementColorTriplet(pal.stoneDark);
  const stoneLight = _settlementColorTriplet(pal.stoneLight);
  const plasterBase = _settlementColorTriplet(pal.plaster);
  const plasterDark = _shade(plasterBase, -18);
  const accentBase = _settlementColorTriplet(design?.factionColor || pal.accent);

  const key = `${type}:${entry.sourceDef}:${entry.frame.name}:${fid}:${accentBase.join('-')}`;
  if (_SETTLEMENT_H3_ADAPTED_CACHE.has(key)) return _SETTLEMENT_H3_ADAPTED_CACHE.get(key);

  const w = src.width || 1;
  const h = src.height || 1;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) {
    _SETTLEMENT_H3_ADAPTED_CACHE.set(key, null);
    return null;
  }
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(src, 0, 0);

  const img = tctx.getImageData(0, 0, w, h);
  const px = img.data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];

    // Remove low-alpha dark DEF shadow pixels so sprite can be grounded by game shadow.
    let keep = a >= 20;
    if (keep && a < 170 && r < 66 && g < 66 && b < 66) keep = false;
    if (keep && a < 46 && (r + g + b) < 210) keep = false;
    if (!keep) {
      px[i + 3] = 0;
      continue;
    }

    const luma = _rgbLuma(r, g, b);
    const t = _norm01((luma - 26) / 208);
    const orig = [r, g, b];

    let target = null;
    let blend = 0;
    if (_looksAccentLike(r, g, b)) {
      target = _mixRgb(_shade(accentBase, -16), _shade(accentBase, 26), t);
      blend = 0.58;
    } else if (_looksWarmRoofLike(r, g, b)) {
      target = _mixRgb(roofDark, roofLight, t);
      blend = 0.46;
    } else if (_looksStoneLike(r, g, b)) {
      target = _mixRgb(stoneDark, stoneLight, t);
      blend = 0.34;
    } else if (_looksPlasterLike(r, g, b)) {
      target = _mixRgb(plasterDark, plasterBase, t);
      blend = 0.30;
    }
    if (target) {
      const recolored = _mixRgb(orig, target, blend);
      px[i] = recolored[0];
      px[i + 1] = recolored[1];
      px[i + 2] = recolored[2];
    }

    const p = i >> 2;
    const x = p % w;
    const y = Math.floor(p / w);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (maxX < minX || maxY < minY) {
    _SETTLEMENT_H3_ADAPTED_CACHE.set(key, null);
    return null;
  }

  tctx.putImageData(img, 0, 0);
  const padX = 2;
  const padTop = 2;
  const padBottom = 1;
  const sx = Math.max(0, minX - padX);
  const sy = Math.max(0, minY - padTop);
  const sw = Math.min(w - sx, (maxX - minX + 1) + padX * 2);
  const sh = Math.min(h - sy, (maxY - minY + 1) + padTop + padBottom);

  const [ow, oh] = _settlementAdaptedSize(type);
  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  const octx = out.getContext('2d');
  if (!octx) {
    _SETTLEMENT_H3_ADAPTED_CACHE.set(key, null);
    return null;
  }
  octx.imageSmoothingEnabled = false;
  const scale = Math.min((ow * 0.92) / sw, (oh * 0.90) / sh);
  const dw = Math.max(2, Math.round(sw * scale));
  const dh = Math.max(2, Math.round(sh * scale));
  const dx = Math.round((ow - dw) * 0.5);
  const baseY = oh - Math.max(2, Math.round(oh * 0.06));
  const dy = baseY - dh;
  octx.drawImage(tmp, sx, sy, sw, sh, dx, dy, dw, dh);

  _SETTLEMENT_H3_ADAPTED_CACHE.set(key, out);
  return out;
}

function _drawSettlementH3Frame(ctx, entry, type, sx, sy, profile, design) {
  if (!entry?.frame) return false;
  const canvas = _buildAdaptedSettlementH3Canvas(entry, type, design);
  if (!canvas) return false;

  const fw = canvas.width || 1;
  const fh = canvas.height || 1;
  let targetH = Math.max(16, profile.h);
  if (type === 'city' || type === 'town') targetH *= 1.00;
  else if (type === 'fort') targetH *= 0.95;
  else targetH *= 0.96;
  const targetW = Math.max(14, targetH * (fw / fh));

  const dx = Math.round(sx - targetW * 0.5);
  const dy = Math.round(sy - targetH * profile.anchor);
  ctx.imageSmoothingEnabled = false;
  const dw = Math.round(targetW);
  const dh = Math.round(targetH);
  ctx.drawImage(canvas, dx, dy, dw, dh);
  return {
    dx,
    dy,
    dw,
    dh,
    baseX: dx + dw * 0.5,
    baseY: dy + dh,
  };
}

function _settlementProfile(type, T) {
  const scale = 3.0;
  switch (type) {
    case 'city':
      return { w: T * 2.60 * scale, h: T * 1.96 * scale, anchor: 0.90, labelY: T * 0.72 * scale, shadowW: T * 0.92 * scale, shadowH: T * 0.22 * scale, shadowY: T * 0.36 * scale };
    case 'town':
      return { w: T * 2.20 * scale, h: T * 1.68 * scale, anchor: 0.88, labelY: T * 0.64 * scale, shadowW: T * 0.76 * scale, shadowH: T * 0.18 * scale, shadowY: T * 0.33 * scale };
    case 'fort':
      return { w: T * 2.00 * scale, h: T * 1.10 * scale, anchor: 0.87, labelY: T * 0.56 * scale, shadowW: T * 0.70 * scale, shadowH: T * 0.17 * scale, shadowY: T * 0.30 * scale };
    default:
      return { w: T * 1.70 * scale, h: T * 1.30 * scale, anchor: 0.86, labelY: T * 0.54 * scale, shadowW: T * 0.62 * scale, shadowH: T * 0.16 * scale, shadowY: T * 0.28 * scale };
  }
}

function _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty) {
  const baseW = profile.shadowW * 1.08;
  const baseH = profile.shadowH * 1.45;
  const baseY = sy + profile.shadowY * 1.02;

  ctx.fillStyle = 'rgba(28,18,10,0.34)';
  ctx.beginPath();
  _ellipse(ctx, sx + 2, baseY + 2, baseW, baseH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(126,90,52,0.42)';
  ctx.beginPath();
  _ellipse(ctx, sx, baseY, baseW * 0.96, baseH * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  _ellipse(ctx, sx, baseY + baseH * 0.10, baseW * 0.58, baseH * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();

  const roadW = Math.max(4, profile.shadowW * 0.18);
  const roadH = Math.max(8, profile.shadowY * 0.44);
  ctx.fillStyle = 'rgba(144,110,68,0.42)';
  ctx.fillRect(Math.round(sx - roadW * 0.5), Math.round(baseY + baseH * 0.10), Math.round(roadW), Math.round(roadH));
  ctx.fillStyle = 'rgba(186,150,102,0.36)';
  ctx.fillRect(Math.round(sx - roadW * 0.2), Math.round(baseY + baseH * 0.10), Math.max(2, Math.round(roadW * 0.34)), Math.round(roadH));

  const bushCount = 2 + Math.floor(_terrainNoise(tx * 0.73 + 11, ty * 0.51 + 17, 9111) * 3);
  for (let i = 0; i < bushCount; i++) {
    const angle = _terrainNoise(tx * 0.31 + i * 0.91, ty * 0.41 + i * 0.77, 9127) * Math.PI * 2;
    const rad = baseW * (0.58 + _terrainNoise(tx * 0.44 + i, ty * 0.37 + i * 0.3, 9143) * 0.32);
    const bx = sx + Math.cos(angle) * rad;
    const by = baseY + Math.sin(angle) * baseH * 0.68;
    const r = Math.max(2, T * (0.08 + _terrainNoise(tx * 0.19 + i * 0.27, ty * 0.27 + i * 0.19, 9157) * 0.05));
    ctx.fillStyle = `rgba(28,${65 + Math.floor(_terrainNoise(tx + i, ty - i, 9179) * 36)},24,0.82)`;
    ctx.beginPath();
    _ellipse(ctx, bx, by, r * 0.95, r * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = _hexShade(factionColor || '#808080', 0.10);
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = Math.max(1, T * 0.05);
  ctx.beginPath();
  _ellipse(ctx, sx, baseY - baseH * 0.06, baseW * 0.80, baseH * 0.62, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Draw HoMM-like city/fort/village at world pixel (sx, sy). */
function mbSettlement(ctx, settlement, sx, sy, T, fogAlpha, zoom) {
  const type = String(settlement.type || 'village').toLowerCase();
  const spriteType = (type === 'city' || type === 'town' || type === 'fort') ? type : 'village';
  const factionId = settlement.ownerFactionId || settlement.owner || 'bandit';
  const factionColor = _factionData(factionId)[0] || '#b03a3c';
  const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor(sx / Math.max(1, T));
  const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor(sy / Math.max(1, T));
  const profile = _settlementProfile(spriteType, T);
  const design = { factionId, factionColor };
  const h3Entry = _pickSettlementH3Frame(spriteType, factionId, tx, ty);
  const sprite = _getSettlementSprite(settlement, spriteType, factionId, factionColor);

  ctx.save();
  ctx.globalAlpha = fogAlpha;

  const h3Placement = _drawSettlementH3Frame(ctx, h3Entry, spriteType, sx, sy, profile, design);
  if (h3Placement) {
    // HoMM settlements already carry painted shadows; keep only a tight contact shadow.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    _ellipse(
      ctx,
      h3Placement.baseX + 1,
      h3Placement.baseY - Math.max(2, T * 0.05),
      Math.max(8, h3Placement.dw * 0.20),
      Math.max(3, h3Placement.dh * 0.055),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = 'rgba(96,68,40,0.18)';
    ctx.beginPath();
    _ellipse(
      ctx,
      h3Placement.baseX,
      h3Placement.baseY - Math.max(1, T * 0.03),
      Math.max(10, h3Placement.dw * 0.24),
      Math.max(3, h3Placement.dh * 0.06),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  } else if (sprite) {
    _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    _ellipse(ctx, sx + 1, sy + profile.shadowY, profile.shadowW, profile.shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    _ellipse(ctx, sx + 1, sy + profile.shadowY + Math.max(1, T * 0.02), profile.shadowW * 0.56, profile.shadowH * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    const dw = Math.max(10, Math.round(profile.w));
    const dh = Math.max(8, Math.round(profile.h));
    const dx = Math.round(sx - dw * 0.5);
    const dy = Math.round(sy - dh * profile.anchor);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, dx, dy, dw, dh);
  } else {
    _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    _ellipse(ctx, sx + 1, sy + profile.shadowY, profile.shadowW, profile.shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    _ellipse(ctx, sx + 1, sy + profile.shadowY + Math.max(1, T * 0.02), profile.shadowW * 0.56, profile.shadowH * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _mbLabel(ctx, sx, sy + profile.labelY, settlement.name || '', zoom, 'rgba(255,248,200,0.95)');
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

