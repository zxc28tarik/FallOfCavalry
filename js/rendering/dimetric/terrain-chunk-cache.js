import * as CONST from '../../constants.js';
import { screenToWorld } from './projection.js';
import { TRANSITION_BITS, TRANSITION_DIRECTIONS, computeTransitionMask } from './terrain-transitions.js';

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(finite(value, min))));
}

function defaultCanvasFactory(width, height) {
  if (typeof globalThis !== 'undefined' && typeof globalThis.OffscreenCanvas !== 'undefined') {
    return new globalThis.OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

function hasCtxMethod(ctx, name) {
  return Boolean(ctx && typeof ctx[name] === 'function');
}

function safeCtxSave(ctx) {
  if (hasCtxMethod(ctx, 'save')) ctx.save();
}

function safeCtxRestore(ctx) {
  if (hasCtxMethod(ctx, 'restore')) ctx.restore();
}

function safeCtxClip(ctx) {
  if (hasCtxMethod(ctx, 'clip')) ctx.clip();
}

function drawDiamondPath(ctx, cx, cy, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

function toRgb(hex, fallback = [110, 135, 90]) {
  if (typeof hex !== 'string') return fallback;
  const value = hex.trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return fallback;
  const int = Number.parseInt(value, 16);
  return [
    (int >> 16) & 0xff,
    (int >> 8) & 0xff,
    int & 0xff,
  ];
}

function shadeColor(rgb, delta) {
  return [
    Math.max(0, Math.min(255, Math.round(rgb[0] + delta))),
    Math.max(0, Math.min(255, Math.round(rgb[1] + delta))),
    Math.max(0, Math.min(255, Math.round(rgb[2] + delta))),
  ];
}

function rgbCss(rgb, alpha = 1) {
  if (alpha >= 0.999) return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function terrainNoise(tx, ty) {
  const n = Math.sin((tx * 12.9898) + (ty * 78.233) + 19.17) * 43758.5453;
  return n - Math.floor(n);
}

const GROUND_STYLE_PRESETS = Object.freeze({
  stronghold: Object.freeze({
    SEA: [72, 106, 138],
    SHORE: [146, 124, 86],
    PLAINS: [97, 123, 63],
    FOREST: [77, 103, 54],
    HILLS: [116, 109, 80],
    MOUNTAIN: [124, 119, 104],
    SNOW: [206, 212, 219],
  }),
  classic: Object.freeze({
    SEA: [122, 157, 188],
    SHORE: [174, 152, 116],
    PLAINS: [91, 152, 83],
    FOREST: [89, 127, 63],
    HILLS: [138, 122, 100],
    MOUNTAIN: [122, 112, 102],
    SNOW: [230, 237, 245],
  }),
});

function normalizeGroundStylePreset(raw) {
  const value = String(raw || 'stronghold').trim().toLowerCase();
  return value === 'classic' ? 'classic' : 'stronghold';
}

function biomeBaseRgb(biome, preset = 'stronghold') {
  const style = GROUND_STYLE_PRESETS[normalizeGroundStylePreset(preset)] || GROUND_STYLE_PRESETS.stronghold;
  const BIOME = CONST.BIOME || {};
  if (biome === BIOME.SEA) return style.SEA;
  if (biome === BIOME.SHORE) return style.SHORE;
  if (biome === BIOME.FOREST) return style.FOREST;
  if (biome === BIOME.HILLS) return style.HILLS;
  if (biome === BIOME.MOUNTAIN) return style.MOUNTAIN;
  if (biome === BIOME.SNOW) return style.SNOW;
  if (biome === BIOME.PLAINS) return style.PLAINS;
  const fallback = CONST.BIOME_COLORS?.[biome];
  if (fallback) return toRgb(fallback, style.PLAINS);
  return style.PLAINS;
}

function resolveBiomeTextureStyle(biome) {
  const BIOME = CONST.BIOME || {};
  if (biome === BIOME.SEA) return Object.freeze({ grain: 10, grainAlpha: 0.09, speckCount: 3, tuftCount: 0, shadowDelta: -10, lightDelta: 8 });
  if (biome === BIOME.SHORE) return Object.freeze({ grain: 12, grainAlpha: 0.10, speckCount: 4, tuftCount: 1, shadowDelta: -12, lightDelta: 6 });
  if (biome === BIOME.FOREST) return Object.freeze({ grain: 13, grainAlpha: 0.12, speckCount: 4, tuftCount: 5, shadowDelta: -14, lightDelta: 6 });
  if (biome === BIOME.HILLS) return Object.freeze({ grain: 11, grainAlpha: 0.11, speckCount: 4, tuftCount: 2, shadowDelta: -13, lightDelta: 6 });
  if (biome === BIOME.MOUNTAIN) return Object.freeze({ grain: 9, grainAlpha: 0.09, speckCount: 3, tuftCount: 0, shadowDelta: -14, lightDelta: 5 });
  if (biome === BIOME.SNOW) return Object.freeze({ grain: 8, grainAlpha: 0.08, speckCount: 2, tuftCount: 0, shadowDelta: -8, lightDelta: 7 });
  return Object.freeze({ grain: 14, grainAlpha: 0.12, speckCount: 5, tuftCount: 6, shadowDelta: -12, lightDelta: 7 });
}

function drawGrassTufts(ctx, cell, cx, cy, halfW, halfH, alphaMul = 1) {
  if (!hasCtxMethod(ctx, 'beginPath') || !hasCtxMethod(ctx, 'moveTo') || !hasCtxMethod(ctx, 'lineTo') || !hasCtxMethod(ctx, 'stroke')) return;
  const seedA = terrainNoise((cell.tx * 1.33) + 8.1, (cell.ty * 0.71) + 2.7);
  const seedB = terrainNoise((cell.tx * 0.49) + 3.2, (cell.ty * 1.17) + 9.4);
  const hue = [113, 133, 72];
  const dry = [132, 118, 82];
  const blend = Math.max(0, Math.min(1, (seedA * 0.65) + (seedB * 0.35)));
  const color = [
    Math.round((hue[0] * (1 - blend)) + (dry[0] * blend)),
    Math.round((hue[1] * (1 - blend)) + (dry[1] * blend)),
    Math.round((hue[2] * (1 - blend)) + (dry[2] * blend)),
  ];
  ctx.strokeStyle = rgbCss(color, 0.22 * alphaMul);
  ctx.lineWidth = 1;

  const bladeCount = 2 + Math.floor(seedA * 3);
  const baseY = cy + (halfH * 0.38);
  for (let i = 0; i < bladeCount; i += 1) {
    const n = terrainNoise(cell.tx * 1.17 + i * 0.77, cell.ty * 1.09 + i * 0.53);
    const n2 = terrainNoise(cell.tx * 0.97 + i * 0.39, cell.ty * 1.21 + i * 0.81);
    const bx = cx - (halfW * 0.52) + (n * halfW * 1.04);
    const by = baseY + ((n2 - 0.5) * halfH * 0.22);
    const tipX = bx + ((n2 - 0.5) * halfW * 0.12);
    const tipY = by - (halfH * (0.22 + (n * 0.16)));
    ctx.beginPath();
    ctx.moveTo(Math.round(bx), Math.round(by));
    ctx.lineTo(Math.round(tipX), Math.round(tipY));
    ctx.stroke();
  }
}

function drawCellTexture(ctx, cell, cx, cy, halfW, halfH, baseRgb, textureStyle) {
  if (!ctx) return;
  const grain = Math.max(0, Math.floor(finite(textureStyle?.grain, 10)));
  const grainAlpha = Math.max(0, Math.min(0.35, finite(textureStyle?.grainAlpha, 0.10)));
  const speckCount = Math.max(0, Math.floor(finite(textureStyle?.speckCount, 3)));
  const tuftCount = Math.max(0, Math.floor(finite(textureStyle?.tuftCount, 0)));
  const shadowDelta = finite(textureStyle?.shadowDelta, -12);
  const lightDelta = finite(textureStyle?.lightDelta, 8);
  const shadowRgb = shadeColor(baseRgb, shadowDelta);
  const lightRgb = shadeColor(baseRgb, lightDelta);

  if (hasCtxMethod(ctx, 'createLinearGradient')) {
    const gradient = ctx.createLinearGradient(cx - halfW * 0.45, cy - halfH * 0.95, cx + halfW * 0.55, cy + halfH * 0.65);
    if (gradient && typeof gradient.addColorStop === 'function') {
      gradient.addColorStop(0, rgbCss(lightRgb, 0.95));
      gradient.addColorStop(0.52, rgbCss(baseRgb, 0.97));
      gradient.addColorStop(1, rgbCss(shadowRgb, 0.98));
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  for (let i = 0; i < grain; i += 1) {
    const n = terrainNoise(cell.tx * 1.73 + i * 0.53, cell.ty * 0.93 + i * 1.27);
    const n2 = terrainNoise(cell.tx * 0.79 + i * 1.11, cell.ty * 1.39 + i * 0.67);
    const n3 = terrainNoise(cell.tx * 1.19 + i * 0.41, cell.ty * 1.07 + i * 0.83);
    const px = cx - (halfW * 0.52) + (n * halfW * 1.04);
    const py = cy - (halfH * 0.48) + (n2 * halfH * 0.96);
    const dotRgb = n3 > 0.55 ? lightRgb : shadowRgb;
    ctx.fillStyle = rgbCss(dotRgb, grainAlpha * (0.7 + n2 * 0.6));
    if (hasCtxMethod(ctx, 'fillRect')) {
      const size = n3 > 0.8 ? 2 : 1;
      ctx.fillRect(Math.round(px), Math.round(py), size, size);
    } else {
      ctx.beginPath();
      ctx.moveTo(Math.round(px), Math.round(py));
      ctx.lineTo(Math.round(px + 1), Math.round(py));
      ctx.lineTo(Math.round(px + 1), Math.round(py + 1));
      ctx.closePath();
      ctx.fill();
    }
  }

  for (let i = 0; i < speckCount; i += 1) {
    const n = terrainNoise(cell.tx * 0.61 + i * 0.97, cell.ty * 1.41 + i * 0.37);
    const n2 = terrainNoise(cell.tx * 1.21 + i * 0.57, cell.ty * 0.69 + i * 1.13);
    const px = cx - (halfW * 0.46) + (n * halfW * 0.92);
    const py = cy - (halfH * 0.44) + (n2 * halfH * 0.88);
    const color = n2 > 0.5 ? shadowRgb : lightRgb;
    ctx.fillStyle = rgbCss(color, 0.12);
    if (hasCtxMethod(ctx, 'fillRect')) {
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    } else {
      ctx.beginPath();
      ctx.moveTo(Math.round(px), Math.round(py));
      ctx.lineTo(Math.round(px + 1), Math.round(py));
      ctx.lineTo(Math.round(px + 1), Math.round(py + 1));
      ctx.closePath();
      ctx.fill();
    }
  }

  if (tuftCount > 0) {
    for (let i = 0; i < tuftCount; i += 1) {
      drawGrassTufts(ctx, { tx: cell.tx + (i * 0.13), ty: cell.ty + (i * 0.17) }, cx, cy, halfW, halfH, 1);
    }
  }
}

function pickGroundSpriteForBiome(biome, variants, tx, ty) {
  if (!variants || typeof variants !== 'object') return null;
  const BIOME = CONST.BIOME || {};
  let pool = null;
  if (biome === BIOME.SHORE) pool = variants.shore;
  else if (biome === BIOME.FOREST) pool = variants.forest || variants.plains;
  else if (biome === BIOME.HILLS) pool = variants.hills || variants.plains;
  else if (biome === BIOME.MOUNTAIN) pool = variants.mountain || variants.hills || variants.plains;
  else if (biome === BIOME.SNOW) pool = variants.snow || variants.hills || variants.plains;
  else if (biome === BIOME.PLAINS) pool = variants.plains;
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const n = terrainNoise((finite(tx, 0) * 0.57) + finite(biome, 0) * 1.91, (finite(ty, 0) * 0.83) + finite(biome, 0) * 0.77);
  const idx = Math.max(0, Math.min(pool.length - 1, Math.floor(n * pool.length)));
  return pool[idx] || null;
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function lerpPoint(a, b, t) {
  return [
    a[0] + ((b[0] - a[0]) * t),
    a[1] + ((b[1] - a[1]) * t),
  ];
}

function drawTransitionPolygon(ctx, cx, cy, points, rgb, alpha) {
  if (!ctx || !Array.isArray(points) || points.length < 3) return;
  if (!Number.isFinite(alpha) || alpha <= 0) return;
  ctx.beginPath();
  points.forEach((p, i) => {
    const px = cx + p[0];
    const py = cy + p[1];
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = rgbCss(rgb, alpha);
  ctx.fill();
}

function collectTransitionNeighbors(tx, ty, mask, mapWidth, mapHeight, resolveBiomeAt) {
  if (!mask || typeof resolveBiomeAt !== 'function') return null;
  const neighbors = {};
  for (const dir of TRANSITION_DIRECTIONS) {
    if (!(mask & dir.bit)) continue;
    const nx = tx + dir.dx;
    const ny = ty + dir.dy;
    if (nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) continue;
    neighbors[dir.key] = resolveBiomeAt(nx, ny);
  }
  return Object.keys(neighbors).length ? neighbors : null;
}

export function computeCoastlineMask({
  tx,
  ty,
  mapWidth,
  mapHeight,
  resolveBiomeAt,
  centerBiome,
} = {}) {
  if (typeof resolveBiomeAt !== 'function') return 0;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return 0;
  if (!Number.isFinite(mapWidth) || !Number.isFinite(mapHeight)) return 0;
  if (mapWidth <= 0 || mapHeight <= 0) return 0;

  const SEA = Number(CONST.BIOME?.SEA ?? 0);
  const SHORE = Number(CONST.BIOME?.SHORE ?? 1);
  const center = Number.isFinite(centerBiome) ? centerBiome : resolveBiomeAt(tx, ty);
  if (!Number.isFinite(center)) return 0;
  if (center !== SEA && center !== SHORE) return 0;

  let mask = 0;
  for (const dir of TRANSITION_DIRECTIONS) {
    if (!dir.cardinal) continue;
    const nx = tx + dir.dx;
    const ny = ty + dir.dy;
    if (nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) continue;
    const neighbor = resolveBiomeAt(nx, ny);
    if (!Number.isFinite(neighbor)) continue;
    if ((center === SHORE && neighbor === SEA) || (center === SEA && neighbor === SHORE)) {
      mask |= dir.bit;
    }
  }
  return mask;
}

function drawCellCoastline(ctx, cell, cx, cy, halfW, halfH) {
  const mask = Number(cell?.coastlineMask) || 0;
  if (!mask) return;

  const isSea = Number(cell?.biome) === Number(CONST.BIOME?.SEA ?? 0);
  const darkColor = isSea ? 'rgba(40,72,108,0.26)' : 'rgba(92,78,52,0.32)';
  const brightColor = isSea ? 'rgba(222,238,252,0.36)' : 'rgba(214,190,150,0.30)';
  const darkWidth = isSea ? 1.3 : 1.2;
  const brightWidth = isSea ? 0.8 : 0.7;

  const top = [cx, cy - halfH];
  const right = [cx + halfW, cy];
  const bottom = [cx, cy + halfH];
  const left = [cx - halfW, cy];

  const drawEdge = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = darkWidth;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = brightColor;
    ctx.lineWidth = brightWidth;
    ctx.stroke();
  };

  if (mask & TRANSITION_BITS.N) drawEdge(top, right);
  if (mask & TRANSITION_BITS.E) drawEdge(right, bottom);
  if (mask & TRANSITION_BITS.S) drawEdge(bottom, left);
  if (mask & TRANSITION_BITS.W) drawEdge(left, top);
}

function drawCellTransitions(ctx, cell, cx, cy, halfW, halfH, groundStylePreset = 'stronghold') {
  const mask = Number(cell?.transitionMask) || 0;
  if (!mask || !cell?.transitionNeighbors) return;

  const top = [0, -halfH];
  const right = [halfW, 0];
  const bottom = [0, halfH];
  const left = [-halfW, 0];
  const center = [0, 0];
  const edgeT = 0.56;
  const cornerNear = 0.24;
  const cornerFar = 0.76;
  const neighbors = cell.transitionNeighbors;

  const draw = (points, key, alpha, shadeDelta = 0) => {
    const biome = neighbors?.[key];
    if (!Number.isFinite(biome)) return;
    const color = shadeColor(biomeBaseRgb(biome, groundStylePreset), shadeDelta);
    drawTransitionPolygon(ctx, cx, cy, points, color, alpha);
  };

  safeCtxSave(ctx);
  drawDiamondPath(ctx, cx, cy, halfW, halfH);
  safeCtxClip(ctx);

  if (mask & TRANSITION_BITS.N) {
    draw([top, lerpPoint(top, right, edgeT), lerpPoint(top, left, edgeT)], 'N', 0.18, -4);
  }
  if (mask & TRANSITION_BITS.E) {
    draw([right, lerpPoint(right, bottom, edgeT), lerpPoint(right, top, edgeT)], 'E', 0.16, -4);
  }
  if (mask & TRANSITION_BITS.S) {
    draw([bottom, lerpPoint(bottom, left, edgeT), lerpPoint(bottom, right, edgeT)], 'S', 0.14, -5);
  }
  if (mask & TRANSITION_BITS.W) {
    draw([left, lerpPoint(left, top, edgeT), lerpPoint(left, bottom, edgeT)], 'W', 0.16, -4);
  }
  if (mask & TRANSITION_BITS.NE) {
    draw([center, lerpPoint(top, right, cornerNear), lerpPoint(top, right, cornerFar)], 'NE', 0.11, -6);
  }
  if (mask & TRANSITION_BITS.SE) {
    draw([center, lerpPoint(bottom, right, cornerNear), lerpPoint(bottom, right, cornerFar)], 'SE', 0.10, -6);
  }
  if (mask & TRANSITION_BITS.SW) {
    draw([center, lerpPoint(bottom, left, cornerNear), lerpPoint(bottom, left, cornerFar)], 'SW', 0.10, -6);
  }
  if (mask & TRANSITION_BITS.NW) {
    draw([center, lerpPoint(top, left, cornerNear), lerpPoint(top, left, cornerFar)], 'NW', 0.11, -6);
  }

  safeCtxRestore(ctx);
}

export function computeDimetricVisibleTileBounds({
  camera,
  canvas,
  config,
  mapWidth,
  mapHeight,
  paddingTiles = 2,
} = {}) {
  if (!camera || !canvas || !config) return null;
  const width = Math.max(1, Math.floor(finite(mapWidth, 1)));
  const height = Math.max(1, Math.floor(finite(mapHeight, 1)));
  const zoom = Math.max(0.01, finite(camera.zoom, 1));
  const pad = Math.max(
    finite(config.tileW, 64),
    finite(config.tileH, 32),
  ) * Math.max(0, finite(paddingTiles, 2));
  const corners = [
    { x: -pad, y: -pad },
    { x: finite(canvas.width, 1) + pad, y: -pad },
    { x: finite(canvas.width, 1) + pad, y: finite(canvas.height, 1) + pad },
    { x: -pad, y: finite(canvas.height, 1) + pad },
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const corner of corners) {
    const world = screenToWorld(corner.x, corner.y, camera, config, 0);
    minX = Math.min(minX, world.tileX);
    minY = Math.min(minY, world.tileY);
    maxX = Math.max(maxX, world.tileX);
    maxY = Math.max(maxY, world.tileY);
  }

  const tilePad = Math.max(1, Math.ceil((pad / zoom) / Math.max(1, finite(config.tileH, 32))));
  return {
    minX: clampInt(Math.floor(minX) - tilePad, 0, width - 1),
    minY: clampInt(Math.floor(minY) - tilePad, 0, height - 1),
    maxX: clampInt(Math.ceil(maxX) + tilePad, 0, width - 1),
    maxY: clampInt(Math.ceil(maxY) + tilePad, 0, height - 1),
  };
}

export class DimetricTerrainChunkCache {
  constructor({
    chunkSize = 16,
    maxChunks = 192,
    groundStylePreset = 'stronghold',
    groundSpriteVariants = null,
    canvasFactory = defaultCanvasFactory,
  } = {}) {
    this.chunkSize = Math.max(4, Math.floor(finite(chunkSize, 16)));
    this.maxChunks = Math.max(2, Math.floor(finite(maxChunks, 192)));
    this._groundStylePreset = normalizeGroundStylePreset(groundStylePreset);
    this._groundSpriteVariants = groundSpriteVariants && typeof groundSpriteVariants === 'object'
      ? groundSpriteVariants
      : null;
    this.canvasFactory = typeof canvasFactory === 'function' ? canvasFactory : defaultCanvasFactory;
    this._chunks = new Map();
    this._tick = 0;
    this._mapRef = null;
    this._tileW = 64;
    this._tileH = 32;
  }

  clear() {
    this._chunks.clear();
    this._tick = 0;
  }

  configure({
    map,
    tileW = 64,
    tileH = 32,
    chunkSize = this.chunkSize,
    maxChunks = this.maxChunks,
    groundStylePreset = this._groundStylePreset,
    groundSpriteVariants = this._groundSpriteVariants,
  } = {}) {
    const safeTileW = Math.max(2, finite(tileW, 64));
    const safeTileH = Math.max(2, finite(tileH, 32));
    const safeChunkSize = Math.max(4, Math.floor(finite(chunkSize, this.chunkSize)));
    const safeMaxChunks = Math.max(2, Math.floor(finite(maxChunks, this.maxChunks)));
    const safeGroundPreset = normalizeGroundStylePreset(groundStylePreset);
    const safeGroundSprites = groundSpriteVariants && typeof groundSpriteVariants === 'object'
      ? groundSpriteVariants
      : null;
    const needsReset = this._mapRef !== map
      || this._tileW !== safeTileW
      || this._tileH !== safeTileH
      || this.chunkSize !== safeChunkSize
      || this.maxChunks !== safeMaxChunks
      || this._groundStylePreset !== safeGroundPreset
      || this._groundSpriteVariants !== safeGroundSprites;
    if (needsReset) this.clear();
    this._mapRef = map;
    this._tileW = safeTileW;
    this._tileH = safeTileH;
    this.chunkSize = safeChunkSize;
    this.maxChunks = safeMaxChunks;
    this._groundStylePreset = safeGroundPreset;
    this._groundSpriteVariants = safeGroundSprites;
  }

  getChunk({
    chunkX,
    chunkY,
    mapWidth,
    mapHeight,
    resolveBiomeAt,
  } = {}) {
    if (!this._mapRef || typeof resolveBiomeAt !== 'function') return null;
    const key = chunkKey(chunkX, chunkY);
    const cached = this._chunks.get(key);
    if (cached) {
      cached.lastUsed = ++this._tick;
      return cached;
    }
    const built = this._buildChunk({
      chunkX: Math.floor(finite(chunkX, 0)),
      chunkY: Math.floor(finite(chunkY, 0)),
      mapWidth: Math.max(1, Math.floor(finite(mapWidth, 1))),
      mapHeight: Math.max(1, Math.floor(finite(mapHeight, 1))),
      resolveBiomeAt,
    });
    if (!built) return null;
    built.lastUsed = ++this._tick;
    this._chunks.set(key, built);
    this._evictIfNeeded();
    return built;
  }

  getStats() {
    return {
      chunkCount: this._chunks.size,
      chunkSize: this.chunkSize,
      maxChunks: this.maxChunks,
      groundStylePreset: this._groundStylePreset,
      groundSpritesEnabled: Boolean(this._groundSpriteVariants),
    };
  }

  _evictIfNeeded() {
    while (this._chunks.size > this.maxChunks) {
      let oldestKey = null;
      let oldestTick = Infinity;
      for (const [key, value] of this._chunks.entries()) {
        if (value.lastUsed < oldestTick) {
          oldestTick = value.lastUsed;
          oldestKey = key;
        }
      }
      if (oldestKey === null) break;
      this._chunks.delete(oldestKey);
    }
  }

  _buildChunk({
    chunkX,
    chunkY,
    mapWidth,
    mapHeight,
    resolveBiomeAt,
  }) {
    const startX = chunkX * this.chunkSize;
    const startY = chunkY * this.chunkSize;
    const endX = Math.min(mapWidth - 1, startX + this.chunkSize - 1);
    const endY = Math.min(mapHeight - 1, startY + this.chunkSize - 1);
    if (startX > endX || startY > endY) return null;

    const halfW = this._tileW * 0.5;
    const halfH = this._tileH * 0.5;
    const cells = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const isoX = (tx - ty) * halfW;
        const isoY = (tx + ty) * halfH;
        const biome = resolveBiomeAt(tx, ty);
        const transitionMask = computeTransitionMask({
          tx,
          ty,
          mapWidth,
          mapHeight,
          resolveBiomeAt,
          centerBiome: biome,
        });
        const transitionNeighbors = collectTransitionNeighbors(
          tx,
          ty,
          transitionMask,
          mapWidth,
          mapHeight,
          resolveBiomeAt,
        );
        const coastlineMask = computeCoastlineMask({
          tx,
          ty,
          mapWidth,
          mapHeight,
          resolveBiomeAt,
          centerBiome: biome,
        });
        minX = Math.min(minX, isoX - halfW);
        minY = Math.min(minY, isoY - halfH);
        maxX = Math.max(maxX, isoX + halfW);
        maxY = Math.max(maxY, isoY + halfH);
        cells.push({
          tx,
          ty,
          isoX,
          isoY,
          biome,
          transitionMask,
          transitionNeighbors,
          coastlineMask,
        });
      }
    }
    if (cells.length === 0) return null;

    const padding = 2;
    const baseX = Math.floor(minX - padding);
    const baseY = Math.floor(minY - padding);
    const width = Math.max(1, Math.ceil((maxX - minX) + (padding * 2) + 1));
    const height = Math.max(1, Math.ceil((maxY - minY) + (padding * 2) + 1));
    const canvas = this.canvasFactory(width, height);
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return null;
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    const groundPreset = normalizeGroundStylePreset(this._groundStylePreset);

    cells.sort((a, b) => (a.isoY - b.isoY) || (a.isoX - b.isoX));
    for (const cell of cells) {
      const cx = cell.isoX - baseX;
      const cy = cell.isoY - baseY;
      const base = biomeBaseRgb(cell.biome, groundPreset);
      const textureStyle = resolveBiomeTextureStyle(cell.biome);
      const noise = terrainNoise(cell.tx, cell.ty);
      const fill = shadeColor(base, (noise - 0.5) * 14);
      const edge = shadeColor(base, -20);
      const groundSprite = pickGroundSpriteForBiome(cell.biome, this._groundSpriteVariants, cell.tx, cell.ty);
      const canDrawSprite = Boolean(groundSprite && hasCtxMethod(ctx, 'drawImage'));

      if (canDrawSprite) {
        const sh = Math.max(1, finite(groundSprite.height, this._tileH));
        const dx = Math.round(cx - halfW);
        const dy = Math.round(cy + halfH - sh);
        ctx.drawImage(groundSprite, dx, dy, this._tileW, sh);
        // Keep biome tint influence so all tiles still match world palette.
        safeCtxSave(ctx);
        drawDiamondPath(ctx, cx, cy, halfW, halfH);
        safeCtxClip(ctx);
        if (hasCtxMethod(ctx, 'fillRect')) {
          ctx.fillStyle = rgbCss(shadeColor(base, (noise - 0.5) * 10), 0.20);
          ctx.fillRect(dx, Math.round(cy - halfH), this._tileW, this._tileH + 3);
        }
        safeCtxRestore(ctx);
      } else {
        drawDiamondPath(ctx, cx, cy, halfW, halfH);
        ctx.fillStyle = rgbCss(fill);
        ctx.fill();
        safeCtxSave(ctx);
        drawDiamondPath(ctx, cx, cy, halfW, halfH);
        safeCtxClip(ctx);
        drawCellTexture(ctx, cell, cx, cy, halfW, halfH, fill, textureStyle);
        safeCtxRestore(ctx);
      }
      drawCellTransitions(ctx, cell, cx, cy, halfW, halfH, groundPreset);
      drawCellCoastline(ctx, cell, cx, cy, halfW, halfH);
      ctx.strokeStyle = rgbCss(edge, 0.38);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    return {
      chunkX,
      chunkY,
      canvas,
      width,
      height,
      baseX,
      baseY,
    };
  }
}
