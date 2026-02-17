/**
 * FallOfCavalry - HUD Manager
 * HUD elementlerini günceller
 */

import { safeClass, safeText, getEl } from '../utils.js';

export class HUDManager {
  constructor(state) {
    this.state = state;
    this.elements = {};
    this.listenersBound = false;
    this.listenerHandlers = new Map();
    this.uiHandlers = new Map();
    this.menuActions = { onStart: null, onContinue: null, onQuitToMenu: null };
    this.warnedKeys = new Set();

    this.setupElements();
    this.setupListeners();
  }

  warnOnce(key, message) {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    console.warn(message);
  }

  setupElements() {
    this.elements = {
      hud: getEl('hud'),
      hudFaction: getEl('hudFaction'),
      hudGold: getEl('hudGold'),
      hudArmy: getEl('hudArmy'),
      hudRenown: getEl('hudRenown'),
      hudDay: getEl('hudDay'),
      pauseOverlay: getEl('pauseOverlay'),
      pauseOverlayTitle: getEl('pauseOverlayTitle'),
      pauseOverlayHint: getEl('pauseOverlayHint'),
      menuOverlay: getEl('menuOverlay'),
      menuBtnStart: getEl('menuBtnStart'),
      menuBtnContinue: getEl('menuBtnContinue'),
      btnQuitToMenu: getEl('btnQuitToMenu'),
    };
  }

  addStateListener(event, handler) {
    if (!this.state || typeof this.state.on !== 'function') return;
    if (this.listenerHandlers.has(event)) return;

    this.state.on(event, handler);
    this.listenerHandlers.set(event, handler);
  }

  setupListeners() {
    if (this.listenersBound) return;

    if (!this.state || typeof this.state.on !== 'function') {
      this.warnOnce('missing-state-on', '[HUD] State emitter unavailable; HUD listeners skipped');
      return;
    }

    // Listen to state changes
    this.addStateListener('player:gold:changed', ({ new: gold } = {}) => {
      this.updateGold(gold);
    });

    this.addStateListener('player:army:changed', ({ new: army } = {}) => {
      this.updateArmy(army);
    });

    this.addStateListener('player:renown:changed', ({ new: renown } = {}) => {
      this.updateRenown(renown);
    });

    this.addStateListener('day:advanced', (day) => {
      this.updateDay(day);
    });

    this.addStateListener('faction:selected', (faction) => {
      this.updateFaction(faction);
    });

    this.addStateListener('mode:changed', ({ new: mode } = {}) => {
      this.updateVisibility(mode);
    });

    this.listenersBound = true;
  }

  update() {
    // Update all values
    this.updateGold(this.state?.player?.gold);
    this.updateArmy(this.state?.player?.army);
    this.updateRenown(this.state?.player?.renown);
    this.updateDay(this.state?.day);

    if (this.state?.selectedFaction) {
      this.updateFaction(this.state.selectedFaction);
    }
  }

  updateGold(gold) {
    safeText(this.elements.hudGold, Math.floor(gold ?? 0));
  }

  updateArmy(army) {
    safeText(this.elements.hudArmy, Math.floor(army ?? 0));
  }

  updateRenown(renown) {
    safeText(this.elements.hudRenown, Math.floor(renown ?? 0));
  }

  updateDay(day) {
    safeText(this.elements.hudDay, day ?? 0);
  }

  updateFaction(faction) {
    safeText(this.elements.hudFaction, faction?.name || '-');
  }

  updateVisibility(mode) {
    if (!this.elements.hud) return;

    if (mode === 'start') {
      safeClass(this.elements.hud, 'add', 'hidden');
    } else {
      safeClass(this.elements.hud, 'remove', 'hidden');
    }
  }

  show() {
    safeClass(this.elements.hud, 'remove', 'hidden');
  }

  hide() {
    safeClass(this.elements.hud, 'add', 'hidden');
  }



  addUIListener(key, target, event, handler) {
    if (!target || typeof target.addEventListener !== 'function') return;
    if (this.uiHandlers.has(key)) return;

    target.addEventListener(event, handler);
    this.uiHandlers.set(key, { target, event, handler });
  }

  setMenuHandlers({ onStart, onContinue, onQuitToMenu } = {}) {
    this.menuActions.onStart = typeof onStart === 'function' ? onStart : null;
    this.menuActions.onContinue = typeof onContinue === 'function' ? onContinue : null;
    this.menuActions.onQuitToMenu = typeof onQuitToMenu === 'function' ? onQuitToMenu : null;

    this.addUIListener('menu:start', this.elements.menuBtnStart, 'click', () => {
      this.menuActions.onStart?.();
    });
    this.addUIListener('menu:continue', this.elements.menuBtnContinue, 'click', () => {
      this.menuActions.onContinue?.();
    });
    this.addUIListener('pause:quit', this.elements.btnQuitToMenu, 'click', () => {
      this.menuActions.onQuitToMenu?.();
    });
  }

  showMenu(isVisible) {
    const visible = Boolean(isVisible);
    safeClass(this.elements.menuOverlay, visible ? 'remove' : 'add', 'hidden');

    if (visible) {
      this.setPaused(false);
    }
  }

  setContinueEnabled(canContinue) {
    if (!this.elements.menuBtnContinue) return;
    this.elements.menuBtnContinue.disabled = !canContinue;
  }

  setPaused(isPaused) {
    const paused = Boolean(isPaused);

    safeClass(this.elements.pauseOverlay, paused ? 'remove' : 'add', 'hidden');

    if (paused) {
      safeText(this.elements.pauseOverlayTitle, 'PAUSED');
      safeText(this.elements.pauseOverlayHint, 'Press ESC to resume');
    }
  }

  destroy() {
    if (this.state && typeof this.state.off === 'function') {
      this.listenerHandlers.forEach((handler, event) => {
        this.state.off(event, handler);
      });
    }

    this.listenerHandlers.clear();
    this.uiHandlers.forEach(({ target, event, handler }) => {
      if (!target || typeof target.removeEventListener !== 'function') return;
      target.removeEventListener(event, handler);
    });
    this.uiHandlers.clear();
    this.listenersBound = false;
  }
}

export default HUDManager;
