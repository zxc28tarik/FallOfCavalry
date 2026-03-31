import { afterEach, describe, it, expect } from 'vitest';
import { WorldManager } from '../../js/managers/WorldManager.js';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function setWindowHref(href) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: { location: { href } },
  });
}

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    return;
  }
  if ('window' in globalThis) delete globalThis.window;
}

afterEach(() => {
  restoreWindow();
});

function makeWorldManager(options = {}) {
  const state = {
    mode: 'map',
    devMode: Boolean(options.devMode),
    camera: { x: 0, y: 0, zoom: 1 },
    map: {
      width: 64,
      height: 64,
      tiles: [],
      settlements: [],
      biomes: new Uint8Array(64 * 64),
      fog: new Uint8Array(64 * 64),
    },
  };
  const wm = new WorldManager(state);
  wm.init({
    canvas: { width: 800, height: 600 },
    playerParty: { x: 400, y: 304, radius: 12, hovered: false },
    mouseWorldX: 0,
    mouseWorldY: 0,
    mode: 'playing',
  });
  if (options.forceDimetric !== false) {
    wm.isDimetricMode = () => true;
  }
  return wm;
}

describe('WorldManager dimetric input bridge', () => {
  it('screenToWorld returns tile-centered world coordinates in dimetric mode', () => {
    const wm = makeWorldManager();
    const world = wm.screenToWorld(400, 300);
    expect(world.isDimetric).toBe(true);
    expect(world.tileX).toBe(12);
    expect(world.tileY).toBe(9);
    expect(world.x).toBeCloseTo((12.5 * 32), 6);
    expect(world.y).toBeCloseTo((9.5 * 32), 6);
  });

  it('updatePointerWorldState stores both world and tile pointer values', () => {
    const wm = makeWorldManager();
    wm.updatePointerWorldState(400, 300);
    expect(wm.game.mouseWorldX).toBeCloseTo(400, 6);
    expect(wm.game.mouseWorldY).toBeCloseTo(304, 6);
    expect(wm.game.mouseTileX).toBe(12);
    expect(wm.game.mouseTileY).toBe(9);
  });

  it('initializes building system and syncs placed structures into map state', () => {
    const wm = makeWorldManager();
    const system = wm.ensureBuildingSystem({ map: wm.state.map, reset: true });
    expect(system).toBeTruthy();

    const placed = wm.placeBuilding('wall', 6, 7);
    expect(placed).toBeTruthy();
    expect(wm.canPlaceBuilding('wall', 6, 7)?.ok).toBe(false);
    expect(wm.getBuildingAtTile(6, 7)?.defId).toBe('wall');
    expect(wm.getBuildingById(placed.id)?.defId).toBe('wall');
    expect(wm.getWallVariantAtTile(6, 7)).toBe('pillar');
    expect(wm.state.map.buildingState?.buildings?.length).toBe(1);
  });
});

describe('WorldManager projection mode bridge', () => {
  it('keeps dimetric mode when dimetric=off is set alone', () => {
    setWindowHref('http://localhost:5173/?dimetric=off');
    const wm = makeWorldManager({ forceDimetric: false });
    expect(wm.isDimetricMode()).toBe(true);
    expect(wm.isLegacyTopdownMode()).toBe(false);
  });

  it('blocks explicit legacy topdown override in non-dev mode', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    const wm = makeWorldManager({ forceDimetric: false });
    expect(wm.isDimetricMode()).toBe(true);
    expect(wm.isLegacyTopdownMode()).toBe(false);
  });

  it('allows explicit legacy topdown override in dev mode', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    const wm = makeWorldManager({ forceDimetric: false, devMode: true });
    expect(wm.isDimetricMode()).toBe(false);
    expect(wm.isLegacyTopdownMode()).toBe(true);
  });
});
