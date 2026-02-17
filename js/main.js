/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

// Core imports
import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';
import HUDManager from './ui/hud.js';
import SaveSystem from './systems/save-system.js';

// Constants & Utils
import * as CONST from './constants.js';
import * as utils from './utils.js';

const ROOT_SCOPE = typeof window !== 'undefined' ? window : globalThis;
const GLOBAL_KEYS = {
  game: '__fallOfCavalryGameInstance__',
  bootstrapWarned: '__fallOfCavalryBootstrapWarned__',
  domReadyBound: '__fallOfCavalryDomReadyBound__',
};

function warnBootstrapOnce(message) {
  if (ROOT_SCOPE[GLOBAL_KEYS.bootstrapWarned]) return;
  ROOT_SCOPE[GLOBAL_KEYS.bootstrapWarned] = true;
  console.warn(message);
}

/**
 * Ana Oyun Sınıfı
 */
class FallOfCavalry {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = null;
    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    this.saveSystem = null;
    this.mode = 'menu';
    this.dom = {};

    this.resizeHandler = null;
    this.keyboardHandler = null;

    this.started = false;
    this.paused = false;
    this.initialized = false;
    this.listenersBound = false;
    this.warnedKeys = new Set();

    console.log('🎮 FallOfCavalry - Initializing...');
    this.init();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    console.warn(message);
  }

  init() {
    if (this.initialized) {
      this.warnOnce('game:init-duplicate', '[Game] init() already completed');
      return true;
    }

    // Canvas
    this.canvas = utils.getEl('gameCanvas');
    if (!this.canvas || typeof this.canvas.getContext !== 'function') {
      this.warnOnce('game:missing-canvas', '[Game] Canvas unavailable; game init skipped');
      return false;
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      this.warnOnce('game:missing-context', '[Game] Canvas 2D context unavailable; game init skipped');
      return false;
    }

    // Core Systems
    this.state = this.state || new GameState();
    this.input = this.input || new InputManager(this.canvas);
    this.gameLoop = this.gameLoop || new GameLoop(this.state, this.input, null); // Renderer sonra eklenecek
    this.hudManager = this.hudManager || new HUDManager(this.state);
    this.saveSystem = this.saveSystem || new SaveSystem();

    this.setupCanvas();
    this.setupEventListeners();
    this.setupDOMReferences();
    this.setupMenuActions();
    this.enterMenu();

    // Global olarak erişilebilir kıl (debugging için)
    if (typeof window !== 'undefined') {
      window.game = this;
      window.STATE = this.state;
    }

    this.initialized = true;
    console.log('✅ FallOfCavalry - Ready!');
    return true;
  }

  /**
   * Canvas boyutlandırma
   */
  setupCanvas() {
    if (this.resizeHandler || !this.canvas) return;

    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    const resize = () => {
      this.canvas.width = typeof window.innerWidth === 'number' ? window.innerWidth : this.canvas.width;
      this.canvas.height = typeof window.innerHeight === 'number' ? window.innerHeight : this.canvas.height;

      console.log(`[Canvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    };

    this.resizeHandler = resize;
    resize();
    window.addEventListener('resize', resize);
  }

  /**
   * Event listener'ları kur
   */
  setupEventListeners() {
    if (this.listenersBound || !this.state) return;

    // State events
    this.state.on('mode:changed', ({ old, new: newMode }) => {
      console.log(`[Game] Mode changed: ${old} → ${newMode}`);
      this.onModeChanged(old, newMode);
    });

    this.state.on('day:advanced', (day) => {
      console.log(`[Game] Day ${day} started`);
    });

    this.state.on('player:gold:changed', ({ old, new: newGold, delta }) => {
      console.log(`[Game] Gold: ${old} → ${newGold} (${delta >= 0 ? '+' : ''}${delta})`);
    });

    // Render events
    this.state.on('render:start', () => this.renderStart());
    this.state.on('render:map', () => this.renderMap());
    this.state.on('render:city', () => this.renderCity());
    this.state.on('render:battle', () => this.renderBattle());

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
    this.listenersBound = true;
  }

  /**
   * Klavye kısayolları
   */
  setupKeyboardShortcuts() {
    if (this.keyboardHandler) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    this.keyboardHandler = (e) => {
      if (e?.key === 'Escape') {
        e.preventDefault();
        if (this.mode === 'game') {
          this.togglePaused();
        }
        return;
      }

      if (this.paused || this.mode !== 'game') return;

      // Pause
      if (e.key === ' ' && this.state?.mode !== 'start') {
        e.preventDefault();
        this.state.togglePause();
      }

      // Debug
      if (e.key === 'F3') {
        e.preventDefault();
        this.toggleDebug();
      }

      // Quick save
      if (e.key === 'F5') {
        e.preventDefault();
        this.quickSave();
      }

      // Quick load
      if (e.key === 'F9') {
        e.preventDefault();
        this.quickLoad();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * DOM element referansları
   */
  setupDOMReferences() {
    this.dom = {
      // HUD
      hud: utils.getEl('hud'),
      hudFaction: utils.getEl('hudFaction'),
      hudGold: utils.getEl('hudGold'),
      hudArmy: utils.getEl('hudArmy'),
      hudRenown: utils.getEl('hudRenown'),
      hudDay: utils.getEl('hudDay'),

      // Modals
      startModal: utils.getEl('startModal'),
      settlementModal: utils.getEl('settlementModal'),
      encounterModal: utils.getEl('encounterModal'),
      battleResultModal: utils.getEl('battleResultModal'),

      // Tooltip
      tooltip: utils.getEl('tooltip'),
      debugOverlay: utils.getEl('debugOverlay'),

      // Minimap
      hudMinimapPanel: utils.getEl('hudMinimapPanel'),
      hudMiniMap: utils.getEl('hudMiniMap'),
    };

    const missing = Object.entries(this.dom).filter(([, el]) => !el).map(([key]) => key);
    if (missing.length) {
      this.warnOnce('game:missing-dom-ids', `[Game] Missing DOM ids: ${missing.join(', ')}`);
    }

    console.log('[Game] DOM references set up');
  }

  /**
   * Mode değiştiğinde çağrılır
   */
  onModeChanged(oldMode, newMode) {
    // HUD göster/gizle
    if (newMode === 'start') {
      utils.safeClass(this.dom.hud, 'add', 'hidden');
      utils.safeClass(this.dom.startModal, 'remove', 'hidden');
    } else {
      utils.safeClass(this.dom.hud, 'remove', 'hidden');
      utils.safeClass(this.dom.startModal, 'add', 'hidden');
    }
  }


  setupMenuActions() {
    if (!this.hudManager || typeof this.hudManager.setMenuHandlers !== 'function') return;

    this.hudManager.setMenuHandlers({
      onStart: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onQuitToMenu: () => this.quitToMenu(),
    });
  }

  enterMenu() {
    this.mode = 'menu';
    this.paused = false;

    if (this.hudManager) {
      if (typeof this.hudManager.setPaused === 'function') {
        this.hudManager.setPaused(false);
      }

      if (typeof this.hudManager.showMenu === 'function') {
        this.hudManager.showMenu(true);
      }

      if (typeof this.hudManager.setContinueEnabled === 'function') {
        const canContinue = Boolean(this.saveSystem?.hasSave?.());
        this.hudManager.setContinueEnabled(canContinue);
      }
    }

    this.stop();
    return true;
  }

  startNewGame() {
    const started = this.start();
    if (!started) return false;

    this.mode = 'game';
    if (this.hudManager && typeof this.hudManager.showMenu === 'function') {
      this.hudManager.showMenu(false);
    }
    return true;
  }

  continueGame() {
    const canContinue = Boolean(this.saveSystem?.hasSave?.());
    if (this.hudManager && typeof this.hudManager.setContinueEnabled === 'function') {
      this.hudManager.setContinueEnabled(canContinue);
    }

    if (!canContinue) return false;

    const result = this.saveSystem?.load?.();
    if (!result?.success || !result.data) return false;

    if (typeof this.saveSystem?.deserialize === 'function' && this.state) {
      this.saveSystem.deserialize(result.data, this.state);
    }

    return this.startNewGame();
  }

  quitToMenu() {
    this.setPaused(false);
    return this.enterMenu();
  }

  /**
   * Oyunu başlat
   */
  start() {
    if (!this.initialized) {
      const ready = this.init();
      if (!ready) return false;
    }

    if (this.started) {
      this.warnOnce('game:start-duplicate', '[Game] start() already running');
      return true;
    }

    if (!this.state || !this.gameLoop || typeof this.gameLoop.start !== 'function') {
      this.warnOnce('game:start-unavailable', '[Game] start() unavailable');
      return false;
    }

    console.log('[Game] Starting game...');

    // Mode'u map'e çevir
    if (this.state.mode !== 'map') {
      this.state.setMode('map');
    }

    // Game loop'u başlat
    this.gameLoop.start();
    if (this.paused) {
      this.setPaused(false);
    }
    this.started = true;

    console.log('[Game] Game started!');
    return true;
  }

  stop() {
    if (!this.started) {
      this.warnOnce('game:stop-duplicate', '[Game] stop() already stopped');
      return true;
    }

    if (this.gameLoop && typeof this.gameLoop.stop === 'function') {
      this.gameLoop.stop();
    }

    this.started = false;
    return true;
  }

  setPaused(isPaused) {
    const nextPaused = Boolean(isPaused);

    if (this.paused === nextPaused) {
      this.warnOnce(`game:pause-duplicate:${nextPaused ? 'on' : 'off'}`, `[Game] Pause already ${nextPaused ? 'enabled' : 'disabled'}`);
      return true;
    }

    if (this.mode !== 'game') {
      this.paused = false;
      return true;
    }

    this.paused = nextPaused;

    if (this.hudManager && typeof this.hudManager.setPaused === 'function') {
      this.hudManager.setPaused(this.paused);
    }

    if (!this.started || !this.gameLoop) return true;

    if (this.paused) {
      if (typeof this.gameLoop.stop === 'function') {
        this.gameLoop.stop();
      }
      return true;
    }

    if (typeof this.gameLoop.start === 'function') {
      this.gameLoop.start();
    }

    return true;
  }

  togglePaused() {
    return this.setPaused(!this.paused);
  }

  isPaused() {
    return this.paused;
  }

  destroy() {
    this.stop();

    if (typeof window !== 'undefined' && this.resizeHandler && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.resizeHandler);
    }

    if (typeof document !== 'undefined' && this.keyboardHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.keyboardHandler);
    }

    const destroyables = [this.input, this.gameLoop, this.renderer, this.hudManager];
    destroyables.forEach((sys) => {
      if (sys && typeof sys.destroy === 'function') {
        sys.destroy();
      }
    });

    this.resizeHandler = null;
    this.keyboardHandler = null;
    this.listenersBound = false;
    this.started = false;
    this.paused = false;
    this.initialized = false;

    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    this.saveSystem = null;
    this.state = null;
    this.ctx = null;
    this.canvas = null;
    this.mode = 'menu';

    return true;
  }

  /**
   * Debug mode toggle
   */
  toggleDebug() {
    if (!this.state?.debug) return;

    this.state.debug.enabled = !this.state.debug.enabled;

    if (this.dom.debugOverlay) {
      if (this.state.debug.enabled) {
        this.dom.debugOverlay.classList.remove('hidden');
      } else {
        this.dom.debugOverlay.classList.add('hidden');
      }
    }

    console.log(`[Game] Debug mode: ${this.state.debug.enabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Quick save
   */
  quickSave() {
    console.log('[Game] Quick saving...');
    // TODO: Implement
    // this.saveSystem.save(this.state);
  }

  /**
   * Quick load
   */
  quickLoad() {
    console.log('[Game] Quick loading...');
    // TODO: Implement
    // this.saveSystem.load();
  }

  // ========================================================================
  // RENDER METHODS (Temporary - renderer'a taşınacak)
  // ========================================================================

  renderStart() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Basit "Start" ekranı
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '48px "Cinzel", serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FallOfCavalry', this.canvas.width / 2, this.canvas.height / 2);

    this.ctx.font = '24px "Crimson Text", serif';
    this.ctx.fillText('Select your faction to begin', this.canvas.width / 2, this.canvas.height / 2 + 60);
  }

  renderMap() {
    if (!this.ctx || !this.canvas) return;

    // Clear
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Temporary placeholder
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Map View (TODO)', this.canvas.width / 2, this.canvas.height / 2);

    // FPS
    if (this.state?.debug?.enabled) {
      this.renderDebugInfo();
    }
  }

  renderCity() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('City View (TODO)', this.canvas.width / 2, this.canvas.height / 2);
  }

  renderBattle() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.fillStyle = '#3a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Battle View (TODO)', this.canvas.width / 2, this.canvas.height / 2);
  }

  renderDebugInfo() {
    if (!this.state || !this.input) return;

    const lines = [
      `FPS: ${this.state.debug.fps.toFixed(0)}`,
      `Mode: ${this.state.mode}`,
      `Day: ${this.state.day}`,
      `Gold: ${this.state.player.gold}`,
      `Mouse: (${this.input.mouse.x.toFixed(0)}, ${this.input.mouse.y.toFixed(0)})`,
    ];

    if (this.dom.debugOverlay) {
      this.dom.debugOverlay.textContent = lines.join('\n');
    }
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Sayfa yüklendiğinde oyunu başlat
 */
export function bootstrapFallOfCavalry() {
  if (ROOT_SCOPE[GLOBAL_KEYS.game]) {
    warnBootstrapOnce('[Main] Bootstrap already completed; skipping duplicate init.');
    return ROOT_SCOPE[GLOBAL_KEYS.game];
  }

  try {
    const game = new FallOfCavalry();
    ROOT_SCOPE[GLOBAL_KEYS.game] = game;

    return game;
  } catch (err) {
    console.error('Failed to initialize game:', err);
    if (typeof document !== 'undefined' && document.body) {
      document.body.innerHTML = `
        <div style="color: red; padding: 20px; font-family: monospace;">
          <h1>Game Failed to Load</h1>
          <pre>${err.message}\n\n${err.stack}</pre>
        </div>
      `;
    }
    return null;
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  if (!ROOT_SCOPE[GLOBAL_KEYS.domReadyBound]) {
    ROOT_SCOPE[GLOBAL_KEYS.domReadyBound] = true;
    document.addEventListener('DOMContentLoaded', bootstrapFallOfCavalry);
  }
}

// Export for debugging
export default FallOfCavalry;
