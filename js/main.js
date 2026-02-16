/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

// Core imports
import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';

// Constants & Utils
import * as CONST from './constants.js';
import * as utils from './utils.js';

// TODO: Diğer modülleri import et
// import { WorldGenerator } from './world/world-generator.js';
// import { SaveSystem } from './systems/save-system.js';
// import { CanvasRenderer } from './rendering/canvas-renderer.js';
// ... vs

/**
 * Ana Oyun Sınıfı
 */
class FallOfCavalry {
  constructor() {
    console.log('🎮 FallOfCavalry - Initializing...');
    
    // Canvas
    this.canvas = utils.getEl('gameCanvas');
    if (!this.canvas || typeof this.canvas.getContext !== 'function') {
      throw new Error('Canvas element not found or invalid!');
    }
    
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error('Canvas 2D context is unavailable!');
    }
    this.setupCanvas();
    
    // Core Systems
    this.state = new GameState();
    this.input = new InputManager(this.canvas);
    this.gameLoop = new GameLoop(this.state, this.input, null); // Renderer sonra eklenecek
    this.started = false;
    
    // TODO: Diğer sistemleri initialize et
    // this.renderer = new CanvasRenderer(this.canvas, this.state);
    // this.worldGenerator = new WorldGenerator();
    // this.saveSystem = new SaveSystem();
    // this.hudManager = new HUDManager(this.state);
    // ... vs
    
    // Event listeners
    this.setupEventListeners();
    
    // DOM referansları
    this.setupDOMReferences();
    
    // Global olarak erişilebilir kıl (debugging için)
    window.game = this;
    window.STATE = this.state;
    
    console.log('✅ FallOfCavalry - Ready!');
  }
  
  /**
   * Canvas boyutlandırma
   */
  setupCanvas() {
    const resize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      
      console.log(`[Canvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    };
    
    resize();
    window.addEventListener('resize', resize);
  }
  
  /**
   * Event listener'ları kur
   */
  setupEventListeners() {
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
  }
  
  /**
   * Klavye kısayolları
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Pause
      if (e.key === ' ' && this.state.mode !== 'start') {
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
    });
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
      console.warn(`[Game] Missing DOM ids: ${missing.join(', ')}`);
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
  
  /**
   * Oyunu başlat
   */
  start() {
    if (this.started) return;

    console.log('[Game] Starting game...');
    
    // TODO: Dünyayı oluştur
    // const world = this.worldGenerator.generate(this.state.seed);
    // this.state.loadMap(world);
    
    // Mode'u map'e çevir
    this.state.setMode('map');
    
    // Game loop'u başlat
    this.gameLoop.start();
    this.started = true;

    console.log('[Game] Game started!');
  }
  
  /**
   * Debug mode toggle
   */
  toggleDebug() {
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
    // Clear
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // TODO: Harita çizimi
    // this.renderer.renderMap();
    
    // Temporary placeholder
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Map View (TODO)', this.canvas.width / 2, this.canvas.height / 2);
    
    // FPS
    if (this.state.debug.enabled) {
      this.renderDebugInfo();
    }
  }
  
  renderCity() {
    this.ctx.fillStyle = '#2a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // TODO: Şehir çizimi
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('City View (TODO)', this.canvas.width / 2, this.canvas.height / 2);
  }
  
  renderBattle() {
    this.ctx.fillStyle = '#3a2a2a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // TODO: Savaş çizimi
    
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Battle View (TODO)', this.canvas.width / 2, this.canvas.height / 2);
  }
  
  renderDebugInfo() {
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
document.addEventListener('DOMContentLoaded', () => {
  try {
    const game = new FallOfCavalry();
    
    // Test: Hemen başlat (normalde faction seçimi sonrası)
    setTimeout(() => {
      console.log('[Main] Auto-starting game for testing...');
      game.start();
    }, 1000);
    
  } catch (err) {
    console.error('Failed to initialize game:', err);
    document.body.innerHTML = `
      <div style="color: red; padding: 20px; font-family: monospace;">
        <h1>Game Failed to Load</h1>
        <pre>${err.message}\n\n${err.stack}</pre>
      </div>
    `;
  }
});

// Export for debugging
export default FallOfCavalry;