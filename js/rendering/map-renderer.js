/**
 * FallOfCavalry - Map Renderer
 * Eski app.js'deki drawMap fonksiyonundan refactor edildi
 */

import * as CONST from '../constants.js';
import { shade } from '../utils.js';
import SpriteGenerator from './sprite-generator.js';

export class MapRenderer {
  constructor() {
    this.spriteGen = new SpriteGenerator();
    this.tileCache = new Map();
  }

  render(ctx, state) {
    const { map, player, camera, settings } = state;
    const TILE = CONST.WORLD.TILE_SIZE;

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Viewport culling
    const viewX = Math.floor(camera.x / TILE);
    const viewY = Math.floor(camera.y / TILE);
    const viewW = Math.ceil(ctx.canvas.width / TILE) + 2;
    const viewH = Math.ceil(ctx.canvas.height / TILE) + 2;

    const startX = Math.max(0, viewX);
    const startY = Math.max(0, viewY);
    const endX = Math.min(map.width, viewX + viewW);
    const endY = Math.min(map.height, viewY + viewH);

    // Draw tiles
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!tile) continue;

        const fogLevel = map.fog ? map.fog[y * map.width + x] : 2;

        // Skip unexplored tiles
        if (fogLevel === 0 && settings.showMinimap) continue;

        this.drawTile(ctx, tile, x, y, TILE, fogLevel, map);
      }
    }

    // Draw rivers
    this.drawRivers(ctx, map.rivers, TILE);

    // Draw roads
    this.drawRoads(ctx, map.roads, TILE);

    // Draw settlements
    for (const settlement of map.settlements) {
      const fogLevel = map.fog ? map.fog[settlement.y * map.width + settlement.x] : 2;
      if (fogLevel > 0) {
        this.drawSettlement(ctx, settlement, TILE);
      }
    }

    // Draw AI parties
    for (const party of state.aiParties) {
      this.drawAIParty(ctx, party, TILE);
    }

    // Draw player
    this.drawPlayer(ctx, player, TILE);

    ctx.restore();
  }

  drawTile(ctx, tile, x, y, TILE, fogLevel, map) {
    const px = x * TILE;
    const py = y * TILE;

    // Base terrain color
    let color = this.getTerrainColor(tile.type);

    // Apply fog
    if (fogLevel === 1) {
      color = shade(color, -0.42);
    }

    ctx.fillStyle = color;
    ctx.fillRect(px, py, TILE, TILE);

    // Forests — 3 küçük ağaç silüeti
    if (fogLevel > 0 && map.forests.some((f) => f.x === x && f.y === y)) {
      const forestColor = shade(CONST.WORLD.COLOR_FOREST, fogLevel === 1 ? -0.42 : 0.08);
      ctx.fillStyle = forestColor;
      const treePositions = [
        [px + TILE * 0.28, py + TILE * 0.52],
        [px + TILE * 0.72, py + TILE * 0.52],
        [px + TILE * 0.50, py + TILE * 0.26],
      ];
      for (const [tx, ty] of treePositions) {
        ctx.beginPath();
        ctx.moveTo(tx, ty - TILE * 0.20);
        ctx.lineTo(tx + TILE * 0.15, ty + TILE * 0.12);
        ctx.lineTo(tx - TILE * 0.15, ty + TILE * 0.12);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Mountains — dağ silueti + kar başlığı
    if (fogLevel > 0 && map.mountains.some((m) => m.x === x && m.y === y)) {
      const mtnColor = shade(CONST.WORLD.COLOR_MOUNTAIN, fogLevel === 1 ? -0.42 : 0);
      ctx.fillStyle = mtnColor;
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + TILE * 0.14);
      ctx.lineTo(px + TILE * 0.82, py + TILE * 0.82);
      ctx.lineTo(px + TILE * 0.18, py + TILE * 0.82);
      ctx.closePath();
      ctx.fill();

      // Kar başlığı (yalnızca tam görünür tile'da)
      if (fogLevel === 2) {
        ctx.fillStyle = 'rgba(220,235,248,0.85)';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py + TILE * 0.14);
        ctx.lineTo(px + TILE * 0.63, py + TILE * 0.37);
        ctx.lineTo(px + TILE * 0.37, py + TILE * 0.37);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Grid (debug) — intentionally disabled
    // eslint-disable-next-line no-constant-condition
    if (false) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeRect(px, py, TILE, TILE);
    }
  }

  getTerrainColor(type) {
    const colors = {
      water: CONST.WORLD.COLOR_SEA,
      shore: CONST.WORLD.COLOR_SHORE,
      grass: CONST.WORLD.COLOR_GRASS,
      forest: CONST.WORLD.COLOR_FOREST,
      mountain: CONST.WORLD.COLOR_MOUNTAIN,
      snow: CONST.WORLD.COLOR_SNOW,
    };

    return colors[type] || CONST.WORLD.COLOR_GRASS;
  }

  // ── Rivers ────────────────────────────────────────────────────
  drawRivers(ctx, rivers, TILE) {
    // Dış çizgi (koyu mavi)
    ctx.strokeStyle = '#2a6fa8';
    ctx.lineWidth = TILE * 0.20;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const river of rivers) {
      if (river.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(river[0].x * TILE + TILE / 2, river[0].y * TILE + TILE / 2);
      for (let i = 1; i < river.length; i++) {
        ctx.lineTo(river[i].x * TILE + TILE / 2, river[i].y * TILE + TILE / 2);
      }
      ctx.stroke();
    }

    // İç çizgi (parlak mavi highlight)
    ctx.strokeStyle = '#5aaee8';
    ctx.lineWidth = TILE * 0.08;

    for (const river of rivers) {
      if (river.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(river[0].x * TILE + TILE / 2, river[0].y * TILE + TILE / 2);
      for (let i = 1; i < river.length; i++) {
        ctx.lineTo(river[i].x * TILE + TILE / 2, river[i].y * TILE + TILE / 2);
      }
      ctx.stroke();
    }
  }

  // ── Roads ─────────────────────────────────────────────────────
  drawRoads(ctx, roads, TILE) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dış çizgi (kum rengi, geniş)
    ctx.strokeStyle = '#c4a97e';
    ctx.lineWidth = TILE * 0.14;

    for (const road of roads) {
      if (!road.path || road.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(road.path[0].x * TILE + TILE / 2, road.path[0].y * TILE + TILE / 2);
      for (let i = 1; i < road.path.length; i++) {
        ctx.lineTo(road.path[i].x * TILE + TILE / 2, road.path[i].y * TILE + TILE / 2);
      }
      ctx.stroke();
    }

    // İç çizgi (koyu kahve, dar)
    ctx.strokeStyle = '#7a5c35';
    ctx.lineWidth = TILE * 0.06;

    for (const road of roads) {
      if (!road.path || road.path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(road.path[0].x * TILE + TILE / 2, road.path[0].y * TILE + TILE / 2);
      for (let i = 1; i < road.path.length; i++) {
        ctx.lineTo(road.path[i].x * TILE + TILE / 2, road.path[i].y * TILE + TILE / 2);
      }
      ctx.stroke();
    }
  }

  // ── Settlements ───────────────────────────────────────────────
  drawSettlement(ctx, settlement, TILE) {
    const cx = settlement.x * TILE + TILE / 2;
    const cy = settlement.y * TILE + TILE / 2;

    const factionColor = this.getFactionColor(settlement.owner);
    const type = settlement.type;

    ctx.save();

    // Glow efekti
    ctx.shadowColor = factionColor;
    ctx.shadowBlur = type === 'city' ? 14 : 8;

    if (type === 'city') {
      const half = TILE * 0.40;
      // Gölge
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(cx - half + 3, cy - half + 3, half * 2, half * 2);
      // Ana dolgu
      ctx.fillStyle = factionColor;
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      // Dış kenarlık
      ctx.strokeStyle = shade(factionColor, 0.35);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
      // İç surlar (şehir sembolü)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      const inner = half * 0.52;
      ctx.strokeRect(cx - inner, cy - inner, inner * 2, inner * 2);

    } else if (type === 'town') {
      const half = TILE * 0.28;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(cx - half + 2, cy - half + 2, half * 2, half * 2);
      ctx.fillStyle = factionColor;
      ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
      ctx.strokeStyle = shade(factionColor, 0.30);
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);

    } else if (type === 'fort') {
      // Kale = döndürülmüş kare (elmas şekli)
      const r = TILE * 0.26;
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      this._drawDiamond(ctx, cx + 2, cy + 2, r);
      ctx.fill();
      ctx.fillStyle = factionColor;
      this._drawDiamond(ctx, cx, cy, r);
      ctx.fill();
      ctx.strokeStyle = shade(factionColor, 0.30);
      ctx.lineWidth = 2;
      this._drawDiamond(ctx, cx, cy, r);
      ctx.stroke();

    } else {
      // Köy = küçük daire
      const r = TILE * 0.20;
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = factionColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(factionColor, 0.28);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    // İsim etiketi (gölgeli, oyun fontu)
    const labelY = cy + (type === 'city' ? TILE * 0.40 : type === 'town' ? TILE * 0.28 : TILE * 0.20) + 13;
    ctx.textAlign = 'center';
    ctx.font = "bold 10px 'Cinzel', serif";
    ctx.fillStyle = 'rgba(0,0,0,0.80)';
    ctx.fillText(settlement.name, cx + 1, labelY + 1);
    ctx.fillStyle = 'rgba(255,248,220,0.97)';
    ctx.fillText(settlement.name, cx, labelY);
  }

  /** Elmas (döndürülmüş kare) path helper */
  _drawDiamond(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  }

  // ── AI Parties ────────────────────────────────────────────────
  drawAIParty(ctx, party, TILE) {
    const cx = party.x * TILE + TILE / 2;
    const cy = party.y * TILE + TILE / 2;
    const r = TILE * 0.25;
    const color = this.getFactionColor(party.faction);

    // Gölge
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
    ctx.fill();

    // Ana daire
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Çapraz kılıç ikonu (güç göstergesi yerine)
    const s = r * 0.52;
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx + s, cy + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + s, cy - s);
    ctx.lineTo(cx - s, cy + s);
    ctx.stroke();
  }

  // ── Player ────────────────────────────────────────────────────
  drawPlayer(ctx, player, TILE) {
    const cx = player.x * TILE + TILE / 2;
    const cy = player.y * TILE + TILE / 2;
    const r = TILE * 0.35;

    ctx.save();

    // Glow halkası
    ctx.shadowColor = '#ffe066';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ana sarı daire
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Yön oku
    const dx = player.tx - player.x;
    const dy = player.ty - player.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      const angle = Math.atan2(dy, dx);
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(r * 0.82, 0);
      ctx.lineTo(r * 0.35, -r * 0.30);
      ctx.lineTo(r * 0.35, r * 0.30);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // ── Faction colors ────────────────────────────────────────────
  getFactionColor(factionId) {
    const colors = {
      ottoman: '#c0392b',
      hre: '#2c3e50',
      polish: '#e74c3c',
      spanish: '#f1c40f',
      venice: '#16a085',
      bandit: '#6d4c41',
    };

    return colors[factionId] || '#808080';
  }
}

export default MapRenderer;
