import * as CONST from '../constants.js';
import { toggleCurrentEventsModal } from '../ui/modals.js';

export class GameInputManager {
  constructor(gameState) {
    this.state = gameState;
    this.game = null;
    // pointer tracking state
    this.rightPointerTracking = false;
    this.rightPointerMoved = false;
    this.rightPointerStartX = 0;
    this.rightPointerStartY = 0;
    this._wheelBound = false;
    // event handler refs
    this.partyPointerHandler = null;
    this.partyContextMenuHandler = null;
    this.partyPointerMoveHandler = null;
    this.partyPointerUpHandler = null;
    this.keyboardHandler = null;
  }

  init(game) {
    this.game = game;
  }

  setupPartyInputHandlers() {
    const g = this.game;
    if (!g?.canvas || this.partyPointerHandler || this.partyContextMenuHandler || this.partyPointerMoveHandler || this.partyPointerUpHandler) return;

    this.partyPointerHandler = (event) => {
      if (g.state?.mode === 'battle') {
        if (event?.button !== 0) return;
        const rect = g.canvas.getBoundingClientRect();
        const x = (event?.clientX ?? 0) - rect.left;
        const y = (event?.clientY ?? 0) - rect.top;

        if (g.state?.battle?.phase === 'deploy' && g.battleManager.battleDeployMode?.active) {
          g.battleManager.battleDeployMode.setAnchor(x, y);
          return;
        }

        const hit = (g.state?.battle?.playerUnits || []).find((u) => !u.dead && Math.hypot(u.x - x, u.y - y) <= ((u.radius ?? 10) + 8));
        if (!hit) return;
        g.state.battle.selection = g.state.battle.selection || {};
        g.state.battle.selection.unitId = hit.unitId;
        return;
      }

      if (!g.playerParty || g.mode === 'menu' || g.state?.mode !== 'map') return;

      const rect = typeof g.canvas.getBoundingClientRect === 'function'
        ? g.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = g.updatePointerWorldState(screenX, screenY);

      if (event?.button === 0) {
        if (event?.shiftKey) {
          g.setPlayerDestination(world.x, world.y);
          return;
        }

        if (g.isWorldPointOnParty(world.x, world.y)) {
          g.playerParty.selected = !g.playerParty.selected;
        } else {
          g.playerParty.selected = false;
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
      if (g.state?.mode === 'battle') {
        return;
      }

      if (!this.rightPointerTracking || !g.playerParty || g.mode === 'menu' || g.state?.mode !== 'map') return;

      const rect = typeof g.canvas.getBoundingClientRect === 'function'
        ? g.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const moved = Math.hypot(screenX - this.rightPointerStartX, screenY - this.rightPointerStartY);
      if (moved > 8) {
        this.rightPointerMoved = true;
      }
      g.updatePointerWorldState(screenX, screenY);
    };

    this.partyPointerUpHandler = (event) => {
      if (g.state?.mode === 'battle') return;

      if (event?.button !== 2 || !this.rightPointerTracking || !g.playerParty || g.mode === 'menu' || g.state?.mode !== 'map') return;

      this.rightPointerTracking = false;
      if (this.rightPointerMoved) {
        this.rightPointerMoved = false;
        return;
      }

      const rect = typeof g.canvas.getBoundingClientRect === 'function'
        ? g.canvas.getBoundingClientRect()
        : { left: 0, top: 0 };
      const screenX = (event?.clientX ?? 0) - (rect.left ?? 0);
      const screenY = (event?.clientY ?? 0) - (rect.top ?? 0);
      const world = g.updatePointerWorldState(screenX, screenY);

      if (g.isWorldPointOnParty(world.x, world.y)) {
        g.cancelPlayerDestination();
        return;
      }

      g.setPlayerDestination(world.x, world.y);
    };

    this.partyContextMenuHandler = (event) => {
      event?.preventDefault?.();
    };

    g.canvas.addEventListener('mousedown', this.partyPointerHandler, { passive: false });
    g.canvas.addEventListener('mousemove', this.partyPointerMoveHandler, { passive: false });
    g.canvas.addEventListener('mouseup', this.partyPointerUpHandler, { passive: false });
    g.canvas.addEventListener('contextmenu', this.partyContextMenuHandler, { passive: false });

    if (g.canvas && !this._wheelBound) {
      this._wheelBound = true;
      g.canvas.addEventListener('wheel', (e) => {
        if (g.state?.mode !== 'map') return;
        e.preventDefault();
        const cam = g.getCameraSafe();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        cam.zoom = Math.max(0.3, Math.min(3.0, cam.zoom * factor));
        g.clampCameraToWorld();
      }, { passive: false });
    }
  }

  setupKeyboardShortcuts() {
    const g = this.game;
    if (this.keyboardHandler) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

    this.keyboardHandler = (e) => {
      if (!e || typeof e.key !== 'string') return;

      if (g.state?.devMode && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault?.();
        if (g.dom?.tuningModal && !g.dom.tuningModal.classList.contains('hidden')) g.hideTuningModal();
        else { g.showTuningModal(); }
        return;
      }

      if (g.dom?.tuningModal && !g.dom.tuningModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault?.();
          g.hideTuningModal();
        }
        return;
      }

      if (g.uiManager.settingsUI?.visible && e.key === 'Escape') {
        e.preventDefault?.();
        g.uiManager.settingsUI.hide();
        return;
      }

      if (g.uiManager.codexUI?.visible && e.key === 'Escape') {
        e.preventDefault?.();
        g.uiManager.codexUI.hide();
        return;
      }

      if (g.uiManager.helpOverlayVisible && e.key === 'Escape') {
        e.preventDefault?.();
        g.toggleHelpOverlay(false);
        return;
      }

      if (e.key === '?' || e.key === '/' || e.key === 'F1') {
        e.preventDefault?.();
        g.toggleHelpOverlay();
        return;
      }

      if ((e.key === 'j' || e.key === 'J') && g.mode !== 'menu') {
        e.preventDefault?.();
        g.uiManager.codexUI?.toggle?.();
        return;
      }

      if ((e.key === 's' || e.key === 'S') && g.mode !== 'menu' && !g.state?.saveLoadOpen && g.state?.mode !== 'city' && g.state?.mode !== 'battle') {
        e.preventDefault?.();
        g.uiManager.settingsUI?.toggle?.();
        return;
      }

      if (g.state?.devMode && !e.shiftKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault?.();
        g.reloadSpriteAssets();
        return;
      }

      if (e.key === 'Enter' && g.mode === 'menu') {
        e.preventDefault?.();
        g.enterStart();
        return;
      }

      if ((e.key === 'k' || e.key === 'K') && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.toggleCampMode();
        return;
      }

      if (g.state?.accounting) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
          e.preventDefault?.();
          g.closeAccountingModal();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        if (g.state?.mode === 'roster') {
          e.preventDefault?.();
          if (g.state.roster) g.state.roster.warning = '';
          g.state.setMode('encounter');
          g.updateTransientUIState();
          return;
        }

        if (g.state?.mode === 'battle') {
          e.preventDefault?.();
          g.togglePaused();
          return;
        }

        if (g.state?.mode === 'aftermath') {
          e.preventDefault?.();
          g.exitAftermathToMap(false);
          return;
        }

        if (g.state?.saveLoadOpen) {
          e.preventDefault?.();
          g.closeSaveLoadPanel();
          return;
        }

        if (g.state?.mode === 'city') {
          e.preventDefault?.();
          if ((g.state.citySubmode || 'menu') !== 'menu') {
            g.state.citySubmode = 'menu';
            g.updateTransientUIState();
            return;
          }
          g.state.uiPanel = null;
          g.state.setMode('map');
          g.updateTransientUIState();
          return;
        }

        e.preventDefault?.();
        if (g.mode === 'playing') {
          g.setPaused(true);
          return;
        }
        if (g.mode === 'paused') {
          g.setPaused(false);
          return;
        }
        if (g.mode === 'menu') {
          g.closeSettings();
        }
        return;
      }

      if (g.state?.saveLoadOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault?.();
          g.saveManager.saveLoadCursor = Math.max(0, g.saveManager.saveLoadCursor - 1);
          g.state.uiPanel = g.buildSaveLoadPanelData();
          g.updateTransientUIState();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault?.();
          g.saveManager.saveLoadCursor = Math.min(g.saveManager.saveLoadRows.length - 1, g.saveManager.saveLoadCursor + 1);
          g.state.uiPanel = g.buildSaveLoadPanelData();
          g.updateTransientUIState();
          return;
        }

        const slot = g.getSelectedSaveSlot();
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault?.();
          g.saveToSlot(slot);
          g.state.uiPanel = g.buildSaveLoadPanelData();
          g.updateTransientUIState();
          return;
        }
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault?.();
          g.loadFromSlot(slot);
          g.closeSaveLoadPanel();
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault?.();
          g.exportSelectedSaveToTextarea(slot);
          g.state.uiPanel = g.buildSaveLoadPanelData();
          g.updateTransientUIState();
          return;
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault?.();
          const loaded = g.importTextareaToSlotAndLoad(slot);
          if (loaded) g.closeSaveLoadPanel();
          else {
            g.state.uiPanel = g.buildSaveLoadPanelData();
            g.updateTransientUIState();
          }
          return;
        }

        return;
      }

      if (g.state?.mode === 'encounter') {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault?.();
          g.resolveEncounter('continue');
          return;
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault?.();
          g.resolveEncounter('fight');
          return;
        }
      }

      if (g.state?.mode === 'roster') {
        if (e.key === 'ArrowUp') {
          e.preventDefault?.();
          g.moveRosterCursor(-1);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault?.();
          g.moveRosterCursor(1);
          return;
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault?.();
          g.toggleRosterSelectionAtCursor();
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault?.();
          let selected = 0;
          g.encounterManager.playerRoster.forEach((unit) => {
            if (selected < g.encounterManager.maxUnitsToDeploy && g.getEffectiveCount(unit) > 0) {
              unit.selected = true;
              selected += 1;
            } else {
              unit.selected = false;
            }
          });
          g.updateTransientUIState();
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault?.();
          g.encounterManager.playerRoster.forEach((unit) => { unit.selected = false; });
          g.updateTransientUIState();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault?.();
          g.confirmRosterSelection();
          return;
        }
      }

      if (g.state?.mode === 'battle') {
        if (g.state?.battle?.phase === 'deploy' && g.battleManager.battleDeployMode?.active) {
          if (e.key === '1') { e.preventDefault?.(); g.battleManager.battleDeployMode.setFormation(CONST.FORMATION.LINE); g.battleManager.battleDeployUI?.setFormation?.(CONST.FORMATION.LINE); return; }
          if (e.key === '2') { e.preventDefault?.(); g.battleManager.battleDeployMode.setFormation(CONST.FORMATION.COLUMN); g.battleManager.battleDeployUI?.setFormation?.(CONST.FORMATION.COLUMN); return; }
          if (e.key === '3') { e.preventDefault?.(); g.battleManager.battleDeployMode.setFormation(CONST.FORMATION.WEDGE); g.battleManager.battleDeployUI?.setFormation?.(CONST.FORMATION.WEDGE); return; }
          if (e.key === '4') { e.preventDefault?.(); g.battleManager.battleDeployMode.setFormation(CONST.FORMATION.SCATTER); g.battleManager.battleDeployUI?.setFormation?.(CONST.FORMATION.SCATTER); return; }
          if (e.key === 'q' || e.key === 'Q') { e.preventDefault?.(); g.battleManager.battleDeployMode.rotate(-1); return; }
          if (e.key === 'e' || e.key === 'E') { e.preventDefault?.(); g.battleManager.battleDeployMode.rotate(1); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); g.confirmBattleDeployment(); return; }
          if (e.key === 'Escape') { e.preventDefault?.(); g.cancelBattleDeployment(); return; }
          return;
        }

        if (e.key === 'h' || e.key === 'H') { e.preventDefault?.(); g.applyBattleCommand(CONST.BATTLE_COMMANDS.HOLD); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault?.(); g.applyBattleCommand(CONST.BATTLE_COMMANDS.FOCUS); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault?.(); g.applyBattleCommand(CONST.BATTLE_COMMANDS.RETREAT); return; }
        if (e.key === 'k' || e.key === 'K') { e.preventDefault?.(); g.applyBattleCommand(CONST.BATTLE_COMMANDS.SKIRMISH); return; }
        if (e.key === 'x' || e.key === 'X') { e.preventDefault?.(); g.toggleBattleHoldFire(); return; }
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault?.();
          g.resolveBattle('victory');
          return;
        }
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault?.();
          g.resolveBattle('defeat');
          return;
        }
      }

      if (g.state?.mode === 'aftermath') {
        if (e.key === 'Enter' || e.key === 't' || e.key === 'T') {
          e.preventDefault?.();
          g.exitAftermathToMap(true);
          return;
        }
        if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
          e.preventDefault?.();
          g.exitAftermathToMap(false);
          return;
        }
      }

      if (g.state?.mode === 'city') {
        const submode = g.state.citySubmode || 'menu';
        if (submode === 'menu') {
          if (e.key === '1' || e.key === 'r' || e.key === 'R') { g.state.citySubmode = 'recruit'; g.economyManager.cityCursor = 0; g.updateTransientUIState(); return; }
          if (e.key === '2' || e.key === 't' || e.key === 'T') { g.state.citySubmode = 'market'; g.economyManager.cityMarketCursor = 0; g.updateTransientUIState(); return; }
          if (e.key === 'h' || e.key === 'H') { g.state.citySubmode = 'healer'; g.economyManager.cityHealerCursor = 0; g.updateTransientUIState(); return; }
          if (e.key === 'e' || e.key === 'E') { g.state.uiPanel = null; g.state.setMode('map'); g.updateTransientUIState(); return; }
        }

        if (submode === 'recruit') {
          if (e.key === 'ArrowUp') { e.preventDefault?.(); g.economyManager.cityCursor = Math.max(0, g.economyManager.cityCursor - 1); g.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); g.economyManager.cityCursor = Math.min(Math.max(0, g.economyManager.cityOffers.length - 1), g.economyManager.cityCursor + 1); g.updateTransientUIState(); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); g.recruitCurrentUnit(Boolean(e.shiftKey)); g.updateTransientUIState(); return; }
        }

        if (submode === 'market') {
          if (e.key === 'ArrowUp') { e.preventDefault?.(); g.economyManager.cityMarketCursor = Math.max(0, g.economyManager.cityMarketCursor - 1); g.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); g.economyManager.cityMarketCursor = Math.min(Math.max(0, g.economyManager.itemCatalog.length - 1), g.economyManager.cityMarketCursor + 1); g.updateTransientUIState(); return; }
          if (e.key === 'b' || e.key === 'B' || e.key === 'Enter') { e.preventDefault?.(); g.tradeCurrentItem(e.shiftKey ? 5 : 1); g.updateTransientUIState(); return; }
          if (e.key === 's' || e.key === 'S' || e.key === 'Backspace') { e.preventDefault?.(); g.tradeCurrentItem(e.shiftKey ? -5 : -1); g.updateTransientUIState(); return; }
        }

        if (submode === 'healer') {
          const wounded = g.getWoundedUnits();
          if (e.key === 'ArrowUp') { e.preventDefault?.(); g.economyManager.cityHealerCursor = Math.max(0, g.economyManager.cityHealerCursor - 1); g.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); g.economyManager.cityHealerCursor = Math.min(Math.max(0, wounded.length - 1), g.economyManager.cityHealerCursor + 1); g.updateTransientUIState(); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); g.healCurrentUnit(); g.updateTransientUIState(); return; }
        }
      }

      if ((e.key === 'x' || e.key === 'Backspace') && g.mode !== 'menu' && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.cancelPlayerDestination();
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.followParty = !g.followParty;
        if (g.followParty) {
          g.centerCameraOnParty();
        }
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.enterCityServices();
        return;
      }

      if ((e.key === 'e' || e.key === 'E') && g.state?.mode === 'map' && e.shiftKey) {
        e.preventDefault?.();
        const events = g.refreshCurrentEventsSummary(g.state?.day ?? 1);
        toggleCurrentEventsModal({ events, currentDay: g.state?.day ?? 1 });
        return;
      }

      if ((e.key === 'e' || e.key === 'E') && g.state?.mode === 'map') {
        e.preventDefault?.();
        const pois = g.state?.map?.pois;
        if (!Array.isArray(pois) || pois.length === 0) {
          if (g.state) g.state.interactHint = '';
          return;
        }
        g.openPoiModal();
        return;
      }

      if (g.mode !== 'playing') return;

      if (e.key === ' ' && g.state?.mode !== 'start') {
        e.preventDefault?.();
        g.state.togglePause();
      }

      if (g.state?.devMode && e.key === 'F3') {
        e.preventDefault?.();
        g.toggleDebug();
      }

      if (e.key === 'F5') {
        e.preventDefault?.();
        if (g.state?.mode === 'map') {
          g.openSaveLoadPanel();
          return;
        }
        g.quickSave();
      }

      if (e.key === 'F9') {
        e.preventDefault?.();
        g.quickLoad();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }
}
