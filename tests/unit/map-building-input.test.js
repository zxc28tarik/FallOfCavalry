import { describe, it, expect, vi } from 'vitest';
import { GameInputManager } from '../../js/managers/InputManager.js';

function makeHarness(overrides = {}) {
  const listeners = {};
  const state = { mode: 'map', interactHint: '' };
  const worldManager = {
    updatePointerWorldState: vi.fn(() => ({ x: 160, y: 192, tileX: 5, tileY: 6 })),
    getSettlementAtWorldPoint: vi.fn(() => null),
    isDimetricMode: vi.fn(() => true),
    isPlayerNearSettlement: vi.fn(() => false),
    setPlayerDestination: vi.fn(),
    getBuildingAtTile: vi.fn(() => null),
    placeBuilding: vi.fn(() => null),
    removeBuilding: vi.fn(() => false),
    canPlaceBuilding: vi.fn(() => ({ ok: true })),
    getBuildingById: vi.fn(() => null),
    getTilePosition: vi.fn(() => ({ tx: 5, ty: 6 })),
    cancelPlayerDestination: vi.fn(),
    centerCameraOnParty: vi.fn(),
    updateTransientUIState: vi.fn(),
  };
  const canvas = {
    width: 800,
    height: 600,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const game = {
    canvas,
    state,
    mode: 'playing',
    playerParty: { selected: false, hovered: false },
    worldManager,
    economyManager: { enterCityServicesForSettlement: vi.fn(() => false), enterCityServices: vi.fn() },
    poiManager: { openPoiModal: vi.fn() },
    uiManager: { toggleCampMode: vi.fn(), closeAccountingModal: vi.fn(), settingsUI: null, codexUI: null, helpOverlayVisible: false, toggleHelpOverlay: vi.fn() },
    gameFlowManager: { setPaused: vi.fn(), togglePaused: vi.fn(), closeSettings: vi.fn(), refreshCurrentEventsSummary: vi.fn(() => []) },
    saveManager: { closeSaveLoadPanel: vi.fn(), openSaveLoadPanel: vi.fn(), quickSave: vi.fn(), quickLoad: vi.fn() },
    battleManager: { exitAftermathToMap: vi.fn(), getWoundedUnits: vi.fn(() => []) },
    encounterManager: { resolveEncounter: vi.fn(), moveRosterCursor: vi.fn(), toggleRosterSelectionAtCursor: vi.fn(), playerRoster: [], maxUnitsToDeploy: 6 },
    tuningManager: { showTuningModal: vi.fn(), hideTuningModal: vi.fn() },
    renderManager: { reloadSpriteAssets: vi.fn() },
    devManager: { toggleDebug: vi.fn() },
    input: { isKeyDown: vi.fn(() => false), mouse: { x: 0, y: 0, over: true } },
    followParty: false,
    ...overrides,
  };

  const input = new GameInputManager(state);
  input.init(game);
  return { input, game, state, worldManager, listeners };
}

describe('Map building input flow', () => {
  it('toggles build mode with B shortcut in map mode', () => {
    const { input, game, state } = makeHarness();
    const savedDoc = global.document;
    global.document = { addEventListener: () => {} };
    input.setupKeyboardShortcuts();
    global.document = savedDoc;

    input.keyboardHandler({ key: 'b', preventDefault: () => {} });
    expect(game.mapBuildMode?.active).toBe(true);
    expect(state.interactHint).toContain('Insa modu');

    input.keyboardHandler({ key: 'b', preventDefault: () => {} });
    expect(game.mapBuildMode?.active).toBe(false);
  });

  it('places building on left click while build mode is active', () => {
    const { input, game, worldManager, listeners } = makeHarness({
      mapBuildMode: { active: true, defId: 'wall', selectedBuildingId: null },
    });
    worldManager.placeBuilding.mockReturnValue({ id: 'wall_5_6', defId: 'wall', anchorX: 5, anchorY: 6 });
    input.setupPartyInputHandlers();

    listeners.mousedown?.({ button: 0, clientX: 120, clientY: 140, preventDefault: () => {} });
    expect(worldManager.placeBuilding).toHaveBeenCalledWith('wall', 5, 6);
    expect(worldManager.setPlayerDestination).not.toHaveBeenCalled();
    expect(game.mapBuildMode.selectedBuildingId).toBe('wall_5_6');
  });

  it('removes building on right click while build mode is active', () => {
    const { input, game, worldManager, listeners } = makeHarness({
      mapBuildMode: { active: true, defId: 'wall', selectedBuildingId: null },
    });
    worldManager.getBuildingAtTile.mockReturnValue({ id: 'wall_a', defId: 'wall', anchorX: 5, anchorY: 6 });
    worldManager.removeBuilding.mockReturnValue(true);
    input.setupPartyInputHandlers();

    listeners.mousedown?.({ button: 2, clientX: 120, clientY: 140, preventDefault: () => {} });
    expect(worldManager.removeBuilding).toHaveBeenCalledWith('wall_a');
    expect(input.rightPointerTracking).toBe(false);
  });

  it('picks building on left click when build mode is inactive', () => {
    const { input, game, state, worldManager, listeners } = makeHarness({
      mapBuildMode: { active: false, defId: 'wall', selectedBuildingId: null },
    });
    worldManager.getBuildingAtTile.mockReturnValue({ id: 'keep_a', defId: 'keep', anchorX: 5, anchorY: 6 });
    input.setupPartyInputHandlers();

    listeners.mousedown?.({ button: 0, clientX: 120, clientY: 140, preventDefault: () => {} });
    expect(game.mapBuildMode.selectedBuildingId).toBe('keep_a');
    expect(worldManager.setPlayerDestination).not.toHaveBeenCalled();
    expect(state.interactHint).toContain('Secili yapi');
  });
});
