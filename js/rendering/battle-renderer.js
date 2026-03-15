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

export class BattleRenderer {
  constructor() {
    this.spriteGen = new SpriteGenerator();
    // Sabit çim / toprak noktaları — constructor'da bir kez üretilir
    this._grass = _buildPatches(100, 0xdeadbeef);
    this._dirt = _buildPatches(40, 0xfeed1234);
  }

  render(ctx, state) {
    if (!state.battle) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    this.drawBattlefield(ctx, w, h);
    this.drawUnits(ctx, state.battleUnits.player);
    this.drawUnits(ctx, state.battleUnits.enemy);
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

    // Ufuk sis katmanı
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

    // Zemin gölgesi
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 28, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sprite
    const sprite = this.spriteGen.getUnitSprite(unit.faction, unit.type, unit.id);
    if (sprite) ctx.drawImage(sprite, x - 32, y - 32, 64, 64);

    // Hedefli / seçili halka
    if (unit.target) {
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

    // HP barı
    this.drawHealthBar(ctx, x, y - 42, unit.hp, unit.maxHp);

    // Moral barı — yalnızca düşükse
    if (unit.morale !== undefined && unit.morale < 80) {
      this.drawMoraleBar(ctx, x, y - 49, unit.morale);
    }
  }

  drawHealthBar(ctx, cx, y, hp, maxHp) {
    const W = 44,
      H = 5,
      R = 2;
    const x = cx - W / 2;
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    const fillW = ratio * W;

    // Arka plan
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    this._roundRect(ctx, x, y, W, H, R);
    ctx.fill();

    // Dolgu — HP oranına göre renk
    const fillColor = ratio > 0.6 ? '#4caf50' : ratio > 0.3 ? '#ff9800' : '#e53935';
    ctx.fillStyle = fillColor;
    if (fillW > R * 2) {
      this._roundRect(ctx, x, y, fillW, H, R);
      ctx.fill();
    } else if (fillW > 0) {
      ctx.fillRect(x, y, fillW, H);
    }

    // Dış kenarlık
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 0.8;
    this._roundRect(ctx, x, y, W, H, R);
    ctx.stroke();
  }

  drawMoraleBar(ctx, cx, y, morale) {
    const W = 44,
      H = 3,
      R = 1.5;
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
