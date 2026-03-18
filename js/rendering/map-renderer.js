/**
 * FallOfCavalry – Map Renderer  (Mount & Blade overworld style)
 *
 * Yerleşimler kale/köy silüeti, lordlar bayraklı süvari ikonu,
 * oyuncu altın banner, hareket hedefi noktalı çizgi.
 */

import * as CONST from '../constants.js';
import { shade } from '../utils.js';

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

// ══════════════════════════════════════════════════════════════════════════
export class MapRenderer {
  constructor() {
    this._frame = 0;
    this._forestSet = null;
    this._mountainSet = null;
    this._lastMapId = null;
  }

  // Build O(1) lookup sets for forests/mountains (once per map)
  _ensureLookups(map) {
    const id = map._id || (map._id = Math.random());
    if (this._lastMapId === id) return;
    this._lastMapId = id;
    this._forestSet = new Set();
    this._mountainSet = new Set();
    for (const f of (map.forests || [])) this._forestSet.add(f.y * map.width + f.x);
    for (const m of (map.mountains || [])) this._mountainSet.add(m.y * map.width + m.x);
  }

  render(ctx, state) {
    const { map, player, camera, settings } = state;
    const T = CONST.WORLD.TILE_SIZE;
    this._frame++;
    this._ensureLookups(map);

    ctx.save();
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

    if (fog >= 1) {
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

    const idx = y * map.width + x;
    const isForest   = this._forestSet?.has(idx);
    const isMountain = this._mountainSet?.has(idx);

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
  _drawShore(ctx, px, py, T, fog, tx, ty, map) {
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
    if (tileRand(tx, ty, 280) > 0.88) {
      const bx = px + T * (0.2 + tileRand(tx, ty, 281) * 0.6);
      const by = py + T * (0.2 + tileRand(tx, ty, 282) * 0.6);
      this._drawSmallBush(ctx, bx, by, T * 0.06, '#3A6A28');
    }

    // Tek ağaç
    if (tileRand(tx, ty, 290) > 0.85) {
      const tx2 = px + T * (0.2 + tileRand(tx, ty, 291) * 0.6);
      const ty2 = py + T * (0.35 + tileRand(tx, ty, 292) * 0.4);
      const palIdx = Math.floor(tileRand(tx, ty, 293) * MapRenderer.TREE_PALETTES.length);
      this._drawTree(ctx, tx2, ty2, T * 0.22, dim, fog, palIdx);
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
    const dim = fog === 1 ? -0.18 : 0;

    // Koyu orman tabanı — toprak+gölge karışımı
    ctx.fillStyle = fog === 1 ? '#1A2818' : '#223420';
    ctx.fillRect(px, py, T, T);

    const treeCount = 3 + Math.floor(tileRand(tx, ty, 400) * 2); // 3-4 ağaç
    const trees = [];
    for (let i = 0; i < treeCount; i++) {
      trees.push({
        x: px + T * (0.08 + tileRand(tx, ty, 410 + i * 5) * 0.84),
        y: py + T * (0.20 + tileRand(tx, ty, 411 + i * 5) * 0.65),
        scale: 0.80 + tileRand(tx, ty, 412 + i * 5) * 0.40,
        palette: Math.floor(tileRand(tx, ty, 413 + i * 5) * MapRenderer.TREE_PALETTES.length),
        isPine: tileRand(tx, ty, 414 + i * 5) > 0.40, // %60 çam (iğne yapraklı ağırlıklı)
      });
    }
    trees.sort((a, b) => a.y - b.y);

    for (const t of trees) {
      const s = T * 0.38 * t.scale;
      if (t.isPine) {
        this._drawPine(ctx, t.x, t.y, s, dim, fog, t.palette);
      } else {
        this._drawTree(ctx, t.x, t.y, s, dim, fog, t.palette);
      }
    }
  }

  // ── Yaprak ağaç — Dolgun yuvarlak taç, güçlü siluet ───────────────────
  // Işık sol üstten gelir: sol üst açık, sağ alt koyu
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
  _drawMountain(ctx, px, py, T, fog, tx, ty) {
    const dim = fog === 1 ? -0.18 : 0;
    const base = py + T * 0.95;
    const peakCount = 1 + Math.floor(tileRand(tx, ty, 500) * 2);

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(px + T * 0.52, base + T * 0.02, T * 0.52, T * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();

    const peaks = [];
    for (let i = 0; i < peakCount; i++) {
      peaks.push({
        cx: 0.20 + tileRand(tx, ty, 510 + i * 4) * 0.60,
        peakY: -0.12 + tileRand(tx, ty, 511 + i * 4) * 0.10,
        width: 0.36 + tileRand(tx, ty, 512 + i * 4) * 0.18,
      });
    }
    peaks.sort((a, b) => b.peakY - a.peakY);

    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      const mcx = px + T * p.cx;
      const peakTop = py + T * p.peakY;
      const halfW = T * p.width;

      // Tam siluet (en koyu)
      ctx.fillStyle = shade('#3A3E48', dim - 0.15);
      ctx.beginPath();
      ctx.moveTo(mcx - halfW * 1.3, base);
      ctx.lineTo(mcx - halfW * 0.15, peakTop + T * 0.04);
      ctx.lineTo(mcx, peakTop);
      ctx.lineTo(mcx + halfW * 0.20, peakTop + T * 0.03);
      ctx.lineTo(mcx + halfW * 1.3, base);
      ctx.closePath();
      ctx.fill();

      // Sağ yüz — soğuk koyu gri/mavi (gölge)
      ctx.fillStyle = shade('#484E58', dim - 0.06);
      ctx.beginPath();
      ctx.moveTo(mcx, peakTop);
      ctx.lineTo(mcx + halfW * 0.20, peakTop + T * 0.03);
      ctx.lineTo(mcx + halfW * 1.25, base);
      ctx.lineTo(mcx + halfW * 0.05, base);
      ctx.closePath();
      ctx.fill();

      // Sol yüz — açık sıcak gri (ışık)
      ctx.fillStyle = shade('#8A9098', dim + 0.08);
      ctx.beginPath();
      ctx.moveTo(mcx, peakTop);
      ctx.lineTo(mcx - halfW * 0.15, peakTop + T * 0.04);
      ctx.lineTo(mcx - halfW * 1.2, base);
      ctx.lineTo(mcx - halfW * 0.05, base);
      ctx.closePath();
      ctx.fill();

      // Sırt çizgisi vurgu
      if (fog === 2) {
        ctx.strokeStyle = shade('#B0B8C0', dim + 0.15);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(mcx - halfW * 0.15, peakTop + T * 0.04);
        ctx.lineTo(mcx, peakTop);
        ctx.lineTo(mcx + halfW * 0.20, peakTop + T * 0.03);
        ctx.stroke();

        // Kaya doku çizgileri
        ctx.strokeStyle = 'rgba(30,35,45,0.20)';
        ctx.lineWidth = 0.7;
        const cracks = 3 + Math.floor(tileRand(tx, ty, 540 + i * 5) * 3);
        for (let c = 0; c < cracks; c++) {
          const frac = 0.18 + c * 0.16 + tileRand(tx, ty, 550 + i * 5 + c) * 0.05;
          const cy0 = peakTop + (base - peakTop) * frac;
          const cx0 = mcx + halfW * (-0.5 + tileRand(tx, ty, 560 + i * 5 + c) * 0.4);
          const cx1 = cx0 + halfW * (0.2 + tileRand(tx, ty, 570 + i * 5 + c) * 0.3);
          ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(cx1, cy0 + T * 0.01); ctx.stroke();
        }
      }

      // Kar başlığı
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

    // Taban kayaları
    if (fog === 2 && tileRand(tx, ty, 600) > 0.4) {
      for (let i = 0; i < 2; i++) {
        const bx = px + T * (0.1 + tileRand(tx, ty, 610 + i * 2) * 0.8);
        const by = base - T * (0.02 + tileRand(tx, ty, 611 + i * 2) * 0.05);
        this._drawRock(ctx, bx, by, T * (0.035 + tileRand(tx, ty, 612 + i * 2) * 0.03));
      }
    }
  }

  // ── Small decorative elements ──────────────────────────────────────────
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
  _drawRivers(ctx, rivers, T) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    for (const r of rivers) {
      if (r.length < 2) continue;
      const pts = r.map(p => ({ x: p.x * T + T / 2, y: p.y * T + T / 2 }));

      // River bank (dark outer edge)
      ctx.strokeStyle = 'rgba(25,55,80,0.5)';
      ctx.lineWidth = T * 0.28;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      // Main water body
      ctx.strokeStyle = '#2870A5';
      ctx.lineWidth = T * 0.20;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      // Center highlight (lighter blue)
      ctx.strokeStyle = '#4A9AD4';
      ctx.lineWidth = T * 0.10;
      this._drawSmoothPath(ctx, pts);
      ctx.stroke();

      // Specular highlight
      ctx.strokeStyle = 'rgba(130,195,240,0.35)';
      ctx.lineWidth = T * 0.035;
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
    const fc = this._factionColor(settlement.owner);

    ctx.save();
    switch (settlement.type) {
      case 'city':    this._castle(ctx, cx, cy, T * 0.48, fc, 'city'); break;
      case 'town':    this._castle(ctx, cx, cy, T * 0.34, fc, 'town'); break;
      case 'fort':    this._castle(ctx, cx, cy, T * 0.28, fc, 'fort'); break;
      default:        this._village(ctx, cx, cy, T * 0.29, fc);
    }
    ctx.restore();

    const offY = { city: T * 0.58, town: T * 0.42, fort: T * 0.36 }[settlement.type] ?? T * 0.36;
    this._label(ctx, cx, cy + offY, settlement.name, 'rgba(255,248,200,0.97)');
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
      hre:     '#2c6ca8',
      polish:  '#b94040',
      spanish: '#c8a000',
      venice:  '#16a085',
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
