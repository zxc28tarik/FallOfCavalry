import { afterEach, describe, expect, it } from 'vitest';
import {
  getDimetricWireframeUrlOverride,
  getDimetricUrlOverride,
  getDimetricPropStyleUrlOverride,
  getLegacyTopdownUrlOverride,
  isLegacyTopdownEnabled,
  isDimetricEnabled,
  resolveDimetricPropStyleProfile,
  resolveDimetricWireframeEnabled,
  resolveProjectionMode,
} from '../../js/rendering/dimetric/view-config.js';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function setWindowHref(href) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      location: { href },
    },
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

describe('dimetric view config', () => {
  it('uses default value when no browser window exists', () => {
    restoreWindow();
    expect(getDimetricUrlOverride()).toBeNull();
    expect(getDimetricWireframeUrlOverride()).toBeNull();
    expect(isDimetricEnabled(true)).toBe(true);
    expect(isDimetricEnabled(false)).toBe(false);
  });

  it('parses URL override true values', () => {
    setWindowHref('http://localhost:5173/?dimetric=1');
    expect(getDimetricUrlOverride()).toBe(true);
    expect(isDimetricEnabled(false)).toBe(true);
  });

  it('resolves prop style profile from URL override', () => {
    setWindowHref('http://localhost:5173/?prop_style=classic');
    expect(getDimetricPropStyleUrlOverride()).toBe('classic');
    expect(resolveDimetricPropStyleProfile('stronghold')).toBe('classic');
  });

  it('resolves wireframe toggle from URL override', () => {
    setWindowHref('http://localhost:5173/?wireframe=1');
    expect(getDimetricWireframeUrlOverride()).toBe(true);
    expect(resolveDimetricWireframeEnabled(false)).toBe(true);
  });

  it('blocks wireframe URL override when allowUrlOverride=false', () => {
    setWindowHref('http://localhost:5173/?wireframe=1');
    expect(resolveDimetricWireframeEnabled(false, { allowUrlOverride: false })).toBe(false);
  });

  it('falls back to normalized default prop style profile on invalid URL override', () => {
    setWindowHref('http://localhost:5173/?prop_style=retro');
    expect(getDimetricPropStyleUrlOverride()).toBeNull();
    expect(resolveDimetricPropStyleProfile('classic')).toBe('classic');
    expect(resolveDimetricPropStyleProfile('invalid-default')).toBe('stronghold');
  });

  it('blocks prop style URL override when allowUrlOverride=false', () => {
    setWindowHref('http://localhost:5173/?prop_style=classic');
    expect(resolveDimetricPropStyleProfile('stronghold', { allowUrlOverride: false })).toBe('stronghold');
  });

  it('keeps dimetric enabled by default even when dimetric=off is set alone', () => {
    setWindowHref('http://localhost:5173/?dimetric=off');
    expect(getDimetricUrlOverride()).toBe(false);
    expect(getLegacyTopdownUrlOverride()).toBeNull();
    expect(isDimetricEnabled(true)).toBe(true);
    expect(isLegacyTopdownEnabled(true)).toBe(false);
    expect(resolveProjectionMode(true)).toEqual({
      mode: 'dimetric',
      dimetricEnabled: true,
      legacyTopdownEnabled: false,
      source: 'legacy_blocked',
    });
  });

  it('allows explicit legacy topdown override with dimetric=off + legacy_topdown=1', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    expect(getDimetricUrlOverride()).toBe(false);
    expect(getLegacyTopdownUrlOverride()).toBe(true);
    expect(isDimetricEnabled(true)).toBe(false);
    expect(isLegacyTopdownEnabled(true)).toBe(true);
  });

  it('blocks legacy URL override when allowLegacyUrlOverride=false', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    expect(isDimetricEnabled(true, { allowLegacyUrlOverride: false })).toBe(true);
    expect(isLegacyTopdownEnabled(true, { allowLegacyUrlOverride: false })).toBe(false);
    expect(resolveProjectionMode(true, { allowLegacyUrlOverride: false })).toEqual({
      mode: 'dimetric',
      dimetricEnabled: true,
      legacyTopdownEnabled: false,
      source: 'legacy_url_override_blocked',
    });
  });

  it('blocks all legacy runtime switches when allowLegacyRuntime=false', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    expect(isDimetricEnabled(true, { allowLegacyRuntime: false })).toBe(true);
    expect(isLegacyTopdownEnabled(true, { allowLegacyRuntime: false })).toBe(false);
    expect(resolveProjectionMode(true, { allowLegacyRuntime: false })).toEqual({
      mode: 'dimetric',
      dimetricEnabled: true,
      legacyTopdownEnabled: false,
      source: 'legacy_runtime_blocked',
    });
  });

  it('exposes projection mode metadata from resolver', () => {
    setWindowHref('http://localhost:5173/?dimetric=off&legacy_topdown=1');
    expect(resolveProjectionMode(true)).toEqual({
      mode: 'legacy_topdown',
      dimetricEnabled: false,
      legacyTopdownEnabled: true,
      source: 'url_legacy_topdown',
    });
  });

  it('ignores invalid URL override values', () => {
    setWindowHref('http://localhost:5173/?dimetric=maybe');
    expect(getDimetricUrlOverride()).toBeNull();
    expect(isDimetricEnabled(true)).toBe(true);
  });
});
