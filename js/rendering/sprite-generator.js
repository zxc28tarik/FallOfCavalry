/**
 * FallOfCavalry - Sprite Generator  (HoMM3 Edition)
 * 80×80 canvas, dark outlines on every shape, chunky heroic proportions,
 * 3/4-isometric hint, detailed armor/helmet/weapon/shield.
 *
 * Design rules:
 *  • Every filled shape gets a dark _outline() stroke on top
 *  • scale(1.25) applied once → all coordinates stay in old "64-unit" space
 *    but render 25 % larger into the 80 px canvas
 *  • Lighting: top-left bright, bottom-right shadow
 *  • Strong faction colour identity
 */

import { mulberry32, hashStr, shade } from '../utils.js';

// ─── Fraction görsel tanımları ─────────────────────────────────────────────
const FACTION_VISUALS = {
  ottoman:      { primary:'#c0392b', secondary:'#8e2a1f', accent:'#f1c40f', metal:'#8c8f95', leather:'#6a4a2f', horse:'#6d5845', headgear:'ottoman_helm', cloak:true  },
  hre:          { primary:'#111111', secondary:'#1e1e1e', accent:'#bdbdbd', metal:'#9aa5b1', leather:'#4b3a2a', horse:'#4f4540', headgear:'kettle',  cloak:false },
  polish:       { primary:'#8e44ad', secondary:'#5b2c6f', accent:'#d7bde2', metal:'#b0b7c2', leather:'#6e4a32', horse:'#6b4a3a', headgear:'cap',     cloak:true  },
  spanish:      { primary:'#f57c00', secondary:'#c75f00', accent:'#ffd180', metal:'#a0a7b0', leather:'#5b4127', horse:'#5a4a3f', headgear:'morion',  cloak:false },
  venice:       { primary:'#1e88e5', secondary:'#1565c0', accent:'#90caf9', metal:'#9aa5b1', leather:'#6a4a2f', horse:'#6b5a45', headgear:'kettle',  cloak:true  },
  bandit:       { primary:'#3e2723', secondary:'#2a1a15', accent:'#6d4c41', metal:'#5a5a5a', leather:'#4e3629', horse:'#5c4033', headgear:'hood',    cloak:true  },
  free_company: { primary:'#1a4a8a', secondary:'#0e2d58', accent:'#e8c44c', metal:'#8a8f9a', leather:'#5a4030', horse:'#5a4030', headgear:'kettle',  cloak:false },
  aurelian:     { primary:'#7a1818', secondary:'#4a0808', accent:'#d4af37', metal:'#909aa0', leather:'#5a3a28', horse:'#5a3020', headgear:'closed',  cloak:true  },
  valen:        { primary:'#1e3d5e', secondary:'#0a1e30', accent:'#c0a860', metal:'#9aa5b1', leather:'#5a4832', horse:'#605040', headgear:'kettle',  cloak:false },
  broken:       { primary:'#3d2610', secondary:'#1a1005', accent:'#c87828', metal:'#6a6460', leather:'#4a3020', horse:'#5a3a28', headgear:'hood',    cloak:true  },
};

// ─── Birim görsel tanımları ─────────────────────────────────────────────────
const UNIT_VISUALS = {
  archer:      { weapon:'bow',     armor:'leather', shield:false, plume:false },
  pike_inf:    { weapon:'pike',    armor:'mail',    shield:true,  plume:false },
  musketeer:   { weapon:'musket',  armor:'coat',    shield:false, plume:false },
  cav_archer:  { weapon:'bow',     armor:'leather', shield:false, plume:false },
  cav_pike:    { weapon:'spear',   armor:'mail',    shield:false, plume:false },
  carbine_cav: { weapon:'carbine', armor:'coat',    shield:false, plume:false },
  heavy_cav:   { weapon:'lance',   armor:'plate',   shield:false, plume:true  },
};

// ─── Faction + unit overrides ───────────────────────────────────────────────
const FACTION_UNIT_OVERRIDES = {
  ottoman: {
    musketeer:   { headgear:'janissary',   bodyStyle:'ottoman_coat', weapon:'musket'  },
    pike_inf:    { headgear:'ottoman_helm',bodyStyle:'ottoman_coat', weapon:'scimitar'},
    archer:      { headgear:'ottoman_helm', bodyStyle:'ottoman_coat', weapon:'bow'     },
    heavy_cav:   { headgear:'ottoman_helm',bodyStyle:'ottoman_coat', weapon:'scimitar', plume:true },
  },
  hre: {
    pike_inf:    { headgear:'barbute',     bodyStyle:'plate_armor',  weapon:'pike'    },
    heavy_cav:   { headgear:'barbute',     bodyStyle:'plate_armor',  weapon:'lance', plume:true  },
    musketeer:   { headgear:'kettle',      bodyStyle:'landsknecht',  weapon:'musket'  },
  },
  polish: {
    heavy_cav:   { headgear:'cap',         bodyStyle:'hussar', weapon:'lance', plume:true, wings:true },
    pike_inf:    { headgear:'barbute',     bodyStyle:'plate_armor',  weapon:'pike'    },
    musketeer:   { headgear:'cap',         bodyStyle:'hussar',       weapon:'musket'  },
  },
  spanish: {
    pike_inf:    { headgear:'morion',      bodyStyle:'conquistador', weapon:'pike'    },
    musketeer:   { headgear:'morion',      bodyStyle:'conquistador', weapon:'musket'  },
  },
  bandit: {
    pike_inf:    { headgear:'hood',        bodyStyle:'ragged',       weapon:'axe'     },
    archer:      { headgear:'hood',        bodyStyle:'ragged',       weapon:'bow'     },
    musketeer:   { headgear:'hood',        bodyStyle:'ragged',       weapon:'musket'  },
    heavy_cav:   { headgear:'hood',        bodyStyle:'ragged',       weapon:'scimitar'},
  },
  free_company: {
    pike_inf:    { headgear:'kettle',      bodyStyle:'mercenary',    weapon:'pike'    },
    musketeer:   { headgear:'closed',      bodyStyle:'mercenary',    weapon:'musket'  },
    heavy_cav:   { headgear:'closed',      bodyStyle:'plate_armor',  weapon:'lance', plume:true },
  },
  aurelian: {
    pike_inf:    { headgear:'closed',      bodyStyle:'plate_armor',  weapon:'pike'    },
    heavy_cav:   { headgear:'closed',      bodyStyle:'plate_armor',  weapon:'lance', plume:true },
    musketeer:   { headgear:'kettle',      bodyStyle:'mercenary',    weapon:'musket'  },
  },
  venice: {
    pike_inf:    { headgear:'kettle',      bodyStyle:'mercenary',    weapon:'pike'    },
    musketeer:   { headgear:'morion',      bodyStyle:'conquistador', weapon:'musket'  },
  },
};

// ─── Yardımcı fonksiyonlar ──────────────────────────────────────────────────
function _warnOnce(key, msg) {
  if (typeof console !== 'undefined') console.warn(msg);
}

function _metalGrad(g, metal, x1, y1, x2, y2) {
  try {
    const gr = g.createLinearGradient(x1, y1, x2, y2);
    gr.addColorStop(0,   shade(metal, 0.55));
    gr.addColorStop(0.3, shade(metal, 0.20));
    gr.addColorStop(0.7, metal);
    gr.addColorStop(1,   shade(metal, -0.40));
    return gr;
  } catch { return metal; }
}

function _clothGrad(g, cloth, x1, y1, x2, y2) {
  try {
    const gr = g.createLinearGradient(x1, y1, x2, y2);
    gr.addColorStop(0,   shade(cloth,  0.28));
    gr.addColorStop(0.5, cloth);
    gr.addColorStop(1,   shade(cloth, -0.35));
    return gr;
  } catch { return cloth; }
}

/** Outline stroke after a filled path — HoMM3 dark ink effect */
function _outline(g, color = '#110700', width = 1.4) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth   = width;
  g.lineJoin    = 'round';
  g.lineCap     = 'round';
  g.stroke();
  g.restore();
}

/** Gothic shield shape helper */
function _shieldPath(g, cx, cy, w, h) {
  g.beginPath();
  g.moveTo(cx - w, cy);
  g.lineTo(cx + w, cy);
  g.lineTo(cx + w, cy + h * 0.55);
  g.quadraticCurveTo(cx + w, cy + h, cx, cy + h + 4);
  g.quadraticCurveTo(cx - w, cy + h, cx - w, cy + h * 0.55);
  g.closePath();
}

/** Trapezoid body helper */
function _trapezoid(g, cx, y_top, half_top, height, half_bot) {
  g.beginPath();
  g.moveTo(cx - half_top, y_top);
  g.lineTo(cx + half_top, y_top);
  g.lineTo(cx + half_bot, y_top + height);
  g.lineTo(cx - half_bot, y_top + height);
  g.closePath();
}

// ══════════════════════════════════════════════════════════════════════════
// Ana sınıf
// ══════════════════════════════════════════════════════════════════════════

export class SpriteGenerator {
  constructor() {
    this.cache = new Map();
  }

  getUnitSprite(factionId, unitType, seedKey = '') {
    const key = `${factionId}|${unitType}|${seedKey}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const size = 80;                              // ← 80 px canvas
    const doc  = globalThis.document;
    if (!doc?.createElement) {
      _warnOnce('sprite:no-doc', '[SpriteGenerator] document unavailable');
      return null;
    }
    const canvas = doc.createElement('canvas');
    if (!canvas?.getContext) {
      _warnOnce('sprite:no-canvas', '[SpriteGenerator] canvas unavailable');
      return null;
    }
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    this.drawUnitSprite(ctx, factionId, unitType, size, seedKey);
    this.cache.set(key, canvas);
    return canvas;
  }

  // ── Ana sprite çizimi ────────────────────────────────────────────────────
  drawUnitSprite(g, factionId, unitType, size, seedKey = '') {
    if (!g) return;

    const rng     = mulberry32(hashStr(`${factionId}|${unitType}|${seedKey}`));
    const variant = (hashStr(seedKey) >>> 0) % 2;   // 0=idle, 1=combat

    const fv   = FACTION_VISUALS[factionId]           || FACTION_VISUALS.bandit;
    const uv   = UNIT_VISUALS[unitType]               || UNIT_VISUALS.pike_inf;
    const ov   = FACTION_UNIT_OVERRIDES[factionId]?.[unitType] || {};
    const prof = { ...uv, ...ov };

    const SKINS = ['#f0cfa0', '#e8bc88', '#d9a870', '#c8925a', '#b07840'];
    const HAIRS = ['#1e0e08', '#2c1a0e', '#4a2e18', '#6a3e20', '#c09050'];
    const skin  = SKINS[(rng() * SKINS.length) | 0];
    const hair  = HAIRS[(rng() * HAIRS.length) | 0];
    const beard = rng() > 0.55;
    const hasHelm = rng() > 0.25 || prof.armor === 'plate';

    const cloth = shade(fv.primary, prof.armor === 'coat' ? 0.06 : 0);
    const isCav = ['cav_archer', 'cav_pike', 'carbine_cav', 'heavy_cav'].includes(unitType);

    g.save();
    // Cavalry needs smaller scale so rider head fits in canvas
    const spriteScale   = isCav ? 0.82 : 1.22;
    const spriteOffsetY = isCav ? 7    : 1;
    g.translate(size / 2, size / 2 + spriteOffsetY);
    g.scale(spriteScale, spriteScale);

    // Drop shadow beneath unit
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath();
    g.ellipse(1, isCav ? 30 : 29, isCav ? 18 : 12, isCav ? 5 : 4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();

    if (prof.wings) this._drawWings(g, size);

    if (isCav) {
      this._drawHorse(g, fv.horse, size);
      g.save();
      g.translate(0, -14);   // rider sits higher → head stays inside canvas
      this._drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size, variant, factionId);
      g.restore();
    } else {
      this._drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size, variant, factionId);
    }

    g.restore();
  }

  // ── Karakter ─────────────────────────────────────────────────────────────
  _drawCharacter(g, cloth, fv, prof, skin, hair, hasHelm, beard, size, variant = 0, factionId = '') {
    this._drawLegs(g, cloth, fv.leather, size, variant);
    this._drawBody(g, cloth, fv, prof, size);
    if (prof.bodyStyle) this._drawFactionBodyDetail(g, prof.bodyStyle, fv, variant);
    this._drawWeapon(g, prof.weapon, fv.metal, size, variant);
    if (prof.shield)    this._drawShield(g, fv.primary, fv.accent, size, factionId);
    if (hasHelm) {
      this._drawHelmet(g, fv.metal, prof.headgear || fv.headgear, fv.accent, size, skin, hair, beard);
    } else {
      this._drawHead(g, skin, hair, beard, size);
    }
    if (prof.plume) this._drawPlume(g, fv.accent, size);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AT
  // ══════════════════════════════════════════════════════════════════════════
  _drawHorse(g, color, _size) {
    const body   = shade(color, -0.04);
    const dark   = shade(color, -0.48);
    const hi     = shade(color,  0.38);
    const mid    = shade(color,  0.12);
    const mane   = shade(color, -0.32);
    const shadow = shade(dark,  -0.22);

    // ── Gövde — two overlapping ellipses for barrel + hindquarters ──
    const bgGrad = g.createLinearGradient(-22, 4, 18, 30);
    bgGrad.addColorStop(0,   hi);
    bgGrad.addColorStop(0.5, body);
    bgGrad.addColorStop(1,   dark);
    g.fillStyle = bgGrad;
    g.beginPath(); g.ellipse(0, 18, 22, 11, 0, 0, Math.PI * 2); g.fill();
    _outline(g, shadow, 1.8);
    // Hindquarters bulge
    g.fillStyle = shade(body, 0.06);
    g.beginPath(); g.ellipse(14, 15, 11, 9, -0.18, 0, Math.PI * 2); g.fill();
    _outline(g, shadow, 1.2);
    // Shoulder muscle
    g.fillStyle = shade(body, 0.08);
    g.beginPath(); g.ellipse(-12, 14, 9, 8, 0.15, 0, Math.PI * 2); g.fill();
    _outline(g, shadow, 1.0);
    // Body highlight streak
    g.fillStyle = hi;
    g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(-4, 9, 10, 3.5, -0.3, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    // ── Boyun ──
    const neckGrad = g.createLinearGradient(-12, -6, 4, 10);
    neckGrad.addColorStop(0, hi);
    neckGrad.addColorStop(1, shade(body, -0.12));
    g.fillStyle = neckGrad;
    g.beginPath();
    g.moveTo(-8,  10);
    g.quadraticCurveTo(-14,  0, -10, -12);
    g.quadraticCurveTo( -5, -18,  3, -12);
    g.quadraticCurveTo(  6,  -4,  6,  10);
    g.closePath(); g.fill();
    _outline(g, dark, 1.6);
    // Neck crest muscle line
    g.strokeStyle = shade(hi, -0.08); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-10, -10); g.quadraticCurveTo(-8, -4, -7, 6); g.stroke();

    // ── Baş — büyük ve detaylı ──
    // Skull / forehead
    const headGrad = g.createLinearGradient(-14, -24, 2, -8);
    headGrad.addColorStop(0, hi);
    headGrad.addColorStop(1, shade(body, -0.15));
    g.fillStyle = headGrad;
    g.beginPath();
    g.moveTo( -5,  -9);
    g.quadraticCurveTo(-14, -10, -16, -18);
    g.quadraticCurveTo(-13, -26,  -6, -24);
    g.quadraticCurveTo(  1, -22,   2, -15);
    g.quadraticCurveTo(  2,  -9,  -5,  -9);
    g.closePath(); g.fill();
    _outline(g, dark, 1.8);
    // Nose bridge highlight
    g.strokeStyle = hi; g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-5, -24); g.quadraticCurveTo(-6, -18, -7, -12); g.stroke();

    // Muzzle / burnuk
    g.fillStyle = shade(body, 0.10);
    g.beginPath(); g.ellipse(-11, -14, 5, 3.8, 0.25, 0, Math.PI * 2); g.fill();
    _outline(g, dark, 1.3);
    // Muzzle bottom lip
    g.fillStyle = shade(body, -0.08);
    g.beginPath(); g.ellipse(-11, -11.5, 3.5, 1.8, 0.1, 0, Math.PI * 2); g.fill();
    // Mouth slit
    g.strokeStyle = dark; g.lineWidth = 1.0;
    g.beginPath(); g.moveTo(-15, -12); g.quadraticCurveTo(-11, -10, -6.5, -12); g.stroke();

    // ── Kulak ──
    g.fillStyle = shade(body, 0.14);
    g.beginPath();
    g.moveTo(-3, -23); g.lineTo(0, -30); g.lineTo(3, -23);
    g.closePath(); g.fill();
    _outline(g, dark, 1.2);
    // Inner ear pink
    g.fillStyle = 'rgba(210,120,100,0.58)';
    g.beginPath(); g.moveTo(-2, -23); g.lineTo(0, -28); g.lineTo(2, -23); g.closePath(); g.fill();

    // ── Göz — büyük, detaylı ──
    // Eye socket
    g.fillStyle = shade(dark, 0.12);
    g.beginPath(); g.ellipse(-5.5, -18.5, 3.8, 2.8, -0.15, 0, Math.PI * 2); g.fill();
    // Sclera (white)
    g.fillStyle = '#e8e0d0';
    g.beginPath(); g.ellipse(-5.5, -18.5, 2.8, 2.0, -0.15, 0, Math.PI * 2); g.fill();
    // Iris — brown/amber
    g.fillStyle = '#3a1e08';
    g.beginPath(); g.arc(-5.8, -18.8, 1.7, 0, Math.PI * 2); g.fill();
    // Pupil
    g.fillStyle = '#0c0504';
    g.beginPath(); g.arc(-5.8, -18.8, 0.9, 0, Math.PI * 2); g.fill();
    // Highlight
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.beginPath(); g.arc(-4.8, -19.5, 0.75, 0, Math.PI * 2); g.fill();
    // Eyelid line
    g.strokeStyle = dark; g.lineWidth = 1.1;
    g.beginPath(); g.arc(-5.5, -18.5, 2.8, Math.PI * 1.05, Math.PI * 2.0, false); g.stroke();
    // Eyelash hint
    g.strokeStyle = shade(dark, 0.1); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-8, -20); g.lineTo(-9, -21.5); g.stroke();
    g.beginPath(); g.moveTo(-6, -21); g.lineTo(-6.5, -22.5); g.stroke();

    // ── Burun delikleri ──
    g.fillStyle = shade(dark, 0.18);
    g.beginPath(); g.ellipse(-13.5, -13, 1.9, 1.3, 0.35, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-10,   -13.5, 1.4, 1.0, -0.1, 0, Math.PI * 2); g.fill();

    // ── Gem/dizgin — leather bridle ──
    g.strokeStyle = '#2a1408'; g.lineWidth = 1.2; g.lineCap = 'round';
    // Nose band
    g.beginPath(); g.moveTo(-16, -14); g.quadraticCurveTo(-11, -11, -5.5, -13); g.stroke();
    // Cheek piece
    g.beginPath(); g.moveTo(-5.5, -13); g.lineTo(-4, -19); g.stroke();
    // Browband across forehead
    g.beginPath(); g.moveTo(-4, -21); g.lineTo(-12, -22); g.stroke();
    // Brass ring at bit
    g.fillStyle = '#a07830';
    g.beginPath(); g.arc(-5.2, -12.5, 1.6, 0, Math.PI * 2); g.fill();
    _outline(g, '#5a3a10', 0.7);

    // ── Yele ──
    const maneGrad = g.createLinearGradient(-6, -24, -14, 4);
    maneGrad.addColorStop(0, shade(mane, 0.18));
    maneGrad.addColorStop(1, mane);
    g.strokeStyle = maneGrad; g.lineWidth = 3.8; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(-3 + i * 0.8, -20 - i * 0.3);
      g.quadraticCurveTo(-8 - i * 0.7, -12 - i, -10 - i * 0.5, -2 + i * 1.5);
      g.stroke();
    }
    // Forelock (alnından inen kâkül)
    g.strokeStyle = mane; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(-1, -28); g.quadraticCurveTo(-4, -22, -5, -17); g.stroke();
    g.strokeStyle = shade(mane, 0.20); g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, -28); g.quadraticCurveTo(-2, -21, -4, -16); g.stroke();

    // ── Bacaklar — diz eklemi + tırnak detayı ──
    const legDark = shade(dark, 0.10);
    const legPairs = [[-16, 8], [-9, 8], [4, 8], [11, 8]];
    for (const [lx, ly] of legPairs) {
      // Uyluk (thigh)
      g.fillStyle = _clothGrad(g, body, lx - 3, ly, lx + 3, ly + 11);
      g.beginPath(); g.roundRect(lx - 3, ly + 2, 6, 11, 2); g.fill();
      _outline(g, legDark, 1.2);
      // Diz (knee)
      g.fillStyle = shade(body, -0.08);
      g.beginPath(); g.ellipse(lx, ly + 13, 3.5, 2.2, 0, 0, Math.PI * 2); g.fill();
      _outline(g, legDark, 1.0);
      // Alt bacak (cannon)
      g.fillStyle = shade(dark, 0.06);
      g.beginPath(); g.roundRect(lx - 2.5, ly + 14, 5, 9, 1.5); g.fill();
      _outline(g, shade(dark, -0.28), 1.0);
      // Fetlock tuft
      g.fillStyle = shade(mane, 0.12);
      g.beginPath(); g.ellipse(lx, ly + 23, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
      // Tırnak (hoof)
      g.fillStyle = '#100904';
      g.beginPath(); g.roundRect(lx - 3.5, ly + 24, 7, 3.5, 2); g.fill();
      _outline(g, '#060300', 0.9);
      // Hoof highlight
      g.fillStyle = shade('#100904', 0.30);
      g.beginPath(); g.roundRect(lx - 2, ly + 24, 3, 1.2, 1); g.fill();
    }

    // ── Kuyruk ──
    g.strokeStyle = mane; g.lineWidth = 5.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(21, 13); g.quadraticCurveTo(33, 18, 29, 31); g.stroke();
    g.strokeStyle = shade(mane, 0.18); g.lineWidth = 3;
    g.beginPath(); g.moveTo(20, 11); g.quadraticCurveTo(32, 16, 28, 30); g.stroke();
    // Tail strands
    g.strokeStyle = shade(mane, 0.28); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(22, 15); g.quadraticCurveTo(28, 22, 24, 32); g.stroke();
    g.beginPath(); g.moveTo(23, 17); g.quadraticCurveTo(31, 22, 30, 30); g.stroke();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BACAKLAR
  // ══════════════════════════════════════════════════════════════════════════
  _drawLegs(g, cloth, leather, _size, variant = 0) {
    const legC  = shade(cloth, -0.22);
    const legHi = shade(cloth, -0.08);
    const boot  = '#160c04';
    const bootHi = '#2a1808';
    const spr   = variant === 1 ? 3.5 : 0;  // wider combat stance

    // Left leg
    g.fillStyle = _clothGrad(g, legC, -8 - spr, 8, -4 - spr, 22);
    g.beginPath();
    g.moveTo(-8 - spr,  8);
    g.lineTo(-3 - spr,  8);
    g.lineTo(-3 - spr, 20);
    g.quadraticCurveTo(-3 - spr, 23, -6 - spr, 23);
    g.lineTo(-9 - spr, 23);
    g.quadraticCurveTo(-10 - spr, 20, -8 - spr, 8);
    g.closePath();
    g.fill();
    _outline(g, shade(boot, 0.1), 1.3);

    // Right leg
    g.fillStyle = _clothGrad(g, legC, 3 + spr, 8, 8 + spr, 22);
    g.beginPath();
    g.moveTo( 3 + spr,  8);
    g.lineTo( 8 + spr,  8);
    g.quadraticCurveTo(10 + spr, 20, 9 + spr, 23);
    g.lineTo( 3 + spr, 23);
    g.quadraticCurveTo( 3 + spr, 20, 3 + spr, 8);
    g.closePath();
    g.fill();
    _outline(g, shade(boot, 0.1), 1.3);

    // Knee guards (light)
    g.fillStyle = shade(legC, 0.25);
    g.beginPath(); g.ellipse(-5.5 - spr, 18, 3, 2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse( 5.5 + spr, 18, 3, 2, 0, 0, Math.PI * 2); g.fill();

    // Left boot
    const bootGrad = g.createLinearGradient(-11 - spr, 20, -3 - spr, 32);
    bootGrad.addColorStop(0, bootHi);
    bootGrad.addColorStop(1, boot);
    g.fillStyle = bootGrad;
    g.beginPath();
    g.moveTo(-10 - spr, 22);
    g.lineTo(-2 - spr, 22);
    g.lineTo(-2 - spr, 28);
    g.quadraticCurveTo(-2 - spr, 31, -6 - spr, 31);
    g.quadraticCurveTo(-12 - spr, 31, -11 - spr, 27);
    g.closePath();
    g.fill();
    _outline(g, '#0a0400', 1.4);

    // Right boot
    g.fillStyle = bootGrad;
    g.beginPath();
    g.moveTo( 2 + spr, 22);
    g.lineTo(11 + spr, 22);
    g.quadraticCurveTo(12 + spr, 27, 11 + spr, 31);
    g.quadraticCurveTo( 6 + spr, 31,  2 + spr, 28);
    g.lineTo( 2 + spr, 22);
    g.closePath();
    g.fill();
    _outline(g, '#0a0400', 1.4);

    // Boot buckle
    g.fillStyle = '#8a7040';
    g.beginPath(); g.roundRect(-8 - spr, 23, 4, 2, 0.5); g.fill();
    g.beginPath(); g.roundRect( 4 + spr, 23, 4, 2, 0.5); g.fill();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GÖVDE
  // ══════════════════════════════════════════════════════════════════════════
  _drawBody(g, cloth, fv, prof, _size) {
    const dark = shade(cloth, -0.42);
    const bodyGrad = _clothGrad(g, cloth, -12, -14, 12, 10);

    // Main torso trapezoid (slightly wider than before)
    g.fillStyle = bodyGrad;
    _trapezoid(g, 0, -14, 10, 24, 11);
    g.fill();
    _outline(g, dark, 1.6);

    // Armor overlay
    if (prof.armor === 'plate') {
      const pg = _metalGrad(g, fv.metal, -8, -14, 8, 8);
      g.fillStyle = pg;
      _trapezoid(g, 0, -13, 8, 20, 9);
      g.fill();
      _outline(g, shade(fv.metal, -0.5), 1.2);
      // Breast line
      g.strokeStyle = shade(fv.metal, 0.38);
      g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(0, -13); g.lineTo(0, 7); g.stroke();
      // Gorget
      g.fillStyle = _metalGrad(g, fv.metal, -7, -14, 7, -9);
      g.beginPath(); g.ellipse(0, -13, 7, 3, 0, 0, Math.PI * 2); g.fill();
      _outline(g, shade(fv.metal, -0.4), 1.0);
    } else if (prof.armor === 'mail') {
      // Dense chainmail ring pattern
      g.save();
      g.beginPath();
      _trapezoid(g, 0, -14, 10, 24, 11);
      g.clip();
      g.fillStyle = 'rgba(200,205,210,0.22)';
      for (let row = -13; row < 12; row += 2.8) {
        const offset = (Math.floor((row + 13) / 2.8) % 2) * 1.4;
        for (let col = -12 + offset; col < 13; col += 2.8) {
          g.beginPath();
          g.arc(col, row, 1.0, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.restore();
      // Mail glint edge
      g.strokeStyle = 'rgba(220,225,230,0.35)';
      g.lineWidth = 0.7;
      g.beginPath(); g.moveTo(-9, -13); g.lineTo(-11, 9); g.stroke();
    } else if (prof.armor === 'leather') {
      // Leather straps
      g.fillStyle = shade(fv.leather, -0.12);
      g.beginPath(); g.roundRect(-9, -8, 18, 3, 1.5); g.fill();
      g.beginPath(); g.roundRect(-9,  0, 18, 3, 1.5); g.fill();
      _outline(g, shade(fv.leather, -0.35), 0.8);
    } else if (prof.armor === 'coat') {
      // Coat buttons
      g.fillStyle = shade(fv.accent, -0.1);
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.arc(0, -10 + i * 5, 1.5, 0, Math.PI * 2); g.fill();
        _outline(g, shade(fv.accent, -0.4), 0.7);
      }
    }

    // Belt
    g.fillStyle = shade(fv.leather, -0.20);
    g.beginPath(); g.roundRect(-11, 7, 22, 4, 2); g.fill();
    _outline(g, '#0a0400', 1.0);
    // Belt buckle
    g.fillStyle = _metalGrad(g, fv.metal || '#a08050', -3, 7, 3, 11);
    g.beginPath(); g.roundRect(-3, 8, 6, 3, 1); g.fill();
    _outline(g, shade(fv.metal || '#a08050', -0.4), 0.8);

    // Left arm
    g.fillStyle = shade(cloth, -0.18);
    g.beginPath();
    g.moveTo(-10, -12);
    g.lineTo(-16, -6);
    g.lineTo(-15,  7);
    g.lineTo(-11,  7);
    g.lineTo(-10, -8);
    g.closePath();
    g.fill();
    _outline(g, dark, 1.3);

    // Right arm
    g.beginPath();
    g.moveTo(10, -12);
    g.lineTo(16, -6);
    g.lineTo(15,  7);
    g.lineTo(11,  7);
    g.lineTo(10, -8);
    g.closePath();
    g.fill();
    _outline(g, dark, 1.3);

    // Pauldrons (shoulder guards) – metal glint
    g.fillStyle = _metalGrad(g, fv.metal, -16, -14, -8, -6);
    g.beginPath(); g.ellipse(-13, -10, 5, 3.5, -0.3, 0, Math.PI * 2); g.fill();
    _outline(g, shade(fv.metal, -0.5), 1.0);
    g.fillStyle = _metalGrad(g, fv.metal, 8, -14, 16, -6);
    g.beginPath(); g.ellipse( 13, -10, 5, 3.5,  0.3, 0, Math.PI * 2); g.fill();
    _outline(g, shade(fv.metal, -0.5), 1.0);

    // Cloak
    if (fv.cloak) {
      g.fillStyle = shade(fv.secondary, 0.08);
      g.globalAlpha = 0.80;
      g.beginPath();
      g.moveTo(-10, -12);
      g.quadraticCurveTo(-17, -2, -14, 16);
      g.lineTo(-9, 16);
      g.lineTo(-9, -6);
      g.closePath();
      g.fill();
      _outline(g, shade(fv.secondary, -0.5), 1.1);
      g.globalAlpha = 1;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FACTION BODY DETAIL
  // ══════════════════════════════════════════════════════════════════════════
  _drawFactionBodyDetail(g, bodyStyle, fv, variant) {
    switch (bodyStyle) {

      case 'ottoman_coat': {
        // Ottoman kaftan — standing collar, vertical front opening
        // Standing collar
        g.fillStyle = shade(fv.accent, -0.20);
        g.beginPath(); g.roundRect(-4, -14, 8, 5, 1); g.fill();
        _outline(g, shade(fv.accent, -0.55), 0.9);
        // Gold trim at collar edge
        g.strokeStyle = fv.accent; g.lineWidth = 1.2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-4, -9); g.lineTo(4, -9); g.stroke();
        // Front opening line
        g.strokeStyle = shade(fv.primary, -0.35); g.lineWidth = 1.0;
        g.beginPath(); g.moveTo(0, -9); g.lineTo(0, 10); g.stroke();
        // Gold button row (tombak buttons)
        g.fillStyle = fv.accent;
        for (let i = 0; i < 5; i++) {
          g.beginPath(); g.arc(0, -8 + i * 4.5, 2.0, 0, Math.PI * 2); g.fill();
          _outline(g, shade(fv.accent, -0.45), 0.7);
          // Button cross detail
          g.strokeStyle = shade(fv.accent, -0.30); g.lineWidth = 0.6;
          g.beginPath(); g.moveTo(-1, -8 + i * 4.5); g.lineTo(1, -8 + i * 4.5); g.stroke();
          g.beginPath(); g.moveTo(0, -9 + i * 4.5); g.lineTo(0, -7 + i * 4.5); g.stroke();
        }
        // Gold trim lines at hem
        g.strokeStyle = shade(fv.accent, -0.10); g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(-10, 9); g.lineTo(10, 9); g.stroke();
        // Sash (kuşak) around waist
        g.fillStyle = shade(fv.secondary, 0.30);
        g.globalAlpha = 0.70;
        g.beginPath(); g.roundRect(-11, 5, 22, 3, 1); g.fill();
        g.globalAlpha = 1;
        if (variant === 1) {
          // Kaftan lapels blown open in combat, showing inner lining
          g.fillStyle = shade(fv.accent, 0.05);
          g.globalAlpha = 0.45;
          g.beginPath(); g.moveTo(0, -9); g.lineTo(6, -14); g.lineTo(10, -5); g.lineTo(0, -2); g.closePath(); g.fill();
          g.globalAlpha = 1;
        }
        break;
      }

      case 'landsknecht': {
        // German Landsknecht — puff-and-slash doublet, vivid contrasting colours
        const slash1 = shade(fv.accent, 0.15);
        const slash2 = shade(fv.secondary, 0.55);
        // Torso slashed fabric panels — alternating colours
        for (let i = 0; i < 5; i++) {
          const y0 = -12 + i * 5;
          g.fillStyle = i % 2 === 0 ? slash1 : slash2;
          g.globalAlpha = 0.72;
          g.beginPath();
          g.moveTo(-9, y0); g.lineTo(9, y0); g.lineTo(7, y0 + 4); g.lineTo(-7, y0 + 4);
          g.closePath(); g.fill();
          g.globalAlpha = 1;
        }
        // Puff sleeve bands on arms
        const puffA = shade(fv.accent, 0.10);
        const puffB = shade(fv.secondary, 0.50);
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = i % 2 === 0 ? puffA : puffB;
          g.lineWidth = 3.0; g.lineCap = 'round';
          g.beginPath();
          g.moveTo(-15, -8 + i * 5); g.quadraticCurveTo(-12, -6 + i * 5, -10, -5 + i * 4);
          g.stroke();
          g.beginPath();
          g.moveTo( 15, -8 + i * 5); g.quadraticCurveTo( 12, -6 + i * 5,  10, -5 + i * 4);
          g.stroke();
        }
        // Codpiece hint at belt
        g.fillStyle = shade(fv.primary, -0.10);
        g.beginPath(); g.ellipse(0, 11, 3.5, 3, 0, 0, Math.PI * 2); g.fill();
        _outline(g, shade(fv.primary, -0.40), 0.8);
        // Vertical torso seam
        g.strokeStyle = shade(fv.primary, -0.25); g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(0, -14); g.lineTo(0, 8); g.stroke();
        if (variant === 1) {
          // Slashes gaping open in combat — show lining
          g.strokeStyle = shade(fv.accent, 0.25); g.lineWidth = 1.0;
          g.beginPath(); g.moveTo(-7, -10); g.lineTo(-3, -4); g.stroke();
          g.beginPath(); g.moveTo( 3, -10); g.lineTo( 7, -4); g.stroke();
        }
        break;
      }

      case 'hussar': {
        // Polish Hussar — żupan with frogging (barrel buttons) + kontusz
        // Żupan body — row of barrel buttons with frog cords
        const frogC = shade(fv.accent, -0.12);
        const frogHi = shade(fv.accent, 0.25);
        for (let i = 0; i < 5; i++) {
          const y0 = -11 + i * 5;
          // Frog cord loop
          g.strokeStyle = frogC; g.lineWidth = 1.6; g.lineCap = 'round';
          g.beginPath();
          g.moveTo(-8, y0); g.quadraticCurveTo(-4, y0 - 2.5, -1, y0);
          g.quadraticCurveTo( 2, y0 + 2.5,  6, y0);
          g.stroke();
          // Barrel button
          g.fillStyle = frogHi;
          g.beginPath(); g.roundRect(-2, y0 - 1.2, 4, 2.4, 1.2); g.fill();
          _outline(g, shade(fv.accent, -0.45), 0.6);
        }
        // Kontusz slit-sleeve — visible at left arm
        g.strokeStyle = shade(fv.secondary, 0.30); g.lineWidth = 3.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-13, -11); g.quadraticCurveTo(-14, -3, -12, 5); g.stroke();
        g.strokeStyle = shade(fv.accent, 0.08); g.lineWidth = 1.0;
        g.beginPath(); g.moveTo(-13, -9); g.quadraticCurveTo(-14, -1, -12, 7); g.stroke();
        // Shoulder rank cord
        g.strokeStyle = fv.accent; g.lineWidth = 2.0;
        g.beginPath(); g.moveTo(-13, -12); g.quadraticCurveTo(-8, -15, -4, -12); g.stroke();
        if (variant === 1) {
          // Sash diagonal in combat
          g.strokeStyle = shade(fv.accent, -0.05); g.lineWidth = 2.8; g.lineCap = 'round';
          g.globalAlpha = 0.75;
          g.beginPath(); g.moveTo(-10, -13); g.lineTo(8, 5); g.stroke();
          g.globalAlpha = 1;
        }
        break;
      }

      case 'conquistador': {
        // Spanish Conquistador — fluted/etched breastplate (peto), ruff collar, surcoat cross
        const mC  = shade(fv.metal || '#a0a7b0', 0.32);
        const mLo = shade(fv.metal || '#a0a7b0', -0.25);
        // Ruff collar (lechuguilla)
        g.strokeStyle = 'rgba(255,252,240,0.88)'; g.lineWidth = 2.2; g.lineCap = 'round';
        for (let ri = -4; ri <= 4; ri += 2) {
          g.beginPath(); g.arc(ri, -13, 2.2, Math.PI * 1.2, Math.PI * 1.8, false); g.stroke();
        }
        // Breastplate centre ridge
        g.strokeStyle = mC; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(0, -13); g.lineTo(0, 8); g.stroke();
        // Horizontal fluting lines (etched bands)
        g.strokeStyle = mLo; g.lineWidth = 0.85;
        for (let fy = -10; fy <= 6; fy += 4) {
          g.beginPath(); g.moveTo(-8, fy); g.quadraticCurveTo(0, fy - 1.5, 8, fy); g.stroke();
        }
        // Breastplate frame border
        g.strokeStyle = shade(fv.accent, -0.15); g.lineWidth = 1.0;
        g.strokeRect(-8, -13, 16, 21);
        // Surcoat cross emblem
        g.fillStyle = shade(fv.accent, -0.05);
        g.beginPath(); g.roundRect(-1.5, -11, 3, 18, 0.5); g.fill();
        g.beginPath(); g.roundRect(-8, -5, 16, 3, 0.5); g.fill();
        _outline(g, shade(fv.accent, -0.4), 0.6);
        // Corner bosses
        const mB = shade(fv.metal || '#a0a7b0', 0.45);
        g.fillStyle = mB;
        for (const [dx, dy] of [[-6,-10],[6,-10],[-6,4],[6,4]]) {
          g.beginPath(); g.arc(dx, dy, 1.5, 0, Math.PI * 2); g.fill();
          _outline(g, mLo, 0.5);
        }
        if (variant === 1) {
          // Dent/scratch from combat
          g.strokeStyle = mLo; g.lineWidth = 1.0;
          g.beginPath(); g.moveTo(-4, -11); g.lineTo(2, -4); g.stroke();
        }
        break;
      }

      case 'mercenary': {
        // Free Company mercenary — padded gambeson with diagonal tabard, company livery
        // Gambeson quilting lines (horizontal stitched rows)
        g.strokeStyle = shade(fv.primary, -0.28); g.lineWidth = 0.8;
        for (let qi = -11; qi <= 7; qi += 3.5) {
          g.beginPath(); g.moveTo(-9, qi); g.lineTo(9, qi); g.stroke();
        }
        // Diagonal tabard / surcoat stripe — faction colours
        g.fillStyle = shade(fv.accent, 0.10);
        g.globalAlpha = 0.60;
        g.beginPath();
        g.moveTo(-11, -14); g.lineTo(-2, -14); g.lineTo(11, 10); g.lineTo(2, 10);
        g.closePath(); g.fill();
        g.globalAlpha = 1;
        // Collar/gorget detail
        g.fillStyle = shade(fv.metal || '#906030', -0.08);
        g.beginPath(); g.ellipse(0, -13, 5.5, 2.5, 0, 0, Math.PI * 2); g.fill();
        _outline(g, shade(fv.metal || '#906030', -0.40), 0.8);
        // Round belt plate (rondel buckle)
        g.fillStyle = _metalGrad(g, fv.metal || '#906030', -4, 5, 4, 12);
        g.beginPath(); g.arc(0, 8, 4.0, 0, Math.PI * 2); g.fill();
        _outline(g, shade(fv.metal || '#906030', -0.45), 0.9);
        g.strokeStyle = shade(fv.metal || '#906030', 0.35); g.lineWidth = 0.8;
        g.beginPath(); g.arc(0, 8, 2, 0, Math.PI * 2); g.stroke();
        // Shoulder patch/repair
        g.fillStyle = shade(fv.secondary, 0.18);
        g.globalAlpha = 0.65;
        g.beginPath(); g.roundRect(-14, -13, 7, 5, 1.5); g.fill();
        g.globalAlpha = 1;
        if (variant === 1) {
          // Battle-worn — shoulder strap loose
          g.strokeStyle = shade(fv.accent, 0.15); g.lineWidth = 2.0; g.lineCap = 'round';
          g.beginPath(); g.moveTo(-13, -13); g.quadraticCurveTo(-9, -10, -6, -12); g.stroke();
        }
        break;
      }

      case 'plate_armor': {
        // Gothic plate — fluted lames, articulated faulds, breastplate ridge
        const mC  = shade(fv.metal || '#9aa5b1', 0.38);
        const mLo = shade(fv.metal || '#9aa5b1', -0.30);
        const mHi = shade(fv.metal || '#9aa5b1', 0.55);
        // Breastplate centre ridge (medial ridge)
        g.strokeStyle = mHi; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(0, -13); g.quadraticCurveTo(1, -2, 0, 8); g.stroke();
        // Horizontal fluting on breastplate
        g.strokeStyle = mC; g.lineWidth = 0.9;
        for (let fl = -10; fl <= 4; fl += 3.5) {
          g.beginPath(); g.moveTo(-8, fl); g.quadraticCurveTo(0, fl - 2, 8, fl); g.stroke();
        }
        // Gorget (throat protector) — layered lames
        for (let gl = 0; gl < 3; gl++) {
          g.fillStyle = _metalGrad(g, fv.metal || '#9aa5b1', -7, -14 + gl * 1.5, 7, -11 + gl * 1.5);
          g.beginPath(); g.ellipse(0, -13 + gl * 1.8, 6 - gl, 2, 0, 0, Math.PI * 2); g.fill();
          _outline(g, mLo, 0.7);
        }
        // Pauldron arcs (shoulders) — more pronounced
        g.strokeStyle = mC; g.lineWidth = 2.5;
        g.beginPath(); g.arc(-14, -9, 5.5, Math.PI * 0.3, Math.PI * 1.7, false); g.stroke();
        g.beginPath(); g.arc( 14, -9, 5.5, Math.PI * 1.3, Math.PI * 2.7, false); g.stroke();
        // Fauld (hip lames) — 4 overlapping strips
        for (let fi = 0; fi < 4; fi++) {
          const fy = 8 + fi * 2.5;
          const fw = 10 - fi * 0.5;
          g.fillStyle = _metalGrad(g, fv.metal || '#9aa5b1', -fw, fy, fw, fy + 2.5);
          g.beginPath(); g.roundRect(-fw, fy, fw * 2, 2.5, 0.5); g.fill();
          _outline(g, mLo, 0.6);
        }
        // Rivets at key joints
        g.fillStyle = mHi;
        for (const [rx, ry] of [[-7,-11],[7,-11],[-8,2],[8,2],[-6,8],[6,8]]) {
          g.beginPath(); g.arc(rx, ry, 1.4, 0, Math.PI * 2); g.fill();
          _outline(g, mLo, 0.5);
        }
        if (variant === 1) {
          // Dent in breastplate from combat
          g.strokeStyle = mLo; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(-5, -8); g.quadraticCurveTo(-3, -5, -6, -3); g.stroke();
        }
        break;
      }

      case 'ragged': {
        // Bandit / outlaw — layered rags, brigandine remnants, mismatched gear
        // Underlying worn linen with horizontal creases
        g.strokeStyle = shade(fv.primary, -0.18); g.lineWidth = 0.7;
        for (let ri = -11; ri <= 7; ri += 4) {
          g.beginPath(); g.moveTo(-9 + (ri % 3), ri); g.lineTo(8 - (ri % 2), ri + 1.5); g.stroke();
        }
        // Brigandine remnant plates (riveted squares)
        const rivPts = [[-6,-8,5,5],[3,-5,5,5],[-7,1,5,5],[3,2,5,4]];
        for (const [px, py, pw, ph] of rivPts) {
          g.fillStyle = 'rgba(60,40,20,0.35)';
          g.beginPath(); g.roundRect(px, py, pw, ph, 1); g.fill();
          // Rivet at corner
          g.fillStyle = 'rgba(100,80,50,0.70)';
          g.beginPath(); g.arc(px + 1.5, py + 1.5, 0.9, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(px + pw - 1.5, py + ph - 1.5, 0.9, 0, Math.PI * 2); g.fill();
        }
        // Rough stitching lines (repairs)
        g.strokeStyle = 'rgba(130,85,40,0.65)';
        g.lineWidth = 0.9; g.setLineDash([1.5, 2.5]);
        g.beginPath();
        g.moveTo(-8, -2); g.lineTo(-4, 5);
        g.moveTo( 3, -5); g.lineTo( 7,  2);
        g.moveTo(-2,  5); g.lineTo( 2, 11);
        g.stroke();
        g.setLineDash([]);
        // Torn hem edge at bottom
        g.strokeStyle = shade(fv.primary, -0.30); g.lineWidth = 1.2; g.lineCap = 'round';
        for (let ti = -9; ti <= 9; ti += 3) {
          g.beginPath(); g.moveTo(ti, 9); g.lineTo(ti + 1.5, 13); g.stroke();
        }
        // Sash / belt rag wrapped around waist
        g.fillStyle = shade(fv.secondary, 0.20);
        g.globalAlpha = 0.60;
        g.beginPath(); g.moveTo(-11, 6); g.quadraticCurveTo(0, 4, 11, 7); g.lineTo(9, 10); g.quadraticCurveTo(0, 7, -9, 9); g.closePath(); g.fill();
        g.globalAlpha = 1;
        if (variant === 1) {
          // Wound / blood stain
          g.fillStyle = 'rgba(160,20,10,0.40)';
          g.beginPath(); g.ellipse(5, -8, 3, 2, 0.5, 0, Math.PI * 2); g.fill();
        }
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KASK — complete redesign for HoMM3 readability
  // ══════════════════════════════════════════════════════════════════════════
  _drawHelmet(g, metal, type, accent, _size, skin = '#e0b88a', hair = '#2c1a0e', beard = false) {
    const hx = 0, hy = -22;
    const hi  = shade(metal, 0.55);
    const lo  = shade(metal, -0.45);
    const mid = metal;

    // ── Flesh base + full face features (helmet draws on top, covers what it covers) ──
    const faceHi = shade(skin, 0.20);
    const faceSh = shade(skin, -0.18);
    const faceGrad = g.createRadialGradient(-2, hy - 3, 1, hx, hy, 10);
    faceGrad.addColorStop(0, faceHi);
    faceGrad.addColorStop(1, faceSh);
    g.fillStyle = faceGrad;
    g.beginPath(); g.ellipse(hx, hy, 8.5, 10.5, 0, 0, Math.PI * 2); g.fill();
    _outline(g, shade(skin, -0.45), 1.5);

    // Neck
    g.fillStyle = shade(skin, -0.16);
    g.beginPath(); g.roundRect(-3.5, -13, 7, 5, 2); g.fill();
    _outline(g, shade(skin, -0.40), 0.9);

    // Eyebrows
    const browC = shade(hair, 0.05);
    g.strokeStyle = browC; g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-6, hy - 3); g.quadraticCurveTo(-3.5, hy - 5.5, -0.5, hy - 3.5); g.stroke();
    g.beginPath(); g.moveTo( 0.5, hy - 3.5); g.quadraticCurveTo( 3.5, hy - 5.5, 6, hy - 3); g.stroke();

    // Eyes — dark iris + whites
    g.fillStyle = '#0c0404';
    g.beginPath(); g.ellipse(-3.5, hy + 0.5, 2.2, 1.7, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse( 3.5, hy + 0.5, 2.2, 1.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.80)';
    g.beginPath(); g.arc(-2.6, hy - 0.2, 0.85, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc( 4.3, hy - 0.2, 0.85, 0, Math.PI * 2); g.fill();
    // Eyelid line
    g.strokeStyle = shade('#0c0404', 0.25); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-5.8, hy + 0.5); g.quadraticCurveTo(-3.5, hy - 1.8, -1.2, hy + 0.5); g.stroke();
    g.beginPath(); g.moveTo( 1.2, hy + 0.5); g.quadraticCurveTo( 3.5, hy - 1.8,  5.8, hy + 0.5); g.stroke();

    // Nose (subtle)
    g.strokeStyle = shade(skin, -0.28); g.lineWidth = 0.9; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1.5, hy + 3); g.quadraticCurveTo(-2.8, hy + 6, -1.5, hy + 7.5); g.stroke();
    g.beginPath(); g.moveTo( 1.5, hy + 3); g.quadraticCurveTo( 2.8, hy + 6,  1.5, hy + 7.5); g.stroke();

    // Mouth
    g.strokeStyle = shade(skin, -0.38); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-3, hy + 9.5); g.quadraticCurveTo(0, hy + 12, 3, hy + 9.5); g.stroke();

    // Cheek warmth
    g.fillStyle = 'rgba(200,110,80,0.18)';
    g.beginPath(); g.ellipse(-5.5, hy + 4, 2.8, 2.2, 0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse( 5.5, hy + 4, 2.8, 2.2, -0.3, 0, Math.PI * 2); g.fill();

    // Beard (below mouth)
    if (beard) {
      g.fillStyle = shade(hair, -0.10);
      g.globalAlpha = 0.82;
      g.beginPath(); g.ellipse(hx, hy + 10, 6, 4.5, 0, 0, Math.PI * 2); g.fill();
      _outline(g, shade(hair, -0.5), 0.9);
      g.globalAlpha = 1;
    }

    switch (type) {

      case 'kettle': {
        // Wide kettle hat — peasant-knight look
        const grad = g.createLinearGradient(-12, hy-10, 12, hy+4);
        grad.addColorStop(0, hi); grad.addColorStop(1, lo);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(hx, hy - 3, 9, Math.PI, 0, false);
        g.fill();
        _outline(g, lo, 1.8);
        // Brim
        g.fillStyle = mid;
        g.beginPath(); g.ellipse(hx, hy - 3, 14, 3.5, 0, 0, Math.PI * 2); g.fill();
        _outline(g, lo, 1.6);
        // Top glint
        g.fillStyle = hi;
        g.beginPath(); g.ellipse(hx - 2, hy - 9, 4, 2, -0.4, 0, Math.PI * 2); g.fill();
        // Cheek guards
        g.fillStyle = shade(mid, -0.12);
        g.beginPath(); g.roundRect(-10, hy+3, 4, 7, 1.5); g.fill();
        g.beginPath(); g.roundRect(  6, hy+3, 4, 7, 1.5); g.fill();
        _outline(g, lo, 1.2);
        // Rivet
        g.fillStyle = hi;
        g.beginPath(); g.arc(0, hy-8, 1.5, 0, Math.PI*2); g.fill();
        break;
      }

      case 'morion': {
        // Spanish morion — tall crest
        const grad = g.createLinearGradient(-10, hy-18, 10, hy+3);
        grad.addColorStop(0, hi); grad.addColorStop(0.4, mid); grad.addColorStop(1, lo);
        g.fillStyle = grad;
        g.beginPath();
        g.arc(hx, hy-2, 9, Math.PI, 0, false);
        g.fill();
        _outline(g, lo, 1.8);
        // Crest blade
        g.fillStyle = shade(metal, 0.18);
        g.beginPath();
        g.moveTo(-2, hy-9); g.quadraticCurveTo(-2.5, hy-20, hx, hy-24);
        g.quadraticCurveTo(2.5, hy-20, 2, hy-9); g.closePath(); g.fill();
        _outline(g, lo, 1.4);
        // Crest ridge
        g.strokeStyle = hi; g.lineWidth = 1.0;
        g.beginPath(); g.moveTo(0, hy-9); g.lineTo(0, hy-24); g.stroke();
        // Wide brim
        g.fillStyle = lo;
        g.beginPath();
        g.moveTo(-15, hy-2); g.quadraticCurveTo(hx, hy-9, 15, hy-2);
        g.quadraticCurveTo(hx, hy+3, -15, hy-2); g.closePath(); g.fill();
        _outline(g, shade(lo, -0.3), 1.5);
        // Side glints
        g.fillStyle = hi;
        g.beginPath(); g.ellipse(-4, hy-7, 2.5, 1.2, -0.6, 0, Math.PI * 2); g.fill();
        break;
      }

      case 'turban': {
        // Ottoman turban — layered wraps
        const tGrad = g.createRadialGradient(-3, hy-8, 2, hx, hy-5, 11);
        tGrad.addColorStop(0, shade(accent, 0.30));
        tGrad.addColorStop(1, shade(accent, -0.35));
        g.fillStyle = tGrad;
        g.beginPath();
        g.ellipse(hx, hy - 5, 11, 10, 0, 0, Math.PI * 2);
        g.fill();
        _outline(g, shade(accent, -0.5), 1.8);
        // Wrap rings
        g.strokeStyle = shade(accent, -0.32);
        g.lineWidth = 2.2;
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          g.ellipse(hx, hy - 1 + i * 3.5, 10, 2.5, 0, 0, Math.PI * 2);
          g.stroke();
        }
        // Aigrette pin
        g.fillStyle = shade(metal, 0.30);
        g.beginPath(); g.ellipse(2, hy-13, 2, 1.2, 0.5, 0, Math.PI*2); g.fill();
        _outline(g, shade(metal,-0.4), 0.8);
        // White feather tip
        g.strokeStyle = 'rgba(255,255,255,0.92)';
        g.lineWidth = 1.5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(1, hy-14); g.quadraticCurveTo(3, hy-20, 1, hy-26); g.stroke();
        break;
      }

      case 'cap': {
        // Polish fur cap (kolpak)
        g.fillStyle = '#a30c0c';
        g.beginPath(); g.arc(hx, hy-4, 9, Math.PI, 0, false); g.fill();
        _outline(g, '#560606', 1.8);
        // Fur band
        const furGrad = g.createLinearGradient(-10, hy-2, 10, hy+3);
        furGrad.addColorStop(0, '#ecdfc8'); furGrad.addColorStop(1, '#c4a87a');
        g.fillStyle = furGrad;
        g.beginPath(); g.ellipse(hx, hy-2, 10, 3.5, 0, 0, Math.PI*2); g.fill();
        _outline(g, '#805a30', 1.3);
        // Fur texture strokes
        g.strokeStyle = 'rgba(100,70,30,0.40)';
        g.lineWidth = 0.8;
        for (let i = -8; i <= 8; i += 2.5) {
          g.beginPath(); g.moveTo(i, hy-2); g.lineTo(i+1, hy+1); g.stroke();
        }
        // Top badge
        g.fillStyle = shade(accent || '#d4af37', 0.1);
        g.beginPath(); g.arc(0, hy-10, 2.5, 0, Math.PI*2); g.fill();
        _outline(g, shade(accent||'#d4af37', -0.5), 0.9);
        break;
      }

      case 'janissary': {
        // Janissary tall white felt cap
        g.fillStyle = 'rgba(248,245,235,0.97)';
        g.beginPath();
        g.moveTo(-5.5, hy);
        g.quadraticCurveTo(-5, hy-20, hx, hy-27);
        g.quadraticCurveTo( 5, hy-20, 5.5, hy);
        g.closePath(); g.fill();
        _outline(g, '#998866', 1.7);
        // Gold band
        g.fillStyle = accent;
        g.beginPath(); g.roundRect(-6.5, hy-3, 13, 4, 1.5); g.fill();
        _outline(g, shade(accent, -0.45), 1.0);
        // Ornament on cap
        g.fillStyle = accent;
        g.beginPath(); g.arc(0, hy-14, 2, 0, Math.PI*2); g.fill();
        _outline(g, shade(accent, -0.4), 0.8);
        // Plume feather from top
        g.strokeStyle = 'rgba(255,255,255,0.90)';
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, hy-27); g.quadraticCurveTo(4, hy-33, 2, hy-38); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 1.0;
        g.beginPath(); g.moveTo(2, hy-29); g.quadraticCurveTo(7, hy-33, 5, hy-38); g.stroke();
        break;
      }

      case 'hood': {
        // Bandit deep hood — shadowed face opening
        const hoodC = '#16090400';
        const hoodFill = '#1c0c06';
        const hoodHi   = '#3a1e12';
        // Back volume
        g.fillStyle = hoodFill;
        g.beginPath();
        g.arc(hx, hy - 1, 11, Math.PI * 0.8, Math.PI * 2.2, false);
        g.fill();
        _outline(g, '#0a0402', 2.0);
        // Cloth drape over shoulders
        g.fillStyle = shade(hoodFill, 0.05);
        g.beginPath();
        g.moveTo(-11, hy + 3);
        g.quadraticCurveTo(-14, hy + 12, -10, hy + 16);
        g.lineTo(-6, hy + 14);
        g.quadraticCurveTo(-8, hy + 6, -9, hy + 2);
        g.closePath(); g.fill();
        _outline(g, '#0a0402', 1.5);
        // Face shadow void
        g.fillStyle = '#0e0604';
        g.beginPath(); g.ellipse(hx + 1, hy + 1, 6.5, 7.5, 0, 0, Math.PI * 2); g.fill();
        // Eyes glint
        g.fillStyle = 'rgba(255, 200, 60, 0.80)';
        g.beginPath(); g.arc(-2.5, hy, 1.2, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc( 2.5, hy, 1.2, 0, Math.PI * 2); g.fill();
        // Fold lines
        g.strokeStyle = hoodHi;
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(-9, hy-9); g.quadraticCurveTo(-12, hy+1, -10, hy+6);
        g.stroke();
        break;
      }

      case 'ottoman_helm': {
        // Conical Ottoman pointed helmet + nasal + cheekguards
        const grad = _metalGrad(g, metal, -10, hy-20, 10, hy+7);
        g.fillStyle = grad;
        // Main cone body
        g.beginPath();
        g.moveTo(-9.5, hy + 5);
        g.quadraticCurveTo(-11, hy - 7, hx, hy - 20);
        g.quadraticCurveTo(11, hy - 7, 9.5, hy + 5);
        g.closePath(); g.fill();
        _outline(g, lo, 2.0);
        // Spike tip
        g.fillStyle = shade(metal, 0.40);
        g.beginPath();
        g.moveTo(-2, hy-17); g.lineTo(0, hy-27); g.lineTo(2, hy-17);
        g.closePath(); g.fill();
        _outline(g, lo, 1.2);
        // Gold band
        g.fillStyle = accent;
        g.beginPath(); g.roundRect(-10, hy+3, 20, 3, 1.5); g.fill();
        _outline(g, shade(accent,-0.45), 1.1);
        // Nasal bar
        g.fillStyle = shade(mid, -0.10);
        g.beginPath(); g.roundRect(-2, hy+2, 4, 11, 1); g.fill();
        _outline(g, lo, 1.0);
        // Cheek guards
        for (const sx of [-1, 1]) {
          g.fillStyle = shade(mid, -0.18);
          g.beginPath();
          g.moveTo(sx * 10, hy + 4);
          g.lineTo(sx * 10, hy + 13);
          g.lineTo(sx *  5, hy + 11);
          g.lineTo(sx *  6, hy + 4);
          g.closePath(); g.fill();
          _outline(g, lo, 1.1);
        }
        // Highlight streak
        g.fillStyle = hi;
        g.beginPath();
        g.moveTo(-3, hy-17); g.lineTo(-5, hy-8); g.lineTo(-2, hy-8);
        g.closePath(); g.fill();
        break;
      }

      case 'barbute': {
        // HRE T-visor sallet
        const grad = _metalGrad(g, metal, -10, hy-14, 10, hy+12);
        g.fillStyle = grad;
        // Skull dome
        g.beginPath(); g.arc(hx, hy-2, 10, Math.PI, 0, false); g.fill();
        _outline(g, lo, 2.0);
        // Face plate
        g.fillStyle = shade(mid, -0.05);
        g.beginPath(); g.roundRect(-10, hy-2, 20, 14, 2); g.fill();
        _outline(g, lo, 1.8);
        // T-visor cutout
        g.fillStyle = '#080808';
        g.beginPath(); g.roundRect(-9, hy+2, 18, 3.5, 1.5); g.fill();  // eye slit
        g.beginPath(); g.roundRect(-3, hy+2, 6, 13, 1.5);    g.fill();  // nose/mouth
        // Chin guard
        g.fillStyle = shade(mid, -0.08);
        g.beginPath();
        g.moveTo(-10, hy+13);
        g.quadraticCurveTo(-11, hy+18, -6, hy+18);
        g.lineTo( 6, hy+18);
        g.quadraticCurveTo(11, hy+18, 10, hy+13);
        g.closePath(); g.fill();
        _outline(g, lo, 1.5);
        // Highlight
        g.fillStyle = hi;
        g.beginPath(); g.arc(-4, hy-8, 4, Math.PI*1.1, Math.PI*1.8, false); g.fill();
        // Ridge line
        g.strokeStyle = shade(hi, -0.1); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(0, hy-12); g.lineTo(0, hy-2); g.stroke();
        break;
      }

      case 'closed':
      default: {
        // Full-face close helmet (default)
        const grad = _metalGrad(g, metal, -10, hy-13, 10, hy+10);
        g.fillStyle = grad;
        g.beginPath(); g.arc(hx, hy - 2, 10, Math.PI, 0, false); g.fill();
        _outline(g, lo, 2.0);
        g.fillStyle = shade(mid, -0.06);
        g.beginPath(); g.roundRect(-10, hy-2, 20, 13, 2); g.fill();
        _outline(g, lo, 1.8);
        // Visor slit
        g.fillStyle = '#060606';
        g.beginPath(); g.roundRect(-8, hy+2, 16, 3, 1.5); g.fill();
        // Highlight
        g.fillStyle = hi;
        g.beginPath(); g.arc(-3, hy-8, 4, Math.PI*1.1, Math.PI*1.8, false); g.fill();
        // Cheek ridge
        g.strokeStyle = shade(hi, -0.1); g.lineWidth = 1.0;
        g.beginPath();
        g.moveTo(-8, hy+4); g.quadraticCurveTo(-9, hy+10, -6, hy+11);
        g.stroke();
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BAŞ (kask yok)
  // ══════════════════════════════════════════════════════════════════════════
  _drawHead(g, skin, hair, beard, _size) {
    const hx = 0, hy = -22;
    const faceHi = shade(skin, 0.22);
    const faceSh = shade(skin, -0.18);

    // Neck
    g.fillStyle = shade(skin, -0.16);
    g.beginPath(); g.roundRect(-3.5, -13, 7, 6, 2); g.fill();
    _outline(g, shade(skin, -0.42), 1.0);

    // Face — radial gradient for 3D roundness
    const faceGrad = g.createRadialGradient(-2.5, hy - 3, 1, hx, hy, 11);
    faceGrad.addColorStop(0, faceHi);
    faceGrad.addColorStop(0.7, skin);
    faceGrad.addColorStop(1, faceSh);
    g.fillStyle = faceGrad;
    g.beginPath(); g.ellipse(hx, hy, 9, 11, 0, 0, Math.PI * 2); g.fill();
    _outline(g, shade(skin, -0.48), 1.8);

    // Hair (top dome + sideburn strip)
    g.fillStyle = hair;
    g.beginPath(); g.arc(hx, hy, 9.5, Math.PI, 0, false); g.fill();
    g.beginPath(); g.roundRect(-9.5, hy - 2, 19, 5, 2); g.fill();
    _outline(g, shade(hair, -0.48), 1.5);
    // Hair highlight streak
    g.strokeStyle = shade(hair, 0.24); g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-5, hy - 2); g.quadraticCurveTo(-1, hy - 6, 3, hy - 3); g.stroke();

    // Eyebrows — darker than hair
    const browC = shade(hair, -0.08);
    g.strokeStyle = browC; g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-6.5, hy - 3); g.quadraticCurveTo(-3.5, hy - 5.8, -0.5, hy - 3.5); g.stroke();
    g.beginPath(); g.moveTo( 0.5, hy - 3.5); g.quadraticCurveTo( 3.5, hy - 5.8,  6.5, hy - 3); g.stroke();

    // Eyes — large, expressive
    g.fillStyle = '#0c0404';
    g.beginPath(); g.ellipse(-3.5, hy + 1, 2.3, 1.8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse( 3.5, hy + 1, 2.3, 1.8, 0, 0, Math.PI * 2); g.fill();
    // White highlight
    g.fillStyle = 'rgba(255,255,255,0.80)';
    g.beginPath(); g.arc(-2.7, hy + 0.1, 0.90, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc( 4.3, hy + 0.1, 0.90, 0, Math.PI * 2); g.fill();
    // Eyelid line
    g.strokeStyle = '#1a0808'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(-6, hy + 1); g.quadraticCurveTo(-3.5, hy - 1.5, -1, hy + 1); g.stroke();
    g.beginPath(); g.moveTo( 1, hy + 1); g.quadraticCurveTo( 3.5, hy - 1.5,  6, hy + 1); g.stroke();

    // Nose bridge + nostrils
    g.strokeStyle = shade(skin, -0.28); g.lineWidth = 1.0; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1.5, hy + 3); g.quadraticCurveTo(-3, hy + 6.5, -1.8, hy + 7.5); g.stroke();
    g.beginPath(); g.moveTo( 1.5, hy + 3); g.quadraticCurveTo( 3, hy + 6.5,  1.8, hy + 7.5); g.stroke();
    // Nostril dots
    g.fillStyle = shade(skin, -0.32);
    g.beginPath(); g.arc(-2.2, hy + 7.5, 0.9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc( 2.2, hy + 7.5, 0.9, 0, Math.PI * 2); g.fill();

    // Mouth — slight warrior expression
    g.strokeStyle = shade(skin, -0.42); g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(-3.2, hy + 9.5); g.quadraticCurveTo(0, hy + 12.2, 3.2, hy + 9.5); g.stroke();
    // Upper lip line
    g.strokeStyle = shade(skin, -0.28); g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(-1.5, hy + 9.5); g.lineTo(0, hy + 8.5); g.lineTo(1.5, hy + 9.5); g.stroke();

    // Cheek warmth / shadow
    g.fillStyle = 'rgba(200,110,80,0.16)';
    g.beginPath(); g.ellipse(-5.8, hy + 4, 3, 2.5, 0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse( 5.8, hy + 4, 3, 2.5, -0.3, 0, Math.PI * 2); g.fill();
    // Jaw shadow
    g.fillStyle = shade(skin, -0.14);
    g.globalAlpha = 0.35;
    g.beginPath(); g.ellipse(hx, hy + 9, 7, 3.5, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;

    // Beard
    if (beard) {
      g.fillStyle = shade(hair, -0.08);
      g.globalAlpha = 0.88;
      g.beginPath(); g.ellipse(hx, hy + 10, 6.5, 5, 0, 0, Math.PI * 2); g.fill();
      _outline(g, shade(hair, -0.48), 1.0);
      // Beard stroke lines for texture
      g.strokeStyle = shade(hair, -0.25); g.lineWidth = 0.7;
      for (let bx = -4; bx <= 4; bx += 2) {
        g.beginPath(); g.moveTo(bx, hy + 7); g.lineTo(bx - 0.5, hy + 14); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SİLAH
  // ══════════════════════════════════════════════════════════════════════════
  _drawWeapon(g, weaponType, metal, _size, variant = 0) {
    const wood = '#4a2c10';
    const woodHi = '#7a4e25';
    const hi   = shade(metal, 0.45);

    const combatAngles = {
      pike:    -0.30, spear:   -0.24, lance:    0.40,
      bow:     -0.20, composite_bow: -0.20,
      musket:  -0.35, carbine: -0.30,
      sword:   -0.58, scimitar:-0.45, axe: -0.42,
    };

    const useAngle = variant === 1 && combatAngles[weaponType] !== undefined;
    if (useAngle) { g.save(); g.rotate(combatAngles[weaponType]); }

    switch (weaponType) {

      case 'pike':
      case 'spear': {
        // Long shaft
        g.fillStyle = wood;
        g.beginPath(); g.roundRect(13, -32, 3, 42, 1); g.fill();
        _outline(g, '#1a0800', 1.2);
        // Wood grain
        g.strokeStyle = woodHi; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(14.5, -28); g.lineTo(13.5, 8); g.stroke();
        // Spearhead — riveted socket
        const spGrad = _metalGrad(g, metal, 10, -34, 18, -22);
        g.fillStyle = spGrad;
        g.beginPath();
        g.moveTo(14.5, -30);
        g.lineTo(20, -22);
        g.lineTo(14.5, -20);
        g.lineTo( 9, -22);
        g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 1.5);
        g.fillStyle = hi;
        g.beginPath(); g.moveTo(14.5,-30); g.lineTo(16,-25); g.lineTo(13,-25); g.closePath(); g.fill();
        // Socket rings
        g.strokeStyle = shade(metal, -0.20); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(11,-20); g.lineTo(18,-20); g.stroke();
        g.beginPath(); g.moveTo(11,-18); g.lineTo(18,-18); g.stroke();
        break;
      }

      case 'lance': {
        g.fillStyle = wood;
        g.beginPath(); g.roundRect(13, -34, 3.5, 38, 1); g.fill();
        _outline(g, '#1a0800', 1.2);
        // Grip wrap
        g.strokeStyle = '#8b4513'; g.lineWidth = 2.5; g.lineCap = 'butt';
        g.beginPath(); g.moveTo(14.75, -4); g.lineTo(14.75, 8); g.stroke();
        // Vambrace guard
        g.fillStyle = shade(metal, -0.10);
        g.beginPath(); g.roundRect(11, -9, 8, 6, 2); g.fill();
        _outline(g, lo_dark(metal), 1.2);
        // Lance head
        const lGrad = _metalGrad(g, metal, 10, -36, 19, -22);
        g.fillStyle = lGrad;
        g.beginPath();
        g.moveTo(14.75, -34);
        g.lineTo(21, -24);
        g.lineTo(14.75, -21);
        g.lineTo(8.5,  -24);
        g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 1.5);
        g.fillStyle = hi;
        g.beginPath(); g.moveTo(14.75,-34); g.lineTo(16.5,-27); g.lineTo(13,-27); g.closePath(); g.fill();
        break;
      }

      case 'bow':
      case 'composite_bow': {
        // Recurve bow body
        g.strokeStyle = '#6b4226';
        g.lineWidth = 3.5;
        g.lineCap  = 'round';
        g.beginPath();
        g.arc(18, -5, 17, -0.9, 0.9);
        g.stroke();
        _outline_stroke(g, '#3a2010', 5.5);
        // String
        g.strokeStyle = 'rgba(230,215,175,0.90)';
        g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(12.5, -22); g.lineTo(12.5, 12); g.stroke();
        // Arrow nocked
        g.strokeStyle = woodHi; g.lineWidth = 1.0;
        g.beginPath(); g.moveTo(12.5, -14); g.lineTo(12.5, 6); g.stroke();
        g.fillStyle = metal;
        g.beginPath(); g.moveTo(12.5,-14); g.lineTo(15,-10); g.lineTo(10,-10); g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 0.8);
        // Bow limb tips — recurve tips
        g.strokeStyle = shade(wood, 0.15); g.lineWidth = 2.0;
        g.beginPath(); g.moveTo(8,-22); g.quadraticCurveTo(14,-26, 16,-28); g.stroke();
        g.beginPath(); g.moveTo(8, 12); g.quadraticCurveTo(14, 16, 16, 18); g.stroke();
        break;
      }

      case 'musket':
      case 'carbine': {
        // Stock
        g.fillStyle = shade(wood, 0.12);
        g.beginPath();
        g.moveTo(12, -16); g.lineTo(17, -8); g.lineTo(18, 8);
        g.lineTo(13, 8);   g.lineTo(10,  2); g.lineTo(11,-12);
        g.closePath(); g.fill();
        _outline(g, '#1a0800', 1.4);
        g.strokeStyle = woodHi; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(14,-14); g.lineTo(16, 4); g.stroke();
        // Barrel
        const barGrad = _metalGrad(g, metal, 12, -32, 17, -16);
        g.fillStyle = barGrad;
        g.beginPath(); g.roundRect(12.5, -32, 5, 18, 1); g.fill();
        _outline(g, lo_dark(metal), 1.5);
        // Barrel end ring
        g.strokeStyle = shade(metal, -0.20); g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(11,-30); g.lineTo(19,-30); g.stroke();
        // Lock plate
        g.fillStyle = shade(metal, -0.18);
        g.beginPath(); g.roundRect(16, -24, 6, 4, 1); g.fill();
        _outline(g, lo_dark(metal), 0.9);
        // Hammer / flintlock
        g.fillStyle = shade(metal, 0.15);
        g.beginPath();
        g.moveTo(19, -22); g.lineTo(24, -24); g.lineTo(22, -20);
        g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 0.8);
        // Flash pan
        g.fillStyle = '#c8b870';
        g.beginPath(); g.arc(22, -20, 2, 0, Math.PI*2); g.fill();
        break;
      }

      case 'sword': {
        // Long sword — double-edged straight blade
        // Pommel
        const pomGrad = _metalGrad(g, metal, 8, 10, 18, 16);
        g.fillStyle = pomGrad;
        g.beginPath(); g.ellipse(13.5, 12, 4.5, 3, 0, 0, Math.PI*2); g.fill();
        _outline(g, lo_dark(metal), 1.2);
        // Grip
        g.fillStyle = '#5a2c14';
        g.beginPath(); g.roundRect(10.5, 0, 6, 13, 2); g.fill();
        _outline(g, '#200a00', 1.0);
        // Wire wrap on grip
        g.strokeStyle = shade(metal, -0.10); g.lineWidth = 1.0;
        for (let gy = 2; gy < 12; gy += 2.5) {
          g.beginPath(); g.moveTo(10.5, gy); g.lineTo(16.5, gy+1); g.stroke();
        }
        // Crossguard
        const cgGrad = _metalGrad(g, metal, 4, -5, 22, -1);
        g.fillStyle = cgGrad;
        g.beginPath(); g.roundRect(4, -5, 20, 4, 2); g.fill();
        _outline(g, lo_dark(metal), 1.5);
        // Blade
        const blGrad = g.createLinearGradient(10, -34, 17, 0);
        blGrad.addColorStop(0,   hi);
        blGrad.addColorStop(0.4, shade(metal, 0.22));
        blGrad.addColorStop(1,   metal);
        g.fillStyle = blGrad;
        g.beginPath();
        g.moveTo(10.5, -1); g.lineTo(16.5, -1);
        g.lineTo(14.5, -36); g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 1.5);
        // Blood groove
        g.strokeStyle = shade(metal, -0.12); g.lineWidth = 0.9;
        g.beginPath(); g.moveTo(13.5, -3); g.lineTo(14, -30); g.stroke();
        // Edge glint
        g.strokeStyle = hi; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(14.5,-36); g.lineTo(10.8,-5); g.stroke();
        break;
      }

      case 'scimitar': {
        // Ottoman curved scimitar — wide, dramatic curve
        // Pommel
        g.fillStyle = _metalGrad(g, metal, 8, 10, 18, 14);
        g.beginPath(); g.arc(12, 12, 3.5, 0, Math.PI*2); g.fill();
        _outline(g, lo_dark(metal), 1.0);
        // Grip
        g.fillStyle = '#4a1a0a';
        g.beginPath(); g.roundRect(9, 0, 6, 13, 2); g.fill();
        _outline(g, '#200500', 1.0);
        // Yelman (disc guard)
        g.fillStyle = _metalGrad(g, metal, 7, -4, 20, 2);
        g.beginPath(); g.ellipse(14, -2, 6.5, 3, 0, 0, Math.PI*2); g.fill();
        _outline(g, lo_dark(metal), 1.4);
        // Blade body (curved)
        g.strokeStyle = shade(metal, 0.18);
        g.lineWidth   = 6;
        g.lineCap     = 'round';
        g.lineJoin    = 'round';
        g.beginPath();
        g.moveTo(14, -2);
        g.quadraticCurveTo(24, -16, 20, -33);
        g.stroke();
        _outline_stroke(g, lo_dark(metal), 8);
        // Sharp edge highlight
        g.strokeStyle = hi; g.lineWidth = 1.8;
        g.beginPath();
        g.moveTo(16, -3);
        g.quadraticCurveTo(26, -16, 22, -33);
        g.stroke();
        // Blade tip
        g.fillStyle = hi;
        g.beginPath(); g.arc(20.5, -33, 2, 0, Math.PI*2); g.fill();
        _outline(g, lo_dark(metal), 0.8);
        // Decorative fuller line
        g.strokeStyle = shade(metal, -0.08); g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(14.5, -3);
        g.quadraticCurveTo(20, -16, 18, -30);
        g.stroke();
        break;
      }

      case 'axe': {
        // Battle axe — wide head
        // Haft
        g.fillStyle = wood;
        g.beginPath(); g.roundRect(12, -26, 3.5, 38, 1.5); g.fill();
        _outline(g, '#1a0800', 1.3);
        g.strokeStyle = woodHi; g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(13.5,-22); g.lineTo(13,10); g.stroke();
        // Head — curved blade
        const axGrad = _metalGrad(g, metal, 0, -28, 18, -8);
        g.fillStyle = axGrad;
        g.beginPath();
        g.moveTo(13,  -24);
        g.lineTo(13,  -12);
        g.lineTo(  0,  -8);
        g.quadraticCurveTo(-2, -16,  0, -26);
        g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 1.8);
        // Cutting edge highlight
        g.strokeStyle = hi; g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, -8); g.quadraticCurveTo(-3, -16, 0, -26);
        g.stroke();
        // Back spike
        g.fillStyle = shade(metal, -0.12);
        g.beginPath();
        g.moveTo(16, -22); g.lineTo(23, -18); g.lineTo(16, -14);
        g.closePath(); g.fill();
        _outline(g, lo_dark(metal), 1.2);
        // Haft ring
        g.strokeStyle = shade(metal, -0.22); g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(10,-17); g.lineTo(18,-17); g.stroke();
        g.beginPath(); g.moveTo(10,-14); g.lineTo(18,-14); g.stroke();
        break;
      }

      default:
        break;
    }

    if (useAngle) g.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // KALKAN
  // ══════════════════════════════════════════════════════════════════════════
  _drawShield(g, primary, accent, _size, factionId = '') {
    const dark    = shade(primary, -0.50);
    const shieldHi = shade(primary, 0.30);

    // Shield body gradient
    const shGrad = g.createLinearGradient(-16, -12, 16, 18);
    shGrad.addColorStop(0, shade(primary, 0.22));
    shGrad.addColorStop(0.5, primary);
    shGrad.addColorStop(1, shade(primary, -0.30));
    g.fillStyle = shGrad;
    _shieldPath(g, -16, -12, 16, 28);
    g.fill();
    _outline(g, dark, 2.0);

    // Rim edging
    g.strokeStyle = shade(dark, 0.20);
    g.lineWidth = 2.5;
    _shieldPath(g, -16, -12, 16, 28);
    g.stroke();

    // Faction cross/stripe (base design)
    g.fillStyle = shade(accent, 0.05);
    // Vertical
    g.beginPath();
    g.moveTo(-3.5, -12); g.lineTo(3.5, -12);
    g.lineTo(3.5, 14); g.quadraticCurveTo(0, 17, -3.5, 14);
    g.closePath(); g.fill();
    // Horizontal
    g.fillStyle = shade(accent, 0.05);
    g.beginPath(); g.roundRect(-16, -3.5, 32, 7, 2); g.fill();
    _outline(g, shade(accent, -0.45), 1.0);

    // Boss / umbo (central shield boss) — 3D metal dome
    const bossGrad = g.createRadialGradient(-3, -1, 1, 0, 2, 7);
    bossGrad.addColorStop(0, shade(accent, 0.55));
    bossGrad.addColorStop(0.5, shade(accent, 0.10));
    bossGrad.addColorStop(1, shade(accent, -0.45));
    g.fillStyle = bossGrad;
    g.beginPath(); g.arc(0, 2, 6.5, 0, Math.PI*2); g.fill();
    _outline(g, shade(accent, -0.55), 1.5);
    // Boss rivets
    g.fillStyle = shade(accent, 0.40);
    for (const [bx,by] of [[-5,2],[5,2],[0,-4],[0,8]]) {
      g.beginPath(); g.arc(bx, by, 1.2, 0, Math.PI*2); g.fill();
    }

    // ── Faction emblem overlay ──────────────────────────────────────────
    this._drawShieldEmblem(g, factionId, accent, primary, dark);
  }

  _drawShieldEmblem(g, factionId, accent, primary, dark) {
    switch (factionId) {

      case 'ottoman': {
        // Star & crescent
        const stC = shade(accent, -0.18);
        // Crescent
        g.fillStyle = stC;
        g.beginPath(); g.arc(0, -4, 5.5, 0, Math.PI*2); g.fill();
        g.fillStyle = primary;
        g.beginPath(); g.arc(2, -5.5, 4.5, 0, Math.PI*2); g.fill();
        // 5-pointed star
        g.fillStyle = stC;
        _drawStar(g, 6.5, -1, 3.2, 1.3, 5);
        break;
      }

      case 'hre': {
        // Double-headed eagle (simplified)
        g.fillStyle = shade(accent, -0.12);
        // Left head
        g.beginPath(); g.arc(-4.5, -8, 2.8, 0, Math.PI*2); g.fill();
        // Right head
        g.beginPath(); g.arc( 4.5, -8, 2.8, 0, Math.PI*2); g.fill();
        // Body
        g.beginPath(); g.ellipse(0, -3, 3.5, 4, 0, 0, Math.PI*2); g.fill();
        // Wings spread
        g.beginPath();
        g.moveTo(-3.5,-4); g.lineTo(-11,1); g.lineTo(-7,4); g.lineTo(-2,0); g.closePath(); g.fill();
        g.beginPath();
        g.moveTo( 3.5,-4); g.lineTo(11,1); g.lineTo(7,4); g.lineTo(2,0); g.closePath(); g.fill();
        _outline(g, shade(accent,-0.55), 0.7);
        break;
      }

      case 'polish': {
        // White eagle on red
        g.fillStyle = 'rgba(255,255,255,0.90)';
        g.beginPath(); g.arc(0, -7, 2.8, 0, Math.PI*2); g.fill();
        g.beginPath(); g.ellipse(0, -3, 3, 4, 0, 0, Math.PI*2); g.fill();
        g.beginPath();
        g.moveTo(-3,-4); g.lineTo(-10,0); g.lineTo(-6,4); g.lineTo(-1.5,-1); g.closePath(); g.fill();
        g.beginPath();
        g.moveTo( 3,-4); g.lineTo(10,0); g.lineTo(6,4); g.lineTo(1.5,-1); g.closePath(); g.fill();
        _outline(g, 'rgba(180,0,0,0.60)', 0.7);
        break;
      }

      case 'spanish': {
        // Bold cross + corner castles (simplified)
        g.fillStyle = shade(accent, 0.30);
        g.beginPath(); g.roundRect(-2.5,-12, 5, 26, 1.5); g.fill();
        g.beginPath(); g.roundRect(-16,-3, 32, 6, 1.5); g.fill();
        _outline(g, shade(accent, -0.45), 0.8);
        break;
      }

      case 'venice': {
        // Lion of St Mark
        g.fillStyle = shade(accent, -0.10);
        // Lion body
        g.beginPath(); g.ellipse(-2, 0, 5, 3.5, 0, 0, Math.PI*2); g.fill();
        // Head
        g.beginPath(); g.arc(-6, -3, 3.5, 0, Math.PI*2); g.fill();
        // Mane
        g.strokeStyle = shade(accent, -0.25); g.lineWidth = 2.0;
        g.beginPath(); g.arc(-6, -3, 5, Math.PI*0.5, Math.PI*1.8, false); g.stroke();
        // Tail curl
        g.strokeStyle = shade(accent, -0.10); g.lineWidth = 2.5;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(4, 1); g.quadraticCurveTo(10, -2, 9, -6); g.stroke();
        _outline(g, shade(accent, -0.55), 0.6);
        break;
      }

      case 'bandit': {
        // Skull & crossbones
        g.fillStyle = 'rgba(220,60,20,0.85)';
        // Skull
        g.beginPath(); g.arc(0, -4, 3.5, 0, Math.PI*2); g.fill();
        g.fillStyle = primary;
        g.beginPath(); g.arc(-1.5, -3.5, 1.2, 0, Math.PI*2); g.fill();
        g.beginPath(); g.arc( 1.5, -3.5, 1.2, 0, Math.PI*2); g.fill();
        // Crossed bones
        g.fillStyle = 'rgba(220,60,20,0.75)';
        g.strokeStyle = 'rgba(220,60,20,0.75)'; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-7, 4); g.lineTo(7, -1); g.stroke();
        g.beginPath(); g.moveTo( 7, 4); g.lineTo(-7,-1); g.stroke();
        break;
      }

      default: {
        // Generic star
        g.fillStyle = shade(accent, -0.20);
        _drawStar(g, 0, -1, 4.5, 2.0, 5);
        break;
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SORGUÇ (plume)
  // ══════════════════════════════════════════════════════════════════════════
  _drawPlume(g, color, _size) {
    const dark = shade(color, -0.45);
    const hi   = shade(color, 0.30);
    g.save();
    g.translate(0, -32);
    for (let i = -3; i <= 3; i++) {
      g.strokeStyle = i % 2 === 0 ? color : hi;
      g.lineWidth   = i === 0 ? 2.5 : 1.8;
      g.lineCap     = 'round';
      g.beginPath();
      g.moveTo(i * 1.8, 0);
      g.quadraticCurveTo(i * 3 + 4, -6, i * 2.5 + 2, -16);
      g.stroke();
      // Feather barbs
      g.strokeStyle = dark;
      g.lineWidth = 0.5;
      const steps = 5;
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const px = i * 1.8 + (i * 2.5 + 2 - i * 1.8) * t;
        const py = -16 * t;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px - 3, py - 2);
        g.stroke();
      }
    }
    g.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HUSSAR KANATLARI
  // ══════════════════════════════════════════════════════════════════════════
  _drawWings(g, _size) {
    const frame   = '#7a3810';
    const frameHi = '#a85c28';
    const feather = 'rgba(238,230,210,0.90)';
    const quill   = '#4a2205';

    for (const dir of [-1, 1]) {
      const sx = dir * 12, tx = dir * 17;
      // Main arm
      g.strokeStyle = frame;
      g.lineWidth = 3.0;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(sx, -6);
      g.quadraticCurveTo(dir * 28, -22, dir * 18, -38);
      g.stroke();
      // Feathers
      for (let i = 0; i < 8; i++) {
        const t   = i / 7;
        const fx  = sx + (tx - sx) * t;
        const fy  = -6 + (-38 + 6) * t;
        const len = 10 + (1 - t) * 4;
        g.strokeStyle = feather;
        g.lineWidth   = 1.8;
        g.beginPath();
        g.moveTo(fx, fy);
        g.quadraticCurveTo(fx + dir * (len * 0.7), fy - len * 0.5, fx + dir * len, fy - len);
        g.stroke();
        g.strokeStyle = quill;
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(fx, fy);
        g.lineTo(fx + dir * len, fy - len);
        g.stroke();
      }
      // Arm highlight
      g.strokeStyle = frameHi;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(sx, -6);
      g.quadraticCurveTo(dir * 27, -22, dir * 17.5, -36);
      g.stroke();
    }
  }

  // ── Backwards-compat shims ──────────────────────────────────────────────
  drawHorse(g, color, size)                    { this._drawHorse(g, color, size); }
  drawBody(g, cloth, hi, lo, profile, size)    { this._drawBody(g, cloth, {primary:cloth,secondary:lo,accent:hi,leather:lo,cloak:false}, profile, size); }
  drawHead(g, skin, hair, beard, size)         { this._drawHead(g, skin, hair, beard, size); }
  drawHelmet(g, metal, type, size)             { this._drawHelmet(g, metal, type, '#d4af37', size); }
  drawWeapon(g, wtype, metal, size)            { this._drawWeapon(g, wtype, metal, size); }
  drawShield(g, primary, accent, size)         { this._drawShield(g, primary, accent, size); }
  drawPlume(g, color, size)                    { this._drawPlume(g, color, size); }
  drawWings(g, size)                           { this._drawWings(g, size); }

  clearCache() { this.cache.clear(); }
}

// ── Module-level helpers ────────────────────────────────────────────────────

function lo_dark(metal) { return shade(metal, -0.55); }

/** Draw outline around an existing STROKE path (not fill) */
function _outline_stroke(g, color, width) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth   = width;
  g.lineJoin    = 'round';
  g.lineCap     = 'round';
  g.stroke();
  g.restore();
}

/** Draw a regular N-pointed star */
function _drawStar(g, cx, cy, outerR, innerR, points) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
}

export default SpriteGenerator;
