/**
 * FallOfCavalry - Sprite Generator
 * Faction-specific unit visuals — Stronghold / Age of Empires 4 style
 * Variant pose system (idle vs combat) + faction body details
 * New weapons: sword, scimitar, axe
 * New helmets: hood, ottoman_helm, barbute
 */

import { mulberry32, hashStr, shade } from '../utils.js';

// ─── Faction görsel tanımları ─────────────────────────────────────
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

// ─── Birim görsel tanımları ───────────────────────────────────────
const UNIT_VISUALS = {
  archer:      { weapon: 'bow',     armor: 'leather', shield: false, plume: false },
  pike_inf:    { weapon: 'pike',    armor: 'mail',    shield: true,  plume: false },
  musketeer:   { weapon: 'musket',  armor: 'coat',    shield: false, plume: false },
  cav_archer:  { weapon: 'bow',     armor: 'leather', shield: false, plume: false },
  cav_pike:    { weapon: 'spear',   armor: 'mail',    shield: false, plume: false },
  carbine_cav: { weapon: 'carbine', armor: 'coat',    shield: false, plume: false },
  heavy_cav:   { weapon: 'lance',   armor: 'plate',   shield: false, plume: true  },
};

// ─── Fraksiyon + birim özel geçersiz kılmaları ───────────────────
// bodyStyle: ottoman_coat | landsknecht | hussar | conquistador | mercenary | plate_armor | ragged
const FACTION_UNIT_OVERRIDES = {
  ottoman: {
    musketeer:   { headgear: 'janissary',    bodyStyle: 'ottoman_coat' },
    archer:      { weapon: 'composite_bow',  bodyStyle: 'ottoman_coat' },
    pike_inf:    { headgear: 'turban',   weapon: 'spear',    bodyStyle: 'ottoman_coat' },
    cav_pike:    { headgear: 'ottoman_helm', weapon: 'scimitar', bodyStyle: 'ottoman_coat' },
    heavy_cav:   { headgear: 'ottoman_helm', weapon: 'scimitar', bodyStyle: 'ottoman_coat' },
    cav_archer:  { headgear: 'turban',  weapon: 'composite_bow', bodyStyle: 'ottoman_coat' },
    carbine_cav: { headgear: 'ottoman_helm', bodyStyle: 'ottoman_coat' },
  },
  hre: {
    pike_inf:  { headgear: 'kettle',  shield: true,  bodyStyle: 'landsknecht' },
    musketeer: { headgear: 'barbute',               bodyStyle: 'landsknecht' },
    heavy_cav: { headgear: 'closed',                bodyStyle: 'plate_armor' },
    archer:    { headgear: 'kettle',                bodyStyle: 'landsknecht' },
    cav_pike:  { headgear: 'barbute',               bodyStyle: 'landsknecht' },
  },
  polish: {
    heavy_cav: { wings: true, plume: true, headgear: 'cap', bodyStyle: 'hussar' },
    cav_pike:  { headgear: 'cap',  bodyStyle: 'hussar' },
    musketeer: { headgear: 'cap',  bodyStyle: 'hussar' },
    pike_inf:  { headgear: 'cap',  bodyStyle: 'hussar' },
  },
  spanish: {
    musketeer: { headgear: 'morion', weapon: 'musket', bodyStyle: 'conquistador' },
    pike_inf:  { headgear: 'morion', weapon: 'pike',   bodyStyle: 'conquistador' },
    heavy_cav: { headgear: 'morion',                   bodyStyle: 'conquistador' },
    archer:    { headgear: 'morion',                   bodyStyle: 'conquistador' },
  },
  venice: {
    musketeer: { headgear: 'kettle', weapon: 'musket', bodyStyle: 'mercenary' },
    heavy_cav: { plume: true, headgear: 'closed',      bodyStyle: 'mercenary' },
    pike_inf:  { headgear: 'kettle',                   bodyStyle: 'mercenary' },
    cav_pike:  { headgear: 'kettle',                   bodyStyle: 'mercenary' },
  },
  bandit: {
    pike_inf:    { headgear: 'hood', weapon: 'axe',    bodyStyle: 'ragged' },
    archer:      { headgear: 'hood',                   bodyStyle: 'ragged' },
    musketeer:   { headgear: 'hood',                   bodyStyle: 'ragged' },
    heavy_cav:   { headgear: 'hood', weapon: 'axe',    bodyStyle: 'ragged' },
    cav_pike:    { headgear: 'hood', weapon: 'axe',    bodyStyle: 'ragged' },
    cav_archer:  { headgear: 'hood',                   bodyStyle: 'ragged' },
    carbine_cav: { headgear: 'hood',                   bodyStyle: 'ragged' },
  },
};

// ─── Uyarı yardımcısı ─────────────────────────────────────────────
const _warned = new Set();
function _warnOnce(key, msg) {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn(msg);
}

// ─── Çizim yardımcıları ───────────────────────────────────────────

/** Omuz→kalça trapez yolu */
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

    // variant 0 = guard/idle, variant 1 = combat/attack  (farklı iki görünüm)
    const variant = (hashStr(seedKey) >>> 0) % 2;

    const fv   = FACTION_VISUALS[factionId]   || FACTION_VISUALS.ottoman;
    const uv   = UNIT_VISUALS[unitType]        || UNIT_VISUALS.pike_inf;
    const ov   = FACTION_UNIT_OVERRIDES[factionId]?.[unitType] || {};
    const prof = { ...uv, ...ov };

    // Rastgele görünüm varyasyonları
    const SKINS  = ['#e8c9a8', '#d9b38c', '#c99b74', '#a97850'];
    const HAIRS  = ['#2c1b12', '#3c2b1e', '#5a3b22', '#7a4c2a', '#c2a26a'];
    const skin   = SKINS[(rng() * SKINS.length) | 0];
    const hair   = HAIRS[(rng() * HAIRS.length) | 0];
    const beard  = rng() > 0.60;
    const hasHelm = rng() > 0.30 || prof.armor === 'plate';

    const cloth  = shade(fv.primary, prof.armor === 'coat' ? 0.06 : 0);
    const isCav  = ['cav_archer', 'cav_pike', 'carbine_cav', 'heavy_cav'].includes(unitType);

    g.save();
    g.translate(size / 2, size / 2);

    if (prof.wings) this._drawWings(g, size);

    if (isCav) {
      this._drawHorse(g, fv.horse, size);
      g.save();
      g.translate(0, -14);
      this._drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size, variant, factionId);
      g.restore();
    } else {
      this._drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size, variant, factionId);
    }

    g.restore();
  }

  // ── Karakter (piyade veya süvari gövdesi) ───────────────────
  _drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size, variant = 0, factionId = '') {
    this._drawLegs(g, cloth, fv.leather, size, variant);
    this._drawBody(g, cloth, fv, prof, size);
    if (prof.bodyStyle) this._drawFactionBodyDetail(g, prof.bodyStyle, fv, variant);
    if (prof.shield)    this._drawShield(g, fv.primary, fv.accent, size, factionId);
    this._drawWeapon(g, prof.weapon, fv.metal, size, variant);
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

    const bg = g.createLinearGradient(-18, 4, 18, 28);
    bg.addColorStop(0, hi);
    bg.addColorStop(1, dark);
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(0, 16, 19, 9, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = body;
    g.beginPath();
    g.moveTo(-5,  8);
    g.quadraticCurveTo(-8,  0, -4, -8);
    g.quadraticCurveTo( 0, -10,  4, -6);
    g.quadraticCurveTo( 5,  2,   5,  8);
    g.closePath();
    g.fill();

    g.fillStyle = body;
    g.beginPath();
    g.ellipse(-3, -11, 5, 4, -0.3, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = dark;
    g.beginPath();
    g.ellipse(-7, -10, 1.2, 0.8, 0.4, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = dark;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(-1 + i * 1.5, -6 - i * 1.2, 2.5, Math.PI, 0);
      g.fill();
    }

    g.fillStyle = dark;
    const legPairs = [[-14, 8], [-8, 8], [4, 8], [10, 8]];
    for (const [lx, ly] of legPairs) {
      g.fillRect(lx - 2, ly + 8, 4, 14);
      g.fillStyle = '#333';
      g.fillRect(lx - 2, ly + 20, 4, 2);
      g.fillStyle = dark;
    }

    g.fillStyle = '#111';
    g.beginPath();
    g.arc(-6, -12, 1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.arc(-5.4, -12.4, 0.4, 0, Math.PI * 2);
    g.fill();

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
  // variant 1 = geniş dövüş duruşu
  _drawLegs(g, cloth, leather, _size, variant = 0) {
    const legColor  = shade(cloth, -0.18);
    const bootColor = '#1e1208';
    const spr = variant === 1 ? 2.5 : 0; // combat spread

    g.fillStyle = legColor;
    g.beginPath();
    g.moveTo(-6 - spr,  8);
    g.lineTo(-3 - spr,  8);
    g.lineTo(-3 - spr, 22);
    g.lineTo(-7 - spr, 22);
    g.closePath();
    g.fill();

    g.beginPath();
    g.moveTo( 3 + spr,  8);
    g.lineTo( 6 + spr,  8);
    g.lineTo( 7 + spr, 22);
    g.lineTo( 3 + spr, 22);
    g.closePath();
    g.fill();

    g.fillStyle = bootColor;
    g.beginPath();
    g.roundRect(-8 - spr, 20, 6, 9, 2);
    g.fill();
    g.beginPath();
    g.roundRect( 2 + spr, 20, 6, 9, 2);
    g.fill();

    g.fillStyle = 'rgba(255,255,255,0.09)';
    g.fillRect(-7 - spr, 21, 2, 3);
    g.fillRect( 3 + spr, 21, 2, 3);
  }

  // ── Gövde ───────────────────────────────────────────────────
  _drawBody(g, cloth, fv, prof, _size) {
    const bodyGrad = _clothGrad(g, cloth, -10, -10, 10, 8);

    g.fillStyle = bodyGrad;
    _trapezoid(g, 0, -10, 14, 20, 18);
    g.fill();

    if (prof.armor === 'plate') {
      const pg = _metalGrad(g, fv.metal, -6, -10, 6, 6);
      g.fillStyle = pg;
      _trapezoid(g, 0, -9, 10, 14, 14);
      g.fill();
      g.strokeStyle = shade(fv.metal, 0.30);
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(0, -9); g.lineTo(0, 5);
      g.stroke();
    } else if (prof.armor === 'mail') {
      g.fillStyle = 'rgba(180,180,180,0.18)';
      for (let row = -8; row < 8; row += 3) {
        for (let col = -8; col < 8; col += 3) {
          g.beginPath();
          g.arc(col, row, 1, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    g.fillStyle = shade(fv.leather, -0.15);
    g.fillRect(-7, 5, 14, 3);
    g.fillStyle = shade(fv.accent, -0.10);
    g.fillRect(-1.5, 5.5, 3, 2);

    g.fillStyle = shade(cloth, -0.14);
    g.beginPath();
    g.moveTo(-10, -9);
    g.lineTo(-14, -4);
    g.lineTo(-13,  7);
    g.lineTo( -9,  7);
    g.lineTo( -9, -7);
    g.closePath();
    g.fill();

    g.beginPath();
    g.moveTo(10, -9);
    g.lineTo(14, -4);
    g.lineTo(13,  7);
    g.lineTo( 9,  7);
    g.lineTo( 9, -7);
    g.closePath();
    g.fill();

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

  // ── Fraksiyon gövde detay katmanı ───────────────────────────
  _drawFactionBodyDetail(g, bodyStyle, fv, variant) {
    switch (bodyStyle) {

      case 'ottoman_coat': {
        // Altın düğme sırası + yakası
        g.fillStyle = fv.accent;
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.arc(0, -8 + i * 4, 1.2, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = fv.accent;
        g.lineWidth = 1.5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-5, -10); g.lineTo(0, -7); g.lineTo(5, -10);
        g.stroke();
        // Variant 1: yaka dik / ceket açık
        if (variant === 1) {
          g.strokeStyle = shade(fv.accent, -0.2);
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(-4, -9); g.lineTo(-8, -3);
          g.moveTo( 4, -9); g.lineTo( 8, -3);
          g.stroke();
        }
        break;
      }

      case 'landsknecht': {
        // Puf kollar (Puff und Schlitz) + torso dikey çizgiler
        const puffColor = shade(fv.secondary, 0.38);
        g.strokeStyle = puffColor;
        g.lineWidth = 1.8;
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(-14 + i, -6 + i * 3);
          g.lineTo(-10 + i, -4 + i * 3);
          g.stroke();
        }
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(10 - i, -6 + i * 3);
          g.lineTo(14 - i, -4 + i * 3);
          g.stroke();
        }
        // Torso yırtık çizgiler
        g.strokeStyle = shade(fv.accent, -0.05);
        g.lineWidth = 1.0;
        g.beginPath();
        g.moveTo(-5, -6); g.lineTo(-2, -2);
        g.moveTo(-4, -1); g.lineTo(-1,  2);
        g.moveTo( 2, -6); g.lineTo( 5, -2);
        g.stroke();
        // Variant 1: kollar daha açık = ekstra çizgi
        if (variant === 1) {
          g.strokeStyle = shade(fv.accent, 0.15);
          g.lineWidth = 0.7;
          g.beginPath();
          g.moveTo(2, 0); g.lineTo(5, 4);
          g.stroke();
        }
        break;
      }

      case 'hussar': {
        // Nakışlı ön panel — kordon (frogging)
        g.strokeStyle = shade(fv.accent, -0.08);
        g.lineWidth = 1.4;
        g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const y0 = -7 + i * 5;
          g.beginPath();
          g.moveTo(-6, y0);
          g.quadraticCurveTo(-3, y0 - 2, 0, y0);
          g.quadraticCurveTo( 3, y0 + 2, 6, y0);
          g.stroke();
        }
        g.fillStyle = fv.accent;
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.arc(0, -7 + i * 4, 0.9, 0, Math.PI * 2);
          g.fill();
        }
        // Variant 1: omuz bandı
        if (variant === 1) {
          g.strokeStyle = shade(fv.accent, 0.1);
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(-10, -9); g.lineTo(-6, -5);
          g.stroke();
        }
        break;
      }

      case 'conquistador': {
        // Oymalı göğüs zırhı — haç + çerçeve
        const mColor = shade(fv.metal || '#a0a7b0', 0.28);
        g.strokeStyle = mColor;
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(0, -9); g.lineTo(0, 4);
        g.stroke();
        g.beginPath();
        g.moveTo(-7, -2); g.lineTo(7, -2);
        g.stroke();
        g.strokeStyle = shade(fv.accent, -0.10);
        g.lineWidth = 0.7;
        g.strokeRect(-7, -9, 14, 14);
        g.fillStyle = shade(fv.metal || '#a0a7b0', 0.38);
        const dPts = [[-5, -6], [5, -6], [-5, 2], [5, 2]];
        for (const [dx, dy] of dPts) {
          g.beginPath();
          g.moveTo(dx, dy - 1.5); g.lineTo(dx + 1.5, dy);
          g.lineTo(dx, dy + 1.5); g.lineTo(dx - 1.5, dy);
          g.closePath(); g.fill();
        }
        // Variant 1: savaş hasarı — çizik
        if (variant === 1) {
          g.strokeStyle = 'rgba(0,0,0,0.28)';
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(-3, -8); g.lineTo(2, -2);
          g.stroke();
        }
        break;
      }

      case 'mercenary': {
        // Çizgili tabard / şirket renkleri
        g.fillStyle = shade(fv.accent, 0.1);
        g.globalAlpha = 0.50;
        g.beginPath();
        g.moveTo(-10, -10);
        g.lineTo(-2,  -10);
        g.lineTo( 10,   6);
        g.lineTo(  2,   6);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
        // Kemer plakası
        g.fillStyle = shade(fv.accent, -0.18);
        g.beginPath();
        g.arc(0, 6, 2.5, 0, Math.PI * 2);
        g.fill();
        // Variant 1: epaulet çizgisi
        if (variant === 1) {
          g.strokeStyle = fv.accent;
          g.lineWidth = 1.8;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(-10, -9); g.lineTo(-5, -9);
          g.stroke();
        }
        break;
      }

      case 'plate_armor': {
        // Plaka zırh detayları — omuz flankaları + perçin
        g.strokeStyle = shade(fv.metal || '#9aa5b1', 0.32);
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(-12, -7, 4, Math.PI * 0.5, Math.PI * 1.5, false);
        g.stroke();
        g.beginPath();
        g.arc( 12, -7, 4, Math.PI * 1.5, Math.PI * 0.5, true);
        g.stroke();
        g.fillStyle = shade(fv.metal || '#9aa5b1', 0.42);
        const rivets = [[-5, -7], [5, -7], [-5, 2], [5, 2]];
        for (const [rx, ry] of rivets) {
          g.beginPath(); g.arc(rx, ry, 0.9, 0, Math.PI * 2); g.fill();
        }
        // Variant 1: göğüs hattı vurgu
        if (variant === 1) {
          g.strokeStyle = shade(fv.metal || '#9aa5b1', 0.45);
          g.lineWidth = 0.8;
          g.beginPath();
          g.moveTo(-5, -9); g.quadraticCurveTo(0, -7, 5, -9);
          g.stroke();
        }
        break;
      }

      case 'ragged': {
        // Yırtık kumaş parçaları + dikiş izleri
        g.fillStyle = 'rgba(0,0,0,0.22)';
        const patches = [[-8, -4, 4, 3], [3, 0, 5, 3], [-5, 5, 4, 2], [6, -6, 3, 4]];
        for (const [px, py, pw, ph] of patches) {
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + pw, py);
          g.lineTo(px + pw + 1, py + ph);
          g.lineTo(px - 1, py + ph);
          g.closePath(); g.fill();
        }
        g.strokeStyle = 'rgba(100,70,40,0.52)';
        g.lineWidth = 0.7;
        g.setLineDash([1, 2]);
        g.beginPath();
        g.moveTo(-7, -2); g.lineTo(-3, 4);
        g.moveTo( 2, -5); g.lineTo( 6,  1);
        g.stroke();
        g.setLineDash([]);
        // Variant 1: ek yırtık
        if (variant === 1) {
          g.strokeStyle = 'rgba(120,80,50,0.45)';
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(4, -8); g.lineTo(7, -4);
          g.stroke();
        }
        break;
      }
    }
  }

  // ── Kask ────────────────────────────────────────────────────
  _drawHelmet(g, metal, type, accent, _size) {
    const hx = 0, hy = -20;
    const hi = shade(metal, 0.42);
    const lo = shade(metal, -0.32);

    switch (type) {
      case 'kettle': {
        const grad = _metalGrad(g, metal, -9, hy - 9, 7, hy + 3);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(hx, hy - 2, 7.5, Math.PI, 0, false);
        g.fill();
        g.fillStyle = lo;
        g.beginPath();
        g.ellipse(hx, hy - 2, 11, 2.8, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = hi;
        g.fillRect(-11, hy - 4, 22, 1.5);
        g.fillStyle = shade(metal, -0.1);
        g.fillRect(-8, hy + 2, 3.5, 5);
        g.fillRect( 4, hy + 2, 3.5, 5);
        break;
      }

      case 'morion': {
        const grad = _metalGrad(g, metal, -9, hy - 13, 9, hy + 2);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(hx, hy - 2, 7.5, Math.PI, 0, false);
        g.fill();
        g.fillStyle = shade(metal, 0.10);
        g.beginPath();
        g.moveTo(-1.5, hy - 8);
        g.quadraticCurveTo(-2, hy - 16, hx, hy - 18);
        g.quadraticCurveTo( 2, hy - 16, 1.5, hy - 8);
        g.closePath(); g.fill();
        g.strokeStyle = hi;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(0, hy - 8); g.lineTo(0, hy - 18);
        g.stroke();
        g.fillStyle = lo;
        g.beginPath();
        g.moveTo(-13, hy - 2);
        g.quadraticCurveTo( hx, hy - 7, 13, hy - 2);
        g.quadraticCurveTo( hx, hy + 2, -13, hy - 2);
        g.closePath(); g.fill();
        break;
      }

      case 'turban': {
        g.fillStyle = accent;
        g.beginPath();
        g.ellipse(hx, hy - 5, 9, 8, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = shade(accent, -0.28);
        g.lineWidth = 1.8;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.ellipse(hx, hy - 2 + i * 3, 8.5, 2.2, 0, 0, Math.PI * 2);
          g.stroke();
        }
        g.fillStyle = 'rgba(255,255,255,0.88)';
        g.beginPath();
        g.moveTo(-1, hy - 12);
        g.quadraticCurveTo(0, hy - 18, 1, hy - 12);
        g.fill();
        break;
      }

      case 'cap': {
        g.fillStyle = '#a30c0c';
        g.beginPath();
        g.arc(hx, hy - 4, 7.5, Math.PI, 0, false);
        g.fill();
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
        g.fillStyle = 'rgba(245,242,232,0.96)';
        g.beginPath();
        g.moveTo(-4.5, hy - 2);
        g.quadraticCurveTo(-4, hy - 18, hx, hy - 22);
        g.quadraticCurveTo( 4, hy - 18, 4.5, hy - 2);
        g.closePath(); g.fill();
        g.fillStyle = accent;
        g.fillRect(-5, hy - 5, 10, 3.5);
        g.strokeStyle = shade(accent, -0.2);
        g.lineWidth = 0.6;
        g.strokeRect(-5, hy - 5, 10, 3.5);
        break;
      }

      // ── YENİ KASKETLER ─────────────────────────────────────

      case 'hood': {
        // Haydut bezi atkısı/kapüşon — yüzü kısmen gizler
        const hoodC = '#1a0e08';
        const hoodHi = shade(hoodC, 0.20);
        // Arka başlık hacmi
        g.fillStyle = hoodC;
        g.beginPath();
        g.arc(hx, hy - 2, 9, Math.PI * 0.85, Math.PI * 2.15, false);
        g.fill();
        // Omuzdan düşen kumaş
        g.beginPath();
        g.moveTo(-9, hy + 2);
        g.quadraticCurveTo(-11, hy + 8, -8, hy + 11);
        g.lineTo(-5, hy + 9);
        g.quadraticCurveTo(-6, hy + 3, -8, hy + 1);
        g.closePath(); g.fill();
        // Gölgeli yüz açıklığı
        g.fillStyle = shade(hoodC, 0.18);
        g.beginPath();
        g.ellipse(hx + 1, hy, 5.5, 6.5, 0, 0, Math.PI * 2);
        g.fill();
        // Kapüşon kıvrım çizgisi
        g.strokeStyle = hoodHi;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(-8, hy - 7);
        g.quadraticCurveTo(-10, hy + 1, -9, hy + 5);
        g.stroke();
        break;
      }

      case 'ottoman_helm': {
        // Sivrilen konik Osmanlı miğferi + burun çıkıntısı + altın bant
        const grad = _metalGrad(g, metal, -9, hy - 15, 9, hy + 4);
        g.fillStyle = grad;
        // Konik gövde
        g.beginPath();
        g.moveTo(-8, hy + 3);
        g.quadraticCurveTo(-9, hy - 6, hx, hy - 15);
        g.quadraticCurveTo( 9, hy - 6,  8, hy + 3);
        g.closePath(); g.fill();
        // Sivri doruk
        g.fillStyle = shade(metal, 0.32);
        g.beginPath();
        g.moveTo(-1.5, hy - 13);
        g.lineTo(0,    hy - 22);
        g.lineTo( 1.5, hy - 13);
        g.closePath(); g.fill();
        // Burun çıkıntısı (nasal)
        g.fillStyle = shade(metal, -0.08);
        g.fillRect(-1.5, hy - 1, 3, 9);
        // Yanak koruyucular
        g.fillStyle = shade(metal, -0.14);
        g.beginPath();
        g.moveTo(-9, hy + 2); g.lineTo(-9, hy + 9); g.lineTo(-5, hy + 7); g.lineTo(-6, hy + 2);
        g.closePath(); g.fill();
        g.beginPath();
        g.moveTo( 9, hy + 2); g.lineTo( 9, hy + 9); g.lineTo( 5, hy + 7); g.lineTo( 6, hy + 2);
        g.closePath(); g.fill();
        // Altın bant
        g.fillStyle = accent;
        g.fillRect(-9, hy + 1, 18, 2.2);
        // Parlama
        g.fillStyle = shade(metal, 0.38);
        g.beginPath();
        g.moveTo(-2, hy - 13); g.lineTo(-4, hy - 5); g.lineTo(-1, hy - 5);
        g.closePath(); g.fill();
        break;
      }

      case 'barbute': {
        // HRE açık yüz T-vizörlü barbut
        const grad = _metalGrad(g, metal, -9, hy - 10, 9, hy + 7);
        g.fillStyle = grad;
        // Kubbe
        g.beginPath();
        g.arc(hx, hy - 2, 8, Math.PI, 0, false);
        g.fill();
        // Tam yüz levhası
        g.fillRect(-8, hy - 2, 16, 11);
        // T-vizör açıklığı (koyu bölge)
        g.fillStyle = '#0c0c0c';
        // Yatay göz yuvası
        g.fillRect(-7, hy + 1, 14, 2.5);
        // Dikey burun/ağız açıklığı
        g.fillRect(-2.5, hy + 1, 5, 10);
        // Çene koruması
        g.fillStyle = shade(metal, -0.04);
        g.beginPath();
        g.moveTo(-8, hy + 9);
        g.quadraticCurveTo(-9, hy + 13, -5, hy + 13);
        g.lineTo( 5, hy + 13);
        g.quadraticCurveTo( 9, hy + 13,  8, hy + 9);
        g.closePath(); g.fill();
        // Parlama yansıması
        g.fillStyle = shade(metal, 0.32);
        g.beginPath();
        g.arc(-3, hy - 6, 3, Math.PI * 1.1, Math.PI * 1.85, false);
        g.fill();
        // Kenar çizgisi
        g.strokeStyle = hi;
        g.lineWidth = 0.7;
        g.beginPath();
        g.arc(-4, hy - 5, 3.5, Math.PI * 1.15, Math.PI * 1.75, false);
        g.stroke();
        break;
      }

      case 'closed':
      default: {
        const grad = _metalGrad(g, metal, -9, hy - 10, 8, hy + 6);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(hx, hy - 2, 8, Math.PI, 0, false);
        g.fill();
        g.fillRect(-8, hy - 2, 16, 9);
        g.fillStyle = '#0a0a0a';
        g.fillRect(-5, hy + 1, 10, 2);
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

    g.fillStyle = shade(skin, -0.12);
    g.fillRect(-3, -12, 6, 4);

    const faceGrad = g.createRadialGradient(-2, hy - 2, 1, 0, hy, 9);
    faceGrad.addColorStop(0, shade(skin,  0.12));
    faceGrad.addColorStop(1, shade(skin, -0.10));
    g.fillStyle = faceGrad;
    g.beginPath();
    g.ellipse(hx, hy, 7.5, 9, 0, 0, Math.PI * 2);
    g.fill();

    g.fillStyle = hair;
    g.beginPath();
    g.arc(hx, hy, 7.5, Math.PI, 0, false);
    g.fill();
    g.fillRect(-7.5, hy - 2, 15, 3);

    g.fillStyle = shade(hair, -0.1);
    g.lineWidth = 1.2;
    g.strokeStyle = shade(hair, -0.1);
    g.beginPath();
    g.moveTo(-5, hy - 2); g.lineTo(-1.5, hy - 3.5);
    g.stroke();
    g.beginPath();
    g.moveTo( 5, hy - 2); g.lineTo( 1.5, hy - 3.5);
    g.stroke();

    g.fillStyle = '#1a0d06';
    g.beginPath();
    g.ellipse(-3, hy, 1.3, 1.0, 0, 0, Math.PI * 2); g.fill();
    g.beginPath();
    g.ellipse( 3, hy, 1.3, 1.0, 0, 0, Math.PI * 2); g.fill();

    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath(); g.arc(-2.5, hy - 0.4, 0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc( 3.5, hy - 0.4, 0.5, 0, Math.PI * 2); g.fill();

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
  // variant 1 = savaş pozu — silah döndürülür / kaldırılır
  _drawWeapon(g, weaponType, metal, _size, variant = 0) {
    const wood = '#5c3d1e';
    const hi   = shade(metal, 0.30);

    // Combat pose açıları (radyan) — silah tipi başına
    const combatAngles = {
      pike:          -0.28,
      spear:         -0.22,
      lance:          0.38,
      bow:           -0.18,
      composite_bow: -0.18,
      musket:        -0.32,
      carbine:       -0.28,
      sword:         -0.52,
      scimitar:      -0.42,
      axe:           -0.38,
    };

    const useAngle = variant === 1 && combatAngles[weaponType] !== undefined;
    if (useAngle) {
      g.save();
      g.rotate(combatAngles[weaponType]);
    }

    switch (weaponType) {
      case 'pike':
      case 'spear': {
        g.fillStyle = wood;
        g.fillRect(13, -28, 2, 36);
        g.fillStyle = _metalGrad(g, metal, 12, -28, 16, -20);
        g.beginPath();
        g.moveTo(14, -28); g.lineTo(18, -20); g.lineTo(10, -20);
        g.closePath(); g.fill();
        g.fillStyle = hi;
        g.beginPath();
        g.moveTo(14, -28); g.lineTo(15.2, -23); g.lineTo(13, -23);
        g.closePath(); g.fill();
        break;
      }

      case 'lance': {
        g.fillStyle = wood;
        g.fillRect(13, -30, 2.5, 32);
        g.fillStyle = '#8b4513';
        g.fillRect(12, -8, 5, 7);
        g.fillStyle = _metalGrad(g, metal, 11, -30, 17, -22);
        g.beginPath();
        g.moveTo(14.25, -30); g.lineTo(19, -22); g.lineTo(9.5, -22);
        g.closePath(); g.fill();
        break;
      }

      case 'bow':
      case 'composite_bow': {
        g.strokeStyle = '#6b4226';
        g.lineWidth = 2.5;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(16, -6, 15, -0.85, 0.85);
        g.stroke();
        g.strokeStyle = 'rgba(220,200,160,0.82)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(13, -20); g.lineTo(13, 8);
        g.stroke();
        g.strokeStyle = wood;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(13, -16); g.lineTo(13, 4);
        g.stroke();
        g.fillStyle = metal;
        g.beginPath();
        g.moveTo(13, -16); g.lineTo(15, -12); g.lineTo(11, -12);
        g.closePath(); g.fill();
        break;
      }

      case 'musket':
      case 'carbine': {
        g.fillStyle = shade(wood, 0.1);
        g.beginPath();
        g.moveTo(12, -14); g.lineTo(16, -8); g.lineTo(17, 6);
        g.lineTo(13, 6);   g.lineTo(11,  2); g.lineTo(12, -10);
        g.closePath(); g.fill();
        g.fillStyle = _metalGrad(g, metal, 13, -26, 16, -14);
        g.fillRect(13, -26, 3.5, 14);
        g.fillStyle = shade(metal, -0.15);
        g.fillRect(16, -18, 5, 3.5);
        g.fillStyle = '#c8c0a8';
        g.beginPath();
        g.arc(20, -16, 1.8, 0, Math.PI * 2);
        g.fill();
        break;
      }

      // ── YENİ SİLAHLAR ──────────────────────────────────────

      case 'sword': {
        // Avrupa uzun kılıcı — çift kenarlı düz bıçak
        g.fillStyle = shade(wood, 0.15);
        g.beginPath();
        g.roundRect(10, -2, 5, 11, 2);
        g.fill();
        // Çapraz koruyucu (crossguard)
        g.fillStyle = _metalGrad(g, metal, 5, -5, 20, -2);
        g.beginPath();
        g.roundRect(5, -6, 17, 3, 1.5);
        g.fill();
        // Bıçak
        const bladeG = g.createLinearGradient(11, -28, 15, -4);
        bladeG.addColorStop(0,   shade(metal, 0.45));
        bladeG.addColorStop(0.4, shade(metal, 0.15));
        bladeG.addColorStop(1,   metal);
        g.fillStyle = bladeG;
        g.beginPath();
        g.moveTo(11, -4);
        g.lineTo(15, -4);
        g.lineTo(13.5, -28);
        g.closePath(); g.fill();
        // Bıçak kenar çizgisi
        g.strokeStyle = hi;
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(13.5, -28); g.lineTo(12, -4);
        g.stroke();
        // Kabza kafası
        g.fillStyle = _metalGrad(g, metal, 9, 8, 14, 12);
        g.beginPath();
        g.ellipse(12.5, 10, 3.5, 2.5, 0, 0, Math.PI * 2);
        g.fill();
        break;
      }

      case 'scimitar': {
        // Osmanlı eğri kılıcı — kalın eğri bıçak
        g.fillStyle = shade(wood, 0.20);
        g.beginPath();
        g.roundRect(9, -1, 5, 11, 2);
        g.fill();
        // Yuvarlak koruyucu disk
        g.fillStyle = _metalGrad(g, metal, 7, -5, 18, 1);
        g.beginPath();
        g.ellipse(13, -2, 5.5, 2.5, 0, 0, Math.PI * 2);
        g.fill();
        // Eğri bıçak gövdesi
        g.strokeStyle = shade(metal, 0.20);
        g.lineWidth = 4.5;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(13, -3);
        g.quadraticCurveTo(20, -13, 17, -27);
        g.stroke();
        // Keskin kenar vurgu
        g.strokeStyle = hi;
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(14.5, -4);
        g.quadraticCurveTo(21.5, -13, 18.5, -27);
        g.stroke();
        // Bıçak ucu parlaması
        g.fillStyle = hi;
        g.beginPath();
        g.arc(17.5, -27, 1.5, 0, Math.PI * 2);
        g.fill();
        // Kabza süsü
        g.fillStyle = shade(metal, -0.15);
        g.beginPath();
        g.arc(13, 8.5, 2, 0, Math.PI * 2);
        g.fill();
        break;
      }

      case 'axe': {
        // Savaş baltası — geniş metal başlı
        g.fillStyle = wood;
        g.fillRect(12, -22, 3, 30);
        // Balta başı
        const axeG = _metalGrad(g, metal, 3, -24, 20, -8);
        g.fillStyle = axeG;
        g.beginPath();
        g.moveTo(13,  -22);
        g.lineTo(13,  -10);
        g.lineTo( 3,   -7);
        g.quadraticCurveTo(1, -15,  3, -24);
        g.closePath(); g.fill();
        // Balta keskin kenarı
        g.strokeStyle = hi;
        g.lineWidth = 1.0;
        g.beginPath();
        g.moveTo(3, -7);
        g.quadraticCurveTo(0, -15, 3, -24);
        g.stroke();
        // Balta arkası (sivri)
        g.fillStyle = shade(metal, -0.10);
        g.beginPath();
        g.moveTo(15, -20);
        g.lineTo(21, -17);
        g.lineTo(15, -14);
        g.closePath(); g.fill();
        // Sap bandı
        g.fillStyle = '#8b4513';
        g.fillRect(11, -14, 5, 4);
        break;
      }

      default:
        break;
    }

    if (useAngle) g.restore();
  }

  // ── Kalkan (fraksiyon arması ile) ───────────────────────────
  _drawShield(g, primary, accent, _size, factionId = '') {
    const dark = shade(primary, -0.35);

    // Gotik kalkan şekli
    g.fillStyle = primary;
    g.beginPath();
    g.moveTo(-14, -10);
    g.lineTo( 14, -10);
    g.lineTo( 14,   4);
    g.quadraticCurveTo(14, 12,  0, 16);
    g.quadraticCurveTo(-14, 12, -14, 4);
    g.closePath(); g.fill();

    g.strokeStyle = dark;
    g.lineWidth = 1.5;
    g.stroke();

    // Temel haç deseni
    g.fillStyle = accent;
    g.beginPath();
    g.moveTo(-3, -10);
    g.lineTo( 3, -10);
    g.lineTo( 3,  12);
    g.quadraticCurveTo(0, 15, -3, 12);
    g.closePath(); g.fill();
    g.fillRect(-14, -2, 28, 5);

    // ── Fraksiyon sembolü ──
    const symC  = shade(accent, -0.22);
    const symC2 = primary;

    switch (factionId) {
      case 'ottoman': {
        // Hilal
        g.fillStyle = symC;
        g.beginPath();
        g.arc(0, 1, 4.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = primary;
        g.beginPath();
        g.arc(2, -0.5, 3.5, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'hre': {
        // Kartal silueti (basit)
        g.fillStyle = symC;
        g.beginPath();
        g.moveTo(0, -4); g.lineTo(-4.5, 3); g.lineTo(0, 1.5); g.lineTo(4.5, 3);
        g.closePath(); g.fill();
        g.beginPath();
        g.arc(0, -5.5, 2, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'polish': {
        // Beyaz kartal
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.moveTo(0, -5); g.lineTo(-4, 2); g.lineTo(0, 0.5); g.lineTo(4, 2);
        g.closePath(); g.fill();
        g.beginPath();
        g.arc(0, -6.5, 2, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'spanish': {
        // Büyük haç — accent rengi
        g.fillStyle = shade(accent, 0.25);
        g.fillRect(-2, -9, 4, 20);
        g.fillRect(-11, -1, 22, 4);
        break;
      }
      case 'venice': {
        // Aslan (basit) + kuyruk eğrisi
        g.fillStyle = symC;
        g.beginPath();
        g.arc(-2, 2, 3.5, 0, Math.PI * 2); g.fill();
        g.beginPath();
        g.arc( 2, 0, 2.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = symC;
        g.lineWidth = 1.8;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(4.5, 2);
        g.quadraticCurveTo(9, 0, 8, -4);
        g.stroke();
        break;
      }
      case 'bandit': {
        // Kaba X çizikleri
        g.strokeStyle = 'rgba(210,70,30,0.78)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-5, -5); g.lineTo(5, 7);
        g.moveTo( 5, -5); g.lineTo(-5, 7);
        g.stroke();
        break;
      }
      default: {
        g.fillStyle = shade(accent, -0.18);
        g.beginPath();
        g.arc(0, 2, 3, 0, Math.PI * 2);
        g.fill();
        break;
      }
    }
  }

  // ── Sorguç (plume) ──────────────────────────────────────────
  _drawPlume(g, color, _size) {
    const dark = shade(color, -0.35);
    g.save();
    g.translate(0, -28);
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

    g.strokeStyle = frame;
    g.lineWidth = 2.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-12, -4);
    g.quadraticCurveTo(-26, -18, -16, -32);
    g.stroke();

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
      g.strokeStyle = dark;
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(fx, fy); g.lineTo(fx - 9, fy - 8);
      g.stroke();
      g.strokeStyle = feather;
      g.lineWidth = 1.5;
    }

    g.strokeStyle = frame;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(12, -4);
    g.quadraticCurveTo(26, -18, 16, -32);
    g.stroke();

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

  // ── Geriye dönük uyumluluk ───────────────────────────────────
  drawHorse(g, color, size)                       { this._drawHorse(g, color, size); }
  drawBody(g, cloth, hi, lo, profile, size)       { this._drawBody(g, cloth, { primary: cloth, secondary: lo, accent: hi, leather: lo, cloak: false }, profile, size); }
  drawHead(g, skin, hair, beard, size)            { this._drawHead(g, skin, hair, beard, size); }
  drawHelmet(g, metal, type, size)                { this._drawHelmet(g, metal, type, '#d4af37', size); }
  drawWeapon(g, wtype, metal, size)               { this._drawWeapon(g, wtype, metal, size); }
  drawShield(g, primary, accent, size)            { this._drawShield(g, primary, accent, size); }
  drawPlume(g, color, size)                       { this._drawPlume(g, color, size); }
  drawWings(g, size)                              { this._drawWings(g, size); }

  clearCache() { this.cache.clear(); }
}

export default SpriteGenerator;
