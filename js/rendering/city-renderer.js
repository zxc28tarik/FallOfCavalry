/**
 * FallOfCavalry - City Renderer
 * Canvas arka planı — asıl içerik HTML #settlementModal üzerinde
 */

// Deterministik LCG
function _seedRand(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}

function _buildBuildings() {
  const rng = _seedRand(0xbada5523);
  return Array.from({ length: 16 }, (_, i) => ({
    rx: 0.02 + (i / 16) * 0.96,   // yatay konum (0-1)
    rh: 0.10 + rng() * 0.24,       // yükseklik oranı
    rw: 0.035 + rng() * 0.055,     // genişlik oranı
    hasTower: rng() > 0.58,
    towerRx: 0.2 + rng() * 0.6,   // kule yatay offset (bina içinde)
    roofPeaked: rng() > 0.45,
    hasWindow: rng() > 0.38,
    winOffY: 0.22 + rng() * 0.20, // pencere dikey offset
    winOffX: 0.3 + rng() * 0.4,   // pencere yatay offset
  }));
}

function _buildStars() {
  const rng = _seedRand(0x5eed1234);
  return Array.from({ length: 80 }, () => ({
    rx: rng(),
    ry: rng() * 0.52,
    size: 0.4 + rng() * 1.3,
    alpha: 0.4 + rng() * 0.6,
  }));
}

export class CityRenderer {
  constructor() {
    this._buildings = _buildBuildings();
    this._stars = _buildStars();
  }

  render(ctx, state) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // ── Gece gökyüzü ──────────────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58);
    sky.addColorStop(0, '#060a12');
    sky.addColorStop(0.55, '#111828');
    sky.addColorStop(1, '#1c2230');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // ── Yıldızlar ─────────────────────────────────────────────────
    for (const s of this._stars) {
      ctx.fillStyle = `rgba(255,255,255,${s.alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.rx * w, s.ry * h, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Ay ────────────────────────────────────────────────────────
    ctx.save();
    ctx.shadowColor = 'rgba(244,216,122,0.55)';
    ctx.shadowBlur = 32;
    ctx.fillStyle = '#f4e8c1';
    ctx.beginPath();
    ctx.arc(w * 0.80, h * 0.11, 20, 0, Math.PI * 2);
    ctx.fill();
    // Ay gölgesi (dolunay değil)
    ctx.fillStyle = '#0a0e18';
    ctx.beginPath();
    ctx.arc(w * 0.80 + 8, h * 0.11 - 4, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Ufuk çizgisi / zemin ──────────────────────────────────────
    const horizonY = h * 0.54;

    const ground = ctx.createLinearGradient(0, horizonY, 0, h);
    ground.addColorStop(0, '#161209');
    ground.addColorStop(1, '#1e1810');
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // ── Şehir silüeti ─────────────────────────────────────────────
    ctx.fillStyle = '#0e0b07';

    for (const b of this._buildings) {
      const bx = b.rx * w;
      const bw = b.rw * w;
      const bh = b.rh * h;
      const by = horizonY - bh;

      // Ana bina gövdesi
      ctx.fillStyle = '#0e0b07';
      ctx.fillRect(bx - bw / 2, by, bw, bh + 1);

      // Çatı
      if (b.roofPeaked) {
        ctx.beginPath();
        ctx.moveTo(bx - bw / 2 - 1, by);
        ctx.lineTo(bx, by - bh * 0.26);
        ctx.lineTo(bx + bw / 2 + 1, by);
        ctx.closePath();
        ctx.fill();
      }

      // Kule
      if (b.hasTower) {
        const tx = bx - bw / 2 + b.towerRx * bw;
        const tw = bw * 0.28;
        const th = bh * 0.38;
        ctx.fillRect(tx - tw / 2, by - th, tw, th);
        // Kule başlığı
        ctx.beginPath();
        ctx.moveTo(tx - tw / 2, by - th);
        ctx.lineTo(tx, by - th - tw * 0.9);
        ctx.lineTo(tx + tw / 2, by - th);
        ctx.closePath();
        ctx.fill();
      }

      // Aydınlık pencere
      if (b.hasWindow) {
        ctx.fillStyle = 'rgba(255,195,70,0.50)';
        const wx = bx - bw / 2 + b.winOffX * bw - 3;
        const wy = by + bh * b.winOffY;
        ctx.fillRect(wx, wy, 5, 8);
        ctx.fillStyle = '#0e0b07';
      }
    }

    // ── Büyük şehir kapısı (merkez) ───────────────────────────────
    const gw = w * 0.10;
    const gh = h * 0.16;
    const gx = w / 2;
    const gy = horizonY;

    ctx.fillStyle = '#0e0b07';
    ctx.fillRect(gx - gw / 2, gy - gh, gw, gh);

    // Kemer kemerli kapı açıklığı
    ctx.fillStyle = '#050403';
    ctx.beginPath();
    ctx.arc(gx, gy - gh * 0.55, gw * 0.38, Math.PI, 0);
    ctx.rect(gx - gw * 0.38, gy - gh * 0.55, gw * 0.76, gh * 0.55);
    ctx.fill();

    // Kule kuleleri (kapı yanı)
    for (const side of [-1, 1]) {
      const tx = gx + side * (gw / 2 + w * 0.025);
      const tw2 = w * 0.04;
      const th2 = gh * 1.2;
      ctx.fillStyle = '#0c0a06';
      ctx.fillRect(tx - tw2 / 2, gy - th2, tw2, th2);
      ctx.fillStyle = '#0e0b07';
      ctx.beginPath();
      ctx.moveTo(tx - tw2 / 2 - 2, gy - th2);
      ctx.lineTo(tx, gy - th2 - tw2 * 0.8);
      ctx.lineTo(tx + tw2 / 2 + 2, gy - th2);
      ctx.closePath();
      ctx.fill();
    }

    // ── Ufuk sisi ─────────────────────────────────────────────────
    const mist = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 50);
    mist.addColorStop(0, 'rgba(20,16,10,0)');
    mist.addColorStop(1, 'rgba(20,16,10,0.60)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, horizonY - 30, w, 80);

    // ── Vignette ──────────────────────────────────────────────────
    const vig = ctx.createRadialGradient(w / 2, h * 0.5, w * 0.20, w / 2, h * 0.5, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.70)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }
}

export default CityRenderer;
