/**
 * FallOfCavalry - Battle Renderer
 * Gerçek zamanlı savaş simülasyonu render
 */

import SpriteGenerator from './sprite-generator.js';

// Deterministik LCG — her kare yeniden randomize edilmez
function _seedRand(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function _buildPatches(n, seed) {
  const rng = _seedRand(seed);
  return Array.from({ length: n }, () => ({
    rx: rng(),
    ry: rng(),
    w: 1 + ((rng() * 3) | 0),
    h: 3 + ((rng() * 7) | 0),
  }));
}

function _buildHorizonTrees() {
  const rng = _seedRand(0xcafe1234);
  return Array.from({ length: 30 }, () => ({
    rx: rng(),             // x pozisyonu (0-1)
    rh: 0.05 + rng() * 0.075, // yükseklik oranı
    rw: 0.55 + rng() * 0.65,  // genişlik çarpanı (yüksekliğe göreli)
  }));
}

// Birim türü → kısa etiket
const UNIT_TYPE_LABELS = {
  archer:      'BOW',
  cav_archer:  'CAV',
  pike_inf:    'PIK',
  cav_pike:    'CAV',
  musketeer:   'GUN',
  carbine_cav: 'CAR',
  heavy_cav:   'HVY',
};

export class BattleRenderer {
  constructor() {
    this.spriteGen = new SpriteGenerator();
    // Sabit zemin dokusu — constructor'da bir kez üretilir
    this._grass        = _buildPatches(100, 0xdeadbeef);
    this._dirt         = _buildPatches(40,  0xfeed1234);
    this._horizonTrees = _buildHorizonTrees();
  }

  render(ctx, state) {
    if (!state.battle) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    this.drawBattlefield(ctx, w, h);
    this.drawBattleHorizon(ctx, w, h);
    this.drawUnits(ctx, state.battleUnits.player);
    this.drawUnits(ctx, state.battleUnits.enemy);
    this.drawFloatingTexts(ctx, state.battle?.floatingTexts);
  }

  // ── Zemin ──────────────────────────────────────────────────────
  drawBattlefield(ctx, w, h) {
    // Zemin gradyanı
    const ground = ctx.createLinearGradient(0, h * 0.28, 0, h);
    ground.addColorStop(0, '#7a8c52');
    ground.addColorStop(0.45, '#6a7a42');
    ground.addColorStop(1, '#56642e');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, w, h);

    // Gökyüzü / ufuk sis katmanı
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.32);
    sky.addColorStop(0, 'rgba(38,46,52,0.92)');
    sky.addColorStop(1, 'rgba(75,85,65,0)');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.32);

    // Zemin dokusu — sabit çim
    ctx.fillStyle = 'rgba(90,108,58,0.52)';
    for (const p of this._grass) {
      ctx.fillRect(p.rx * w, p.ry * h, p.w, p.h);
    }

    // Toprak lekeleri
    ctx.fillStyle = 'rgba(62,50,32,0.22)';
    for (const p of this._dirt) {
      ctx.fillRect(p.rx * w, p.ry * h, p.w + 2, (p.h * 0.5) | 0);
    }

    // Muharebe hattı — ince, tematik
    const midY = h / 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(180,145,60,0.20)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 12]);
    ctx.beginPath();
    ctx.moveTo(w * 0.04, midY);
    ctx.lineTo(w * 0.96, midY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Vignette
    const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Ufuk ağaç hattı ────────────────────────────────────────────
  drawBattleHorizon(ctx, w, h) {
    const horizonY = h * 0.30;

    // Uzak ağaç silüeti — soluk, üst üste binmiş
    ctx.fillStyle = 'rgba(30,44,26,0.55)';
    for (const t of this._horizonTrees) {
      const tx = t.rx * w;
      const th = t.rh * h;
      const tw = th * t.rw;
      ctx.beginPath();
      ctx.moveTo(tx, horizonY - th);
      ctx.lineTo(tx + tw / 2, horizonY);
      ctx.lineTo(tx - tw / 2, horizonY);
      ctx.closePath();
      ctx.fill();
    }

    // Ufuk sis bandı — ground ile sky arasındaki geçişi yumuşat
    const mist = ctx.createLinearGradient(0, horizonY - 14, 0, horizonY + 22);
    mist.addColorStop(0,   'rgba(82,96,60,0)');
    mist.addColorStop(0.45,'rgba(82,96,60,0.30)');
    mist.addColorStop(1,   'rgba(82,96,60,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, horizonY - 14, w, 36);
  }

  // ── Birimler ───────────────────────────────────────────────────
  drawUnits(ctx, units) {
    for (const unit of units) {
      if (unit.hp <= 0) continue;
      this.drawUnit(ctx, unit);
    }
  }

  drawUnit(ctx, unit) {
    const x = unit.x;
    const y = unit.y;
    const isRouting  = !!unit.routing;
    const isSelected = !!unit.selected;

    ctx.save();
    if (isRouting) ctx.globalAlpha = 0.58;

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 28, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Seçili altın halka
    if (isSelected) {
      ctx.save();
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255,235,90,0.88)';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(x, y + 4, 33, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Sprite (procedural)
    const sprite = this.spriteGen.getUnitSprite(unit.faction, unit.type, unit.id);
    if (sprite) ctx.drawImage(sprite, x - 32, y - 32, 64, 64);

    // Routing → kırmızı kaçış oku; yoksa hedef halkası
    if (isRouting) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,55,55,0.90)';
      ctx.fillText('↩', x, y - 36);
      ctx.restore();
    } else if (unit.target) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,210,50,0.65)';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y + 4, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // HP barı
    this.drawHealthBar(ctx, x, y - 42, unit.hp, unit.maxHp);

    // Moral barı — yalnızca düşükse
    if (unit.morale !== undefined && unit.morale < 80) {
      this.drawMoraleBar(ctx, x, y - 49, unit.morale);
    }

    // Birim türü etiketi
    this.drawUnitTypeBadge(ctx, x, y - 57, unit.type);
  }

  // ── HP barı ────────────────────────────────────────────────────
  drawHealthBar(ctx, cx, y, hp, maxHp) {
    const W = 44, H = 5, R = 2;
    const x = cx - W / 2;
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    const fillW = ratio * W;

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    this._roundRect(ctx, x, y, W, H, R);
    ctx.fill();

    const fillColor = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ff9800' : '#e53935';
    ctx.fillStyle = fillColor;
    if (fillW > R * 2) {
      this._roundRect(ctx, x, y, fillW, H, R);
      ctx.fill();
    } else if (fillW > 0) {
      ctx.fillRect(x, y, fillW, H);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.8;
    this._roundRect(ctx, x, y, W, H, R);
    ctx.stroke();
  }

  // ── Moral barı ─────────────────────────────────────────────────
  drawMoraleBar(ctx, cx, y, morale) {
    const W = 44, H = 3, R = 1.5;
    const x = cx - W / 2;
    const ratio = morale / 100;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    this._roundRect(ctx, x, y, W, H, R);
    ctx.fill();

    ctx.fillStyle = morale > 50 ? '#5c9bd6' : '#e67e22';
    const fw = ratio * W;
    if (fw > R * 2) {
      this._roundRect(ctx, x, y, fw, H, R);
      ctx.fill();
    } else if (fw > 0) {
      ctx.fillRect(x, y, fw, H);
    }
  }

  // ── Birim türü etiketi ─────────────────────────────────────────
  drawUnitTypeBadge(ctx, cx, y, unitType) {
    const label = UNIT_TYPE_LABELS[unitType];
    if (!label) return;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(205,185,135,0.68)';
    ctx.fillText(label, cx, y);
  }

  // ── Floating hasar metinleri ───────────────────────────────────
  drawFloatingTexts(ctx, texts) {
    if (!texts?.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.88)';
    ctx.shadowBlur = 5;
    ctx.font = 'bold 13px "Cinzel", serif';

    for (const ft of texts) {
      if (!ft?.active) continue;
      const alpha = Math.max(0, Math.min(1, ft.alpha ?? 1));
      if (alpha < 0.01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color || '#ffffff';
      ctx.fillText(ft.text ?? '', ft.x, ft.y);
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Yardımcılar ───────────────────────────────────────────────
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

export default BattleRenderer;
