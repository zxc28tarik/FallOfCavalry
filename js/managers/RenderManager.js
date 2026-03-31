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
import { applySettlementModifierStack, buildSettlementStyleSpec, settlementStyleCacheKey } from '../rendering/settlement-style.js';
import SpriteLoader from '../rendering/sprite-loader.js';
import h3MapArt from '../data/homm3-map-art.json';
import { screenToWorldPrecise, worldToScreen } from '../rendering/dimetric/projection.js';
import { drawDimetricWireframe, runWireframeRoundTripSuite } from '../rendering/dimetric/wireframe.js';
import { sortByScreenBottomY } from '../rendering/dimetric/depth-sort.js';
import {
  buildDimetricCameraConfig,
  resolveDimetricPropStyleProfile,
  resolveDimetricWireframeEnabled,
  resolveProjectionMode,
} from '../rendering/dimetric/view-config.js';
import { computeDimetricVisibleTileBounds, DimetricTerrainChunkCache } from '../rendering/dimetric/terrain-chunk-cache.js';
import { getDimetricSettlementFootprint } from '../rendering/dimetric/settlement-footprints.js';
import { DimetricPerformanceManager } from '../rendering/dimetric/performance-manager.js';
import { styleDimetricPropPixels } from '../rendering/dimetric/prop-style.js';
import { getBuildingDef } from '../data/building-defs.js';
import { resolveWallVariant } from '../rendering/dimetric/wall-auto-tile.js';
import {
  createRiverBands,
  createRoadBands,
  drawCrossingMarker,
  drawPolylineBands,
  pathIntersectsTileBounds,
  projectTilePath,
} from '../rendering/dimetric/path-layer.js';
import {
  getDimetricWaterShimmerStrength,
  getDimetricWaterShimmerStride,
  renderDimetricAtmosphereOverlay,
  resolveDimetricAtmosphere,
} from '../rendering/dimetric/atmosphere-layer.js';
import {
  drawDimetricUnitSprite,
  estimateDimetricUnitBodyBounds,
  getDimetricUnitAnimState,
  getDimetricUnitDetailLevel,
  getDimetricUnitFrameIndex,
  resolveDimetricUnitDirection,
} from '../rendering/dimetric/unit-sprite.js';
import {
  resolveDimetricNatureVariant,
  sampleDimetricGroundDecal,
} from '../rendering/dimetric/nature-layer.js';
import {
  getDimetricAmbientParticleBudget,
  getDimetricWeatherParticleBudget,
  sampleDimetricSmokePuff,
  sampleDimetricWeatherParticle,
} from '../rendering/dimetric/ambient-particles.js';

const FORT_MAIN_SPRITE_URL = new URL('../../assets/settlements/fort-main-game.png', import.meta.url).href;
const STRONGHOLD_FORT_WALL_FRONT_URL = new URL('../../assets/settlements/stronghold/wall-front.png', import.meta.url).href;
const STRONGHOLD_FORT_WALL_LEFT_URL = new URL('../../assets/settlements/stronghold/wall-left.png', import.meta.url).href;
const STRONGHOLD_FORT_WALL_RIGHT_URL = new URL('../../assets/settlements/stronghold/wall-right.png', import.meta.url).href;
const STRONGHOLD_FORT_WALL_PLAIN_URL = new URL('../../assets/settlements/stronghold/wall-plain.png', import.meta.url).href;
const STRONGHOLD_FORT_TOWER_LEFT_URL = new URL('../../assets/settlements/stronghold/tower-left.png', import.meta.url).href;
const STRONGHOLD_FORT_TOWER_RIGHT_URL = new URL('../../assets/settlements/stronghold/tower-right.png', import.meta.url).href;
const STRONGHOLD_WALL_ONLY_COMPOSITE_URL = new URL('../../assets/settlements/stronghold/wall-only-composite.png', import.meta.url).href;
const STRONGHOLD_GROUND_LAND8_URLS = Object.freeze([
  new URL('../../assets/stronghold/world/ground/tile_land8_001.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land8_020.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land8_040.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land8_060.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land8_090.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land8_120.png', import.meta.url).href,
]);
const STRONGHOLD_GROUND_LAND3_URLS = Object.freeze([
  new URL('../../assets/stronghold/world/ground/tile_land3_001.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land3_050.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/ground/tile_land3_120.png', import.meta.url).href,
]);
const STRONGHOLD_TREE_URLS = Object.freeze([
  new URL('../../assets/stronghold/world/trees/tree_pine_42.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_pine_73.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_pine_103.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_pine_127.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_pine_138.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_birch_35.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_birch_54.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_oak_41.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_chestnut_44.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_shrub1_20.png', import.meta.url).href,
  new URL('../../assets/stronghold/world/trees/tree_shrub2_17.png', import.meta.url).href,
]);
const CUSTOM_SETTLEMENT_SPRITE_BASE = '/assets/settlements/generated';

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
const _PROP_STYLE_CACHE = new Map();
const _SETTLEMENT_IMAGE_CACHE = new Map();
const _SETTLEMENT_IMAGE_RENDER_CACHE = new WeakMap();

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

function _getImageAsset(url, assetKey = '') {
  if (!url || typeof Image === 'undefined') return null;
  const key = `${assetKey || 'img'}:${url}`;
  const cached = _SETTLEMENT_IMAGE_CACHE.get(key);
  if (cached?.state === 'loaded' && cached.img?.complete && cached.img.naturalWidth > 0) return cached.img;
  if (cached?.state === 'loading' || cached?.state === 'error') return null;

  const img = new Image();
  img.decoding = 'async';
  if (assetKey) img._codexSettlementAsset = assetKey;
  _SETTLEMENT_IMAGE_CACHE.set(key, { state: 'loading', img });
  img.onload = () => _SETTLEMENT_IMAGE_CACHE.set(key, { state: 'loaded', img });
  img.onerror = () => _SETTLEMENT_IMAGE_CACHE.set(key, { state: 'error', img: null });
  img.src = url;
  return null;
}

function _slugToken(input, fallback = 'bandit') {
  const token = String(input || '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '');
  return token || fallback;
}

function _customSettlementSpriteCandidates(type, factionId) {
  const safeType = _slugToken(type, 'village');
  const safeFaction = _slugToken(factionId, 'bandit');
  return [
    `${CUSTOM_SETTLEMENT_SPRITE_BASE}/factions/${safeFaction}/${safeType}.png`,
    `${CUSTOM_SETTLEMENT_SPRITE_BASE}/${safeFaction}-${safeType}.png`,
    `${CUSTOM_SETTLEMENT_SPRITE_BASE}/${safeType}.png`,
  ];
}

function _getCustomSettlementSprite(type, factionId) {
  const candidates = _customSettlementSpriteCandidates(type, factionId);
  for (let i = 0; i < candidates.length; i += 1) {
    const url = candidates[i];
    const assetKey = `settlement-custom:${factionId || 'bandit'}:${type || 'village'}:${i}`;
    const img = _getImageAsset(url, assetKey);
    if (img) {
      img._codexSettlementAsset = 'settlement-custom';
      return img;
    }
  }
  return null;
}

function _isFortAssetSprite(sprite) {
  return Boolean(sprite && (
    sprite._codexSettlementAsset === 'fort-main'
    || sprite._codexSettlementAsset === 'fort-stronghold'
    || sprite._codexSettlementAsset === 'fort-wall-only'
  ));
}

function _getStrongholdFortTextures() {
  const front = _getImageAsset(STRONGHOLD_FORT_WALL_FRONT_URL, 'fort-sh-front');
  const left = _getImageAsset(STRONGHOLD_FORT_WALL_LEFT_URL, 'fort-sh-left');
  const right = _getImageAsset(STRONGHOLD_FORT_WALL_RIGHT_URL, 'fort-sh-right');
  const plain = _getImageAsset(STRONGHOLD_FORT_WALL_PLAIN_URL, 'fort-sh-plain');
  const towerLeft = _getImageAsset(STRONGHOLD_FORT_TOWER_LEFT_URL, 'fort-sh-tl');
  const towerRight = _getImageAsset(STRONGHOLD_FORT_TOWER_RIGHT_URL, 'fort-sh-tr');
  if (!front || !left || !right || !plain || !towerLeft || !towerRight) return null;
  return { front, left, right, plain, towerLeft, towerRight };
}

function _getStrongholdGroundSpriteVariants() {
  const plains = STRONGHOLD_GROUND_LAND8_URLS
    .map((url, idx) => _getImageAsset(url, `sh-ground-land8-${idx}`))
    .filter(Boolean);
  const rough = STRONGHOLD_GROUND_LAND3_URLS
    .map((url, idx) => _getImageAsset(url, `sh-ground-land3-${idx}`))
    .filter(Boolean);
  if (!plains.length && !rough.length) return null;
  return {
    plains,
    forest: plains,
    hills: plains,
    shore: rough.length ? rough : plains,
    mountain: rough.length ? rough : plains,
    snow: rough.length ? rough : plains,
  };
}

function _getStrongholdTreeSprites() {
  const trees = STRONGHOLD_TREE_URLS
    .map((url, idx) => _getImageAsset(url, `sh-tree-${idx}`))
    .filter(Boolean);
  if (!trees.length) return null;
  return trees;
}

function _polygonBounds(points) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function _clipPolygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function _drawTexturedPolygon(ctx, img, points, opts = {}) {
  if (!img || !points?.length) return;
  const { alpha = 1, outline = null, inset = 0 } = opts;
  const pts = inset
    ? points.map(([x, y], i) => {
        const px = points[(i - 1 + points.length) % points.length];
        const nx = points[(i + 1) % points.length];
        const dx = ((px[0] + nx[0]) * 0.5 - x) * inset;
        const dy = ((px[1] + nx[1]) * 0.5 - y) * inset;
        return [x + dx, y + dy];
      })
    : points;
  const box = _polygonBounds(pts);
  ctx.save();
  ctx.globalAlpha *= alpha;
  _clipPolygon(ctx, pts);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(box.minX), Math.round(box.minY), Math.round(box.w), Math.round(box.h));
  ctx.restore();
  if (outline) {
    ctx.save();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    _clipPolygon(ctx, pts);
    ctx.stroke();
    ctx.restore();
  }
}

function _drawSettlementMasonryOverlay(ctx, x, y, w, h, pal, seed = 0, alpha = 0.26, options = {}) {
  const sx = Math.round(x);
  const sy = Math.round(y);
  const sw = Math.max(1, Math.round(w));
  const sh = Math.max(1, Math.round(h));
  const rowH = Math.max(3, Math.round(options.rowH || 4));
  const jointStep = Math.max(4, Math.round(options.jointStep || 6));
  const jointHeight = Math.max(2, Math.round(options.jointHeight || 3));
  const startInset = Math.max(1, Math.round(options.startInset || 2));
  const topOffset = Math.max(2, Math.round(options.topOffset || 3));
  ctx.save();
  ctx.globalAlpha *= alpha;
  _settlementSpriteRect(ctx, pal.stoneMid, sx, sy, sw, sh);
  ctx.globalAlpha *= 0.76;
  _settlementSpriteDither(ctx, sx, sy, sw, sh, pal.stoneLight, pal.stoneDark, seed & 15);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha *= alpha * 0.92;
  for (let yy = sy + topOffset; yy < sy + sh - 1; yy += rowH) {
    _settlementSpriteRect(ctx, pal.stoneDark, sx, yy, sw, 1);
    const offset = (((yy - sy) / rowH + seed) & 1) ? 2 : 0;
    for (let xx = sx + startInset + offset; xx < sx + sw - startInset; xx += jointStep) {
      _settlementSpriteRect(ctx, pal.stoneLight, xx, yy - (jointHeight - 1), 1, jointHeight);
    }
  }
  ctx.restore();
}

function _drawSettlementMasonryPolygon(ctx, points, pal, seed = 0, alpha = 0.18) {
  const box = _polygonBounds(points);
  ctx.save();
  _clipPolygon(ctx, points);
  ctx.clip();
  _drawSettlementMasonryOverlay(ctx, box.minX, box.minY, box.w, box.h, pal, seed, alpha);
  ctx.restore();
}

function _drawStrongholdFortSprite(ctx, textures, factionColor, pal, w, h) {
  const topStone = _hexShade(pal.stoneLight, 0.14);
  const topStoneShade = _hexShade(pal.stoneMid, 0.06);
  const topStroke = 'rgba(72,56,36,0.62)';
  const wallOutline = 'rgba(44,34,24,0.82)';
  const shadow = 'rgba(0,0,0,0.18)';
  const fillPoly = (points, fill, stroke = topStroke) => {
    ctx.save();
    ctx.fillStyle = fill;
    _clipPolygon(ctx, points);
    ctx.fill();
    ctx.restore();
    if (stroke) {
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      _clipPolygon(ctx, points);
      ctx.stroke();
      ctx.restore();
    }
  };
  const addY = (p, dy) => [p[0], p[1] + dy];
  const drawCrenelLine = (a, b, count = 6, size = 2) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = Math.round(a[0] + (b[0] - a[0]) * t);
      const y = Math.round(a[1] + (b[1] - a[1]) * t);
      _settlementSpriteRect(ctx, '#ddd2b7', x - Math.floor(size * 0.5), y - size, size, size);
      _settlementSpriteRect(ctx, '#7d6a4e', x - Math.floor(size * 0.5), y, size, 1);
    }
  };
  const drawIsoBlock = ({
    x,
    y,
    fw,
    depth,
    fh,
    frontTex = textures.plain,
    seed = 0,
    crenels = 3,
    flag = false,
  }) => {
    const top = [[x, y], [x + fw, y], [x + fw + depth, y + depth], [x + depth, y + depth]];
    const left = [[x, y], [x + depth, y + depth], [x + depth, y + depth + fh], [x, y + fh]];
    const right = [[x + fw, y], [x + fw + depth, y + depth], [x + fw + depth, y + depth + fh], [x + fw, y + fh]];
    const front = [[x + depth, y + depth], [x + fw + depth, y + depth], [x + fw + depth, y + depth + fh], [x + depth, y + depth + fh]];

    _drawTexturedPolygon(ctx, textures.left, left, { outline: wallOutline });
    _drawSettlementMasonryPolygon(ctx, left, pal, seed + 1, 0.18);
    _drawTexturedPolygon(ctx, textures.right, right, { outline: wallOutline });
    _drawSettlementMasonryPolygon(ctx, right, pal, seed + 3, 0.18);
    _drawTexturedPolygon(ctx, frontTex, front, { outline: wallOutline });
    _drawSettlementMasonryPolygon(ctx, front, pal, seed + 5, 0.24);
    fillPoly(top, topStone);
    drawCrenelLine(top[0], top[1], crenels, 2);
    drawCrenelLine(top[3], top[2], crenels, 2);
    drawCrenelLine(top[0], top[3], Math.max(2, crenels - 1), 2);
    drawCrenelLine(top[1], top[2], Math.max(2, crenels - 1), 2);
    if (flag) _settlementSpritePennant(ctx, x + fw + depth - 2, y - 6, factionColor);
    return { top, left, right, front };
  };

  const outer = {
    nw: [20, 12],
    ne: [58, 19],
    se: [74, 33],
    sw: [36, 26],
  };
  const innerTop = {
    nw: [28, 18],
    ne: [50, 23],
    se: [58, 29],
    sw: [34, 24],
  };
  const court = {
    nw: [30, 22],
    ne: [48, 26],
    se: [55, 31],
    sw: [37, 27],
  };
  const wallH = 15;
  const outerBase = {
    nw: addY(outer.nw, wallH),
    ne: addY(outer.ne, wallH),
    se: addY(outer.se, wallH),
    sw: addY(outer.sw, wallH),
  };

  const backFace = [outer.nw, outer.ne, outerBase.ne, outerBase.nw];
  const leftFace = [outer.nw, outer.sw, outerBase.sw, outerBase.nw];
  const rightFace = [outer.ne, outer.se, outerBase.se, outerBase.ne];
  const frontFace = [outer.sw, outer.se, outerBase.se, outerBase.sw];

  const topBack = [outer.nw, outer.ne, innerTop.ne, innerTop.nw];
  const topLeft = [outer.nw, innerTop.nw, innerTop.sw, outer.sw];
  const topRight = [innerTop.ne, outer.ne, outer.se, innerTop.se];
  const topFront = [innerTop.sw, innerTop.se, outer.se, outer.sw];

  const innerBackFace = [innerTop.nw, innerTop.ne, court.ne, court.nw];
  const innerLeftFace = [innerTop.nw, innerTop.sw, court.sw, court.nw];
  const innerRightFace = [innerTop.ne, innerTop.se, court.se, court.ne];
  const innerFrontFace = [innerTop.sw, innerTop.se, court.se, court.sw];

  ctx.fillStyle = shadow;
  ctx.beginPath();
  _ellipse(ctx, Math.round(w * 0.5), Math.round(h * 0.86), Math.round(w * 0.36), Math.round(h * 0.08), 0, 0, Math.PI * 2);
  ctx.fill();

  fillPoly([court.nw, court.ne, court.se, court.sw], _hexShade(pal.pathLight, 0.00), 'rgba(90,68,40,0.34)');
  ctx.save();
  _clipPolygon(ctx, [court.nw, court.ne, court.se, court.sw]);
  ctx.clip();
  ctx.strokeStyle = 'rgba(90,68,40,0.16)';
  ctx.lineWidth = 1;
  for (let yy = court.nw[1] + 2; yy < court.sw[1] + 3; yy += 5) {
    ctx.beginPath();
    ctx.moveTo(court.sw[0] + 3, yy);
    ctx.lineTo(court.se[0] - 3, yy - 3);
    ctx.stroke();
  }
  ctx.restore();

  _drawTexturedPolygon(ctx, textures.plain, backFace, { outline: wallOutline });
  _drawSettlementMasonryPolygon(ctx, backFace, pal, 3, 0.22);
  _drawTexturedPolygon(ctx, textures.left, leftFace, { outline: wallOutline });
  _drawSettlementMasonryPolygon(ctx, leftFace, pal, 5, 0.22);
  _drawTexturedPolygon(ctx, textures.right, rightFace, { outline: wallOutline });
  _drawSettlementMasonryPolygon(ctx, rightFace, pal, 7, 0.22);
  _drawTexturedPolygon(ctx, textures.front, frontFace, { outline: wallOutline });
  _drawSettlementMasonryPolygon(ctx, frontFace, pal, 9, 0.26);

  _drawTexturedPolygon(ctx, textures.plain, innerBackFace, { outline: 'rgba(56,44,30,0.62)', alpha: 0.96 });
  _drawSettlementMasonryPolygon(ctx, innerBackFace, pal, 11, 0.14);
  _drawTexturedPolygon(ctx, textures.left, innerLeftFace, { outline: 'rgba(56,44,30,0.62)', alpha: 0.96 });
  _drawSettlementMasonryPolygon(ctx, innerLeftFace, pal, 13, 0.14);
  _drawTexturedPolygon(ctx, textures.right, innerRightFace, { outline: 'rgba(56,44,30,0.62)', alpha: 0.96 });
  _drawSettlementMasonryPolygon(ctx, innerRightFace, pal, 15, 0.14);
  _drawTexturedPolygon(ctx, textures.front, innerFrontFace, { outline: 'rgba(56,44,30,0.62)', alpha: 0.98 });
  _drawSettlementMasonryPolygon(ctx, innerFrontFace, pal, 17, 0.16);

  fillPoly(topBack, topStone);
  fillPoly(topLeft, topStoneShade);
  fillPoly(topRight, topStoneShade);
  fillPoly(topFront, topStone);

  drawCrenelLine(outer.nw, outer.ne, 10, 2);
  drawCrenelLine(outer.nw, outer.sw, 6, 2);
  drawCrenelLine(outer.ne, outer.se, 6, 2);
  drawCrenelLine(outer.sw, outer.se, 11, 2);

  drawIsoBlock({ x: 16, y: 6, fw: 8, depth: 4, fh: 16, seed: 21, crenels: 3 });
  drawIsoBlock({ x: 50, y: 12, fw: 8, depth: 4, fh: 16, seed: 27, crenels: 3 });

  drawIsoBlock({ x: 37, y: 16, fw: 10, depth: 4, fh: 16, frontTex: textures.plain, seed: 31, crenels: 4, flag: true });

  const gatehouse = drawIsoBlock({ x: 35, y: 21, fw: 14, depth: 5, fh: 19, frontTex: textures.front, seed: 37, crenels: 4 });
  const gateFront = gatehouse.front;
  const doorX = Math.round(gateFront[0][0] + (gateFront[1][0] - gateFront[0][0]) * 0.28);
  const doorY = Math.round(gateFront[0][1] + (gateFront[2][1] - gateFront[0][1]) * 0.42);
  const doorW = Math.max(6, Math.round((gateFront[1][0] - gateFront[0][0]) * 0.44));
  const doorH = Math.max(8, Math.round((gateFront[2][1] - gateFront[0][1]) * 0.40));
  _settlementSpriteRect(ctx, '#563420', doorX, doorY, doorW, doorH);
  _spriteDome(ctx, '#372216', '#563420', '#7a563a', doorX + Math.floor(doorW * 0.5), doorY, Math.max(4, Math.round(doorW * 0.48)), Math.max(2, Math.round(doorW * 0.18)));
  _settlementSpriteRect(ctx, '#2a180f', doorX + Math.floor(doorW * 0.48), doorY + 1, 2, Math.max(5, doorH - 1));

  drawIsoBlock({ x: 10, y: 17, fw: 9, depth: 4, fh: 23, seed: 41, crenels: 4 });
  drawIsoBlock({ x: 61, y: 24, fw: 9, depth: 4, fh: 23, seed: 47, crenels: 4 });
}

function _gradeStrongholdFortSprite(ctx, pal, w, h) {
  if (!ctx || !w || !h) return;
  const frame = ctx.getImageData(0, 0, w, h);
  const data = frame.data;
  const source = new Uint8ClampedArray(data);
  const contrast = 1.14;
  const saturation = 0.84;
  const brightness = 0.80;
  const cityStone = _settlementColorTriplet(pal?.stoneMid || '#988b79');
  const sunStone = _settlementColorTriplet(pal?.stoneLight || '#b8ab95');
  const shadowStone = _settlementColorTriplet(_hexShade(pal?.stoneDark || '#65594d', -0.04));
  const earthStone = _settlementColorTriplet(_mixColorCss(pal?.stoneDark || '#65594d', pal?.pathDark || '#6e4f2d', 0.55));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = source[i + 3];
      if (a <= 20) {
        data[i + 3] = 0;
        continue;
      }

      let r = source[i];
      let g = source[i + 1];
      let b = source[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const upperBand = 1 - Math.max(0, Math.min(1, y / Math.max(1, h - 1)));

      r = (luma + (r - luma) * saturation) * brightness;
      g = (luma + (g - luma) * saturation) * brightness;
      b = (luma + (b - luma) * saturation) * brightness;

      const stoneMix = chroma < 70 ? 0.34 : chroma < 92 ? 0.18 : 0.08;
      r = r * (1 - stoneMix) + cityStone[0] * stoneMix;
      g = g * (1 - stoneMix) + cityStone[1] * stoneMix;
      b = b * (1 - stoneMix) + cityStone[2] * stoneMix;

      const sunMix = upperBand * 0.04 + (luma > 144 ? 0.02 : 0);
      r = r * (1 - sunMix) + sunStone[0] * sunMix;
      g = g * (1 - sunMix) + sunStone[1] * sunMix;
      b = b * (1 - sunMix) + sunStone[2] * sunMix;

      if (luma < 118) {
        const shadowMix = Math.min(0.36, (118 - luma) / 150);
        r = r * (1 - shadowMix) + shadowStone[0] * shadowMix;
        g = g * (1 - shadowMix) + shadowStone[1] * shadowMix;
        b = b * (1 - shadowMix) + shadowStone[2] * shadowMix;
      }

      if (y > h * 0.76) {
        const groundMix = Math.max(0, (y / h) - 0.76) * 0.18;
        r = r * (1 - groundMix) + earthStone[0] * groundMix;
        g = g * (1 - groundMix) + earthStone[1] * groundMix;
        b = b * (1 - groundMix) + earthStone[2] * groundMix;
      }

      const leftA = x > 0 ? source[i - 1] : a;
      const rightA = x + 1 < w ? source[i + 7] : a;
      const upA = y > 0 ? source[i - w * 4 + 3] : a;
      const downA = y + 1 < h ? source[i + w * 4 + 3] : a;
      const edgeAlpha = Math.max(
        Math.abs(a - leftA),
        Math.abs(a - rightA),
        Math.abs(a - upA),
        Math.abs(a - downA),
      );
      const edgeBoost = edgeAlpha > 50 ? 0.13 : 0;

      data[i] = _clampByte((((r - 128) * contrast) + 128 - 3) * (1 + edgeBoost));
      data[i + 1] = _clampByte((((g - 128) * contrast) + 128 - 4) * (1 + edgeBoost * 0.9));
      data[i + 2] = _clampByte((((b - 128) * contrast) + 128 - 7) * (1 + edgeBoost * 0.85));
      data[i + 3] = a < 86 ? 0 : (a < 180 ? 244 : 255);
    }
  }

  ctx.putImageData(frame, 0, 0);
}

function _getFortRenderCanvas(img) {
  if (!img || typeof document === 'undefined') return img;
  const cached = _SETTLEMENT_IMAGE_RENDER_CACHE.get(img);
  if (cached) return cached;

  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  if (!w || !h) return img;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas._codexSettlementAsset = 'fort-main';
  const cctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!cctx) return img;

  cctx.imageSmoothingEnabled = true;
  cctx.drawImage(img, 0, 0, w, h);

  const frame = cctx.getImageData(0, 0, w, h);
  const data = frame.data;
  const source = new Uint8ClampedArray(data);
  const contrast = 1.12;
  const saturation = 0.80;
  const brightness = 0.84;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = source[i + 3];
      if (a <= 24) {
        data[i + 3] = 0;
        continue;
      }

      let r = source[i];
      let g = source[i + 1];
      let b = source[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const upperBand = 1 - Math.max(0, Math.min(1, y / Math.max(1, h - 1)));

      r = (luma + (r - luma) * saturation) * brightness;
      g = (luma + (g - luma) * saturation) * brightness;
      b = (luma + (b - luma) * saturation) * brightness;

      const stoneMix = chroma < 54 ? 0.32 : chroma < 78 ? 0.16 : 0.05;
      const cityStone = [156, 150, 137];
      const sunStone = [188, 181, 166];
      const shadowStone = [110, 101, 88];
      const earthStone = [112, 100, 84];

      r = r * (1 - stoneMix) + cityStone[0] * stoneMix;
      g = g * (1 - stoneMix) + cityStone[1] * stoneMix;
      b = b * (1 - stoneMix) + cityStone[2] * stoneMix;

      const sunMix = upperBand * 0.05 + (luma > 132 ? 0.02 : 0);
      r = r * (1 - sunMix) + sunStone[0] * sunMix;
      g = g * (1 - sunMix) + sunStone[1] * sunMix;
      b = b * (1 - sunMix) + sunStone[2] * sunMix;

      if (luma < 118) {
        const shadowMix = Math.min(0.32, (118 - luma) / 150);
        r = r * (1 - shadowMix) + shadowStone[0] * shadowMix;
        g = g * (1 - shadowMix) + shadowStone[1] * shadowMix;
        b = b * (1 - shadowMix) + shadowStone[2] * shadowMix;
      }

      if (y > h * 0.74) {
        const groundMix = Math.max(0, (y / h) - 0.74) * 0.16;
        r = r * (1 - groundMix) + earthStone[0] * groundMix;
        g = g * (1 - groundMix) + earthStone[1] * groundMix;
        b = b * (1 - groundMix) + earthStone[2] * groundMix;
      }

      const leftA = x > 0 ? source[i - 1] : a;
      const rightA = x + 1 < w ? source[i + 7] : a;
      const upA = y > 0 ? source[i - w * 4 + 3] : a;
      const downA = y + 1 < h ? source[i + w * 4 + 3] : a;
      const edgeAlpha = Math.max(
        Math.abs(a - leftA),
        Math.abs(a - rightA),
        Math.abs(a - upA),
        Math.abs(a - downA),
      );
      const edgeBoost = edgeAlpha > 60 ? 0.16 : 0;

      data[i] = _clampByte((((r - 128) * contrast) + 128 - 1) * (1 + edgeBoost));
      data[i + 1] = _clampByte((((g - 128) * contrast) + 128 - 2) * (1 + edgeBoost * 0.9));
      data[i + 2] = _clampByte((((b - 128) * contrast) + 128 - 4) * (1 + edgeBoost * 0.85));
      data[i + 3] = a < 92 ? 0 : (a < 180 ? 240 : 255);
    }
  }
  cctx.putImageData(frame, 0, 0);
  _SETTLEMENT_IMAGE_RENDER_CACHE.set(img, canvas);
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

function _isStylizedPropKind(kind) {
  return kind === 'FOREST' || kind === 'MOUNTAIN' || kind === 'MOUNTAIN_LARGE';
}

function _getStyledPropCanvas(entry, kind, styleProfile = 'stronghold') {
  if (!entry?.frame) return null;
  const srcKey = _frameCacheKey('prop-src', kind, entry.sourceDef, entry.frame.name);
  const src = _getFrameCanvas(entry.frame, srcKey);
  if (!src) return null;
  if (!_isStylizedPropKind(kind)) return src;
  if (typeof document === 'undefined') return src;

  const normalizedProfile = styleProfile === 'classic' ? 'classic' : 'stronghold';
  const styleKey = `${kind}:${entry.sourceDef || ''}:${entry.frame.name || ''}:${normalizedProfile}:v5`;
  if (_PROP_STYLE_CACHE.has(styleKey)) return _PROP_STYLE_CACHE.get(styleKey);

  const w = src.width || 1;
  const h = src.height || 1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  if (!octx) {
    _PROP_STYLE_CACHE.set(styleKey, src);
    return src;
  }
  octx.imageSmoothingEnabled = false;
  octx.drawImage(src, 0, 0);
  const img = octx.getImageData(0, 0, w, h);
  const styled = styleDimetricPropPixels(img.data, w, h, { kind, profile: normalizedProfile });
  img.data.set(styled);
  octx.putImageData(img, 0, 0);
  _PROP_STYLE_CACHE.set(styleKey, out);
  return out;
}

function _drawPropFrame(ctx, entry, px, py, T, fogLevel, tx, ty, kind, styleProfile = 'stronghold') {
  if (!entry?.frame) return false;
  const canvas = _getStyledPropCanvas(entry, kind, styleProfile);
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
  ctx.imageSmoothingEnabled = false;
  const baseX = dx + targetW * 0.50;
  const baseY = dy + targetH * 0.95;
  if (kind === 'FOREST') {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    _ellipse(ctx, baseX + 1, baseY + 1, targetW * 0.26, Math.max(2, targetH * 0.06), 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'MOUNTAIN' || kind === 'MOUNTAIN_LARGE') {
    ctx.fillStyle = kind === 'MOUNTAIN_LARGE' ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    _ellipse(ctx, baseX + 1, baseY + 1, targetW * 0.30, Math.max(2, targetH * 0.07), 0, 0, Math.PI * 2);
    ctx.fill();
  }
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
  const owner = settlement?.owner || settlement?.ownerFactionId || 'bandit';
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

function _applySettlementStylePalette(basePal, styleSpec) {
  const delta = styleSpec?.palette;
  if (!delta) return basePal;
  return _tintSettlementPalette(
    basePal,
    Number.isFinite(delta.stone) ? delta.stone : 0,
    Number.isFinite(delta.roof) ? delta.roof : 0,
    Number.isFinite(delta.plaster) ? delta.plaster : 0,
  );
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

function _mixColorCss(a, b, t = 0.5) {
  const aa = _settlementColorTriplet(a);
  const bb = _settlementColorTriplet(b);
  const cc = _mixRgb(aa, bb, Math.max(0, Math.min(1, t)));
  return `rgb(${cc[0]},${cc[1]},${cc[2]})`;
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

function _settlementSpriteBastion(ctx, x, y, w, h, wallMain, wallLight, wallDark) {
  const crownH = Math.max(3, Math.floor(h * 0.16));
  const shaftInset = Math.max(1, Math.floor(w * 0.12));
  const shaftX = x + shaftInset;
  const shaftW = Math.max(4, w - shaftInset * 2);
  const shaftY = y + crownH - 1;
  const shaftH = Math.max(5, h - crownH + 1);

  _settlementSpriteRect(ctx, wallMain, shaftX, shaftY, shaftW, shaftH);
  _settlementSpriteDither(ctx, shaftX, shaftY, shaftW, shaftH, wallLight, wallDark, (Math.round(x) * 5 + Math.round(y) * 7) & 15);
  _settlementSpriteFrame(ctx, shaftX, shaftY, shaftW, shaftH, _hexShade(wallLight, 0.08), _hexShade(wallDark, -0.12));

  _settlementSpriteRect(ctx, _hexShade(wallMain, 0.06), x, y + 1, w, crownH + 1);
  _settlementSpriteDither(ctx, x, y + 1, w, crownH + 1, _hexShade(wallLight, 0.08), _hexShade(wallDark, -0.06), (Math.round(x) * 3 + Math.round(y) * 11) & 15);
  _settlementSpriteFrame(ctx, x, y + 1, w, crownH + 1, _hexShade(wallLight, 0.10), _hexShade(wallDark, -0.14));
  _settlementSpriteCrenels(ctx, x, y, w, wallLight, wallDark);

  _settlementSpriteRect(ctx, _hexShade(wallDark, -0.08), shaftX, shaftY + 2, 1, Math.max(2, shaftH - 3));
  _settlementSpriteRect(ctx, _hexShade(wallLight, 0.04), shaftX + shaftW - 2, shaftY + 2, 1, Math.max(2, shaftH - 3));
  _settlementSpriteRect(ctx, wallDark, shaftX, shaftY + shaftH - 1, shaftW, 1);

  const slitCount = w >= 14 ? 2 : 1;
  for (let i = 0; i < slitCount; i += 1) {
    const wx = shaftX + Math.floor(shaftW * (slitCount === 1 ? 0.5 : (i === 0 ? 0.34 : 0.66))) - 1;
    const wy = shaftY + Math.floor(shaftH * (slitCount === 1 ? 0.38 : 0.34));
    _settlementSpriteRect(ctx, 'rgba(0,0,0,0.58)', wx, wy, 2, Math.max(4, Math.floor(h * 0.22)));
  }

  _settlementSpriteRect(ctx, _hexShade(wallLight, 0.12), x + Math.max(1, Math.floor(w * 0.28)), y + crownH, Math.max(2, Math.floor(w * 0.18)), 1);
}

function _settlementSpriteMoat(ctx, cx, cy, rx, ry, pal = null, seed = 0) {
  const bankDarkBase = pal?.pathDark || '#7b6a4e';
  const bankLightBase = pal?.pathLight || '#a48a63';
  const bankDark = _hexShade(bankDarkBase, -0.26);
  const bankMid = _hexShade(bankDarkBase, -0.10);
  const bankLight = _hexShade(bankLightBase, -0.08);
  const waterDark = '#24454f';
  const waterMid = '#35626e';
  const waterLight = '#4f8897';
  const silt = '#5d5a4d';

  ctx.fillStyle = bankDark;
  ctx.beginPath();
  _ellipse(ctx, cx, cy + 1, rx + 6, ry + 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = bankMid;
  ctx.beginPath();
  _ellipse(ctx, cx, cy, rx + 3, ry + 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = waterDark;
  ctx.beginPath();
  _ellipse(ctx, cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = waterMid;
  ctx.beginPath();
  _ellipse(ctx, cx - rx * 0.05, cy - ry * 0.03, rx * 0.92, ry * 0.82, -0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = waterLight;
  ctx.beginPath();
  _ellipse(ctx, cx - rx * 0.26, cy - ry * 0.18, rx * 0.30, ry * 0.15, -0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(10,18,22,0.30)';
  ctx.beginPath();
  _ellipse(ctx, cx + rx * 0.12, cy + ry * 0.20, rx * 0.70, ry * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  const shorelineCuts = [
    [-0.84, -0.14, 0.12, 0.16], [-0.66, 0.28, 0.10, 0.12], [-0.38, 0.54, 0.14, 0.12],
    [0.00, 0.66, 0.16, 0.10], [0.42, 0.54, 0.14, 0.12], [0.74, 0.18, 0.12, 0.14],
    [0.70, -0.34, 0.10, 0.12], [0.24, -0.62, 0.12, 0.10], [-0.28, -0.58, 0.14, 0.10],
  ];
  for (let i = 0; i < shorelineCuts.length; i += 1) {
    const [nx, ny, wr, hr] = shorelineCuts[i];
    ctx.fillStyle = (i & 1) === 0 ? bankLight : silt;
    ctx.beginPath();
    _ellipse(
      ctx,
      cx + rx * nx + (((seed >> (i & 3)) & 1) ? 1 : 0),
      cy + ry * ny,
      Math.max(2, rx * wr),
      Math.max(1, ry * hr),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const waterPatches = [
    [-0.62, -0.10, 0.14, 0.12], [-0.22, 0.28, 0.16, 0.12], [0.20, -0.18, 0.14, 0.10], [0.56, 0.22, 0.16, 0.12],
  ];
  for (let i = 0; i < waterPatches.length; i += 1) {
    const [nx, ny, wr, hr] = waterPatches[i];
    ctx.fillStyle = (i & 1) === 0 ? waterMid : waterDark;
    ctx.beginPath();
    _ellipse(ctx, cx + rx * nx, cy + ry * ny, Math.max(2, rx * wr), Math.max(1, ry * hr), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const reedColor = '#64724d';
  const stoneColor = '#8b8678';
  const foamColor = 'rgba(206,236,242,0.34)';
  const reedAnchors = [
    [-0.92, -0.02], [-0.82, 0.20], [-0.60, 0.44], [-0.24, 0.62], [0.16, 0.64], [0.54, 0.50], [0.82, 0.22], [0.92, -0.04],
  ];
  for (let i = 0; i < reedAnchors.length; i += 1) {
    const [nx, ny] = reedAnchors[i];
    const px = Math.round(cx + rx * nx);
    const py = Math.round(cy + ry * ny + (((seed >> (i & 2)) & 1) ? 1 : 0));
    const rh = 2 + ((seed + i) & 1);
    _settlementSpriteRect(ctx, reedColor, px, py, 1, rh);
    if ((i & 1) === 0) _settlementSpriteRect(ctx, reedColor, px + 1, py + 1, 1, Math.max(1, rh - 1));
  }

  const stoneAnchors = [
    [-0.74, -0.56], [-0.34, -0.72], [0.02, -0.78], [0.36, -0.70], [0.72, -0.46],
    [-0.80, 0.44], [-0.52, 0.66], [0.10, 0.78], [0.56, 0.64], [0.84, 0.36],
  ];
  for (let i = 0; i < stoneAnchors.length; i += 1) {
    const [nx, ny] = stoneAnchors[i];
    const px = Math.round(cx + rx * nx);
    const py = Math.round(cy + ry * ny);
    _settlementSpriteRect(ctx, stoneColor, px, py, 2, 1);
    if (((seed + i) & 1) === 1) _settlementSpriteRect(ctx, _hexShade(stoneColor, -0.12), px + 1, py + 1, 1, 1);
  }

  for (let i = 0; i < 4; i += 1) {
    const px = Math.round(cx - rx * 0.46 + i * (rx * 0.26) + (((seed >> i) & 1) ? 1 : 0));
    const py = Math.round(cy - ry * 0.20 + ((seed + i) & 1));
    _settlementSpriteRect(ctx, foamColor, px, py, 2, 1);
  }
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

function _drawCityFamilySignature(ctx, family, pal, wallX, wallY, wallW, wallH, w, h, seed) {
  if (!family) return;
  const gateX = wallX + Math.floor(wallW * 0.50);
  const ridgeY = wallY - Math.max(4, Math.floor(h * 0.08));
  const baseY = wallY + Math.floor(wallH * 0.58);

  if (family.includes('ottoman') || family.includes('anatolian') || family.includes('rumelian')) {
    _spriteDome(ctx, pal.domeDark, pal.domeMid, pal.domeLight, gateX, ridgeY + 1, Math.max(4, Math.floor(w * 0.05)), Math.max(3, Math.floor(h * 0.04)));
    _settlementSpriteRect(ctx, pal.plaster, gateX - 3, ridgeY + 2, 6, 4);
    return;
  }
  if (family.includes('gothic') || family.includes('alpine') || family.includes('bohemian')) {
    _settlementSpriteTower(ctx, wallX + 2, wallY - 10, 8, 18, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    _settlementSpriteTower(ctx, wallX + wallW - 10, wallY - 10, 8, 18, pal.stoneMid, pal.stoneLight, pal.stoneDark, pal.roofMid, pal.roofLight, pal.roofDark);
    return;
  }
  if (family.includes('hanseatic') || family.includes('masovian') || family.includes('silesian')) {
    for (let i = 0; i < 3; i++) {
      const bx = wallX + 6 + i * Math.floor((wallW - 14) / 3);
      _settlementSpriteRect(ctx, pal.plaster, bx, baseY - 8, 5, 6);
      _settlementSpriteRect(ctx, _hexShade(pal.plaster, -0.18), bx + 1, baseY - 6, 3, 2);
    }
    return;
  }
  if (family.includes('castilian') || family.includes('aragonese') || family.includes('navarre')) {
    _settlementSpriteRect(ctx, pal.stoneDark, wallX + 6, baseY - 10, wallW - 12, 3);
    _settlementSpriteRect(ctx, pal.stoneMid, wallX + 10, baseY - 13, wallW - 20, 3);
    return;
  }
  if (family.includes('andalusian') || family.includes('levant') || family.includes('lagoon') || family.includes('adriatic') || family.includes('terraferma')) {
    const canalY = wallY + wallH + 1;
    _settlementSpriteRect(ctx, _hexShade(pal.domeDark, -0.10), wallX + 3, canalY, wallW - 6, 2);
    for (let i = 0; i < 2; i++) {
      const cx = wallX + 8 + i * Math.floor((wallW - 16) / 2);
      _settlementSpriteRect(ctx, pal.plaster, cx, baseY - 8, 5, 6);
    }
    return;
  }
  if (family.includes('stockade') || family.includes('hillhold')) {
    for (let i = 0; i < 6; i++) {
      const sx = wallX + 4 + i * Math.floor((wallW - 10) / 6);
      _settlementSpriteRect(ctx, pal.woodDark, sx, baseY - 3 + (i & 1), 1, 4 + ((seed + i) & 1));
    }
  }
}

function _drawFactionCitySprite(ctx, fid, pal, seed, factionColor, w, h, regionVariant = 0, styleSpec = null) {
  let wallX = Math.floor(w * 0.14);
  let wallY = Math.floor(h * 0.42);
  let wallW = Math.floor(w * 0.72);
  let wallH = Math.floor(h * 0.28);
  const rv = Math.max(0, regionVariant | 0) % 6;
  const cityStruct = styleSpec?.cityStructure || null;
  const cityFamily = String(styleSpec?.cityFamily || '');

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

  if (cityStruct) {
    wallW = Math.max(18, Math.round(wallW * (Number(cityStruct.wallWScale) || 1)));
    wallH = Math.max(8, Math.round(wallH * (Number(cityStruct.wallHScale) || 1)));
    wallY += Math.round(h * (Number(cityStruct.wallYShift) || 0));
    wallX = Math.round((w - wallW) * 0.5);
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

  if ((Number(cityStruct?.towerBias) || 0) > 0.24) {
    const th = Math.max(18, Math.floor(h * (0.28 + (Number(cityStruct?.roofSteepness) || 1) * 0.06)));
    _settlementSpriteTower(
      ctx,
      wallX + Math.floor(wallW * 0.47),
      wallY - Math.floor(th * 0.62),
      9,
      th,
      pal.stoneMid,
      pal.stoneLight,
      pal.stoneDark,
      pal.roofMid,
      pal.roofLight,
      pal.roofDark,
    );
  }

  const houseDensity = Math.max(0.6, Math.min(1.4, Number(cityStruct?.houseDensity) || 1));
  const houseCount = Math.max(2, Math.min(6, Math.round((2 + Math.floor(_seedRand(seed, 10) * 3)) * houseDensity)));
  for (let i = 0; i < houseCount; i++) {
    const hx = wallX + 5 + Math.floor(_seedRand(seed, 20 + i) * (wallW - 20));
    const hw = 9 + Math.floor(_seedRand(seed, 30 + i) * 4);
    const hh = 6 + Math.floor(_seedRand(seed, 40 + i) * 3);
    _settlementSpriteHouse(ctx, hx, wallY + wallH - hh + 1, hw, hh, pal.plaster, pal.woodDark, pal.woodMid, pal.woodLight);
  }

  _drawCityRegionMotif(ctx, fid, pal, rv, seed, wallX, wallY, wallW, wallH, w, h);
  _drawCityFamilySignature(ctx, cityFamily, pal, wallX, wallY, wallW, wallH, w, h, seed);

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

function _drawFactionFortSprite(ctx, fid, pal, variant, seed, factionColor, w, h, styleSpec = null) {
  const layouts = _fortLayoutsForFaction(fid);
  const variantOffset = Number.isFinite(styleSpec?.fortVariantOffset) ? (styleSpec.fortVariantOffset | 0) : 0;
  const layout = layouts[Math.abs((variant + variantOffset) % layouts.length)];
  const fortStoneDark = _mixColorCss(pal.stoneDark, '#48505c', 0.72);
  const fortStoneMid = _mixColorCss(pal.stoneMid, '#6d7683', 0.74);
  const fortStoneLight = _mixColorCss(pal.stoneLight, '#a7b1bf', 0.70);
  const wallThickness = 4;
  const wallW = Math.max(28, Math.round(Math.min(w * 0.56, h * 0.58)));
  const wallH = Math.max(24, Math.round(Math.min(h * 0.82, wallW * 1.46)));
  const wallX = Math.floor((w - wallW) * 0.5);
  const wallY = Math.max(8, Math.min(h - wallH - 3, Math.floor(h * 0.28)));

  _settlementSpriteRect(ctx, fortStoneMid, wallX, wallY, wallW, wallH);
  _settlementSpriteDither(ctx, wallX, wallY, wallW, wallH, fortStoneLight, fortStoneDark, (seed >>> 3) & 3);
  _settlementSpriteFrame(ctx, wallX, wallY, wallW, wallH, _hexShade(fortStoneLight, 0.08), _hexShade(fortStoneDark, -0.12));
  _settlementSpriteCrenels(ctx, wallX, wallY, wallW, fortStoneLight, fortStoneDark);
  const upperWallInset = Math.max(3, Math.floor(wallW * 0.10));
  const upperWallX = wallX + upperWallInset;
  const upperWallW = Math.max(8, wallW - upperWallInset * 2);
  const upperWallH = Math.max(5, Math.floor(wallH * 0.18));
  const upperWallY = wallY - Math.max(3, Math.floor(upperWallH * 0.45));
  _settlementSpriteRect(ctx, _hexShade(fortStoneMid, 0.04), upperWallX, upperWallY, upperWallW, upperWallH);
  _settlementSpriteDither(ctx, upperWallX, upperWallY, upperWallW, upperWallH, fortStoneLight, fortStoneDark, (seed >>> 1) & 7);
  _settlementSpriteFrame(ctx, upperWallX, upperWallY, upperWallW, upperWallH, _hexShade(fortStoneLight, 0.10), _hexShade(fortStoneDark, -0.14));
  _settlementSpriteCrenels(ctx, upperWallX, upperWallY, upperWallW, fortStoneLight, fortStoneDark);

  const innerX = wallX + wallThickness;
  const innerY = wallY + wallThickness;
  const innerW = Math.max(6, wallW - wallThickness * 2);
  const innerH = Math.max(6, wallH - wallThickness * 2);
  const courtStone = _mixColorCss(fortStoneMid, pal.plaster, 0.24);
  const courtLight = _mixColorCss(fortStoneLight, pal.plaster, 0.18);
  const courtDark = _mixColorCss(fortStoneDark, pal.pathDark, 0.20);
  _settlementSpriteRect(ctx, courtStone, innerX, innerY, innerW, innerH);
  _settlementSpriteDither(ctx, innerX, innerY, innerW, innerH, courtLight, courtDark, (seed >>> 4) & 7);
  _settlementSpriteFrame(ctx, innerX, innerY, innerW, innerH, _hexShade(courtLight, 0.04), _hexShade(courtDark, -0.08));
  for (let yy = innerY + 2; yy < innerY + innerH - 2; yy += 4) {
    for (let xx = innerX + 2 + (((yy - innerY) >> 2) & 1); xx < innerX + innerW - 2; xx += 5) {
      _settlementSpriteRect(ctx, _hexShade(courtLight, 0.02), xx, yy, 2, 1);
      if (((xx + yy + seed) & 3) === 0) _settlementSpriteRect(ctx, _hexShade(courtDark, -0.02), xx + 1, yy + 1, 1, 1);
    }
  }
  _settlementSpriteRect(ctx, _hexShade(pal.pathDark, -0.10), innerX, innerY + innerH - 2, innerW, 2);

  const keepW = Math.max(10, Math.floor(innerW * 0.34));
  const keepH = Math.max(10, Math.floor(innerH * 0.30));
  const keepX = wallX + Math.floor((wallW - keepW) * 0.5);
  const keepY = innerY + Math.max(2, Math.floor(innerH * 0.18));
  _settlementSpriteRect(ctx, _hexShade(fortStoneMid, 0.03), keepX, keepY, keepW, keepH);
  _settlementSpriteDither(ctx, keepX, keepY, keepW, keepH, fortStoneLight, fortStoneDark, (seed >>> 2) & 7);
  _settlementSpriteFrame(ctx, keepX, keepY, keepW, keepH, _hexShade(fortStoneLight, 0.10), _hexShade(fortStoneDark, -0.14));
  _settlementSpriteCrenels(ctx, keepX, keepY, keepW, fortStoneLight, fortStoneDark);
  _settlementSpriteRect(ctx, 'rgba(18,16,14,0.62)', keepX + Math.floor(keepW * 0.42), keepY + Math.floor(keepH * 0.34), Math.max(2, Math.floor(keepW * 0.18)), Math.max(4, Math.floor(keepH * 0.44)));
  _settlementSpriteRect(ctx, _hexShade(fortStoneLight, 0.08), keepX + 2, keepY + Math.floor(keepH * 0.42), Math.max(2, keepW - 4), 1);

  const baseTowerW = Math.max(10, Math.floor(wallW * 0.32));
  const baseTowerH = Math.max(16, Math.floor(wallH * 0.42));
  const towerW = Math.max(9, Math.round(baseTowerW * 0.88));
  const towerH = Math.max(14, Math.round(baseTowerH * 0.90));
  const rearTop = Math.max(1, wallY - towerH + 4);
  const frontTop = Math.min(h - towerH - 1, wallY + wallH - Math.floor(towerH * 0.74));
  const leftX = wallX - Math.floor(towerW * 0.34);
  const rightX = wallX + wallW - Math.ceil(towerW * 0.66);
  const centerTowerW = towerW;
  const centerTowerH = towerH;
  const centerX = Math.floor(wallX + wallW * 0.5 - centerTowerW * 0.5);
  const centerTop = rearTop;
  const midTowerW = Math.max(baseTowerW + 2, Math.round(baseTowerW * 1.18));
  const midTowerH = Math.max(baseTowerH + 2, Math.round(baseTowerH * 1.16));
  const centerMidTowerW = Math.max(midTowerW + 2, Math.round(midTowerW * 1.12));
  const centerMidTowerH = Math.max(midTowerH + 2, Math.round(midTowerH * 1.10));
  const midSpread = Math.max(1, Math.round(midTowerW * 0.12));
  const leftMidX = Math.floor(leftX + towerW * 0.5 - midTowerW * 0.5) - midSpread;
  const centerMidX = Math.floor(centerX + centerTowerW * 0.5 - centerMidTowerW * 0.5);
  const rightMidX = Math.floor(rightX + towerW * 0.5 - midTowerW * 0.5) + midSpread;
  const midTop = Math.floor(wallY + wallH * 0.5 - midTowerH * 0.5);
  const centerMidTop = Math.floor(wallY + wallH * 0.5 - centerMidTowerH * 0.5);

  _settlementSpriteBastion(ctx, leftX, rearTop, towerW, towerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, rightX, rearTop, towerW, towerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, centerX, centerTop, centerTowerW, centerTowerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, leftMidX, midTop, midTowerW, midTowerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, centerMidX, centerMidTop, centerMidTowerW, centerMidTowerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, rightMidX, midTop, midTowerW, midTowerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, leftX, frontTop, towerW, towerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, centerX, frontTop, centerTowerW, centerTowerH, fortStoneMid, fortStoneLight, fortStoneDark);
  _settlementSpriteBastion(ctx, rightX, frontTop, towerW, towerH, fortStoneMid, fortStoneLight, fortStoneDark);

  const gateH = Math.max(6, Math.floor(h * 0.14));
  const gateW = Math.max(4, Math.floor(w * 0.07));
  const gateX = wallX + Math.floor(wallW * 0.5) - Math.floor(gateW * 0.5);
  const gateY = wallY + wallH - gateH - 1;
  if (layout.gateArch) {
    _settlementSpriteRect(ctx, 'rgba(24,18,14,0.72)', gateX, gateY, gateW, gateH);
    _spriteDome(ctx, '#2a2018', '#35281f', '#483124', gateX + Math.floor(gateW * 0.5), gateY, Math.max(2, Math.floor(gateW * 0.5)), Math.max(1, Math.floor(gateW * 0.25)));
  } else {
    _settlementSpriteRect(ctx, 'rgba(24,18,14,0.72)', gateX, gateY, gateW, gateH);
  }

  const bridgeW = gateW + 6;
  const bridgeX = gateX - 3;
  const bridgeY = gateY + gateH - 1;
  const bridgeH = Math.max(7, Math.round(wallH * 0.44));
  _settlementSpriteRect(ctx, _hexShade(pal.pathDark, -0.10), bridgeX, bridgeY, bridgeW, bridgeH);
  _settlementSpriteRect(ctx, pal.pathLight, bridgeX + 1, bridgeY + 1, Math.max(2, bridgeW - 2), Math.max(2, bridgeH - 2));
  for (let i = 1; i < bridgeH - 1; i += 2) {
    _settlementSpriteRect(ctx, _hexShade(pal.pathDark, -0.06), bridgeX + 1, bridgeY + i, Math.max(2, bridgeW - 2), 1);
  }

  _drawFortFactionMotif(ctx, fid, pal, layout, seed, wallX, wallY, wallW, wallH, w, h);
  _settlementSpritePennant(ctx, wallX + Math.floor(wallW * 0.5), wallY - 2, factionColor);
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
    fort: [88, 70],
    village: [64, 50],
  }[type] || [64, 50];
  const styleSpec = design.styleSpec || null;
  const spriteScale = Number.isFinite(styleSpec?.spriteScale) ? styleSpec.spriteScale : 1;
  const w = Math.max(32, Math.round(dims[0] * spriteScale));
  const h = Math.max(26, Math.round(dims[1] * spriteScale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const cctx = canvas.getContext('2d');
  if (!cctx) return null;
  cctx.imageSmoothingEnabled = false;

  const fid = design.factionId || 'bandit';
  const basePal = _applySettlementStylePalette(_settlementPalette(fid), styleSpec);
  const seed = design.seed >>> 0;
  const variant = Number.isFinite(design.variant) ? design.variant : 0;
  const cityRegion = Number.isFinite(design.cityRegion) ? design.cityRegion : 0;
  const pal = (type === 'city' || type === 'town')
    ? _cityPaletteByRegion(basePal, fid, cityRegion)
    : (type === 'fort')
      ? _fortPaletteByVariant(basePal, fid, variant)
      : basePal;
  const strongholdFortTextures = type === 'fort' ? _getStrongholdFortTextures() : null;

  if (!(type === 'fort' && strongholdFortTextures)) {
    _settlementSpriteRect(cctx, 'rgba(0,0,0,0.20)', 6, h - 9, w - 12, 6);
    _settlementSpriteRect(cctx, pal.pathDark, Math.floor(w * 0.44), h - 12, Math.max(6, Math.floor(w * 0.15)), 11);
    _settlementSpriteRect(cctx, pal.pathLight, Math.floor(w * 0.47), h - 11, Math.max(3, Math.floor(w * 0.08)), 10);
    _settlementSpriteRect(cctx, _hexShade(pal.pathDark, -0.08), Math.floor(w * 0.18), h - 8, Math.floor(w * 0.64), 2);
  }

  if (type === 'city' || type === 'town') {
    _drawFactionCitySprite(cctx, fid, pal, seed, factionColor, w, h, cityRegion, styleSpec);
  } else if (type === 'fort') {
    if (strongholdFortTextures) {
      canvas._codexSettlementAsset = 'fort-stronghold';
      _drawStrongholdFortSprite(cctx, strongholdFortTextures, factionColor, pal, w, h);
      _gradeStrongholdFortSprite(cctx, pal, w, h);
    } else {
      _drawFactionFortSprite(cctx, fid, pal, variant, seed, factionColor, w, h, styleSpec);
    }
  } else {
    _drawVillageSprite(cctx, pal, variant, seed, factionColor, w, h);
  }

  _settlementSpriteRect(cctx, pal.outline, 0, h - 1, w, 1);
  return canvas;
}

function _getSettlementSprite(
  settlement,
  type,
  factionId,
  factionColor,
  styleSpec = null,
  precomputedSeed = null,
  precomputedCityRegion = null,
) {
  const baseSeed = Number.isFinite(precomputedSeed) ? precomputedSeed : _settlementSeed(settlement, 1709);
  const customSprite = _getCustomSettlementSprite(type, factionId);
  if (customSprite) return customSprite;
  if (type === 'fort') {
    const wallOnly = _getImageAsset(STRONGHOLD_WALL_ONLY_COMPOSITE_URL, 'fort-wall-only');
    if (wallOnly) return wallOnly;
  }
  const strongholdFortTextures = type === 'fort' ? _getStrongholdFortTextures() : null;
  if (type === 'fort' && !strongholdFortTextures) {
    const fortAsset = _getImageAsset(FORT_MAIN_SPRITE_URL, 'fort-main');
    if (fortAsset) return _getFortRenderCanvas(fortAsset) || fortAsset;
  }
  let variant;
  const cityRegion = Number.isFinite(precomputedCityRegion) ? precomputedCityRegion : _cityRegionVariant(settlement, 6);
  const styleKey = settlementStyleCacheKey(styleSpec);
  let key = `s:v19:${styleKey}:${type}:${factionId || 'bandit'}:`;
  if (type === 'fort') {
    const fortLayouts = _fortLayoutsForFaction(factionId || 'bandit');
    variant = baseSeed % Math.max(1, fortLayouts.length);
    const fortMode = strongholdFortTextures ? 'stronghold' : 'fallback';
    key += `fort-${fortMode}-${variant}`;
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
    styleSpec,
  });
  _SETTLEMENT_SPRITE_CACHE.set(key, sprite || null);
  return sprite;
}

function _settlementH3Kind(type) {
  if (type === 'city' || type === 'town') return 'SETTLEMENT_CITY';
  if (type === 'fort') return 'SETTLEMENT_FORT';
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

function _settlementH3BaseIndex(type, factionId, frameCount, tx, ty, _styleSpec = null) {
  // Prefer faction-curated HoMM3 pools for stable visual identity.
  // Style-level pools can still be applied later through explicit modifiers if needed.
  const fid = String(factionId || '').toLowerCase();
  if (type === 'city' || type === 'town') {
    // Curated medieval pool: avoid fantasy outliers for visual consistency.
    if (fid === 'ottoman') return _pickFromPool([8], frameCount, tx, ty, 1);
    if (fid === 'spanish') return _pickFromPool([1, 5], frameCount, tx, ty, 2);
    if (fid === 'venice') return _pickFromPool([1, 0], frameCount, tx, ty, 2);
    if (fid === 'hre' || fid === 'polish') return _pickFromPool([0, 1], frameCount, tx, ty, 3);
    return _pickFromPool([0, 1, 5, 6, 8], frameCount, tx, ty, 4);
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

function _pickSettlementH3Frame(type, factionId, tx, ty, styleSpec = null) {
  const kind = _settlementH3Kind(type);
  if (!kind) return null;
  const frames = _H3_PROP_DATA?.[kind]?.frames;
  if (!Array.isArray(frames) || !frames.length) return null;
  const base = _settlementH3BaseIndex(type, factionId, frames.length, tx, ty, styleSpec) % frames.length;
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
  const exactH3 = design?.styleSpec?.h3Exact === true;
  const h3Morph = exactH3 ? 0 : _norm01(Number(design?.styleSpec?.h3Morph) || 0);
  const frameKey = _frameCacheKey('settlement-src', type, entry.sourceDef, entry.frame.name);
  const src = _getFrameCanvas(entry.frame, frameKey);
  if (!src) return null;

  const fid = String(design?.factionId || 'bandit').toLowerCase();
  const pal = _applySettlementStylePalette(_settlementPalette(fid), design?.styleSpec || null);
  const roofDark = _settlementColorTriplet(pal.roofDark);
  const roofLight = _settlementColorTriplet(pal.roofLight);
  const stoneDark = _settlementColorTriplet(pal.stoneDark);
  const stoneLight = _settlementColorTriplet(pal.stoneLight);
  const plasterBase = _settlementColorTriplet(pal.plaster);
  const plasterDark = _shade(plasterBase, -18);
  const accentBase = _settlementColorTriplet(design?.factionColor || pal.accent);

  const styleKey = settlementStyleCacheKey(design?.styleSpec || null);
  const key = `${type}:${entry.sourceDef}:${entry.frame.name}:${fid}:${styleKey}:${exactH3 ? 'exact' : 'adapt'}:m${Math.round(h3Morph * 100)}:${accentBase.join('-')}`;
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

    let keep = a >= (exactH3 ? 8 : 20);
    if (!exactH3) {
      // Remove low-alpha dark DEF shadow pixels so sprite can be grounded by game shadow.
      if (keep && a < 170 && r < 66 && g < 66 && b < 66) keep = false;
      if (keep && a < 46 && (r + g + b) < 210) keep = false;
    }
    if (!keep) {
      px[i + 3] = 0;
      continue;
    }

    if (!exactH3) {
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
        const recolored = _mixRgb(orig, target, blend * h3Morph);
        px[i] = recolored[0];
        px[i + 1] = recolored[1];
        px[i + 2] = recolored[2];
      }
    } else {
      // Exact HoMM3 mode: preserve palette but recover a bit of midtone contrast/saturation
      // lost during browser compositing and scaling.
      const luma = _rgbLuma(r, g, b);
      const rr = _clampByte((r - luma) * 1.06 + luma);
      const gg = _clampByte((g - luma) * 1.06 + luma);
      const bb = _clampByte((b - luma) * 1.06 + luma);
      px[i] = _clampByte((rr - 128) * 1.04 + 128);
      px[i + 1] = _clampByte((gg - 128) * 1.04 + 128);
      px[i + 2] = _clampByte((bb - 128) * 1.04 + 128);
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
  const padX = exactH3 ? 1 : 2;
  const padTop = exactH3 ? 1 : 2;
  const padBottom = exactH3 ? 1 : 1;
  const sx = Math.max(0, minX - padX);
  const sy = Math.max(0, minY - padTop);
  const sw = Math.min(w - sx, (maxX - minX + 1) + padX * 2);
  const sh = Math.min(h - sy, (maxY - minY + 1) + padTop + padBottom);

  const [ow, oh] = exactH3 ? [sw, sh] : _settlementAdaptedSize(type);
  const out = document.createElement('canvas');
  out.width = ow;
  out.height = oh;
  const octx = out.getContext('2d');
  if (!octx) {
    _SETTLEMENT_H3_ADAPTED_CACHE.set(key, null);
    return null;
  }
  octx.imageSmoothingEnabled = false;
  if (exactH3) {
    octx.drawImage(tmp, sx, sy, sw, sh, 0, 0, sw, sh);
  } else {
    const fitW = 0.92 + h3Morph * 0.08;
    const fitH = 0.90 + h3Morph * 0.05;
    const scale = Math.min((ow * fitW) / sw, (oh * fitH) / sh);
    const dw = Math.max(2, Math.round(sw * scale));
    const dh = Math.max(2, Math.round(sh * scale));
    const dx = Math.round((ow - dw) * 0.5);
    const baseY = oh - Math.max(1, Math.round(oh * 0.06));
    const dy = baseY - dh;
    const topInset = Math.max(0, Math.round(dw * 0.22 * h3Morph));
    if (topInset <= 0) {
      octx.drawImage(tmp, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      const rowStep = Math.max(1, Math.floor(dh / 24));
      for (let rowY = 0; rowY < dh; rowY += rowStep) {
        const rowH = Math.min(rowStep, dh - rowY);
        const t = rowY / Math.max(1, dh - 1);
        const inset = Math.round(topInset * (1 - t));
        const rowDw = Math.max(2, dw - inset * 2);
        const srcY = sy + (rowY / dh) * sh;
        const srcH = (rowH / dh) * sh;
        octx.drawImage(tmp, sx, srcY, sw, srcH, dx + inset, dy + rowY, rowDw, rowH);
      }
    }
  }

  _SETTLEMENT_H3_ADAPTED_CACHE.set(key, out);
  return out;
}

function _drawSettlementH3Frame(ctx, entry, type, sx, sy, profile, design) {
  if (!entry?.frame) return false;
  const canvas = _buildAdaptedSettlementH3Canvas(entry, type, design);
  if (!canvas) return false;

  const fw = canvas.width || 1;
  const fh = canvas.height || 1;
  const styleSpec = design?.styleSpec || null;
  const h3Scale = Number.isFinite(styleSpec?.h3Scale) ? styleSpec.h3Scale : 1;
  const exactH3 = styleSpec?.h3Exact === true;
  let targetH = Math.max(16, profile.h) * h3Scale;
  if (type === 'city' || type === 'town') targetH *= exactH3 ? 0.90 : 1.00;
  else if (type === 'fort') targetH *= exactH3 ? 0.88 : 0.95;
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

function _settlementProfile(type, T, styleSpec = null, useExternalFortSprite = false) {
  const styleScale = Number.isFinite(styleSpec?.profileScale) ? styleSpec.profileScale : 1;
  const shadowScale = Number.isFinite(styleSpec?.shadowScale) ? styleSpec.shadowScale : 1;
  const anchorDelta = Number.isFinite(styleSpec?.anchorDelta) ? styleSpec.anchorDelta : 0;
  const scale = 3.0 * styleScale;

  let profile;
  switch (type) {
    case 'city':
      profile = { w: T * 2.60 * scale, h: T * 1.96 * scale, anchor: 0.90, labelY: T * 0.72 * scale, shadowW: T * 0.92 * scale, shadowH: T * 0.22 * scale, shadowY: T * 0.36 * scale };
      break;
    case 'town':
      profile = { w: T * 2.20 * scale, h: T * 1.68 * scale, anchor: 0.88, labelY: T * 0.64 * scale, shadowW: T * 0.76 * scale, shadowH: T * 0.18 * scale, shadowY: T * 0.33 * scale };
      break;
    case 'fort':
      profile = useExternalFortSprite
        ? { w: T * 2.38 * scale, h: T * 1.64 * scale, anchor: 0.93, labelY: T * 0.72 * scale, shadowW: T * 0.82 * scale, shadowH: T * 0.16 * scale, shadowY: T * 0.34 * scale }
        : { w: T * 2.08 * scale, h: T * 1.55 * scale, anchor: 0.91, labelY: T * 0.68 * scale, shadowW: T * 0.84 * scale, shadowH: T * 0.20 * scale, shadowY: T * 0.35 * scale };
      break;
    default:
      profile = { w: T * 1.70 * scale, h: T * 1.30 * scale, anchor: 0.86, labelY: T * 0.54 * scale, shadowW: T * 0.62 * scale, shadowH: T * 0.16 * scale, shadowY: T * 0.28 * scale };
      break;
  }

  profile.anchor = Math.max(0.78, Math.min(0.98, profile.anchor + anchorDelta));
  profile.shadowW *= shadowScale;
  profile.shadowH *= shadowScale;
  return profile;
}

function _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty, baseAnchorY = null) {
  const baseW = profile.shadowW * 1.08;
  const baseH = profile.shadowH * 1.45;
  const anchoredY = Number.isFinite(baseAnchorY) ? Number(baseAnchorY) : (sy + profile.shadowY);
  const baseY = anchoredY + profile.shadowH * 0.28;

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

function _drawFortMoatGround(ctx, baseX, baseY, groundedW, groundedH, seed = 0) {
  const moatCx = baseX;
  const moatCy = baseY - groundedH * 0.10;
  const moatRx = Math.max(24, groundedW * 0.82);
  const moatRy = Math.max(14, groundedH * 0.54);
  _settlementSpriteMoat(ctx, moatCx, moatCy, moatRx, moatRy, null, seed ^ 0x2d);
}

/** Draw HoMM-like city/fort/village at world pixel (sx, sy). */
function mbSettlement(ctx, settlement, sx, sy, T, fogAlpha, zoom) {
  const type = String(settlement.type || 'village').toLowerCase();
  const spriteType = (type === 'city' || type === 'town' || type === 'fort') ? type : 'village';
  const factionId = settlement.owner || settlement.ownerFactionId || 'bandit';
  const factionColor = _factionData(factionId)[0] || '#b03a3c';
  const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor(sx / Math.max(1, T));
  const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor(sy / Math.max(1, T));
  const baseSeed = _settlementSeed(settlement, 1709);
  const cityRegion = _cityRegionVariant(settlement, 6);
  const baseStyleSpec = buildSettlementStyleSpec({
    settlement,
    type: spriteType,
    factionId,
    seed: baseSeed,
    cityRegion,
    variant: baseSeed % 7,
  });
  const styleModifiers = Array.isArray(settlement?.styleModifiers) ? settlement.styleModifiers : [];
  const styleSpec = applySettlementModifierStack(baseStyleSpec, styleModifiers);
  const design = { factionId, factionColor, styleSpec };
  const h3Entry = styleSpec?.useAdaptedH3 === true
    ? _pickSettlementH3Frame(spriteType, factionId, tx, ty, styleSpec)
    : null;
  const sprite = _getSettlementSprite(settlement, spriteType, factionId, factionColor, styleSpec, baseSeed, cityRegion);
  const useExternalFortSprite = spriteType === 'fort' && _isFortAssetSprite(sprite);
  const profile = _settlementProfile(spriteType, T, styleSpec, useExternalFortSprite);

  ctx.save();
  ctx.globalAlpha = fogAlpha;

  const fallbackDw = Math.max(10, Math.round(profile.w));
  const fallbackDh = Math.max(8, Math.round(profile.h));
  const fallbackDx = Math.round(sx - fallbackDw * 0.5);
  const fallbackDy = Math.round(sy - fallbackDh * profile.anchor);
  const fallbackBaseX = fallbackDx + fallbackDw * 0.5;
  const fallbackBaseY = fallbackDy + fallbackDh;

  const h3Placement = _drawSettlementH3Frame(ctx, h3Entry, spriteType, sx, sy, profile, design);
  const groundedBaseX = h3Placement ? h3Placement.baseX : fallbackBaseX;
  const groundedBaseY = h3Placement ? h3Placement.baseY : fallbackBaseY;
  const groundedW = h3Placement ? h3Placement.dw : fallbackDw;
  const groundedH = h3Placement ? h3Placement.dh : fallbackDh;
  const h3Exact = h3Placement && styleSpec?.h3Exact === true;

  if (!useExternalFortSprite && !h3Exact && h3Placement) _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty, groundedBaseY);
  if (!useExternalFortSprite && spriteType === 'fort' && !h3Exact) _drawFortMoatGround(ctx, groundedBaseX, groundedBaseY, groundedW, groundedH, baseSeed);
  if (h3Placement) {
    if (!h3Exact) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      _ellipse(
        ctx,
        groundedBaseX + 1,
        groundedBaseY + Math.max(1, T * 0.02),
        Math.max(10, groundedW * 0.22),
        Math.max(3, groundedH * 0.06),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = 'rgba(96,68,40,0.22)';
      ctx.beginPath();
      _ellipse(
        ctx,
        groundedBaseX,
        groundedBaseY,
        Math.max(12, groundedW * 0.26),
        Math.max(3, groundedH * 0.06),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
  } else if (sprite) {
    if (!useExternalFortSprite) {
      _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty, groundedBaseY);
      if (spriteType === 'fort') _drawFortMoatGround(ctx, groundedBaseX, groundedBaseY, groundedW, groundedH, baseSeed);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      _ellipse(
        ctx,
        groundedBaseX + 1,
        groundedBaseY + Math.max(1, T * 0.02),
        Math.max(8, groundedW * 0.22),
        Math.max(2, groundedH * 0.06),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      _ellipse(
        ctx,
        groundedBaseX + 1,
        groundedBaseY + Math.max(1, T * 0.03),
        Math.max(6, groundedW * 0.12),
        Math.max(2, groundedH * 0.03),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const prevAlpha = ctx.globalAlpha;
    if (useExternalFortSprite) ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, fallbackDx, fallbackDy, fallbackDw, fallbackDh);
    if (useExternalFortSprite) ctx.globalAlpha = prevAlpha;
  } else {
    _drawSettlementGroundBlend(ctx, sx, sy, profile, T, factionColor, tx, ty, groundedBaseY);
    if (spriteType === 'fort') _drawFortMoatGround(ctx, groundedBaseX, groundedBaseY, groundedW, groundedH, baseSeed);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    _ellipse(
      ctx,
      groundedBaseX + 1,
      groundedBaseY + Math.max(1, T * 0.02),
      Math.max(8, groundedW * 0.22),
      Math.max(2, groundedH * 0.06),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    _ellipse(
      ctx,
      groundedBaseX + 1,
      groundedBaseY + Math.max(1, T * 0.03),
      Math.max(6, groundedW * 0.12),
      Math.max(2, groundedH * 0.03),
      0,
      0,
      Math.PI * 2,
    );
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
  if (_drawPropFrame(ctx, propEntry, px, py, T, fogLevel, tx, ty, 'FOREST', 'stronghold')) return;

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
  if (_drawPropFrame(ctx, propEntry, px, py, T, fogLevel, tx, ty, propKind, 'stronghold')) return;

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

function _drawScreenDiamond(ctx, cx, cy, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
}

const _WALL_VARIANT_DIRS = Object.freeze({
  pillar: Object.freeze([]),
  cap_n: Object.freeze(['N']),
  cap_s: Object.freeze(['S']),
  cap_e: Object.freeze(['E']),
  cap_w: Object.freeze(['W']),
  straight_ns: Object.freeze(['N', 'S']),
  straight_ew: Object.freeze(['E', 'W']),
  corner_nw: Object.freeze(['N', 'W']),
  corner_ne: Object.freeze(['N', 'E']),
  corner_sw: Object.freeze(['S', 'W']),
  corner_se: Object.freeze(['S', 'E']),
  tee_n: Object.freeze(['N', 'E', 'W']),
  tee_s: Object.freeze(['S', 'E', 'W']),
  tee_e: Object.freeze(['N', 'S', 'E']),
  tee_w: Object.freeze(['N', 'S', 'W']),
  cross: Object.freeze(['N', 'S', 'E', 'W']),
});

function _getBuildingFootprintBounds(def) {
  const footprint = Array.isArray(def?.footprint) && def.footprint.length > 0
    ? def.footprint
    : [{ dx: 0, dy: 0 }];
  let minDx = Infinity;
  let minDy = Infinity;
  let maxDx = -Infinity;
  let maxDy = -Infinity;
  for (const tile of footprint) {
    const dx = Math.floor(Number.isFinite(tile?.dx) ? tile.dx : 0);
    const dy = Math.floor(Number.isFinite(tile?.dy) ? tile.dy : 0);
    if (dx < minDx) minDx = dx;
    if (dy < minDy) minDy = dy;
    if (dx > maxDx) maxDx = dx;
    if (dy > maxDy) maxDy = dy;
  }
  return {
    minDx,
    minDy,
    maxDx,
    maxDy,
    footprintW: Math.max(1, (maxDx - minDx) + 1),
    footprintH: Math.max(1, (maxDy - minDy) + 1),
  };
}

function _buildDimetricBuildingMetrics(building, def, tileW, tileH) {
  const footprint = _getBuildingFootprintBounds(def);
  const elevation = Math.max(
    0,
    Number.isFinite(building?.elevation) ? Number(building.elevation) : Number(def?.elevation) || 0,
  );
  const widthTiles = Math.max(1, Number(footprint.footprintW) || 1);
  const heightTiles = Math.max(1, Number(footprint.footprintH) || 1);
  const bodyWidth = Math.max(tileW * 0.80, tileW * (0.70 + (widthTiles * 0.48)));
  const bodyHeight = Math.max(tileH * 1.05, tileH * (0.90 + (heightTiles * 0.54) + (elevation * 0.42)));
  const bottomOffset = Math.max(tileH * 0.34, tileH * (0.38 + (heightTiles * 0.22) + (elevation * 0.14)));
  const depthMul = Math.max(1.05, 0.98 + (heightTiles * 0.32) + (elevation * 0.18));
  return {
    footprint,
    elevation,
    bodyWidth,
    bodyHeight,
    bottomOffset,
    screenBottomOffset: Math.max(4, tileH * depthMul * 0.5),
  };
}

function _drawDimetricWallPrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, variant) {
  const baseY = centerY + tileH * 0.10;
  const bodyW = Math.max(4, tileW * 0.60);
  const bodyH = Math.max(4, tileH * 0.84);
  const left = _snap(centerX - bodyW * 0.5, 1);
  const top = _snap(baseY - bodyH, 1);
  const stoneLight = `rgb(${Math.round(184 * fogMul)},${Math.round(173 * fogMul)},${Math.round(156 * fogMul)})`;
  const stoneMid = `rgb(${Math.round(144 * fogMul)},${Math.round(132 * fogMul)},${Math.round(116 * fogMul)})`;
  const stoneDark = `rgba(${Math.round(78 * fogMul)},${Math.round(68 * fogMul)},${Math.round(58 * fogMul)},0.92)`;

  ctx.fillStyle = `rgba(0,0,0,${0.17 * fogMul})`;
  ctx.beginPath();
  _ellipse(ctx, centerX + tileW * 0.05, baseY + tileH * 0.10, tileW * 0.28, tileH * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stoneMid;
  ctx.fillRect(left, top, Math.max(1, Math.round(bodyW)), Math.max(1, Math.round(bodyH)));
  ctx.fillStyle = stoneLight;
  ctx.fillRect(left, top, Math.max(1, Math.round(bodyW)), Math.max(1, Math.round(bodyH * 0.20)));
  ctx.strokeStyle = stoneDark;
  ctx.lineWidth = Math.max(1, tileW * 0.036);
  ctx.strokeRect(left + 0.5, top + 0.5, Math.max(1, Math.round(bodyW) - 1), Math.max(1, Math.round(bodyH) - 1));

  const crenelCount = Math.max(2, Math.floor(bodyW / Math.max(4, tileW * 0.13)));
  const crenelW = bodyW / (crenelCount * 2);
  const crenelH = Math.max(2, tileH * 0.18);
  for (let i = 0; i < crenelCount; i += 1) {
    const x = left + (i * 2 * crenelW);
    ctx.fillStyle = stoneLight;
    ctx.fillRect(_snap(x, 1), _snap(top - crenelH, 1), Math.max(1, Math.round(crenelW)), Math.max(1, Math.round(crenelH)));
    ctx.fillStyle = stoneDark;
    ctx.fillRect(_snap(x, 1), _snap(top - 1, 1), Math.max(1, Math.round(crenelW)), 1);
  }

  const dirs = _WALL_VARIANT_DIRS[variant] || _WALL_VARIANT_DIRS.pillar;
  const connLenX = tileW * 0.22;
  const connLenY = tileH * 0.34;
  ctx.strokeStyle = stoneDark;
  ctx.lineWidth = Math.max(1, tileW * 0.050);
  for (const dir of dirs) {
    ctx.beginPath();
    if (dir === 'N') {
      ctx.moveTo(centerX, top + Math.max(1, tileH * 0.10));
      ctx.lineTo(centerX, top - connLenY);
    } else if (dir === 'S') {
      ctx.moveTo(centerX, baseY - Math.max(1, tileH * 0.06));
      ctx.lineTo(centerX, baseY + connLenY);
    } else if (dir === 'E') {
      ctx.moveTo(centerX + bodyW * 0.5, baseY - bodyH * 0.48);
      ctx.lineTo(centerX + bodyW * 0.5 + connLenX, baseY - bodyH * 0.48);
    } else if (dir === 'W') {
      ctx.moveTo(centerX - bodyW * 0.5, baseY - bodyH * 0.48);
      ctx.lineTo(centerX - bodyW * 0.5 - connLenX, baseY - bodyH * 0.48);
    }
    ctx.stroke();
  }
}

function _drawDimetricKeepPrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, metrics) {
  const width = Math.max(tileW * 0.95, metrics.bodyWidth * 0.66);
  const height = Math.max(tileH * 1.85, metrics.bodyHeight * 0.95);
  const bottom = centerY + tileH * 0.15;
  const top = bottom - height;
  const left = centerX - width * 0.5;
  const right = centerX + width * 0.5;
  const roofY = top - Math.max(4, tileH * 0.26);
  const stoneLight = `rgb(${Math.round(188 * fogMul)},${Math.round(176 * fogMul)},${Math.round(160 * fogMul)})`;
  const stoneMid = `rgb(${Math.round(146 * fogMul)},${Math.round(132 * fogMul)},${Math.round(116 * fogMul)})`;
  const stoneDark = `rgb(${Math.round(100 * fogMul)},${Math.round(88 * fogMul)},${Math.round(76 * fogMul)})`;

  ctx.fillStyle = `rgba(0,0,0,${0.20 * fogMul})`;
  ctx.beginPath();
  _ellipse(ctx, centerX + tileW * 0.08, bottom + tileH * 0.06, width * 0.54, tileH * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stoneMid;
  ctx.fillRect(_snap(left, 1), _snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  ctx.fillStyle = stoneLight;
  ctx.fillRect(_snap(left, 1), _snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height * 0.30)));
  ctx.fillStyle = stoneDark;
  ctx.fillRect(_snap(right - width * 0.16, 1), _snap(top, 1), Math.max(1, Math.round(width * 0.16)), Math.max(1, Math.round(height)));

  ctx.fillStyle = stoneLight;
  ctx.beginPath();
  ctx.moveTo(_snap(centerX, 1), _snap(roofY, 1));
  ctx.lineTo(_snap(right, 1), _snap(top + tileH * 0.10, 1));
  ctx.lineTo(_snap(centerX, 1), _snap(top + tileH * 0.28, 1));
  ctx.lineTo(_snap(left, 1), _snap(top + tileH * 0.10, 1));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(${Math.round(74 * fogMul)},${Math.round(64 * fogMul)},${Math.round(56 * fogMul)},0.88)`;
  ctx.lineWidth = Math.max(1, tileW * 0.030);
  ctx.stroke();
}

function _drawDimetricGatehousePrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, metrics) {
  const width = Math.max(tileW * 1.05, metrics.bodyWidth * 0.74);
  const height = Math.max(tileH * 1.30, metrics.bodyHeight * 0.74);
  const bottom = centerY + tileH * 0.12;
  const top = bottom - height;
  const left = centerX - width * 0.5;
  const stoneLight = `rgb(${Math.round(180 * fogMul)},${Math.round(168 * fogMul)},${Math.round(148 * fogMul)})`;
  const stoneMid = `rgb(${Math.round(134 * fogMul)},${Math.round(121 * fogMul)},${Math.round(104 * fogMul)})`;
  const stoneDark = `rgb(${Math.round(92 * fogMul)},${Math.round(78 * fogMul)},${Math.round(66 * fogMul)})`;

  ctx.fillStyle = `rgba(0,0,0,${0.18 * fogMul})`;
  ctx.beginPath();
  _ellipse(ctx, centerX + tileW * 0.05, bottom + tileH * 0.08, width * 0.54, tileH * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stoneMid;
  ctx.fillRect(_snap(left, 1), _snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  ctx.fillStyle = stoneLight;
  ctx.fillRect(_snap(left, 1), _snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height * 0.24)));
  ctx.fillStyle = stoneDark;
  ctx.fillRect(_snap(centerX - width * 0.07, 1), _snap(top + height * 0.40, 1), Math.max(1, Math.round(width * 0.14)), Math.max(1, Math.round(height * 0.60)));

  const doorW = Math.max(3, width * 0.28);
  const doorH = Math.max(4, height * 0.42);
  ctx.fillStyle = `rgba(${Math.round(68 * fogMul)},${Math.round(48 * fogMul)},${Math.round(32 * fogMul)},0.96)`;
  ctx.fillRect(
    _snap(centerX - doorW * 0.5, 1),
    _snap(bottom - doorH, 1),
    Math.max(1, Math.round(doorW)),
    Math.max(1, Math.round(doorH)),
  );
}

function _drawDimetricGranaryPrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, metrics) {
  const width = Math.max(tileW * 0.72, metrics.bodyWidth * 0.50);
  const height = Math.max(tileH * 1.05, metrics.bodyHeight * 0.58);
  const bottom = centerY + tileH * 0.10;
  const top = bottom - height;
  const left = centerX - width * 0.5;
  const right = centerX + width * 0.5;
  const roofPeakY = top - Math.max(3, tileH * 0.36);
  const wallColor = `rgb(${Math.round(170 * fogMul)},${Math.round(142 * fogMul)},${Math.round(98 * fogMul)})`;
  const roofColor = `rgb(${Math.round(118 * fogMul)},${Math.round(78 * fogMul)},${Math.round(52 * fogMul)})`;
  const roofShade = `rgb(${Math.round(94 * fogMul)},${Math.round(60 * fogMul)},${Math.round(40 * fogMul)})`;

  ctx.fillStyle = `rgba(0,0,0,${0.16 * fogMul})`;
  ctx.beginPath();
  _ellipse(ctx, centerX + tileW * 0.04, bottom + tileH * 0.05, width * 0.46, tileH * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wallColor;
  ctx.fillRect(_snap(left, 1), _snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(_snap(left - tileW * 0.06, 1), _snap(top + tileH * 0.08, 1));
  ctx.lineTo(_snap(centerX, 1), _snap(roofPeakY, 1));
  ctx.lineTo(_snap(right + tileW * 0.06, 1), _snap(top + tileH * 0.08, 1));
  ctx.lineTo(_snap(right, 1), _snap(top + tileH * 0.24, 1));
  ctx.lineTo(_snap(left, 1), _snap(top + tileH * 0.24, 1));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = roofShade;
  ctx.lineWidth = Math.max(1, tileW * 0.03);
  ctx.stroke();
}

function _drawDimetricBuildingPrimitive(ctx, buildingEntry, tileW, tileH) {
  if (!ctx || !buildingEntry) return;
  const metrics = buildingEntry.metrics || null;
  if (!metrics) return;
  const defId = String(buildingEntry.def?.id || buildingEntry.building?.defId || '').toLowerCase();
  const fogMul = buildingEntry.fogLevel === 1 ? 0.60 : 1.0;
  ctx.save();
  ctx.globalAlpha *= buildingEntry.fogLevel === 1 ? 0.68 : 1.0;
  if (defId === 'wall') {
    _drawDimetricWallPrimitive(
      ctx,
      buildingEntry.sx,
      buildingEntry.sy,
      tileW,
      tileH,
      fogMul,
      buildingEntry.wallVariant || 'pillar',
    );
  } else if (defId === 'keep') {
    _drawDimetricKeepPrimitive(ctx, buildingEntry.sx, buildingEntry.sy, tileW, tileH, fogMul, metrics);
  } else if (defId === 'gatehouse') {
    _drawDimetricGatehousePrimitive(ctx, buildingEntry.sx, buildingEntry.sy, tileW, tileH, fogMul, metrics);
  } else {
    _drawDimetricGranaryPrimitive(ctx, buildingEntry.sx, buildingEntry.sy, tileW, tileH, fogMul, metrics);
  }
  ctx.restore();
}

function _worldToTileCoord(worldCoord, tileSize) {
  const safeTileSize = Math.max(1, Number.isFinite(tileSize) ? tileSize : 32);
  return (Number.isFinite(worldCoord) ? worldCoord : 0) / safeTileSize - 0.5;
}

function _rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

function _nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

const _DIMETRIC_LOD_ORDER = Object.freeze(['full', 'reduced', 'minimal']);

function _getDimetricLodLevel(zoom) {
  const z = Number.isFinite(zoom) ? Number(zoom) : 1;
  if (z >= 0.85) return 'full';
  if (z >= 0.58) return 'reduced';
  return 'minimal';
}

function _applyDimetricLodBias(baseLod, bias = 0) {
  const baseIdx = _DIMETRIC_LOD_ORDER.indexOf(baseLod);
  const safeBase = baseIdx >= 0 ? baseIdx : 0;
  const safeBias = Math.max(0, Math.floor(Number.isFinite(bias) ? bias : 0));
  const idx = Math.max(0, Math.min(_DIMETRIC_LOD_ORDER.length - 1, safeBase + safeBias));
  return _DIMETRIC_LOD_ORDER[idx];
}

function _drawDimetricForestGlyph(ctx, cx, cy, tileW, tileH, fogLevel, tx, ty, variant = null) {
  const fogMul = fogLevel === 1 ? 0.62 : 1.0;
  const noise = _terrainNoise(tx * 0.91, ty * 1.13, 4411);
  const v = variant && variant.kind === 'forest'
    ? variant
    : resolveDimetricNatureVariant({ kind: 'forest', tx, ty, fogLevel });
  const scale = (0.92 + noise * 0.25) * (Number.isFinite(v?.scale) ? Math.max(0.78, Math.min(1.32, Number(v.scale))) : 1.0);
  const trunkH = tileH * 0.55 * scale;
  const crownW = tileW * 0.56 * scale;
  const crownH = tileH * 1.45 * scale;
  const baseY = cy + tileH * 0.38;
  const lean = Number.isFinite(v?.lean) ? Math.max(-0.14, Math.min(0.14, Number(v.lean))) : 0;
  const crownBias = Number.isFinite(v?.crownBias) ? Math.max(-0.20, Math.min(0.20, Number(v.crownBias))) : 0;
  const tint = Number.isFinite(v?.tint) ? Math.max(-0.18, Math.min(0.18, Number(v.tint))) : 0;
  const trunkX = cx - tileW * 0.05 + (tileW * lean * 0.28);
  const isBroadleaf = v?.family === 'broadleaf';

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.22 * fogMul})`;
  ctx.beginPath();
  _ellipse(
    ctx,
    cx + tileW * (0.08 + lean * 0.15),
    baseY + tileH * 0.03,
    tileW * 0.26 * scale,
    tileH * 0.13 * scale,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round((78 + tint * 26) * fogMul)},${Math.round((58 + tint * 12) * fogMul)},${Math.round((36 - tint * 6) * fogMul)})`;
  ctx.fillRect(
    _snap(trunkX, 1),
    _snap(baseY - trunkH * 0.92, 1),
    _snap(tileW * 0.10, 1),
    _snap(trunkH, 1),
  );

  if (isBroadleaf) {
    const foliageBase = [
      52 + (tint * 16),
      88 + (tint * 21),
      41 + (tint * 10),
    ];
    const lobes = [
      { dx: -0.24, dy: -0.74, rx: 0.36, ry: 0.28, shade: 8 },
      { dx: 0.00, dy: -0.96, rx: 0.42, ry: 0.31, shade: 14 },
      { dx: 0.28, dy: -0.72, rx: 0.33, ry: 0.27, shade: 6 },
      { dx: -0.02, dy: -0.58, rx: 0.48, ry: 0.30, shade: -4 },
    ];
    for (const lobe of lobes) {
      ctx.fillStyle = `rgb(${_clampByte((foliageBase[0] + lobe.shade) * fogMul)},${_clampByte((foliageBase[1] + lobe.shade) * fogMul)},${_clampByte((foliageBase[2] + lobe.shade) * fogMul)})`;
      ctx.beginPath();
      _ellipse(
        ctx,
        cx + tileW * (lobe.dx + (lean * 0.18)),
        baseY + crownH * lobe.dy,
        crownW * lobe.rx,
        crownH * lobe.ry,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    const tiers = [
      { y: -0.18 + crownBias * 0.16, w: 1.0, h: 1.0, shade: 0 },
      { y: -0.54 + crownBias * 0.08, w: 0.80, h: 0.84, shade: 6 },
      { y: -0.86 + crownBias * 0.04, w: 0.61, h: 0.72, shade: 11 },
    ];
    for (const tier of tiers) {
      const yy = baseY - (crownH * tier.y * -1);
      const w = crownW * tier.w;
      const h = crownH * 0.34 * tier.h;
      const g = Math.round((82 + tier.shade + tint * 24) * fogMul);
      const r = Math.round((34 + (tier.shade * 0.36) + tint * 10) * fogMul);
      const b = Math.round((28 + (tier.shade * 0.30) + tint * 5) * fogMul);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx + tileW * lean * 0.16, 1), _snap(yy - h, 1));
      ctx.lineTo(_snap(cx + w + tileW * lean * 0.20, 1), _snap(yy + h * 0.1, 1));
      ctx.lineTo(_snap(cx - w + tileW * lean * 0.12, 1), _snap(yy + h * 0.1, 1));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(${Math.round((120 + tint * 20) * fogMul)},${Math.round((152 + tint * 24) * fogMul)},${Math.round((92 + tint * 14) * fogMul)},0.24)`;
      ctx.beginPath();
      ctx.moveTo(_snap(cx - w * 0.64 + tileW * lean * 0.10, 1), _snap(yy + h * 0.02, 1));
      ctx.lineTo(_snap(cx - w * 0.08 + tileW * lean * 0.12, 1), _snap(yy - h * 0.42, 1));
      ctx.lineTo(_snap(cx - w * 0.02 + tileW * lean * 0.12, 1), _snap(yy + h * 0.06, 1));
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function _drawDimetricGroundDecalGlyph(ctx, cx, cy, tileW, tileH, fogLevel, decal = null) {
  if (!ctx || !decal) return;
  const alpha = Math.max(0.16, Math.min(0.82, Number(decal.alpha) || 0.42)) * (fogLevel === 1 ? 0.66 : 1.0);
  const scale = Math.max(0.22, Math.min(0.90, Number(decal.scale) || 0.42));
  const ox = tileW * (Number.isFinite(decal.offsetX) ? decal.offsetX : 0);
  const oy = tileH * (Number.isFinite(decal.offsetY) ? decal.offsetY : 0);
  const tone = Math.max(-0.20, Math.min(0.20, Number(decal.tone) || 0));
  const baseX = cx + ox;
  const baseY = cy + tileH * (0.34 + oy / Math.max(1, tileH));
  const type = String(decal.type || 'grass_tuft');

  const stone = [114 + tone * 40, 122 + tone * 36, 128 + tone * 34];
  const grass = [86 + tone * 22, 121 + tone * 22, 58 + tone * 18];
  const dry = [126 + tone * 22, 112 + tone * 18, 76 + tone * 16];
  const flower = [176 + tone * 24, 112 + tone * 18, 142 + tone * 20];

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'stone_chip' || type === 'drift') {
    const w = tileW * (0.14 + scale * 0.20);
    const h = tileH * (0.10 + scale * 0.16);
    ctx.fillStyle = _rgb(stone, 0.92);
    ctx.beginPath();
    ctx.moveTo(_snap(baseX - w * 0.54, 1), _snap(baseY + h * 0.06, 1));
    ctx.lineTo(_snap(baseX - w * 0.08, 1), _snap(baseY - h * 0.44, 1));
    ctx.lineTo(_snap(baseX + w * 0.48, 1), _snap(baseY - h * 0.08, 1));
    ctx.lineTo(_snap(baseX + w * 0.22, 1), _snap(baseY + h * 0.42, 1));
    ctx.closePath();
    ctx.fill();
  } else if (type === 'frost_patch') {
    const w = tileW * (0.12 + scale * 0.24);
    const h = tileH * (0.10 + scale * 0.18);
    ctx.fillStyle = `rgba(${_clampByte(188 + tone * 22)},${_clampByte(210 + tone * 18)},${_clampByte(228 + tone * 16)},0.85)`;
    ctx.beginPath();
    _ellipse(ctx, baseX, baseY, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'flower_patch') {
    const petalR = Math.max(1, tileH * (0.05 + scale * 0.09));
    const spread = Math.max(1, tileW * (0.04 + scale * 0.10));
    ctx.fillStyle = _rgb(flower, 0.84);
    for (let i = 0; i < 4; i += 1) {
      const a = (Math.PI * 2 * i) / 4;
      ctx.beginPath();
      _ellipse(
        ctx,
        baseX + Math.cos(a) * spread,
        baseY + Math.sin(a) * spread * 0.75,
        petalR,
        petalR * 0.82,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(245,222,112,0.82)';
    ctx.beginPath();
    _ellipse(ctx, baseX, baseY, petalR * 0.58, petalR * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'reed') {
    const h = tileH * (0.18 + scale * 0.42);
    const w = tileW * 0.03;
    ctx.strokeStyle = _rgb(grass, 0.86);
    ctx.lineWidth = Math.max(1, w);
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(_snap(baseX + i * tileW * 0.04, 1), _snap(baseY + tileH * 0.06, 1));
      ctx.lineTo(_snap(baseX + i * tileW * 0.02 + tileW * 0.03, 1), _snap(baseY - h, 1));
      ctx.stroke();
    }
  } else {
    const isLeaf = type === 'leaf_litter' || type === 'moss_patch';
    const color = isLeaf ? grass : dry;
    const widthMul = type === 'moss_patch' ? 0.28 : 0.22;
    const heightMul = type === 'moss_patch' ? 0.16 : 0.12;
    ctx.fillStyle = _rgb(color, 0.82);
    ctx.beginPath();
    _ellipse(
      ctx,
      baseX,
      baseY,
      tileW * (widthMul + scale * 0.12),
      tileH * (heightMul + scale * 0.08),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    if (!isLeaf) {
      ctx.strokeStyle = _rgb(_shade(color, 14), 0.90);
      ctx.lineWidth = Math.max(1, tileW * 0.03);
      ctx.beginPath();
      ctx.moveTo(_snap(baseX - tileW * 0.04, 1), _snap(baseY + tileH * 0.02, 1));
      ctx.lineTo(_snap(baseX, 1), _snap(baseY - tileH * (0.08 + scale * 0.16), 1));
      ctx.lineTo(_snap(baseX + tileW * 0.04, 1), _snap(baseY + tileH * 0.02, 1));
      ctx.stroke();
    }
  }

  ctx.restore();
}

function _drawDimetricMountainGlyph(ctx, cx, cy, tileW, tileH, fogLevel, mode, tx, ty, variant = null) {
  const fogMul = fogLevel === 1 ? 0.62 : 1.0;
  const noise = _terrainNoise(tx * 1.07, ty * 0.73, 7721);
  const v = variant && (variant.kind === 'mountain' || variant.kind === 'mountain_large')
    ? variant
    : resolveDimetricNatureVariant({ kind: mode === 'large' ? 'mountain_large' : 'mountain', tx, ty, fogLevel });
  const varScale = Number.isFinite(v?.scale) ? Math.max(0.88, Math.min(1.55, Number(v.scale))) : 1.0;
  const scale = (mode === 'large' ? 1.3 : 1.0) * (0.94 + noise * 0.2) * varScale;
  const skew = Number.isFinite(v?.skew) ? Math.max(-0.16, Math.min(0.16, Number(v.skew))) : 0;
  const tint = Number.isFinite(v?.tint) ? Math.max(-0.18, Math.min(0.18, Number(v.tint))) : 0;
  const baseY = cy + tileH * 0.56 * scale;
  const halfBase = tileW * 0.42 * scale;
  const skewPx = tileW * skew * 0.62;
  const apexY = cy - tileH * 1.28 * scale;
  const apexX = cx + skewPx * 0.45;
  const baseLeftX = cx - halfBase + skewPx;
  const baseRightX = cx + halfBase + skewPx;

  ctx.save();
  ctx.fillStyle = `rgb(${Math.round((78 + tint * 22) * fogMul)},${Math.round((88 + tint * 20) * fogMul)},${Math.round((102 + tint * 18) * fogMul)})`;
  ctx.beginPath();
  ctx.moveTo(_snap(baseLeftX, 1), _snap(baseY, 1));
  ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
  ctx.lineTo(_snap(baseRightX, 1), _snap(baseY, 1));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round((142 + tint * 16) * fogMul)},${Math.round((154 + tint * 14) * fogMul)},${Math.round((168 + tint * 12) * fogMul)})`;
  ctx.beginPath();
  ctx.moveTo(_snap(baseLeftX, 1), _snap(baseY, 1));
  ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
  ctx.lineTo(_snap(baseLeftX + halfBase * 0.82, 1), _snap(baseY, 1));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${Math.round((56 + tint * 14) * fogMul)},${Math.round((64 + tint * 12) * fogMul)},${Math.round((76 + tint * 10) * fogMul)})`;
  ctx.beginPath();
  ctx.moveTo(_snap(apexX + halfBase * 0.05, 1), _snap(baseY, 1));
  ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
  ctx.lineTo(_snap(baseRightX, 1), _snap(baseY, 1));
  ctx.closePath();
  ctx.fill();

  const snowAlpha = Math.max(0, Math.min(0.78, Number.isFinite(v?.snow) ? Number(v.snow) : 0.36));
  if (snowAlpha > 0.03 && fogLevel > 0) {
    const alpha = Math.max(0.14, Math.min(0.72, (fogLevel === 1 ? 0.50 : 0.78) * snowAlpha));
    ctx.fillStyle = `rgba(236,244,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(_snap(apexX - halfBase * 0.10, 1), _snap(apexY + tileH * 0.34 * scale, 1));
    ctx.lineTo(_snap(apexX, 1), _snap(apexY, 1));
    ctx.lineTo(_snap(apexX + halfBase * 0.16, 1), _snap(apexY + tileH * 0.26 * scale, 1));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function _drawStrongholdForestSpriteBillboard(ctx, {
  tx,
  ty,
  centerX,
  centerY,
  tileW,
  tileH,
  fogLevel,
  variant,
  sprites,
} = {}) {
  if (!ctx || !Array.isArray(sprites) || sprites.length === 0) return false;
  const noise = _terrainNoise((tx * 0.63) + 2.7, (ty * 0.79) + 6.1, 7127);
  const index = Math.max(0, Math.min(sprites.length - 1, Math.floor(noise * sprites.length)));
  const sprite = sprites[index];
  if (!sprite || !(sprite.width > 0) || !(sprite.height > 0)) return false;

  const variantScale = Number.isFinite(variant?.scale) ? Math.max(0.78, Math.min(1.48, Number(variant.scale))) : 1.0;
  const lean = Number.isFinite(variant?.lean) ? Math.max(-0.14, Math.min(0.14, Number(variant.lean))) : 0;
  const nScale = _terrainNoise((tx * 1.07) + 8.9, (ty * 0.53) + 3.4, 7441);
  const targetH = Math.max(10, tileH * (2.28 + nScale * 0.52) * variantScale);
  const targetW = targetH * (sprite.width / sprite.height);
  const baseY = centerY + tileH * 0.58;
  const jitterX = tileW * 0.08 * (_terrainNoise((tx * 0.91) + 4.3, (ty * 0.69) + 7.8, 7823) - 0.5);
  const dx = _snap(centerX - (targetW * 0.5) + jitterX + (tileW * lean * 0.26), 1);
  const dy = _snap(baseY - targetH, 1);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = fogLevel === 1 ? 0.62 : 1.0;
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  _ellipse(
    ctx,
    centerX + tileW * (0.04 + lean * 0.14),
    baseY + tileH * 0.02,
    Math.max(2, targetW * 0.22),
    Math.max(2, targetH * 0.060),
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.drawImage(sprite, dx, dy, Math.round(targetW), Math.round(targetH));
  ctx.restore();
  return true;
}

function _drawDimetricPropBillboard(ctx, {
  kind,
  tx,
  ty,
  centerX,
  centerY,
  tileW,
  tileH,
  fogLevel,
  variant,
  styleProfile = 'stronghold',
} = {}) {
  if (!ctx || !kind) return false;
  const entry = _pickPropFrame(kind, tx, ty);
  if (!entry?.frame) return false;
  const canvas = _getStyledPropCanvas(entry, kind, styleProfile);
  if (!canvas) return false;

  const fw = canvas.width || 1;
  const fh = canvas.height || 1;
  const noise = _terrainNoise(tx * 0.39 + 7, ty * 0.33 + 9, kind === 'FOREST' ? 3119 : kind === 'MOUNTAIN_LARGE' ? 3151 : 3137);
  const baseScale = kind === 'FOREST'
    ? 1.96
    : kind === 'MOUNTAIN_LARGE'
      ? 2.88
      : 2.26;
  const dynScale = kind === 'FOREST'
    ? 0.32
    : kind === 'MOUNTAIN_LARGE'
      ? 0.36
      : 0.30;
  const variantScale = Number.isFinite(variant?.scale) ? Math.max(0.78, Math.min(1.55, Number(variant.scale))) : 1.0;
  const variantJitter = Number.isFinite(variant?.lean)
    ? Number(variant.lean) * 0.45
    : Number.isFinite(variant?.skew)
      ? Number(variant.skew) * 0.45
      : 0;
  const variantTint = Number.isFinite(variant?.tint) ? Math.max(-0.18, Math.min(0.18, Number(variant.tint))) : 0;
  const targetH = Math.max(8, tileH * (baseScale + noise * dynScale) * variantScale);
  const targetW = targetH * (fw / fh);
  const jitter = kind === 'FOREST' ? tileW * 0.06 : tileW * 0.08;
  const jitterX = jitter * ((_terrainNoise(tx * 0.91, ty * 0.73, 3163) - 0.5) + variantJitter);
  const baseY = centerY + tileH * 0.58;
  const dx = _snap(centerX - (targetW * 0.5) + jitterX, 1);
  const dy = _snap(baseY - targetH, 1);

  ctx.save();
  const alpha = (fogLevel === 1 ? 0.62 : 1.0) * (1 - Math.max(0, variantTint * 0.28));
  ctx.globalAlpha = Math.max(0.45, Math.min(1.0, alpha));
  ctx.imageSmoothingEnabled = false;
  if (kind === 'FOREST') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    _ellipse(ctx, centerX + tileW * 0.03, baseY + tileH * 0.04, targetW * 0.26, Math.max(2, targetH * 0.055), 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = kind === 'MOUNTAIN_LARGE' ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    _ellipse(ctx, centerX + 1, baseY + tileH * 0.04, targetW * 0.30, Math.max(2, targetH * 0.065), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.drawImage(canvas, dx, dy, Math.round(targetW), Math.round(targetH));
  ctx.restore();
  return true;
}

export class RenderManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    const projection = resolveProjectionMode(Boolean(CONST.DIMETRIC?.USE_DIMETRIC), {
      allowLegacyUrlOverride: Boolean(this.state?.devMode),
      allowLegacyRuntime: Boolean(this.state?.devMode),
    });
    this.useDimetric = Boolean(projection?.dimetricEnabled);
    this.projectionMode = projection?.mode || (this.useDimetric ? 'dimetric' : 'legacy_topdown');
    this.projectionSource = projection?.source || 'default';
    this.dimetricPropStyleProfile = resolveDimetricPropStyleProfile('stronghold', {
      allowUrlOverride: Boolean(this.state?.devMode),
    });
    this.dimetricWireframeEnabled = resolveDimetricWireframeEnabled(
      Boolean(CONST.DIMETRIC?.DEBUG_WIREFRAME_ENABLED),
      { allowUrlOverride: Boolean(this.state?.devMode) },
    );
    this.dimetricOverlayState = null;
    this.dimetricRoundTrip = null;
    this.dimetricLastRoundTripAt = 0;
    this.dimetricTerrainCache = new DimetricTerrainChunkCache({
      chunkSize: Number(CONST.DIMETRIC?.TERRAIN_CHUNK_SIZE) || 16,
      maxChunks: Number(CONST.DIMETRIC?.TERRAIN_MAX_CHUNKS) || 192,
    });
    this.dimetricPerformance = new DimetricPerformanceManager();
    this.dimetricQualityProfile = this.dimetricPerformance.getQualityProfile();
    this.dimetricAverageFps = this.dimetricPerformance.getAverageFps();
    this.dimetricLastFrameMs = 1000 / 60;
    this.worldFeatureIndexCache = {
      mapRef: null,
      forestLen: -1,
      mountainLen: -1,
      forestSet: new Set(),
      mountainSet: new Set(),
    };
    this.dimetricLodLevel = 'full';
    this.dimetricActorVisualState = new Map();
    this.dimetricAmbientLastCount = 0;
    this.dimetricStageTelemetry = [];
    this.dimetricStrongholdTreeSprites = null;
    this.dimetricStrongholdGroundVariants = null;
  }

  init(game) {
    this.game = game;
    const manifestOverride = this.state?.devMode && typeof window !== 'undefined'
      ? (new URL(window.location.href).searchParams.get('manifest') || '').trim()
      : '';
    const projection = resolveProjectionMode(Boolean(CONST.DIMETRIC?.USE_DIMETRIC), {
      allowLegacyUrlOverride: Boolean(this.state?.devMode),
      allowLegacyRuntime: Boolean(this.state?.devMode),
    });
    this.useDimetric = Boolean(projection?.dimetricEnabled);
    this.projectionMode = projection?.mode || (this.useDimetric ? 'dimetric' : 'legacy_topdown');
    this.projectionSource = projection?.source || 'default';
    this.dimetricPropStyleProfile = resolveDimetricPropStyleProfile('stronghold', {
      allowUrlOverride: Boolean(this.state?.devMode),
    });
    this.dimetricWireframeEnabled = resolveDimetricWireframeEnabled(
      Boolean(CONST.DIMETRIC?.DEBUG_WIREFRAME_ENABLED),
      { allowUrlOverride: Boolean(this.state?.devMode) },
    );
    if (!this.useDimetric) {
      utils.warnOnce(
        'render:legacy_topdown_active',
        '[RenderManager] Legacy top-down renderer is active (explicit override or config).',
      );
    }
    const manifestUrl = manifestOverride || 'assets/manifest.json';
    this.game.spriteLoader = this.game.spriteLoader || new SpriteLoader(manifestUrl, {
      devMode: this.state?.devMode,
      warnOnce: utils.warnOnce,
      devLog: utils.devLog,
    });
  }

  getCachedWorldFeatureSets(map) {
    if (!map) return { forestSet: new Set(), mountainSet: new Set() };
    const forests = Array.isArray(map.forests) ? map.forests : [];
    const mountains = Array.isArray(map.mountains) ? map.mountains : [];
    const cache = this.worldFeatureIndexCache;
    const needsRebuild = cache.mapRef !== map
      || cache.forestLen !== forests.length
      || cache.mountainLen !== mountains.length;

    if (needsRebuild) {
      cache.mapRef = map;
      cache.forestLen = forests.length;
      cache.mountainLen = mountains.length;
      cache.forestSet = new Set(forests.map((f) => `${f.x},${f.y}`));
      cache.mountainSet = new Set(mountains.map((m) => `${m.x},${m.y}`));
    }

    return { forestSet: cache.forestSet, mountainSet: cache.mountainSet };
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
    const frameStartMs = _nowMs();
    const stageBreakdown = {};
    let stageMarkMs = frameStartMs;
    const markStage = (stageName) => {
      if (!this.useDimetric || typeof stageName !== 'string' || !stageName) return;
      const now = _nowMs();
      stageBreakdown[stageName] = Math.max(0, now - stageMarkMs);
      stageMarkMs = now;
    };
    const camera = g.worldManager.getCameraSafe();
    g.worldManager.clampCameraToWorld();
    g.ctx.imageSmoothingEnabled = false;
    g.ctx.fillStyle = '#1a1a1a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    if (this.useDimetric) {
      this.dimetricQualityProfile = this.dimetricPerformance.getQualityProfile();
    }

    if (this.useDimetric) {
      this.renderWorldTerrain(g.ctx, camera);
      this.renderWorldOverlays(g.ctx, camera);
    } else {
      g.ctx.save();
      g.ctx.scale(camera.zoom, camera.zoom);
      g.ctx.translate(-camera.x, -camera.y);

      this.renderWorldTerrain(g.ctx, camera);
      this.renderWorldOverlays(g.ctx, camera);

      g.ctx.restore();
    }
    markStage('world');

    if (this.useDimetric && this.dimetricWireframeEnabled) {
      this.renderDimetricWireframeOverlay(g.ctx, camera);
    } else if (this.useDimetric) {
      this.dimetricOverlayState = null;
      this.dimetricRoundTrip = null;
    }

    if (this.useDimetric && CONST.DIMETRIC?.ATMOSPHERE_ENABLED !== false) {
      const weatherState = g.uiManager?.weatherState || this.state?.weatherState || null;
      const atmosphere = resolveDimetricAtmosphere(weatherState, {
        qualityLevel: this.dimetricQualityProfile?.level,
      });
      renderDimetricAtmosphereOverlay(g.ctx, g.canvas.width, g.canvas.height, atmosphere);
    }

    const weatherTint = getWeatherTint(g.uiManager.weatherState || this.state?.weatherState, g.uiManager.getWeatherConfig());
    renderWeatherOverlay(g.ctx, g.canvas.width, g.canvas.height, weatherTint);
    markStage('fx');

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
    markStage('ui');

    if (this.useDimetric) {
      const frameMs = Math.max(0.01, _nowMs() - frameStartMs);
      this.dimetricLastFrameMs = frameMs;
      this.dimetricPerformance.recordFrameMs(frameMs);
      this.dimetricPerformance.recordFrameBreakdown(stageBreakdown);
      this.dimetricStageTelemetry = this.dimetricPerformance.getStageTelemetry(3);
      this.dimetricAverageFps = this.dimetricPerformance.getAverageFps();
      this.dimetricQualityProfile = this.dimetricPerformance.getQualityProfile();
    }
  }

  renderDimetricWireframeOverlay(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!ctx || !camera || !g?.canvas || !map) return;

    const view = buildDimetricCameraConfig({
      camera,
      map,
      canvas: g.canvas,
      tileSize: CONST.WORLD?.TILE_SIZE,
      tileW: CONST.DIMETRIC?.TILE_W,
      tileH: CONST.DIMETRIC?.TILE_H,
      elevationPx: CONST.DIMETRIC?.ELEVATION_PX,
    });
    if (!view?.config) return;

    const mapWidth = view.mapWidth;
    const mapHeight = view.mapHeight;
    const gridSize = Math.max(4, Math.floor(Number(CONST.DIMETRIC?.DEBUG_WIREFRAME_SIZE) || 16));
    const half = Math.floor(gridSize * 0.5);
    const anchorTileX = view.anchorTileX;
    const anchorTileY = view.anchorTileY;
    const startTileX = Math.max(0, Math.min(mapWidth - 1, anchorTileX - half));
    const startTileY = Math.max(0, Math.min(mapHeight - 1, anchorTileY - half));
    const anchorWorldX = view.anchorWorldX;
    const anchorWorldY = view.anchorWorldY;

    const highlightTile = (() => {
      const mouseX = Number.isFinite(g.input?.mouse?.x) ? g.input.mouse.x : 0;
      const mouseY = Number.isFinite(g.input?.mouse?.y) ? g.input.mouse.y : 0;
      const picked = screenToWorldPrecise(mouseX, mouseY, camera, view.config, 0);
      return {
        x: Math.max(0, Math.min(mapWidth - 1, picked.tileX)),
        y: Math.max(0, Math.min(mapHeight - 1, picked.tileY)),
      };
    })();

    const overlayState = drawDimetricWireframe(ctx, camera, {
      tileW: Number(CONST.DIMETRIC?.TILE_W) || 64,
      tileH: Number(CONST.DIMETRIC?.TILE_H) || 32,
      elevationPx: Number(CONST.DIMETRIC?.ELEVATION_PX) || 24,
      startTileX,
      startTileY,
      size: gridSize,
      anchorTileX,
      anchorTileY,
      anchorWorldX,
      anchorWorldY,
      lineColor: `rgba(248, 221, 129, ${Number(CONST.DIMETRIC?.DEBUG_WIREFRAME_ALPHA) || 0.9})`,
      centerColor: 'rgba(255, 120, 120, 0.95)',
      highlightTile,
    });
    this.dimetricOverlayState = overlayState;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (overlayState && (now - this.dimetricLastRoundTripAt) > 1000) {
      this.dimetricLastRoundTripAt = now;
      this.dimetricRoundTrip = runWireframeRoundTripSuite({
        startTileX,
        startTileY,
        size: gridSize,
        camera,
        config: overlayState.config,
      });
    }
  }

  renderWorldOverlays(ctx, camera) {
    const g = this.game;
    if (!ctx || !camera || !g.playerParty) return;
    if (this.useDimetric) {
      this.renderDimetricWorldOverlays(ctx, camera);
      return;
    }

    const lineBase = 2 / camera.zoom;
    const party = g.playerParty;
    const qualityProfile = this.dimetricQualityProfile || this.dimetricPerformance.getQualityProfile();
    const canRenderBanners = typeof ctx.closePath === 'function'
      && typeof ctx.createLinearGradient === 'function'
      && typeof ctx.measureText === 'function'
      && typeof ctx.arcTo === 'function'
      && qualityProfile?.enableBanners !== false;

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

  renderDimetricWorldOverlays(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!ctx || !camera || !g.playerParty || !map || !g.canvas) return;

    const tileSize = Math.max(1, Number(CONST.WORLD?.TILE_SIZE) || 32);
    const view = buildDimetricCameraConfig({
      camera,
      map,
      canvas: g.canvas,
      tileSize,
      tileW: CONST.DIMETRIC?.TILE_W,
      tileH: CONST.DIMETRIC?.TILE_H,
      elevationPx: CONST.DIMETRIC?.ELEVATION_PX,
    });
    if (!view?.config) return;

    const projectWorld = (wx, wy) => worldToScreen(
      _worldToTileCoord(wx, tileSize),
      _worldToTileCoord(wy, tileSize),
      camera,
      view.config,
      0,
    );

    const lineBase = Math.max(1, 1.35 * camera.zoom);
    const party = g.playerParty;
    const partyScreen = projectWorld(party.x, party.y);
    const partyRadius = Math.max(6, (Number(party.radius) || 10) * Math.max(0.45, camera.zoom * 0.52));
    const mapWidth = Math.max(1, Number.isFinite(map.width) ? map.width : Number(CONST.WORLD?.MAP_WIDTH) || 1);
    const mapHeight = Math.max(1, Number.isFinite(map.height) ? map.height : Number(CONST.WORLD?.MAP_HEIGHT) || 1);
    const fog = map.fog instanceof Uint8Array ? map.fog : null;
    const halfW = view.config.tileW * camera.zoom * 0.5;
    const halfH = view.config.tileH * camera.zoom * 0.5;
    const drawTileHighlight = (tileX, tileY, {
      fill = 'rgba(120,200,255,0.14)',
      stroke = 'rgba(120,200,255,0.82)',
      lineWidth = Math.max(1.1, 1.6 * camera.zoom),
      requiresVisibleFog = true,
    } = {}) => {
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
      const tx = Math.floor(tileX);
      const ty = Math.floor(tileY);
      if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) return;
      if (requiresVisibleFog && fog && fog[ty * mapWidth + tx] === 0) return;
      const c = worldToScreen(tx, ty, camera, view.config, 0);
      _drawScreenDiamond(ctx, c.x, c.y, halfW, halfH);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    if (Number.isFinite(g.mouseTileX) && Number.isFinite(g.mouseTileY)) {
      drawTileHighlight(g.mouseTileX, g.mouseTileY, {
        fill: 'rgba(120,200,255,0.13)',
        stroke: 'rgba(120,200,255,0.80)',
        lineWidth: Math.max(1.0, 1.5 * camera.zoom),
      });
    }

    const buildMode = g.mapBuildMode && typeof g.mapBuildMode === 'object' ? g.mapBuildMode : null;
    if (buildMode?.active && Number.isFinite(g.mouseTileX) && Number.isFinite(g.mouseTileY)) {
      const def = getBuildingDef(buildMode.defId);
      if (def) {
        const anchorX = Math.floor(g.mouseTileX);
        const anchorY = Math.floor(g.mouseTileY);
        const placement = g.worldManager?.canPlaceBuilding?.(def.id, anchorX, anchorY);
        const canPlace = placement?.ok === true;
        const offsets = Array.isArray(def.footprint) && def.footprint.length > 0
          ? def.footprint
          : [{ dx: 0, dy: 0 }];
        const fill = canPlace ? 'rgba(95,210,120,0.20)' : 'rgba(228,92,92,0.18)';
        const stroke = canPlace ? 'rgba(95,210,120,0.92)' : 'rgba(228,92,92,0.92)';
        for (const tile of offsets) {
          const tx = anchorX + Math.floor(Number.isFinite(tile?.dx) ? tile.dx : 0);
          const ty = anchorY + Math.floor(Number.isFinite(tile?.dy) ? tile.dy : 0);
          drawTileHighlight(tx, ty, {
            fill,
            stroke,
            lineWidth: Math.max(1.0, 1.55 * camera.zoom),
            requiresVisibleFog: false,
          });
        }
      }
    }

    if (buildMode?.selectedBuildingId) {
      const selected = g.worldManager?.getBuildingById?.(buildMode.selectedBuildingId);
      if (selected) {
        const selectedDef = getBuildingDef(selected.defId);
        const offsets = Array.isArray(selectedDef?.footprint) && selectedDef.footprint.length > 0
          ? selectedDef.footprint
          : [{ dx: 0, dy: 0 }];
        for (const tile of offsets) {
          const tx = Math.floor(Number(selected.anchorX) || 0) + Math.floor(Number.isFinite(tile?.dx) ? tile.dx : 0);
          const ty = Math.floor(Number(selected.anchorY) || 0) + Math.floor(Number.isFinite(tile?.dy) ? tile.dy : 0);
          drawTileHighlight(tx, ty, {
            fill: 'rgba(245,214,112,0.13)',
            stroke: 'rgba(245,214,112,0.84)',
            lineWidth: Math.max(1.0, 1.45 * camera.zoom),
            requiresVisibleFog: false,
          });
        }
      }
    }

    if (party.hasDestination && Number.isFinite(party.destX) && Number.isFinite(party.destY)) {
      drawTileHighlight(Math.floor(party.destX / tileSize), Math.floor(party.destY / tileSize), {
        fill: 'rgba(212,175,55,0.12)',
        stroke: 'rgba(212,175,55,0.84)',
        lineWidth: Math.max(1.0, 1.5 * camera.zoom),
        requiresVisibleFog: false,
      });
      const dest = projectWorld(party.destX, party.destY);
      ctx.strokeStyle = 'rgba(212,175,55,0.56)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(partyScreen.x, partyScreen.y);
      ctx.lineTo(dest.x, dest.y);
      ctx.stroke();

      const d = Math.max(4, 6 * camera.zoom);
      ctx.strokeStyle = 'rgba(212,175,55,0.92)';
      ctx.beginPath();
      ctx.moveTo(dest.x - d, dest.y);
      ctx.lineTo(dest.x + d, dest.y);
      ctx.moveTo(dest.x, dest.y - d);
      ctx.lineTo(dest.x, dest.y + d);
      ctx.stroke();
    }

    if (party.selected && g.mode !== 'paused') {
      const mouse = projectWorld(g.mouseWorldX, g.mouseWorldY);
      ctx.strokeStyle = 'rgba(200,220,255,0.32)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(partyScreen.x, partyScreen.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }

    if (party.arrivalFeedbackTimer > 0) {
      const t = party.arrivalFeedbackTimer;
      const pulse = 1 - t;
      const radius = partyRadius + 8 + Math.sin(pulse * Math.PI * 4) * 2;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.15 + (t * 0.35)})`;
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(partyScreen.x, partyScreen.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (party.selected) {
      const encounterRadius = Math.max(
        partyRadius + 4,
        (party.radius + g.worldManager.encounterMargin) * Math.max(0.42, camera.zoom * 0.50),
      );
      ctx.strokeStyle = 'rgba(255,120,120,0.2)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(partyScreen.x, partyScreen.y, encounterRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = Math.max(1.5, 2.4 * camera.zoom);
      ctx.beginPath();
      ctx.arc(partyScreen.x, partyScreen.y, partyRadius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  renderDimetricWaterShimmer(ctx, camera, config, {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    resolveBiomeAt,
    fog,
    qualityProfile,
    timeMs,
  } = {}) {
    if (!ctx || !camera || !config || typeof resolveBiomeAt !== 'function') return 0;
    const SEA = Number(CONST.BIOME?.SEA ?? 0);
    const w = Math.max(1, Math.floor(Number(width) || 1));
    const h = Math.max(1, Math.floor(Number(height) || 1));
    const qualityLevel = Math.max(0, Math.floor(Number(qualityProfile?.level) || 0));
    const stride = getDimetricWaterShimmerStride({
      zoom: camera.zoom,
      qualityLevel,
    });
    const maxTiles = Math.max(24, Math.floor(Number(CONST.DIMETRIC?.WATER_SHIMMER_MAX_TILES) || 280));
    const halfW = config.tileW * camera.zoom * 0.5;
    const halfH = config.tileH * camera.zoom * 0.5;
    let drawn = 0;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    outer: for (let ty = minY; ty <= maxY; ty += stride) {
      if (ty < 0 || ty >= h) continue;
      for (let tx = minX; tx <= maxX; tx += stride) {
        if (drawn >= maxTiles) break outer;
        if (tx < 0 || tx >= w) continue;
        if (resolveBiomeAt(tx, ty) !== SEA) continue;
        const fogLevel = fog instanceof Uint8Array ? fog[(ty * w) + tx] : 2;
        if (fogLevel === 0) continue;

        const strength = getDimetricWaterShimmerStrength({
          timeMs,
          tx,
          ty,
          qualityLevel,
        });
        if (strength < 0.58) continue;

        const center = worldToScreen(tx, ty, camera, config, 0);
        const alpha = (fogLevel === 1 ? 0.05 : 0.08) + (strength * 0.16);
        const lineW = Math.max(0.6, (0.75 + (strength * 0.9)) * camera.zoom);
        ctx.strokeStyle = `rgba(218,236,255,${Math.max(0, Math.min(0.42, alpha)).toFixed(3)})`;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(center.x - (halfW * 0.26), center.y - (halfH * 0.08));
        ctx.lineTo(center.x + (halfW * 0.12), center.y - (halfH * 0.30));
        ctx.stroke();

        if (qualityLevel <= 1 && strength > 0.80) {
          ctx.strokeStyle = `rgba(240,248,255,${Math.max(0, Math.min(0.28, alpha * 0.78)).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.5, lineW * 0.68);
          ctx.beginPath();
          ctx.moveTo(center.x - (halfW * 0.05), center.y + (halfH * 0.04));
          ctx.lineTo(center.x + (halfW * 0.24), center.y - (halfH * 0.10));
          ctx.stroke();
        }

        drawn += 1;
      }
    }

    ctx.restore();
    return drawn;
  }

  renderDimetricAmbientParticles(ctx, camera, {
    settlementQueue,
    buildingQueue,
    screenTileW,
    screenTileH,
    lodLevel,
    qualityProfile,
    timeMs,
    weatherState,
    viewConfig,
    minX,
    minY,
    maxX,
    maxY,
    fog,
    mapWidth,
  } = {}) {
    if (!ctx || !camera) return 0;
    if (CONST.DIMETRIC?.AMBIENT_PARTICLES_ENABLED === false) return 0;
    const w = Math.max(1, Number(screenTileW) || 1);
    const h = Math.max(1, Number(screenTileH) || 1);
    const maxParticles = Math.max(0, Math.floor(Number(CONST.DIMETRIC?.AMBIENT_PARTICLE_MAX) || 120));
    const budget = getDimetricAmbientParticleBudget({
      lodLevel,
      qualityLevel: qualityProfile?.level,
      maxParticles,
    });
    if (budget <= 0) return 0;

    const sources = [];
    const buildingEntries = Array.isArray(buildingQueue) ? buildingQueue : [];
    const settlementEntries = Array.isArray(settlementQueue) ? settlementQueue : [];

    for (const entry of buildingEntries) {
      if (!entry || entry.fogLevel <= 0) continue;
      const defId = String(entry.def?.id || entry.building?.defId || '').toLowerCase();
      if (!defId || defId === 'wall') continue;
      const isPrimary = defId === 'keep' || defId === 'granary' || defId === 'gatehouse';
      const sourceCount = isPrimary ? 2 : 1;
      for (let i = 0; i < sourceCount; i += 1) {
        sources.push({
          x: entry.sx + ((i === 0 ? -1 : 1) * w * 0.06),
          y: entry.sy - h * (isPrimary ? 0.80 : 0.66),
          seed: (entry.building?.anchorX || 0) * 997 + (entry.building?.anchorY || 0) * 313 + i * 37 + defId.length * 13,
          puffCount: isPrimary ? 2 : 1,
          strength: isPrimary ? 1.0 : 0.8,
        });
      }
      if (sources.length >= 96) break;
    }

    for (const entry of settlementEntries) {
      if (!entry || entry.fogLevel <= 0) continue;
      const type = String(entry.settlement?.type || '').toLowerCase();
      if (!type) continue;
      const sourceCount = type === 'city'
        ? 3
        : type === 'town' || type === 'fort'
          ? 2
          : 1;
      for (let i = 0; i < sourceCount; i += 1) {
        sources.push({
          x: entry.sx + ((i - (sourceCount - 1) * 0.5) * w * 0.12),
          y: entry.sy - h * (type === 'city' ? 0.92 : type === 'fort' ? 0.80 : 0.68),
          seed: entry.tx * 571 + entry.ty * 733 + i * 41 + type.length * 19,
          puffCount: type === 'city' ? 2 : 1,
          strength: type === 'city' ? 1.0 : type === 'fort' ? 0.85 : 0.72,
        });
      }
      if (sources.length >= 128) break;
    }

    let drawn = 0;
    if (sources.length > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let si = 0; si < sources.length; si += 1) {
        if (drawn >= budget) break;
        const source = sources[si];
        const perSource = Math.max(1, Math.min(3, Math.floor(source.puffCount || 1)));
        for (let pi = 0; pi < perSource; pi += 1) {
          if (drawn >= budget) break;
          const puff = sampleDimetricSmokePuff({
            timeMs,
            sourceId: source.seed + si * 11,
            puffIndex: pi,
          });
          if (puff.alpha <= 0.01) continue;
          const risePx = puff.rise * h * (2.1 + source.strength * 0.6);
          const swayPx = puff.sway * w * (0.20 + source.strength * 0.14);
          const sizeX = Math.max(1.4, w * 0.10 * puff.size * (0.84 + source.strength * 0.32));
          const sizeY = Math.max(1.0, h * 0.10 * puff.size);
          const x = source.x + swayPx;
          const y = source.y - risePx;
          const alpha = Math.max(0, Math.min(0.26, puff.alpha * (0.82 + source.strength * 0.26)));
          if (alpha <= 0.01) continue;

          ctx.fillStyle = `rgba(78,72,68,${alpha.toFixed(3)})`;
          ctx.beginPath();
          _ellipse(ctx, x, y, sizeX, sizeY, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(156,148,142,${Math.max(0, alpha * 0.58).toFixed(3)})`;
          ctx.beginPath();
          _ellipse(ctx, x + sizeX * 0.16, y - sizeY * 0.24, sizeX * 0.72, sizeY * 0.64, 0, 0, Math.PI * 2);
          ctx.fill();
          drawn += 1;
        }
      }
      ctx.restore();
    }

    const weatherEnabled = CONST.DIMETRIC?.AMBIENT_WEATHER_PARTICLES_ENABLED !== false;
    const weatherType = String(weatherState?.type || 'CLEAR').toUpperCase();
    const canDrawWeather = weatherEnabled
      && viewConfig
      && Number.isFinite(minX)
      && Number.isFinite(minY)
      && Number.isFinite(maxX)
      && Number.isFinite(maxY);
    if (!canDrawWeather) return drawn;

    const weatherMax = Math.max(0, Math.floor(Number(CONST.DIMETRIC?.AMBIENT_WEATHER_PARTICLE_MAX) || 80));
    const weatherBudget = getDimetricWeatherParticleBudget({
      weatherType,
      lodLevel,
      qualityLevel: qualityProfile?.level,
      maxParticles: weatherMax,
    });
    if (weatherBudget <= 0) return drawn;

    const stride = lodLevel === 'minimal'
      ? 6
      : lodLevel === 'reduced'
        ? 5
        : (Number.isFinite(qualityProfile?.level) && Number(qualityProfile.level) >= 2 ? 4 : 3);
    const safeMapW = Math.max(1, Math.floor(Number(mapWidth) || 1));
    let weatherDrawn = 0;
    let weatherIndex = 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let ty = Math.floor(minY); ty <= Math.floor(maxY); ty += stride) {
      if (weatherDrawn >= weatherBudget) break;
      for (let tx = Math.floor(minX); tx <= Math.floor(maxX); tx += stride) {
        if (weatherDrawn >= weatherBudget) break;
        const fogLevel = fog instanceof Uint8Array ? fog[(ty * safeMapW) + tx] : 2;
        if (fogLevel <= 0) continue;
        const particle = sampleDimetricWeatherParticle({
          timeMs,
          weatherType,
          tileX: tx,
          tileY: ty,
          index: weatherIndex++,
        });
        if (!particle) continue;
        const center = worldToScreen(tx, ty, camera, viewConfig, 0);
        const fogMul = fogLevel === 1 ? 0.62 : 1.0;

        if (weatherType === 'RAIN') {
          const x = center.x + (particle.xJitter + particle.sway) * w * 0.45;
          const y = center.y - h * 0.62 + (particle.phase * h * 1.55);
          const len = h * (0.22 + particle.length * 0.48);
          const lineW = Math.max(0.6, particle.width * camera.zoom);
          const alpha = Math.max(0.04, Math.min(0.26, particle.alpha * fogMul));
          ctx.strokeStyle = `rgba(186,206,228,${alpha.toFixed(3)})`;
          ctx.lineWidth = lineW;
          ctx.beginPath();
          ctx.moveTo(x - w * 0.05, y - len * 0.52);
          ctx.lineTo(x + w * 0.07, y + len * 0.48);
          ctx.stroke();
        } else if (weatherType === 'SNOW') {
          const drift = (particle.xJitter + particle.sway) * w * 0.42;
          const x = center.x + drift;
          const y = center.y - h * 0.58 + (particle.phase * h * 1.34);
          const radius = Math.max(0.6, particle.size * camera.zoom);
          const alpha = Math.max(0.06, Math.min(0.30, particle.alpha * fogMul));
          ctx.fillStyle = `rgba(242,247,255,${alpha.toFixed(3)})`;
          ctx.beginPath();
          _ellipse(ctx, x, y, radius, radius * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const drift = (particle.xJitter + particle.sway) * w * 0.35;
          const x = center.x + drift;
          const y = center.y - h * 0.18 + (particle.phase * h * 0.65);
          const rx = Math.max(2, w * 0.08 * particle.size);
          const ry = Math.max(1, h * 0.08 * particle.size);
          const alpha = Math.max(0.03, Math.min(0.16, particle.alpha * fogMul));
          ctx.fillStyle = `rgba(188,198,205,${alpha.toFixed(3)})`;
          ctx.beginPath();
          _ellipse(ctx, x, y, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        weatherDrawn += 1;
      }
    }
    ctx.restore();
    return drawn + weatherDrawn;
  }

  renderDimetricWorldTerrain(ctx, camera, {
    map,
    width,
    height,
    tileSize,
    fog,
  } = {}) {
    const g = this.game;
    if (!ctx || !camera || !map || !g?.canvas) return;

    const view = buildDimetricCameraConfig({
      camera,
      map,
      canvas: g.canvas,
      tileSize,
      tileW: CONST.DIMETRIC?.TILE_W,
      tileH: CONST.DIMETRIC?.TILE_H,
      elevationPx: CONST.DIMETRIC?.ELEVATION_PX,
    });
    if (!view?.config) return;

    const visible = computeDimetricVisibleTileBounds({
      camera,
      canvas: g.canvas,
      config: view.config,
      mapWidth: width,
      mapHeight: height,
      paddingTiles: 3,
    }) || {
      minX: 0,
      minY: 0,
      maxX: width - 1,
      maxY: height - 1,
    };
    const minX = visible.minX;
    const minY = visible.minY;
    const maxX = visible.maxX;
    const maxY = visible.maxY;
    const qualityProfile = this.dimetricQualityProfile || this.dimetricPerformance.getQualityProfile();
    const lodLevel = _applyDimetricLodBias(_getDimetricLodLevel(camera.zoom), qualityProfile?.lodBias);
    this.dimetricLodLevel = lodLevel;
    const featureDensityScale = Math.max(0.2, Math.min(1.0, Number(qualityProfile?.featureDensityScale) || 1.0));
    const reducedForestThreshold = Math.min(0.95, 0.38 + (1 - featureDensityScale) * 0.40);
    const minimalForestThreshold = Math.min(0.985, 0.82 + (1 - featureDensityScale) * 0.16);
    const minimalMountainThreshold = Math.min(0.95, 0.54 + (1 - featureDensityScale) * 0.28);
    const decalsEnabled = CONST.DIMETRIC?.NATURE_DECALS_ENABLED !== false;
    const maxDecals = Math.max(48, Math.floor(Number(CONST.DIMETRIC?.NATURE_DECAL_MAX) || 220));
    const stateTimeSec = Number(this.state?.timeSec);
    const timeMs = Number.isFinite(stateTimeSec) ? stateTimeSec * 1000 : _nowMs();

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

    this.dimetricStrongholdGroundVariants = this.dimetricPropStyleProfile === 'classic'
      ? null
      : _getStrongholdGroundSpriteVariants();
    this.dimetricStrongholdTreeSprites = this.dimetricPropStyleProfile === 'classic'
      ? null
      : _getStrongholdTreeSprites();

    this.dimetricTerrainCache.configure({
      map,
      tileW: view.config.tileW,
      tileH: view.config.tileH,
      chunkSize: Number(CONST.DIMETRIC?.TERRAIN_CHUNK_SIZE) || 16,
      groundStylePreset: this.dimetricPropStyleProfile === 'classic' ? 'classic' : 'stronghold',
      groundSpriteVariants: this.dimetricStrongholdGroundVariants,
      maxChunks: Math.max(
        48,
        Math.round((Number(CONST.DIMETRIC?.TERRAIN_MAX_CHUNKS) || 192)
          * Math.max(0.35, Number(qualityProfile?.chunkBudgetScale) || 1.0)),
      ),
    });

    const chunkSize = this.dimetricTerrainCache.chunkSize;
    const minChunkX = Math.floor(minX / chunkSize);
    const minChunkY = Math.floor(minY / chunkSize);
    const maxChunkX = Math.floor(maxX / chunkSize);
    const maxChunkY = Math.floor(maxY / chunkSize);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let cy = minChunkY; cy <= maxChunkY; cy += 1) {
      for (let cx = minChunkX; cx <= maxChunkX; cx += 1) {
        const chunk = this.dimetricTerrainCache.getChunk({
          chunkX: cx,
          chunkY: cy,
          mapWidth: width,
          mapHeight: height,
          resolveBiomeAt,
        });
        if (!chunk?.canvas) continue;
        const worldX = chunk.baseX + view.config.originX;
        const worldY = chunk.baseY + view.config.originY;
        const screenX = (worldX - camera.x) * camera.zoom;
        const screenY = (worldY - camera.y) * camera.zoom;
        const drawW = chunk.width * camera.zoom;
        const drawH = chunk.height * camera.zoom;
        if (drawW <= 0 || drawH <= 0) continue;
        ctx.drawImage(chunk.canvas, screenX, screenY, drawW, drawH);
      }
    }
    ctx.restore();

    if (CONST.DIMETRIC?.WATER_SHIMMER_ENABLED !== false) {
      this.renderDimetricWaterShimmer(ctx, camera, view.config, {
        minX,
        minY,
        maxX,
        maxY,
        width,
        height,
        resolveBiomeAt,
        fog,
        qualityProfile,
        timeMs,
      });
    }

    const riverBands = createRiverBands(camera.zoom);
    const roadBands = createRoadBands(camera.zoom);
    const projectPoint = (tx, ty) => worldToScreen(tx, ty, camera, view.config, 0);
    const drawProjectedPath = (path, bands, boundsPadding = 2) => {
      if (!pathIntersectsTileBounds(path, visible, boundsPadding)) return;
      const points = projectTilePath(path, projectPoint);
      if (points.length < 2) return;
      drawPolylineBands(ctx, points, bands);
    };

    (map.rivers || []).forEach((river) => {
      drawProjectedPath(river, riverBands, 4);
    });

    (map.roads || []).forEach((road) => {
      drawProjectedPath(road?.path, roadBands, 3);
    });

    (map.crossings || []).forEach((crossing) => {
      const tx = Number(crossing?.x);
      const ty = Number(crossing?.y);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < (minX - 1) || tx > (maxX + 1) || ty < (minY - 1) || ty > (maxY + 1)) return;
      const point = projectPoint(tx, ty);
      drawCrossingMarker(ctx, {
        x: point.x,
        y: point.y,
        tileW: view.config.tileW,
        tileH: view.config.tileH,
        zoom: camera.zoom,
      });
    });

    const halfW = view.config.tileW * camera.zoom * 0.5;
    const halfH = view.config.tileH * camera.zoom * 0.5;
    const strongholdFog = this.dimetricPropStyleProfile === 'stronghold';
    const fogHiddenAlpha = strongholdFog ? 0.46 : 0.92;
    const fogDiscoveredAlpha = strongholdFog ? 0.24 : 0.48;
    if (fog) {
      for (let ty = minY; ty <= maxY; ty += 1) {
        for (let tx = minX; tx <= maxX; tx += 1) {
          const fogLevel = fog[ty * width + tx];
          if (fogLevel > 1) continue;
          const c = worldToScreen(tx, ty, camera, view.config, 0);
          _drawScreenDiamond(ctx, c.x, c.y, halfW, halfH);
          ctx.fillStyle = fogLevel === 0
            ? `rgba(0,0,0,${fogHiddenAlpha.toFixed(2)})`
            : `rgba(0,0,0,${fogDiscoveredAlpha.toFixed(2)})`;
          ctx.fill();
        }
      }
    }

    const { forestSet, mountainSet } = this.getCachedWorldFeatureSets(map);
    const featureQueue = [];
    const largeMountainCells = new Set();
    const countSetNeighbors = (set, x, y) => {
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          if (set.has(`${x + dx},${y + dy}`)) count += 1;
        }
      }
      return count;
    };

    let decalCount = 0;
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const fogLevel = fog ? fog[ty * width + tx] : 2;
        if (fogLevel === 0) continue;
        const key = `${tx},${ty}`;
        const hasMountain = mountainSet.has(key);
        const hasForest = forestSet.has(key);
        if (hasMountain) {
          const mNeighbors = countSetNeighbors(mountainSet, tx, ty);
          const largeCell = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
          const largeNoise = _terrainNoise(tx * 0.53, ty * 0.47, 7811);
          const isLarge = mNeighbors >= 2 && largeNoise > 0.66 && !largeMountainCells.has(largeCell);
          let allowMountain = true;
          if (!isLarge && lodLevel === 'minimal') {
            const sparse = _terrainNoise(tx * 0.61, ty * 0.57, 9961);
            if (sparse < minimalMountainThreshold) allowMountain = false;
          }
          if (allowMountain) {
            if (isLarge) {
              largeMountainCells.add(largeCell);
              featureQueue.push({
                type: 'mountain_large',
                tx,
                ty,
                fogLevel,
                variant: resolveDimetricNatureVariant({ kind: 'mountain_large', tx, ty, fogLevel }),
              });
            } else {
              featureQueue.push({
                type: 'mountain',
                tx,
                ty,
                fogLevel,
                variant: resolveDimetricNatureVariant({ kind: 'mountain', tx, ty, fogLevel }),
              });
            }
          }
        }
        if (hasForest) {
          if (lodLevel === 'reduced') {
            const keep = _terrainNoise(tx * 0.67, ty * 0.43, 9901);
            if (keep < reducedForestThreshold) continue;
          } else if (lodLevel === 'minimal') {
            const keep = _terrainNoise(tx * 0.67, ty * 0.43, 9901);
            if (keep < minimalForestThreshold) continue;
          }
          featureQueue.push({
            type: 'forest',
            tx,
            ty,
            fogLevel,
            variant: resolveDimetricNatureVariant({ kind: 'forest', tx, ty, fogLevel }),
          });
        }

        if (decalsEnabled && decalCount < maxDecals && !hasMountain && !hasForest) {
          const biome = resolveBiomeAt(tx, ty);
          const decal = sampleDimetricGroundDecal({
            tx,
            ty,
            biome,
            fogLevel,
            lodLevel,
            qualityLevel: qualityProfile?.level,
            featureDensityScale,
            biomeIds: CONST.BIOME,
          });
          if (decal) {
            featureQueue.push({ type: 'ground_decal', tx, ty, fogLevel, decal });
            decalCount += 1;
          }
        }
      }
    }

    const drawPoi = (poi, px, py, fogLevel) => {
      ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, 1.2 * camera.zoom);

      const poiSpriteKey = g.poiManager.getPoiSpriteKey(poi.type);
      const poiScale = Math.max(0.65, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (g.assetsReady) {
        const drawn = g.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
        if (drawn) return;
      }

      if (poi.type === 'camp') {
        const s = Math.max(4, 7 * camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px - s * 0.8, py + s * 0.7);
        ctx.lineTo(px + s * 0.8, py + s * 0.7);
        ctx.closePath();
        ctx.stroke();
      } else {
        const s = Math.max(4, 6 * camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px - s, py - s);
        ctx.lineTo(px + s, py + s);
        ctx.moveTo(px + s, py - s);
        ctx.lineTo(px - s, py + s);
        ctx.stroke();
      }
    };

    const screenTileW = view.config.tileW * camera.zoom;
    const screenTileH = view.config.tileH * camera.zoom;

    const settlementQueue = [];
    (map.settlements || []).forEach((settlement) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const stx = Number.isFinite(settlement.x) ? _worldToTileCoord(settlement.x, tileSize) : tx;
      const sty = Number.isFinite(settlement.y) ? _worldToTileCoord(settlement.y, tileSize) : ty;
      const screen = worldToScreen(stx, sty, camera, view.config, 0);
      settlementQueue.push({ settlement, tx, ty, sx: screen.x, sy: screen.y, fogLevel });
    });

    const buildingQueue = [];
    const buildingSystem = g.worldManager?.ensureBuildingSystem?.({ map }) || null;
    const buildingList = typeof buildingSystem?.list === 'function' ? buildingSystem.list() : [];
    for (const building of buildingList) {
      const def = getBuildingDef(building?.defId);
      if (!def) continue;

      const anchorX = Math.floor(Number.isFinite(building?.anchorX) ? building.anchorX : 0);
      const anchorY = Math.floor(Number.isFinite(building?.anchorY) ? building.anchorY : 0);
      const sortTileX = Math.floor(Number.isFinite(building?.sortTileX) ? building.sortTileX : anchorX);
      const sortTileY = Math.floor(Number.isFinite(building?.sortTileY) ? building.sortTileY : anchorY);
      const metrics = _buildDimetricBuildingMetrics(building, def, screenTileW, screenTileH);
      const fp = metrics.footprint;
      const fpMinX = anchorX + fp.minDx;
      const fpMinY = anchorY + fp.minDy;
      const fpMaxX = anchorX + fp.maxDx;
      const fpMaxY = anchorY + fp.maxDy;
      if (fpMaxX < (minX - 2) || fpMinX > (maxX + 2) || fpMaxY < (minY - 2) || fpMinY > (maxY + 2)) continue;

      const fogTileX = Math.max(0, Math.min(width - 1, sortTileX));
      const fogTileY = Math.max(0, Math.min(height - 1, sortTileY));
      const fogLevel = fog ? fog[fogTileY * width + fogTileX] : 2;
      if (fogLevel === 0) continue;

      const screen = worldToScreen(sortTileX, sortTileY, camera, view.config, 0);
      buildingQueue.push({
        building,
        def,
        fogLevel,
        wallVariant: def.id === 'wall'
          ? resolveWallVariant(anchorX, anchorY, buildingSystem?.tileIndex, { buildings: buildingSystem?.buildings })
          : null,
        metrics,
        sx: screen.x,
        sy: screen.y,
      });
    }

    const poiQueue = [];
    (map.pois || []).forEach((poi) => {
      const tx = poi?.x;
      const ty = poi?.y;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const screen = worldToScreen(tx, ty, camera, view.config, 0);
      poiQueue.push({ poi, tx, ty, px: screen.x, py: screen.y, fogLevel });
    });

    const canRenderBanners = typeof ctx.closePath === 'function'
      && typeof ctx.createLinearGradient === 'function'
      && typeof ctx.measureText === 'function'
      && typeof ctx.arcTo === 'function'
      && qualityProfile?.enableBanners !== false;
    const rawPlayerFaction = g.state?.faction ?? g.state?.selectedFaction?.id ?? g.state?.selectedFaction?.name ?? g.state?.playerFaction ?? 'free_company';
    const playerFactionId = String(rawPlayerFaction).toLowerCase().replace(/\s+/g, '_');
    const actorQueue = [];
    const actorVisualState = this.dimetricActorVisualState instanceof Map
      ? this.dimetricActorVisualState
      : new Map();
    this.dimetricActorVisualState = actorVisualState;
    const actorVisualSeen = new Set();
    const nowMsFromState = Number(this.state?.timeSec);
    const nowMs = Number.isFinite(nowMsFromState) ? nowMsFromState * 1000 : Date.now();
    const pushActor = ({
      actorType,
      worldX,
      worldY,
      fogLevel = 2,
      radius = 10,
      factionId = 'bandit',
      label = '',
      source = null,
      actorKey = null,
      velocityX = null,
      velocityY = null,
    } = {}) => {
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
      const tileX = Math.floor(worldX / tileSize);
      const tileY = Math.floor(worldY / tileSize);
      if (tileX < minX || tileX > maxX || tileY < minY || tileY > maxY) return;
      if (fogLevel <= 0 && actorType !== 'player') return;
      const resolvedActorKey = String(
        actorKey
        || (source && typeof source.id === 'string' ? `${actorType}:${source.id}` : '')
        || `${actorType}:${Math.round(worldX)}:${Math.round(worldY)}`,
      );
      const prevVisual = actorVisualState.get(resolvedActorKey);
      const dtSec = prevVisual && Number.isFinite(prevVisual.timeMs) && nowMs > prevVisual.timeMs
        ? (nowMs - prevVisual.timeMs) / 1000
        : 0;
      let vx = Number.isFinite(velocityX) ? Number(velocityX) : Number(source?.vx);
      let vy = Number.isFinite(velocityY) ? Number(velocityY) : Number(source?.vy);
      if ((!Number.isFinite(vx) || !Number.isFinite(vy)) && prevVisual && dtSec > 0) {
        vx = (worldX - prevVisual.worldX) / dtSec;
        vy = (worldY - prevVisual.worldY) / dtSec;
      }
      if (!Number.isFinite(vx)) vx = 0;
      if (!Number.isFinite(vy)) vy = 0;
      const direction = resolveDimetricUnitDirection(vx, vy, prevVisual?.direction || 'S');
      const walkSpeed = Math.hypot(vx, vy);
      const screen = worldToScreen(
        _worldToTileCoord(worldX, tileSize),
        _worldToTileCoord(worldY, tileSize),
        camera,
        view.config,
        0,
      );
      const bodyBounds = estimateDimetricUnitBodyBounds({
        x: screen.x,
        y: screen.y,
        tileH: screenTileH,
        zoom: camera.zoom,
      });
      actorVisualState.set(resolvedActorKey, {
        worldX,
        worldY,
        timeMs: nowMs,
        direction,
      });
      actorVisualSeen.add(resolvedActorKey);
      actorQueue.push({
        actorType,
        source,
        actorKey: resolvedActorKey,
        factionId,
        label,
        fogLevel,
        radius: Number.isFinite(radius) ? radius : 10,
        worldX,
        worldY,
        velocityX: vx,
        velocityY: vy,
        direction,
        walkSpeed,
        animTimeMs: nowMs,
        x: screen.x,
        y: screen.y,
        bodyBounds,
      });
    };

    if (g.playerParty && Number.isFinite(g.playerParty.x) && Number.isFinite(g.playerParty.y)) {
      const playerDestDx = Number(g.playerParty.destX) - Number(g.playerParty.x);
      const playerDestDy = Number(g.playerParty.destY) - Number(g.playerParty.y);
      const playerVx = Number(g.playerParty.vx);
      const playerVy = Number(g.playerParty.vy);
      const playerHasMotion = Boolean(g.playerParty.hasDestination)
        && Number.isFinite(playerDestDx)
        && Number.isFinite(playerDestDy);
      pushActor({
        actorType: 'player',
        worldX: g.playerParty.x,
        worldY: g.playerParty.y,
        fogLevel: 2,
        radius: Number(g.playerParty.radius) || 10,
        factionId: playerFactionId,
        label: '',
        source: g.playerParty,
        actorKey: 'player:party',
        velocityX: Number.isFinite(playerVx) && Math.abs(playerVx) > 0.001 ? playerVx : (playerHasMotion ? playerDestDx : 0),
        velocityY: Number.isFinite(playerVy) && Math.abs(playerVy) > 0.001 ? playerVy : (playerHasMotion ? playerDestDy : 0),
      });
    }

    if ((g.tuningManager.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED && Array.isArray(g.worldManager.worldAi?.parties)) {
      g.worldManager.worldAi.parties.forEach((aiParty) => {
        if (!aiParty || !Number.isFinite(aiParty.x) || !Number.isFinite(aiParty.y)) return;
        const tx = Math.floor(aiParty.x / tileSize);
        const ty = Math.floor(aiParty.y / tileSize);
        const fogLevel = (tx >= 0 && tx < width && ty >= 0 && ty < height && fog) ? fog[ty * width + tx] : 2;
        pushActor({
          actorType: 'ai',
          worldX: aiParty.x,
          worldY: aiParty.y,
          fogLevel,
          radius: Number(aiParty.radius) || 10,
          factionId: _kindToFaction(aiParty.kind),
          label: _aiLabel(aiParty),
          source: aiParty,
          actorKey: `ai:${aiParty.id || aiParty.kind || 'party'}`,
          velocityX: Number(aiParty.vx),
          velocityY: Number(aiParty.vy),
        });
      });
    }

    if (Array.isArray(g.worldManager.enemyParties)) {
      g.worldManager.enemyParties.forEach((enemy) => {
        if (!enemy || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return;
        const tx = Math.floor(enemy.x / tileSize);
        const ty = Math.floor(enemy.y / tileSize);
        const fogLevel = (tx >= 0 && tx < width && ty >= 0 && ty < height && fog) ? fog[ty * width + tx] : 2;
        const str = Math.round(enemy.strength || enemy.size || 0);
        const fid = enemy.factionId || enemy.faction || 'bandit';
        const eName = { ottoman: 'OsmanlÄ± Beyi', hre: 'HRE Lordu', polish: 'Leh Beyi', spanish: 'Ä°spanyol', venice: 'Venedikli', bandit: 'EÅŸkÄ±ya Ã‡etesi' }[fid] || 'DÃ¼ÅŸman Ordusu';
        pushActor({
          actorType: 'enemy',
          worldX: enemy.x,
          worldY: enemy.y,
          fogLevel,
          radius: Number(enemy.radius) || 10,
          factionId: fid,
          label: `${eName} [${str}]`,
          source: enemy,
          actorKey: `enemy:${enemy.id || enemy.name || str}`,
          velocityX: Number(enemy.vx),
          velocityY: Number(enemy.vy),
        });
      });
    }

    if (actorVisualState.size > actorVisualSeen.size) {
      for (const key of actorVisualState.keys()) {
        if (!actorVisualSeen.has(key)) actorVisualState.delete(key);
      }
    }

    const renderables = [];
    let sortId = 0;
    for (const feature of featureQueue) {
      const center = worldToScreen(feature.tx, feature.ty, camera, view.config, 0);
      const isGroundDecal = feature.type === 'ground_decal';
      const featureWidth = isGroundDecal
        ? screenTileW * 0.56
        : feature.type === 'forest'
          ? screenTileW * 1.15
          : feature.type === 'mountain_large'
            ? screenTileW * 1.58
            : screenTileW * 1.34;
      const featureHeight = isGroundDecal
        ? screenTileH * 0.52
        : feature.type === 'forest'
          ? screenTileH * 2.55
          : feature.type === 'mountain_large'
            ? screenTileH * 3.40
            : screenTileH * 2.95;
      const renderable = {
        kind: 'feature',
        feature,
        screenX: center.x,
        screenY: center.y,
        screenBottomY: center.y + (halfH * (
          isGroundDecal
            ? 0.44
            : feature.type === 'mountain_large'
              ? 1.9
              : feature.type === 'mountain'
                ? 1.6
                : 1.35
        )),
        layer: isGroundDecal ? 18 : feature.type === 'mountain_large' ? 20 : feature.type === 'mountain' ? 22 : 24,
        sortId: sortId++,
      };
      if (!isGroundDecal) {
        renderable.occluderBounds = {
          x: center.x - featureWidth * 0.5,
          y: center.y - featureHeight,
          w: featureWidth,
          h: featureHeight + (screenTileH * 0.62),
        };
      }
      renderables.push(renderable);
    }
    for (const poiEntry of poiQueue) {
      renderables.push({
        kind: 'poi',
        poiEntry,
        screenX: poiEntry.px,
        screenY: poiEntry.py,
        screenBottomY: poiEntry.py + Math.max(3, halfH * 0.45),
        layer: 28,
        sortId: sortId++,
      });
    }
    for (const buildingEntry of buildingQueue) {
      const metrics = buildingEntry.metrics;
      renderables.push({
        kind: 'building',
        buildingEntry,
        screenX: buildingEntry.sx,
        screenY: buildingEntry.sy,
        screenBottomY: buildingEntry.sy + metrics.screenBottomOffset,
        layer: 31,
        occluderBounds: {
          x: buildingEntry.sx - (metrics.bodyWidth * 0.5),
          y: buildingEntry.sy - (metrics.bodyHeight * 0.92),
          w: metrics.bodyWidth,
          h: metrics.bodyHeight,
        },
        sortId: sortId++,
      });
    }
    for (const settlementEntry of settlementQueue) {
      const footprint = getDimetricSettlementFootprint(settlementEntry.settlement);
      const footprintW = Math.max(1, Number(footprint.footprintW) || 1);
      const footprintH = Math.max(1, Number(footprint.footprintH) || 1);
      const depthMul = Math.max(1.05, Number(footprint.depthMul) || 1.2);
      const occluderW = Math.max(1, Number(footprint.occluderW) || footprintW);
      const occluderH = Math.max(1.2, Number(footprint.occluderH) || (footprintH + 1.1));
      const minPixelW = Math.max(1, Number(footprint.minPixelW) || 1.25);
      const minPixelH = Math.max(1.4, Number(footprint.minPixelH) || 2.05);
      const settlementWidth = Math.max(screenTileW * Math.max(footprintW, occluderW), tileSize * minPixelW);
      const settlementHeight = Math.max(screenTileH * (footprintH + occluderH), tileSize * minPixelH);
      renderables.push({
        kind: 'settlement',
        settlementEntry,
        screenX: settlementEntry.sx,
        screenY: settlementEntry.sy,
        screenBottomY: settlementEntry.sy + Math.max(4, halfH * depthMul),
        layer: 32,
        occluderBounds: {
          x: settlementEntry.sx - settlementWidth * 0.5,
          y: settlementEntry.sy - settlementHeight * 0.90,
          w: settlementWidth,
          h: settlementHeight,
        },
        sortId: sortId++,
      });
    }
    for (const actor of actorQueue) {
      const actorRadius = Math.max(5, (actor.radius || 10) * Math.max(0.42, camera.zoom * 0.50));
      renderables.push({
        kind: 'actor',
        actor,
        screenX: actor.x,
        screenY: actor.y,
        screenBottomY: actor.y + Math.max(3, halfH * 0.70),
        layer: 30,
        actorRadius,
        sortId: sortId++,
      });
    }

    sortByScreenBottomY(renderables);
    const enableActorOcclusionGhosts = qualityProfile?.enableActorOcclusionGhosts !== false;
    const occludedActorGhostQueue = [];
    if (enableActorOcclusionGhosts) {
      for (let i = 0; i < renderables.length; i += 1) {
        const entry = renderables[i];
        if (entry.kind !== 'actor') continue;
        const actorBounds = entry.actor?.bodyBounds;
        if (!actorBounds) continue;
        let occludedByFuture = false;
        for (let j = i + 1; j < renderables.length; j += 1) {
          const after = renderables[j];
          if (!after?.occluderBounds) continue;
          if (_rectsOverlap(actorBounds, after.occluderBounds)) {
            occludedByFuture = true;
            break;
          }
        }
        if (occludedByFuture) occludedActorGhostQueue.push(entry);
      }
    }

    for (const entry of renderables) {
      if (entry.kind === 'feature') {
        const { feature } = entry;
        const w = screenTileW;
        const h = screenTileH;
        if (feature.type === 'ground_decal') {
          _drawDimetricGroundDecalGlyph(ctx, entry.screenX, entry.screenY, w, h, feature.fogLevel, feature.decal);
          continue;
        }
        if (lodLevel === 'minimal' && feature.type === 'forest') {
          const f = feature.fogLevel === 1 ? 0.62 : 1.0;
          ctx.save();
          ctx.fillStyle = `rgba(${Math.round(44 * f)},${Math.round(92 * f)},${Math.round(46 * f)},0.72)`;
          ctx.beginPath();
          _ellipse(ctx, entry.screenX, entry.screenY + h * 0.06, Math.max(2, w * 0.16), Math.max(2, h * 0.10), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }
        if (lodLevel === 'minimal' && feature.type === 'mountain') {
          const f = feature.fogLevel === 1 ? 0.62 : 1.0;
          ctx.save();
          ctx.fillStyle = `rgba(${Math.round(94 * f)},${Math.round(106 * f)},${Math.round(124 * f)},0.84)`;
          ctx.beginPath();
          ctx.moveTo(_snap(entry.screenX, 1), _snap(entry.screenY - h * 0.48, 1));
          ctx.lineTo(_snap(entry.screenX + w * 0.18, 1), _snap(entry.screenY + h * 0.14, 1));
          ctx.lineTo(_snap(entry.screenX - w * 0.18, 1), _snap(entry.screenY + h * 0.14, 1));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          continue;
        }
        const propKind = feature.type === 'forest'
          ? 'FOREST'
          : feature.type === 'mountain_large'
            ? 'MOUNTAIN_LARGE'
            : 'MOUNTAIN';
        if (feature.type === 'forest' && this.dimetricPropStyleProfile !== 'classic') {
          const forestVariant = feature.variant && feature.variant.kind === 'forest'
            ? { ...feature.variant, family: 'conifer' }
            : resolveDimetricNatureVariant({
              kind: 'forest',
              tx: feature.tx,
              ty: feature.ty,
              fogLevel: feature.fogLevel,
            });
          const strongholdSpriteDrawn = _drawStrongholdForestSpriteBillboard(ctx, {
            tx: feature.tx,
            ty: feature.ty,
            centerX: entry.screenX,
            centerY: entry.screenY,
            tileW: w,
            tileH: h,
            fogLevel: feature.fogLevel,
            variant: forestVariant,
            sprites: this.dimetricStrongholdTreeSprites,
          });
          if (strongholdSpriteDrawn) continue;
          _drawDimetricForestGlyph(
            ctx,
            entry.screenX,
            entry.screenY,
            w,
            h,
            feature.fogLevel,
            feature.tx,
            feature.ty,
            forestVariant,
          );
          continue;
        }
        const drawn = _drawDimetricPropBillboard(ctx, {
          kind: propKind,
          tx: feature.tx,
          ty: feature.ty,
          centerX: entry.screenX,
          centerY: entry.screenY,
          tileW: w,
          tileH: h,
          fogLevel: feature.fogLevel,
          variant: feature.variant,
          styleProfile: this.dimetricPropStyleProfile,
        });
        if (!drawn) {
          if (feature.type === 'forest') {
            _drawDimetricForestGlyph(
              ctx,
              entry.screenX,
              entry.screenY,
              w,
              h,
              feature.fogLevel,
              feature.tx,
              feature.ty,
              feature.variant,
            );
          } else {
            _drawDimetricMountainGlyph(
              ctx,
              entry.screenX,
              entry.screenY,
              w,
              h,
              feature.fogLevel,
              feature.type === 'mountain_large' ? 'large' : 'normal',
              feature.tx,
              feature.ty,
              feature.variant,
            );
          }
        }
        continue;
      }
      if (entry.kind === 'poi') {
        const { poiEntry } = entry;
        drawPoi(poiEntry.poi, poiEntry.px, poiEntry.py, poiEntry.fogLevel);
        continue;
      }
      if (entry.kind === 'building') {
        _drawDimetricBuildingPrimitive(ctx, entry.buildingEntry, screenTileW, screenTileH);
        continue;
      }
      if (entry.kind === 'actor') {
        const { actor } = entry;
        const ringRadius = entry.actorRadius || Math.max(5, (actor.radius || 10) * Math.max(0.42, camera.zoom * 0.50));
        const [factionPrimary, factionSecondary, factionShadow] = _factionData(actor.factionId);
        const detail = getDimetricUnitDetailLevel({
          zoom: camera.zoom,
          qualityLevel: qualityProfile?.level,
        });
        const animState = getDimetricUnitAnimState({
          walkSpeed: actor.walkSpeed,
          isDead: actor.source?.moveState === 'dead',
          isAttacking: actor.source?.moveState === 'attack',
        });
        const frameIndex = getDimetricUnitFrameIndex({
          state: animState,
          timeMs: actor.animTimeMs,
          frameCount: 4,
          phaseOffset: actor.actorType === 'enemy' ? 80 : actor.actorType === 'ai' ? 40 : 0,
        });
        const ringColor = actor.actorType === 'enemy'
          ? 'rgba(255, 120, 120, 0.42)'
          : actor.actorType === 'player'
            ? 'rgba(255, 228, 130, 0.45)'
            : 'rgba(170,205,255,0.40)';
        const spriteBounds = drawDimetricUnitSprite(ctx, {
          x: actor.x,
          y: actor.y,
          tileH: screenTileH,
          zoom: camera.zoom,
          factionPrimary,
          factionSecondary,
          factionShadow,
          direction: actor.direction,
          fogLevel: actor.fogLevel,
          timeMs: actor.animTimeMs,
          walkSpeed: actor.walkSpeed,
          animState,
          frameIndex,
          detail,
          drawWeapon: (actor.actorType !== 'player' || camera.zoom >= 0.55) && detail !== 'minimal',
        });
        if (spriteBounds) actor.bodyBounds = spriteBounds;
        ctx.save();
        ctx.globalAlpha *= actor.fogLevel === 1 ? 0.62 : 1.0;
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = Math.max(1, 1.35 * camera.zoom);
        ctx.beginPath();
        ctx.arc(actor.x, actor.y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        if (canRenderBanners && camera.zoom >= 0.62 && detail !== 'minimal') {
          if (actor.actorType === 'player') {
            mbPlayerBanner(ctx, actor.x, actor.y, tileSize, camera.zoom, actor.factionId);
          } else {
            mbLordBanner(ctx, actor.x, actor.y, tileSize, actor.factionId, actor.label, camera.zoom);
          }
        } else {
          ctx.fillStyle = actor.actorType === 'enemy' ? 'rgba(255,120,120,0.82)' : 'rgba(232,222,168,0.82)';
          ctx.beginPath();
          ctx.arc(actor.x, actor.y, Math.max(2, ringRadius * 0.45), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        continue;
      }
      if (entry.kind === 'settlement') {
        const { settlementEntry } = entry;
        const fogAlpha = settlementEntry.fogLevel === 1 ? 0.55 : 1.0;
        mbSettlement(ctx, settlementEntry.settlement, settlementEntry.sx, settlementEntry.sy, tileSize, fogAlpha, camera.zoom);
      }
    }

    if (occludedActorGhostQueue.length > 0) {
      for (const entry of occludedActorGhostQueue) {
        const actor = entry.actor;
        if (!actor) continue;
        const radius = Math.max(4, (entry.actorRadius || 8) * 0.72);
        ctx.save();
        ctx.globalAlpha = actor.fogLevel === 1 ? 0.28 : 0.38;
        ctx.fillStyle = actor.actorType === 'enemy'
          ? 'rgba(255,120,120,0.95)'
          : actor.actorType === 'player'
            ? 'rgba(255,236,170,0.95)'
            : 'rgba(186,215,255,0.95)';
        ctx.strokeStyle = actor.actorType === 'enemy'
          ? 'rgba(255,170,170,0.88)'
          : actor.actorType === 'player'
            ? 'rgba(255,236,170,0.88)'
            : 'rgba(186,215,255,0.88)';
        ctx.lineWidth = Math.max(1, 1.35 * camera.zoom);
        ctx.beginPath();
        ctx.arc(actor.x, actor.y - radius * 0.20, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    const weatherState = g.uiManager?.weatherState || this.state?.weatherState || null;
    this.dimetricAmbientLastCount = this.renderDimetricAmbientParticles(ctx, camera, {
      settlementQueue,
      buildingQueue,
      screenTileW,
      screenTileH,
      lodLevel,
      qualityProfile,
      timeMs,
      weatherState,
      viewConfig: view.config,
      minX,
      minY,
      maxX,
      maxY,
      fog,
      mapWidth: width,
    });

    const clue = this.state?.clueMarker;
    if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
      const cx = Number(clue.x);
      const cy = Number(clue.y);
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
        const fogLevel = fog ? fog[cy * width + cx] : 2;
        if (fogLevel > 0) {
          const c = worldToScreen(cx, cy, camera, view.config, 0);
          ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
          ctx.lineWidth = Math.max(1, 1.8 * camera.zoom);
          ctx.beginPath();
          ctx.arc(c.x, c.y, Math.max(6, 8 * camera.zoom), 0, Math.PI * 2);
          ctx.stroke();
          if (camera.zoom >= 0.6) {
            ctx.fillStyle = 'rgba(245,218,96,0.95)';
            ctx.font = `${Math.max(10, 11 * camera.zoom)}px Inter`;
            ctx.fillText(String(clue.label || 'Ä°pucu'), c.x + (10 * camera.zoom), c.y - (8 * camera.zoom));
          }
        }
      }
    }
  }

  renderWorldTerrain(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.tiles) || map.tiles.length === 0) return;

    const tileSize = CONST.WORLD.TILE_SIZE;
    const width = Number.isFinite(map.width) ? map.width : CONST.WORLD.MAP_WIDTH;
    const height = Number.isFinite(map.height) ? map.height : CONST.WORLD.MAP_HEIGHT;
    const fog = map.fog instanceof Uint8Array ? map.fog : null;
    if (this.useDimetric) {
      this.renderDimetricWorldTerrain(ctx, camera, {
        map,
        width,
        height,
        tileSize,
        fog,
      });
      return;
    }

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
    const { forestSet, mountainSet } = this.getCachedWorldFeatureSets(map);
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

    const drawPoi = (poi, px, py, fogLevel) => {
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
    };

    const settlementQueue = [];
    (map.settlements || []).forEach((settlement) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const sx = Number.isFinite(settlement.x) ? settlement.x : (tx + 0.5) * tileSize;
      const sy = Number.isFinite(settlement.y) ? settlement.y : (ty + 0.5) * tileSize;
      settlementQueue.push({ settlement, tx, ty, sx, sy, fogLevel });
    });

    const poiQueue = [];
    (map.pois || []).forEach((poi) => {
      const tx = poi?.x;
      const ty = poi?.y;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const px = (tx + 0.5) * tileSize;
      const py = (ty + 0.5) * tileSize;
      poiQueue.push({ poi, tx, ty, px, py, fogLevel });
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
    for (const poiEntry of poiQueue) {
      drawPoi(poiEntry.poi, poiEntry.px, poiEntry.py, poiEntry.fogLevel);
    }
    for (const settlementEntry of settlementQueue) {
      const fogAlpha = settlementEntry.fogLevel === 1 ? 0.55 : 1.0;
      mbSettlement(ctx, settlementEntry.settlement, settlementEntry.sx, settlementEntry.sy, tileSize, fogAlpha, camera.zoom);
    }

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

    if (this.useDimetric) {
      const overlay = this.dimetricOverlayState;
      const roundTrip = this.dimetricRoundTrip;
      const cacheStats = this.dimetricTerrainCache?.getStats?.();
      const featureCache = this.worldFeatureIndexCache;
      const perf = this.dimetricPerformance?.getTelemetry?.();
      lines.push(`Dimetric: ON`);
      lines.push(`Dimetric LOD: ${this.dimetricLodLevel || 'full'}`);
      lines.push(`Dimetric Prop Style: ${this.dimetricPropStyleProfile || 'stronghold'}`);
      lines.push(`Dimetric Wireframe: ${this.dimetricWireframeEnabled ? 'ON' : 'OFF'}`);
      if (Array.isArray(this.dimetricStrongholdTreeSprites) && this.dimetricStrongholdTreeSprites.length > 0) {
        lines.push(`Dimetric SH Trees: ${this.dimetricStrongholdTreeSprites.length}`);
      }
      if (perf) {
        const qualityLabel = perf.effectiveLevel !== perf.level
          ? `Q${perf.effectiveLevel} (base Q${perf.level})`
          : `Q${perf.level}`;
        lines.push(`Dimetric Perf: ${qualityLabel} ${perf.avgFps.toFixed(1)}fps (${perf.avgMs.toFixed(2)}ms)`);
      }
      if (Number.isFinite(g.mouseTileX) && Number.isFinite(g.mouseTileY)) {
        lines.push(`Dimetric Tile: (${Math.floor(g.mouseTileX)}, ${Math.floor(g.mouseTileY)})`);
      }
      if (overlay) lines.push(`Dimetric Grid: ${overlay.startTileX},${overlay.startTileY} +${overlay.size}`);
      if (roundTrip) lines.push(`Dimetric RoundTrip MaxErr: ${roundTrip.maxError.toFixed(6)} (${roundTrip.samples})`);
      if (cacheStats) lines.push(`Dimetric Chunks: ${cacheStats.chunkCount}/${cacheStats.maxChunks} (tile ${cacheStats.chunkSize})`);
      lines.push(`Dimetric Ambient: ${Math.max(0, Math.floor(this.dimetricAmbientLastCount || 0))}`);
      if (Array.isArray(this.dimetricStageTelemetry) && this.dimetricStageTelemetry.length > 0) {
        const stageSummary = this.dimetricStageTelemetry
          .map((entry) => `${entry.stage}:${entry.avgMs.toFixed(2)}ms`)
          .join(' | ');
        lines.push(`Dimetric Stages: ${stageSummary}`);
      }
      if (featureCache?.mapRef) lines.push(`Feature Index: F${featureCache.forestSet.size} M${featureCache.mountainSet.size}`);
    } else {
      lines.push('Dimetric: OFF');
      lines.push(`Projection: ${this.projectionMode || 'legacy_topdown'}`);
      lines.push(`Projection Source: ${this.projectionSource || 'unknown'}`);
    }

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

