/**
 * FallOfCavalry - Minimap Renderer
 */

import * as CONST from '../constants.js';

export class Minimap {
  constructor(canvasElement = null) {
    this.canvas = canvasElement;
    this.ctx = this.canvas?.getContext?.('2d') || null;

    this.baseCanvas = null;
    this.baseCtx = null;
    this.fogCanvas = null;
    this.fogCtx = null;

    this.baseRevision = null;
    this.lastFogDataRef = null;
    this.lastFogHash = '';
    this.warned = false;
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas?.getContext?.('2d') || null;
  }

  ensureBuffers(width, height) {
    if (!this.canvas || !this.ctx) return false;

    const makeBuffer = (w, h) => {
      if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
      if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      }
      return null;
    };

    if (!this.baseCanvas || this.baseCanvas.width !== width || this.baseCanvas.height !== height) {
      this.baseCanvas = makeBuffer(width, height);
      this.baseCtx = this.baseCanvas?.getContext?.('2d') || null;
      this.baseRevision = null;
    }

    if (!this.fogCanvas || this.fogCanvas.width !== width || this.fogCanvas.height !== height) {
      this.fogCanvas = makeBuffer(width, height);
      this.fogCtx = this.fogCanvas?.getContext?.('2d') || null;
      this.lastFogDataRef = null;
      this.lastFogHash = '';
    }

    return Boolean(this.baseCtx && this.fogCtx);
  }

  getMapRevision(map) {
    const width = map?.width || 0;
    const height = map?.height || 0;
    const tileCount = Array.isArray(map?.tiles) ? map.tiles.length : 0;
    const roads = Array.isArray(map?.roads) ? map.roads.length : 0;
    const rivers = Array.isArray(map?.rivers) ? map.rivers.length : 0;
    const crossings = Array.isArray(map?.crossings) ? map.crossings.length : 0;
    const settlements = Array.isArray(map?.settlements) ? map.settlements.length : 0;
    return `${width}:${height}:${tileCount}:${roads}:${rivers}:${crossings}:${settlements}`;
  }

  getFogHash(fog, mapWidth, mapHeight) {
    if (!fog || !mapWidth || !mapHeight) return '';
    const points = [0, Math.floor((mapWidth * mapHeight) * 0.1), Math.floor((mapWidth * mapHeight) * 0.33), Math.floor((mapWidth * mapHeight) * 0.66), (mapWidth * mapHeight) - 1];
    let hash = '';
    for (const idx of points) {
      if (idx < 0 || idx >= fog.length) continue;
      hash += `${fog[idx] || 0}|`;
    }
    return hash;
  }

  render(game) {
    if (!game || !this.canvas || !this.ctx || !game.state?.map) return;

    const map = game.state.map;
    const width = this.canvas.width;
    const height = this.canvas.height;

    if (!this.ensureBuffers(width, height)) {
      if (!this.warned) {
        this.warned = true;
        console.warn('[Minimap] Offscreen buffers unavailable');
      }
      return;
    }

    const revision = this.getMapRevision(map);
    if (revision !== this.baseRevision) {
      this.renderBase(map, width, height);
      this.baseRevision = revision;
      this.lastFogDataRef = null;
      this.lastFogHash = '';
    }

    this.renderFogLayer(map, width, height);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(this.baseCanvas, 0, 0);
    this.ctx.drawImage(this.fogCanvas, 0, 0);
    this.renderDynamic(game, width, height);
  }

  renderBase(map, w, h) {
    const ctx = this.baseCtx;
    if (!ctx) return;

    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / Math.max(1, map.width);
    const scaleY = h / Math.max(1, map.height);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles?.[y * map.width + x];
        if (!tile) continue;
        ctx.fillStyle = CONST.BIOME.COLORS[tile.biome] || this.getTileColor(tile.type);
        ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    ctx.strokeStyle = '#7d5f3e';
    ctx.lineWidth = 1;
    for (const road of map.roads || []) {
      if (!road?.path?.length) continue;
      ctx.beginPath();
      ctx.moveTo((road.path[0].x + 0.5) * scaleX, (road.path[0].y + 0.5) * scaleY);
      for (let i = 1; i < road.path.length; i++) ctx.lineTo((road.path[i].x + 0.5) * scaleX, (road.path[i].y + 0.5) * scaleY);
      ctx.stroke();
    }

    ctx.strokeStyle = '#2f79bf';
    for (const river of map.rivers || []) {
      if (!Array.isArray(river) || river.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo((river[0].x + 0.5) * scaleX, (river[0].y + 0.5) * scaleY);
      for (let i = 1; i < river.length; i++) ctx.lineTo((river[i].x + 0.5) * scaleX, (river[i].y + 0.5) * scaleY);
      ctx.stroke();
    }

    for (const settlement of map.settlements || []) {
      const px = settlement.x * scaleX;
      const py = settlement.y * scaleY;
      ctx.fillStyle = this.getFactionColor(settlement.owner);
      ctx.fillRect(px - 1, py - 1, 3, 3);
    }
  }

  renderFogLayer(map, w, h) {
    const ctx = this.fogCtx;
    if (!ctx) return;

    const fog = map.fog;
    const fogHash = this.getFogHash(fog, map.width, map.height);
    if (fog === this.lastFogDataRef && fogHash === this.lastFogHash) return;

    ctx.clearRect(0, 0, w, h);
    if (!fog) {
      this.lastFogDataRef = fog;
      this.lastFogHash = fogHash;
      return;
    }

    const scaleX = w / Math.max(1, map.width);
    const scaleY = h / Math.max(1, map.height);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const level = fog[idx] ?? 2;
        if (level === 2) continue;
        ctx.fillStyle = level === 1 ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.72)';
        ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    this.lastFogDataRef = fog;
    this.lastFogHash = fogHash;
  }

  renderDynamic(game, w, h) {
    const map = game.state.map;
    const scaleX = w / Math.max(1, map.width * CONST.WORLD.TILE_SIZE);
    const scaleY = h / Math.max(1, map.height * CONST.WORLD.TILE_SIZE);

    for (const party of game.enemyParties || []) {
      if (!party) continue;
      this.ctx.fillStyle = '#d9534f';
      this.ctx.fillRect((party.x * scaleX) - 1, (party.y * scaleY) - 1, 2, 2);
    }

    if (game.playerParty) {
      this.ctx.fillStyle = '#4aa3ff';
      this.ctx.beginPath();
      this.ctx.arc(game.playerParty.x * scaleX, game.playerParty.y * scaleY, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const cam = game.getCameraSafe();
    const vw = ((game.canvas?.width || 800) / Math.max(0.001, cam.zoom)) * scaleX;
    const vh = ((game.canvas?.height || 600) / Math.max(0.001, cam.zoom)) * scaleY;

    this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(cam.x * scaleX, cam.y * scaleY, vw, vh);
  }

  getTileColor(type) {
    const colors = {
      water: '#1a4d6f',
      shore: '#8b7355',
      grass: '#4a6741',
      forest: '#2d4a2b',
      mountain: '#5a524a',
      snow: '#e8e8e8',
    };
    return colors[type] || '#4a6741';
  }

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

  markDirty() {
    this.baseRevision = null;
    this.lastFogDataRef = null;
    this.lastFogHash = '';
  }
}

export default Minimap;
