import { afterEach, describe, expect, it } from 'vitest';

import { RenderManager } from '../../js/managers/RenderManager.js';

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

function makeRenderManager({ devMode = false } = {}) {
  const state = {
    day: 1,
    mode: 'map',
    debug: { fps: 60, enabled: false },
    devMode,
  };
  const rm = new RenderManager(state);
  rm.init({
    state,
    spriteLoader: {},
    canvas: { width: 800, height: 600 },
    ctx: null,
  });
  return rm;
}

function makeNoopCtx() {
  const gradient = { addColorStop: () => {} };
  return {
    save: () => {},
    restore: () => {},
    fillRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    arcTo: () => {},
    clip: () => {},
    clearRect: () => {},
    drawImage: () => {},
    fillText: () => {},
    measureText: (text) => ({ width: String(text ?? '').length * 8 }),
    createLinearGradient: () => gradient,
    setLineDash: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    rect: () => {},
    strokeRect: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
  };
}

function createDimetricTerrainHarness(settlements) {
  const rm = makeRenderManager({ devMode: true });
  rm.dimetricViewConfig = {
    tileW: 48,
    tileH: 32,
  };
  rm.dimetricQualityProfile = {
    level: 1,
    enableBanners: false,
    enableActorOcclusionGhosts: false,
    featureDensityScale: 1,
    lodBias: 0,
  };
  rm.dimetricTerrainCache.canvasFactory = (canvasWidth, canvasHeight) => ({
    width: canvasWidth,
    height: canvasHeight,
    getContext: () => makeNoopCtx(),
  });
  rm.game = {
    canvas: { width: 800, height: 600 },
    ctx: makeNoopCtx(),
    spriteLoader: {},
    poiManager: { getPoiSpriteKey: () => '' },
    tuningManager: { getEffectiveTuning: () => ({ WORLD_AI: { ENABLED: false } }) },
    worldManager: {
      ensureBuildingSystem: () => null,
      worldAi: { parties: [] },
      enemyParties: [],
      encounterMargin: 0,
    },
    uiManager: {
      weatherState: null,
      getWeatherConfig: () => ({}),
    },
    followParty: false,
  };
  rm.state = {
    map: {
      width: 1,
      height: 1,
      tiles: [{ type: 'plains' }],
      settlements,
      fog: new Uint8Array([2]),
    },
    timeSec: 0,
    debug: { enabled: false },
  };
  return rm;
}

function renderDimetricTerrain(rm) {
  rm.renderDimetricWorldTerrain(rm.game.ctx, { x: 0, y: 0, zoom: 1 }, {
    map: rm.state.map,
    width: rm.state.map.width,
    height: rm.state.map.height,
    tileSize: 32,
    fog: rm.state.map.fog,
  });
}

describe('RenderManager projection mode gate', () => {
  it('keeps dimetric mode in non-dev even with legacy override URL', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    const rm = makeRenderManager({ devMode: false });
    expect(rm.useDimetric).toBe(true);
    expect(rm.projectionMode).toBe('dimetric');
    expect(rm.projectionSource).toBe('legacy_runtime_blocked');
  });

  it('allows legacy topdown mode in dev with override URL', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    const rm = makeRenderManager({ devMode: true });
    expect(rm.useDimetric).toBe(false);
    expect(rm.projectionMode).toBe('legacy_topdown');
    expect(rm.projectionSource).toBe('url_legacy_topdown');
  });

  it('keeps classic HoMM-style props in non-dev even when URL asks for stronghold', () => {
    setWindowHref('http://localhost:5173/?prop_style=stronghold');
    const rm = makeRenderManager({ devMode: false });
    expect(rm.dimetricPropStyleProfile).toBe('classic');
  });

  it('allows stronghold prop style override in dev mode', () => {
    setWindowHref('http://localhost:5173/?prop_style=stronghold');
    const rm = makeRenderManager({ devMode: true });
    expect(rm.dimetricPropStyleProfile).toBe('stronghold');
  });

  it('keeps wireframe disabled in non-dev even when URL asks for it', () => {
    setWindowHref('http://localhost:5173/?wireframe=1');
    const rm = makeRenderManager({ devMode: false });
    expect(rm.dimetricWireframeEnabled).toBe(false);
  });

  it('allows wireframe override in dev mode', () => {
    setWindowHref('http://localhost:5173/?wireframe=1');
    const rm = makeRenderManager({ devMode: true });
    expect(rm.dimetricWireframeEnabled).toBe(true);
  });

  it('keeps dimetric terrain locked to the shared grass tile path', () => {
    const rm = createDimetricTerrainHarness([]);
    renderDimetricTerrain(rm);
    const stats = rm.dimetricTerrainCache.getStats();
    expect(rm.dimetricTerrainMode).toBe('tile');
    expect(stats).toMatchObject({ groundStylePreset: 'classic' });
    expect(stats).not.toHaveProperty('groundFrameMode');
    expect(stats).not.toHaveProperty('terrainFramesEnabled');
  });

  it('indexes world features by numeric tile id for render-time lookups', () => {
    const rm = makeRenderManager({ devMode: true });
    const map = {
      width: 32,
      forests: [{ x: 3, y: 4 }],
      mountains: [{ x: 7, y: 9 }],
    };
    const { forestSet, mountainSet } = rm.getCachedWorldFeatureSets(map);
    expect(forestSet.has((4 * 32) + 3)).toBe(true);
    expect(mountainSet.has((9 * 32) + 7)).toBe(true);
  });

  it('keeps far zoom on chunk terrain with overview disabled', () => {
    const rm = createDimetricTerrainHarness([]);
    const forests = [];
    for (let y = 8; y < 80; y += 4) {
      for (let x = 8; x < 80; x += 4) {
        forests.push({ x, y });
      }
    }
    rm.state.map = {
      width: 256,
      height: 256,
      tiles: [],
      settlements: [],
      forests,
      mountains: [],
      rivers: [],
      roads: [],
      pois: [],
    };

    rm.renderDimetricWorldTerrain(rm.game.ctx, { x: 0, y: 0, zoom: 0.05 }, {
      map: rm.state.map,
      width: rm.state.map.width,
      height: rm.state.map.height,
      tileSize: 32,
      fog: null,
    });

    expect(rm.dimetricOverviewLastStride).toBe(0);
    expect(rm.dimetricOverviewForestLastCount).toBe(0);
    expect(rm.dimetricTerrainCache.getStats().chunkCount).toBeGreaterThan(0);
  });

  it('keeps the minimal-lod zoom seam out of overview forest fallback', () => {
    const rm = createDimetricTerrainHarness([]);
    const forests = [];
    for (let y = 4; y < 44; y += 4) {
      for (let x = 4; x < 44; x += 4) {
        forests.push({ x, y });
      }
    }
    rm.state.map = {
      width: 128,
      height: 128,
      tiles: [],
      settlements: [],
      forests,
      mountains: [],
      rivers: [],
      roads: [],
      pois: [],
    };

    rm.renderDimetricWorldTerrain(rm.game.ctx, { x: 0, y: 0, zoom: 0.45 }, {
      map: rm.state.map,
      width: rm.state.map.width,
      height: rm.state.map.height,
      tileSize: 32,
      fog: null,
    });

    expect(rm.dimetricLodLevel).toBe('reduced');
    expect(rm.dimetricOverviewLastStride).toBe(0);
    expect(rm.dimetricOverviewForestLastCount).toBe(0);
  });

  it('keeps close zoom out of minimal lod by default', () => {
    const rm = createDimetricTerrainHarness([{ x: 0, y: 0 }]);
    rm.dimetricPerformance.reset(0);
    rm.dimetricQualityProfile = rm.dimetricPerformance.getQualityProfile();

    rm.renderDimetricWorldTerrain(rm.game.ctx, { x: 0, y: 0, zoom: 1 }, {
      map: rm.state.map,
      width: rm.state.map.width,
      height: rm.state.map.height,
      tileSize: 32,
      fog: rm.state.map.fog,
    });

    expect(rm.dimetricLodLevel).toBe('full');
  });

  it('keeps mid zoom on chunk terrain', () => {
    const rm = createDimetricTerrainHarness([]);
    rm.state.map = {
      width: 2048,
      height: 1536,
      tiles: [],
      settlements: [],
      forests: [],
      mountains: [],
      rivers: [],
      roads: [],
      pois: [],
    };
    rm.dimetricPerformance.reset(0);
    rm.dimetricQualityProfile = rm.dimetricPerformance.getQualityProfile();

    rm.renderDimetricWorldTerrain(rm.game.ctx, { x: 0, y: 0, zoom: 0.35 }, {
      map: rm.state.map,
      width: rm.state.map.width,
      height: rm.state.map.height,
      tileSize: 32,
      fog: null,
    });

    expect(rm.dimetricOverviewLastStride).toBe(0);
  });

  it('does not expose the removed legacy art loader path', () => {
    const rm = makeRenderManager({ devMode: true });
    expect(rm.loadHomm3ArtData).toBeUndefined();
    expect(rm.dimetricTerrainMode).toBe('tile');
  });

});
