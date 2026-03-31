import * as CONST from '../../constants.js';

function asFiniteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function safeZoom(camera) {
  const raw = asFiniteNumber(camera?.zoom, 1);
  return raw > 0 ? raw : 1;
}

function resolveDimetricConfig(config = {}) {
  const defaults = CONST.DIMETRIC || {};
  const tileW = Math.max(2, asFiniteNumber(config.tileW, asFiniteNumber(defaults.TILE_W, 64)));
  const tileH = Math.max(2, asFiniteNumber(config.tileH, asFiniteNumber(defaults.TILE_H, 32)));
  return {
    tileW,
    tileH,
    elevationPx: Math.max(0, asFiniteNumber(config.elevationPx, asFiniteNumber(defaults.ELEVATION_PX, 24))),
    originX: asFiniteNumber(config.originX, 0),
    originY: asFiniteNumber(config.originY, 0),
  };
}

function resolveCamera(camera = {}) {
  return {
    x: asFiniteNumber(camera.x, 0),
    y: asFiniteNumber(camera.y, 0),
    zoom: safeZoom(camera),
  };
}

export function buildAnchorAlignedConfig({
  anchorTileX = 0,
  anchorTileY = 0,
  anchorWorldX = 0,
  anchorWorldY = 0,
  tileW = null,
  tileH = null,
  elevationPx = null,
} = {}) {
  const base = resolveDimetricConfig({ tileW, tileH, elevationPx });
  const halfW = base.tileW * 0.5;
  const halfH = base.tileH * 0.5;
  const atx = asFiniteNumber(anchorTileX, 0);
  const aty = asFiniteNumber(anchorTileY, 0);
  const awx = asFiniteNumber(anchorWorldX, 0);
  const awy = asFiniteNumber(anchorWorldY, 0);
  return {
    tileW: base.tileW,
    tileH: base.tileH,
    elevationPx: base.elevationPx,
    originX: awx - ((atx - aty) * halfW),
    originY: awy - ((atx + aty) * halfH),
  };
}

export function worldToScreen(tileX, tileY, camera = {}, config = {}, elevation = 0) {
  const c = resolveCamera(camera);
  const cfg = resolveDimetricConfig(config);
  const tx = asFiniteNumber(tileX, 0);
  const ty = asFiniteNumber(tileY, 0);
  const elev = asFiniteNumber(elevation, 0);
  const halfW = cfg.tileW * 0.5;
  const halfH = cfg.tileH * 0.5;
  const worldX = ((tx - ty) * halfW) + cfg.originX;
  const worldY = ((tx + ty) * halfH) + cfg.originY - (elev * cfg.elevationPx);
  return {
    x: (worldX - c.x) * c.zoom,
    y: (worldY - c.y) * c.zoom,
    worldX,
    worldY,
  };
}

export function screenToWorld(screenX, screenY, camera = {}, config = {}, elevation = 0) {
  const c = resolveCamera(camera);
  const cfg = resolveDimetricConfig(config);
  const sx = asFiniteNumber(screenX, 0);
  const sy = asFiniteNumber(screenY, 0);
  const elev = asFiniteNumber(elevation, 0);
  const halfW = cfg.tileW * 0.5;
  const halfH = cfg.tileH * 0.5;
  const worldX = (sx / c.zoom) + c.x;
  const worldY = (sy / c.zoom) + c.y;
  const localX = worldX - cfg.originX;
  const localY = worldY - cfg.originY + (elev * cfg.elevationPx);
  const tileX = ((localX / halfW) + (localY / halfH)) * 0.5;
  const tileY = ((localY / halfH) - (localX / halfW)) * 0.5;
  return { tileX, tileY, worldX, worldY };
}

export function screenToWorldPrecise(screenX, screenY, camera = {}, config = {}, elevation = 0) {
  const rough = screenToWorld(screenX, screenY, camera, config, elevation);
  const baseTileX = Math.floor(rough.tileX);
  const baseTileY = Math.floor(rough.tileY);
  const center = worldToScreen(baseTileX, baseTileY, camera, config, elevation);
  const cfg = resolveDimetricConfig(config);
  const c = resolveCamera(camera);
  const halfW = cfg.tileW * c.zoom * 0.5;
  const halfH = cfg.tileH * c.zoom * 0.5;
  const dx = asFiniteNumber(screenX, 0) - center.x;
  const dy = asFiniteNumber(screenY, 0) - center.y;
  const nx = halfW > 0 ? dx / halfW : 0;
  const ny = halfH > 0 ? dy / halfH : 0;

  let tileX = baseTileX;
  let tileY = baseTileY;
  if ((Math.abs(nx) + Math.abs(ny)) > 1) {
    if (nx >= 0 && ny >= 0) {
      tileX += 1;
    } else if (nx < 0 && ny >= 0) {
      tileY += 1;
    } else if (nx >= 0 && ny < 0) {
      tileY -= 1;
    } else {
      tileX -= 1;
    }
  }

  return {
    tileX,
    tileY,
    roughTileX: rough.tileX,
    roughTileY: rough.tileY,
  };
}

export function projectionRoundTripError(tileX, tileY, camera = {}, config = {}, elevation = 0) {
  const screen = worldToScreen(tileX, tileY, camera, config, elevation);
  const world = screenToWorld(screen.x, screen.y, camera, config, elevation);
  return {
    errorTileX: Math.abs(asFiniteNumber(tileX, 0) - world.tileX),
    errorTileY: Math.abs(asFiniteNumber(tileY, 0) - world.tileY),
  };
}

