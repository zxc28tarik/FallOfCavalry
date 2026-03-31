import * as CONST from '../../constants.js';
import { buildAnchorAlignedConfig } from './projection.js';

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function parseDimetricFlag(raw) {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().toLowerCase();
  if (!value) return null;
  if (['1', 'true', 'on', 'yes'].includes(value)) return true;
  if (['0', 'false', 'off', 'no'].includes(value)) return false;
  return null;
}

function parseDimetricPropStyleProfile(raw) {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().toLowerCase();
  if (!value) return null;
  if (value === 'stronghold' || value === 'classic') return value;
  return null;
}

export function getDimetricWireframeUrlOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URL(window.location.href).searchParams;
    const raw = params.get('wireframe') ?? params.get('dimetric_wireframe') ?? params.get('dimetricWireframe');
    return parseDimetricFlag(raw);
  } catch {
    return null;
  }
}

export function getDimetricUrlOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URL(window.location.href).searchParams.get('dimetric');
    return parseDimetricFlag(raw);
  } catch {
    return null;
  }
}

export function getLegacyTopdownUrlOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URL(window.location.href).searchParams;
    const raw = params.get('legacy_topdown') ?? params.get('legacyTopdown');
    return parseDimetricFlag(raw);
  } catch {
    return null;
  }
}

export function getDimetricPropStyleUrlOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URL(window.location.href).searchParams;
    const raw = params.get('prop_style') ?? params.get('propStyle') ?? params.get('dimetric_style');
    return parseDimetricPropStyleProfile(raw);
  } catch {
    return null;
  }
}

function normalizeDimetricPropStyleProfile(profile) {
  return parseDimetricPropStyleProfile(profile) || 'stronghold';
}

export function resolveDimetricPropStyleProfile(defaultProfile = 'stronghold', options = {}) {
  const fallback = normalizeDimetricPropStyleProfile(defaultProfile);
  const allowUrlOverride = options?.allowUrlOverride !== false;
  const override = getDimetricPropStyleUrlOverride();
  if (allowUrlOverride && override) return override;
  return fallback;
}

export function resolveDimetricWireframeEnabled(
  defaultEnabled = Boolean(CONST.DIMETRIC?.DEBUG_WIREFRAME_ENABLED),
  options = {},
) {
  const fallback = Boolean(defaultEnabled);
  const allowUrlOverride = options?.allowUrlOverride !== false;
  const override = getDimetricWireframeUrlOverride();
  if (allowUrlOverride && override !== null) return override;
  return fallback;
}

export function resolveProjectionMode(
  defaultEnabled = Boolean(CONST.DIMETRIC?.USE_DIMETRIC),
  options = {},
) {
  const defaultValue = Boolean(defaultEnabled);
  const allowLegacyUrlOverride = options?.allowLegacyUrlOverride !== false;
  const allowLegacyRuntime = options?.allowLegacyRuntime !== false;
  const override = getDimetricUrlOverride();
  const legacyAllowedByConfig = allowLegacyRuntime && Boolean(CONST.DIMETRIC?.ALLOW_LEGACY_TOPDOWN);
  const legacyRequestedRaw = getLegacyTopdownUrlOverride() === true;
  const legacyRequested = allowLegacyRuntime && allowLegacyUrlOverride && legacyRequestedRaw;

  if (override === true) {
    return {
      mode: 'dimetric',
      dimetricEnabled: true,
      legacyTopdownEnabled: false,
      source: 'url_dimetric_on',
    };
  }

  if (override === false) {
    if (!defaultValue) {
      return {
        mode: 'legacy_topdown',
        dimetricEnabled: false,
        legacyTopdownEnabled: true,
        source: 'url_dimetric_off',
      };
    }

    if (defaultValue && !legacyAllowedByConfig && !legacyRequested) {
      return {
        mode: 'dimetric',
        dimetricEnabled: true,
        legacyTopdownEnabled: false,
        source: !allowLegacyRuntime
          ? 'legacy_runtime_blocked'
          : (legacyRequestedRaw ? 'legacy_url_override_blocked' : 'legacy_blocked'),
      };
    }
    return {
      mode: 'legacy_topdown',
      dimetricEnabled: false,
      legacyTopdownEnabled: true,
      source: legacyAllowedByConfig
        ? 'config_legacy_topdown'
        : legacyRequested
          ? 'url_legacy_topdown'
          : 'url_dimetric_off',
    };
  }

  return {
    mode: defaultValue ? 'dimetric' : 'legacy_topdown',
    dimetricEnabled: defaultValue,
    legacyTopdownEnabled: !defaultValue,
    source: 'default',
  };
}

export function isDimetricEnabled(defaultEnabled = Boolean(CONST.DIMETRIC?.USE_DIMETRIC), options = {}) {
  return resolveProjectionMode(defaultEnabled, options).dimetricEnabled;
}

export function isLegacyTopdownEnabled(defaultEnabled = Boolean(CONST.DIMETRIC?.USE_DIMETRIC), options = {}) {
  return resolveProjectionMode(defaultEnabled, options).legacyTopdownEnabled;
}

export function buildDimetricCameraConfig({
  camera,
  map,
  canvas,
  tileSize = CONST.WORLD?.TILE_SIZE,
  tileW = CONST.DIMETRIC?.TILE_W,
  tileH = CONST.DIMETRIC?.TILE_H,
  elevationPx = CONST.DIMETRIC?.ELEVATION_PX,
} = {}) {
  if (!camera) return null;
  const zoom = Math.max(0.01, finite(camera.zoom, 1));
  const viewW = finite(canvas?.width, finite(CONST.GAME?.VIEW_WIDTH, 1280)) / zoom;
  const viewH = finite(canvas?.height, finite(CONST.GAME?.VIEW_HEIGHT, 720)) / zoom;
  const mapWidth = Math.max(1, Math.floor(finite(map?.width, finite(CONST.WORLD?.MAP_WIDTH, 180))));
  const mapHeight = Math.max(1, Math.floor(finite(map?.height, finite(CONST.WORLD?.MAP_HEIGHT, 120))));
  const baseTileSize = Math.max(1, finite(tileSize, 32));
  const centerWorldX = finite(camera.x, 0) + (viewW * 0.5);
  const centerWorldY = finite(camera.y, 0) + (viewH * 0.5);
  const anchorTileX = Math.max(0, Math.min(mapWidth - 1, Math.floor(centerWorldX / baseTileSize)));
  const anchorTileY = Math.max(0, Math.min(mapHeight - 1, Math.floor(centerWorldY / baseTileSize)));
  const anchorWorldX = centerWorldX;
  const anchorWorldY = centerWorldY;
  const config = buildAnchorAlignedConfig({
    anchorTileX,
    anchorTileY,
    anchorWorldX,
    anchorWorldY,
    tileW: finite(tileW, 64),
    tileH: finite(tileH, 32),
    elevationPx: finite(elevationPx, 24),
  });

  return {
    config,
    zoom,
    viewW,
    viewH,
    mapWidth,
    mapHeight,
    tileSize: baseTileSize,
    centerWorldX,
    centerWorldY,
    anchorTileX,
    anchorTileY,
    anchorWorldX,
    anchorWorldY,
  };
}
