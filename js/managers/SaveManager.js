import SaveSystem from '../systems/save-system.js';

export class SaveManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    this.saveSystem = null;
    this.saveLoadRows = ['autosave', 'manual1', 'manual2'];
    this.saveLoadCursor = 0;
    this.saveLoadPreviousMode = 'map';
    this.autosaveIntervalMs = 60000;
    this.autosaveTimerId = null;
    this.lastAutosaveHudAt = 0;
  }

  init(game) {
    this.game = game;
    this.saveSystem = this.saveSystem || new SaveSystem();
  }

  // ── Phase 4A: Slot, autosave, UI helpers ──────────────────────────

  getSelectedSaveSlot() {
    return this.saveLoadRows[Math.max(0, Math.min(this.saveLoadRows.length - 1, this.saveLoadCursor))] || 'manual1';
  }

  buildSaveLoadPanelData() {
    const day = Math.floor(this.state?.day ?? 1);
    const gold = Math.floor(this.game?.playerParty?.gold ?? 0);
    const rosterSize = (this.game?.playerParty?.roster || []).length;
    const rows = this.saveLoadRows.map((slot, idx) => {
      const mark = idx === this.saveLoadCursor ? '>' : ' ';
      const has = this.saveSystem?.hasSlot?.(slot) ? 'saved' : 'empty';
      return `${mark} ${slot} (${has})`;
    }).join('\n');
    return {
      title: 'Save / Load',
      body: `Day ${day}  Gold ${gold}  Roster ${rosterSize}

${rows}

Up/Down select slot
S save  L load
E export to textarea  I import from textarea
Esc close`,
      footer: 'Slots: autosave / manual1 / manual2',
    };
  }

  saveToSlot(slot) {
    const payload = this.game?.buildSavePayload?.();
    const res = this.saveSystem?.saveSlot?.(slot, payload);
    if (!res?.ok) {
      this.game?.setLastEventLog?.('Save failed');
      return false;
    }
    if (this.state) this.state.lastSaveMeta = { slot, at: Date.now() };
    this.game?.setLastEventLog?.(`Saved ${slot}`);
    this.game?.updateTransientUIState?.();
    return true;
  }

  loadFromSlot(slot) {
    const res = this.saveSystem?.loadSlot?.(slot);
    if (!res?.ok || !res.data) {
      this.game?.setLastEventLog?.(`Load failed: ${res?.reason || 'unknown'}`);
      return false;
    }
    const ok = this.game?.applySavePayload?.(res.data, { slot });
    if (!ok) {
      this.game?.setLastEventLog?.('Load failed');
      return false;
    }
    this.game?.setLastEventLog?.(`Loaded ${slot}`);
    return true;
  }

  startAutosaveLoop() {
    if (this.autosaveTimerId) return;
    const tick = () => {
      this.autosaveTimerId = null;
      if (this.state?.mode === 'map' && !this.state?.accounting && !this.state?.saveLoadOpen) {
        this.runAutosave('interval');
      }
      this.startAutosaveLoop();
    };
    this.autosaveTimerId = setTimeout(tick, this.autosaveIntervalMs);
  }

  stopAutosaveLoop() {
    if (!this.autosaveTimerId) return;
    clearTimeout(this.autosaveTimerId);
    this.autosaveTimerId = null;
  }

  runAutosave(trigger = 'manual') {
    const ok = this.saveToSlot('autosave');
    if (!ok) return false;
    const now = Date.now();
    if ((now - this.lastAutosaveHudAt) >= 30000 || trigger !== 'interval') {
      this.lastAutosaveHudAt = now;
      this.game?.setLastEventLog?.('Autosaved', 1600);
    }
    return true;
  }

  quickSave() {
    return this.saveToSlot('manual1');
  }

  quickLoad() {
    return this.loadFromSlot('manual1');
  }

  // ── Phase 4B: Save panel UI, export/import ────────────────────────

  openSaveLoadPanel() {
    if (typeof this.saveSystem?.openLoadPanel === 'function') {
      const opened = this.saveSystem.openLoadPanel();
      if (opened) return true;
    }

    if (this.state && !this.state.saveLoadOpen) {
      this.saveLoadPreviousMode = this.state.mode;
      this.state.saveLoadOpen = true;
      this.saveLoadCursor = 0;
      this.state.uiPanel = this.buildSaveLoadPanelData();
      this.game?.updateTransientUIState?.();
      return true;
    }

    const continued = this.game?.continueGame?.();
    if (!continued) {
      this.game?.startScreen?.setInfoMessage?.('Kayıt yükleme arayüzü yok; autosave yok.');
    }
    return continued;
  }

  closeSaveLoadPanel() {
    if (!this.state?.saveLoadOpen) return false;
    this.state.saveLoadOpen = false;
    this.state.uiPanel = null;
    this.game?.updateTransientUIState?.();
    return true;
  }

  exportSelectedSaveToTextarea(slot) {
    const json = this.saveSystem?.exportSlot?.(slot);
    if (!json) {
      this.game?.setLastEventLog?.('Export failed');
      return false;
    }
    if (this.game?.dom?.saveTransferText) {
      this.game.dom.saveTransferText.value = json;
      this.game.dom.saveTransferText.focus?.();
      this.game.dom.saveTransferText.select?.();
    }
    this.game?.setLastEventLog?.(`Exported ${slot}`);
    return true;
  }

  importTextareaToSlotAndLoad(slot) {
    const text = this.game?.dom?.saveTransferText?.value;
    if (!text || typeof text !== 'string') {
      this.game?.setLastEventLog?.('Import text is empty');
      return false;
    }
    const imported = this.saveSystem?.importToSlot?.(slot, text);
    if (!imported?.ok) {
      this.game?.setLastEventLog?.(`Import failed: ${imported?.reason || 'invalid json'}`);
      return false;
    }
    return this.loadFromSlot(slot);
  }
}
