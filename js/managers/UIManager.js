/**
 * UIManager — Phase 9B
 * Handles DOM setup, event listener wiring, and UI component initialization.
 */

import * as utils from '../utils.js';
import * as CONST from '../constants.js';
import { computeWeatherForDay } from '../systems/weather.js';
import { setWeatherState } from '../rendering/weather-layer.js';
import SettingsUI from '../ui/settings.js';
import CodexUI from '../ui/codex.js';
import CampUI from '../ui/camp-ui.js';
import AccountingUI from '../ui/accounting-ui.js';
import PoiUI from '../ui/poi-ui.js';
import WorldMapOverlay from '../ui/world-map-overlay.js';
import { serializeSettings } from '../systems/settings.js';
import * as campSystem from '../systems/camp.js';
import { rollWarEvents } from '../systems/events.js';
import { ensureWorldParties } from '../systems/world-ai.js';
import { toggleCurrentEventsModal } from '../ui/modals.js';

// ─── Module-level helpers (Phase 11B) ────────────────────────────────────────

function formatBuildTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function chooseTutorialHint({ state, mode, nearSettlement, nearPoi, inCamp, inBattleDeploy, inBattleFight, inEncounter }) {
  if (!state || typeof state !== 'object') return null;
  const tutorial = state.tutorial && typeof state.tutorial === 'object' ? state.tutorial : null;
  if (!tutorial?.enabled) return null;

  const day = Number(state.day ?? 1);
  const timeSec = Number(state.timeSec ?? 0);
  const outOfDayWindow = day > CONST.TUTORIAL_HINTS.MAX_DAYS;
  const outOfTimeWindow = Number.isFinite(timeSec) && timeSec > CONST.TUTORIAL_HINTS.MAX_REALTIME_SEC;
  if (outOfDayWindow && outOfTimeWindow) return null;

  const now = Date.now();
  const lastShownAt = Number(tutorial.lastShownAt ?? 0);
  if (Number.isFinite(lastShownAt) && (now - lastShownAt) < CONST.TUTORIAL_HINTS.COOLDOWN_MS) return null;

  const shown = tutorial.shown && typeof tutorial.shown === 'object' ? tutorial.shown : {};
  const candidates = [
    inEncounter ? 'encounter' : null,
    inBattleDeploy ? 'battleDeploy' : null,
    inBattleFight ? 'battleCmd' : null,
    nearSettlement ? 'city' : null,
    nearPoi ? 'poi' : null,
    inCamp ? 'camp' : null,
    mode === 'map' ? 'movement' : null,
  ].filter(Boolean);

  const key = candidates
    .filter((candidate) => !shown[candidate] && CONST.HINT_TEXT[candidate])
    .sort((a, b) => (CONST.TUTORIAL_HINTS.PRIORITY[b] ?? 0) - (CONST.TUTORIAL_HINTS.PRIORITY[a] ?? 0))[0];

  if (!key) return null;
  return { key, text: CONST.HINT_TEXT[key] };
}

export class UIManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.campUI = null;
    this.accountingUI = null;
    this.settingsUI = null;
    this.codexUI = null;
    this.poiUI = null;
    this.worldMapOverlay = null;
    this.helpOverlayVisible = false;
    this.listenersBound = false;
    this.weatherState = { type: 'CLEAR', timeOfDay: 'DAY' };
  }

  init(game) {
    this.game = game;
  }

  update(_dt) {
    // UI update logic - extended in future phases
  }

  // ─── Phase 9B: DOM + event setup ─────────────────────────────────────────────

  setupDOMReferences() {
    const g = this.game;
    g.dom = {
      hud: utils.getEl('hud'),
      hudFaction: utils.getEl('hudFaction'),
      hudGold: utils.getEl('hudGold'),
      hudArmy: utils.getEl('hudArmy'),
      hudRenown: utils.getEl('hudRenown'),
      hudDay: utils.getEl('hudDay'),
      startModal: utils.getEl('startModal'),
      factionGrid: utils.getEl('factionGrid'),
      btnStart: utils.getEl('btnStart'),
      btnContinue: utils.getEl('btnContinue'),
      btnLoadStart: utils.getEl('btnLoadStart'),
      seedInput: utils.getEl('seedInput'),
      randomSeedBtn: utils.getEl('randomSeedBtn'),
      startSaveInfo: utils.getEl('startSaveInfo'),
      selectedFactionName: utils.getEl('selectedFactionName'),
      selectedFactionDesc: utils.getEl('selectedFactionDesc'),
      selectedFactionDoc: utils.getEl('selectedFactionDoc'),
      selectedFactionArmy: utils.getEl('selectedFactionArmy'),
      mainMenuOverlay: utils.getEl('mainMenuOverlay'),
      settlementModal: utils.getEl('settlementModal'),
      citySceneModal: utils.getEl('citySceneModal'),
      encounterModal: utils.getEl('encounterModal'),
      poiModal: utils.getEl('poiModal'),
      poiTitle: utils.getEl('poiTitle'),
      poiDesc: utils.getEl('poiDesc'),
      poiCooldown: utils.getEl('poiCooldown'),
      poiResult: utils.getEl('poiResult'),
      btnClosePoi: utils.getEl('btnClosePoi'),
      btnPoiInvestigate: utils.getEl('btnPoiInvestigate'),
      btnPoiLeave: utils.getEl('btnPoiLeave'),
      battleResultModal: utils.getEl('battleResultModal'),
      battleCommandBar: utils.getEl('battleCommandBar'),
      battleDeployOverlay: utils.getEl('battleDeployOverlay'),
      btnDeployStart: utils.getEl('btnDeployStart'),
      btnDeployCancel: utils.getEl('btnDeployCancel'),
      deployHint: utils.getEl('deployHint'),
      toggleHints: utils.getEl('toggleHints'),
      tooltip: utils.getEl('tooltip'),
      debugOverlay: utils.getEl('debugOverlay'),
      saveTransferText: utils.getEl('saveTransferText'),
      accountingModal: utils.getEl('accountingModal'),
      accountingBody: utils.getEl('accountingBody'),
      btnAccountingContinue: utils.getEl('btnAccountingContinue'),
      tuningModal: utils.getEl('tuningModal'),
      tuningBody: utils.getEl('tuningBody'),
      btnCloseTuning: utils.getEl('btnCloseTuning'),
      btnTuningSave: utils.getEl('btnTuningSave'),
      btnTuningReset: utils.getEl('btnTuningReset'),
      buildInfo: utils.getEl('buildInfo'),
      helpBtn: utils.getEl('helpBtn'),
      settingsBtn: utils.getEl('settingsBtn'),
      codexBtn: utils.getEl('codexBtn', { silent: true }),
      helpOverlay: utils.getEl('helpOverlay'),
      helpCloseBtn: utils.getEl('helpCloseBtn'),
      worldMapToggleBtn: utils.getEl('worldMapToggleBtn'),
      worldMapOverlay: utils.getEl('worldMapOverlay'),
      worldMapCanvas: utils.getEl('worldMapCanvas'),
      worldMapCloseBtn: utils.getEl('worldMapCloseBtn'),
      worldMapSummary: utils.getEl('worldMapSummary'),
      worldMapFooter: utils.getEl('worldMapFooter'),
    };

    const optionalStartUi = new Set([
      'factionGrid',
      'btnStart',
      'btnContinue',
      'btnLoadStart',
      'seedInput',
      'randomSeedBtn',
      'startSaveInfo',
      'selectedFactionName',
      'selectedFactionDesc',
      'selectedFactionDoc',
      'selectedFactionArmy',
      'codexBtn',
    ]);
    const missing = Object.entries(g.dom).filter(([key, el]) => !el && !optionalStartUi.has(key)).map(([key]) => key);
    if (missing.length) {
      g.warnOnce('game:missing-dom-ids', `[Game] Missing DOM ids: ${missing.join(', ')}`);
    }

    const btnSave = document.getElementById('btnSaveGame');
    const btnLoad = document.getElementById('btnLoadGame');
    const btnReset = document.getElementById('btnResetGame');
    const btnTransfer = document.getElementById('btnOpenSaveTransfer');
    const btnExport = document.getElementById('btnExportSave');
    const btnImport = document.getElementById('btnImportSave');
    const btnCloseTransfer = document.getElementById('btnCloseSaveTransfer');

    if (btnSave) btnSave.addEventListener('click', () => g.saveManager.quickSave());
    if (btnLoad) btnLoad.addEventListener('click', () => g.saveManager.openSaveLoadPanel());
    if (btnReset) btnReset.addEventListener('click', () => {
      if (confirm('Oyunu sıfırlamak istediğine emin misin?')) {
        g.saveManager.saveSystem?.deleteSave?.();
        g.saveManager.saveSystem?.deleteAutosave?.();
        location.reload();
      }
    });
    if (btnTransfer) btnTransfer.addEventListener('click', () => {
      document.getElementById('saveTransferModal')?.classList.remove('hidden');
    });
    if (btnExport) btnExport.addEventListener('click', () => {
      g.saveManager.exportSelectedSaveToTextarea('manual1');
    });
    if (btnImport) btnImport.addEventListener('click', () => {
      g.saveManager.importTextareaToSlotAndLoad('manual1');
      document.getElementById('saveTransferModal')?.classList.add('hidden');
    });
    if (btnCloseTransfer) btnCloseTransfer.addEventListener('click', () => {
      document.getElementById('saveTransferModal')?.classList.add('hidden');
    });

    if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
      document.querySelectorAll('[data-battle-speed]').forEach(btn => {
        btn.addEventListener('click', () => {
          const speed = parseFloat(btn.dataset.battleSpeed);
          if (!Number.isFinite(speed)) return;
          if (this.state?.battle) this.state.battleSpeed = speed;
          document.querySelectorAll('[data-battle-speed]')
            .forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
        });
      });
    }

    const btnBattlePause = document.getElementById('btnBattlePause');
    if (btnBattlePause) {
      btnBattlePause.addEventListener('click', () => {
        if (this.state?.mode === 'battle') g.gameFlowManager.togglePaused();
      });
    }

    g.devManager.setupDebugSmokePanel();
  }

  setupEventListeners() {
    const g = this.game;
    if (this.listenersBound || !this.state) return;

    this.state.on('mode:changed', ({ old, new: newMode }) => g.uiManager.onModeChanged(old, newMode));
    this.state.on('day:advanced', (day) => {
      this.state.dailyLedger = { tradePL: 0 };
      g.uiManager.refreshWeatherState(day);
      const activeEvents = g.gameFlowManager.refreshCurrentEventsSummary(day);
      rollWarEvents({
        eventState: this.state.events,
        warState: this.state.warState,
        factionsState: this.state.factions,
        worldState: this.state?.map || {},
        currentDay: day,
        cfg: g.tuningManager.getEffectiveTuning().EVENTS || CONST.EVENTS,
      });
      const rolledEvents = g.gameFlowManager.refreshCurrentEventsSummary(day);
      if ((g.tuningManager.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED) {
        ensureWorldParties({
          aiState: g.worldManager.worldAi,
          worldState: this.state?.map || {},
          factions: this.state?.factions || CONST.FACTIONS,
          cfg: g.worldManager.getWorldAiCfgWithRegionMods(),
          currentDay: day,
          banditCapOverride: g.worldManager.getBanditCapWithEvents(rolledEvents.length ? rolledEvents : activeEvents),
        });
      }
      g.worldManager.getCurrentRegionModifiers(day);
      utils.devLog(this.state, `[Game] Day ${day} started`);
    });
    this.state.on('player:gold:changed', ({ old, new: newGold, delta }) => {
      utils.devLog(this.state, `[Game] Gold: ${old} → ${newGold} (${delta >= 0 ? '+' : ''}${delta})`);
    });

    this.state.on('render:start', () => g.renderManager.renderStart());
    this.state.on('render:map', () => {
      g.renderManager.renderMap();
      this.refreshWorldMapOverlay();
    });
    this.state.on('render:city', () => g.renderManager.renderCity());
    this.state.on('render:battle', () => g.battleManager.renderBattle());
    this.state.on('render:encounter', () => g.renderManager.renderEncounter());
    this.state.on('map:update', (dt) => g.worldManager.updateMapSimulation(dt));
    this.state.on('encounter:update', () => g.worldManager.updateTransientUIState());
    this.state.on('battle:update', (dt) => g.battleManager.updateBattleSimulation(dt));
    this.state.on('city:update', () => g.worldManager.updateTransientUIState());

    g.inputManager.setupKeyboardShortcuts();
    this.state.on('day:tick', (day) => g.economyManager.processDailyEconomy(day));
    this.state.on('ui:events:toggle', () => {
      const events = g.gameFlowManager.refreshCurrentEventsSummary(this.state?.day ?? 1);
      toggleCurrentEventsModal({ events, currentDay: this.state?.day ?? 1 });
    });
    this.listenersBound = true;
  }

  setupMenuActions() {
    const g = this.game;
    if (!g.hudManager || typeof g.hudManager.setMenuHandlers !== 'function') return;

    g.hudManager.setMenuHandlers({
      onStart: () => g.gameFlowManager.enterStart(),
      onContinue: () => g.gameFlowManager.continueGame(),
      onQuitToMenu: () => g.gameFlowManager.enterMenu(),
      onSettings: () => g.gameFlowManager.openSettings(),
      onCloseSettings: () => g.gameFlowManager.closeSettings(),
      onVolumeChange: (value) => g.gameFlowManager.applyMasterVolume(value),
      onHudHelp: () => g.uiManager.toggleHelpOverlay(),
      onHudSettings: () => this.settingsUI?.toggle?.(),
      onHudCodex: () => this.codexUI?.toggle?.(),
    });

    g.hudManager?.setRosterHandlers?.({
      onToggleUnit: (index) => {
        if (!Number.isInteger(index)) return;
        g.encounterManager.rosterCursorIndex = index;
        g.encounterManager.toggleRosterSelectionAtCursor();
      },
    });
  }

  setupSettingsUI() {
    const g = this.game;
    const toggleHints = g.dom?.toggleHints;
    g.uiManager.ensureTutorialState();
    if (toggleHints) {
      toggleHints.checked = Boolean(this.state?.tutorial?.enabled);
      if (toggleHints.dataset.boundHintToggle !== '1') {
        toggleHints.dataset.boundHintToggle = '1';
        toggleHints.addEventListener('change', (event) => {
          g.uiManager.ensureTutorialState();
          const checked = Boolean(event?.target?.checked);
          this.state.tutorial.enabled = checked;
          if (!checked) this.state.tutorial.lastShownAt = 0;
        });
      }
    }

    if (!this.settingsUI) {
      this.settingsUI = new SettingsUI({
        getSettings: () => g.settings,
        cfg: CONST.SETTINGS,
        onApply: (nextSettings) => {
          g.settings = nextSettings;
          this.state.settings = serializeSettings(nextSettings);
        },
      });
    }

    if (!this.codexUI) this.codexUI = new CodexUI();
  }

  setupWorldMapOverlay() {
    if (this.worldMapOverlay) return;
    const g = this.game;
    this.worldMapOverlay = new WorldMapOverlay(this.state);
    this.worldMapOverlay.bind(g, {
      overlay: g.dom?.worldMapOverlay,
      canvas: g.dom?.worldMapCanvas,
      closeBtn: g.dom?.worldMapCloseBtn,
      toggleBtn: g.dom?.worldMapToggleBtn,
      summary: g.dom?.worldMapSummary,
      footer: g.dom?.worldMapFooter,
    });
    this.worldMapOverlay.setLauncherVisible(this.state?.mode === 'map');
  }

  isWorldMapVisible() {
    return Boolean(this.worldMapOverlay?.isVisible?.());
  }

  toggleWorldMapOverlay(force = null) {
    if (!this.worldMapOverlay || this.state?.mode !== 'map') {
      this.worldMapOverlay?.toggle?.(false);
      return false;
    }
    return this.worldMapOverlay.toggle(force);
  }

  refreshWorldMapOverlay(forceBase = false) {
    if (!this.worldMapOverlay?.isVisible?.()) return false;
    return this.worldMapOverlay.render(forceBase);
  }

  setupCampUI() {
    if (this.campUI) return;
    this.campUI = new CampUI({
      state: this.state,
      onClose: () => {
        if (this.state?.camp?.active) campSystem.toggleCamp(this.state);
        this.campUI?.hide?.();
      },
      onSetWatch: (level) => {
        campSystem.setWatch(this.state, level);
      },
    });

    this.campUI.bind({
      root: utils.getEl('campModal'),
      closeBtn: utils.getEl('campCloseBtn'),
      status: utils.getEl('campStatusText'),
    });
  }

  setupAccountingUI() {
    const g = this.game;
    if (this.accountingUI) return;
    this.accountingUI = new AccountingUI();
    this.accountingUI.bind({
      modal: g.dom.accountingModal,
      body: g.dom.accountingBody,
      btnContinue: g.dom.btnAccountingContinue,
    });

    if (g.dom.btnAccountingContinue && !g._accountingContinueBound) {
      g._accountingContinueBound = true;
      g.dom.btnAccountingContinue.addEventListener('click', () => {
        g.uiManager.closeAccountingModal();
      });
    }
  }

  setupPoiUI() {
    const g = this.game;
    if (this.poiUI) return;
    this.poiUI = new PoiUI();
    this.poiUI.bind({
      modal: g.dom.poiModal,
      title: g.dom.poiTitle,
      desc: g.dom.poiDesc,
      cooldown: g.dom.poiCooldown,
      result: g.dom.poiResult,
      btnClose: g.dom.btnClosePoi,
      btnInvestigate: g.dom.btnPoiInvestigate,
      btnLeave: g.dom.btnPoiLeave,
    });
    this.poiUI.onLeave = () => {
      g.poiManager.resolvePoiFollowup();
      g.poiManager.activePoi = null;
    };
    this.poiUI.onInvestigate = () => {
      g.poiManager.investigateActivePoi();
    };
  }

  // ─── Phase 11B: UI state & mode methods ──────────────────────────────────────

  onModeChanged(oldMode, newMode) {
    const g = this.game;
    utils.devLog(this.state, `[Game] Mode changed: ${oldMode} → ${newMode}`);
    if (newMode !== 'map') {
      this.poiUI?.hide?.();
      g.poiManager.activePoi = null;
      if (this.state) this.state.interactHint = '';
    }
    if (newMode !== 'map') this.toggleWorldMapOverlay(false);
    this.worldMapOverlay?.setLauncherVisible?.(newMode === 'map');
    if (newMode === 'start') {
      utils.safeClass(g.dom.hud, 'add', 'hidden');
      utils.safeClass(g.dom.startModal, 'remove', 'hidden');
      utils.safeClass(g.dom.mainMenuOverlay, 'add', 'hidden');
      g.gameFlowManager.startScreen?.refresh?.();
      g.battleManager.battleCommandsUI?.hide?.();
      return;
    }

    utils.safeClass(g.dom.hud, 'remove', 'hidden');
    utils.safeClass(g.dom.startModal, 'add', 'hidden');
    utils.safeClass(g.dom.mainMenuOverlay, 'add', 'hidden');
    if (newMode !== 'city') g.cityUI?.hide?.();
    if (newMode === 'battle') g.battleManager.battleCommandsUI?.show?.();
    else g.battleManager.battleCommandsUI?.hide?.();
    if (newMode !== 'battle') g.battleManager.battleDeployUI?.hide?.();
  }

  updateBuildInfoBadge() {
    const g = this.game;
    const el = g.dom?.buildInfo;
    if (!el) return;

    const version = typeof CONST.BUILD_INFO?.version === 'string' ? CONST.BUILD_INFO.version.trim() : '';
    const builtAt = typeof CONST.BUILD_INFO?.builtAt === 'string' ? CONST.BUILD_INFO.builtAt.trim() : '';

    if (!version && !builtAt) {
      el.classList.add('hidden');
      return;
    }

    const stamp = formatBuildTimestamp(builtAt);
    const pieces = [];
    if (version) pieces.push(`v${version}`);
    if (stamp) pieces.push(stamp);
    el.textContent = pieces.join(' • ');
    el.classList.remove('hidden');
  }

  applyDevOnlyDomLock() {
    const devOnlyIds = ['tuningModal', 'debugOverlay', 'debugSmokePanel', 'fpsOverlay', 'perfOverlay', 'debugStats'];
    if (typeof document === 'undefined') return;
    for (const id of devOnlyIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!this.state?.devMode) {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        el.setAttribute('inert', '');
        el.style.pointerEvents = 'none';
      } else {
        el.removeAttribute('inert');
        el.style.pointerEvents = '';
        el.removeAttribute('aria-hidden');
      }
    }
  }

  ensureHudEventsButton() {
    if (typeof document === 'undefined') return;
    let btn = document.getElementById('hudEventsBtn');
    if (!btn) {
      const anchor = document.getElementById('hudEvent');
      if (!anchor || !anchor.parentElement) return;
      btn = document.createElement('button');
      btn.id = 'hudEventsBtn';
      btn.className = 'action-btn btn-dark text-xs mt-2';
      btn.textContent = 'Events';
      anchor.parentElement.appendChild(btn);
    }
  }

  toggleHelpOverlay(force = null) {
    const g = this.game;
    const next = typeof force === 'boolean' ? force : !this.helpOverlayVisible;
    this.helpOverlayVisible = next;
    if (g.dom?.helpOverlay) g.dom.helpOverlay.classList.toggle('hidden', !next);
  }

  setupHelpOverlay() {
    const g = this.game;
    const body = g.dom?.helpOverlay?.querySelector?.('.frame-dark');
    if (body) {
      body.textContent = 'Hotkeys: H Hold, F Focus/Follow, R Retreat, K Skirmish/Camp, X Hold Fire/Cancel, E POI, C City, M World Map, Esc Pause, J Codex, S Settings, ? Help.';
    }
    if (!g.dom?.helpCloseBtn || g.dom.helpCloseBtn.dataset.boundHelpClose === '1') return;
    g.dom.helpCloseBtn.dataset.boundHelpClose = '1';
    g.dom.helpCloseBtn.addEventListener('click', () => this.toggleHelpOverlay(false));
  }

  maybeShowTutorialHint(context = {}) {
    const g = this.game;
    g.uiManager.ensureTutorialState();
    const hint = chooseTutorialHint({ state: this.state, mode: this.state?.mode, ...context });
    if (!hint) return false;
    this.state.tutorial.lastShownAt = Date.now();
    this.state.tutorial.shown[hint.key] = true;
    if (!g.hudManager?.showTransientHint?.(hint.text, CONST.TUTORIAL_HINTS.COOLDOWN_MS)) {
      g.gameFlowManager.setLastEventLog(hint.text, CONST.TUTORIAL_HINTS.COOLDOWN_MS);
    }
    return true;
  }

  // ─── Phase 11C: Camp & accounting UI ─────────────────────────────────────────

  toggleCampMode() {
    const g = this.game;
    campSystem.ensureCampState(this.state);
    const active = campSystem.toggleCamp(this.state);
    if (active) g.uiManager.maybeShowTutorialHint({ nearSettlement: false, nearPoi: false, inCamp: true, inBattleDeploy: false, inBattleFight: false, inEncounter: false });
    if (active) {
      g.worldManager.cancelPlayerDestination();
      const { weight, cap } = g.economyManager.getLogisticsSpeedMult();
      const mult = CONST.CAMP.WATCH_MULT[this.state?.camp?.watch || 'med'] ?? 1;
      const raidChance = `${Math.round(CONST.CAMP.RAID_BASE_CHANCE * mult * 100)}%`;
      this.campUI?.show?.({ weight, capacity: cap, raidChance });
      g.gameFlowManager.setLastEventLog('Kamp kuruldu.');
    } else {
      this.campUI?.hide?.();
      g.gameFlowManager.setLastEventLog('Kamptan çıkıldı.');
    }
  }

  closeAccountingModal() {
    const g = this.game;
    this.accountingUI?.hide?.();
    this.state.accounting = null;
    this.state.uiPanel = null;
    if (this.state) this.state.paused = false;
    g.worldManager.updateTransientUIState();
    g.saveManager.runAutosave('accounting-close');
    return true;
  }

  // ─── Phase 12C: Weather, canvas, tutorial state ───────────────────────────────

  ensureTutorialState() {
    if (!this.state || typeof this.state !== 'object') return;
    const current = this.state.tutorial && typeof this.state.tutorial === 'object' ? this.state.tutorial : {};
    const shown = current.shown && typeof current.shown === 'object' ? current.shown : {};
    this.state.tutorial = {
      enabled: typeof current.enabled === 'boolean' ? current.enabled : CONST.TUTORIAL_HINTS.ENABLED_DEFAULT,
      lastShownAt: Number.isFinite(current.lastShownAt) ? current.lastShownAt : 0,
      shown,
    };
  }

  getWeatherConfig() {
    const g = this.game;
    return {
      ...CONST.WEATHER,
      ENABLED: Boolean(CONST.WEATHER?.ENABLED)
        && Boolean(CONST.DIMETRIC?.ENABLE_WEATHER_EFFECTS)
        && Boolean(g.settings?.weatherEnabled),
    };
  }

  getWeatherRegionId() {
    const g = this.game;
    const tilePos = g.worldManager.getTilePosition(g.playerParty?.x ?? 0, g.playerParty?.y ?? 0);
    const nearestSettlement = g.worldManager.getNearestSettlementAt(tilePos.tx, tilePos.ty);
    if (nearestSettlement?.id) return String(nearestSettlement.id);
    return `${tilePos.tx}:${tilePos.ty}`;
  }

  refreshWeatherState(dayIndex = Number(this.state?.day ?? 1)) {
    const weatherCfg = this.getWeatherConfig();
    if (!weatherCfg?.ENABLED) {
      this.weatherState = { type: 'CLEAR', timeOfDay: 'DAY' };
      this.state.weatherState = this.weatherState;
      setWeatherState(this.weatherState);
      return;
    }
    const weather = computeWeatherForDay({
      worldSeed: this.state?.seed ?? 1337,
      dayIndex,
      regionId: this.getWeatherRegionId(),
    });
    this.weatherState = weather;
    this.state.weatherState = weather;
    setWeatherState(weather);
  }

  setupCanvas() {
    const g = this.game;
    if (g.resizeHandler || !g.canvas) return;
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    const resize = () => {
      g.canvas.width = typeof window.innerWidth === 'number' ? window.innerWidth : g.canvas.width;
      g.canvas.height = typeof window.innerHeight === 'number' ? window.innerHeight : g.canvas.height;
      utils.devLog(this.state, `[Canvas] Resized to ${g.canvas.width}x${g.canvas.height}`);
    };

    g.resizeHandler = resize;
    resize();
    window.addEventListener('resize', resize);
  }
}
