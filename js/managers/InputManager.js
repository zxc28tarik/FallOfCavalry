import * as CONST from '../constants.js';
import { toggleCurrentEventsModal } from '../ui/modals.js';
import { getBuildingDef } from '../data/building-defs.js';

const MAP_BUILD_DEF_ORDER = Object.freeze(['wall', 'gatehouse', 'keep', 'granary']);
const MAP_BUILD_DEF_LABEL = Object.freeze({
  wall: 'Duvar',
  gatehouse: 'Kapi',
  keep: 'Keep',
  granary: 'Ambar',
});

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
    this.ensureMapBuildModeState();
  }

  ensureMapBuildModeState() {
    const g = this.game;
    if (!g) return null;
    if (!g.mapBuildMode || typeof g.mapBuildMode !== 'object') {
      g.mapBuildMode = {
        active: false,
        defId: MAP_BUILD_DEF_ORDER[0],
        selectedBuildingId: null,
      };
    }
    if (!MAP_BUILD_DEF_ORDER.includes(g.mapBuildMode.defId)) g.mapBuildMode.defId = MAP_BUILD_DEF_ORDER[0];
    if (typeof g.mapBuildMode.active !== 'boolean') g.mapBuildMode.active = false;
    if (this.state && typeof this.state === 'object') {
      this.state.mapBuildMode = g.mapBuildMode;
    }
    return g.mapBuildMode;
  }

  getMapBuildLabel(defId) {
    const key = String(defId || '').toLowerCase();
    if (MAP_BUILD_DEF_LABEL[key]) return MAP_BUILD_DEF_LABEL[key];
    const def = getBuildingDef(key);
    if (!def) return String(defId || 'Yapi');
    return MAP_BUILD_DEF_LABEL[def.id] || String(def.id || 'Yapi');
  }

  setMapBuildHint(text) {
    if (!this.state) return;
    this.state.interactHint = typeof text === 'string' ? text : '';
  }

  refreshMapBuildHint() {
    const g = this.game;
    if (!g || g.state?.mode !== 'map') return;
    const mode = this.ensureMapBuildModeState();
    if (!mode) return;
    if (!mode.active) {
      if (mode.selectedBuildingId) {
        const picked = g.worldManager?.getBuildingById?.(mode.selectedBuildingId);
        if (picked) {
          this.setMapBuildHint(`Secili yapi: ${this.getMapBuildLabel(picked.defId)} (${picked.anchorX},${picked.anchorY}) | B: Insa modu`);
          return;
        }
      }
      return;
    }
    this.setMapBuildHint(`Insa modu: ${this.getMapBuildLabel(mode.defId)} | Sol tik: yerlestir | Sag tik: kaldir | 1-4/Tab: sec | B/Esc: cik`);
  }

  toggleMapBuildMode(forceActive = null) {
    const mode = this.ensureMapBuildModeState();
    if (!mode) return false;
    const nextActive = typeof forceActive === 'boolean' ? forceActive : !mode.active;
    mode.active = nextActive;
    if (!nextActive) mode.selectedBuildingId = null;
    this.refreshMapBuildHint();
    return mode.active;
  }

  setMapBuildDef(defId) {
    const mode = this.ensureMapBuildModeState();
    if (!mode) return false;
    const normalized = String(defId || '').toLowerCase();
    const def = getBuildingDef(normalized);
    if (!def) return false;
    mode.defId = def.id;
    if (!mode.active) mode.active = true;
    this.refreshMapBuildHint();
    return true;
  }

  cycleMapBuildDef(step = 1) {
    const mode = this.ensureMapBuildModeState();
    if (!mode) return false;
    const currentIdx = Math.max(0, MAP_BUILD_DEF_ORDER.indexOf(mode.defId));
    const dir = Number.isFinite(step) && step < 0 ? -1 : 1;
    const nextIdx = (currentIdx + dir + MAP_BUILD_DEF_ORDER.length) % MAP_BUILD_DEF_ORDER.length;
    return this.setMapBuildDef(MAP_BUILD_DEF_ORDER[nextIdx]);
  }

  getTileFromWorld(world) {
    const g = this.game;
    if (world && Number.isFinite(world.tileX) && Number.isFinite(world.tileY)) {
      return { tx: Math.floor(world.tileX), ty: Math.floor(world.tileY) };
    }
    if (world && (Number.isFinite(world.x) || Number.isFinite(world.y))) {
      return g?.worldManager?.getTilePosition?.(world.x, world.y) || null;
    }
    return null;
  }

  describeCanPlaceReason(reason) {
    const key = String(reason || '').toLowerCase();
    if (key === 'occupied') return 'tile dolu';
    if (key === 'water') return 'su ustune yerlestirilemez';
    if (key === 'blocked') return 'engelli bolge';
    if (key === 'out_of_bounds') return 'harita disi';
    if (key === 'unknown_def') return 'gecersiz yapi tipi';
    return 'uygun degil';
  }

  handleMapBuildPointer(event, world) {
    const g = this.game;
    if (!g || g.state?.mode !== 'map') return false;
    const mode = this.ensureMapBuildModeState();
    if (!mode) return false;
    const wm = g.worldManager;
    if (!wm) return false;

    const tile = this.getTileFromWorld(world);
    if (!tile) return false;
    const tx = tile.tx;
    const ty = tile.ty;

    if (event?.button === 2 && mode.active) {
      event.preventDefault?.();
      const existing = wm.getBuildingAtTile?.(tx, ty) || null;
      if (!existing?.id) {
        this.refreshMapBuildHint();
        return true;
      }
      const removed = wm.removeBuilding?.(existing.id);
      if (removed) {
        mode.selectedBuildingId = null;
        this.setMapBuildHint(`Silindi: ${this.getMapBuildLabel(existing.defId)} (${tx},${ty})`);
      } else {
        this.setMapBuildHint(`Silme basarisiz (${tx},${ty})`);
      }
      return true;
    }

    if (event?.button !== 0) return false;

    const existing = wm.getBuildingAtTile?.(tx, ty) || null;
    if (mode.active) {
      if (existing) {
        mode.selectedBuildingId = existing.id || null;
        this.setMapBuildHint(`Secili: ${this.getMapBuildLabel(existing.defId)} (${existing.anchorX},${existing.anchorY})`);
        return true;
      }
      const placed = wm.placeBuilding?.(mode.defId, tx, ty);
      if (placed) {
        mode.selectedBuildingId = placed.id || null;
        g.followParty = false;
        this.setMapBuildHint(`Yerlestirildi: ${this.getMapBuildLabel(mode.defId)} (${tx},${ty})`);
      } else {
        const check = wm.canPlaceBuilding?.(mode.defId, tx, ty);
        this.setMapBuildHint(`Yerlestirilemedi: ${this.describeCanPlaceReason(check?.reason)}`);
      }
      return true;
    }

    if (!existing) return false;
    mode.selectedBuildingId = existing.id || null;
    this.setMapBuildHint(`Secili yapi: ${this.getMapBuildLabel(existing.defId)} (${existing.anchorX},${existing.anchorY}) | B: Insa modu`);
    return true;
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
      const world = g.worldManager.updatePointerWorldState(screenX, screenY);
      if (this.handleMapBuildPointer(event, world)) return;

      if (event?.button === 0) {
        g.playerParty.selected = true;
        const clickedSettlement = g.worldManager.getSettlementAtWorldPoint?.(world.x, world.y, {
          maxHitScale: g.worldManager.isDimetricMode?.() ? 1.12 : 1.0,
        });
        if (clickedSettlement) {
          if (g.worldManager.isPlayerNearSettlement?.(clickedSettlement) && g.economyManager?.enterCityServicesForSettlement?.(clickedSettlement)) {
            g.followParty = false;
            return;
          }
          const targetX = Number.isFinite(clickedSettlement.x) ? clickedSettlement.x : world.x;
          const targetY = Number.isFinite(clickedSettlement.y) ? clickedSettlement.y : world.y;
          g.worldManager.setPlayerDestination(targetX, targetY);
          g.followParty = true;
          return;
        }
        g.worldManager.setPlayerDestination(world.x, world.y);
        g.followParty = true;
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
      g.worldManager.updatePointerWorldState(screenX, screenY);
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
      const world = g.worldManager.updatePointerWorldState(screenX, screenY);

      if (g.worldManager.isWorldPointOnParty(world.x, world.y)) {
        g.worldManager.cancelPlayerDestination();
        return;
      }

      g.worldManager.setPlayerDestination(world.x, world.y);
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
        const cam = g.worldManager.getCameraSafe();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        cam.zoom = Math.max(0.3, Math.min(3.0, cam.zoom * factor));
        g.worldManager.clampCameraToWorld();
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
        if (g.dom?.tuningModal && !g.dom.tuningModal.classList.contains('hidden')) g.tuningManager.hideTuningModal();
        else { g.tuningManager.showTuningModal(); }
        return;
      }

      if (g.dom?.tuningModal && !g.dom.tuningModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault?.();
          g.tuningManager.hideTuningModal();
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
        g.uiManager.toggleHelpOverlay(false);
        return;
      }

      if (e.key === '?' || e.key === '/' || e.key === 'F1') {
        e.preventDefault?.();
        g.uiManager.toggleHelpOverlay();
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
        g.renderManager.reloadSpriteAssets();
        return;
      }

      if (e.key === 'Enter' && g.mode === 'menu') {
        e.preventDefault?.();
        g.gameFlowManager.enterStart();
        return;
      }

      if ((e.key === 'k' || e.key === 'K') && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.uiManager.toggleCampMode();
        return;
      }

      if (g.state?.accounting) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar' || e.key === 'Escape') {
          e.preventDefault?.();
          g.uiManager.closeAccountingModal();
          return;
        }
        return;
      }

      if (e.key === 'Escape') {
        if (g.state?.mode === 'roster') {
          e.preventDefault?.();
          if (g.state.roster) g.state.roster.warning = '';
          g.state.setMode('encounter');
          g.worldManager.updateTransientUIState();
          return;
        }

        if (g.state?.mode === 'battle') {
          e.preventDefault?.();
          g.gameFlowManager.togglePaused();
          return;
        }

        if (g.state?.mode === 'aftermath') {
          e.preventDefault?.();
          g.battleManager.exitAftermathToMap(false);
          return;
        }

        if (g.state?.saveLoadOpen) {
          e.preventDefault?.();
          g.saveManager.closeSaveLoadPanel();
          return;
        }

        if (g.state?.mode === 'city') {
          e.preventDefault?.();
          if ((g.state.citySubmode || 'menu') !== 'menu') {
            g.state.citySubmode = 'menu';
            g.worldManager.updateTransientUIState();
            return;
          }
          g.state.uiPanel = null;
          g.state.setMode('map');
          g.worldManager.updateTransientUIState();
          return;
        }

        if (g.state?.mode === 'map' && this.ensureMapBuildModeState()?.active) {
          e.preventDefault?.();
          this.toggleMapBuildMode(false);
          return;
        }

        e.preventDefault?.();
        if (g.mode === 'playing') {
          g.gameFlowManager.setPaused(true);
          return;
        }
        if (g.mode === 'paused') {
          g.gameFlowManager.setPaused(false);
          return;
        }
        if (g.mode === 'menu') {
          g.gameFlowManager.closeSettings();
        }
        return;
      }

      if (g.state?.saveLoadOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault?.();
          g.saveManager.saveLoadCursor = Math.max(0, g.saveManager.saveLoadCursor - 1);
          g.state.uiPanel = g.saveManager.buildSaveLoadPanelData();
          g.worldManager.updateTransientUIState();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault?.();
          g.saveManager.saveLoadCursor = Math.min(g.saveManager.saveLoadRows.length - 1, g.saveManager.saveLoadCursor + 1);
          g.state.uiPanel = g.saveManager.buildSaveLoadPanelData();
          g.worldManager.updateTransientUIState();
          return;
        }

        const slot = g.saveManager.getSelectedSaveSlot();
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault?.();
          g.saveManager.saveToSlot(slot);
          g.state.uiPanel = g.saveManager.buildSaveLoadPanelData();
          g.worldManager.updateTransientUIState();
          return;
        }
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault?.();
          g.saveManager.loadFromSlot(slot);
          g.saveManager.closeSaveLoadPanel();
          return;
        }
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault?.();
          g.saveManager.exportSelectedSaveToTextarea(slot);
          g.state.uiPanel = g.saveManager.buildSaveLoadPanelData();
          g.worldManager.updateTransientUIState();
          return;
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault?.();
          const loaded = g.saveManager.importTextareaToSlotAndLoad(slot);
          if (loaded) g.saveManager.closeSaveLoadPanel();
          else {
            g.state.uiPanel = g.saveManager.buildSaveLoadPanelData();
            g.worldManager.updateTransientUIState();
          }
          return;
        }

        return;
      }

      if (g.state?.mode === 'encounter') {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault?.();
          g.encounterManager.resolveEncounter('continue');
          return;
        }
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault?.();
          g.encounterManager.resolveEncounter('fight');
          return;
        }
      }

      if (g.state?.mode === 'roster') {
        if (e.key === 'ArrowUp') {
          e.preventDefault?.();
          g.encounterManager.moveRosterCursor(-1);
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault?.();
          g.encounterManager.moveRosterCursor(1);
          return;
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault?.();
          g.encounterManager.toggleRosterSelectionAtCursor();
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault?.();
          let selected = 0;
          g.encounterManager.playerRoster.forEach((unit) => {
            if (selected < g.encounterManager.maxUnitsToDeploy && g.worldManager.getEffectiveCount(unit) > 0) {
              unit.selected = true;
              selected += 1;
            } else {
              unit.selected = false;
            }
          });
          g.worldManager.updateTransientUIState();
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault?.();
          g.encounterManager.playerRoster.forEach((unit) => { unit.selected = false; });
          g.worldManager.updateTransientUIState();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault?.();
          g.battleManager.confirmRosterSelection();
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
          if (e.key === 'Enter') { e.preventDefault?.(); g.battleManager.confirmBattleDeployment(); return; }
          if (e.key === 'Escape') { e.preventDefault?.(); g.battleManager.cancelBattleDeployment(); return; }
          return;
        }

        if (e.key === 'h' || e.key === 'H') { e.preventDefault?.(); g.battleManager.applyBattleCommand(CONST.BATTLE_COMMANDS.HOLD); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault?.(); g.battleManager.applyBattleCommand(CONST.BATTLE_COMMANDS.FOCUS); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault?.(); g.battleManager.applyBattleCommand(CONST.BATTLE_COMMANDS.RETREAT); return; }
        if (e.key === 'k' || e.key === 'K') { e.preventDefault?.(); g.battleManager.applyBattleCommand(CONST.BATTLE_COMMANDS.SKIRMISH); return; }
        if (e.key === 'x' || e.key === 'X') { e.preventDefault?.(); g.battleManager.toggleBattleHoldFire(); return; }
        if (e.key === 'v' || e.key === 'V') {
          e.preventDefault?.();
          g.battleManager.resolveBattle('victory');
          return;
        }
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault?.();
          g.battleManager.resolveBattle('defeat');
          return;
        }
      }

      if (g.state?.mode === 'aftermath') {
        if (e.key === 'Enter' || e.key === 't' || e.key === 'T') {
          e.preventDefault?.();
          g.battleManager.exitAftermathToMap(true);
          return;
        }
        if (e.key === 'Escape' || e.key === 'l' || e.key === 'L') {
          e.preventDefault?.();
          g.battleManager.exitAftermathToMap(false);
          return;
        }
      }

      if (g.state?.mode === 'city') {
        const submode = g.state.citySubmode || 'menu';
        if (submode === 'menu') {
          if (e.key === '1' || e.key === 'r' || e.key === 'R') { g.state.citySubmode = 'recruit'; g.economyManager.cityCursor = 0; g.worldManager.updateTransientUIState(); return; }
          if (e.key === '2' || e.key === 't' || e.key === 'T') { g.state.citySubmode = 'market'; g.economyManager.cityMarketCursor = 0; g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'h' || e.key === 'H') { g.state.citySubmode = 'healer'; g.economyManager.cityHealerCursor = 0; g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'e' || e.key === 'E') { g.state.uiPanel = null; g.state.setMode('map'); g.worldManager.updateTransientUIState(); return; }
        }

        if (submode === 'recruit') {
          if (e.key === 'ArrowUp') { e.preventDefault?.(); g.economyManager.cityCursor = Math.max(0, g.economyManager.cityCursor - 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); g.economyManager.cityCursor = Math.min(Math.max(0, g.economyManager.cityOffers.length - 1), g.economyManager.cityCursor + 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); g.economyManager.recruitCurrentUnit(Boolean(e.shiftKey)); g.worldManager.updateTransientUIState(); return; }
        }

        if (submode === 'market') {
          if (e.key === 'ArrowUp') { e.preventDefault?.(); g.economyManager.cityMarketCursor = Math.max(0, g.economyManager.cityMarketCursor - 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); g.economyManager.cityMarketCursor = Math.min(Math.max(0, g.economyManager.itemCatalog.length - 1), g.economyManager.cityMarketCursor + 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'b' || e.key === 'B' || e.key === 'Enter') { e.preventDefault?.(); g.economyManager.tradeCurrentItem(e.shiftKey ? 5 : 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 's' || e.key === 'S' || e.key === 'Backspace') { e.preventDefault?.(); g.economyManager.tradeCurrentItem(e.shiftKey ? -5 : -1); g.worldManager.updateTransientUIState(); return; }
        }

        if (submode === 'healer') {
          const wounded = g.battleManager.getWoundedUnits();
          if (e.key === 'ArrowUp') { e.preventDefault?.(); g.economyManager.cityHealerCursor = Math.max(0, g.economyManager.cityHealerCursor - 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'ArrowDown') { e.preventDefault?.(); g.economyManager.cityHealerCursor = Math.min(Math.max(0, wounded.length - 1), g.economyManager.cityHealerCursor + 1); g.worldManager.updateTransientUIState(); return; }
          if (e.key === 'Enter') { e.preventDefault?.(); g.economyManager.healCurrentUnit(); g.worldManager.updateTransientUIState(); return; }
        }
      }

      if (g.state?.mode === 'map' && (
        e.key === 'ArrowUp'
        || e.key === 'ArrowDown'
        || e.key === 'ArrowLeft'
        || e.key === 'ArrowRight'
      )) {
        e.preventDefault?.();
      }

      if (g.state?.mode === 'map' && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault?.();
        this.toggleMapBuildMode();
        return;
      }

      if (g.state?.mode === 'map' && this.ensureMapBuildModeState()?.active) {
        if (e.key === 'Tab') {
          e.preventDefault?.();
          this.cycleMapBuildDef(e.shiftKey ? -1 : 1);
          return;
        }
        if (e.key === '1') { e.preventDefault?.(); this.setMapBuildDef('wall'); return; }
        if (e.key === '2') { e.preventDefault?.(); this.setMapBuildDef('gatehouse'); return; }
        if (e.key === '3') { e.preventDefault?.(); this.setMapBuildDef('keep'); return; }
        if (e.key === '4') { e.preventDefault?.(); this.setMapBuildDef('granary'); return; }
      }

      if ((e.key === 'x' || e.key === 'Backspace') && g.mode !== 'menu' && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.worldManager.cancelPlayerDestination();
        return;
      }

      if ((e.key === 'f' || e.key === 'F') && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.followParty = !g.followParty;
        if (g.followParty) {
          g.worldManager.centerCameraOnParty();
        }
        return;
      }

      if ((e.key === 'c' || e.key === 'C') && g.state?.mode === 'map') {
        e.preventDefault?.();
        g.economyManager.enterCityServices();
        return;
      }

      if ((e.key === 'e' || e.key === 'E') && g.state?.mode === 'map' && e.shiftKey) {
        e.preventDefault?.();
        const events = g.gameFlowManager.refreshCurrentEventsSummary(g.state?.day ?? 1);
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
        g.poiManager.openPoiModal();
        return;
      }

      if (g.mode !== 'playing') return;

      if (e.key === ' ' && g.state?.mode !== 'start') {
        e.preventDefault?.();
        g.state.togglePause();
      }

      if (g.state?.devMode && e.key === 'F3') {
        e.preventDefault?.();
        g.devManager.toggleDebug();
      }

      if (e.key === 'F5') {
        e.preventDefault?.();
        if (g.state?.mode === 'map') {
          g.saveManager.openSaveLoadPanel();
          return;
        }
        g.saveManager.quickSave();
      }

      if (e.key === 'F9') {
        e.preventDefault?.();
        g.saveManager.quickLoad();
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }
}
