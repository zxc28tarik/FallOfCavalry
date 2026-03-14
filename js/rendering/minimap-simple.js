import * as CONST from '../constants.js';

// Biome → [R, G, B] sabit tablosu (per-pixel hız için)
const BIOME_RGB = {
  [CONST.BIOME.SEA]:      [26,  77,  111],
  [CONST.BIOME.SHORE]:    [139, 115, 85],
  [CONST.BIOME.PLAINS]:   [111, 143, 78],
  [CONST.BIOME.FOREST]:   [47,  90,  51],
  [CONST.BIOME.HILLS]:    [122, 106, 74],
  [CONST.BIOME.MOUNTAIN]: [90,  82,  74],
  [CONST.BIOME.SNOW]:     [230, 237, 245],
};
const FALLBACK_RGB = BIOME_RGB[CONST.BIOME.PLAINS];

export class MinimapSimple {
  constructor(canvasEl) {
    this.canvas = canvasEl || null;
    this.ctx = canvasEl?.getContext('2d') || null;
    this._imgData = null; // reused ImageData buffer
  }

  render(game) {
    if (!this.ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const TILE = CONST.WORLD.TILE_SIZE;

    const map = game.state?.map;
    const mapW = map?.width || 1;
    const mapH = map?.height || 1;
    const fog = map?.fog || null;
    const biomes = map?.biomes instanceof Uint8Array ? map.biomes : null;

    // ── 1. Terrain ──────────────────────────────────────────────
    if (!biomes || !map?.width || !map?.height) {
      // Harita henüz oluşmadıysa düz arka plan
      this.ctx.fillStyle = '#0d1b2a';
      this.ctx.fillRect(0, 0, w, h);
    } else {
      // ImageData tamponunu yeniden kullan
      if (!this._imgData || this._imgData.width !== w || this._imgData.height !== h) {
        this._imgData = this.ctx.createImageData(w, h);
      }
      const data = this._imgData.data;

      // Tüm pikselleri siyah sıfırla (keşfedilmemiş alanlar siyah kalır)
      data.fill(0);

      for (let ty = 0; ty < mapH; ty++) {
        for (let tx = 0; tx < mapW; tx++) {
          const tileIdx = ty * mapW + tx;
          const fogLevel = fog ? fog[tileIdx] : 2;

          const rgb = BIOME_RGB[biomes[tileIdx]] || FALLBACK_RGB;
          // fog=0 keşfedilmemiş → %18 dim (koyu silüet)
          // fog=1 yarı görünür  → %50 dim
          // fog=2 tam görünür   → %100
          const dim = fogLevel === 0 ? 0.18 : fogLevel === 1 ? 0.50 : 1.0;
          const r = (rgb[0] * dim) | 0;
          const g = (rgb[1] * dim) | 0;
          const b = (rgb[2] * dim) | 0;

          // Tile → minimap piksel aralığı
          const px0 = ((tx * w) / mapW) | 0;
          const py0 = ((ty * h) / mapH) | 0;
          const px1 = Math.max(px0 + 1, (((tx + 1) * w) / mapW) | 0);
          const py1 = Math.max(py0 + 1, (((ty + 1) * h) / mapH) | 0);

          for (let py = py0; py < py1; py++) {
            for (let px = px0; px < px1; px++) {
              if (px >= w || py >= h) continue;
              const pidx = (py * w + px) << 2;
              data[pidx]     = r;
              data[pidx + 1] = g;
              data[pidx + 2] = b;
              data[pidx + 3] = 255;
            }
          }
        }
      }

      this.ctx.putImageData(this._imgData, 0, 0);
    }

    // Dünya → minimap ölçek faktörleri (maxX = mapW * TILE, piksel cinsinden)
    const bounds = game.worldManager.getWorldBounds();
    const sx = w / Math.max(1, bounds.maxX);
    const sy = h / Math.max(1, bounds.maxY);

    // ── 2. Settlements (piksel koordinatı) ──────────────────────
    // Şehirler her zaman gösterilir (dünya haritasında bilinen yerleşim)
    for (const s of (map?.settlements || [])) {
      const cx = s.x * sx;
      const cy = s.y * sy;
      const r = s.type === 'city' ? 3.5 : s.type === 'town' ? 2.5 : 1.8;

      this.ctx.fillStyle = this._factionColor(s.owner);
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      this.ctx.lineWidth = 0.8;
      this.ctx.stroke();
    }

    // ── 3. Düşman partileri (piksel koordinatı) ─────────────────
    for (const e of (game.state?.aiParties || [])) {
      if (!e || !Number.isFinite(e.x)) continue;
      const cx = e.x * sx;
      const cy = e.y * sy;
      this.ctx.fillStyle = '#e74c3c';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ── 4. Oyuncu (tile koordinatı → piksel) ────────────────────
    const player = game.playerParty;
    if (player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
      const cx = (player.x * TILE + TILE / 2) * sx;
      const cy = (player.y * TILE + TILE / 2) * sy;

      this.ctx.shadowColor = '#ffe066';
      this.ctx.shadowBlur = 8;
      this.ctx.fillStyle = '#ffeb3b';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      this.ctx.strokeStyle = '#222';
      this.ctx.lineWidth = 1.2;
      this.ctx.stroke();
    }

    // ── 5. Kamera dikdörtgeni ───────────────────────────────────
    const cam = game.worldManager.getCameraSafe();
    const cw = ((game.canvas?.width || 800) / (cam.zoom || 1)) * sx;
    const ch = ((game.canvas?.height || 600) / (cam.zoom || 1)) * sy;
    this.ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(cam.x * sx, cam.y * sy, cw, ch);

    // ── 6. Dairesel vignette ────────────────────────────────────
    const grad = this.ctx.createRadialGradient(w / 2, h / 2, w * 0.28, w / 2, h / 2, w * 0.52);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.72)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);
  }

  _factionColor(factionId) {
    const colors = {
      ottoman: '#c0392b',
      hre:     '#3498db',
      polish:  '#e74c3c',
      spanish: '#f1c40f',
      venice:  '#16a085',
      bandit:  '#8d6e63',
    };
    return colors[factionId] || '#9e9e9e';
  }
}

export default MinimapSimple;
