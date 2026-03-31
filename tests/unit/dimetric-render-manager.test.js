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

  it('keeps stronghold prop style in non-dev even when URL asks for classic', () => {
    setWindowHref('http://localhost:5173/?prop_style=classic');
    const rm = makeRenderManager({ devMode: false });
    expect(rm.dimetricPropStyleProfile).toBe('stronghold');
  });

  it('allows classic prop style override in dev mode', () => {
    setWindowHref('http://localhost:5173/?prop_style=classic');
    const rm = makeRenderManager({ devMode: true });
    expect(rm.dimetricPropStyleProfile).toBe('classic');
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
});
