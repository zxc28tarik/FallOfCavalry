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

    // Start ekranı partikülleri (lazy init, canvas boyutu gerektirir)
    this._startStars   = null;
    this._startEmbers  = null;
    // Encounter ormanı (lazy init)
    this._encForestTrees  = null;
    this._encounterStars  = null;
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

    // Start ekranı ember tick
    if (this.state.mode === 'start' && this._startEmbers) {
      this._tickEmbers(this._startEmbers, dt, w, h);
    }

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
    const t = CanvasRenderer.now() / 1000;

    // Lazy init
    if (!this._startStars)  this._startStars  = this._buildStartStars(w, h);
    if (!this._startEmbers) this._startEmbers = this._buildEmbers(w, h);

    // ── Gece gökyüzü ──────────────────────────────────────────────
    const sky = this.ctx.createLinearGradient(0, 0, 0, h * 0.65);
    sky.addColorStop(0,   '#02030a');
    sky.addColorStop(0.5, '#080c18');
    sky.addColorStop(1,   '#0f1020');
    this.ctx.fillStyle = sky;
    this.ctx.fillRect(0, 0, w, h);

    // ── Yıldızlar ──────────────────────────────────────────────────
    for (const s of this._startStars) {
      const tw = 0.80 + 0.20 * Math.sin(t * s.speed + s.twinkle);
      this.ctx.fillStyle = `rgba(255,255,255,${(s.a * tw).toFixed(2)})`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ── Ay (hilal) ────────────────────────────────────────────────
    const moonX = w * 0.78, moonY = h * 0.13;
    const moonR = Math.min(w, h) * 0.048;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(220,195,130,0.50)';
    this.ctx.shadowBlur = moonR * 2.2;
    this.ctx.fillStyle = '#f0e6c0';
    this.ctx.beginPath();
    this.ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    this.ctx.fill();
    // Hilal gölgesi
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#03040e';
    this.ctx.beginPath();
    this.ctx.arc(moonX + moonR * 0.38, moonY - moonR * 0.22, moonR * 0.80, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // ── Bulutumsu sis (ay çevresinde) ─────────────────────────────
    const halo = this.ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 4.5);
    halo.addColorStop(0, 'rgba(200,180,100,0.06)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = halo;
    this.ctx.fillRect(moonX - moonR * 5, moonY - moonR * 5, moonR * 10, moonR * 10);

    // ── Zemin / yayla ─────────────────────────────────────────────
    const horizonY = h * 0.64;
    const ground = this.ctx.createLinearGradient(0, horizonY, 0, h);
    ground.addColorStop(0, '#0c0e08');
    ground.addColorStop(1, '#06080a');
    this.ctx.fillStyle = ground;
    this.ctx.fillRect(0, horizonY, w, h - horizonY);

    // ── Kale silüeti ──────────────────────────────────────────────
    this._drawCastleSilhouette(this.ctx, w, h, horizonY);

    // ── Tepedeki ateş parlaması (kale arkasında) ──────────────────
    const fireX = w * 0.63, fireY = horizonY - h * 0.22;
    const fireGlow = this.ctx.createRadialGradient(fireX, fireY, 0, fireX, fireY, w * 0.12);
    const flk = 0.55 + 0.12 * Math.sin(t * 3.7) + 0.08 * Math.cos(t * 6.1);
    fireGlow.addColorStop(0,   `rgba(255,150,40,${(0.28 * flk).toFixed(2)})`);
    fireGlow.addColorStop(0.5, `rgba(200,80,20,${(0.10 * flk).toFixed(2)})`);
    fireGlow.addColorStop(1,   'rgba(0,0,0,0)');
    this.ctx.fillStyle = fireGlow;
    this.ctx.fillRect(fireX - w * 0.12, fireY - h * 0.12, w * 0.24, h * 0.20);

    // ── Ufuk sis bandı ────────────────────────────────────────────
    const mist = this.ctx.createLinearGradient(0, horizonY - 20, 0, horizonY + 40);
    mist.addColorStop(0, 'rgba(0,0,0,0)');
    mist.addColorStop(0.4, 'rgba(12,16,10,0.45)');
    mist.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.fillStyle = mist;
    this.ctx.fillRect(0, horizonY - 20, w, 60);

    // ── Kor partikülleri (ateşten yükselen) ──────────────────────
    for (const e of this._startEmbers) {
      const alpha = Math.max(0, Math.min(0.9, e.life * 0.9));
      this.ctx.fillStyle = `rgba(255,${(140 + e.hue * 2) | 0},40,${alpha.toFixed(2)})`;
      this.ctx.beginPath();
      this.ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // ── Alt karartma ──────────────────────────────────────────────
    const shadow = this.ctx.createLinearGradient(0, h * 0.70, 0, h);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.70)');
    this.ctx.fillStyle = shadow;
    this.ctx.fillRect(0, h * 0.70, w, h * 0.30);

    // ── Vignette ──────────────────────────────────────────────────
    const vig = this.ctx.createRadialGradient(w / 2, h * 0.50, w * 0.10, w / 2, h * 0.50, w * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.68)');
    this.ctx.fillStyle = vig;
    this.ctx.fillRect(0, 0, w, h);
  }

  /** Kale + tepe silüeti */
  _drawCastleSilhouette(ctx, w, h, horizonY) {
    ctx.fillStyle = '#080a06';

    // Tepeler
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, horizonY + h * 0.06);
    ctx.quadraticCurveTo(w * 0.14, horizonY - h * 0.04, w * 0.28, horizonY + h * 0.01);
    ctx.quadraticCurveTo(w * 0.42, horizonY - h * 0.09, w * 0.56, horizonY - h * 0.01);
    ctx.quadraticCurveTo(w * 0.72, horizonY - h * 0.06, w * 0.88, horizonY + h * 0.01);
    ctx.lineTo(w, horizonY + h * 0.03);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Kale ana gövdesi
    const cx = w * 0.62, cy = horizonY - h * 0.06;
    // Ana duvar
    ctx.fillRect(cx - w * 0.08, cy - h * 0.085, w * 0.16, h * 0.085);
    // Sol kule
    ctx.fillRect(cx - w * 0.094, cy - h * 0.15, w * 0.040, h * 0.15);
    // Sağ kule
    ctx.fillRect(cx + w * 0.054, cy - h * 0.14, w * 0.040, h * 0.14);
    // Merkez şato (ana kule)
    ctx.fillRect(cx - w * 0.034, cy - h * 0.20, w * 0.068, h * 0.20);

    // Mazgallar (sol kule)
    for (let i = 0; i < 3; i++) {
      ctx.clearRect(cx - w * 0.094 + w * 0.007 + i * w * 0.011, cy - h * 0.162, w * 0.007, h * 0.016);
    }
    // Mazgallar (ana kule)
    for (let i = 0; i < 4; i++) {
      ctx.clearRect(cx - w * 0.034 + w * 0.005 + i * w * 0.013, cy - h * 0.212, w * 0.008, h * 0.016);
    }

    // Kapı kemeri
    ctx.fillStyle = '#03040a';
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.026, w * 0.020, Math.PI, 0);
    ctx.rect(cx - w * 0.020, cy - h * 0.026, w * 0.040, h * 0.026);
    ctx.fill();
    ctx.fillStyle = '#080a06';

    // Bayrak
    ctx.fillStyle = '#7a1515';
    ctx.beginPath();
    ctx.moveTo(cx, cy - h * 0.20);
    ctx.lineTo(cx + w * 0.027, cy - h * 0.194);
    ctx.lineTo(cx + w * 0.024, cy - h * 0.182);
    ctx.lineTo(cx, cy - h * 0.176);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2e1206';
    ctx.fillRect(cx - 1, cy - h * 0.226, 2, h * 0.052);
  }

  /** Yıldız dizisi (lazy init) */
  _buildStartStars(w, h) {
    const rng = this._makeLCG(0xABCD1234);
    return Array.from({ length: 130 }, () => ({
      x: rng() * w,
      y: rng() * h * 0.62,
      r: 0.3 + rng() * 1.5,
      a: 0.25 + rng() * 0.75,
      twinkle: rng() * Math.PI * 2,
      speed: 0.6 + rng() * 2.2,
    }));
  }

  /** Kor partikülleri (lazy init) */
  _buildEmbers(w, h) {
    const rng = this._makeLCG(0xE5BEAD);
    return Array.from({ length: 32 }, () => ({
      x:       w * 0.55 + (rng() - 0.5) * w * 0.22,
      y:       h * (0.55 + rng() * 0.30),
      vx:      (rng() - 0.5) * 22,
      vy:      -(28 + rng() * 55),
      life:    rng(),
      maxLife: 2 + rng() * 3.5,
      r:       0.7 + rng() * 1.8,
      hue:     10 + (rng() * 22) | 0,
    }));
  }

  /** Kor partikülleri güncelle */
  _tickEmbers(embers, dt, w, h) {
    for (const e of embers) {
      e.x    += e.vx * dt;
      e.y    += e.vy * dt;
      e.vx   += (Math.random() - 0.5) * 10 * dt;
      e.life -= dt / e.maxLife;
      if (e.life <= 0 || e.y < 0) {
        e.x       = w * 0.55 + (Math.random() - 0.5) * w * 0.22;
        e.y       = h * (0.62 + Math.random() * 0.20);
        e.vx      = (Math.random() - 0.5) * 22;
        e.vy      = -(28 + Math.random() * 55);
        e.life    = 0.4 + Math.random() * 0.6;
        e.maxLife = 2 + Math.random() * 3.5;
        e.r       = 0.7 + Math.random() * 1.8;
      }
    }
  }

  renderEncounter() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // ── Gece gökyüzü ──────────────────────────────────────────────
    const bg = this.ctx.createLinearGradient(0, 0, 0, h * 0.58);
    bg.addColorStop(0, '#030605');
    bg.addColorStop(0.5, '#08100a');
    bg.addColorStop(1,  '#0d1610');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, w, h);

    // ── Yıldızlar (pencereleme) ────────────────────────────────────
    if (!this._encounterStars) {
      const rng = this._makeLCG(0xF0FE5733);
      this._encounterStars = Array.from({ length: 42 }, () => ({
        x: rng() * w,
        y: rng() * h * 0.38,
        r: 0.35 + rng() * 1.1,
        a: 0.18 + rng() * 0.52,
      }));
    }
    this.ctx.globalAlpha = 0.85;
    for (const s of this._encounterStars) {
      this.ctx.fillStyle = `rgba(230,242,225,${s.a.toFixed(2)})`;
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;

    // ── Ay (sickle) ───────────────────────────────────────────────
    const mx = w * 0.18, my = h * 0.13;
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(170,220,155,0.38)';
    this.ctx.shadowBlur = 28;
    this.ctx.fillStyle = '#e2f0d8';
    this.ctx.beginPath();
    this.ctx.arc(mx, my, 17, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = '#050e07';
    this.ctx.beginPath();
    this.ctx.arc(mx + 8, my - 4, 13.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // ── Ay ışığı şeridi (ağaçlar arasından) ──────────────────────
    const rayGrad = this.ctx.createLinearGradient(mx, my, w * 0.52, h * 0.78);
    rayGrad.addColorStop(0,   'rgba(180,230,160,0.07)');
    rayGrad.addColorStop(0.5, 'rgba(180,230,160,0.04)');
    rayGrad.addColorStop(1,   'rgba(0,0,0,0)');
    this.ctx.fillStyle = rayGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(mx - 8, my + 10);
    this.ctx.lineTo(w * 0.60, h * 0.85);
    this.ctx.lineTo(w * 0.44, h * 0.85);
    this.ctx.closePath();
    this.ctx.fill();

    // ── Zemin (toprak) ────────────────────────────────────────────
    const horizonY = h * 0.62;
    const ground = this.ctx.createLinearGradient(0, horizonY, 0, h);
    ground.addColorStop(0, '#0b120a');
    ground.addColorStop(1, '#050802');
    this.ctx.fillStyle = ground;
    this.ctx.fillRect(0, horizonY, w, h - horizonY);

    // ── Çamur/kir patika (merkez) ─────────────────────────────────
    this.ctx.fillStyle = 'rgba(40,30,16,0.55)';
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.40, h);
    this.ctx.lineTo(w * 0.47, horizonY + 4);
    this.ctx.lineTo(w * 0.53, horizonY + 4);
    this.ctx.lineTo(w * 0.60, h);
    this.ctx.closePath();
    this.ctx.fill();

    // ── Orman (3 derinlik katmanı) ────────────────────────────────
    this._drawEncounterForest(this.ctx, w, h, horizonY);

    // ── Zemin sisi ────────────────────────────────────────────────
    const fogGrad = this.ctx.createLinearGradient(0, horizonY - 8, 0, horizonY + 55);
    fogGrad.addColorStop(0,   'rgba(0,0,0,0)');
    fogGrad.addColorStop(0.4, 'rgba(25,42,20,0.30)');
    fogGrad.addColorStop(1,   'rgba(0,0,0,0)');
    this.ctx.fillStyle = fogGrad;
    this.ctx.fillRect(0, horizonY - 8, w, 65);

    // ── Vignette ──────────────────────────────────────────────────
    const vig = this.ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.60);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.90)');
    this.ctx.fillStyle = vig;
    this.ctx.fillRect(0, 0, w, h);
  }

  /** Derinlikli orman katmanları (arka→ön sıralamalı) */
  _drawEncounterForest(ctx, w, h, horizonY) {
    if (!this._encForestTrees) {
      const rng = this._makeLCG(0x0AE1D234);
      this._encForestTrees = Array.from({ length: 52 }, () => ({
        rx:   rng(),
        layer: (rng() * 3) | 0,   // 0=uzak 1=orta 2=yakın
        rh:   0.20 + rng() * 0.36,
        rw:   0.04 + rng() * 0.09,
        hasTrunk: rng() > 0.45,
      })).sort((a, b) => a.layer - b.layer);
    }

    // Katman renkleri: uzak (soluk) → yakın (koyu)
    const COLS = [
      'rgba(10,22,8,0.65)',
      'rgba(7,16,5,0.82)',
      'rgba(4,10,3,0.97)',
    ];

    for (const tree of this._encForestTrees) {
      const tx = tree.rx * w;
      const th = tree.rh * h;
      const tw = tree.rw * w;
      ctx.fillStyle = COLS[tree.layer];

      // Alt taç (geniş)
      ctx.beginPath();
      ctx.moveTo(tx, horizonY - th);
      ctx.lineTo(tx + tw * 0.60, horizonY - th * 0.48);
      ctx.lineTo(tx + tw, horizonY);
      ctx.lineTo(tx - tw, horizonY);
      ctx.lineTo(tx - tw * 0.60, horizonY - th * 0.48);
      ctx.closePath();
      ctx.fill();

      // Üst taç (dar, sivri)
      ctx.beginPath();
      ctx.moveTo(tx, horizonY - th * 1.22);
      ctx.lineTo(tx + tw * 0.44, horizonY - th * 0.70);
      ctx.lineTo(tx - tw * 0.44, horizonY - th * 0.70);
      ctx.closePath();
      ctx.fill();

      // Gövde (sadece yakın katman)
      if (tree.hasTrunk && tree.layer === 2) {
        ctx.fillStyle = 'rgba(18,10,5,0.95)';
        ctx.fillRect(tx - tw * 0.06, horizonY - th * 0.09, tw * 0.12, th * 0.09);
        ctx.fillStyle = COLS[2];
      }
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
