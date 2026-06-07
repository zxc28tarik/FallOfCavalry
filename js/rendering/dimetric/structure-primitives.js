const WALL_VARIANT_DIRS = Object.freeze({
  pillar: Object.freeze([]),
  cap_n: Object.freeze(['N']),
  cap_s: Object.freeze(['S']),
  cap_e: Object.freeze(['E']),
  cap_w: Object.freeze(['W']),
  straight_ns: Object.freeze(['N', 'S']),
  straight_ew: Object.freeze(['E', 'W']),
  corner_nw: Object.freeze(['N', 'W']),
  corner_ne: Object.freeze(['N', 'E']),
  corner_sw: Object.freeze(['S', 'W']),
  corner_se: Object.freeze(['S', 'E']),
  tee_n: Object.freeze(['N', 'E', 'W']),
  tee_s: Object.freeze(['S', 'E', 'W']),
  tee_e: Object.freeze(['N', 'S', 'E']),
  tee_w: Object.freeze(['N', 'S', 'W']),
  cross: Object.freeze(['N', 'S', 'E', 'W']),
});

function snap(value, step = 1) {
  return Math.round(value / step) * step;
}

function getBuildingFootprintBounds(def) {
  const footprint = Array.isArray(def?.footprint) && def.footprint.length > 0
    ? def.footprint
    : [{ dx: 0, dy: 0 }];
  let minDx = Infinity;
  let minDy = Infinity;
  let maxDx = -Infinity;
  let maxDy = -Infinity;
  for (const tile of footprint) {
    const dx = Math.floor(Number.isFinite(tile?.dx) ? tile.dx : 0);
    const dy = Math.floor(Number.isFinite(tile?.dy) ? tile.dy : 0);
    if (dx < minDx) minDx = dx;
    if (dy < minDy) minDy = dy;
    if (dx > maxDx) maxDx = dx;
    if (dy > maxDy) maxDy = dy;
  }
  return {
    minDx,
    minDy,
    maxDx,
    maxDy,
    footprintW: Math.max(1, (maxDx - minDx) + 1),
    footprintH: Math.max(1, (maxDy - minDy) + 1),
  };
}

export function buildDimetricBuildingMetrics(building, def, tileW, tileH) {
  const footprint = getBuildingFootprintBounds(def);
  const elevation = Math.max(
    0,
    Number.isFinite(building?.elevation) ? Number(building.elevation) : Number(def?.elevation) || 0,
  );
  const widthTiles = Math.max(1, Number(footprint.footprintW) || 1);
  const heightTiles = Math.max(1, Number(footprint.footprintH) || 1);
  const bodyWidth = Math.max(tileW * 0.80, tileW * (0.70 + (widthTiles * 0.48)));
  const bodyHeight = Math.max(tileH * 1.05, tileH * (0.90 + (heightTiles * 0.54) + (elevation * 0.42)));
  const bottomOffset = Math.max(tileH * 0.34, tileH * (0.38 + (heightTiles * 0.22) + (elevation * 0.14)));
  const depthMul = Math.max(1.05, 0.98 + (heightTiles * 0.32) + (elevation * 0.18));
  return {
    footprint,
    elevation,
    bodyWidth,
    bodyHeight,
    bottomOffset,
    screenBottomOffset: Math.max(4, tileH * depthMul * 0.5),
  };
}

function drawDimetricWallPrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, variant, ellipse) {
  const baseY = centerY + tileH * 0.10;
  const bodyW = Math.max(4, tileW * 0.60);
  const bodyH = Math.max(4, tileH * 0.84);
  const left = snap(centerX - bodyW * 0.5, 1);
  const top = snap(baseY - bodyH, 1);
  const stoneLight = `rgb(${Math.round(184 * fogMul)},${Math.round(173 * fogMul)},${Math.round(156 * fogMul)})`;
  const stoneMid = `rgb(${Math.round(144 * fogMul)},${Math.round(132 * fogMul)},${Math.round(116 * fogMul)})`;
  const stoneDark = `rgba(${Math.round(78 * fogMul)},${Math.round(68 * fogMul)},${Math.round(58 * fogMul)},0.92)`;

  ctx.fillStyle = `rgba(0,0,0,${0.17 * fogMul})`;
  ctx.beginPath();
  ellipse(ctx, centerX + tileW * 0.05, baseY + tileH * 0.10, tileW * 0.28, tileH * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stoneMid;
  ctx.fillRect(left, top, Math.max(1, Math.round(bodyW)), Math.max(1, Math.round(bodyH)));
  ctx.fillStyle = stoneLight;
  ctx.fillRect(left, top, Math.max(1, Math.round(bodyW)), Math.max(1, Math.round(bodyH * 0.20)));
  ctx.strokeStyle = stoneDark;
  ctx.lineWidth = Math.max(1, tileW * 0.036);
  ctx.strokeRect(left + 0.5, top + 0.5, Math.max(1, Math.round(bodyW) - 1), Math.max(1, Math.round(bodyH) - 1));

  const crenelCount = Math.max(2, Math.floor(bodyW / Math.max(4, tileW * 0.13)));
  const crenelW = bodyW / (crenelCount * 2);
  const crenelH = Math.max(2, tileH * 0.18);
  for (let i = 0; i < crenelCount; i += 1) {
    const x = left + (i * 2 * crenelW);
    ctx.fillStyle = stoneLight;
    ctx.fillRect(snap(x, 1), snap(top - crenelH, 1), Math.max(1, Math.round(crenelW)), Math.max(1, Math.round(crenelH)));
    ctx.fillStyle = stoneDark;
    ctx.fillRect(snap(x, 1), snap(top - 1, 1), Math.max(1, Math.round(crenelW)), 1);
  }

  const dirs = WALL_VARIANT_DIRS[variant] || WALL_VARIANT_DIRS.pillar;
  const connLenX = tileW * 0.22;
  const connLenY = tileH * 0.34;
  ctx.strokeStyle = stoneDark;
  ctx.lineWidth = Math.max(1, tileW * 0.050);
  for (const dir of dirs) {
    ctx.beginPath();
    if (dir === 'N') {
      ctx.moveTo(centerX, top + Math.max(1, tileH * 0.10));
      ctx.lineTo(centerX, top - connLenY);
    } else if (dir === 'S') {
      ctx.moveTo(centerX, baseY - Math.max(1, tileH * 0.06));
      ctx.lineTo(centerX, baseY + connLenY);
    } else if (dir === 'E') {
      ctx.moveTo(centerX + bodyW * 0.5, baseY - bodyH * 0.48);
      ctx.lineTo(centerX + bodyW * 0.5 + connLenX, baseY - bodyH * 0.48);
    } else if (dir === 'W') {
      ctx.moveTo(centerX - bodyW * 0.5, baseY - bodyH * 0.48);
      ctx.lineTo(centerX - bodyW * 0.5 - connLenX, baseY - bodyH * 0.48);
    }
    ctx.stroke();
  }
}

function drawDimetricKeepPrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, metrics, ellipse) {
  const width = Math.max(tileW * 0.95, metrics.bodyWidth * 0.66);
  const height = Math.max(tileH * 1.85, metrics.bodyHeight * 0.95);
  const bottom = centerY + tileH * 0.15;
  const top = bottom - height;
  const left = centerX - width * 0.5;
  const right = centerX + width * 0.5;
  const roofY = top - Math.max(4, tileH * 0.26);
  const stoneLight = `rgb(${Math.round(188 * fogMul)},${Math.round(176 * fogMul)},${Math.round(160 * fogMul)})`;
  const stoneMid = `rgb(${Math.round(146 * fogMul)},${Math.round(132 * fogMul)},${Math.round(116 * fogMul)})`;
  const stoneDark = `rgb(${Math.round(100 * fogMul)},${Math.round(88 * fogMul)},${Math.round(76 * fogMul)})`;

  ctx.fillStyle = `rgba(0,0,0,${0.20 * fogMul})`;
  ctx.beginPath();
  ellipse(ctx, centerX + tileW * 0.08, bottom + tileH * 0.06, width * 0.54, tileH * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stoneMid;
  ctx.fillRect(snap(left, 1), snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  ctx.fillStyle = stoneLight;
  ctx.fillRect(snap(left, 1), snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height * 0.30)));
  ctx.fillStyle = stoneDark;
  ctx.fillRect(snap(right - width * 0.16, 1), snap(top, 1), Math.max(1, Math.round(width * 0.16)), Math.max(1, Math.round(height)));

  ctx.fillStyle = stoneLight;
  ctx.beginPath();
  ctx.moveTo(snap(centerX, 1), snap(roofY, 1));
  ctx.lineTo(snap(right, 1), snap(top + tileH * 0.10, 1));
  ctx.lineTo(snap(centerX, 1), snap(top + tileH * 0.28, 1));
  ctx.lineTo(snap(left, 1), snap(top + tileH * 0.10, 1));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(${Math.round(74 * fogMul)},${Math.round(64 * fogMul)},${Math.round(56 * fogMul)},0.88)`;
  ctx.lineWidth = Math.max(1, tileW * 0.030);
  ctx.stroke();
}

function drawDimetricGatehousePrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, metrics, ellipse) {
  const width = Math.max(tileW * 1.05, metrics.bodyWidth * 0.74);
  const height = Math.max(tileH * 1.30, metrics.bodyHeight * 0.74);
  const bottom = centerY + tileH * 0.12;
  const top = bottom - height;
  const left = centerX - width * 0.5;
  const stoneLight = `rgb(${Math.round(180 * fogMul)},${Math.round(168 * fogMul)},${Math.round(148 * fogMul)})`;
  const stoneMid = `rgb(${Math.round(134 * fogMul)},${Math.round(121 * fogMul)},${Math.round(104 * fogMul)})`;
  const stoneDark = `rgb(${Math.round(92 * fogMul)},${Math.round(78 * fogMul)},${Math.round(66 * fogMul)})`;

  ctx.fillStyle = `rgba(0,0,0,${0.18 * fogMul})`;
  ctx.beginPath();
  ellipse(ctx, centerX + tileW * 0.05, bottom + tileH * 0.08, width * 0.54, tileH * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = stoneMid;
  ctx.fillRect(snap(left, 1), snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  ctx.fillStyle = stoneLight;
  ctx.fillRect(snap(left, 1), snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height * 0.24)));
  ctx.fillStyle = stoneDark;
  ctx.fillRect(snap(centerX - width * 0.07, 1), snap(top + height * 0.40, 1), Math.max(1, Math.round(width * 0.14)), Math.max(1, Math.round(height * 0.60)));

  const doorW = Math.max(3, width * 0.28);
  const doorH = Math.max(4, height * 0.42);
  ctx.fillStyle = `rgba(${Math.round(68 * fogMul)},${Math.round(48 * fogMul)},${Math.round(32 * fogMul)},0.96)`;
  ctx.fillRect(
    snap(centerX - doorW * 0.5, 1),
    snap(bottom - doorH, 1),
    Math.max(1, Math.round(doorW)),
    Math.max(1, Math.round(doorH)),
  );
}

function drawDimetricGranaryPrimitive(ctx, centerX, centerY, tileW, tileH, fogMul, metrics, ellipse) {
  const width = Math.max(tileW * 0.72, metrics.bodyWidth * 0.50);
  const height = Math.max(tileH * 1.05, metrics.bodyHeight * 0.58);
  const bottom = centerY + tileH * 0.10;
  const top = bottom - height;
  const left = centerX - width * 0.5;
  const right = centerX + width * 0.5;
  const roofPeakY = top - Math.max(3, tileH * 0.36);
  const wallColor = `rgb(${Math.round(170 * fogMul)},${Math.round(142 * fogMul)},${Math.round(98 * fogMul)})`;
  const roofColor = `rgb(${Math.round(118 * fogMul)},${Math.round(78 * fogMul)},${Math.round(52 * fogMul)})`;
  const roofShade = `rgb(${Math.round(94 * fogMul)},${Math.round(60 * fogMul)},${Math.round(40 * fogMul)})`;

  ctx.fillStyle = `rgba(0,0,0,${0.16 * fogMul})`;
  ctx.beginPath();
  ellipse(ctx, centerX + tileW * 0.04, bottom + tileH * 0.05, width * 0.46, tileH * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = wallColor;
  ctx.fillRect(snap(left, 1), snap(top, 1), Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(snap(left - tileW * 0.06, 1), snap(top + tileH * 0.08, 1));
  ctx.lineTo(snap(centerX, 1), snap(roofPeakY, 1));
  ctx.lineTo(snap(right + tileW * 0.06, 1), snap(top + tileH * 0.08, 1));
  ctx.lineTo(snap(right, 1), snap(top + tileH * 0.24, 1));
  ctx.lineTo(snap(left, 1), snap(top + tileH * 0.24, 1));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = roofShade;
  ctx.lineWidth = Math.max(1, tileW * 0.03);
  ctx.stroke();
}

export function drawDimetricBuildingPrimitive(ctx, buildingEntry, tileW, tileH, { ellipse } = {}) {
  if (!ctx || !buildingEntry || typeof ellipse !== 'function') return;
  const metrics = buildingEntry.metrics || null;
  if (!metrics) return;
  const defId = String(buildingEntry.def?.id || buildingEntry.building?.defId || '').toLowerCase();
  const fogMul = buildingEntry.fogLevel === 1 ? 0.60 : 1.0;
  ctx.save();
  ctx.globalAlpha *= buildingEntry.fogLevel === 1 ? 0.68 : 1.0;
  if (defId === 'wall') {
    drawDimetricWallPrimitive(
      ctx,
      buildingEntry.sx,
      buildingEntry.sy,
      tileW,
      tileH,
      fogMul,
      buildingEntry.wallVariant || 'pillar',
      ellipse,
    );
  } else if (defId === 'keep') {
    drawDimetricKeepPrimitive(ctx, buildingEntry.sx, buildingEntry.sy, tileW, tileH, fogMul, metrics, ellipse);
  } else if (defId === 'gatehouse') {
    drawDimetricGatehousePrimitive(ctx, buildingEntry.sx, buildingEntry.sy, tileW, tileH, fogMul, metrics, ellipse);
  } else {
    drawDimetricGranaryPrimitive(ctx, buildingEntry.sx, buildingEntry.sy, tileW, tileH, fogMul, metrics, ellipse);
  }
  ctx.restore();
}
