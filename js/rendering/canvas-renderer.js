/**
 * FallOfCavalry - Canvas Renderer
 * Ana render koordinatörü
 */

import MapRenderer from './map-renderer.js';
import CityRenderer from './city-renderer.js';
import BattleRenderer from './battle-renderer.js';

export class CanvasRenderer {
  constructor(canvas, state) {
    this.warnedKeys = new Set();
    this.canvas = canvas || null;
    this.ctx = this.getContext2D(this.canvas);
    this.state = state;
    
    // Sub-renderers
    this.mapRenderer = new MapRenderer();
    this.cityRenderer = new CityRenderer();
    this.battleRenderer = new BattleRenderer();
    
    // Performance
    this.frameCount = 0;
    this.lastFpsUpdate = CanvasRenderer.now();
  }

  static now() {
    if (typeof globalThis.performance?.now === 'function') {
      return globalThis.performance.now();
    }

    return Date.now();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    console.warn(message);
  }

  getContext2D(canvas) {
    if (!canvas) {
      this?.warnOnce?.('missing-canvas', '[CanvasRenderer] Missing canvas element');
      return null;
    }

    if (typeof canvas.getContext !== 'function') {
      this?.warnOnce?.('missing-getContext', '[CanvasRenderer] Canvas getContext unavailable');
      return null;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this?.warnOnce?.('null-context', '[CanvasRenderer] Canvas 2D context unavailable');
      return null;
    }

    return ctx;
  }
  
  render() {
    if (!this.ctx || !this.canvas) return;

    // Clear
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Render based on mode
    switch (this.state.mode) {
      case 'start':
        this.renderStart();
        break;
      case 'map':
        this.mapRenderer.render(this.ctx, this.state);
        break;
      case 'city':
        this.cityRenderer.render(this.ctx, this.state);
        break;
      case 'battle':
        this.battleRenderer.render(this.ctx, this.state);
        break;
      case 'encounter':
        this.renderEncounter();
        break;
      case 'roster':
        this.renderRoster();
        break;
    }
    
    // FPS counter
    this.updateFPS();
  }
  
  renderStart() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Koyu altın-gece gradyanı (ana menü arkası)
    const bg = this.ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.70);
    bg.addColorStop(0, '#1e1608');
    bg.addColorStop(0.55, '#0e0d0a');
    bg.addColorStop(1, '#05050a');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, w, h);

    // Alt sis
    const mist = this.ctx.createLinearGradient(0, h * 0.65, 0, h);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(1, 'rgba(0,0,0,0.60)');
    this.ctx.fillStyle = mist;
    this.ctx.fillRect(0, h * 0.65, w, h * 0.35);
  }

  renderEncounter() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Koyu orman atmosferi
    const bg = this.ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#090d07');
    bg.addColorStop(0.5, '#0f1409');
    bg.addColorStop(1, '#0b0e07');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, w, h);

    // Vignette
    const vig = this.ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.65);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.75)');
    this.ctx.fillStyle = vig;
    this.ctx.fillRect(0, 0, w, h);
  }

  renderRoster() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Koyu mavi-gece (savaş hazırlık)
    const bg = this.ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#090c12');
    bg.addColorStop(1, '#06080d');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, w, h);

    // Merkez aydınlatma
    const glow = this.ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.5);
    glow.addColorStop(0, 'rgba(212,175,55,0.06)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, w, h);
  }

  updateFPS() {
    if (!this.state?.debug) return;

    this.frameCount++;
    const now = CanvasRenderer.now();
    
    if (now - this.lastFpsUpdate >= 1000) {
      this.state.debug.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }
  
  resize(width, height) {
    if (!this.canvas) return;

    const safeWidth = Number.isFinite(width) ? width : null;
    const safeHeight = Number.isFinite(height) ? height : null;
    if (safeWidth === null || safeHeight === null) return;

    const ratio = Number.isFinite(globalThis.window?.devicePixelRatio)
      ? globalThis.window.devicePixelRatio
      : 1;

    this.canvas.width = safeWidth * ratio;
    this.canvas.height = safeHeight * ratio;
  }
}

export default CanvasRenderer;
