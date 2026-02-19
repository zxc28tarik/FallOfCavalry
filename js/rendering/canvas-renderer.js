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
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '48px "Cinzel", serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FallOfCavalry', this.canvas.width / 2, this.canvas.height / 2);
    
    this.ctx.font = '24px "Crimson Text", serif';
    this.ctx.fillText('Grand Strategy', this.canvas.width / 2, this.canvas.height / 2 + 60);
  }
  
  renderEncounter() {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const enemyId = this.state?.encounter?.enemyId ?? 'unknown';
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '40px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Encounter!', this.canvas.width / 2, this.canvas.height / 2 - 20);
    this.ctx.font = '22px Arial';
    this.ctx.fillText(`Enemy: ${enemyId}`, this.canvas.width / 2, this.canvas.height / 2 + 18);
    this.ctx.font = '18px Arial';
    this.ctx.fillText('F = Battle Prep, C = Continue', this.canvas.width / 2, this.canvas.height / 2 + 56);
  }

  renderRoster() {
    this.ctx.fillStyle = '#121212';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Battle Prep', this.canvas.width / 2, 72);
    this.ctx.font = '18px Arial';
    this.ctx.fillText('Up/Down Move · Space Toggle · A Select Max · C Clear · Enter Start · Esc Back', this.canvas.width / 2, 104);
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
