/**
 * FallOfCavalry - Game Loop
 * Ana oyun döngüsü ve update logic
 * BAĞIMLILIK: state.js, constants.js
 */

import * as CONST from '../constants.js';

/**
 * Game Loop Manager
 */
export class GameLoop {
  constructor(state, input, renderer) {
    this.state = state;
    this.input = input;
    this.renderer = renderer;
    
    this.lastTime = performance.now();
    this.running = false;
    this.rafId = null;
    this.loopToken = 0;
    this.boundTick = this.tick.bind(this);
    this.warnedMissingState = false;
    
    // Update fonksiyonları (game mode'a göre)
    this.updateHandlers = {
      start: this.updateStart.bind(this),
      map: this.updateMap.bind(this),
      city: this.updateCity.bind(this),
      battle: this.updateBattle.bind(this),
      encounter: this.updateEncounter.bind(this),
    };
    
    // Render fonksiyonları
    this.renderHandlers = {
      start: this.renderStart.bind(this),
      map: this.renderMap.bind(this),
      city: this.renderCity.bind(this),
      battle: this.renderBattle.bind(this),
      encounter: this.renderEncounter.bind(this),
    };
  }
  
  // ========================================================================
  // MAIN LOOP
  // ========================================================================
  
  /**
   * Oyun döngüsünü başlat
   */
  start() {
    if (this.running) return;
    if (!this.state) {
      if (!this.warnedMissingState) {
        console.warn('[GameLoop] Cannot start: missing state');
        this.warnedMissingState = true;
      }
      return;
    }
    
    this.running = true;
    this.lastTime = performance.now();
    const token = ++this.loopToken;
    this.rafId = requestAnimationFrame((now) => this.boundTick(now, token));
    
    console.log('[GameLoop] Started');
  }
  
  /**
   * Oyun döngüsünü durdur
   */
  stop() {
    if (!this.running) return;
    
    this.running = false;
    this.loopToken++;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    
    console.log('[GameLoop] Stopped');
  }
  
  /**
   * Ana tick fonksiyonu
   */
  tick(now, token = this.loopToken) {
    if (!this.running || token !== this.loopToken) return;
    if (!this.state) {
      this.stop();
      if (!this.warnedMissingState) {
        console.warn('[GameLoop] Stopped: missing state');
        this.warnedMissingState = true;
      }
      return;
    }
    
    // Delta time hesapla (max 50ms cap)
    const rawDt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    
    // Pause kontrolü
    const dt = this.state.paused ? 0 : rawDt;
    
    // FPS tracking
    this.updateFPS(rawDt);
    
    // Zaman güncelle
    if (!this.state.paused && this.state.mode !== 'start') {
      this.state.timeSec += rawDt;
      this.updateDayTimer(rawDt);
      this.updateAutosave(rawDt);
    }
    
    // Input güncelle (world coords)
    if (this.input) {
      this.input.updateWorldCoords(this.state.camera);
    }
    
    // Mode'a göre update
    const updateHandler = this.updateHandlers[this.state.mode];
    if (updateHandler) {
      updateHandler(dt);
    }
    
    // Render
    const renderHandler = this.renderHandlers[this.state.mode];
    if (renderHandler && this.renderer) {
      renderHandler();
    }
    
    // Input frame cleanup
    if (this.input) {
      this.input.update();
    }
    
    // Next frame
    this.rafId = requestAnimationFrame((nextNow) => this.boundTick(nextNow, token));
  }
  
  // ========================================================================
  // TIME MANAGEMENT
  // ========================================================================
  
  updateFPS(dt) {
    this.state.performance.frameCount++;
    const fps = dt > 0 ? 1 / dt : 60;
    
    // Smoothed FPS
    const alpha = 0.1;
    this.state.performance.fps = this.state.performance.fps * (1 - alpha) + fps * alpha;
    this.state.debug.fps = this.state.performance.fps;
  }
  
  updateDayTimer(dt) {
    if (this.state.mode !== 'map') return;
    
    this.state.dayTimer += dt;
    
    if (this.state.dayTimer >= CONST.GAME.DAY_LENGTH_SEC) {
      this.state.dayTimer = 0;
      this.state.advanceDay();
      
      // Day tick events (ekonomi, AI, vs.)
      this.onDayTick();
    }
  }
  
  updateAutosave(dt) {
    this.state.autosaveTimer += dt;
    
    if (this.state.autosaveTimer >= CONST.GAME.AUTOSAVE_INTERVAL_SEC) {
      this.state.autosaveTimer = 0;
      this.state.emit('autosave:trigger');
    }
  }
  
  onDayTick() {
    // Burada günlük işlemler yapılır
    // - Şehir gelirleri
    // - AI hareketi
    // - Random eventler
    this.state.emit('day:tick', this.state.day);
  }
  
  // ========================================================================
  // UPDATE HANDLERS
  // ========================================================================
  
  updateStart(dt) {
    // Start ekranında update yok
  }
  
  updateMap(dt) {
    // Player hareketi buradan yönetilecek
    // AI güncellemesi buradan olacak
    this.state.emit('map:update', dt);
  }
  
  updateCity(dt) {
    // Şehir içi update
    this.state.emit('city:update', dt);
  }
  
  updateBattle(dt) {
    // Savaş update'i
    const battleDt = this.state.battlePaused 
      ? 0 
      : dt * CONST.BATTLE.TIME_SCALE * this.state.battleSpeed;
    
    this.state.emit('battle:update', battleDt);
  }
  
  updateEncounter(dt) {
    // Karşılaşma update'i
    this.state.emit('encounter:update', dt);
  }
  
  // ========================================================================
  // RENDER HANDLERS (Renderer'a delegate eder)
  // ========================================================================
  
  renderStart() {
    this.state.emit('render:start');
  }
  
  renderMap() {
    this.state.emit('render:map');
  }
  
  renderCity() {
    this.state.emit('render:city');
  }
  
  renderBattle() {
    this.state.emit('render:battle');
  }
  
  renderEncounter() {
    this.state.emit('render:encounter');
  }
}

export default GameLoop;
