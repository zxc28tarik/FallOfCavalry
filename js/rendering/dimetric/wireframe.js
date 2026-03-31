import * as CONST from '../../constants.js';
import {
  buildAnchorAlignedConfig,
  projectionRoundTripError,
  worldToScreen,
} from './projection.js';

function asFiniteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function drawDiamond(ctx, centerX, centerY, halfW, halfH) {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - halfH);
  ctx.lineTo(centerX + halfW, centerY);
  ctx.lineTo(centerX, centerY + halfH);
  ctx.lineTo(centerX - halfW, centerY);
  ctx.closePath();
}

export function drawDimetricWireframe(ctx, camera, options = {}) {
  if (!ctx || !camera) return null;
  const tileW = Math.max(2, asFiniteNumber(options.tileW, asFiniteNumber(CONST.DIMETRIC?.TILE_W, 64)));
  const tileH = Math.max(2, asFiniteNumber(options.tileH, asFiniteNumber(CONST.DIMETRIC?.TILE_H, 32)));
  const elevationPx = Math.max(0, asFiniteNumber(options.elevationPx, asFiniteNumber(CONST.DIMETRIC?.ELEVATION_PX, 24)));
  const startTileX = Math.floor(asFiniteNumber(options.startTileX, 0));
  const startTileY = Math.floor(asFiniteNumber(options.startTileY, 0));
  const size = Math.max(1, Math.floor(asFiniteNumber(options.size, 16)));
  const anchorTileX = asFiniteNumber(options.anchorTileX, startTileX);
  const anchorTileY = asFiniteNumber(options.anchorTileY, startTileY);
  const anchorWorldX = asFiniteNumber(options.anchorWorldX, 0);
  const anchorWorldY = asFiniteNumber(options.anchorWorldY, 0);
  const lineColor = options.lineColor || 'rgba(255, 214, 100, 0.58)';
  const centerColor = options.centerColor || 'rgba(255, 120, 120, 0.95)';
  const highlightColor = options.highlightColor || 'rgba(120, 200, 255, 0.85)';

  const config = buildAnchorAlignedConfig({
    anchorTileX,
    anchorTileY,
    anchorWorldX,
    anchorWorldY,
    tileW,
    tileH,
    elevationPx,
  });

  const zoom = Math.max(0.01, asFiniteNumber(camera.zoom, 1));
  const halfW = tileW * zoom * 0.5;
  const halfH = tileH * zoom * 0.5;

  ctx.save();
  ctx.lineWidth = Math.max(1, 1.1 * zoom);
  ctx.strokeStyle = lineColor;
  for (let ty = startTileY; ty < startTileY + size; ty += 1) {
    for (let tx = startTileX; tx < startTileX + size; tx += 1) {
      const center = worldToScreen(tx, ty, camera, config);
      drawDiamond(ctx, center.x, center.y, halfW, halfH);
      ctx.stroke();
    }
  }

  const anchorScreen = worldToScreen(anchorTileX, anchorTileY, camera, config);
  drawDiamond(ctx, anchorScreen.x, anchorScreen.y, halfW, halfH);
  ctx.strokeStyle = centerColor;
  ctx.lineWidth = Math.max(1.2, 1.8 * zoom);
  ctx.stroke();
  ctx.fillStyle = centerColor;
  ctx.fillRect(Math.round(anchorScreen.x) - 1, Math.round(anchorScreen.y) - 1, 3, 3);

  if (options.highlightTile && Number.isFinite(options.highlightTile.x) && Number.isFinite(options.highlightTile.y)) {
    const highlight = worldToScreen(options.highlightTile.x, options.highlightTile.y, camera, config);
    drawDiamond(ctx, highlight.x, highlight.y, halfW, halfH);
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = Math.max(1.6, 2.2 * zoom);
    ctx.stroke();
  }

  ctx.restore();

  return {
    config,
    startTileX,
    startTileY,
    size,
    anchorTileX,
    anchorTileY,
  };
}

export function runWireframeRoundTripSuite({
  startTileX = 0,
  startTileY = 0,
  size = 16,
  camera,
  config,
} = {}) {
  if (!camera || !config) return null;
  let maxError = 0;
  let samples = 0;
  for (let ty = startTileY; ty < startTileY + size; ty += 1) {
    for (let tx = startTileX; tx < startTileX + size; tx += 1) {
      const err = projectionRoundTripError(tx, ty, camera, config);
      maxError = Math.max(maxError, err.errorTileX, err.errorTileY);
      samples += 1;
    }
  }
  return { samples, maxError };
}

