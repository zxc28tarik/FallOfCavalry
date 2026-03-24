/**
 * FallOfCavalry – Map Renderer  (Mount & Blade overworld style)
 *
 * Yerleşimler kale/köy silüeti, lordlar bayraklı süvari ikonu,
 * oyuncu altın banner, hareket hedefi noktalı çizgi.
 */

import * as CONST from '../constants.js';
import { shade } from '../utils.js';
import h3MapArt from '../data/homm3-map-art.json';

// ── Lord adları (faction bazlı) ────────────────────────────────────────────
const LORD_NAMES = {
  ottoman:  ['Bey Kazan',  'Pasha Mehmed', 'Bey Togrul',   'Emir Arslan', 'Bey Timur' ],
  hre:      ['Graf Stern', 'Baron Rudolph', 'Herzog Heinrich','Count Dietrich','Lord Albrecht'],
  polish:   ['Pan Bolesław','Hetman Kazimir','Pan Wenceslas', 'Lord Stanisław'],
  spanish:  ['Don Rodrigo', 'Conde Sancho', 'Don García',    'Lord Enrique'],
  venice:   ['Doge Foscari','Marco Dandolo', 'Alvise Grimani','Contarini'],
  bandit:   ['Haydut Varg', 'Soyguncu Hrolf','Eşkıya Ulf',   'Çete Başı'],
};

const FACTION_EMBLEMS = {
  ottoman: 'crescent',
  hre:     'cross',
  polish:  'eagle',
  spanish: 'cross',
  venice:  'wave',
  bandit:  'skull',
};

function lordName(faction, id) {
  const list = LORD_NAMES[faction] || ['Bilinmeyen Bey'];
  return list[id % list.length];
}

// ── Yardımcı: roundRect polyfill ───────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
}

// ── Tile-based seeded random (deterministic per tile) ────────────────────
function tileHash(x, y, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return (h ^ (h >> 16)) >>> 0;
}
function tileRand(x, y, seed = 0) { return (tileHash(x, y, seed) & 0x7fffffff) / 0x7fffffff; }

const H3_TERRAIN_DATA = h3MapArt?.terrain || {};
const H3_PROP_DATA = h3MapArt?.props || {};
const H3_FRAME_CACHE = new Map();
const TILE_TO_H3_KEY = Object.freeze({
  water: 'SEA',
  shore: 'SHORE',
  grass: 'PLAINS',
  forest: 'PLAINS',
  mountain: 'PLAINS',
  snow: 'SNOW',
});
const H3_SETTLEMENT_PALETTE = Object.freeze({
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

function h3Noise(x, y, seed = 0) {
  const n = Math.sin((x * 12.9898) + (y * 78.233) + seed * 31.337) * 43758.5453;
  return n - Math.floor(n);
}

function h3DecodeBase64Bytes(b64) {
  if (typeof b64 !== 'string' || !b64) return null;
  if (typeof globalThis.atob !== 'function') return null;
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function h3FrameCacheKey(prefix, key, source, name) {
  return `${prefix}:${key || ''}:${source || ''}:${name || ''}`;
}

function h3GetFrameCanvas(frame, cacheKey) {
  if (!frame || frame.format !== 'rgba32-base64' || !Array.isArray(frame.size) || frame.size.length !== 2) return null;
  if (H3_FRAME_CACHE.has(cacheKey)) return H3_FRAME_CACHE.get(cacheKey);
  if (typeof document === 'undefined') {
    H3_FRAME_CACHE.set(cacheKey, null);
    return null;
  }

  const w = Math.max(1, Number(frame.size[0]) | 0);
  const h = Math.max(1, Number(frame.size[1]) | 0);
  const rgba = h3DecodeBase64Bytes(frame.data);
  if (!rgba || rgba.length < w * h * 4) {
    H3_FRAME_CACHE.set(cacheKey, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const cctx = canvas.getContext('2d');
  if (!cctx) {
    H3_FRAME_CACHE.set(cacheKey, null);
    return null;
  }

  const img = cctx.createImageData(w, h);
  img.data.set(rgba.subarray(0, w * h * 4));
  cctx.putImageData(img, 0, 0);
  H3_FRAME_CACHE.set(cacheKey, canvas);
  return canvas;
}

function bitCount4(v) {
  const n = v & 15;
  return ((n >> 0) & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);
}

function h3PickTerrainFrame(h3Key, edgeMask, tx, ty) {
  const terrain = H3_TERRAIN_DATA?.[h3Key];
  const frames = terrain?.frames;
  if (!Array.isArray(frames) || !frames.length) return null;

  const groups = Array.isArray(terrain?.groups) ? terrain.groups : null;
  let pool = Array.isArray(groups?.[edgeMask]) ? groups[edgeMask] : null;
  if (!pool || !pool.length) {
    let best = null;
    for (let i = 0; i < 16; i++) {
      const g = groups?.[i];
      if (!Array.isArray(g) || !g.length) continue;
      const diff = bitCount4((i ^ edgeMask) & 15) + Math.abs(bitCount4(i) - bitCount4(edgeMask)) * 0.15;
      if (!best || diff < best.diff) best = { diff, pool: g };
    }
    pool = best?.pool || null;
  }
  if (!pool || !pool.length) pool = groups?.[0] || null;
  if (!pool || !pool.length) {
    const n = h3Noise(tx * 0.317, ty * 0.229, 1943);
    const idx = Math.max(0, Math.min(frames.length - 1, Math.floor(n * frames.length)));
    return frames[idx];
  }

  const n = h3Noise(tx * 0.317 + edgeMask * 0.11, ty * 0.229 + edgeMask * 0.07, 1943);
  const pick = Math.max(0, Math.min(pool.length - 1, Math.floor(n * pool.length)));
  const idx = pool[pick];
  if (!Number.isFinite(idx) || idx < 0 || idx >= frames.length) return null;
  return frames[idx];
}

function h3PickPropFrame(kind, tx, ty) {
  const frames = H3_PROP_DATA?.[kind]?.frames;
  if (!Array.isArray(frames) || !frames.length) return null;
  let seed = 2683;
  if (kind === 'FOREST') seed = 2671;
  else if (kind === 'MOUNTAIN_LARGE') seed = 2699;
  const n = h3Noise(tx * 0.191, ty * 0.277, seed);
  const idx = Math.max(0, Math.min(frames.length - 1, Math.floor(n * frames.length)));
  return frames[idx];
}

function h3DrawPropFrame(ctx, entry, px, py, T, fogLevel, tx, ty, kind, options = null) {
  if (!entry?.frame) return false;
  const cacheKey = h3FrameCacheKey('prop', kind, entry.sourceDef, entry.frame.name);
  const canvas = h3GetFrameCanvas(entry.frame, cacheKey);
  if (!canvas) return false;

  const fw = canvas.width || 1;
  const fh = canvas.height || 1;
  const scaleSeed = kind === 'FOREST' ? 3119 : kind === 'MOUNTAIN_LARGE' ? 3151 : 3137;
  const scaleN = h3Noise(tx * 0.39 + 7, ty * 0.33 + 9, scaleSeed);
  const baseScale = kind === 'FOREST'
    ? 1.85
    : kind === 'MOUNTAIN_LARGE'
      ? 3.2
      : 1.62;
  const dynScale = kind === 'FOREST'
    ? 0.26
    : kind === 'MOUNTAIN_LARGE'
      ? 0.26
      : 0.22;
  const scaleMul = Number.isFinite(options?.scaleMul) ? Math.max(0.35, options.scaleMul) : 1;
  const targetH = Math.max(8, T * (baseScale + scaleN * dynScale) * scaleMul);
  const targetW = targetH * (fw / fh);
  const jitter = kind === 'FOREST' ? 0.16 : kind === 'MOUNTAIN_LARGE' ? 0.20 : 0.12;
  const jitterMul = Number.isFinite(options?.jitterMul) ? Math.max(0, options.jitterMul) : 1;
  const jitterX = jitter * jitterMul * T * (h3Noise(tx * 0.91, ty * 0.73, 3163) - 0.5);
  const extraOffsetX = Number.isFinite(options?.offsetX) ? options.offsetX : 0;
  const extraOffsetY = Number.isFinite(options?.offsetY) ? options.offsetY : 0;
  const dx = Math.round(px + (T - targetW) * 0.5 + jitterX + extraOffsetX);
  const dy = Math.round(py + T - targetH + extraOffsetY);

  ctx.save();
  const baseAlpha = fogLevel === 1 ? 0.60 : 1.0;
  const alphaMul = Number.isFinite(options?.alphaMul) ? Math.max(0, options.alphaMul) : 1;
  ctx.globalAlpha = baseAlpha * alphaMul;
  ctx.drawImage(canvas, dx, dy, Math.round(targetW), Math.round(targetH));
  ctx.restore();
  return true;
}

// ══════════════════════════════════════════════════════════════════════════
export class MapRenderer {
  constructor() {
    this._frame = 0;
    this._forestSet = null;
    this._mountainSet = null;
    this._lastMapId = null;
    this._mapWidth = 0;
    this._mapHeight = 0;
    this._visibleLargeMountainCells = new Set();
    this._settlementSpriteCache = new Map();
  }

  // Build O(1) lookup sets for forests/mountains (once per map)
  _ensureLookups(map) {
    const id = map._id || (map._id = Math.random());
    if (this._lastMapId === id) return;
    this._lastMapId = id;
    this._mapWidth = Number(map.width) || 0;
    this._mapHeight = Number(map.height) || 0;
    this._forestSet = new Set();
    this._mountainSet = new Set();
    for (const f of (map.forests || [])) this._forestSet.add(f.y * map.width + f.x);
    for (const m of (map.mountains || [])) this._mountainSet.add(m.y * map.width + m.x);
  }

  _isInMap(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this._mapWidth && ty < this._mapHeight;
  }

  _hasForestAt(tx, ty) {
    if (!this._forestSet || !this._isInMap(tx, ty)) return false;
    return this._forestSet.has(ty * this._mapWidth + tx);
  }

  _hasMountainAt(tx, ty) {
    if (!this._mountainSet || !this._isInMap(tx, ty)) return false;
    return this._mountainSet.has(ty * this._mapWidth + tx);
  }

  _countMaskNeighbors8(set, tx, ty) {
    if (!set) return 0;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (!this._isInMap(nx, ny)) continue;
        if (set.has(ny * this._mapWidth + nx)) count++;
      }
    }
    return count;
  }

  _countForestNeighbors8(tx, ty) {
    return this._countMaskNeighbors8(this._forestSet, tx, ty);
  }

  _countMountainNeighbors8(tx, ty) {
    return this._countMaskNeighbors8(this._mountainSet, tx, ty);
  }

  _tileTypeAt(map, tx, ty) {
    if (!map || tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return 'water';
    const tile = map.tiles?.[ty * map.width + tx];
    return tile?.type || 'grass';
  }

  _isWaterAt(map, tx, ty) {
    return this._tileTypeAt(map, tx, ty) === 'water';
  }

  _h3KeyAt(map, tx, ty) {
    return TILE_TO_H3_KEY[this._tileTypeAt(map, tx, ty)] || 'PLAINS';
  }

  _h3TransitionMask(map, tx, ty, h3Key) {
    if (!map || !h3Key) return 0;
    let mask = 0;
    if (this._h3KeyAt(map, tx, ty - 1) !== h3Key) mask |= 1;
    if (this._h3KeyAt(map, tx + 1, ty) !== h3Key) mask |= 2;
    if (this._h3KeyAt(map, tx, ty + 1) !== h3Key) mask |= 4;
    if (this._h3KeyAt(map, tx - 1, ty) !== h3Key) mask |= 8;
    return mask;
  }

  _drawH3TerrainTile(ctx, tile, px, py, T, fog, tx, ty, map) {
    const h3Key = TILE_TO_H3_KEY[tile?.type] || 'PLAINS';
    const terrain = H3_TERRAIN_DATA?.[h3Key];
    if (!terrain?.frames?.length) return false;

    const edgeMask = this._h3TransitionMask(map, tx, ty, h3Key);
    const frame = h3PickTerrainFrame(h3Key, edgeMask, tx, ty);
    if (!frame) return false;

    const cacheKey = h3FrameCacheKey('terrain', h3Key, terrain.sourceDef, frame.name);
    const canvas = h3GetFrameCanvas(frame, cacheKey);
    if (!canvas) return false;

    ctx.drawImage(canvas, px, py, T, T);
    if (fog === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(px, py, T, T);
    }
    return true;
  }

  render(ctx, state) {
    const { map, player, camera } = state;
    const T = CONST.WORLD.TILE_SIZE;
    this._frame++;
    this._ensureLookups(map);
    this._visibleLargeMountainCells.clear();

    ctx.save();
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(-camera.x, -camera.y);

    // Viewport culling
    const vx = Math.floor(camera.x / T);
    const vy = Math.floor(camera.y / T);
    const vw = Math.ceil(ctx.canvas.width  / T) + 3;
    const vh = Math.ceil(ctx.canvas.height / T) + 3;
    const x0 = Math.max(0, vx - 1),        y0 = Math.max(0, vy - 1);
    const x1 = Math.min(map.width, vx + vw), y1 = Math.min(map.height, vy + vh);

    // 1 – Zemin karoları (base terrain)
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!tile) continue;
        const fog = map.fog ? map.fog[y * map.width + x] : 2;
        if (fog === 0) continue;
        this._drawTile(ctx, tile, x, y, T, fog, map);
      }
    }

    // 2 – Nehirler + Yollar
    this._drawRivers(ctx, map.rivers, T);
    this._drawRoads(ctx, map.roads, T);

    // 3 – Hareket yolu göstergesi
    if (Math.hypot(player.tx - player.x, player.ty - player.y) > 0.4) {
      this._drawMovePath(ctx, player, T);
    }

    // 4 – Yerleşimler
    for (const s of map.settlements) {
      const stx = Number.isFinite(s.tx) ? s.tx : Math.floor(s.x / T);
      const sty = Number.isFinite(s.ty) ? s.ty : Math.floor(s.y / T);
      const fog = map.fog ? map.fog[sty * map.width + stx] : 2;
      if (fog > 0) this._drawSettlement(ctx, s, T);
    }

    // 5 – Düşman lordlar / AI partiler
    for (const p of state.aiParties) {
      this._drawLordParty(ctx, p, T);
    }

    // 6 – Oyuncu
    this._drawPlayerParty(ctx, player, T);

    ctx.imageSmoothingEnabled = prevSmoothing;
    ctx.restore();
  }

  // ── Ağaç Paletleri — zengin yeşil orman tonları ─────────────────────────
  // Klasik fantezi strateji haritası: koyu orman yeşilleri, ışık sol üstten
  static TREE_PALETTES = [
    { dark: '#1A3318', mid: '#2D5A28', light: '#4A8A3A' },  // 0: koyu orman
    { dark: '#1E3A1A', mid: '#356A2E', light: '#55944A' },  // 1: orta yeşil
    { dark: '#223D1C', mid: '#3D7030', light: '#5EA048' },  // 2: canlı yeşil
    { dark: '#182E16', mid: '#284E22', light: '#408038' },  // 3: derin orman
    { dark: '#2A4420', mid: '#447838', light: '#68A858' },  // 4: açık yeşil
    { dark: '#1A3020', mid: '#305828', light: '#4C8842' },  // 5: soğuk yeşil
    { dark: '#253A18', mid: '#3E6228', light: '#5A9040' },  // 6: zeytin yeşili
    { dark: '#303A18', mid: '#4A5A28', light: '#6A8038' },  // 7: sarımsı yeşil
  ];

  // ── Karo ─────────────────────────────────────────────────────────────────
  _drawTile(ctx, tile, x, y, T, fog, map) {
    const px = x * T, py = y * T;
    const idx = y * map.width + x;
    const isForest = this._forestSet?.has(idx);
    const isMountain = this._mountainSet?.has(idx);

    if (fog >= 1) {
      const drewH3 = this._drawH3TerrainTile(ctx, tile, px, py, T, fog, x, y, map);
      if (!drewH3) {
        if (tile.type === 'water') {
          this._drawWater(ctx, px, py, T, fog, x, y);
        } else if (tile.type === 'shore') {
          this._drawShore(ctx, px, py, T, fog, x, y, map);
        } else if (tile.type === 'grass' || tile.type === 'forest') {
          this._drawGrass(ctx, px, py, T, fog, x, y);
        } else if (tile.type === 'snow') {
          this._drawSnow(ctx, px, py, T, fog, x, y);
        } else {
          let base = this._terrainColor(tile.type);
          if (fog === 1) base = shade(base, -0.25);
          ctx.fillStyle = base;
          ctx.fillRect(px, py, T, T);
        }
      }
      if (tile.type !== 'water') {
        this._drawCoastBlend(ctx, px, py, T, fog, x, y, map, tile.type);
      }
      if (!isForest && !isMountain) {
        this._drawMicroDetails(ctx, px, py, T, fog, x, y, tile.type);
      }
    }

    if (isMountain) this._drawMountain(ctx, px, py, T, fog, x, y);
    if (isForest)   this._drawForest(ctx, px, py, T, fog, x, y);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── SU — Derin mavi, hafif dalga dokusu ─────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawWater(ctx, px, py, T, fog, tx, ty) {
    const d = tileRand(tx, ty, 10);
    const base = `#${(14 + d * 10 | 0).toString(16).padStart(2,'0')}${(35 + d * 18 | 0).toString(16).padStart(2,'0')}${(75 + d * 30 | 0).toString(16).padStart(2,'0')}`;
    ctx.fillStyle = fog === 1 ? shade(base, -0.30) : base;
    ctx.fillRect(px, py, T, T);
    if (fog < 2) return;
    // Dalga çizgileri
    ctx.strokeStyle = 'rgba(55,120,180,0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const wy = py + T * (0.2 + i * 0.25 + tileRand(tx, ty, 20 + i) * 0.06);
      ctx.beginPath();
      ctx.moveTo(px, wy);
      ctx.quadraticCurveTo(px + T * 0.5, wy - T * 0.03, px + T, wy + T * 0.01);
      ctx.stroke();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── KIYISALI — Kumsal toprak tonu ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawShore(ctx, px, py, T, fog, tx, ty, _map) {
    const dim = fog === 1 ? -0.18 : 0;
    ctx.fillStyle = shade('#B0996A', dim);
    ctx.fillRect(px, py, T, T);
    // Kum varyasyonu
    ctx.fillStyle = `rgba(160,140,100,${fog === 1 ? 0.08 : 0.15})`;
    ctx.beginPath();
    ctx.ellipse(px + T * tileRand(tx, ty, 40), py + T * tileRand(tx, ty, 41),
      T * 0.3, T * 0.18, tileRand(tx, ty, 42) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    if (fog < 2) return;
    // Çakıl taşları
    for (let i = 0; i < 3; i++) {
      const rx = px + T * (0.1 + tileRand(tx, ty, 50 + i) * 0.8);
      const ry = py + T * (0.1 + tileRand(tx, ty, 51 + i) * 0.8);
      ctx.fillStyle = '#8A7A60';
      ctx.beginPath(); ctx.arc(rx, ry, T * 0.02, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ÇİMEN — Zengin yeşil, doku varyasyonu, ızgara kırıcı ─────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawCoastBlend(ctx, px, py, T, fog, tx, ty, map, tileType) {
    if (!map || fog < 1) return;
    const north = this._isWaterAt(map, tx, ty - 1);
    const south = this._isWaterAt(map, tx, ty + 1);
    const west = this._isWaterAt(map, tx - 1, ty);
    const east = this._isWaterAt(map, tx + 1, ty);
    const nw = this._isWaterAt(map, tx - 1, ty - 1);
    const ne = this._isWaterAt(map, tx + 1, ty - 1);
    const sw = this._isWaterAt(map, tx - 1, ty + 1);
    const se = this._isWaterAt(map, tx + 1, ty + 1);
    if (!(north || south || west || east || nw || ne || sw || se)) return;

    const shoreLike = tileType === 'shore';
    const sideAlpha = fog === 1 ? (shoreLike ? 0.22 : 0.11) : (shoreLike ? 0.34 : 0.16);
    const lineAlpha = fog === 1 ? (shoreLike ? 0.24 : 0.14) : (shoreLike ? 0.42 : 0.24);
    const sideColor = shoreLike
      ? `rgba(56,102,136,${sideAlpha})`
      : `rgba(186,164,116,${sideAlpha})`;
    const lineColor = shoreLike
      ? `rgba(220,214,186,${lineAlpha})`
      : `rgba(205,192,146,${lineAlpha})`;
    const insetBase = shoreLike ? 0.14 : 0.09;
    const insetVar = shoreLike ? 0.09 : 0.06;
    const waveBase = shoreLike ? 0.07 : 0.05;
    const waveVar = shoreLike ? 0.06 : 0.05;
    const inset = T * (insetBase + h3Noise(tx * 0.19, ty * 0.23, 8401) * insetVar);
    const wave = T * (waveBase + h3Noise(tx * 0.31, ty * 0.27, 8407) * waveVar);

    ctx.save();
    ctx.fillStyle = sideColor;

    if (north) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + T, py);
      ctx.lineTo(px + T, py + inset * 0.64);
      ctx.quadraticCurveTo(px + T * 0.68, py + inset + wave * 0.18, px + T * 0.50, py + inset * 0.68);
      ctx.quadraticCurveTo(px + T * 0.30, py + inset * 0.34, px, py + inset * 0.72);
      ctx.closePath();
      ctx.fill();
    }
    if (south) {
      ctx.beginPath();
      ctx.moveTo(px, py + T);
      ctx.lineTo(px + T, py + T);
      ctx.lineTo(px + T, py + T - inset * 0.66);
      ctx.quadraticCurveTo(px + T * 0.66, py + T - inset - wave * 0.2, px + T * 0.48, py + T - inset * 0.62);
      ctx.quadraticCurveTo(px + T * 0.25, py + T - inset * 0.26, px, py + T - inset * 0.74);
      ctx.closePath();
      ctx.fill();
    }
    if (west) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py + T);
      ctx.lineTo(px + inset * 0.66, py + T);
      ctx.quadraticCurveTo(px + inset + wave * 0.18, py + T * 0.68, px + inset * 0.66, py + T * 0.50);
      ctx.quadraticCurveTo(px + inset * 0.34, py + T * 0.30, px + inset * 0.72, py);
      ctx.closePath();
      ctx.fill();
    }
    if (east) {
      ctx.beginPath();
      ctx.moveTo(px + T, py);
      ctx.lineTo(px + T, py + T);
      ctx.lineTo(px + T - inset * 0.64, py + T);
      ctx.quadraticCurveTo(px + T - inset - wave * 0.2, py + T * 0.70, px + T - inset * 0.62, py + T * 0.52);
      ctx.quadraticCurveTo(px + T - inset * 0.22, py + T * 0.28, px + T - inset * 0.76, py);
      ctx.closePath();
      ctx.fill();
    }

    const cornerR = T * 0.22;
    if ((nw && !north && !west) || (north && west)) {
      ctx.beginPath();
      ctx.ellipse(px + cornerR * 0.95, py + cornerR * 0.92, cornerR, cornerR * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if ((ne && !north && !east) || (north && east)) {
      ctx.beginPath();
      ctx.ellipse(px + T - cornerR * 0.95, py + cornerR * 0.92, cornerR, cornerR * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if ((sw && !south && !west) || (south && west)) {
      ctx.beginPath();
      ctx.ellipse(px + cornerR * 0.92, py + T - cornerR * 0.90, cornerR, cornerR * 0.80, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if ((se && !south && !east) || (south && east)) {
      ctx.beginPath();
      ctx.ellipse(px + T - cornerR * 0.92, py + T - cornerR * 0.90, cornerR, cornerR * 0.80, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = fog === 1 ? 1 : 1.2;
    if (north) {
      ctx.beginPath();
      ctx.moveTo(px + T * 0.06, py + inset * 0.42);
      ctx.quadraticCurveTo(px + T * 0.36, py + inset * 0.10, px + T * 0.58, py + inset * 0.40);
      ctx.quadraticCurveTo(px + T * 0.80, py + inset * 0.72, px + T * 0.95, py + inset * 0.34);
      ctx.stroke();
    }
    if (south) {
      const sy = py + T - inset * 0.42;
      ctx.beginPath();
      ctx.moveTo(px + T * 0.05, sy);
      ctx.quadraticCurveTo(px + T * 0.34, sy - inset * 0.30, px + T * 0.56, sy - inset * 0.02);
      ctx.quadraticCurveTo(px + T * 0.80, sy + inset * 0.26, px + T * 0.95, sy - inset * 0.16);
      ctx.stroke();
    }
    if (west) {
      ctx.beginPath();
      ctx.moveTo(px + inset * 0.40, py + T * 0.06);
      ctx.quadraticCurveTo(px + inset * 0.08, py + T * 0.36, px + inset * 0.34, py + T * 0.58);
      ctx.quadraticCurveTo(px + inset * 0.64, py + T * 0.80, px + inset * 0.32, py + T * 0.94);
      ctx.stroke();
    }
    if (east) {
      const ex = px + T - inset * 0.42;
      ctx.beginPath();
      ctx.moveTo(ex, py + T * 0.06);
      ctx.quadraticCurveTo(ex - inset * 0.30, py + T * 0.36, ex - inset * 0.02, py + T * 0.60);
      ctx.quadraticCurveTo(ex + inset * 0.26, py + T * 0.82, ex - inset * 0.16, py + T * 0.95);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawMicroDetails(ctx, px, py, T, fog, tx, ty, tileType) {
    if (fog < 2 || tileType === 'water') return;

    if (tileType === 'grass' || tileType === 'forest') {
      const flowerRoll = tileRand(tx, ty, 9201);
      if (flowerRoll > 0.84) {
        const cx = Math.floor(px + T * (0.18 + tileRand(tx, ty, 9202) * 0.64));
        const cy = Math.floor(py + T * (0.20 + tileRand(tx, ty, 9203) * 0.62));
        ctx.fillStyle = 'rgba(245,245,215,0.86)';
        ctx.fillRect(cx, cy, 1, 1);
        ctx.fillRect(cx + 2, cy + 1, 1, 1);
        ctx.fillRect(cx - 1, cy + 2, 1, 1);
      }

      const pebbleCount = 1 + Math.floor(tileRand(tx, ty, 9210) * 3);
      for (let i = 0; i < pebbleCount; i++) {
        if (tileRand(tx, ty, 9211 + i * 9) < 0.52) continue;
        const rx = Math.floor(px + 2 + tileRand(tx, ty, 9212 + i * 9) * (T - 5));
        const ry = Math.floor(py + 2 + tileRand(tx, ty, 9213 + i * 9) * (T - 5));
        ctx.fillStyle = tileRand(tx, ty, 9214 + i * 9) > 0.55 ? 'rgba(116,124,104,0.55)' : 'rgba(72,88,64,0.50)';
        ctx.fillRect(rx, ry, 2, 1);
        if (tileRand(tx, ty, 9215 + i * 9) > 0.7) ctx.fillRect(rx + 1, ry + 1, 1, 1);
      }

      ctx.strokeStyle = 'rgba(42,88,34,0.34)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        if (tileRand(tx, ty, 9230 + i * 5) < 0.48) continue;
        const gx = px + T * (0.16 + tileRand(tx, ty, 9231 + i * 5) * 0.68);
        const gy = py + T * (0.68 + tileRand(tx, ty, 9232 + i * 5) * 0.22);
        const gh = T * (0.06 + tileRand(tx, ty, 9233 + i * 5) * 0.05);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 1.5, gy - gh);
        ctx.stroke();
      }
      return;
    }

    if (tileType === 'shore') {
      const shellCount = 2 + Math.floor(tileRand(tx, ty, 9301) * 3);
      for (let i = 0; i < shellCount; i++) {
        if (tileRand(tx, ty, 9302 + i * 7) < 0.35) continue;
        const rx = Math.floor(px + 2 + tileRand(tx, ty, 9303 + i * 7) * (T - 6));
        const ry = Math.floor(py + 2 + tileRand(tx, ty, 9304 + i * 7) * (T - 6));
        ctx.fillStyle = tileRand(tx, ty, 9305 + i * 7) > 0.5 ? 'rgba(158,144,116,0.64)' : 'rgba(124,110,86,0.58)';
        ctx.fillRect(rx, ry, 2, 1);
        if (tileRand(tx, ty, 9306 + i * 7) > 0.72) {
          ctx.fillStyle = 'rgba(214,202,166,0.55)';
          ctx.fillRect(rx, ry + 1, 1, 1);
        }
      }
      return;
    }

    if (tileType === 'snow') {
      const crackCount = 1 + Math.floor(tileRand(tx, ty, 9401) * 2);
      for (let i = 0; i < crackCount; i++) {
        if (tileRand(tx, ty, 9402 + i * 6) < 0.54) continue;
        const rx = Math.floor(px + 3 + tileRand(tx, ty, 9403 + i * 6) * (T - 7));
        const ry = Math.floor(py + 3 + tileRand(tx, ty, 9404 + i * 6) * (T - 7));
        ctx.fillStyle = 'rgba(166,178,194,0.42)';
        ctx.fillRect(rx, ry, 2, 1);
      }
    }
  }
  _drawGrass(ctx, px, py, T, fog, tx, ty) {
    const dim = fog === 1 ? -0.18 : 0;
    const v1 = tileRand(tx, ty, 0), v2 = tileRand(tx, ty, 1);
    // Zengin yeşil taban
    const gr = 48 + v1 * 28 | 0;
    const gg = 98 + v1 * 30 + v2 * 18 | 0;
    const gb = 32 + v2 * 16 | 0;
    ctx.fillStyle = fog === 1 ? shade(`#${gr.toString(16).padStart(2,'0')}${gg.toString(16).padStart(2,'0')}${gb.toString(16).padStart(2,'0')}`, -0.18) : `rgb(${gr},${gg},${gb})`;
    ctx.fillRect(px, py, T, T);

    // Organik yeşil lekeler — karo sınırını kırar
    for (let i = 0; i < 3; i++) {
      const pv = tileRand(tx, ty, 200 + i * 4);
      ctx.fillStyle = pv > 0.5 ? `rgba(65,120,40,${fog === 1 ? 0.08 : 0.14})` : `rgba(35,75,22,${fog === 1 ? 0.06 : 0.12})`;
      ctx.beginPath();
      ctx.ellipse(
        px + T * (tileRand(tx, ty, 201 + i * 4) * 1.1 - 0.05),
        py + T * (tileRand(tx, ty, 202 + i * 4) * 1.1 - 0.05),
        T * (0.22 + tileRand(tx, ty, 203 + i * 4) * 0.30),
        T * (0.16 + tileRand(tx, ty, 204 + i * 4) * 0.20),
        tileRand(tx, ty, 205 + i * 4) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    if (fog < 2) return;

    // Çimen tutamları
    for (let i = 0; i < 4; i++) {
      const gx = px + T * (0.08 + tileRand(tx, ty, 220 + i * 3) * 0.84);
      const gy = py + T * (0.08 + tileRand(tx, ty, 221 + i * 3) * 0.84);
      const gh = T * 0.05;
      ctx.strokeStyle = 'rgba(40,90,28,0.5)';
      ctx.lineWidth = 1; ctx.lineCap = 'round';
      for (let b = -1; b <= 1; b++) {
        ctx.beginPath(); ctx.moveTo(gx + b * 2, gy); ctx.lineTo(gx + b * 2.5, gy - gh); ctx.stroke();
      }
    }

    // Küçük çalı
    if (tileRand(tx, ty, 280) > 0.80) {
      const bx = px + T * (0.2 + tileRand(tx, ty, 281) * 0.6);
      const by = py + T * (0.2 + tileRand(tx, ty, 282) * 0.6);
      this._drawSmallBush(ctx, bx, by, T * 0.06, '#3A6A28');
    }

    // Tek ağaç
    if (tileRand(tx, ty, 290) > 0.78) {
      const tx2 = px + T * (0.2 + tileRand(tx, ty, 291) * 0.6);
      const ty2 = py + T * (0.35 + tileRand(tx, ty, 292) * 0.4);
      const palIdx = Math.floor(tileRand(tx, ty, 293) * MapRenderer.TREE_PALETTES.length);
      const kind = tileRand(tx, ty, 294);
      if (kind > 0.74) this._drawCypress(ctx, tx2, ty2, T * 0.24, dim, fog, palIdx);
      else if (kind > 0.40) this._drawPine(ctx, tx2, ty2, T * 0.23, dim, fog, palIdx);
      else this._drawTree(ctx, tx2, ty2, T * 0.22, dim, fog, palIdx);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── KAR ────────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════
  _drawSnow(ctx, px, py, T, fog, tx, ty) {
    const dim = fog === 1 ? -0.20 : 0;
    ctx.fillStyle = shade(tileRand(tx, ty, 0) > 0.5 ? '#E8EEF5' : '#DEE6F0', dim);
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = `rgba(255,255,255,${fog === 1 ? 0.06 : 0.12})`;
    ctx.beginPath();
    ctx.ellipse(px + T * tileRand(tx, ty, 300), py + T * tileRand(tx, ty, 301),
      T * 0.3, T * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── ORMAN — Yoğun, katmanlı, koyu tabanlı ağaç kütlesi ────────────────
  // Işık sol üstten. Koyu gölge tabanı, parlak tepeler.
  // ══════════════════════════════════════════════════════════════════════════
  _drawForest(ctx, px, py, T, fog, tx, ty) {
    const north = this._hasForestAt(tx, ty - 1);
    const south = this._hasForestAt(tx, ty + 1);
    const west = this._hasForestAt(tx - 1, ty);
    const east = this._hasForestAt(tx + 1, ty);
    const neighborCount = (north ? 1 : 0) + (south ? 1 : 0) + (west ? 1 : 0) + (east ? 1 : 0);
    const neighbor8 = this._countForestNeighbors8(tx, ty);
    const hasH3Forest = Array.isArray(H3_PROP_DATA?.FOREST?.frames) && H3_PROP_DATA.FOREST.frames.length > 0;
    if (hasH3Forest) {
      const clearingNoise = h3Noise(tx * 0.16, ty * 0.18, 9013);
      if (neighbor8 >= 4 && clearingNoise > 0.49 && clearingNoise < 0.53) return;

      const densityNoise = h3Noise(tx * 0.71, ty * 0.59, 7123);
      const threshold = neighbor8 >= 6 ? 0.46 : neighbor8 >= 4 ? 0.56 : neighbor8 >= 2 ? 0.66 : 0.76;
      if (densityNoise <= threshold) return;

      let drew = false;
      const styleNoise = h3Noise(tx * 0.53, ty * 0.61, 7129);
      if (neighbor8 >= 4 && styleNoise > 0.35) {
        const back = h3PickPropFrame('FOREST', tx - 17, ty + 9);
        drew = h3DrawPropFrame(ctx, back, px, py, T, fog, tx, ty, 'FOREST', {
          scaleMul: 0.80 + h3Noise(tx * 0.29, ty * 0.21, 7137) * 0.16,
          jitterMul: 0.55,
          offsetX: (h3Noise(tx * 0.91, ty * 0.73, 7141) - 0.5) * T * 0.22,
          offsetY: -T * (0.14 + h3Noise(tx * 0.33, ty * 0.27, 7147) * 0.08),
          alphaMul: 0.72,
        }) || drew;
      }

      const main = h3PickPropFrame('FOREST', tx, ty);
      drew = h3DrawPropFrame(ctx, main, px, py, T, fog, tx, ty, 'FOREST', {
        scaleMul: 0.94 + h3Noise(tx * 0.49, ty * 0.41, 7153) * 0.34,
        jitterMul: 0.9,
        offsetX: (h3Noise(tx * 0.45, ty * 0.57, 7159) - 0.5) * T * 0.28,
        offsetY: -T * (0.03 + h3Noise(tx * 0.17, ty * 0.39, 7163) * 0.06),
      }) || drew;

      if (neighbor8 >= 2 && styleNoise > 0.62) {
        const front = h3PickPropFrame('FOREST', tx + 23, ty - 11);
        drew = h3DrawPropFrame(ctx, front, px, py, T, fog, tx, ty, 'FOREST', {
          scaleMul: 1.02 + h3Noise(tx * 0.67, ty * 0.51, 7169) * 0.28,
          jitterMul: 0.75,
          offsetX: (h3Noise(tx * 0.52, ty * 0.62, 7171) - 0.5) * T * 0.20,
          offsetY: T * (0.01 + h3Noise(tx * 0.21, ty * 0.18, 7177) * 0.04),
          alphaMul: 0.96,
        }) || drew;
      }

      if (drew) {
        const bushRoll = h3Noise(tx * 0.37, ty * 0.29, 7183);
        if (bushRoll > 0.54) {
          const bx = px + T * (0.24 + h3Noise(tx * 0.59, ty * 0.47, 7187) * 0.52);
          const by = py + T * (0.62 + h3Noise(tx * 0.43, ty * 0.71, 7191) * 0.22);
          const palIdx = Math.floor(h3Noise(tx * 0.51, ty * 0.61, 7193) * MapRenderer.TREE_PALETTES.length);
          this._drawBushCluster(ctx, bx, by, T * 0.11, fog === 1 ? -0.18 : 0, fog, palIdx);
        }
        if (bushRoll > 0.80) {
          const bx = px + T * (0.18 + h3Noise(tx * 0.81, ty * 0.33, 7197) * 0.64);
          const by = py + T * (0.56 + h3Noise(tx * 0.27, ty * 0.83, 7201) * 0.28);
          const palIdx = Math.floor(h3Noise(tx * 0.39, ty * 0.57, 7207) * MapRenderer.TREE_PALETTES.length);
          this._drawBushCluster(ctx, bx, by, T * 0.09, fog === 1 ? -0.18 : 0, fog, palIdx);
        }
        return;
      }
    }

    const dim = fog === 1 ? -0.18 : 0;

    ctx.fillStyle = fog === 1 ? '#162415' : '#20361f';
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = fog === 1 ? 'rgba(12,22,12,0.28)' : 'rgba(16,34,16,0.32)';
    if (north) ctx.fillRect(px, py - T * 0.08, T, T * 0.24);
    if (south) ctx.fillRect(px, py + T * 0.84, T, T * 0.24);
    if (west) ctx.fillRect(px - T * 0.08, py, T * 0.24, T);
    if (east) ctx.fillRect(px + T * 0.84, py, T * 0.24, T);

    const treeCount = 4 + Math.floor(neighbor8 * 0.68) + Math.floor(tileRand(tx, ty, 400) * 3);
    const pineBias = Math.min(0.92, 0.74 + neighborCount * 0.05);
    const minX = west ? -0.10 : 0.04;
    const maxX = east ? 1.10 : 0.96;
    const minY = north ? 0.08 : 0.16;
    const maxY = south ? 0.98 : 0.86;

    const trees = [];
    for (let i = 0; i < treeCount; i++) {
      const kindRoll = tileRand(tx, ty, 415 + i * 5);
      let kind = 'broad';
      if (kindRoll < pineBias * 0.70) kind = 'pine';
      else if (kindRoll < pineBias + 0.14) kind = 'cypress';
      trees.push({
        x: px + T * (minX + tileRand(tx, ty, 410 + i * 5) * (maxX - minX)),
        y: py + T * (minY + tileRand(tx, ty, 411 + i * 5) * (maxY - minY)),
        scale: 0.80 + tileRand(tx, ty, 412 + i * 5) * 0.40,
        palette: Math.floor(tileRand(tx, ty, 413 + i * 5) * MapRenderer.TREE_PALETTES.length),
        kind,
      });
    }
    trees.sort((a, b) => a.y - b.y);

    for (const t of trees) {
      const s = T * 0.38 * t.scale;
      if (t.kind === 'pine') this._drawPine(ctx, t.x, t.y, s, dim, fog, t.palette);
      else if (t.kind === 'cypress') this._drawCypress(ctx, t.x, t.y, s * 1.05, dim, fog, t.palette);
      else this._drawTree(ctx, t.x, t.y, s, dim, fog, t.palette);
    }

    const bushClusters = 1 + Math.floor(tileRand(tx, ty, 460) * 3) + (neighbor8 >= 5 ? 1 : 0);
    for (let i = 0; i < bushClusters; i++) {
      const bx = px + T * (0.12 + tileRand(tx, ty, 461 + i * 4) * 0.76);
      const by = py + T * (0.52 + tileRand(tx, ty, 462 + i * 4) * 0.34);
      const palIdx = Math.floor(tileRand(tx, ty, 463 + i * 4) * MapRenderer.TREE_PALETTES.length);
      const bScale = T * (0.07 + tileRand(tx, ty, 464 + i * 4) * 0.06);
      this._drawBushCluster(ctx, bx, by, bScale, dim, fog, palIdx);
    }
  }

  _drawTree(ctx, cx, cy, s, dim, fog, palIdx) {
    const pal = MapRenderer.TREE_PALETTES[palIdx] || MapRenderer.TREE_PALETTES[0];

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.12, cy + s * 0.48, s * 0.6, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gövde
    ctx.fillStyle = shade('#3A2510', dim);
    ctx.fillRect(cx - s * 0.08, cy - s * 0.05, s * 0.16, s * 0.55);

    const ty = cy - s * 0.38; // taç merkezi

    // Dış koyu halka (siluet)
    ctx.fillStyle = shade(pal.dark, dim - 0.15);
    ctx.beginPath();
    ctx.arc(cx, ty, s * 0.58, 0, Math.PI * 2);
    ctx.fill();

    // Ana taç gövdesi
    ctx.fillStyle = shade(pal.mid, dim);
    ctx.beginPath();
    ctx.arc(cx, ty, s * 0.50, 0, Math.PI * 2);
    ctx.fill();

    // Sol üst ışık — yaprak lobları
    ctx.fillStyle = shade(pal.light, dim);
    ctx.beginPath();
    ctx.arc(cx - s * 0.15, ty - s * 0.18, s * 0.30, 0, Math.PI * 2);
    ctx.fill();

    // Sağ alt gölge lob
    ctx.fillStyle = shade(pal.dark, dim - 0.08);
    ctx.beginPath();
    ctx.arc(cx + s * 0.18, ty + s * 0.15, s * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Sol tepe vurgu
    if (fog === 2) {
      ctx.fillStyle = shade(pal.light, dim + 0.12);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(cx - s * 0.22, ty - s * 0.28, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    }
  }

  // ── Çam ağacı — Sivri üçgen katmanlı siluet ───────────────────────────
  _drawPine(ctx, cx, cy, s, dim, fog, palIdx) {
    const pal = MapRenderer.TREE_PALETTES[palIdx] || MapRenderer.TREE_PALETTES[0];

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.08, cy + s * 0.42, s * 0.35, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Gövde
    ctx.fillStyle = shade('#3A2008', dim);
    ctx.fillRect(cx - s * 0.06, cy - s * 0.02, s * 0.12, s * 0.48);

    // 3 katmanlı üçgen — koyu siluet > ana gövde > ışık yüzü
    const tiers = [
      { y: 0.02, w: 0.55, h: 0.36 },
      { y: -0.24, w: 0.42, h: 0.32 },
      { y: -0.46, w: 0.28, h: 0.28 },
    ];

    for (let j = 0; j < tiers.length; j++) {
      const t = tiers[j];
      const ty2 = cy + s * t.y;
      const tw = s * t.w;
      const th = s * t.h;

      // Koyu siluet (sağ alt gölge)
      ctx.fillStyle = shade(pal.dark, dim - 0.12);
      ctx.beginPath();
      ctx.moveTo(cx, ty2 - th);
      ctx.lineTo(cx + tw + 1, ty2 + th * 0.15 + 1);
      ctx.lineTo(cx - tw - 1, ty2 + th * 0.15 + 1);
      ctx.closePath();
      ctx.fill();

      // Ana gövde
      ctx.fillStyle = shade(pal.mid, dim + j * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx, ty2 - th);
      ctx.lineTo(cx + tw, ty2 + th * 0.12);
      ctx.lineTo(cx - tw, ty2 + th * 0.12);
      ctx.closePath();
      ctx.fill();

      // Sol yüz ışık
      ctx.fillStyle = shade(pal.light, dim + j * 0.02);
      ctx.beginPath();
      ctx.moveTo(cx, ty2 - th);
      ctx.lineTo(cx - tw * 0.90, ty2 + th * 0.10);
      ctx.lineTo(cx - tw * 0.10, ty2 + th * 0.04);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── DAĞ — Sivri, soğuk gri kayalık, dramatik gölge ────────────────────
  // Işık sol üstten: sol yüz açık gri, sağ yüz koyu mavi-gri
  // ══════════════════════════════════════════════════════════════════════════
  _drawCypress(ctx, cx, cy, s, dim, fog, palIdx) {
    const pal = MapRenderer.TREE_PALETTES[palIdx] || MapRenderer.TREE_PALETTES[0];
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.08, cy + s * 0.46, s * 0.34, s * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = shade('#3A2008', dim);
    ctx.fillRect(cx - s * 0.05, cy + s * 0.02, s * 0.10, s * 0.42);

    const top = cy - s * 0.64;
    const mid = cy - s * 0.06;
    const half = s * 0.30;
    ctx.fillStyle = shade(pal.dark, dim - 0.12);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx + half, mid);
    ctx.lineTo(cx - half, mid);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = shade(pal.mid, dim);
    ctx.beginPath();
    ctx.moveTo(cx, top + s * 0.04);
    ctx.lineTo(cx + half * 0.82, mid - s * 0.02);
    ctx.lineTo(cx - half * 0.82, mid - s * 0.02);
    ctx.closePath();
    ctx.fill();

    if (fog === 2) {
      ctx.fillStyle = shade(pal.light, dim + 0.10);
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.24, top + s * 0.16);
      ctx.lineTo(cx - half * 0.62, mid - s * 0.02);
      ctx.lineTo(cx - half * 0.06, mid - s * 0.11);
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawBushCluster(ctx, x, y, baseR, dim, fog, palIdx) {
    const pal = MapRenderer.TREE_PALETTES[palIdx] || MapRenderer.TREE_PALETTES[0];
    const dark = shade(pal.dark, dim - 0.08);
    const mid = shade(pal.mid, dim - 0.03);
    const light = shade(pal.light, dim + 0.04);
    this._drawSmallBush(ctx, x, y, baseR * 1.05, dark);
    this._drawSmallBush(ctx, x - baseR * 0.78, y + baseR * 0.10, baseR * 0.90, mid);
    this._drawSmallBush(ctx, x + baseR * 0.82, y + baseR * 0.06, baseR * 0.85, mid);
    if (fog === 2) this._drawSmallBush(ctx, x - baseR * 0.12, y - baseR * 0.20, baseR * 0.62, light);
  }

  _drawMountain(ctx, px, py, T, fog, tx, ty) {
    const north = this._hasMountainAt(tx, ty - 1);
    const south = this._hasMountainAt(tx, ty + 1);
    const west = this._hasMountainAt(tx - 1, ty);
    const east = this._hasMountainAt(tx + 1, ty);
    const neighborCount = (north ? 1 : 0) + (south ? 1 : 0) + (west ? 1 : 0) + (east ? 1 : 0);
    const neighbor8 = this._countMountainNeighbors8(tx, ty);
    const hasH3Mountain = Array.isArray(H3_PROP_DATA?.MOUNTAIN?.frames) && H3_PROP_DATA.MOUNTAIN.frames.length > 0;
    if (hasH3Mountain) {
      const passWindow = east && west && !north && !south && neighbor8 >= 5;
      const passNoise = h3Noise(tx * 0.83, ty * 0.37, 7399);
      if (passWindow && passNoise > 0.44 && passNoise < 0.62) return;

      const clusterNoise = h3Noise(tx * 0.61, ty * 0.57, 7331);
      const sparseThreshold = neighbor8 >= 6 ? 0.30 : neighbor8 >= 4 ? 0.44 : neighbor8 >= 2 ? 0.58 : 0.75;
      if (clusterNoise <= sparseThreshold) return;

      let drew = false;
      if (neighbor8 >= 5) {
        const backEntry = h3PickPropFrame('MOUNTAIN', tx - 19, ty + 13);
        drew = h3DrawPropFrame(ctx, backEntry, px, py, T, fog, tx, ty, 'MOUNTAIN', {
          scaleMul: 0.78 + h3Noise(tx * 0.27, ty * 0.29, 7411) * 0.12,
          jitterMul: 0.50,
          offsetX: (h3Noise(tx * 0.47, ty * 0.53, 7417) - 0.5) * T * 0.22,
          offsetY: -T * (0.13 + h3Noise(tx * 0.39, ty * 0.31, 7421) * 0.10),
          alphaMul: 0.72,
        }) || drew;
      }

      const largeCell = `${Math.floor(tx / 3)},${Math.floor(ty / 2)}`;
      const largeNoise = h3Noise(tx * 0.53, ty * 0.47, 7811);
      const canLarge = neighbor8 >= 6
        && largeNoise > 0.58
        && !this._visibleLargeMountainCells.has(largeCell)
        && Array.isArray(H3_PROP_DATA?.MOUNTAIN_LARGE?.frames)
        && H3_PROP_DATA.MOUNTAIN_LARGE.frames.length > 0;
      if (canLarge) {
        this._visibleLargeMountainCells.add(largeCell);
        const largeEntry = h3PickPropFrame('MOUNTAIN_LARGE', tx, ty);
        drew = h3DrawPropFrame(ctx, largeEntry, px, py, T, fog, tx, ty, 'MOUNTAIN_LARGE', {
          scaleMul: 0.94 + h3Noise(tx * 0.17, ty * 0.21, 7427) * 0.18,
          jitterMul: 0.82,
          offsetX: (h3Noise(tx * 0.23, ty * 0.37, 7433) - 0.5) * T * 0.24,
          offsetY: -T * 0.04,
        }) || drew;
      }

      const entry = h3PickPropFrame('MOUNTAIN', tx, ty);
      drew = h3DrawPropFrame(ctx, entry, px, py, T, fog, tx, ty, 'MOUNTAIN', {
        scaleMul: 0.90 + h3Noise(tx * 0.33, ty * 0.49, 7439) * 0.24,
        jitterMul: 0.78,
        offsetX: (h3Noise(tx * 0.59, ty * 0.41, 7441) - 0.5) * T * 0.20,
        offsetY: -T * (0.01 + h3Noise(tx * 0.31, ty * 0.23, 7447) * 0.05),
      }) || drew;

      if (neighbor8 >= 6 && h3Noise(tx * 0.43, ty * 0.45, 7451) > 0.75) {
        const front = h3PickPropFrame('MOUNTAIN', tx + 29, ty - 7);
        drew = h3DrawPropFrame(ctx, front, px, py, T, fog, tx, ty, 'MOUNTAIN', {
          scaleMul: 0.66 + h3Noise(tx * 0.27, ty * 0.37, 7457) * 0.12,
          jitterMul: 0.45,
          offsetX: (h3Noise(tx * 0.51, ty * 0.21, 7463) - 0.5) * T * 0.16,
          offsetY: T * (0.12 + h3Noise(tx * 0.35, ty * 0.25, 7469) * 0.04),
          alphaMul: 0.88,
        }) || drew;
      }

      if (drew) return;
    }

    const dim = fog === 1 ? -0.18 : 0;

    const base = py + T * (south ? 0.98 : 0.95);
    const ridgeLift = neighborCount * 0.04 + (north ? 0.03 : 0);
    const peakCount = 1 + Math.floor(tileRand(tx, ty, 500) * 2) + (neighborCount >= 3 ? 1 : 0);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(px + T * 0.52, base + T * 0.02, T * 0.52, T * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    const peaks = [];
    for (let i = 0; i < peakCount; i++) {
      let center = 0.20 + tileRand(tx, ty, 510 + i * 4) * 0.60;
      if (west && !east) center *= 0.88;
      if (east && !west) center = 0.10 + center * 0.96;
      peaks.push({
        cx: center,
        peakY: -0.14 - ridgeLift + tileRand(tx, ty, 511 + i * 4) * 0.10,
        width: 0.34 + tileRand(tx, ty, 512 + i * 4) * 0.20 + neighborCount * 0.02,
      });
    }
    peaks.sort((a, b) => b.peakY - a.peakY);

    if (west) {
      ctx.fillStyle = shade('#434853', dim - 0.10);
      ctx.beginPath();
      ctx.moveTo(px - T * 0.06, base);
      ctx.lineTo(px + T * 0.25, py + T * (0.20 - ridgeLift));
      ctx.lineTo(px + T * 0.46, base);
      ctx.closePath();
      ctx.fill();
    }
    if (east) {
      ctx.fillStyle = shade('#434853', dim - 0.10);
      ctx.beginPath();
      ctx.moveTo(px + T * 1.06, base);
      ctx.lineTo(px + T * 0.75, py + T * (0.20 - ridgeLift));
      ctx.lineTo(px + T * 0.54, base);
      ctx.closePath();
      ctx.fill();
    }

    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const mcx = px + T * p.cx;
      const peakTop = py + T * p.peakY;
      const halfW = T * p.width;

      ctx.fillStyle = shade('#3A3E48', dim - 0.15);
      ctx.beginPath();
      ctx.moveTo(mcx - halfW * 1.3, base);
      ctx.lineTo(mcx - halfW * 0.15, peakTop + T * 0.04);
      ctx.lineTo(mcx, peakTop);
      ctx.lineTo(mcx + halfW * 0.20, peakTop + T * 0.03);
      ctx.lineTo(mcx + halfW * 1.3, base);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = shade('#484E58', dim - 0.06);
      ctx.beginPath();
      ctx.moveTo(mcx, peakTop);
      ctx.lineTo(mcx + halfW * 0.20, peakTop + T * 0.03);
      ctx.lineTo(mcx + halfW * 1.25, base);
      ctx.lineTo(mcx + halfW * 0.05, base);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = shade('#8A9098', dim + 0.08);
      ctx.beginPath();
      ctx.moveTo(mcx, peakTop);
      ctx.lineTo(mcx - halfW * 0.15, peakTop + T * 0.04);
      ctx.lineTo(mcx - halfW * 1.2, base);
      ctx.lineTo(mcx - halfW * 0.05, base);
      ctx.closePath();
      ctx.fill();

      if (fog === 2) {
        ctx.strokeStyle = shade('#B0B8C0', dim + 0.15);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mcx - halfW * 0.15, peakTop + T * 0.04);
        ctx.lineTo(mcx, peakTop);
        ctx.lineTo(mcx + halfW * 0.20, peakTop + T * 0.03);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(30,35,45,0.20)';
        ctx.lineWidth = 0.7;
        const cracks = 3 + Math.floor(tileRand(tx, ty, 540 + i * 5) * 3);
        for (let c = 0; c < cracks; c++) {
          const frac = 0.18 + c * 0.16 + tileRand(tx, ty, 550 + i * 5 + c) * 0.05;
          const cy0 = peakTop + (base - peakTop) * frac;
          const cx0 = mcx + halfW * (-0.5 + tileRand(tx, ty, 560 + i * 5 + c) * 0.4);
          const cx1 = cx0 + halfW * (0.2 + tileRand(tx, ty, 570 + i * 5 + c) * 0.3);
          ctx.beginPath();
          ctx.moveTo(cx0, cy0);
          ctx.lineTo(cx1, cy0 + T * 0.01);
          ctx.stroke();
        }
      }

      const snowH = T * (0.10 + tileRand(tx, ty, 590 + i) * 0.08);
      ctx.fillStyle = fog === 2 ? 'rgba(240,245,255,0.95)' : 'rgba(220,230,245,0.55)';
      ctx.beginPath();
      ctx.moveTo(mcx - halfW * 0.25, peakTop + snowH * 1.2);
      ctx.quadraticCurveTo(mcx - halfW * 0.12, peakTop + snowH * 0.4, mcx, peakTop);
      ctx.quadraticCurveTo(mcx + halfW * 0.18, peakTop + snowH * 0.3, mcx + halfW * 0.35, peakTop + snowH);
      ctx.quadraticCurveTo(mcx + halfW * 0.15, peakTop + snowH * 1.3, mcx, peakTop + snowH * 0.85);
      ctx.quadraticCurveTo(mcx - halfW * 0.10, peakTop + snowH * 1.4, mcx - halfW * 0.25, peakTop + snowH * 1.2);
      ctx.closePath();
      ctx.fill();
    }

    if (fog === 2 && tileRand(tx, ty, 600) > 0.4) {
      for (let i = 0; i < 2; i++) {
        const bx = px + T * (0.1 + tileRand(tx, ty, 610 + i * 2) * 0.8);
        const by = base - T * (0.02 + tileRand(tx, ty, 611 + i * 2) * 0.05);
        this._drawRock(ctx, bx, by, T * (0.035 + tileRand(tx, ty, 612 + i * 2) * 0.03));
      }
    }
  }

  _drawRock(ctx, x, y, r) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 2, r * 1.2, r * 0.75, 0.1, 0, Math.PI * 2); ctx.fill();
    // Rock body
    ctx.fillStyle = '#6A6055';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.65, 0.1, 0, Math.PI * 2); ctx.fill();
    // Mid-tone
    ctx.fillStyle = '#807568';
    ctx.beginPath(); ctx.ellipse(x - r * 0.1, y - r * 0.05, r * 0.7, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(190,180,165,0.5)';
    ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.2, r * 0.4, r * 0.28, -0.3, 0, Math.PI * 2); ctx.fill();
  }

  _drawSmallBush(ctx, x, y, r, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x + 1, y + r * 0.4, r * 0.9, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    // Dark base
    ctx.fillStyle = shade(color, -0.20);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    // Lighter top
    ctx.fillStyle = shade(color, 0.05);
    ctx.beginPath(); ctx.ellipse(x - r * 0.15, y - r * 0.12, r * 0.65, r * 0.50, 0, 0, Math.PI * 2); ctx.fill();
    // Highlight spot
    ctx.fillStyle = shade(color, 0.22);
    ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - r * 0.22, r * 0.28, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ── Nehirler (smooth curves + banks) ───────────────────────────────────
  _buildRiverRenderPoints(river, T) {
    const base = river.map((p) => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 }));
    if (base.length < 3) return base;

    const pts = [base[0]];
    for (let i = 0; i < base.length - 1; i++) {
      const a = base[i];
      const b = base[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const bendNoise = h3Noise((a.x + b.x) * 0.007, (a.y + b.y) * 0.009, 8603 + i * 17);
      const bendSign = bendNoise > 0.5 ? 1 : -1;
      const bendAmp = T * (0.08 + h3Noise(a.x * 0.013, a.y * 0.011, 8611 + i * 13) * 0.09);
      const midX = (a.x + b.x) * 0.5 + nx * bendAmp * bendSign;
      const midY = (a.y + b.y) * 0.5 + ny * bendAmp * bendSign;
      pts.push({ x: midX, y: midY });
      pts.push(b);
    }

    const relaxed = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      relaxed.push({
        x: p1.x * 0.58 + (p0.x + p2.x) * 0.21,
        y: p1.y * 0.58 + (p0.y + p2.y) * 0.21,
      });
    }
    relaxed.push(pts[pts.length - 1]);
    return relaxed;
  }

  _drawRivers(ctx, rivers, T) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const r of rivers) {
      if (r.length < 2) continue;
      const pts = this._buildRiverRenderPoints(r, T);
      const widthNoise = h3Noise((r[0]?.x || 0) * 0.12, (r[0]?.y || 0) * 0.14, 8627);
      const widthMul = 0.92 + widthNoise * 0.24;

      ctx.strokeStyle = 'rgba(20,52,78,0.48)';
      ctx.lineWidth = T * 0.22 * widthMul;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      ctx.strokeStyle = '#2A78AA';
      ctx.lineWidth = T * 0.16 * widthMul;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      ctx.strokeStyle = '#5AA7DA';
      ctx.lineWidth = T * 0.075 * widthMul;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(150,206,240,0.30)';
      ctx.lineWidth = T * 0.022 * widthMul;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();
    }
  }

  // Smooth catmull-rom-like path through points
  _drawSmoothPath(ctx, pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
      return;
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[Math.min(pts.length - 1, i + 1)];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  // ── Yollar (dirt track) ────────────────────────────────────────────────
  _drawRoads(ctx, roads, T) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    for (const rd of roads) {
      if (!rd.path || rd.path.length < 2) continue;
      const pts = rd.path.map(p => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 }));

      // Road edge shadow
      ctx.strokeStyle = 'rgba(70,50,25,0.55)';
      ctx.lineWidth = T * 0.20;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      // Road body (warm brown dirt)
      ctx.strokeStyle = '#B08850';
      ctx.lineWidth = T * 0.15;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      // Center worn track
      ctx.strokeStyle = 'rgba(190,165,120,0.4)';
      ctx.lineWidth = T * 0.06;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();
    }
  }

  // ── Hareket yolu ─────────────────────────────────────────────────────────
  _drawMovePath(ctx, player, T) {
    const sx = player.x, sy = player.y;
    const ex = Number.isFinite(player.destX) ? player.destX : (player.tx * T + T / 2);
    const ey = Number.isFinite(player.destY) ? player.destY : (player.ty * T + T / 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,80,0.42)';
    ctx.lineWidth = 2;
    ctx.setLineDash([T * 0.14, T * 0.11]);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    // Hedef artı
    const mr = T * 0.17;
    ctx.strokeStyle = 'rgba(255,230,80,0.68)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex - mr, ey); ctx.lineTo(ex + mr, ey);
    ctx.moveTo(ex, ey - mr); ctx.lineTo(ex, ey + mr);
    ctx.stroke();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Yerleşimler (M&B kale/köy stili) ────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawSettlement(ctx, settlement, T) {
    const cx = settlement.x;
    const cy = settlement.y;
    const owner = settlement.ownerFactionId || settlement.owner;
    const factionColor = this._factionColor(owner);
    const type = String(settlement.type || 'village').toLowerCase();
    const spriteType = (type === 'city' || type === 'town' || type === 'fort') ? type : 'village';
    const sprite = this._getSettlementSprite(spriteType, factionColor);
    const profile = this._settlementVisualProfile(spriteType, T);
    const tx = Math.floor(cx / Math.max(1, T));
    const ty = Math.floor(cy / Math.max(1, T));

    ctx.save();
    this._drawSettlementGroundBlend(ctx, cx, cy, profile, T, tx, ty, factionColor);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + profile.shadowY, profile.shadowW, profile.shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    if (sprite) {
      const dw = Math.max(10, Math.round(profile.w));
      const dh = Math.max(8, Math.round(profile.h));
      const dx = Math.round(cx - dw * 0.5);
      const dy = Math.round(cy - dh * profile.anchor);
      ctx.drawImage(sprite, dx, dy, dw, dh);
    } else {
      switch (spriteType) {
        case 'city': this._castle(ctx, cx, cy, T * 0.48, factionColor, 'city'); break;
        case 'town': this._castle(ctx, cx, cy, T * 0.34, factionColor, 'town'); break;
        case 'fort': this._castle(ctx, cx, cy, T * 0.28, factionColor, 'fort'); break;
        default: this._village(ctx, cx, cy, T * 0.29, factionColor);
      }
    }
    ctx.restore();

    this._label(ctx, cx, cy + profile.labelY, settlement.name, 'rgba(255,248,200,0.97)');
  }

  _settlementVisualProfile(type, T) {
    const scale = 3.0;
    switch (type) {
      case 'city':
        return { w: T * 2.48 * scale, h: T * 1.72 * scale, anchor: 0.84, labelY: T * 0.66 * scale, shadowW: T * 0.82 * scale, shadowH: T * 0.21 * scale, shadowY: T * 0.34 * scale };
      case 'town':
        return { w: T * 2.06 * scale, h: T * 1.46 * scale, anchor: 0.83, labelY: T * 0.56 * scale, shadowW: T * 0.70 * scale, shadowH: T * 0.18 * scale, shadowY: T * 0.31 * scale };
      case 'fort':
        return { w: T * 1.80 * scale, h: T * 1.25 * scale, anchor: 0.82, labelY: T * 0.50 * scale, shadowW: T * 0.62 * scale, shadowH: T * 0.16 * scale, shadowY: T * 0.28 * scale };
      default:
        return { w: T * 1.58 * scale, h: T * 1.08 * scale, anchor: 0.80, labelY: T * 0.44 * scale, shadowW: T * 0.55 * scale, shadowH: T * 0.15 * scale, shadowY: T * 0.25 * scale };
    }
  }

  _drawSettlementGroundBlend(ctx, cx, cy, profile, T, tx, ty, factionColor) {
    const baseW = profile.shadowW * 1.08;
    const baseH = profile.shadowH * 1.45;
    const baseY = cy + profile.shadowY * 1.02;
    ctx.fillStyle = 'rgba(45,31,15,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, baseY + 2, baseW, baseH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(122,90,52,0.34)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY, baseW * 0.96, baseH * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    const roadW = Math.max(4, profile.shadowW * 0.18);
    const roadH = Math.max(8, profile.shadowY * 0.44);
    ctx.fillStyle = 'rgba(144,110,68,0.42)';
    ctx.fillRect(Math.round(cx - roadW * 0.5), Math.round(baseY + baseH * 0.10), Math.round(roadW), Math.round(roadH));
    ctx.fillStyle = 'rgba(186,150,102,0.36)';
    ctx.fillRect(Math.round(cx - roadW * 0.2), Math.round(baseY + baseH * 0.10), Math.max(2, Math.round(roadW * 0.34)), Math.round(roadH));

    const bushCount = 3 + Math.floor(tileRand(tx, ty, 11117) * 3);
    const palIdx = Math.floor(tileRand(tx, ty, 11119) * MapRenderer.TREE_PALETTES.length);
    for (let i = 0; i < bushCount; i++) {
      const angle = tileRand(tx, ty, 11131 + i * 3) * Math.PI * 2;
      const rad = baseW * (0.60 + tileRand(tx, ty, 11132 + i * 3) * 0.36);
      const bx = cx + Math.cos(angle) * rad;
      const by = baseY + Math.sin(angle) * baseH * 0.68;
      this._drawBushCluster(ctx, bx, by, T * (0.11 + tileRand(tx, ty, 11133 + i * 3) * 0.05), 0, 2, palIdx);
    }

    ctx.strokeStyle = shade(factionColor || '#808080', 0.10);
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = Math.max(1, T * 0.05);
    ctx.beginPath();
    ctx.ellipse(cx, baseY - baseH * 0.06, baseW * 0.80, baseH * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _getSettlementSprite(type, factionColor) {
    const key = `${type}:${factionColor || 'neutral'}`;
    if (this._settlementSpriteCache.has(key)) return this._settlementSpriteCache.get(key);
    const sprite = this._buildSettlementSprite(type, factionColor);
    this._settlementSpriteCache.set(key, sprite || null);
    return sprite;
  }

  _buildSettlementSprite(type, factionColor) {
    if (typeof document === 'undefined') return null;
    const dims = {
      city: [74, 52],
      town: [62, 45],
      fort: [54, 40],
      village: [48, 34],
    }[type] || [48, 34];
    const [w, h] = dims;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cctx = canvas.getContext('2d');
    if (!cctx) return null;
    cctx.imageSmoothingEnabled = false;

    const pal = H3_SETTLEMENT_PALETTE;
    const roofMain = type === 'village' ? pal.woodLight : pal.roofMid;
    const roofLight = type === 'village' ? shade(pal.woodLight, 0.14) : pal.roofLight;
    const roofDark = type === 'village' ? pal.woodMid : pal.roofDark;
    const wallMain = type === 'village' ? pal.plaster : pal.stoneMid;
    const wallDark = type === 'village' ? shade(pal.plaster, -0.20) : pal.stoneDark;
    const wallLight = type === 'village' ? shade(pal.plaster, 0.10) : pal.stoneLight;

    this._drawSpriteRect(cctx, 'rgba(0,0,0,0.18)', 6, h - 8, w - 12, 5);
    this._drawSpriteRect(cctx, pal.pathDark, Math.floor(w * 0.44), h - 10, Math.max(6, Math.floor(w * 0.15)), 9);
    this._drawSpriteRect(cctx, pal.pathLight, Math.floor(w * 0.47), h - 9, Math.max(3, Math.floor(w * 0.08)), 8);

    if (type === 'city') {
      this._drawSpriteTower(cctx, 7, 14, 12, 24, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark);
      this._drawSpriteTower(cctx, 31, 8, 12, 29, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark);
      this._drawSpriteTower(cctx, 55, 14, 12, 24, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark);
      this._drawSpriteRect(cctx, wallMain, 14, 20, 46, 17);
      this._drawSpriteDither(cctx, 14, 20, 46, 17, wallLight, wallDark, 0);
      this._drawSpriteCrenels(cctx, 14, 20, 46, wallLight, wallDark);
      this._drawSpriteRect(cctx, 'rgba(20,20,20,0.7)', 33, 28, 8, 9);
      this._drawSpriteHouse(cctx, 17, 31, 12, 8, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpriteHouse(cctx, 47, 31, 11, 8, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpriteRect(cctx, pal.pathDark, 35, 37, 5, 9);
      this._drawSpriteRect(cctx, pal.pathLight, 36, 37, 2, 9);
      this._drawSpritePennant(cctx, 37, 7, factionColor);
    } else if (type === 'town') {
      this._drawSpriteTower(cctx, 9, 16, 11, 19, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark);
      this._drawSpriteTower(cctx, 42, 16, 11, 19, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark);
      this._drawSpriteRect(cctx, wallMain, 17, 20, 30, 15);
      this._drawSpriteDither(cctx, 17, 20, 30, 15, wallLight, wallDark, 1);
      this._drawSpriteCrenels(cctx, 17, 20, 30, wallLight, wallDark);
      this._drawSpriteRect(cctx, 'rgba(20,20,20,0.68)', 28, 27, 7, 8);
      this._drawSpriteHouse(cctx, 21, 31, 10, 7, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpriteHouse(cctx, 37, 31, 10, 7, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpritePennant(cctx, 31, 15, factionColor);
    } else if (type === 'fort') {
      this._drawSpriteTower(cctx, 20, 9, 14, 24, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark);
      this._drawSpriteRect(cctx, wallMain, 10, 21, 34, 12);
      this._drawSpriteDither(cctx, 10, 21, 34, 12, wallLight, wallDark, 2);
      this._drawSpriteCrenels(cctx, 10, 21, 34, wallLight, wallDark);
      this._drawSpriteRect(cctx, 'rgba(20,20,20,0.68)', 24, 26, 6, 7);
      this._drawSpritePennant(cctx, 27, 8, factionColor);
    } else {
      this._drawSpriteHouse(cctx, 9, 18, 13, 10, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpriteHouse(cctx, 25, 16, 14, 11, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpriteHouse(cctx, 16, 23, 12, 8, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
      this._drawSpriteRect(cctx, shade(pal.woodDark, -0.12), 5, 27, 38, 2);
      this._drawSpriteRect(cctx, shade(pal.woodMid, 0.08), 6, 28, 36, 1);
      this._drawSpritePennant(cctx, 31, 15, factionColor);
    }

    this._drawSpriteRect(cctx, pal.outline, 0, h - 1, w, 1);
    return canvas;
  }

  _drawSpriteRect(ctx, color, x, y, w, h) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.max(1, Math.round(w));
    const rh = Math.max(1, Math.round(h));
    ctx.fillStyle = color;
    ctx.fillRect(rx, ry, rw, rh);
  }

  _drawSpriteDither(ctx, x, y, w, h, colorA, colorB, seed = 0) {
    const sx = Math.round(x);
    const sy = Math.round(y);
    const ex = sx + Math.max(1, Math.round(w));
    const ey = sy + Math.max(1, Math.round(h));
    for (let yy = sy; yy < ey; yy++) {
      for (let xx = sx; xx < ex; xx++) {
        ctx.fillStyle = (((xx + yy + seed) & 1) === 0) ? colorA : colorB;
        ctx.fillRect(xx, yy, 1, 1);
      }
    }
  }

  _drawSpriteCrenels(ctx, x, y, w, light, dark) {
    const sx = Math.round(x);
    const sy = Math.round(y);
    const width = Math.max(2, Math.round(w));
    for (let i = 0; i < width; i += 4) {
      this._drawSpriteRect(ctx, light, sx + i, sy - 2, Math.min(2, width - i), 2);
    }
    this._drawSpriteRect(ctx, dark, sx, sy + 1, width, 1);
  }

  _drawSpriteTower(ctx, x, y, w, h, wallMain, wallLight, wallDark, roofMain, roofLight, roofDark) {
    this._drawSpriteRect(ctx, wallMain, x, y, w, h);
    this._drawSpriteDither(ctx, x, y, w, h, wallLight, wallDark, 0);
    this._drawSpriteCrenels(ctx, x, y, w, wallLight, wallDark);
    this._drawSpriteRect(ctx, wallDark, x, y + h - 1, w, 1);
    this._drawSpriteRect(ctx, 'rgba(0,0,0,0.55)', x + Math.floor(w * 0.38), y + Math.floor(h * 0.34), Math.max(2, Math.floor(w * 0.22)), Math.max(4, Math.floor(h * 0.44)));

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
  }

  _drawSpriteHouse(ctx, x, y, w, h, wallColor, roofBase, roofMid, roofLight) {
    this._drawSpriteRect(ctx, wallColor, x, y, w, h);
    this._drawSpriteRect(ctx, shade(wallColor, -0.18), x, y + h - 1, w, 1);
    this._drawSpriteRect(ctx, 'rgba(30,20,10,0.62)', x + Math.floor(w * 0.42), y + Math.floor(h * 0.42), Math.max(2, Math.floor(w * 0.18)), Math.max(3, Math.floor(h * 0.58)));

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
  }

  _drawSpritePennant(ctx, x, y, color) {
    const flagColor = color || '#c0392b';
    this._drawSpriteRect(ctx, '#3b2816', x, y - 5, 1, 6);
    this._drawSpriteRect(ctx, shade(flagColor, -0.10), x + 1, y - 5, 5, 3);
    this._drawSpriteRect(ctx, flagColor, x + 1, y - 4, 5, 2);
    this._drawSpriteRect(ctx, shade(flagColor, 0.18), x + 2, y - 4, 2, 1);
    this._drawSpriteRect(ctx, 'rgba(255,255,255,0.55)', x + 2, y - 3, 1, 1);
  }

  // Kale (şehir/kasaba/kale)
  _castle(ctx, cx, cy, s, color, type) {
    const isCity = type === 'city';

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath(); ctx.ellipse(cx + 2, cy + s * 0.48, s * 1.15, s * 0.26, 0, 0, Math.PI * 2); ctx.fill();

    const wallC  = shade(color, -0.28);
    const towerC = shade(color, -0.10);
    const capC   = shade(color,  0.18);

    // Perde duvarı
    const ww = s * (isCity ? 1.9 : 1.55);
    const wh = s * 0.62;
    const wl = cx - ww / 2;
    const wt = cy - s * 0.08;

    ctx.fillStyle = wallC;
    ctx.fillRect(wl, wt, ww, wh);
    this._crenels(ctx, wl, wt, ww, s * 0.13, capC);

    // Kuleler
    const tW = s * (isCity ? 0.40 : 0.33);
    const tH = s * (isCity ? 1.05 : 0.88);
    const tPositions = isCity
      ? [wl - tW * 0.28, cx - tW / 2, wl + ww - tW * 0.72]
      : [wl - tW * 0.28, wl + ww - tW * 0.72];

    for (const tx of tPositions) {
      const tt = cy - tH * 0.55;
      ctx.fillStyle = towerC;
      ctx.fillRect(tx, tt, tW, tH);
      this._crenels(ctx, tx, tt, tW, s * 0.14, capC);

      // Ok penceresi
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(tx + tW * 0.36, tt + tH * 0.26, tW * 0.14, tH * 0.24);
    }

    // Kapı kemeri
    const gw = s * 0.28, gh = s * 0.33;
    const gx = cx - gw / 2;
    const gb = wt + wh;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.beginPath();
    ctx.moveTo(gx, gb);
    ctx.lineTo(gx, gb - gh * 0.55);
    ctx.arc(cx, gb - gh * 0.55, gw / 2, Math.PI, 0);
    ctx.lineTo(gx + gw, gb);
    ctx.closePath(); ctx.fill();

    // Kale bayrağı (orta kule üzerinde)
    const flagTX = isCity ? tPositions[1] + tW / 2 : tPositions[0] + tW / 2;
    const flagTY = cy - tH * 0.55;
    this._pennant(ctx, flagTX, flagTY, s * 0.13, s * 0.22, color);

    // Dış çizgi
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (const tx of tPositions) ctx.strokeRect(tx, cy - tH * 0.55, tW, tH);
    ctx.strokeRect(wl, wt, ww, wh);
  }

  // Merlon (diş) çizimi
  _crenels(ctx, x, y, width, mh, color) {
    const n = Math.max(2, Math.floor(width / (mh * 1.5)));
    const sw = width / (n * 2);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) ctx.fillRect(x + i * sw * 2, y - mh, sw, mh);
  }

  // Köy
  _village(ctx, cx, cy, s, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath(); ctx.ellipse(cx + 1, cy + s * 0.58, s * 0.88, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    const wallC = shade(color, -0.18);
    const roofC = shade(color,  0.22);
    const houses = [
      { ox: -s * 0.50, oy: s * 0.14 },
      { ox:  s * 0.50, oy: s * 0.14 },
      { ox:  0,        oy: -s * 0.12 },
    ];
    for (const h of houses) {
      const hx = cx + h.ox, hy = cy + h.oy;
      const hw = s * 0.38, hh = s * 0.33;
      // Duvar
      ctx.fillStyle = wallC;
      ctx.fillRect(hx - hw / 2, hy - hh / 2, hw, hh);
      // Çatı
      ctx.fillStyle = roofC;
      ctx.beginPath();
      ctx.moveTo(hx, hy - hh / 2 - hh * 0.46);
      ctx.lineTo(hx + hw / 2 + hw * 0.09, hy - hh / 2 + 1);
      ctx.lineTo(hx - hw / 2 - hw * 0.09, hy - hh / 2 + 1);
      ctx.closePath(); ctx.fill();
      // Kapı
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(hx - hw * 0.10, hy - hh / 2 + hh * 0.44, hw * 0.20, hh * 0.52);
    }
    // Çit
    ctx.strokeStyle = shade(color, -0.32);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([s * 0.12, s * 0.08]);
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.74, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Küçük üçgen bayrak (kale kulesi için)
  _pennant(ctx, x, y, poleH, fw, color) {
    const fh = fw * 0.52;
    ctx.strokeStyle = '#5c4020'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - poleH); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - poleH);
    ctx.lineTo(x + fw, y - poleH + fh * 0.45);
    ctx.lineTo(x, y - poleH + fh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(color, 0.28); ctx.lineWidth = 0.8; ctx.stroke();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Lord Partisi (M&B süvari banner stili) ───────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawLordParty(ctx, party, T) {
    const cx = party.x;
    const cy = party.y;
    const s  = T * 0.30;
    const fc = this._factionColor(party.faction);

    ctx.save();

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(cx + 1, cy + s * 0.24, s * 0.52, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();

    // At silueti
    this._horseSilhouette(ctx, cx, cy + s * 0.08, s * 0.88, fc);

    // Bayrak sırığı
    const pt = cy - s * 1.58, pb = cy - s * 0.05;
    ctx.strokeStyle = shade(fc, -0.40);
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.10, pb); ctx.lineTo(cx - s * 0.10, pt); ctx.stroke();

    // Banner bez (pennant)
    const bx = cx - s * 0.10, by = pt;
    const bw = s * 0.88, bh = s * 0.52;
    ctx.fillStyle = fc;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bw, by + bh * 0.42);
    ctx.lineTo(bx, by + bh);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(fc, 0.28); ctx.lineWidth = 1; ctx.stroke();

    // Banner amblemi
    this._emblem(ctx, bx + bw * 0.30, by + bh * 0.50, bh * 0.28, FACTION_EMBLEMS[party.faction] || 'cross');

    ctx.restore();

    // İsim + kuvvet etiketi
    const nm  = lordName(party.faction, party.id);
    const str = Math.round(party.strength);
    const labelColor = party.behavior === 'chase' ? '#ff6666'
                     : party.behavior === 'flee'  ? '#66aaff'
                     : 'rgba(255,248,210,0.95)';
    this._label(ctx, cx, cy - s * 1.76, `${nm}  [${str}]`, labelColor, true);
  }

  // At silueti (basit)
  _horseSilhouette(ctx, cx, cy, s, color) {
    const bc = shade(color, -0.48);
    // Gövde
    ctx.fillStyle = bc;
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.38, s * 0.17, -0.12, 0, Math.PI * 2); ctx.fill();
    // Baş+boyun
    ctx.beginPath(); ctx.ellipse(cx + s * 0.30, cy - s * 0.11, s * 0.12, s * 0.10, 0.55, 0, Math.PI * 2); ctx.fill();
    // Bacaklar
    ctx.strokeStyle = bc; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
    const legs = [cx - s * 0.22, cx - s * 0.08, cx + s * 0.08, cx + s * 0.22];
    for (const lx of legs) {
      ctx.beginPath();
      ctx.moveTo(lx, cy + s * 0.10);
      ctx.lineTo(lx + (lx > cx ? s * 0.04 : -s * 0.04), cy + s * 0.18);
      ctx.stroke();
    }
    // Kuyruk
    ctx.strokeStyle = bc; ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy - s * 0.02);
    ctx.quadraticCurveTo(cx - s * 0.55, cy - s * 0.10, cx - s * 0.48, cy + s * 0.14);
    ctx.stroke();
  }

  // Amblem (banner üzeri)
  _emblem(ctx, cx, cy, r, type) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
    switch (type) {
      case 'crescent':
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, Math.PI * 0.85, -Math.PI * 0.05); ctx.stroke();
        break;
      case 'cross':
        ctx.beginPath();
        ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
        ctx.stroke(); break;
      case 'eagle':
        ctx.beginPath();
        ctx.moveTo(cx - r, cy); ctx.lineTo(cx, cy - r); ctx.lineTo(cx + r, cy);
        ctx.stroke(); break;
      case 'wave':
        ctx.beginPath();
        ctx.moveTo(cx - r, cy);
        ctx.bezierCurveTo(cx - r * 0.3, cy - r, cx + r * 0.3, cy + r, cx + r, cy);
        ctx.stroke(); break;
      case 'skull':
        ctx.beginPath(); ctx.arc(cx, cy - r * 0.08, r * 0.52, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.3, cy + r * 0.38); ctx.lineTo(cx + r * 0.3, cy + r * 0.38);
        ctx.stroke(); break;
      default:
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.50, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ── Oyuncu (Altın Royal Banner) ──────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  _drawPlayerParty(ctx, player, T) {
    const cx = player.x;
    const cy = player.y;
    const s  = T * 0.33;

    ctx.save();

    // Zemin parıltısı
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(255,220,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.18, s * 0.68, s * 0.20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // At (altın ton)
    this._horseSilhouette(ctx, cx, cy + s * 0.10, s * 0.92, '#e8a000');

    // Altın sırık
    const pt = cy - s * 1.68, pb = cy - s * 0.02;
    ctx.strokeStyle = '#7a5c1a';
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.08, pb); ctx.lineTo(cx - s * 0.08, pt); ctx.stroke();

    // Altın pennant (parlak)
    const bx = cx - s * 0.08, by = pt;
    const bw = s * 1.0,  bh = s * 0.58;

    ctx.shadowColor = '#ffe066'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bw, by + bh * 0.42);
    ctx.lineTo(bx, by + bh);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#9a6810'; ctx.lineWidth = 1.5; ctx.stroke();

    // Yıldız amblemi
    this._star(ctx, bx + bw * 0.30, by + bh * 0.50, bh * 0.26);

    ctx.restore();

    // "Siz" etiketi
    this._label(ctx, cx, cy - s * 1.90, '⚔ Siz', '#ffe066', true);
  }

  // 5 kollu yıldız
  _star(ctx, cx, cy, r) {
    ctx.fillStyle = 'rgba(80,40,0,0.82)';
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  }

  // ── Etiket ───────────────────────────────────────────────────────────────
  _label(ctx, cx, cy, text, color = 'rgba(255,248,220,0.95)', bold = false) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `${bold ? 'bold ' : ''}10px 'Cinzel', serif`;
    const tw = ctx.measureText(text).width;
    const pad = 4;

    // Arka plan hap
    ctx.fillStyle = 'rgba(0,0,0,0.64)';
    ctx.beginPath();
    roundRect(ctx, cx - tw / 2 - pad, cy - 9, tw + pad * 2, 14, 3);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(text, cx + 1, cy + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  // ── Yardımcılar ──────────────────────────────────────────────────────────
  _terrainColor(type) {
    return {
      water:    CONST.WORLD.COLOR_SEA,
      shore:    CONST.WORLD.COLOR_SHORE,
      grass:    CONST.WORLD.COLOR_GRASS,
      forest:   CONST.WORLD.COLOR_FOREST,
      mountain: CONST.WORLD.COLOR_MOUNTAIN,
      snow:     CONST.WORLD.COLOR_SNOW,
    }[type] ?? CONST.WORLD.COLOR_GRASS;
  }

  _factionColor(factionId) {
    return {
      ottoman: '#c0392b',
      hre:     '#111111',
      polish:  '#8e44ad',
      spanish: '#f57c00',
      venice:  '#1e88e5',
      bandit:  '#6d4c41',
    }[factionId] ?? '#808080';
  }

  // ── Eski public methodlar (geriye dönük uyumluluk) ──────────────────────
  getFactionColor(id)         { return this._factionColor(id); }
  getTerrainColor(type)       { return this._terrainColor(type); }
  drawTile(ctx, tile, x, y, T, fog, map) { this._drawTile(ctx, tile, x, y, T, fog, map); }
  drawRivers(ctx, rivers, T)  { this._drawRivers(ctx, rivers, T); }
  drawRoads(ctx, roads, T)    { this._drawRoads(ctx, roads, T); }
  drawSettlement(ctx, s, T)   { this._drawSettlement(ctx, s, T); }
  drawAIParty(ctx, p, T)      { this._drawLordParty(ctx, p, T); }
  drawPlayer(ctx, pl, T)      { this._drawPlayerParty(ctx, pl, T); }
}

export default MapRenderer;



