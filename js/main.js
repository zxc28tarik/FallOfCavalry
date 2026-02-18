/**
 * FallOfCavalry - Main Entry Point
 * Oyunu başlatan ve tüm sistemleri bağlayan ana dosya
 */

import GameState from './core/state.js';
import InputManager from './core/input.js';
import GameLoop from './core/game-loop.js';
import HUDManager from './ui/hud.js';
import SaveSystem from './systems/save-system.js';
import AudioSystem from './systems/audio-system.js';
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

class FallOfCavalry {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.state = null;
    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    this.saveSystem = null;
    this.audioSystem = null;

    this.mode = 'menu'; // menu | playing | paused
    this.dom = {};

    this.resizeHandler = null;
    this.keyboardHandler = null;
    this.partyPointerHandler = null;
    this.partyPointerMoveHandler = null;
    this.partyPointerUpHandler = null;
    this.partyContextMenuHandler = null;

    this.rightPointerTracking = false;
    this.rightPointerMoved = false;
    this.rightPointerStartX = 0;
    this.rightPointerStartY = 0;
    this.mouseWorldX = 0;
    this.mouseWorldY = 0;

    this.playerParty = null;
    this.followParty = false;

    this.started = false;
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

    this.state = this.state || new GameState();
    this.input = this.input || new InputManager(this.canvas);
    this.gameLoop = this.gameLoop || new GameLoop(this.state, this.input, null);
    this.hudManager = this.hudManager || new HUDManager(this.state);
    this.saveSystem = this.saveSystem || new SaveSystem();
    this.audioSystem = this.audioSystem || new AudioSystem();

    this.setupCanvas();
    this.setupEventListeners();
    this.initPlayerParty();
    this.setupPartyInputHandlers();
    this.setupDOMReferences();
    this.setupMenuActions();
    this.enterMenu();

    if (typeof window !== 'undefined') {
      window.game = this;
      window.STATE = this.state;
    }

    this.initialized = true;
    console.log('✅ FallOfCavalry - Ready!');
    return true;
  }

  setupCanvas() {
    if (this.resizeHandler || !this.canvas) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const resize = () => {
      this.canvas.width = typeof window.innerWidth === 'number' ? window.innerWidth : this.canvas.width;
      this.canvas.height = typeof window.innerHeight === 'number' ? window.innerHeight : this.canvas.height;
      console.log(`[Canvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    };

    this.resizeHandler = resize;
    resize();
    window.addEventListener('resize', resize);
  }

  setupEventListeners() {
    if (this.listenersBound || !this.state) return;

    this.state.on('mode:changed', ({ old, new: newMode }) => this.onModeChanged(old, newMode));
    this.state.on('day:advanced', (day) => console.log(`[Game] Day ${day} started`));
    this.state.on('player:gold:changed', ({ old, new: newGold, delta }) => {
      console.log(`[Game] Gold: ${old} → ${newGold} (${delta >= 0 ? '+' : ''}${delta})`);
    });

    this.state.on('render:start', () => this.renderStart());
    this.state.on('render:map', () => this.renderMap());
    this.state.on('render:city', () => this.renderCity());
    this.state.on('render:battle', () => this.renderBattle());
    this.state.on('map:update', (dt) => this.updatePlayerParty(dt));

    this.setupKeyboardShortcuts();
    this.listenersBound = true;
  }

  getCameraSafe() {
    if (!this.state) return { x: 0, y: 0, zoom: 1 };
    if (!this.state.camera || typeof this.state.camera !== 'object') {
      this.state.camera = { x: 0, y: 0, zoom: 1 };
    }

    if (!Number.isFinite(this.state.camera.x)) this.state.camera.x = 0;
    if (!Number.isFinite(this.state.camera.y)) this.state.camera.y = 0;
    if (!Number.isFinite(this.state.camera.zoom) || this.state.camera.zoom <= 0) {
      this.state.camera.zoom = 1;
    }

    return this.state.camera;
  }

  getWorldBounds() {
    const mapWidthTiles = Number.isFinite(this.state?.map?.width) ? this.state.map.width : CONST.WORLD.MAP_WIDTH;
    const mapHeightTiles = Number.isFinite(this.state?.map?.height) ? this.state.map.height : CONST.WORLD.MAP_HEIGHT;
    const tileSize = Number.isFinite(CONST.WORLD?.TILE_SIZE) ? CONST.WORLD.TILE_SIZE : 60;

    const maxX = Math.max(0, mapWidthTiles * tileSize);
    const maxY = Math.max(0, mapHeightTiles * tileSize);

    return {
      minX: 0,
      minY: 0,
      maxX,
      maxY,
    };
  }

  clampToWorld(x, y) {
    const bounds = this.getWorldBounds();
    const safeX = Number.isFinite(x) ? x : bounds.minX;
    const safeY = Number.isFinite(y) ? y : bounds.minY;

    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, safeX)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, safeY)),
    };
  }

  clampCameraToWorld() {
    const camera = this.getCameraSafe();
    const bounds = this.getWorldBounds();
    if (!this.canvas || !Number.isFinite(this.canvas.width) || !Number.isFinite(this.canvas.height)) {
      return camera;
    }

    const zoom = Math.max(0.5, Math.min(2.5, camera.zoom));
    camera.zoom = zoom;

    const viewW = this.canvas.width / zoom;
    const viewH = this.canvas.height / zoom;

    const maxCameraX = Math.max(bounds.minX, bounds.maxX - viewW);
    const maxCameraY = Math.max(bounds.minY, bounds.maxY - viewH);

    camera.x = Math.max(bounds.minX, Math.min(maxCameraX, camera.x));
    camera.y = Math.max(bounds.minY, Math.min(maxCameraY, camera.y));
    return camera;
  }

  centerCameraOnParty() {
    if (!this.playerParty || !this.canvas) return false;

    const camera = this.getCameraSafe();
    const zoom = Math.max(0.5, Math.min(2.5, camera.zoom));
    const halfW = this.canvas.width / zoom / 2;
    const halfH = this.canvas.height / zoom / 2;

    camera.x = this.playerParty.x - halfW;
    camera.y = this.playerParty.y - halfH;
    this.clampCameraToWorld();
    return true;
  }

  screenToWorld(screenX, screenY) {
    const camera = this.getCameraSafe();
    const x = Number.isFinite(screenX) ? screenX : 0;
    const y = Number.isFinite(screenY) ? screenY : 0;
    return {
      x: x / camera.zoom + camera.x,
      y: y / camera.zoom + camera.y,
    };
  }

  updatePointerWorldState(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    this.mouseWorldX = world.x;
    this.mouseWorldY = world.y;

    if (this.playerParty) {
      this.playerParty.hovered = this.isWorldPointOnParty(world.x, world.y);
    }

    return world;
  }

  initPlayerParty() {
    if (this.playerParty) return;

    const fallback = {
      x: 320,
      y: 320,
      radius: 12,
      speed: 180,
      selected: false,
      destX: null,
      destY: null,
      hasDestination: false,
      arrivalFeedbackTimer: 0,
      hovered: false,
    };

    const statePlayer = this.state?.player;
    if (statePlayer && Number.isFinite(statePlayer.x) && Number.isFinite(statePlayer.y)) {
      fallback.x = statePlayer.x;
      fallback.y = statePlayer.y;
      fallback.destX = null;
      fallback.destY = null;
    }

    this.playerParty = fallback;
    if (this.state) {
      this.state.playerParty = this.playerParty;
    }
  }

  updatePlayerParty(dt) {
    if (!this.playerParty || !Number.isFinite(dt) || dt <= 0) return;

    if (this.playerParty.arrivalFeedbackTimer > 0) {
      this.playerParty.arrivalFeedbackTimer = Math.max(0, this.playerParty.arrivalFeedbackTimer - dt);
    }

    if (this.followParty) {
      this.centerCameraOnParty();
    }

    if (this.mode === 'paused') return;

    if (!this.playerParty.hasDestination) return;

    const dx = this.playerParty.destX - this.playerParty.x;
    const dy = this.playerParty.destY - this.playerParty.y;
    const dist = Math.hypot(dx, dy);
    const epsilon = 2;

    if (dist <= epsilon) {
      this.completePlayerArrival();
      return;
    }

    const step = this.playerParty.speed * dt;
    if (step >= dist) {
      this.completePlayerArrival();
      return;
    }

    this.playerParty.x += (dx / dist) * step;
    this.playerParty.y += (dy / dist) * step;

    const clamped = this.clampToWorld(this.playerParty.x, this.playerParty.y);
    this.playerParty.x = clamped.x;
    this.playerParty.y = clamped.y;

    if (this.followParty) {
      this.centerCameraOnParty();
    }
  }

  setPlayerDestination(worldX, worldY) {
    if (!this.playerParty) return false;
    if (!this.playerParty.selected) return false;
    if (this.mode === 'paused' || this.mode === 'menu') return false;

    const clamped = this.clampToWorld(worldX, worldY);
    this.playerParty.destX = clamped.x;
    this.playerParty.destY = clamped.y;

    const epsilon = 2;
    const dist = Math.hypot(this.playerParty.destX - this.playerParty.x, this.playerParty.destY - this.playerParty.y);
    if (dist <= epsilon) {
      this.playerParty.hasDestination = false;
      this.playerParty.destX = null;
      this.playerParty.destY = null;
      return false;
    }

    this.playerParty.hasDestination = true;
    return true;
  }

  completePlayerArrival() {
    if (!this.playerParty) return false;
    if (!Number.isFinite(this.playerParty.destX) || !Number.isFinite(this.playerParty.destY)) {
      this.cancelPlayerDestination();
      return false;
    }

    const snapped = this.clampToWorld(this.playerParty.destX, this.playerParty.destY);
    this.playerParty.x = snapped.x;
    this.playerParty.y = snapped.y;
    this.playerParty.hasDestination = false;
    this.playerParty.destX = null;
    this.playerParty.destY = null;
    this.playerParty.arrivalFeedbackTimer = 1.0;
    return true;
  }

  cancelPlayerDestination() {
    if (!this.playerParty || !this.playerParty.hasDestination) return false;
    this.playerParty.hasDestination = false;
    this.playerParty.destX = null;
    this.playerParty.destY = null;
    return true;
  }

  isWorldPointOnParty(worldX, worldY, margin = 6) {
    if (!this.playerParty) return false;
    const dist = Math.hypot(worldX - this.playerParty.x, worldY - this.playerParty.y);
    return dist <= this.playerParty.radius + margin;
  }

  setupPartyInputHandlers() {
    if (!this.canvas || this.partyPointerHandler || this.partyContextMenuHandler || this.partyPointerMoveHandler || this.partyPointerUpHandler) return;

    this.partyPointerHandler = (event) => {
      if (!this.playerParty || this.mode === 'menu') return;

      const rect = typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = this.updatePointerWorldState(screenX, screenY);

      if (event?.button === 0) {
        if (event?.shiftKey) {
          this.setPlayerDestination(world.x, world.y);
          return;
        }

        if (this.isWorldPointOnParty(world.x, world.y)) {
          this.playerParty.selected = !this.playerParty.selected;
        } else {
          this.playerParty.selected = false;
        }
        return;
      }

      if (event?.button === 2) {
        event.preventDefault?.();
        this.rightPointerTracking = true;
        this.rightPointerMoved = false;
        this.rightPointerStartX = screenX;
        this.rightPointerStartY = screenY;
      }
    };

    this.partyPointerMoveHandler = (event) => {
      if (!this.rightPointerTracking || !this.playerParty || this.mode === 'menu') return;

      const rect = typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const moved = Math.hypot(screenX - this.rightPointerStartX, screenY - this.rightPointerStartY);
      if (moved > 8) {
        this.rightPointerMoved = true;
      }
      this.updatePointerWorldState(screenX, screenY);
    };

    this.partyPointerUpHandler = (event) => {
      if (event?.button !== 2 || !this.rightPointerTracking || !this.playerParty || this.mode === 'menu') return;

      this.rightPointerTracking = false;
      if (this.rightPointerMoved) {
        this.rightPointerMoved = false;
        return;
      }

      const rect = typeof this.canvas.getBoundingClientRect === 'function'
        ? this.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = this.updatePointerWorldState(screenX, screenY);

      if (this.isWorldPointOnParty(world.x, world.y)) {
        this.cancelPlayerDestination();
        return;
      }

      this.setPlayerDestination(world.x, world.y);
    };

    this.partyContextMenuHandler = (event) => {
      event?.preventDefault?.();
    };

    this.canvas.addEventListener('mousedown', this.partyPointerHandler, { passive: false });
    this.canvas.addEventListener('mousemove', this.partyPointerMoveHandler, { passive: false });
    this.canvas.addEventListener('mouseup', this.partyPointerUpHandler, { passive: false });
    this.canvas.addEventListener('contextmenu', this.partyContextMenuHandler, { passive: false });
  }

  setupKeyboardShortcuts() {
    if (this.keyboardHandler) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    this.keyboardHandler = (e) => {
      if (!e || typeof e.key !== 'string') return;

      if (e.key === 'Enter' && this.mode === 'menu') {
        e.preventDefault?.();
        this.startNewGame();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault?.();
        if (this.mode === 'playing') {
          this.setPaused(true);
          return;
        }
        if (this.mode === 'paused') {
          this.setPaused(false);
          return;
        }
        if (this.mode === 'menu') {
          this.closeSettings();
        }
        return;
      }

      if ((e.key === 'x' || e.key === 'Backspace') && this.mode !== 'menu') {
        e.preventDefault?.();
        this.cancelPlayerDestination();
        return;
      }

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault?.();
        this.followParty = !this.followParty;
        if (this.followParty) {
          this.centerCameraOnParty();
        }
        return;
      }

      if (this.mode !== 'playing') return;

      if (e.key === ' ' && this.state?.mode !== 'start') {
        e.preventDefault?.();
        this.state.togglePause();
      }

      if (e.key === 'F3') {
        e.preventDefault?.();
        this.toggleDebug();
      }

      if (e.key === 'F5') {
        e.preventDefault?.();
        this.quickSave();
      }

      if (e.key === 'F9') {
        e.preventDefault?.();
        this.quickLoad();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  setupDOMReferences() {
    this.dom = {
      hud: utils.getEl('hud'),
      hudFaction: utils.getEl('hudFaction'),
      hudGold: utils.getEl('hudGold'),
      hudArmy: utils.getEl('hudArmy'),
      hudRenown: utils.getEl('hudRenown'),
      hudDay: utils.getEl('hudDay'),
      startModal: utils.getEl('startModal'),
      settlementModal: utils.getEl('settlementModal'),
      encounterModal: utils.getEl('encounterModal'),
      battleResultModal: utils.getEl('battleResultModal'),
      tooltip: utils.getEl('tooltip'),
      debugOverlay: utils.getEl('debugOverlay'),
      hudMinimapPanel: utils.getEl('hudMinimapPanel'),
      hudMiniMap: utils.getEl('hudMiniMap'),
    };

    const missing = Object.entries(this.dom).filter(([, el]) => !el).map(([key]) => key);
    if (missing.length) {
      this.warnOnce('game:missing-dom-ids', `[Game] Missing DOM ids: ${missing.join(', ')}`);
    }
  }

  onModeChanged(oldMode, newMode) {
    console.log(`[Game] Mode changed: ${oldMode} → ${newMode}`);
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
      onSettings: () => this.openSettings(),
      onCloseSettings: () => this.closeSettings(),
      onVolumeChange: (value) => this.applyMasterVolume(value),
    });
  }

  enterMenu() {
    this.stop();
    this.mode = 'menu';

    this.hudManager?.setPaused?.(false);
    this.hudManager?.setMenuVisible?.(true);
    this.hudManager?.setSettingsVisible?.(false);

    const canContinue = Boolean(this.saveSystem?.hasSave?.());
    this.hudManager?.setContinueEnabled?.(canContinue);
    return true;
  }

  startNewGame() {
    const started = this.start();
    if (!started) return false;

    this.mode = 'playing';
    this.hudManager?.setMenuVisible?.(false);
    this.hudManager?.setSettingsVisible?.(false);
    this.hudManager?.setPaused?.(false);
    return true;
  }

  continueGame() {
    const canContinue = Boolean(this.saveSystem?.hasSave?.());
    this.hudManager?.setContinueEnabled?.(canContinue);
    if (!canContinue) return false;

    const result = this.saveSystem?.load?.();
    if (!result?.success || !result.data) return false;

    if (typeof this.saveSystem?.deserialize === 'function' && this.state) {
      this.saveSystem.deserialize(result.data, this.state);
    }

    return this.startNewGame();
  }

  openSettings() {
    if (this.mode !== 'menu') return false;
    this.hudManager?.setSettingsVisible?.(true);
    return true;
  }

  closeSettings() {
    this.hudManager?.setSettingsVisible?.(false);
    return true;
  }

  applyMasterVolume(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return false;
    const normalized = numeric > 1 ? numeric / 100 : numeric;

    if (typeof this.audioSystem?.setMasterVolume === 'function') {
      this.audioSystem.setMasterVolume(normalized);
      return true;
    }

    if (typeof this.audioSystem?.setMusicVolume === 'function') {
      this.audioSystem.setMusicVolume(normalized);
    }
    if (typeof this.audioSystem?.setSfxVolume === 'function') {
      this.audioSystem.setSfxVolume(normalized);
    }
    return true;
  }

  quitToMenu() {
    return this.enterMenu();
  }

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

    if (this.state.mode !== 'map') {
      this.state.setMode('map');
    }

    this.gameLoop.start();
    this.started = true;
    return true;
  }

  stop() {
    if (!this.started) {
      this.warnOnce('game:stop-duplicate', '[Game] stop() already stopped');
      return true;
    }

    this.gameLoop?.stop?.();
    this.started = false;
    return true;
  }

  setPaused(isPaused) {
    if (this.mode === 'menu') return true;

    const nextPaused = Boolean(isPaused);
    if (nextPaused && this.mode === 'paused') {
      this.warnOnce('game:pause-duplicate:on', '[Game] Pause already enabled');
      return true;
    }
    if (!nextPaused && this.mode === 'playing') {
      this.warnOnce('game:pause-duplicate:off', '[Game] Pause already disabled');
      return true;
    }

    if (nextPaused) {
      this.mode = 'paused';
      this.hudManager?.setPaused?.(true);
      this.hudManager?.setMenuVisible?.(false);
      if (this.started) {
        this.gameLoop?.stop?.();
      }
      return true;
    }

    this.mode = 'playing';
    this.hudManager?.setPaused?.(false);
    this.hudManager?.setMenuVisible?.(false);
    if (this.started) {
      this.gameLoop?.start?.();
    }
    return true;
  }

  togglePaused() {
    if (this.mode === 'playing') return this.setPaused(true);
    if (this.mode === 'paused') return this.setPaused(false);
    return true;
  }

  isPaused() {
    return this.mode === 'paused';
  }

  destroy() {
    this.stop();

    if (typeof window !== 'undefined' && this.resizeHandler && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.resizeHandler);
    }

    if (typeof document !== 'undefined' && this.keyboardHandler && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', this.keyboardHandler);
    }

    if (this.canvas && typeof this.canvas.removeEventListener === 'function') {
      if (this.partyPointerHandler) {
        this.canvas.removeEventListener('mousedown', this.partyPointerHandler);
      }
      if (this.partyPointerMoveHandler) {
        this.canvas.removeEventListener('mousemove', this.partyPointerMoveHandler);
      }
      if (this.partyPointerUpHandler) {
        this.canvas.removeEventListener('mouseup', this.partyPointerUpHandler);
      }
      if (this.partyContextMenuHandler) {
        this.canvas.removeEventListener('contextmenu', this.partyContextMenuHandler);
      }
    }

    const destroyables = [this.input, this.gameLoop, this.renderer, this.hudManager];
    destroyables.forEach((sys) => sys?.destroy?.());

    this.resizeHandler = null;
    this.keyboardHandler = null;
    this.partyPointerHandler = null;
    this.partyPointerMoveHandler = null;
    this.partyPointerUpHandler = null;
    this.partyContextMenuHandler = null;
    this.rightPointerTracking = false;
    this.rightPointerMoved = false;
    this.rightPointerStartX = 0;
    this.rightPointerStartY = 0;
    this.listenersBound = false;
    this.started = false;
    this.initialized = false;

    this.input = null;
    this.gameLoop = null;
    this.hudManager = null;
    this.saveSystem = null;
    this.audioSystem = null;
    this.state = null;
    this.ctx = null;
    this.canvas = null;
    this.mode = 'menu';
    this.playerParty = null;
    this.followParty = false;

    return true;
  }

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
  }

  quickSave() {
    console.log('[Game] Quick saving...');
  }

  quickLoad() {
    console.log('[Game] Quick loading...');
  }

  renderStart() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '48px "Cinzel", serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('FallOfCavalry', this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.font = '24px "Crimson Text", serif';
    this.ctx.fillText('Select your faction to begin', this.canvas.width / 2, this.canvas.height / 2 + 60);
  }

  renderMap() {
    if (!this.ctx || !this.canvas) return;
    const camera = this.getCameraSafe();
    this.clampCameraToWorld();
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.scale(camera.zoom, camera.zoom);
    this.ctx.translate(-camera.x, -camera.y);

    this.renderWorldOverlays(this.ctx, camera);

    this.ctx.restore();

    this.ctx.fillStyle = '#fff';
    this.ctx.font = '24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Map View (TODO)', this.canvas.width / 2, this.canvas.height / 2);

    if (this.followParty) {
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = 'rgba(255,255,255,0.75)';
      this.ctx.fillText('Follow: ON (F)', 12, this.canvas.height - 12);
    }

    if (this.state?.debug?.enabled) {
      this.renderDebugInfo();
    }
  }

  renderWorldOverlays(ctx, camera) {
    if (!ctx || !camera || !this.playerParty) return;

    const lineBase = 2 / camera.zoom;
    const party = this.playerParty;

    if (party.hasDestination) {
      ctx.strokeStyle = 'rgba(212,175,55,0.45)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(party.destX, party.destY);
      ctx.stroke();

      const d = 8;
      ctx.strokeStyle = 'rgba(212,175,55,0.85)';
      ctx.beginPath();
      ctx.moveTo(party.destX - d, party.destY);
      ctx.lineTo(party.destX + d, party.destY);
      ctx.moveTo(party.destX, party.destY - d);
      ctx.lineTo(party.destX, party.destY + d);
      ctx.stroke();
    }

    if (party.selected && this.mode !== 'paused') {
      ctx.strokeStyle = 'rgba(200,220,255,0.28)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.moveTo(party.x, party.y);
      ctx.lineTo(this.mouseWorldX, this.mouseWorldY);
      ctx.stroke();

      const pd = 6;
      ctx.strokeStyle = 'rgba(200,220,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(this.mouseWorldX - pd, this.mouseWorldY);
      ctx.lineTo(this.mouseWorldX + pd, this.mouseWorldY);
      ctx.moveTo(this.mouseWorldX, this.mouseWorldY - pd);
      ctx.lineTo(this.mouseWorldX, this.mouseWorldY + pd);
      ctx.stroke();
    }

    if (party.arrivalFeedbackTimer > 0) {
      const t = party.arrivalFeedbackTimer;
      const pulse = 1 - t;
      const radius = party.radius + 8 + Math.sin(pulse * Math.PI * 4) * 2;
      ctx.strokeStyle = `rgba(242, 201, 76, ${0.15 + (t * 0.35)})`;
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#4aa3ff';
    ctx.beginPath();
    ctx.arc(party.x, party.y, party.radius, 0, Math.PI * 2);
    ctx.fill();

    if (party.hovered && !party.selected) {
      ctx.strokeStyle = 'rgba(170,205,255,0.65)';
      ctx.lineWidth = lineBase;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (party.selected) {
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3 / camera.zoom;
      ctx.beginPath();
      ctx.arc(party.x, party.y, party.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
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

export default FallOfCavalry;
