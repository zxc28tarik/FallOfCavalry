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

// ══════════════════════════════════════════════════════════════════════════
export class MapRenderer {
  constructor() {
    this._frame = 0;
  }

  render(ctx, state) {
    const { map, player, camera, settings } = state;
    const T = CONST.WORLD.TILE_SIZE;
    this._frame++;

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Viewport culling
    const vx = Math.floor(camera.x / T);
    const vy = Math.floor(camera.y / T);
    const vw = Math.ceil(ctx.canvas.width  / T) + 3;
    const vh = Math.ceil(ctx.canvas.height / T) + 3;
    const x0 = Math.max(0, vx - 1),        y0 = Math.max(0, vy - 1);
    const x1 = Math.min(map.width, vx + vw), y1 = Math.min(map.height, vy + vh);

    // 1 – Zemin karoları
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
      const fog = map.fog ? map.fog[s.y * map.width + s.x] : 2;
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

  // ── Karo ─────────────────────────────────────────────────────────────────
  _drawTile(ctx, tile, x, y, T, fog, map) {
    const px = x * T, py = y * T;
    let base = this._terrainColor(tile.type);
    if (fog === 1) base = shade(base, -0.42);

    ctx.fillStyle = base;
    ctx.fillRect(px, py, T, T);

    // Hafif desen (çayır/kıyı)
    if (fog === 2 && (tile.type === 'grass' || tile.type === 'shore')) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        ctx.fillRect(px, py, T, T);
      }
    }

    const isForest   = map.forests?.some(f => f.x === x && f.y === y);
    const isMountain = map.mountains?.some(m => m.x === x && m.y === y);

    if (isForest)   this._drawForest(ctx, px, py, T, fog);
    if (isMountain) this._drawMountain(ctx, px, py, T, fog);
  }

  _drawForest(ctx, px, py, T, fog) {
    const dim = fog === 1 ? -0.42 : 0;
    const dark  = shade(CONST.WORLD.COLOR_FOREST, dim - 0.18);
    const mid   = shade(CONST.WORLD.COLOR_FOREST, dim);
    const light = shade(CONST.WORLD.COLOR_FOREST, dim + 0.14);

    // Üstten görünen 3 ağaç tacı (oval)
    const crowns = [
      { rx: 0.25, ry: 0.56, r: 0.22 },
      { rx: 0.75, ry: 0.56, r: 0.22 },
      { rx: 0.50, ry: 0.28, r: 0.23 },
    ];
    for (const c of crowns) {
      const cx = px + T * c.rx, cy = py + T * c.ry, r = T * c.r;
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(cx + 1, cy + 2, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mid;
      ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      if (fog === 2) {
        ctx.fillStyle = light;
        ctx.beginPath(); ctx.ellipse(cx - r * 0.22, cy - r * 0.22, r * 0.52, r * 0.42, -0.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  _drawMountain(ctx, px, py, T, fog) {
    const base = py + T * 0.86;

    // Arka dağ
    ctx.fillStyle = shade(CONST.WORLD.COLOR_MOUNTAIN, fog === 1 ? -0.52 : -0.22);
    ctx.beginPath();
    ctx.moveTo(px + T * 0.16, base);
    ctx.lineTo(px + T * 0.58, py + T * 0.17);
    ctx.lineTo(px + T * 0.95, base);
    ctx.closePath(); ctx.fill();

    // Ön dağ
    ctx.fillStyle = shade(CONST.WORLD.COLOR_MOUNTAIN, fog === 1 ? -0.42 : 0);
    ctx.beginPath();
    ctx.moveTo(px + T * 0.05, base);
    ctx.lineTo(px + T * 0.42, py + T * 0.11);
    ctx.lineTo(px + T * 0.82, base);
    ctx.closePath(); ctx.fill();

    // Kar başlığı
    if (fog === 2) {
      ctx.fillStyle = 'rgba(225,240,255,0.88)';
      ctx.beginPath();
      ctx.moveTo(px + T * 0.42, py + T * 0.11);
      ctx.lineTo(px + T * 0.54, py + T * 0.31);
      ctx.lineTo(px + T * 0.30, py + T * 0.31);
      ctx.closePath(); ctx.fill();
    }
  }

  // ── Nehirler ─────────────────────────────────────────────────────────────
  _drawRivers(ctx, rivers, T) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2a6fa8'; ctx.lineWidth = T * 0.20;
    for (const r of rivers) {
      if (r.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(r[0].x * T + T / 2, r[0].y * T + T / 2);
      for (let i = 1; i < r.length; i++) ctx.lineTo(r[i].x * T + T / 2, r[i].y * T + T / 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#5aaee8'; ctx.lineWidth = T * 0.08;
    for (const r of rivers) {
      if (r.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(r[0].x * T + T / 2, r[0].y * T + T / 2);
      for (let i = 1; i < r.length; i++) ctx.lineTo(r[i].x * T + T / 2, r[i].y * T + T / 2);
      ctx.stroke();
    }
  }

  // ── Yollar ───────────────────────────────────────────────────────────────
  _drawRoads(ctx, roads, T) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#c4a97e'; ctx.lineWidth = T * 0.14;
    for (const rd of roads) {
      if (!rd.path || rd.path.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(rd.path[0].x * T + T / 2, rd.path[0].y * T + T / 2);
      for (let i = 1; i < rd.path.length; i++) ctx.lineTo(rd.path[i].x * T + T / 2, rd.path[i].y * T + T / 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7a5c35'; ctx.lineWidth = T * 0.06;
    for (const rd of roads) {
      if (!rd.path || rd.path.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(rd.path[0].x * T + T / 2, rd.path[0].y * T + T / 2);
      for (let i = 1; i < rd.path.length; i++) ctx.lineTo(rd.path[i].x * T + T / 2, rd.path[i].y * T + T / 2);
      ctx.stroke();
    }
  }

  // ── Hareket yolu ─────────────────────────────────────────────────────────
  _drawMovePath(ctx, player, T) {
    const sx = player.x * T + T / 2, sy = player.y * T + T / 2;
    const ex = player.tx * T + T / 2, ey = player.ty * T + T / 2;
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
    const cx = settlement.x * T + T / 2;
    const cy = settlement.y * T + T / 2;
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
    const cx = party.x * T + T / 2;
    const cy = party.y * T + T / 2;
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
    const cx = player.x * T + T / 2;
    const cy = player.y * T + T / 2;
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
