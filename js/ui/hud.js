/**
 * FallOfCavalry - HUD Manager
 * HUD elementlerini günceller
 */

import { safeClass, safeText, getEl } from '../utils.js';
import { TUTORIAL_HINTS } from '../constants.js';

export class HUDManager {
  constructor(state) {
    this.state = state;
    this.elements = {};
    this.listenersBound = false;
    this.listenerHandlers = new Map();
    this.uiHandlers = new Map();
    this.menuActions = {
      onStart: null,
      onContinue: null,
      onQuitToMenu: null,
      onSettings: null,
      onCloseSettings: null,
      onVolumeChange: null,
    };
    this.warnedKeys = new Set();
    this.transientHintTimer = null;
    this.transientHintRestore = null;

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
      hudStats: getEl('hudStats'),
      hudEvent: getEl('hudEvent'),
      rosterPanel: getEl('rosterPanel'),
      rosterEnemy: getEl('rosterEnemy'),
      rosterWarning: getEl('rosterWarning'),
      rosterPlayerList: getEl('rosterPlayerList'),
      rosterEnemyList: getEl('rosterEnemyList'),
      uiPanel: getEl('uiPanel'),
      uiPanelTitle: getEl('uiPanelTitle'),
      uiPanelBody: getEl('uiPanelBody'),
      uiPanelFooter: getEl('uiPanelFooter'),
      pauseOverlay: getEl('pauseOverlay'),
      pauseOverlayTitle: getEl('pauseOverlayTitle'),
      pauseOverlayHint: getEl('pauseOverlayHint'),
      mainMenuOverlay: getEl('mainMenuOverlay') || getEl('menuOverlay'),
      menuBtnStart: getEl('menuBtnStart'),
      menuBtnContinue: getEl('menuBtnContinue'),
      menuBtnSettings: getEl('menuBtnSettings'),
      mainMenuSettingsPanel: getEl('mainMenuSettingsPanel'),
      menuMasterVolume: getEl('menuMasterVolume'),
      menuBtnCloseSettings: getEl('menuBtnCloseSettings'),
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

    this.addStateListener('player:gold:changed', ({ new: gold } = {}) => this.updateGold(gold));
    this.addStateListener('player:army:changed', ({ new: army } = {}) => this.updateArmy(army));
    this.addStateListener('player:renown:changed', ({ new: renown } = {}) => this.updateRenown(renown));
    this.addStateListener('day:advanced', (day) => this.updateDay(day));
    this.addStateListener('faction:selected', (faction) => this.updateFaction(faction));
    this.addStateListener('mode:changed', ({ new: mode } = {}) => this.updateVisibility(mode));

    this.listenersBound = true;
  }

  update() {
    this.updateGold(this.state?.player?.gold);
    this.updateArmy(this.state?.player?.army);
    this.updateRenown(this.state?.player?.renown);
    this.updateDay(this.state?.day);

    if (this.state?.selectedFaction) {
      this.updateFaction(this.state.selectedFaction);
    }

    this.updateEncounterStats();
    this.updateEventLine();
    this.updateRosterPanel();
    this.updateUiPanel();
  }

  updateGold(gold) { safeText(this.elements.hudGold, Math.floor(gold ?? 0)); }
  updateArmy(army) { safeText(this.elements.hudArmy, Math.floor(army ?? 0)); }
  updateRenown(renown) { safeText(this.elements.hudRenown, Math.floor(renown ?? 0)); }
  updateDay(day) { safeText(this.elements.hudDay, day ?? 0); }
  updateFaction(faction) { safeText(this.elements.hudFaction, faction?.name || '-'); }

  updateEncounterStats() {
    if (!this.elements.hudStats) return;
    const gold = Math.floor(this.state?.playerParty?.gold ?? 0);
    const xp = Math.floor(this.state?.playerParty?.xp ?? 0);
    const morale = Math.floor(this.state?.playerParty?.morale ?? 0);
    const units = this.state?.playerParty?.roster ?? [];
    const totalUnits = units.filter((unit) => Math.floor(unit?.hp ?? 0) > 0).length;
    const wounded = units.filter((unit) => Boolean(unit?.wounded) || ((unit?.hp ?? 0) / Math.max(1, unit?.maxHp ?? 1)) <= 0.35).length;
    const invItems = Array.isArray(this.state?.playerParty?.inventory?.items) ? this.state.playerParty.inventory.items : [];
    const totalInvQty = invItems.reduce((sum, item) => sum + Math.max(0, Math.floor(item?.qty ?? 0)), 0);
    const top = invItems.slice(0, 2).map((item) => `${item?.name || item?.id}:${Math.max(0, Math.floor(item?.qty ?? 0))}`).join(', ');
    const saveMeta = this.state?.lastSaveMeta;
    const minsAgo = saveMeta?.at ? Math.max(0, Math.floor((Date.now() - saveMeta.at) / 60000)) : null;
    const saveText = saveMeta?.slot ? `  Save:${saveMeta.slot}${minsAgo !== null ? ` (${minsAgo}m)` : ''}` : '';
    const riskText = this.state?.encounterRisk?.label ? `  Risk: ${this.state.encounterRisk.label}` : '';
    safeText(this.elements.hudStats, `Day:${Math.floor(this.state?.day ?? 1)}  Gold: ${gold}  XP: ${xp}  Morale: ${morale}  Units: ${totalUnits}  Wounded: ${wounded}  Inv:${totalInvQty}${top ? ` (${top})` : ''}${riskText}${saveText}`);
  }

  updateEventLine() {
    if (!this.elements.hudEvent) return;
    if (this.transientHintRestore) return;
    const message = this.state?.lastEventLog || this.state?.interactHint;
    safeText(this.elements.hudEvent, message || '');
    safeClass(this.elements.hudEvent, message ? 'remove' : 'add', 'hidden');
  }

  showTransientHint(text, ms = TUTORIAL_HINTS.COOLDOWN_MS) {
    const hintText = typeof text === 'string' ? text.trim() : '';
    if (!hintText) return false;
    const el = this.elements?.hudEvent;
    if (!el) {
      this.warnOnce('hud:hint-fallback', `[HUD] ${hintText}`);
      return false;
    }

    if (this.transientHintTimer) {
      clearTimeout(this.transientHintTimer);
      this.transientHintTimer = null;
    }

    this.transientHintRestore = this.transientHintRestore || {
      text: this.state?.lastEventLog || this.state?.interactHint || '',
      hidden: el.classList?.contains('hidden') ?? true,
    };

    safeText(el, hintText);
    safeClass(el, 'remove', 'hidden');

    const duration = Number.isFinite(ms) ? Math.max(250, Math.floor(ms)) : TUTORIAL_HINTS.COOLDOWN_MS;
    this.transientHintTimer = setTimeout(() => {
      const restore = this.transientHintRestore || { text: '', hidden: true };
      this.transientHintRestore = null;
      safeText(el, restore.text || '');
      safeClass(el, (restore.text || '').length > 0 ? 'remove' : 'add', 'hidden');
    }, duration);

    return true;
  }

  updateVisibility(mode) {
    if (!this.elements.hud) return;
    safeClass(this.elements.hud, mode === 'start' ? 'add' : 'remove', 'hidden');
    safeClass(this.elements.rosterPanel, mode === 'roster' ? 'remove' : 'add', 'hidden');
    const panelMode = mode === 'aftermath' || mode === 'city' || Boolean(this.state?.saveLoadOpen);
    safeClass(this.elements.uiPanel, panelMode ? 'remove' : 'add', 'hidden');
    this.updateRosterPanel();
    this.updateUiPanel();
  }

  updateRosterPanel() {
    if (!this.elements.rosterPanel) return;

    const mode = this.state?.mode;
    safeClass(this.elements.rosterPanel, mode === 'roster' ? 'remove' : 'add', 'hidden');
    if (mode !== 'roster') return;

    const enemyId = this.state?.roster?.enemyId ?? this.state?.encounter?.enemyId ?? 'unknown';
    const selected = Number.isFinite(this.state?.rosterSelectedCount) ? this.state.rosterSelectedCount : 0;
    const maxDeploy = Number.isFinite(this.state?.roster?.maxDeploy) ? this.state.roster.maxDeploy : 0;
    safeText(this.elements.rosterEnemy, `Battle Prep vs ${enemyId}  |  Selected ${selected}/${maxDeploy}`);
    safeText(this.elements.rosterWarning, this.state?.roster?.warning || '');

    if (this.elements.rosterPlayerList) {
      const roster = Array.isArray(this.state?.playerRoster) ? this.state.playerRoster : [];
      const cursorIndex = Number.isFinite(this.state?.rosterCursorIndex) ? this.state.rosterCursorIndex : -1;
      const playerRows = roster.map((unit, idx) => {
        const marker = idx === cursorIndex ? '>' : ' ';
        const selected = unit?.selected ? '[x]' : '[ ]';
        const effective = Number.isFinite(unit?.effectiveCount) ? unit.effectiveCount : 0;
        return `${marker} ${selected} ${unit?.name ?? 'Unit'} [${unit?.class ?? 'unit'}] HP ${Math.max(0, Math.floor(unit?.hp ?? 0))}/${Math.max(1, Math.floor(unit?.maxHp ?? unit?.hp ?? 1))}`;
      });
      safeText(this.elements.rosterPlayerList, playerRows.join('\n'));
    }

    if (this.elements.rosterEnemyList) {
      const roster = Array.isArray(this.state?.enemyRoster) ? this.state.enemyRoster : [];
      const enemyRows = roster.map((unit) => {
        const effective = Number.isFinite(unit?.effectiveCount) ? unit.effectiveCount : 0;
        return `${unit?.name ?? 'Unit'} [${unit?.class ?? 'unit'}] HP ${Math.max(0, Math.floor(unit?.hp ?? 0))}/${Math.max(1, Math.floor(unit?.maxHp ?? unit?.hp ?? 1))}`;
      });
      safeText(this.elements.rosterEnemyList, enemyRows.join('\n'));
    }
  }

  updateUiPanel() {
    if (!this.elements.uiPanel) return;
    const mode = this.state?.mode;
    const panelData = this.state?.uiPanel;
    const visible = (mode === 'aftermath' || mode === 'city' || Boolean(this.state?.saveLoadOpen)) && panelData;
    safeClass(this.elements.uiPanel, visible ? 'remove' : 'add', 'hidden');
    if (!visible) return;
    safeText(this.elements.uiPanelTitle, panelData.title || 'Panel');
    safeText(this.elements.uiPanelBody, panelData.body || '');
    safeText(this.elements.uiPanelFooter, panelData.footer || '');
  }

  show() { safeClass(this.elements.hud, 'remove', 'hidden'); }
  hide() { safeClass(this.elements.hud, 'add', 'hidden'); }

  addUIListener(key, target, event, handler) {
    if (!target || typeof target.addEventListener !== 'function') return;
    if (this.uiHandlers.has(key)) return;

    target.addEventListener(event, handler);
    this.uiHandlers.set(key, { target, event, handler });
  }

  setMenuHandlers({ onStart, onContinue, onQuitToMenu, onSettings, onCloseSettings, onVolumeChange } = {}) {
    this.menuActions.onStart = typeof onStart === 'function' ? onStart : null;
    this.menuActions.onContinue = typeof onContinue === 'function' ? onContinue : null;
    this.menuActions.onQuitToMenu = typeof onQuitToMenu === 'function' ? onQuitToMenu : null;
    this.menuActions.onSettings = typeof onSettings === 'function' ? onSettings : null;
    this.menuActions.onCloseSettings = typeof onCloseSettings === 'function' ? onCloseSettings : null;
    this.menuActions.onVolumeChange = typeof onVolumeChange === 'function' ? onVolumeChange : null;

    this.addUIListener('menu:start', this.elements.menuBtnStart, 'click', () => this.menuActions.onStart?.());
    this.addUIListener('menu:continue', this.elements.menuBtnContinue, 'click', () => this.menuActions.onContinue?.());
    this.addUIListener('menu:settings', this.elements.menuBtnSettings, 'click', () => this.menuActions.onSettings?.());
    this.addUIListener('menu:settings-close', this.elements.menuBtnCloseSettings, 'click', () => this.menuActions.onCloseSettings?.());
    this.addUIListener('menu:volume', this.elements.menuMasterVolume, 'input', (event) => this.menuActions.onVolumeChange?.(event?.target?.value));
    this.addUIListener('pause:quit', this.elements.btnQuitToMenu, 'click', () => this.menuActions.onQuitToMenu?.());
  }

  setMenuVisible(isVisible) {
    const visible = Boolean(isVisible);
    safeClass(this.elements.mainMenuOverlay, visible ? 'remove' : 'add', 'hidden');
    if (visible) this.setPaused(false);
  }

  showMenu(isVisible) {
    this.setMenuVisible(isVisible);
  }

  setContinueEnabled(canContinue) {
    if (!this.elements.menuBtnContinue) return;
    this.elements.menuBtnContinue.disabled = !canContinue;
  }

  setSettingsVisible(isVisible) {
    safeClass(this.elements.mainMenuSettingsPanel, isVisible ? 'remove' : 'add', 'hidden');
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
      this.listenerHandlers.forEach((handler, event) => this.state.off(event, handler));
    }

    this.listenerHandlers.clear();
    this.uiHandlers.forEach(({ target, event, handler }) => {
      if (!target || typeof target.removeEventListener !== 'function') return;
      target.removeEventListener(event, handler);
    });
    this.uiHandlers.clear();
    this.listenersBound = false;
    if (this.transientHintTimer) {
      clearTimeout(this.transientHintTimer);
      this.transientHintTimer = null;
    }
    this.transientHintRestore = null;
  }
}

export default HUDManager;
