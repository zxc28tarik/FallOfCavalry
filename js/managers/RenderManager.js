/**
 * RenderManager — Phase 7
 * Canvas render methods extracted from main.js (renderStart, renderEncounter,
 * renderCity, renderDebugInfo, renderWorldTerrain, renderMap, renderWorldOverlays).
 * renderBattle() stays as a delegation wrapper in main.js.
 */

import { isCurrentEventsModalOpen, renderCurrentEventsModal } from '../ui/modals.js';
import * as CONST from '../constants.js';

export class RenderManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
  }

  // ─── 7A: Simple render screens ──────────────────────────────────────────────

  renderStart() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#000';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '48px "Cinzel", serif';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('FallOfCavalry', g.canvas.width / 2, g.canvas.height / 2);
    g.ctx.font = '24px "Crimson Text", serif';
    g.ctx.fillText('Select your faction to begin', g.canvas.width / 2, g.canvas.height / 2 + 60);
  }

  renderEncounter() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;

    g.ctx.fillStyle = '#171717';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);

    const enemyId = this.state?.encounter?.enemyId ?? 'unknown';
    g.ctx.fillStyle = '#ffffff';
    g.ctx.textAlign = 'center';
    g.ctx.font = '40px Arial';
    g.ctx.fillText('Encounter!', g.canvas.width / 2, g.canvas.height / 2 - 20);
    g.ctx.font = '22px Arial';
    g.ctx.fillText(`Enemy: ${enemyId}`, g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.ctx.font = '18px Arial';
    g.ctx.fillText('F = Battle Prep, C = Continue', g.canvas.width / 2, g.canvas.height / 2 + 56);
    if (isCurrentEventsModalOpen()) {
      const currentEvents = g.refreshCurrentEventsSummary(this.state?.day ?? 1);
      renderCurrentEventsModal({ events: currentEvents, currentDay: this.state?.day ?? 1 });
    }
    g.hudManager?.update?.();
  }

  renderCity() {
    const g = this.game;
    if (!g.ctx || !g.canvas) return;
    g.ctx.fillStyle = '#2a2a2a';
    g.ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.ctx.fillStyle = '#fff';
    g.ctx.font = '28px Arial';
    g.ctx.textAlign = 'center';
    g.ctx.fillText('City Services', g.canvas.width / 2, g.canvas.height / 2 - 12);
    g.ctx.font = '16px Arial';
    g.ctx.fillText('R Recruit  T Market  H Healer  |  E/Esc leave city', g.canvas.width / 2, g.canvas.height / 2 + 18);
    g.updateTransientUIState();
  }

  // ─── 7B: World terrain ──────────────────────────────────────────────────────

  renderWorldTerrain(ctx, camera) {
    const g = this.game;
    const map = this.state?.map;
    if (!map || !Array.isArray(map.tiles) || map.tiles.length === 0) return;

    const tileSize = CONST.WORLD.TILE_SIZE;
    const width = Number.isFinite(map.width) ? map.width : CONST.WORLD.MAP_WIDTH;
    const height = Number.isFinite(map.height) ? map.height : CONST.WORLD.MAP_HEIGHT;
    const fog = map.fog instanceof Uint8Array ? map.fog : null;

    const minX = Math.max(0, Math.floor(camera.x / tileSize) - 1);
    const minY = Math.max(0, Math.floor(camera.y / tileSize) - 1);
    const maxX = Math.min(width - 1, Math.ceil((camera.x + (g.canvas.width / camera.zoom)) / tileSize) + 1);
    const maxY = Math.min(height - 1, Math.ceil((camera.y + (g.canvas.height / camera.zoom)) / tileSize) + 1);

    const biomeColors = CONST.BIOME_COLORS || {};
    const biomes = map.biomes instanceof Uint8Array ? map.biomes : null;

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const idx = ty * width + tx;
        const tile = map.tiles[idx];
        const fallbackBiome = tile?.type === CONST.TERRAIN.TYPE.WATER
          ? CONST.BIOME.SEA
          : tile?.type === CONST.TERRAIN.TYPE.SHORE
            ? CONST.BIOME.SHORE
            : tile?.type === CONST.TERRAIN.TYPE.MOUNTAIN
              ? CONST.BIOME.MOUNTAIN
              : tile?.type === CONST.TERRAIN.TYPE.SNOW
                ? CONST.BIOME.SNOW
                : tile?.type === CONST.TERRAIN.TYPE.FOREST
                  ? CONST.BIOME.FOREST
                  : CONST.BIOME.PLAINS;
        const biome = biomes ? biomes[idx] : fallbackBiome;
        ctx.fillStyle = biomeColors[biome] || CONST.WORLD.COLOR_GRASS;
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);

        const fogLevel = fog ? fog[idx] : 2;
        if (fogLevel === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.92)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        } else if (fogLevel === 1) {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
        }
      }
    }

    ctx.lineWidth = Math.max(1, 2 / camera.zoom);
    ctx.strokeStyle = 'rgba(69,116,184,0.9)';
    (map.rivers || []).forEach((river) => {
      if (!Array.isArray(river) || river.length < 2) return;
      ctx.beginPath();
      river.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(161,129,88,0.8)';
    (map.roads || []).forEach((road) => {
      const path = road?.path;
      if (!Array.isArray(path) || path.length < 2) return;
      ctx.beginPath();
      path.forEach((p, i) => {
        const x = (p.x + 0.5) * tileSize;
        const y = (p.y + 0.5) * tileSize;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    (map.pois || []).forEach((poi) => {
      const tx = poi?.x;
      const ty = poi?.y;
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const px = (tx + 0.5) * tileSize;
      const py = (ty + 0.5) * tileSize;
      ctx.strokeStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.fillStyle = fogLevel === 1 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)';
      ctx.lineWidth = Math.max(1, 1.6 / camera.zoom);

      const poiSpriteKey = g.getPoiSpriteKey(poi.type);
      const poiScale = Math.max(0.65, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (g.assetsReady) {
        const drawn = g.spriteLoader?.drawSprite(ctx, poiSpriteKey, px, py, { scale: poiScale, anchor: 'center' });
        if (drawn) return;
      }

      if (poi.type === 'camp') {
        const s = Math.max(4, 8 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px - s * 0.8, py + s * 0.7);
        ctx.lineTo(px + s * 0.8, py + s * 0.7);
        ctx.closePath();
        ctx.stroke();
      } else {
        const s = Math.max(4, 7 / camera.zoom);
        ctx.beginPath();
        ctx.moveTo(px - s, py - s);
        ctx.lineTo(px + s, py + s);
        ctx.moveTo(px + s, py - s);
        ctx.lineTo(px - s, py + s);
        ctx.stroke();
      }
    });

    (map.settlements || []).forEach((settlement) => {
      const tx = Number.isFinite(settlement.tx) ? settlement.tx : Math.floor((settlement.x || 0) / tileSize);
      const ty = Number.isFinite(settlement.ty) ? settlement.ty : Math.floor((settlement.y || 0) / tileSize);
      if (tx < minX || tx > maxX || ty < minY || ty > maxY) return;
      const fogLevel = fog ? fog[ty * width + tx] : 2;
      if (fogLevel === 0) return;
      const sx = Number.isFinite(settlement.x) ? settlement.x : (tx + 0.5) * tileSize;
      const sy = Number.isFinite(settlement.y) ? settlement.y : (ty + 0.5) * tileSize;
      const settlementScale = Math.max(0.75, (1 / camera.zoom) * CONST.SPRITES.MAP_MARKER_SCALE);
      if (g.assetsReady) {
        const drawn = g.spriteLoader?.drawSprite(ctx, 'settlement', sx, sy, { scale: settlementScale, anchor: 'center' });
        if (drawn) return;
      }
      ctx.fillStyle = fogLevel === 1 ? 'rgba(232,196,76,0.65)' : '#e8c44c';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(3, 7 / camera.zoom), 0, Math.PI * 2);
      ctx.fill();
    });

    const clue = this.state?.clueMarker;
    if (clue && Number.isFinite(clue.x) && Number.isFinite(clue.y)) {
      const cx = Number(clue.x);
      const cy = Number(clue.y);
      if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
        const fogLevel = fog ? fog[cy * width + cx] : 2;
        if (fogLevel > 0) {
          const x = (cx + 0.5) * tileSize;
          const y = (cy + 0.5) * tileSize;
          ctx.strokeStyle = fogLevel === 1 ? 'rgba(245,218,96,0.6)' : 'rgba(245,218,96,0.95)';
          ctx.lineWidth = Math.max(1, 2.2 / camera.zoom);
          ctx.beginPath();
          ctx.arc(x, y, Math.max(6, 11 / camera.zoom), 0, Math.PI * 2);
          ctx.stroke();
          if (camera.zoom >= 0.6) {
            ctx.fillStyle = 'rgba(245,218,96,0.95)';
            ctx.font = `${Math.max(10, 12 / camera.zoom)}px Inter`;
            ctx.fillText(String(clue.label || 'İpucu'), x + (10 / camera.zoom), y - (8 / camera.zoom));
          }
        }
      }
    }
  }

  // ─── 7A: Debug overlay ──────────────────────────────────────────────────────

  renderDebugInfo() {
    const g = this.game;
    if (!this.state || !g.input) return;

    const lines = [
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${this.state.player.gold}`,
      `Mouse: (${g.input.mouse.x.toFixed(0)}, ${g.input.mouse.y.toFixed(0)})`,
    ];

    if (g.dom.debugOverlay) {
      const infoEl = g.dom.debugOverlay.querySelector?.('#debugInfo');
      if (infoEl) infoEl.textContent = lines.join('\n');
      else g.dom.debugOverlay.textContent = lines.join('\n');
    }
  }
}
