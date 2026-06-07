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
    SEA: [57, 94, 124],
    SHORE: [158, 135, 82],
    PLAINS: [91, 139, 57],
    FOREST: [55, 99, 42],
    HILLS: [128, 111, 70],
    MOUNTAIN: [114, 103, 82],
    SNOW: [210, 216, 219],
  }),
  classic: Object.freeze({
    SEA: [52, 103, 139],
    SHORE: [181, 156, 88],
    PLAINS: [91, 151, 58],
    FOREST: [46, 104, 43],
    HILLS: [139, 119, 72],
    MOUNTAIN: [116, 105, 86],
    SNOW: [224, 232, 236],
  }),
});

function normalizeGroundStylePreset(raw) {
  const value = String(raw || 'classic').trim().toLowerCase();
  return value === 'classic' ? 'classic' : 'stronghold';
}

export function biomeBaseRgb(biome, preset = 'classic') {
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

export function biomeBaseLayerRgb(biome, preset = 'classic', tx = 0, ty = 0) {
  const base = biomeBaseRgb(biome, preset);
  return shadeColor(base, (terrainNoise(tx, ty) - 0.5) * 14);
}

export function resolveBiomeBasePixelsPerTile(mapWidth, mapHeight) {
  const tiles = Math.max(0, Math.floor(finite(mapWidth, 0)) * Math.floor(finite(mapHeight, 0)));
  return tiles > 4000000 ? 1 : 2;
}

export class DimetricBiomeBaseLayer {
  constructor({
    canvasFactory = defaultCanvasFactory,
  } = {}) {
    this.canvasFactory = typeof canvasFactory === 'function' ? canvasFactory : defaultCanvasFactory;
    this.canvas = null;
    this.pixelsPerTile = 1;
    this.byteSize = 0;
    this.buildCount = 0;
    this._mapRef = null;
    this._mapWidth = 0;
    this._mapHeight = 0;
    this._groundStylePreset = 'classic';
    this._groundSpriteVariants = null;
    this._biomes = null;
    this._resolveBiomeAt = null;
  }

  configure({
    map,
    mapWidth,
    mapHeight,
    resolveBiomeAt,
    groundStylePreset = 'classic',
    groundSpriteVariants = null,
  } = {}) {
    const safeWidth = Math.max(1, Math.floor(finite(mapWidth ?? map?.width, 1)));
    const safeHeight = Math.max(1, Math.floor(finite(mapHeight ?? map?.height, 1)));
    const safePreset = normalizeGroundStylePreset(groundStylePreset);
    const safeGroundSprites = groundSpriteVariants && typeof groundSpriteVariants === 'object' ? groundSpriteVariants : null;
    const needsRebuild = this._mapRef !== map
      || this._mapWidth !== safeWidth
      || this._mapHeight !== safeHeight
      || this._groundStylePreset !== safePreset
      || this._groundSpriteVariants !== safeGroundSprites
      || !this.canvas;

    if (!needsRebuild) return this;
    this._mapRef = map;
    this._mapWidth = safeWidth;
    this._mapHeight = safeHeight;
    this._groundStylePreset = safePreset;
    this._groundSpriteVariants = safeGroundSprites;
    this._biomes = map?.biomes instanceof Uint8Array ? map.biomes : null;
    this._resolveBiomeAt = typeof resolveBiomeAt === 'function' ? resolveBiomeAt : null;
    this.pixelsPerTile = resolveBiomeBasePixelsPerTile(safeWidth, safeHeight);
    this.canvas = this._buildCanvas({
      map,
      mapWidth: safeWidth,
      mapHeight: safeHeight,
      resolveBiomeAt,
      groundStylePreset: safePreset,
    });
    this.byteSize = this.canvas ? this.canvas.width * this.canvas.height * 4 : 0;
    this.buildCount += 1;
    return this;
  }

  drawVisible(ctx, camera, {
    visible,
    view,
    worldToScreen,
  } = {}) {
    if (!ctx || !camera || !this.canvas || !visible || !view?.config || typeof worldToScreen !== 'function') return false;
    if (!hasCtxMethod(ctx, 'drawImage')) return false;
    const minX = clampInt(visible.minX, 0, this._mapWidth - 1);
    const minY = clampInt(visible.minY, 0, this._mapHeight - 1);
    const maxX = clampInt(visible.maxX, 0, this._mapWidth - 1);
    const maxY = clampInt(visible.maxY, 0, this._mapHeight - 1);
    if (maxX < minX || maxY < minY) return false;

    safeCtxSave(ctx);
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    this._drawVisibleDiamonds(ctx, camera, { visible, view, worldToScreen });
    safeCtxRestore(ctx);
    return true;
  }

  getStats() {
    return {
      width: this.canvas?.width || 0,
      height: this.canvas?.height || 0,
      pixelsPerTile: this.pixelsPerTile,
      byteSize: this.byteSize,
      buildCount: this.buildCount,
      groundStylePreset: this._groundStylePreset,
    };
  }

  _buildCanvas({
    map,
    mapWidth,
    mapHeight,
    resolveBiomeAt,
    groundStylePreset,
  }) {
    const scale = this.pixelsPerTile;
    const canvas = this.canvasFactory(mapWidth * scale, mapHeight * scale);
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return null;
    const biomes = map?.biomes instanceof Uint8Array ? map.biomes : null;
    const resolve = typeof resolveBiomeAt === 'function'
      ? resolveBiomeAt
      : (x, y) => biomes?.[(y * mapWidth) + x] ?? CONST.BIOME?.PLAINS;

    if (typeof ctx.createImageData === 'function' && typeof ctx.putImageData === 'function') {
      const image = ctx.createImageData(canvas.width, canvas.height);
      const data = image.data;
      for (let ty = 0; ty < mapHeight; ty += 1) {
        for (let tx = 0; tx < mapWidth; tx += 1) {
          const biome = biomes ? biomes[(ty * mapWidth) + tx] : resolve(tx, ty);
          const rgb = biomeBaseLayerRgb(biome, groundStylePreset, tx, ty);
          for (let py = 0; py < scale; py += 1) {
            for (let px = 0; px < scale; px += 1) {
              const idx = (((ty * scale + py) * canvas.width) + (tx * scale + px)) * 4;
              data[idx] = rgb[0];
              data[idx + 1] = rgb[1];
              data[idx + 2] = rgb[2];
              data[idx + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(image, 0, 0);
      return canvas;
    }

    for (let ty = 0; ty < mapHeight; ty += 1) {
      for (let tx = 0; tx < mapWidth; tx += 1) {
        const biome = biomes ? biomes[(ty * mapWidth) + tx] : resolve(tx, ty);
        ctx.fillStyle = rgbCss(biomeBaseLayerRgb(biome, groundStylePreset, tx, ty));
        ctx.fillRect(tx * scale, ty * scale, scale, scale);
      }
    }
    return canvas;
  }

  _resolveRgbAt(tx, ty) {
    const safeX = clampInt(tx, 0, this._mapWidth - 1);
    const safeY = clampInt(ty, 0, this._mapHeight - 1);
    const idx = (safeY * this._mapWidth) + safeX;
    const biome = this._biomes ? this._biomes[idx] : this._resolveBiomeAt?.(safeX, safeY);
    return biomeBaseLayerRgb(biome, this._groundStylePreset, safeX, safeY);
  }

  _resolveCellAt(tx, ty) {
    const safeX = clampInt(tx, 0, this._mapWidth - 1);
    const safeY = clampInt(ty, 0, this._mapHeight - 1);
    const idx = (safeY * this._mapWidth) + safeX;
    const biome = this._biomes ? this._biomes[idx] : this._resolveBiomeAt?.(safeX, safeY);
    const resolveBiomeAt = (x, y) => {
      if (x < 0 || y < 0 || x >= this._mapWidth || y >= this._mapHeight) return CONST.BIOME?.SEA;
      const i = (y * this._mapWidth) + x;
      return this._biomes ? this._biomes[i] : this._resolveBiomeAt?.(x, y);
    };
    return buildTerrainCell({
      tx: safeX,
      ty: safeY,
      isoX: 0,
      isoY: 0,
      biome,
      mapWidth: this._mapWidth,
      mapHeight: this._mapHeight,
      resolveBiomeAt,
    });
  }

  _drawVisibleDiamonds(ctx, camera, { visible, view, worldToScreen } = {}) {
    if (!hasCtxMethod(ctx, 'beginPath') || !hasCtxMethod(ctx, 'moveTo') || !hasCtxMethod(ctx, 'lineTo') || !hasCtxMethod(ctx, 'fill')) return;
    const halfW = finite(view?.config?.tileW, 64) * finite(camera?.zoom, 1) * 0.5;
    const halfH = finite(view?.config?.tileH, 32) * finite(camera?.zoom, 1) * 0.5;
    if (halfW <= 0 || halfH <= 0) return;
    const minX = clampInt(visible.minX, 0, this._mapWidth - 1);
    const minY = clampInt(visible.minY, 0, this._mapHeight - 1);
    const maxX = clampInt(visible.maxX, 0, this._mapWidth - 1);
    const maxY = clampInt(visible.maxY, 0, this._mapHeight - 1);
    for (let ty = minY; ty <= maxY; ty += 1) {
      for (let tx = minX; tx <= maxX; tx += 1) {
        const c = worldToScreen(tx, ty, camera, view.config, 0);
        const cx = finite(c?.x, 0);
        const cy = finite(c?.y, 0);
        const cell = this._resolveCellAt(tx, ty);
        drawTerrainCellBase(ctx, cell, cx, cy, halfW, halfH, {
          groundPreset: this._groundStylePreset,
          groundSpriteVariants: this._groundSpriteVariants,
          tileW: halfW * 2,
          tileH: halfH * 2,
        });
      }
    }
  }
}

export function resolveBiomeTextureStyle(biome) {
  const BIOME = CONST.BIOME || {};
  if (biome === BIOME.SEA) return Object.freeze({ grain: 10, grainAlpha: 0.10, speckCount: 3, tuftCount: 0, shadowDelta: -13, lightDelta: 11, mottleCount: 2 });
  if (biome === BIOME.SHORE) return Object.freeze({ grain: 12, grainAlpha: 0.13, speckCount: 4, tuftCount: 2, shadowDelta: -17, lightDelta: 11, mottleCount: 3 });
  if (biome === BIOME.FOREST) return Object.freeze({ grain: 15, grainAlpha: 0.17, speckCount: 5, tuftCount: 3, shadowDelta: -25, lightDelta: 11, mottleCount: 4 });
  if (biome === BIOME.HILLS) return Object.freeze({ grain: 13, grainAlpha: 0.15, speckCount: 5, tuftCount: 2, shadowDelta: -21, lightDelta: 12, mottleCount: 4 });
  if (biome === BIOME.MOUNTAIN) return Object.freeze({ grain: 12, grainAlpha: 0.14, speckCount: 4, tuftCount: 0, shadowDelta: -25, lightDelta: 11, mottleCount: 3 });
  if (biome === BIOME.SNOW) return Object.freeze({ grain: 8, grainAlpha: 0.09, speckCount: 3, tuftCount: 0, shadowDelta: -10, lightDelta: 9, mottleCount: 1 });
  return Object.freeze({ grain: 15, grainAlpha: 0.16, speckCount: 5, tuftCount: 3, shadowDelta: -20, lightDelta: 12, mottleCount: 4 });
}

function drawGrassTufts(ctx, cell, cx, cy, halfW, halfH, alphaMul = 1) {
  if (!hasCtxMethod(ctx, 'beginPath') || !hasCtxMethod(ctx, 'moveTo') || !hasCtxMethod(ctx, 'lineTo') || !hasCtxMethod(ctx, 'stroke')) return;
  const seedA = terrainNoise((cell.tx * 1.33) + 8.1, (cell.ty * 0.71) + 2.7);
  const seedB = terrainNoise((cell.tx * 0.49) + 3.2, (cell.ty * 1.17) + 9.4);
  const hue = [74, 137, 48];
  const dry = [149, 128, 70];
  const blend = Math.max(0, Math.min(1, (seedA * 0.65) + (seedB * 0.35)));
  const color = [
    Math.round((hue[0] * (1 - blend)) + (dry[0] * blend)),
    Math.round((hue[1] * (1 - blend)) + (dry[1] * blend)),
    Math.round((hue[2] * (1 - blend)) + (dry[2] * blend)),
  ];
  ctx.strokeStyle = rgbCss(color, 0.46 * alphaMul);
  ctx.lineWidth = 1;

  const bladeCount = 3 + Math.floor(seedA * 4);
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

export function drawCellTexture(ctx, cell, cx, cy, halfW, halfH, baseRgb, textureStyle) {
  if (!ctx) return;
  const grain = Math.max(0, Math.floor(finite(textureStyle?.grain, 10)));
  const grainAlpha = Math.max(0, Math.min(0.35, finite(textureStyle?.grainAlpha, 0.10)));
  const speckCount = Math.max(0, Math.floor(finite(textureStyle?.speckCount, 3)));
  const tuftCount = Math.max(0, Math.floor(finite(textureStyle?.tuftCount, 0)));
  const shadowDelta = finite(textureStyle?.shadowDelta, -12);
  const lightDelta = finite(textureStyle?.lightDelta, 8);
  const mottleCount = Math.max(0, Math.floor(finite(textureStyle?.mottleCount, 0)));
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

  for (let i = 0; i < mottleCount; i += 1) {
    const n = terrainNoise(cell.tx * 0.43 + i * 1.31, cell.ty * 0.59 + i * 0.73);
    const n2 = terrainNoise(cell.tx * 0.91 + i * 0.47, cell.ty * 0.51 + i * 1.19);
    const n3 = terrainNoise(cell.tx * 1.37 + i * 0.29, cell.ty * 0.33 + i * 0.89);
    const px = cx - (halfW * 0.44) + (n * halfW * 0.88);
    const py = cy - (halfH * 0.38) + (n2 * halfH * 0.76);
    const color = n3 > 0.52 ? lightRgb : shadowRgb;
    ctx.fillStyle = rgbCss(color, 0.07 + n3 * 0.05);
    if (hasCtxMethod(ctx, 'fillRect')) {
      const w = 2 + Math.floor(n * 3);
      const h = 1 + Math.floor(n2 * 2);
      ctx.fillRect(Math.round(px), Math.round(py), w, h);
    }
  }

  if (tuftCount > 0) {
    const tuftChance = terrainNoise(cell.tx * 0.37 + 5.4, cell.ty * 0.41 + 2.8);
    if (tuftChance > 0.44) {
      drawGrassTufts(ctx, cell, cx, cy, halfW, halfH, Math.min(1, 0.55 + tuftCount * 0.12));
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

function resolveSpriteImage(sprite) {
  return sprite?.image || sprite;
}

function wrapTextureOffset(value, size) {
  const safeSize = Math.max(1, finite(size, 1));
  return ((Math.floor(finite(value, 0)) % safeSize) + safeSize) % safeSize;
}

function drawWrappedTextureRegion(ctx, image, sx, sy, sw, sh, dx, dy, dw, dh) {
  const imageWidth = Math.max(1, finite(image?.naturalWidth || image?.width, 1));
  const imageHeight = Math.max(1, finite(image?.naturalHeight || image?.height, 1));
  const sourceW = Math.max(1, finite(sw, dw));
  const sourceH = Math.max(1, finite(sh, dh));
  const scaleX = Math.max(0.001, finite(dw, sourceW) / sourceW);
  const scaleY = Math.max(0.001, finite(dh, sourceH) / sourceH);
  let remainingY = sourceH;
  let destY = dy;
  let sourceY = wrapTextureOffset(sy, imageHeight);

  while (remainingY > 0) {
    const sliceH = Math.min(remainingY, imageHeight - sourceY);
    let remainingX = sourceW;
    let destX = dx;
    let sourceX = wrapTextureOffset(sx, imageWidth);

    while (remainingX > 0) {
      const sliceW = Math.min(remainingX, imageWidth - sourceX);
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sliceW,
        sliceH,
        destX,
        destY,
        sliceW * scaleX,
        sliceH * scaleY,
      );
      remainingX -= sliceW;
      destX += sliceW * scaleX;
      sourceX = 0;
    }

    remainingY -= sliceH;
    destY += sliceH * scaleY;
    sourceY = 0;
  }
}

function chunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

export const DIMETRIC_TERRAIN_MAX_CACHE_BYTES = Number(CONST.DIMETRIC?.TERRAIN_MAX_CACHE_BYTES)
  || (96 * 1024 * 1024);

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

function buildTerrainCell({
  tx,
  ty,
  isoX,
  isoY,
  biome,
  mapWidth,
  mapHeight,
  resolveBiomeAt,
} = {}) {
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
  return {
    tx,
    ty,
    isoX,
    isoY,
    biome,
    transitionMask,
    transitionNeighbors,
    coastlineMask,
  };
}

function drawTerrainCellBase(ctx, cell, cx, cy, halfW, halfH, {
  groundPreset = 'classic',
  groundSpriteVariants = null,
  tileW = halfW * 2,
  tileH = halfH * 2,
} = {}) {
  if (!ctx || !cell) return false;
  const base = biomeBaseRgb(cell.biome, groundPreset);
  const textureStyle = resolveBiomeTextureStyle(cell.biome);
  const noise = terrainNoise(cell.tx, cell.ty);
  const fill = shadeColor(base, (noise - 0.5) * 14);
  const edge = shadeColor(base, -14);
  const groundSprite = pickGroundSpriteForBiome(cell.biome, groundSpriteVariants, cell.tx, cell.ty);
  const spriteImage = resolveSpriteImage(groundSprite);
  const canDrawSprite = Boolean(spriteImage && hasCtxMethod(ctx, 'drawImage'));

  if (canDrawSprite) {
    const mode = groundSprite?.mode || 'image';
    const sh = Math.max(1, finite(groundSprite.height, tileH));
    const dx = Math.round(cx - halfW);
    const dy = mode === 'world-texture-diamond'
      ? Math.round(cy - halfH)
      : Math.round(cy + halfH - sh);
    safeCtxSave(ctx);
    if (mode === 'world-texture-diamond') drawDiamondPath(ctx, cx, cy, halfW + 0.85, halfH + 0.45);
    else drawDiamondPath(ctx, cx, cy, halfW, halfH);
    safeCtxClip(ctx);
    if (mode === 'world-texture-diamond') {
      const sourceTileW = Math.max(1, finite(groundSprite.width, 64));
      const sourceTileH = Math.max(1, finite(groundSprite.height, 32));
      const sourceX = ((finite(cell.tx, 0) - finite(cell.ty, 0)) * sourceTileW * 0.5) - (sourceTileW * 0.5);
      const sourceY = ((finite(cell.tx, 0) + finite(cell.ty, 0)) * sourceTileH * 0.5) - (sourceTileH * 0.5);
      drawWrappedTextureRegion(ctx, spriteImage, sourceX, sourceY, sourceTileW, sourceTileH, dx, dy, tileW, tileH);
    } else {
      ctx.drawImage(spriteImage, dx, dy, tileW, sh);
    }
    if (mode !== 'world-texture-diamond' && hasCtxMethod(ctx, 'fillRect')) {
      ctx.fillStyle = rgbCss(shadeColor(base, (noise - 0.5) * 10), 0.16);
      ctx.fillRect(dx, Math.round(cy - halfH), tileW, tileH + 3);
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
  if (!canDrawSprite && hasCtxMethod(ctx, 'stroke')) {
    ctx.strokeStyle = rgbCss(edge, 0.28);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  return true;
}

function drawCellTransitions(ctx, cell, cx, cy, halfW, halfH, groundStylePreset = 'classic') {
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
    maxCacheBytes = DIMETRIC_TERRAIN_MAX_CACHE_BYTES,
    groundStylePreset = 'classic',
    groundSpriteVariants = null,
    canvasFactory = defaultCanvasFactory,
  } = {}) {
    this.chunkSize = Math.max(4, Math.floor(finite(chunkSize, 16)));
    this.maxCacheBytes = Math.max(1, Math.floor(finite(maxCacheBytes, DIMETRIC_TERRAIN_MAX_CACHE_BYTES)));
    this._groundStylePreset = normalizeGroundStylePreset(groundStylePreset);
    this._groundSpriteVariants = groundSpriteVariants && typeof groundSpriteVariants === 'object'
      ? groundSpriteVariants
      : null;
    this.canvasFactory = typeof canvasFactory === 'function' ? canvasFactory : defaultCanvasFactory;
    this._chunks = new Map();
    this._tick = 0;
    this._totalBytes = 0;
    this._visibleKeys = new Set();
    this._frameBuildLimit = 4;
    this._frameBuilds = 0;
    this._frameBuildSkips = 0;
    this._budgetBlockedThisFrame = false;
    this._mapRef = null;
    this._tileW = 64;
    this._tileH = 32;
  }

  clear() {
    this._chunks.clear();
    this._tick = 0;
    this._totalBytes = 0;
    this._frameBuilds = 0;
    this._frameBuildSkips = 0;
  }

  beginFrame({
    visibleKeys = null,
    frameBuildLimit = 4,
  } = {}) {
    this._visibleKeys = visibleKeys instanceof Set
      ? new Set(visibleKeys)
      : new Set(Array.isArray(visibleKeys) ? visibleKeys : []);
    this._frameBuildLimit = Math.max(1, Math.min(4, Math.floor(finite(frameBuildLimit, 4))));
    this._frameBuilds = 0;
    this._frameBuildSkips = 0;
    this._budgetBlockedThisFrame = false;
  }

  configure({
    map,
    tileW = 64,
    tileH = 32,
    chunkSize = this.chunkSize,
    maxCacheBytes = this.maxCacheBytes,
    groundStylePreset = this._groundStylePreset,
    groundSpriteVariants = this._groundSpriteVariants,
  } = {}) {
    const safeTileW = Math.max(2, finite(tileW, 64));
    const safeTileH = Math.max(2, finite(tileH, 32));
    const safeChunkSize = Math.max(4, Math.floor(finite(chunkSize, this.chunkSize)));
    const safeMaxCacheBytes = Math.max(1, Math.floor(finite(maxCacheBytes, this.maxCacheBytes)));
    const safeGroundPreset = normalizeGroundStylePreset(groundStylePreset);
    const safeGroundSprites = groundSpriteVariants && typeof groundSpriteVariants === 'object'
      ? groundSpriteVariants
      : null;
    const needsReset = this._mapRef !== map
      || this._tileW !== safeTileW
      || this._tileH !== safeTileH
      || this.chunkSize !== safeChunkSize
      || this.maxCacheBytes !== safeMaxCacheBytes
      || this._groundStylePreset !== safeGroundPreset
      || this._groundSpriteVariants !== safeGroundSprites;
    if (needsReset) this.clear();
    this._mapRef = map;
    this._tileW = safeTileW;
    this._tileH = safeTileH;
    this.chunkSize = safeChunkSize;
    this.maxCacheBytes = safeMaxCacheBytes;
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
    if (this._frameBuilds >= this._frameBuildLimit) {
      this._frameBuildSkips += 1;
      return null;
    }
    if (this._budgetBlockedThisFrame) {
      this._frameBuildSkips += 1;
      return null;
    }
    const safeChunkX = Math.floor(finite(chunkX, 0));
    const safeChunkY = Math.floor(finite(chunkY, 0));
    const safeMapWidth = Math.max(1, Math.floor(finite(mapWidth, 1)));
    const safeMapHeight = Math.max(1, Math.floor(finite(mapHeight, 1)));
    const estimatedBytes = this._estimateChunkByteSize({
      chunkX: safeChunkX,
      chunkY: safeChunkY,
      mapWidth: safeMapWidth,
      mapHeight: safeMapHeight,
    });
    if (estimatedBytes > this.maxCacheBytes) {
      this._frameBuildSkips += 1;
      return null;
    }
    this._evictIfNeeded(estimatedBytes);
    if (this._totalBytes + estimatedBytes > this.maxCacheBytes) {
      this._budgetBlockedThisFrame = true;
      this._frameBuildSkips += 1;
      return null;
    }
    const built = this._buildChunk({
      chunkX: safeChunkX,
      chunkY: safeChunkY,
      mapWidth: safeMapWidth,
      mapHeight: safeMapHeight,
      resolveBiomeAt,
    });
    if (!built) return null;
    built.byteSize = Math.max(0, Math.floor(finite(built.width, 0) * finite(built.height, 0) * 4));
    if (built.byteSize > this.maxCacheBytes) {
      this._frameBuildSkips += 1;
      return null;
    }
    built.lastUsed = ++this._tick;
    this._chunks.set(key, built);
    this._totalBytes += built.byteSize;
    this._frameBuilds += 1;
    this._evictIfNeeded();
    if (this._totalBytes > this.maxCacheBytes) {
      const inserted = this._chunks.get(key);
      this._chunks.delete(key);
      this._totalBytes = Math.max(0, this._totalBytes - (Number(inserted?.byteSize) || 0));
      this._budgetBlockedThisFrame = true;
      this._frameBuildSkips += 1;
      return null;
    }
    return built;
  }

  getStats() {
    return {
      chunkCount: this._chunks.size,
      chunkSize: this.chunkSize,
      maxCacheBytes: this.maxCacheBytes,
      totalBytes: this._totalBytes,
      cacheMB: this._totalBytes / (1024 * 1024),
      maxCacheMB: this.maxCacheBytes / (1024 * 1024),
      chunkBuildsThisFrame: this._frameBuilds,
      chunkBuildSkipsThisFrame: this._frameBuildSkips,
      groundStylePreset: this._groundStylePreset,
      groundSpritesEnabled: Boolean(this._groundSpriteVariants),
    };
  }

  _evictIfNeeded(extraBytes = 0) {
    const neededBytes = Math.max(0, Math.floor(finite(extraBytes, 0)));
    while ((this._totalBytes + neededBytes) > this.maxCacheBytes) {
      let oldestKey = null;
      let oldestTick = Infinity;
      for (const [key, value] of this._chunks.entries()) {
        if (this._visibleKeys.has(key)) continue;
        if (value.lastUsed < oldestTick) {
          oldestTick = value.lastUsed;
          oldestKey = key;
        }
      }
      if (oldestKey === null) break;
      const evicted = this._chunks.get(oldestKey);
      this._totalBytes = Math.max(0, this._totalBytes - (Number(evicted?.byteSize) || 0));
      this._chunks.delete(oldestKey);
    }
  }

  _estimateChunkByteSize({
    chunkX,
    chunkY,
    mapWidth,
    mapHeight,
  }) {
    const startX = chunkX * this.chunkSize;
    const startY = chunkY * this.chunkSize;
    const endX = Math.min(mapWidth - 1, startX + this.chunkSize - 1);
    const endY = Math.min(mapHeight - 1, startY + this.chunkSize - 1);
    if (startX > endX || startY > endY) return 0;

    const halfW = this._tileW * 0.5;
    const halfH = this._tileH * 0.5;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let ty = startY; ty <= endY; ty += 1) {
      for (let tx = startX; tx <= endX; tx += 1) {
        const isoX = (tx - ty) * halfW;
        const isoY = (tx + ty) * halfH;
        minX = Math.min(minX, isoX - halfW);
        minY = Math.min(minY, isoY - halfH);
        maxX = Math.max(maxX, isoX + halfW);
        maxY = Math.max(maxY, isoY + halfH);
      }
    }

    const padding = 2;
    const width = Math.max(1, Math.ceil((maxX - minX) + (padding * 2) + 1));
    const height = Math.max(1, Math.ceil((maxY - minY) + (padding * 2) + 1));
    return width * height * 4;
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
        minX = Math.min(minX, isoX - halfW);
        minY = Math.min(minY, isoY - halfH);
        maxX = Math.max(maxX, isoX + halfW);
        maxY = Math.max(maxY, isoY + halfH);
        cells.push(buildTerrainCell({
          tx,
          ty,
          isoX,
          isoY,
          biome,
          mapWidth,
          mapHeight,
          resolveBiomeAt,
        }));
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
      drawTerrainCellBase(ctx, cell, cx, cy, halfW, halfH, {
        groundPreset,
        groundSpriteVariants: this._groundSpriteVariants,
        tileW: this._tileW,
        tileH: this._tileH,
      });
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
