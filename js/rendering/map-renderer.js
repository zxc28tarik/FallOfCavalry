/**
 * FallOfCavalry – Map Renderer  (Mount & Blade overworld style)
 *
 * Yerleşimler kale/köy silüeti, lordlar bayraklı süvari ikonu,
 * oyuncu altın banner, hareket hedefi noktalı çizgi.
 */

import * as CONST from '../constants.js';
import { shade } from '../utils.js';
import { drawMainGroundRegion } from './main-ground-texture.js';
import { TERRAIN, FLAGS } from '../world/map-data.js';
import { ChunkManager } from '../world/chunk-manager.js';

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

function terrainNoise(x, y, seed = 0) {
  const n = Math.sin((x * 12.9898) + (y * 78.233) + seed * 31.337) * 43758.5453;
  return n - Math.floor(n);
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
    this.chunkManager = null;
    this.fogDirtyChunks = new Set();
    this.lastMapData = null;
    this._boundChunkDirty = null;
    this._chunkRenderStats = { rebuilds: 0, rebuildMsMax: 0 };
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

  render(ctx, state) {
    const map = state?.map || null;
    const mapData = map?.mapData || map?.__mapData || state?.mapData || null;
    if (!mapData?.terrain || !mapData?.flags) {
      return this.renderLegacy(ctx, state);
    }

    const T = CONST.WORLD.TILE_SIZE;
    const camera = state?.camera || { x: 0, y: 0, zoom: 1 };
    const zoom = Number(camera?.zoom) > 0 ? Number(camera.zoom) : 1;
    const visibleWorldCamera = {
      x: Number(camera?.x) || 0,
      y: Number(camera?.y) || 0,
      w: ctx.canvas.width / zoom,
      h: ctx.canvas.height / zoom,
    };

    this._frame++;
    this.ensureChunkManager(mapData);
    this.syncDirtyChunks(mapData);
    this._ensureLookups(map || mapData);
    this._visibleLargeMountainCells.clear();

    const visibleChunks = this.chunkManager.getVisibleChunks(visibleWorldCamera, T, 1);

    ctx.save();
    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.scale(zoom, zoom);
    ctx.translate(-visibleWorldCamera.x, -visibleWorldCamera.y);

    for (const chunk of visibleChunks) {
      const hadCache = this.chunkManager.cache.has(chunk.key);
      const entry = this.chunkManager.getOrCreateCacheCanvas(chunk.cx, chunk.cy, T);
      if (!hadCache || this.chunkManager.isDirty(chunk.cx, chunk.cy)) {
        this.rebuildChunkCanvas(entry, mapData, chunk.cx, chunk.cy, T);
        this.chunkManager.clearDirty(chunk.cx, chunk.cy);
      }
      ctx.drawImage(entry.canvas, chunk.cx * this.chunkManager.chunkSize * T, chunk.cy * this.chunkManager.chunkSize * T);
    }

    this.drawVisibleDynamicEntities(ctx, state, visibleWorldCamera, T);
    this.drawVisibleFog(ctx, mapData, visibleChunks, visibleWorldCamera, T);

    ctx.imageSmoothingEnabled = prevSmoothing;
    ctx.restore();
  }

  renderLegacy(ctx, state) {
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
  ensureChunkManager(mapData) {
    if (this.lastMapData === mapData && this.chunkManager) return this.chunkManager;

    if (this.lastMapData && this.lastMapData.onChunkDirty === this._boundChunkDirty) {
      this.lastMapData.onChunkDirty = null;
    }

    this.chunkManager?.clearCache?.();
    this.fogDirtyChunks = new Set();
    this.lastMapData = mapData;
    this.chunkManager = new ChunkManager(mapData, {
      chunkSize: Math.max(1, Number(mapData.chunkSize) || 64),
    });

    const activeMapData = mapData;
    this._boundChunkDirty = (cx, cy, reason = 'terrain') => {
      if (this.lastMapData !== activeMapData || !this.chunkManager) return;
      if (reason === 'fog') {
        this.fogDirtyChunks.add(this.chunkManager.chunkKey(cx, cy));
        return;
      }
      this.chunkManager.markDirtyChunk(cx, cy);
    };
    mapData.onChunkDirty = this._boundChunkDirty;
    return this.chunkManager;
  }

  syncDirtyChunks(mapData) {
    if (!this.chunkManager) return;
    for (const key of mapData.consumeModifiedChunks?.() || []) {
      this.chunkManager.markDirtyKey(key);
    }
    for (const key of mapData.consumeFogModifiedChunks?.() || []) {
      this.fogDirtyChunks.add(key);
    }
  }

  rebuildChunkCanvas(entry, mapData, cx, cy, tileSize) {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const ctx = entry.ctx || entry.context;
    if (!ctx) return;

    const S = this.chunkManager.chunkSize;
    const startX = cx * S;
    const startY = cy * S;
    const endX = Math.min(mapData.width, startX + S);
    const endY = Math.min(mapData.height, startY + S);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);

    for (let ty = startY; ty < endY; ty++) {
      const row = ty * mapData.width;
      const py = (ty - startY) * tileSize;
      for (let tx = startX; tx < endX; tx++) {
        const i = row + tx;
        const px = (tx - startX) * tileSize;
        this.drawTerrainById(ctx, mapData.terrain[i], px, py, tileSize, tx, ty);
        this.drawStaticOverlaysByFlags(ctx, mapData.flags[i], px, py, tileSize, tx, ty);
      }
    }

    ctx.restore();
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    this._chunkRenderStats.rebuilds++;
    this._chunkRenderStats.rebuildMsMax = Math.max(this._chunkRenderStats.rebuildMsMax, elapsed);
  }

  drawTerrainById(ctx, terrainId, px, py, T, tx, ty) {
    switch (terrainId) {
      case TERRAIN.WATER:
        if (typeof this._drawWater === 'function') this._drawWater(ctx, px, py, T, 2, tx, ty);
        else this._fillTerrainFallback(ctx, px, py, T, 'water');
        break;
      case TERRAIN.SHORE:
        if (typeof this._drawShore === 'function') this._drawShore(ctx, px, py, T, 2, tx, ty, null);
        else this._fillTerrainFallback(ctx, px, py, T, 'shore');
        break;
      case TERRAIN.SNOW:
        if (typeof this._drawSnow === 'function') this._drawSnow(ctx, px, py, T, 2, tx, ty);
        else this._fillTerrainFallback(ctx, px, py, T, 'snow');
        break;
      case TERRAIN.FOREST:
      case TERRAIN.MOUNTAIN:
      case TERRAIN.GRASS:
      default:
        if (typeof this._drawGrass === 'function') this._drawGrass(ctx, px, py, T, 2, tx, ty);
        else this._fillTerrainFallback(ctx, px, py, T, 'grass');
        break;
    }
  }

  drawStaticOverlaysByFlags(ctx, flags, px, py, T, tx, ty) {
    if (flags & FLAGS.RIVER) {
      ctx.save();
      ctx.strokeStyle = 'rgba(54,118,145,0.78)';
      ctx.lineWidth = Math.max(2, T * 0.16);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px + T * 0.08, py + T * 0.56);
      ctx.quadraticCurveTo(px + T * 0.48, py + T * 0.40, px + T * 0.92, py + T * 0.52);
      ctx.stroke();
      ctx.restore();
    }

    if (flags & FLAGS.ROAD) {
      ctx.save();
      ctx.strokeStyle = 'rgba(112,84,49,0.72)';
      ctx.lineWidth = Math.max(1.5, T * 0.10);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py + T * 0.58);
      ctx.lineTo(px + T, py + T * 0.44);
      ctx.stroke();
      ctx.restore();
    }

    if (flags & FLAGS.MOUNTAIN) {
      if (typeof this._drawMountain === 'function') this._drawMountain(ctx, px, py, T, 2, tx, ty);
      else this._drawMountainFallback(ctx, px, py, T);
    }

    if (flags & FLAGS.FOREST) {
      if (typeof this._drawForest === 'function') this._drawForest(ctx, px, py, T, 2, tx, ty);
      else this._drawForestFallback(ctx, px, py, T);
    }
  }

  drawVisibleFog(ctx, mapData, visibleChunks, visibleWorldCamera, T) {
    if (!mapData?.fog) return;

    ctx.save();
    ctx.fillStyle = '#000';

    for (const chunk of visibleChunks) {
      const chunkX = chunk.cx * this.chunkManager.chunkSize;
      const chunkY = chunk.cy * this.chunkManager.chunkSize;
      const x0 = Math.max(chunkX, Math.floor(visibleWorldCamera.x / T) - 1);
      const y0 = Math.max(chunkY, Math.floor(visibleWorldCamera.y / T) - 1);
      const x1 = Math.min(chunkX + this.chunkManager.chunkSize, mapData.width, Math.ceil((visibleWorldCamera.x + visibleWorldCamera.w) / T) + 1);
      const y1 = Math.min(chunkY + this.chunkManager.chunkSize, mapData.height, Math.ceil((visibleWorldCamera.y + visibleWorldCamera.h) / T) + 1);

      for (let ty = y0; ty < y1; ty++) {
        const row = ty * mapData.width;
        const py = ty * T;
        for (let tx = x0; tx < x1; tx++) {
          const fog = mapData.fog[row + tx];
          if (fog >= 2) continue;
          ctx.globalAlpha = fog === 0 ? 0.82 : 0.38;
          ctx.fillRect(tx * T, py, T, T);
        }
      }
    }

    this.fogDirtyChunks.clear();
    ctx.restore();
  }

  drawVisibleDynamicEntities(ctx, state, visibleWorldCamera, T) {
    const player = state?.player;
    if (player && Math.hypot((player.tx ?? 0) - (player.x ?? 0), (player.ty ?? 0) - (player.y ?? 0)) > 0.4) {
      this._drawMovePath(ctx, player, T);
    }

    const pad = T * 4;
    const inView = (entity) => {
      const x = Number(entity?.x);
      const y = Number(entity?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      return x >= visibleWorldCamera.x - pad &&
        y >= visibleWorldCamera.y - pad &&
        x <= visibleWorldCamera.x + visibleWorldCamera.w + pad &&
        y <= visibleWorldCamera.y + visibleWorldCamera.h + pad;
    };

    for (const party of state?.aiParties || []) {
      if (inView(party)) this._drawLordParty(ctx, party, T);
    }

    if (player) this._drawPlayerParty(ctx, player, T);
  }

  _fillTerrainFallback(ctx, px, py, T, type) {
    ctx.fillStyle = this._terrainColor(type);
    ctx.fillRect(px, py, T, T);
  }

  _drawForestFallback(ctx, px, py, T) {
    ctx.save();
    ctx.fillStyle = '#2f6a35';
    ctx.beginPath();
    ctx.arc(px + T * 0.35, py + T * 0.45, T * 0.20, 0, Math.PI * 2);
    ctx.arc(px + T * 0.58, py + T * 0.38, T * 0.24, 0, Math.PI * 2);
    ctx.arc(px + T * 0.68, py + T * 0.58, T * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawMountainFallback(ctx, px, py, T) {
    ctx.save();
    ctx.fillStyle = '#70685a';
    ctx.beginPath();
    ctx.moveTo(px + T * 0.12, py + T * 0.84);
    ctx.lineTo(px + T * 0.50, py + T * 0.18);
    ctx.lineTo(px + T * 0.88, py + T * 0.84);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,238,214,0.55)';
    ctx.lineWidth = Math.max(1, T * 0.05);
    ctx.beginPath();
    ctx.moveTo(px + T * 0.50, py + T * 0.18);
    ctx.lineTo(px + T * 0.42, py + T * 0.42);
    ctx.lineTo(px + T * 0.52, py + T * 0.36);
    ctx.stroke();
    ctx.restore();
  }

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
      if (tile.type === 'water') {
        this._drawWater(ctx, px, py, T, fog, x, y);
      } else if (tile.type === 'shore') {
        this._drawShore(ctx, px, py, T, fog, x, y, map);
      } else if (tile.type === 'grass' || tile.type === 'forest' || tile.type === 'mountain') {
        this._drawGrass(ctx, px, py, T, fog, x, y);
      } else if (tile.type === 'snow') {
        this._drawSnow(ctx, px, py, T, fog, x, y);
      } else {
        drawMainGroundRegion(ctx, px, py, T, T, '#365b22', x * T, y * T);
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
    const inset = T * (insetBase + terrainNoise(tx * 0.19, ty * 0.23, 8401) * insetVar);
    const wave = T * (waveBase + terrainNoise(tx * 0.31, ty * 0.27, 8407) * waveVar);

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
    drawMainGroundRegion(ctx, px, py, T, T, '#365b22', tx * T, ty * T);
    if (fog === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(px, py, T, T);
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
    const dim = fog === 1 ? -0.18 : 0;

    ctx.fillStyle = fog === 1 ? '#162415' : '#20361f';
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = fog === 1 ? 'rgba(12,22,12,0.28)' : 'rgba(16,34,16,0.32)';
    if (north) ctx.fillRect(px, py - T * 0.08, T, T * 0.24);
    if (south) ctx.fillRect(px, py + T * 0.84, T, T * 0.24);
    if (west) ctx.fillRect(px - T * 0.08, py, T * 0.24, T);
    if (east) ctx.fillRect(px + T * 0.84, py, T * 0.24, T);

    const treeCount = Math.max(2, Math.ceil((4 + Math.floor(neighbor8 * 0.68) + Math.floor(tileRand(tx, ty, 400) * 3)) * 0.5));
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
      const bendNoise = terrainNoise((a.x + b.x) * 0.007, (a.y + b.y) * 0.009, 8603 + i * 17);
      const bendSign = bendNoise > 0.5 ? 1 : -1;
      const bendAmp = T * (0.08 + terrainNoise(a.x * 0.013, a.y * 0.011, 8611 + i * 13) * 0.09);
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
      const widthNoise = terrainNoise((r[0]?.x || 0) * 0.12, (r[0]?.y || 0) * 0.14, 8627);
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

  // ══════════════════════════════════════════════════════════════════════════
  // ── Şehir Çizim Sistemi (Ana Harita) ────────────────────────────────────
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
  drawSettlement(_ctx, _s, _T) {}
  drawAIParty(ctx, p, T)      { this._drawLordParty(ctx, p, T); }
  drawPlayer(ctx, pl, T)      { this._drawPlayerParty(ctx, pl, T); }
}

export default MapRenderer;
