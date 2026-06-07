import { describe, expect, it, vi } from 'vitest';
import { RenderManager } from '../../js/managers/RenderManager.js';

function makeMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    imageSmoothingEnabled: false,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
  };
}

describe('RenderManager dimetric stage profiler', () => {
  it('records world/fx/ui stage telemetry on renderMap', () => {
    const state = {
      day: 1,
      mode: 'map',
      debug: { fps: 60, enabled: false },
      player: { gold: 0 },
      devMode: false,
    };
    const rm = new RenderManager(state);
    const ctx = makeMockCtx();
    const game = {
      ctx,
      canvas: { width: 1280, height: 720 },
      state,
      uiManager: {
        weatherState: null,
        getWeatherConfig: vi.fn(() => ({})),
      },
      worldManager: {
        getCameraSafe: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
        clampCameraToWorld: vi.fn(),
      },
      gameFlowManager: {
        refreshCurrentEventsSummary: vi.fn(() => []),
      },
      hudManager: { update: vi.fn() },
      followParty: false,
      playerParty: null,
      mode: 'map',
    };
    rm.init(game);

    rm.useDimetric = true;
    rm.renderWorldTerrain = vi.fn();
    rm.renderWorldOverlays = vi.fn();
    rm.renderDimetricWireframeOverlay = vi.fn();

    rm.renderMap();

    expect(Array.isArray(rm.dimetricStageTelemetry)).toBe(true);
    expect(rm.dimetricStageTelemetry.length).toBeGreaterThan(0);
    const stages = rm.dimetricStageTelemetry.map((entry) => entry.stage);
    expect(stages).toContain('world');
    expect(stages).toContain('fx');
    expect(stages).toContain('ui');
  });
});
