import * as CONST from '../constants.js';
import * as utils from '../utils.js';
import { FLAGS } from '../world/map-data.js';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function blendChannel(base, tint, mix) {
  return Math.round((base * (1 - mix)) + (tint * mix));
}

function buildOwnerColorIndex(factionColors = {}) {
  const byOwnerId = new Map();
  if (!factionColors || typeof factionColors !== 'object') return byOwnerId;
  for (const entry of Object.values(factionColors)) {
    const ownerId = Number(entry?.ownerId);
    const rgb = Array.isArray(entry?.rgb) ? entry.rgb : null;
    if (!Number.isInteger(ownerId) || ownerId <= 0 || !rgb || rgb.length < 3) continue;
    byOwnerId.set(ownerId, {
      r: Math.max(0, Math.min(255, Number(rgb[0]) || 0)),
      g: Math.max(0, Math.min(255, Number(rgb[1]) || 0)),
      b: Math.max(0, Math.min(255, Number(rgb[2]) || 0)),
    });
  }
  return byOwnerId;
}

function setCanvasSize(canvas, width, height) {
  if (!canvas) return { width: 0, height: 0, dpr: 1 };
  const cssWidth = Math.max(120, Math.floor(width));
  const cssHeight = Math.max(120, Math.floor(height));
  const dpr = Math.max(1, Math.min(2, Number(globalThis.devicePixelRatio) || 1));
  const realWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const realHeight = Math.max(1, Math.floor(cssHeight * dpr));
  if (canvas.width !== realWidth) canvas.width = realWidth;
  if (canvas.height !== realHeight) canvas.height = realHeight;
  if (canvas.style) {
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
  return { width: realWidth, height: realHeight, dpr };
}

function resolveMapData(game) {
  const map = game?.state?.map || null;
  if (!map) return { map: null, mapData: null };
  const mapData = map.mapData || map.__mapData || game?.state?.mapData || null;
  return { map, mapData };
}

export class WorldMapOverlay {
  constructor(state) {
    this.state = state;
    this.game = null;
    this.visible = false;
    this.elements = {
      overlay: null,
      canvas: null,
      closeBtn: null,
      toggleBtn: null,
      summary: null,
      footer: null,
    };
    this.cache = {
      mapRef: null,
      plotWidth: 0,
      plotHeight: 0,
      baseCanvas: null,
    };
    this.lastPlotRect = null;
    this.listenersBound = false;
  }

  bind(game, elements = {}) {
    this.game = game || null;
    this.elements = {
      ...this.elements,
      ...elements,
    };

    if (this.listenersBound) return;

    if (this.elements.toggleBtn) {
      this.elements.toggleBtn.addEventListener('click', () => this.toggle());
    }
    if (this.elements.closeBtn) {
      this.elements.closeBtn.addEventListener('click', () => this.toggle(false));
    }
    if (this.elements.overlay) {
      this.elements.overlay.addEventListener('click', (event) => {
        if (event?.target === this.elements.overlay) this.toggle(false);
      });
    }
    if (this.elements.canvas) {
      this.elements.canvas.addEventListener('click', (event) => this.handleCanvasClick(event));
    }
    this.listenersBound = true;
  }

  isVisible() {
    return this.visible;
  }

  setLauncherVisible(isVisible) {
    utils.safeClass(this.elements.toggleBtn, isVisible ? 'remove' : 'add', 'hidden');
  }

  toggle(force = null) {
    const nextVisible = typeof force === 'boolean' ? force : !this.visible;
    this.visible = nextVisible;
    utils.safeClass(this.elements.overlay, nextVisible ? 'remove' : 'add', 'hidden');
    this.setLauncherVisible(!nextVisible && this.state?.mode === 'map');
    if (nextVisible) this.render();
    return this.visible;
  }

  handleCanvasClick(event) {
    if (!this.visible || this.state?.mode !== 'map') return false;
    const canvas = this.elements.canvas;
    const plot = this.lastPlotRect;
    const game = this.game;
    const map = game?.state?.map;
    if (!canvas || !plot || !map || !game?.worldManager) return false;

    const rect = typeof canvas.getBoundingClientRect === 'function'
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0, width: canvas.width, height: canvas.height };
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    const localX = ((event?.clientX ?? 0) - rect.left) * scaleX;
    const localY = ((event?.clientY ?? 0) - rect.top) * scaleY;

    if (
      localX < plot.x
      || localY < plot.y
      || localX > (plot.x + plot.width)
      || localY > (plot.y + plot.height)
    ) {
      return false;
    }

    const nx = clamp01((localX - plot.x) / Math.max(1, plot.width));
    const ny = clamp01((localY - plot.y) / Math.max(1, plot.height));
    const tileSize = Math.max(1, Number(CONST.WORLD?.TILE_SIZE) || 32);
    const camera = game.worldManager.getCameraSafe();
    const worldX = nx * (map.width * tileSize);
    const worldY = ny * (map.height * tileSize);
    const viewW = game.canvas.width / camera.zoom;
    const viewH = game.canvas.height / camera.zoom;

    camera.x = worldX - (viewW * 0.5);
    camera.y = worldY - (viewH * 0.5);
    game.followParty = false;
    game.worldManager.clampCameraToWorld();
    this.render(true);
    return true;
  }

  render(forceBase = false) {
    if (!this.visible) return false;
    const canvas = this.elements.canvas;
    const game = this.game;
    const { map, mapData } = resolveMapData(game);
    if (!canvas || !game || !map) return false;

    const sizing = setCanvasSize(canvas, canvas.clientWidth || 920, canvas.clientHeight || 580);
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(9, 7, 5, 0.96)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const pad = Math.round(18 * sizing.dpr);
    const plotWidth = Math.max(1, canvas.width - (pad * 2));
    const plotHeight = Math.max(1, canvas.height - (pad * 2));
    this.lastPlotRect = { x: pad, y: pad, width: plotWidth, height: plotHeight };

    this.ensureBaseCanvas(map, mapData, plotWidth, plotHeight, forceBase);
    if (this.cache.baseCanvas) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.cache.baseCanvas, pad, pad, plotWidth, plotHeight);
    }

    ctx.strokeStyle = 'rgba(215,177,88,0.86)';
    ctx.lineWidth = Math.max(1, Math.round(2 * sizing.dpr));
    ctx.strokeRect(pad, pad, plotWidth, plotHeight);

    this.drawCameraRect(ctx, map, plotWidth, plotHeight, pad);
    this.drawPlayerMarker(ctx, map, plotWidth, plotHeight, pad);
    this.updateSummary(map);

    ctx.restore();
    return true;
  }

  ensureBaseCanvas(map, mapData, plotWidth, plotHeight, force = false) {
    const mapRef = mapData || map;
    if (
      !force
      && this.cache.mapRef === mapRef
      && this.cache.plotWidth === plotWidth
      && this.cache.plotHeight === plotHeight
      && this.cache.baseCanvas
    ) {
      return;
    }

    const offscreen = typeof document !== 'undefined' && typeof document.createElement === 'function'
      ? document.createElement('canvas')
      : null;
    if (!offscreen) return;

    offscreen.width = plotWidth;
    offscreen.height = plotHeight;
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const image = ctx.createImageData(plotWidth, plotHeight);
    const data = image.data;
    const flags = mapData?.flags instanceof Uint16Array ? mapData.flags : null;
    const politicalOwnerMap = map?.politicalOwnerMap instanceof Uint8Array
      ? map.politicalOwnerMap
      : mapData?.politicalOwnerMap instanceof Uint8Array
        ? mapData.politicalOwnerMap
        : null;
    const ownerColors = buildOwnerColorIndex(mapData?.factionColors || map?.factionColors || {});

    for (let py = 0; py < plotHeight; py += 1) {
      const ty = Math.max(0, Math.min(map.height - 1, Math.floor((py / plotHeight) * map.height)));
      for (let px = 0; px < plotWidth; px += 1) {
        const tx = Math.max(0, Math.min(map.width - 1, Math.floor((px / plotWidth) * map.width)));
        const index = (ty * map.width) + tx;
        let r = 90;
        let g = 126;
        let b = 66;

        const ownerId = politicalOwnerMap ? politicalOwnerMap[index] : 0;
        const ownerColor = ownerId > 0 ? ownerColors.get(ownerId) : null;
        if (ownerColor) {
          r = blendChannel(r, ownerColor.r, 0.58);
          g = blendChannel(g, ownerColor.g, 0.58);
          b = blendChannel(b, ownerColor.b, 0.58);
        }

        if (flags && (flags[index] & FLAGS.FOREST)) {
          r = Math.max(28, Math.round(r * 0.62));
          g = Math.max(54, Math.round(g * 0.74));
          b = Math.max(24, Math.round(b * 0.58));
        }

        const di = (py * plotWidth + px) * 4;
        data[di] = r;
        data[di + 1] = g;
        data[di + 2] = b;
        data[di + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    this.cache.mapRef = mapRef;
    this.cache.plotWidth = plotWidth;
    this.cache.plotHeight = plotHeight;
    this.cache.baseCanvas = offscreen;
  }

  drawCameraRect(ctx, map, plotWidth, plotHeight, pad) {
    const game = this.game;
    const camera = game?.worldManager?.getCameraSafe?.();
    if (!camera || !game?.canvas) return;

    const tileSize = Math.max(1, Number(CONST.WORLD?.TILE_SIZE) || 32);
    const mapWorldW = Math.max(1, map.width * tileSize);
    const mapWorldH = Math.max(1, map.height * tileSize);
    const viewW = game.canvas.width / camera.zoom;
    const viewH = game.canvas.height / camera.zoom;

    const rx = pad + ((camera.x / mapWorldW) * plotWidth);
    const ry = pad + ((camera.y / mapWorldH) * plotHeight);
    const rw = Math.max(2, (viewW / mapWorldW) * plotWidth);
    const rh = Math.max(2, (viewH / mapWorldH) * plotHeight);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 230, 168, 0.92)';
    ctx.lineWidth = Math.max(1, Math.round((Number(globalThis.devicePixelRatio) || 1) * 1.4));
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }

  drawPlayerMarker(ctx, map, plotWidth, plotHeight, pad) {
    const player = this.game?.playerParty;
    if (!player) return;
    const tileSize = Math.max(1, Number(CONST.WORLD?.TILE_SIZE) || 32);
    const mapWorldW = Math.max(1, map.width * tileSize);
    const mapWorldH = Math.max(1, map.height * tileSize);
    const px = pad + ((player.x / mapWorldW) * plotWidth);
    const py = pad + ((player.y / mapWorldH) * plotHeight);

    ctx.save();
    ctx.fillStyle = 'rgba(217, 69, 51, 0.98)';
    ctx.strokeStyle = 'rgba(255, 235, 193, 0.96)';
    ctx.lineWidth = Math.max(1, Math.round((Number(globalThis.devicePixelRatio) || 1) * 1.2));
    ctx.beginPath();
    ctx.arc(px, py, Math.max(3, Math.round((Number(globalThis.devicePixelRatio) || 1) * 3.2)), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  updateSummary(map) {
    const game = this.game;
    const camera = game?.worldManager?.getCameraSafe?.();
    const player = game?.playerParty;
    if (!camera || !map) return;

    const tileSize = Math.max(1, Number(CONST.WORLD?.TILE_SIZE) || 32);
    const playerTx = player ? Math.max(0, Math.min(map.width - 1, Math.floor(player.x / tileSize))) : 0;
    const playerTy = player ? Math.max(0, Math.min(map.height - 1, Math.floor(player.y / tileSize))) : 0;
    const summary = `Oyuncu: ${playerTx},${playerTy}   Zoom: x${camera.zoom.toFixed(2)}   Harita: ${map.width}x${map.height}`;
    const footer = 'M: ac/kapa  |  Esc: kapat  |  Harita icinde tik: kamerayi o noktaya ortala';
    utils.safeText(this.elements.summary, summary);
    utils.safeText(this.elements.footer, footer);
  }
}

export default WorldMapOverlay;
