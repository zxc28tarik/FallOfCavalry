/**
 * UIManager — Phase 9B
 * Handles DOM setup, event listener wiring, and UI component initialization.
 */

import * as utils from '../utils.js';
import * as CONST from '../constants.js';
import MinimapSimple from '../rendering/minimap-simple.js';
import SettingsUI from '../ui/settings.js';
import CodexUI from '../ui/codex.js';
import CampUI from '../ui/camp-ui.js';
import AccountingUI from '../ui/accounting-ui.js';
import PoiUI from '../ui/poi-ui.js';
import { serializeSettings } from '../systems/settings.js';
import * as campSystem from '../systems/camp.js';
import { rollWarEvents } from '../systems/events.js';
import { ensureWorldParties } from '../systems/world-ai.js';
import { toggleCurrentEventsModal } from '../ui/modals.js';

export class UIManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
  }

  init(game) {
    this.game = game;
  }

  update(dt) {
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
      hudMinimapPanel: utils.getEl('hudMinimapPanel'),
      hudMiniMap: utils.getEl('hudMiniMap'),
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
      codexBtn: utils.getEl('codexBtn'),
      helpOverlay: utils.getEl('helpOverlay'),
      helpCloseBtn: utils.getEl('helpCloseBtn'),
    };

    const optionalStartUi = new Set(['factionGrid', 'btnStart', 'btnContinue', 'btnLoadStart', 'seedInput', 'randomSeedBtn', 'startSaveInfo', 'selectedFactionName', 'selectedFactionDesc', 'selectedFactionDoc', 'selectedFactionArmy']);
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

    if (btnSave) btnSave.addEventListener('click', () => g.quickSave());
    if (btnLoad) btnLoad.addEventListener('click', () => g.openSaveLoadPanel());
    if (btnReset) btnReset.addEventListener('click', () => {
      if (confirm('Oyunu sıfırlamak istediğine emin misin?')) {
        g.saveSystem?.deleteSave?.();
        g.saveSystem?.deleteAutosave?.();
        location.reload();
      }
    });
    if (btnTransfer) btnTransfer.addEventListener('click', () => {
      document.getElementById('saveTransferModal')?.classList.remove('hidden');
    });
    if (btnExport) btnExport.addEventListener('click', () => {
      g.exportSelectedSaveToTextarea('manual1');
    });
    if (btnImport) btnImport.addEventListener('click', () => {
      g.importTextareaToSlotAndLoad('manual1');
      document.getElementById('saveTransferModal')?.classList.add('hidden');
    });
    if (btnCloseTransfer) btnCloseTransfer.addEventListener('click', () => {
      document.getElementById('saveTransferModal')?.classList.add('hidden');
    });

    g.minimapRenderer = new MinimapSimple(
      document.getElementById('hudMiniMap')
    );

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
        if (this.state?.mode === 'battle') g.togglePaused();
      });
    }

    g.setupDebugSmokePanel();
  }

  setupEventListeners() {
    const g = this.game;
    if (g.listenersBound || !this.state) return;

    this.state.on('mode:changed', ({ old, new: newMode }) => g.onModeChanged(old, newMode));
    this.state.on('day:advanced', (day) => {
      this.state.dailyLedger = { tradePL: 0 };
      g.refreshWeatherState(day);
      const activeEvents = g.refreshCurrentEventsSummary(day);
      rollWarEvents({
        eventState: this.state.events,
        warState: this.state.warState,
        factionsState: this.state.factions,
        worldState: this.state?.map || {},
        currentDay: day,
        cfg: g.getEffectiveTuning().EVENTS || CONST.EVENTS,
      });
      const rolledEvents = g.refreshCurrentEventsSummary(day);
      if ((g.getEffectiveTuning().WORLD_AI || CONST.WORLD_AI).ENABLED) {
        ensureWorldParties({
          aiState: g.worldAi,
          worldState: this.state?.map || {},
          factions: this.state?.factions || CONST.FACTIONS,
          cfg: g.getWorldAiCfgWithRegionMods(),
          currentDay: day,
          banditCapOverride: g.getBanditCapWithEvents(rolledEvents.length ? rolledEvents : activeEvents),
        });
      }
      g.getCurrentRegionModifiers(day);
      utils.devLog(this.state, `[Game] Day ${day} started`);
    });
    this.state.on('player:gold:changed', ({ old, new: newGold, delta }) => {
      utils.devLog(this.state, `[Game] Gold: ${old} → ${newGold} (${delta >= 0 ? '+' : ''}${delta})`);
    });

    this.state.on('render:start', () => g.renderStart());
    this.state.on('render:map', () => g.renderMap());
    this.state.on('render:city', () => g.renderCity());
    this.state.on('render:battle', () => g.renderBattle());
    this.state.on('render:encounter', () => g.renderEncounter());
    this.state.on('map:update', (dt) => g.updateMapSimulation(dt));
    this.state.on('encounter:update', () => g.updateTransientUIState());
    this.state.on('battle:update', (dt) => g.updateBattleSimulation(dt));
    this.state.on('city:update', () => g.updateTransientUIState());

    g.setupKeyboardShortcuts();
    this.state.on('day:tick', (day) => g.processDailyEconomy(day));
    this.state.on('ui:events:toggle', () => {
      const events = g.refreshCurrentEventsSummary(this.state?.day ?? 1);
      toggleCurrentEventsModal({ events, currentDay: this.state?.day ?? 1 });
    });
    g.listenersBound = true;
  }

  setupMenuActions() {
    const g = this.game;
    if (!g.hudManager || typeof g.hudManager.setMenuHandlers !== 'function') return;

    g.hudManager.setMenuHandlers({
      onStart: () => g.enterStart(),
      onContinue: () => g.continueGame(),
      onQuitToMenu: () => g.quitToMenu(),
      onSettings: () => g.openSettings(),
      onCloseSettings: () => g.closeSettings(),
      onVolumeChange: (value) => g.applyMasterVolume(value),
      onHudHelp: () => g.toggleHelpOverlay(),
      onHudSettings: () => g.settingsUI?.toggle?.(),
      onHudCodex: () => g.codexUI?.toggle?.(),
    });

    g.hudManager?.setRosterHandlers?.({
      onToggleUnit: (index) => {
        if (!Number.isInteger(index)) return;
        g.rosterCursorIndex = index;
        g.toggleRosterSelectionAtCursor();
      },
    });
  }

  setupSettingsUI() {
    const g = this.game;
    const toggleHints = g.dom?.toggleHints;
    g.ensureTutorialState();
    if (toggleHints) {
      toggleHints.checked = Boolean(this.state?.tutorial?.enabled);
      if (toggleHints.dataset.boundHintToggle !== '1') {
        toggleHints.dataset.boundHintToggle = '1';
        toggleHints.addEventListener('change', (event) => {
          g.ensureTutorialState();
          const checked = Boolean(event?.target?.checked);
          this.state.tutorial.enabled = checked;
          if (!checked) this.state.tutorial.lastShownAt = 0;
        });
      }
    }

    if (!g.settingsUI) {
      g.settingsUI = new SettingsUI({
        getSettings: () => g.settings,
        cfg: CONST.SETTINGS,
        onApply: (nextSettings) => {
          g.settings = nextSettings;
          this.state.settings = serializeSettings(nextSettings);
        },
      });
    }

    if (!g.codexUI) g.codexUI = new CodexUI();
  }

  setupCampUI() {
    const g = this.game;
    if (g.campUI) return;
    g.campUI = new CampUI({
      state: this.state,
      onClose: () => {
        if (this.state?.camp?.active) campSystem.toggleCamp(this.state);
        g.campUI?.hide?.();
      },
      onSetWatch: (level) => {
        campSystem.setWatch(this.state, level);
      },
    });

    g.campUI.bind({
      root: utils.getEl('campModal'),
      closeBtn: utils.getEl('campCloseBtn'),
      status: utils.getEl('campStatusText'),
    });
  }

  setupAccountingUI() {
    const g = this.game;
    if (g.accountingUI) return;
    g.accountingUI = new AccountingUI();
    g.accountingUI.bind({
      modal: g.dom.accountingModal,
      body: g.dom.accountingBody,
      btnContinue: g.dom.btnAccountingContinue,
    });

    if (g.dom.btnAccountingContinue && !g._accountingContinueBound) {
      g._accountingContinueBound = true;
      g.dom.btnAccountingContinue.addEventListener('click', () => {
        g.closeAccountingModal();
      });
    }
  }

  setupPoiUI() {
    const g = this.game;
    if (g.poiUI) return;
    g.poiUI = new PoiUI();
    g.poiUI.bind({
      modal: g.dom.poiModal,
      title: g.dom.poiTitle,
      desc: g.dom.poiDesc,
      cooldown: g.dom.poiCooldown,
      result: g.dom.poiResult,
      btnClose: g.dom.btnClosePoi,
      btnInvestigate: g.dom.btnPoiInvestigate,
      btnLeave: g.dom.btnPoiLeave,
    });
    g.poiUI.onLeave = () => {
      g.resolvePoiFollowup();
      g.activePoi = null;
    };
    g.poiUI.onInvestigate = () => {
      g.investigateActivePoi();
    };
  }
}
