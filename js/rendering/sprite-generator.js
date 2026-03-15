/**
 * FallOfCavalry - Sprite Generator
 * Gerçekçi Canvas 2D birim görsel sistemi (arc/bezier/gradient tabanlı)
 */

import { mulberry32, hashStr, shade } from '../utils.js';

// Faction görsel tanımlamaları
const FACTION_VISUALS = {
  ottoman: {
    primary:  '#c0392b', secondary: '#8e2a1f', accent: '#f1c40f',
    metal: '#8c8f95', leather: '#6a4a2f', horse: '#6d5845',
    headgear: 'turban', cloak: true,
  },
  hre: {
    primary:  '#2c3e50', secondary: '#1d2a38', accent: '#f4d03f',
    metal: '#9aa5b1', leather: '#4b3a2a', horse: '#4f4540',
    headgear: 'kettle', cloak: false,
  },
  polish: {
    primary:  '#e74c3c', secondary: '#9b2d21', accent: '#f7dc6f',
    metal: '#b0b7c2', leather: '#6e4a32', horse: '#6b4a3a',
    headgear: 'cap', cloak: true,
  },
  spanish: {
    primary:  '#f1c40f', secondary: '#b9770e', accent: '#c0392b',
    metal: '#a0a7b0', leather: '#5b4127', horse: '#5a4a3f',
    headgear: 'morion', cloak: false,
  },
  venice: {
    primary:  '#16a085', secondary: '#0e6655', accent: '#f4d03f',
    metal: '#9aa5b1', leather: '#6a4a2f', horse: '#6b5a45',
    headgear: 'kettle', cloak: true,
  },
  bandit: {
    primary:  '#3e2723', secondary: '#2a1a15', accent: '#6d4c41',
    metal: '#5a5a5a', leather: '#4e3629', horse: '#5c4033',
    headgear: 'hood', cloak: true,
  },
};

const UNIT_VISUALS = {
  archer:      { weapon: 'bow',     armor: 'leather', shield: false, plume: false },
  pike_inf:    { weapon: 'pike',    armor: 'mail',    shield: true,  plume: false },
  musketeer:   { weapon: 'musket',  armor: 'coat',    shield: false, plume: false },
  cav_archer:  { weapon: 'bow',     armor: 'leather', shield: false, plume: false },
  cav_pike:    { weapon: 'spear',   armor: 'mail',    shield: false, plume: false },
  carbine_cav: { weapon: 'carbine', armor: 'coat',    shield: false, plume: false },
  heavy_cav:   { weapon: 'lance',   armor: 'plate',   shield: false, plume: true  },
};

const FACTION_UNIT_OVERRIDES = {
  ottoman: {
    musketeer: { headgear: 'janissary' },
    archer:    { weapon: 'composite_bow' },
  },
  hre: {
    pike_inf:  { headgear: 'kettle', shield: true },
    heavy_cav: { headgear: 'closed' },
  },
  polish: {
    heavy_cav: { wings: true, plume: true, headgear: 'cap' },
    cav_pike:  { headgear: 'cap' },
  },
  spanish: {
    musketeer: { headgear: 'morion', weapon: 'musket' },
    pike_inf:  { headgear: 'morion', weapon: 'pike' },
  },
  venice: {
    musketeer: { headgear: 'kettle', weapon: 'musket' },
    heavy_cav: { plume: true, headgear: 'closed' },
  },
};

const _warned = new Set();
function _warnOnce(key, msg) {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn(msg);
}

// ─────────────────────────────────────────────────────────────────
// Çizim yardımcıları (koordinatlar: 64px canvas'ta origin=merkez)
// ─────────────────────────────────────────────────────────────────

/** Düz omuz→kalça trapez yolu */
function _trapezoid(g, cx, ty, bw, tw, h) {
  const hw = tw / 2, hb = bw / 2;
  g.beginPath();
  g.moveTo(cx - hw, ty);
  g.lineTo(cx + hw, ty);
  g.lineTo(cx + hb, ty + h);
  g.lineTo(cx - hb, ty + h);
  g.closePath();
}

/** Metal degrade */
function _metalGrad(g, color, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0,    shade(color,  0.40));
  gr.addColorStop(0.35, shade(color,  0.10));
  gr.addColorStop(0.7,  color);
  gr.addColorStop(1,    shade(color, -0.35));
  return gr;
}

/** Kumaş degrade */
function _clothGrad(g, color, x0, y0, x1, y1) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, shade(color,  0.22));
  gr.addColorStop(1, shade(color, -0.22));
  return gr;
}

// ─────────────────────────────────────────────────────────────────
export class SpriteGenerator {
  constructor() {
    this.cache = new Map();
  }

  getUnitSprite(factionId, unitType, seedKey = '') {
    const key = `${factionId}|${unitType}|${seedKey}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const size = 64;
    const doc = globalThis.document;
    if (!doc || typeof doc.createElement !== 'function') {
      _warnOnce('sprite:no-doc', '[SpriteGenerator] document.createElement unavailable');
      return null;
    }
    const canvas = doc.createElement('canvas');
    if (!canvas || typeof canvas.getContext !== 'function') {
      _warnOnce('sprite:no-canvas', '[SpriteGenerator] Canvas unavailable');
      return null;
    }
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      _warnOnce('sprite:no-ctx', '[SpriteGenerator] 2D context unavailable');
      return null;
    }

    this.drawUnitSprite(ctx, factionId, unitType, size, seedKey);
    this.cache.set(key, canvas);
    return canvas;
  }

  // ── Ana sprite çizimi ────────────────────────────────────────
  drawUnitSprite(g, factionId, unitType, size, seedKey = '') {
    if (!g) return;

    const rng = mulberry32(hashStr(`${factionId}|${unitType}|${seedKey}`));

    const fv = FACTION_VISUALS[factionId] || FACTION_VISUALS.ottoman;
    const uv = UNIT_VISUALS[unitType]    || UNIT_VISUALS.pike_inf;
    const ov = FACTION_UNIT_OVERRIDES[factionId]?.[unitType] || {};
    const prof = { ...uv, ...ov };

    // Rastgele varyasyonlar
    const SKINS  = ['#e8c9a8', '#d9b38c', '#c99b74', '#a97850'];
    const HAIRS  = ['#2c1b12', '#3c2b1e', '#5a3b22', '#7a4c2a', '#c2a26a'];
    const skin   = SKINS[(rng() * SKINS.length) | 0];
    const hair   = HAIRS[(rng() * HAIRS.length) | 0];
    const beard  = rng() > 0.60;
    const hasHelm = rng() > 0.30 || prof.armor === 'plate';

    const cloth   = shade(fv.primary, prof.armor === 'coat' ? 0.06 : 0);
    const isCav   = ['cav_archer', 'cav_pike', 'carbine_cav', 'heavy_cav'].includes(unitType);

    g.save();
    g.translate(size / 2, size / 2); // origin → merkez

    if (prof.wings) this._drawWings(g, size);

    if (isCav) {
      this._drawHorse(g, fv.horse, size);
      g.save();
      g.translate(0, -14); // süvari biraz yukarıda
      this._drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size);
      g.restore();
    } else {
      this._drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size);
    }

    g.restore();
  }

  // ── Karakter (piyade veya süvari gövdesi) ───────────────────
  _drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size) {
    this._drawLegs(g, cloth, fv.leather, size);
    this._drawBody(g, cloth, fv, prof, size);
    if (prof.shield) this._drawShield(g, fv.primary, fv.accent, size);
    this._drawWeapon(g, prof.weapon, fv.metal, size);
    if (hasHelm) {
      this._drawHelmet(g, fv.metal, prof.headgear || fv.headgear, fv.accent, size);
    } else {
      this._drawHead(g, skin, hair, beard, size);
    }
    if (prof.plume) this._drawPlume(g, fv.accent, size);
  }

  // ── At ───────────────────────────────────────────────────────
  _drawHorse(g, color, _size) {
    const body = shade(color, -0.05);
    const dark = shade(color, -0.40);
    const hi   = shade(color,  0.25);

    // Gövde
    const bg = g.createLinearGradient(-18, 4, 18, 28);
    bg.addColorStop(0, hi);
    bg.addColorStop(1, dark);
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(0, 16, 19, 9, 0, 0, Math.PI * 2);
    g.fill();

    // Boyun
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-5,  8);
    g.quadraticCurveTo(-8,  0, -4, -8);
    g.quadraticCurveTo( 0, -10,  4, -6);
    g.quadraticCurveTo( 5,  2,   5,  8);
    g.closePath();
    g.fill();

    // Kafa
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(-3, -11, 5, 4, -0.3, 0, Math.PI * 2);
    g.fill();

    // Burun deliği
    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(-7, -10, 1.2, 0.8, 0.4, 0, Math.PI * 2);
    g.fill();

    // Yele
    g.fillStyle = dark;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(-1 + i * 1.5, -6 - i * 1.2, 2.5, Math.PI, 0);
      g.fill();
    }

    // Bacaklar
    g.fillStyle = dark;
    const legPairs = [[-14, 8], [-8, 8], [4, 8], [10, 8]];
    for (const [lx, ly] of legPairs) {
      g.fillRect(lx - 2, ly + 8, 4, 14);
      // Tırnak
      g.fillStyle = '#333';
      g.fillRect(lx - 2, ly + 20, 4, 2);
      g.fillStyle = dark;
    }

    // Göz
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(-6, -12, 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(-5.4, -12.4, 0.4, 0, Math.PI * 2);
    g.fill();

    // Kuyruk
    g.strokeStyle = dark;
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(18, 12);
    g.quadraticCurveTo(26, 16, 22, 26);
    g.stroke();
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(18, 10);
    g.quadraticCurveTo(27, 14, 24, 28);
    g.stroke();
  }

  // ── Bacaklar ve botlar ───────────────────────────────────────
  _drawLegs(g, cloth, leather, _size) {
    const legColor = shade(cloth, -0.18);
    const bootColor = '#1e1208';

    // Sol bacak
    g.fillStyle = legColor;
    g.beginPath();
    g.moveTo(-6,  8);
    g.lineTo(-3,  8);
    g.lineTo(-3, 22);
    g.lineTo(-7, 22);
    g.closePath();
    g.fill();

    // Sağ bacak
    g.beginPath();
    g.moveTo( 3,  8);
    g.lineTo( 6,  8);
    g.lineTo( 7, 22);
    g.lineTo( 3, 22);
    g.closePath();
    g.fill();

    // Botlar
    g.fillStyle = bootColor;
    g.beginPath();
    g.roundRect(-8, 20, 6, 9, 2);
    g.fill();
    g.beginPath();
    g.roundRect( 2, 20, 6, 9, 2);
    g.fill();

    // Bot parlama
    g.fillStyle = 'rgba(255,255,255,0.09)';
    g.fillRect(-7, 21, 2, 3);
    g.fillRect( 3, 21, 2, 3);
  }

  // ── Gövde ───────────────────────────────────────────────────
  _drawBody(g, cloth, fv, prof, _size) {
    // Gövde gradyanı (sol→sağ: aydınlık→koyu)
    const bodyGrad = _clothGrad(g, cloth, -10, -10, 10, 8);

    // Omuz→kalça trapez
    g.fillStyle = bodyGrad;
    _trapezoid(g, 0, -10, 14, 20, 18);
    g.fill();

    // Zırh tipi ayrımı
    if (prof.armor === 'plate') {
      // Göğüs plakası — metalik
      const pg = _metalGrad(g, fv.metal, -6, -10, 6, 6);
      g.fillStyle = pg;
      _trapezoid(g, 0, -9, 10, 14, 14);
      g.fill();
      // Göğüs çizgisi
      g.strokeStyle = shade(fv.metal, 0.30);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, -9); g.lineTo(0, 5);
      g.stroke();
    } else if (prof.armor === 'mail') {
      // Zincir zırh doku
      g.fillStyle = 'rgba(180,180,180,0.18)';
      for (let row = -8; row < 8; row += 3) {
        for (let col = -8; col < 8; col += 3) {
          g.beginPath();
          g.arc(col, row, 1, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    // Kemer
    g.fillStyle = shade(fv.leather, -0.15);
    g.fillRect(-7, 5, 14, 3);
    g.fillStyle = shade(fv.accent, -0.10);
    g.fillRect(-1.5, 5.5, 3, 2); // toka

    // Sol kol
    g.fillStyle = shade(cloth, -0.14);
    g.beginPath();
    g.moveTo(-10, -9);
    g.lineTo(-14, -4);
    g.lineTo(-13,  7);
    g.lineTo( -9,  7);
    g.lineTo( -9, -7);
    g.closePath();
    g.fill();

    // Sağ kol
    g.beginPath();
    g.moveTo(10, -9);
    g.lineTo(14, -4);
    g.lineTo(13,  7);
    g.lineTo( 9,  7);
    g.lineTo( 9, -7);
    g.closePath();
    g.fill();

    // Pelerin (bazı fraksiyonlarda)
    if (fv.cloak) {
      g.fillStyle = shade(fv.secondary, 0.05);
      g.globalAlpha = 0.75;
      g.beginPath();
      g.moveTo(-9, -8);
      g.quadraticCurveTo(-14, 0, -12, 14);
      g.lineTo(-8, 14);
      g.lineTo(-9, -2);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }
  }

  // ── Kask ────────────────────────────────────────────────────
  _drawHelmet(g, metal, type, accent, _size) {
    // Baş merkezi: (0, -20)
    const hx = 0, hy = -20;
    const hi = shade(metal, 0.42);
    const lo = shade(metal, -0.32);

    switch (type) {
      case 'kettle': {
        // Yuvarlak kubbe + geniş ağız
        const grad = _metalGrad(g, metal, -9, hy - 9, 7, hy + 3);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(hx, hy - 2, 7.5, Math.PI, 0, false);
        g.fill();
        // Ağız (brim)
        g.fillStyle = lo;
        g.beginPath();
        g.ellipse(hx, hy - 2, 11, 2.8, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = hi;
        g.fillRect(-11, hy - 4, 22, 1.5);
        // Yanak koruyucular
        g.fillStyle = shade(metal, -0.1);
        g.fillRect(-8, hy + 2, 3.5, 5);
        g.fillRect( 4, hy + 2, 3.5, 5);
        // Temel yüz (gözler görünür)
        break;
      }

      case 'morion': {
        // İspanyol morion — sivri tepe, yukarı kıvrımlı ağız
        const grad = _metalGrad(g, metal, -9, hy - 13, 9, hy + 2);
        g.fillStyle = grad;
        // Kubbe
        g.beginPath();
        g.arc(hx, hy - 2, 7.5, Math.PI, 0, false);
        g.fill();
        // Tepe tarak (comb)
        g.fillStyle = shade(metal, 0.10);
        g.beginPath();
        g.moveTo(-1.5, hy - 8);
        g.quadraticCurveTo(-2, hy - 16, hx, hy - 18);
        g.quadraticCurveTo( 2, hy - 16, 1.5, hy - 8);
        g.closePath();
        g.fill();
        g.strokeStyle = hi;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(0, hy - 8); g.lineTo(0, hy - 18);
        g.stroke();
        // İki yönlü kıvrımlı ağız
        g.fillStyle = lo;
        g.beginPath();
        g.moveTo(-13, hy - 2);
        g.quadraticCurveTo( hx, hy - 7, 13, hy - 2);
        g.quadraticCurveTo( hx, hy + 2, -13, hy - 2);
        g.closePath();
        g.fill();
        break;
      }

      case 'turban': {
        // Osmanlı sarığı — sarılı katmanlar
        g.fillStyle = accent;
        g.beginPath();
        g.ellipse(hx, hy - 5, 9, 8, 0, 0, Math.PI * 2);
        g.fill();
        // Sarma çizgileri
        g.strokeStyle = shade(accent, -0.28);
        g.lineWidth = 1.8;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.ellipse(hx, hy - 2 + i * 3, 8.5, 2.2, 0, 0, Math.PI * 2);
          g.stroke();
        }
        // Tepe (beyaz tüy)
        g.fillStyle = 'rgba(255,255,255,0.88)';
        g.beginPath();
        g.moveTo(-1, hy - 12);
        g.quadraticCurveTo(0, hy - 18, 1, hy - 12);
        g.fill();
        // Yüz açıklığı — cilt rengi doldurma yok (üstten görünür)
        break;
      }

      case 'cap': {
        // Polonya / Kazak kalpağı
        g.fillStyle = '#a30c0c';
        g.beginPath();
        g.arc(hx, hy - 4, 7.5, Math.PI, 0, false);
        g.fill();
        // Kürk ağız
        const furGrad = g.createLinearGradient(-8, hy - 3, 8, hy + 1);
        furGrad.addColorStop(0, '#e8d8c0');
        furGrad.addColorStop(1, '#c4a87a');
        g.fillStyle = furGrad;
        g.beginPath();
        g.ellipse(hx, hy - 3, 8.5, 2.5, 0, 0, Math.PI * 2);
        g.fill();
        break;
      }

      case 'janissary': {
        // Yeniçeri yüksek beyaz başlığı
        g.fillStyle = 'rgba(245,242,232,0.96)';
        g.beginPath();
        g.moveTo(-4.5, hy - 2);
        g.quadraticCurveTo(-4, hy - 18, hx, hy - 22);
        g.quadraticCurveTo( 4, hy - 18, 4.5, hy - 2);
        g.closePath();
        g.fill();
        // Altın bant
        g.fillStyle = accent;
        g.fillRect(-5, hy - 5, 10, 3.5);
        // Kenar çizgisi
        g.strokeStyle = shade(accent, -0.2);
        g.lineWidth = 0.6;
        g.strokeRect(-5, hy - 5, 10, 3.5);
        break;
      }

      case 'closed':
      default: {
        // Tam yüz kapalı kask (HRE ağır süvari / varsayılan)
        const grad = _metalGrad(g, metal, -9, hy - 10, 8, hy + 6);
        g.fillStyle = grad;
        // Kask gövdesi
        g.beginPath();
        g.arc(hx, hy - 2, 8, Math.PI, 0, false);
        g.fill();
        g.fillRect(-8, hy - 2, 16, 9);
        // Vizör yarığı
        g.fillStyle = '#0a0a0a';
        g.fillRect(-5, hy + 1, 10, 2);
        // Yansıma
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.beginPath();
        g.arc(-3, hy - 7, 3, Math.PI * 1.1, Math.PI * 1.85, false);
        g.fill();
        break;
      }
    }
  }

  // ── Baş (kask yok) ──────────────────────────────────────────
  _drawHead(g, skin, hair, beard, _size) {
    const hx = 0, hy = -20;

    // Boyun
    g.fillStyle = shade(skin, -0.12);
    g.fillRect(-3, -12, 6, 4);

    // Yüz
    const faceGrad = g.createRadialGradient(-2, hy - 2, 1, 0, hy, 9);
    faceGrad.addColorStop(0, shade(skin,  0.12));
    faceGrad.addColorStop(1, shade(skin, -0.10));
    g.fillStyle = faceGrad;
    g.beginPath();
    g.ellipse(hx, hy, 7.5, 9, 0, 0, Math.PI * 2);
    g.fill();

    // Saç
    g.fillStyle = hair;
    g.beginPath();
    g.arc(hx, hy, 7.5, Math.PI, 0, false);
    g.fill();
    g.fillRect(-7.5, hy - 2, 15, 3);

    // Kaşlar
    g.fillStyle = shade(hair, -0.1);
    g.lineWidth = 1.2;
    g.strokeStyle = shade(hair, -0.1);
    g.beginPath();
    g.moveTo(-5, hy - 2); g.lineTo(-1.5, hy - 3.5);
    g.stroke();
    g.beginPath();
    g.moveTo( 5, hy - 2); g.lineTo( 1.5, hy - 3.5);
    g.stroke();

    // Gözler
    g.fillStyle = '#1a0d06';
    g.beginPath();
    g.ellipse(-3, hy, 1.3, 1.0, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse( 3, hy, 1.3, 1.0, 0, 0, Math.PI * 2);
    g.fill();
    // Göz parlaması
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(-2.5, hy - 0.4, 0.5, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc( 3.5, hy - 0.4, 0.5, 0, Math.PI * 2);
    g.fill();

    // Sakal
    if (beard) {
      g.fillStyle = shade(hair, -0.08);
      g.globalAlpha = 0.82;
      g.beginPath();
      g.ellipse(hx, hy + 7, 5, 3.5, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  // ── Silah ───────────────────────────────────────────────────
  _drawWeapon(g, weaponType, metal, _size) {
    const wood = '#5c3d1e';
    const hi   = shade(metal, 0.30);

    switch (weaponType) {
      case 'pike':
      case 'spear': {
        // Uzun mızrak
        g.fillStyle = wood;
        g.fillRect(13, -28, 2, 36);
        // Metal uç — üçgen
        g.fillStyle = _metalGrad(g, metal, 12, -28, 16, -20);
        g.beginPath();
        g.moveTo(14, -28);
        g.lineTo(18, -20);
        g.lineTo(10, -20);
        g.closePath();
        g.fill();
        // Uç parlama
        g.fillStyle = hi;
        g.beginPath();
        g.moveTo(14, -28); g.lineTo(15.2, -23); g.lineTo(13, -23);
        g.closePath();
        g.fill();
        break;
      }

      case 'lance': {
        // Süvari lans
        g.fillStyle = wood;
        g.fillRect(13, -30, 2.5, 32);
        // Kavrama bandı
        g.fillStyle = '#8b4513';
        g.fillRect(12, -8, 5, 7);
        // Metal uç
        g.fillStyle = _metalGrad(g, metal, 11, -30, 17, -22);
        g.beginPath();
        g.moveTo(14.25, -30);
        g.lineTo(19, -22);
        g.lineTo( 9.5, -22);
        g.closePath();
        g.fill();
        break;
      }

      case 'bow':
      case 'composite_bow': {
        // Yay gövdesi
        g.strokeStyle = '#6b4226';
        g.lineWidth = 2.5;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(16, -6, 15, -0.85, 0.85);
        g.stroke();
        // Kirişi
        g.strokeStyle = 'rgba(220,200,160,0.82)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(13, -20); g.lineTo(13, 8);
        g.stroke();
        // Ok
        g.strokeStyle = wood;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(13, -16); g.lineTo(13, 4);
        g.stroke();
        g.fillStyle = metal;
        g.beginPath();
        g.moveTo(13, -16); g.lineTo(15, -12); g.lineTo(11, -12);
        g.closePath();
        g.fill();
        break;
      }

      case 'musket':
      case 'carbine': {
        // Ahşap dipçik
        g.fillStyle = shade(wood, 0.1);
        g.beginPath();
        g.moveTo(12, -14);
        g.lineTo(16, -8);
        g.lineTo(17,  6);
        g.lineTo(13,  6);
        g.lineTo(11,  2);
        g.lineTo(12, -10);
        g.closePath();
        g.fill();
        // Metal namlu
        g.fillStyle = _metalGrad(g, metal, 13, -26, 16, -14);
        g.fillRect(13, -26, 3.5, 14);
        // Fitil kilit (flintlock)
        g.fillStyle = shade(metal, -0.15);
        g.fillRect(16, -18, 5, 3.5);
        // Çakmak taşı
        g.fillStyle = '#c8c0a8';
        g.beginPath();
        g.arc(20, -16, 1.8, 0, Math.PI * 2);
        g.fill();
        break;
      }

      default:
        break;
    }
  }

  // ── Kalkan ──────────────────────────────────────────────────
  _drawShield(g, primary, accent, _size) {
    const dark = shade(primary, -0.35);

    // Kalkan şekli (heater/gotik)
    g.fillStyle = primary;
    g.beginPath();
    g.moveTo(-14, -10);
    g.lineTo( 14, -10);
    g.lineTo( 14,   4);
    g.quadraticCurveTo(14, 12,  0, 16);
    g.quadraticCurveTo(-14, 12, -14, 4);
    g.closePath();
    g.fill();

    // Kenar
    g.strokeStyle = dark;
    g.lineWidth = 1.5;
    g.stroke();

    // Hanedan desen — dikey bant
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(-3, -10);
    g.lineTo( 3, -10);
    g.lineTo( 3,  12);
    g.quadraticCurveTo(0, 15, -3, 12);
    g.closePath();
    g.fill();

    // Yatay bant
    g.fillStyle = accent;
    g.fillRect(-14, -2, 28, 5);

    // Göbek
    g.fillStyle = shade(accent, -0.2);
    g.beginPath();
    g.arc(0, 1, 3, 0, Math.PI * 2);
    g.fill();
  }

  // ── Sorguç (plume) ──────────────────────────────────────────
  _drawPlume(g, color, _size) {
    const dark = shade(color, -0.35);
    g.save();
    g.translate(0, -28);

    // 5 tüy — dalgalı çizgiler
    for (let i = -2; i <= 2; i++) {
      g.strokeStyle = i % 2 === 0 ? color : dark;
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(i * 1.5, 0);
      g.quadraticCurveTo(i * 2.5 + 3, -5, i * 2 + 1, -11);
      g.stroke();
    }
    g.restore();
  }

  // ── Lehistan Hussar kanatları ────────────────────────────────
  _drawWings(g, _size) {
    const frame   = '#7a3810';
    const feather = 'rgba(235,228,208,0.88)';
    const dark    = '#4a2205';

    // Sol kanat çerçevesi
    g.strokeStyle = frame;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-12, -4);
    g.quadraticCurveTo(-26, -18, -16, -32);
    g.stroke();

    // Sol tüyler
    g.strokeStyle = feather;
    g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const t  = i / 5;
      const fx = -12 + (-16 - -12) * t;
      const fy = -4  + (-32 - -4)  * t;
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx - 8, fy - 4, fx - 10, fy - 9);
      g.stroke();
      // Kanat damarı
      g.strokeStyle = dark;
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx - 9, fy - 8);
      g.stroke();
      g.strokeStyle = feather;
      g.lineWidth = 1.5;
    }

    // Sağ kanat çerçevesi
    g.strokeStyle = frame;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(12, -4);
    g.quadraticCurveTo(26, -18, 16, -32);
    g.stroke();

    // Sağ tüyler
    g.strokeStyle = feather;
    g.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const t  = i / 5;
      const fx = 12 + (16 - 12) * t;
      const fy = -4 + (-32 - -4) * t;
      g.beginPath();
      g.moveTo(fx, fy);
      g.quadraticCurveTo(fx + 8, fy - 4, fx + 10, fy - 9);
      g.stroke();
      g.strokeStyle = dark;
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(fx, fy); g.lineTo(fx + 9, fy - 8);
      g.stroke();
      g.strokeStyle = feather;
      g.lineWidth = 1.5;
    }
  }

  // ── Diğer ───────────────────────────────────────────────────
  // Backward compat — eski API çağrıları için
  drawHorse(g, color, size)                         { this._drawHorse(g, color, size); }
  drawBody(g, cloth, hi, lo, profile, size)         { this._drawBody(g, cloth, { primary: cloth, secondary: lo, accent: hi, leather: lo, cloak: false }, profile, size); }
  drawHead(g, skin, hair, beard, size)              { this._drawHead(g, skin, hair, beard, size); }
  drawHelmet(g, metal, type, size)                  { this._drawHelmet(g, metal, type, '#d4af37', size); }
  drawWeapon(g, wtype, metal, size)                 { this._drawWeapon(g, wtype, metal, size); }
  drawShield(g, primary, accent, size)              { this._drawShield(g, primary, accent, size); }
  drawPlume(g, color, size)                         { this._drawPlume(g, color, size); }
  drawWings(g, size)                                { this._drawWings(g, size); }

  clearCache() { this.cache.clear(); }
}

export default SpriteGenerator;
