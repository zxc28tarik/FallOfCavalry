/**
 * FallOfCavalry - Canvas Renderer
 * Ana render koordinatörü
 */

import MapRenderer from './map-renderer.js';
import CityRenderer from './city-renderer.js';
import BattleRenderer from './battle-renderer.js';
import {
  initWeatherLayer,
  setWeatherState,
  tickWeatherLayer,
  renderWeatherOverlay,
} from './weather-layer.js';
import { getWeatherTint } from '../systems/weather.js';

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

    // Delta-time tracking (weather tick için)
    this._lastRenderTime = CanvasRenderer.now();

    // Hava durumu katmanını başlat
    initWeatherLayer();
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

    // Delta time — weather tick için
    const now = CanvasRenderer.now();
    const dt = Math.min(0.1, (now - this._lastRenderTime) / 1000);
    this._lastRenderTime = now;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // Mevcut hava durumu state'ini weather-layer'a aktar
    if (this.state.weather) {
      setWeatherState(this.state.weather);
    }
    // Partikülleri ilerlet (yağmur/kar)
    tickWeatherLayer(dt, w, h);

    // Clear
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, w, h);

    // Render based on mode
    switch (this.state.mode) {
      case 'start':
        this.renderStart();
        break;
      case 'map':
        this.mapRenderer.render(this.ctx, this.state);
        this._renderWeather(w, h);
        break;
      case 'city':
        // Şehir iç mekânda hava yok — sadece gece/gündüz tint
        this.cityRenderer.render(this.ctx, this.state);
        break;
      case 'battle':
        this.battleRenderer.render(this.ctx, this.state);
        this._renderWeather(w, h);
        break;
      case 'encounter':
        this.renderEncounter();
        this._renderWeather(w, h);
        break;
      case 'roster':
        this.renderRoster();
        break;
    }

    // FPS counter
    this.updateFPS();
  }

  /** Hava durumu overlay'ini canvas üzerine uygula */
  _renderWeather(w, h) {
    const tint = getWeatherTint(this.state.weather);
    renderWeatherOverlay(this.ctx, w, h, tint);
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
    bg.addColorStop(0, '#060a05');
    bg.addColorStop(0.42, '#0d1408');
    bg.addColorStop(1, '#09100a');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, w, h);

    // Ağaç silüetleri — sol ve sağ kenar
    this._drawForestEdge(this.ctx, w, h);

    // Merkezi sis
    const mist = this.ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w * 0.45);
    mist.addColorStop(0, 'rgba(60,80,50,0.18)');
    mist.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = mist;
    this.ctx.fillRect(0, 0, w, h);

    // Vignette
    const vig = this.ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.62);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.82)');
    this.ctx.fillStyle = vig;
    this.ctx.fillRect(0, 0, w, h);
  }

  /** Encounter ekranı için sol+sağ ağaç perdesi */
  _drawForestEdge(ctx, w, h) {
    // Sol kenar
    ctx.fillStyle = 'rgba(14,22,10,0.88)';
    this._forestColumn(ctx, 0, w, h, 5, 0.22);
    // Sağ kenar
    this._forestColumn(ctx, w, w, h, 6, 0.20);
  }

  _forestColumn(ctx, originX, w, h, count, widthRatio) {
    const colW = w * widthRatio;
    const isRight = originX === w;
    const rng = this._encounterRng || (this._encounterRng = this._makeLCG(0xfade1234));

    for (let i = 0; i < count; i++) {
      const bw = colW * (0.55 + rng() * 0.55);
      const bh = h * (0.45 + rng() * 0.45);
      const bx = isRight ? w - bw * (0.3 + rng() * 0.7) : bw * (rng() * 0.5 - 0.3);

      ctx.fillStyle = `rgba(${10 + (rng() * 8) | 0},${18 + (rng() * 10) | 0},${8 + (rng() * 6) | 0},0.90)`;
      // Ağaç gövdesi
      ctx.beginPath();
      ctx.moveTo(bx, h);
      ctx.lineTo(bx + bw * 0.5, h - bh);
      ctx.lineTo(bx + bw, h);
      ctx.closePath();
      ctx.fill();
    }
  }

  _makeLCG(seed) {
    let s = seed >>> 0;
    return () => {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    };
  }

  renderRoster() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Koyu mavi-gece (savaş hazırlık)
    const bg = this.ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#07090f');
    bg.addColorStop(0.6, '#0b0d16');
    bg.addColorStop(1, '#050709');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, w, h);

    // Ufuk çizgisi
    const horizon = h * 0.60;
    const horizGrad = this.ctx.createLinearGradient(0, horizon - 20, 0, horizon + 30);
    horizGrad.addColorStop(0, 'rgba(0,0,0,0)');
    horizGrad.addColorStop(0.5, 'rgba(50,40,20,0.22)');
    horizGrad.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = horizGrad;
    this.ctx.fillRect(0, horizon - 20, w, 50);

    // Altın merkez parlaması (savaş hazırlığı hissi)
    const glow = this.ctx.createRadialGradient(w / 2, h * 0.44, 0, w / 2, h * 0.44, w * 0.52);
    glow.addColorStop(0, 'rgba(212,175,55,0.07)');
    glow.addColorStop(0.5,'rgba(180,140,40,0.03)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, w, h);

    // Ağır vignette
    const vig = this.ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.70);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.78)');
    this.ctx.fillStyle = vig;
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
