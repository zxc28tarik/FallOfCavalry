function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointInRect(point, rect) {
  if (!point || !rect) return false;
  return point.x >= rect.minX
    && point.x <= rect.maxX
    && point.y >= rect.minY
    && point.y <= rect.maxY;
}

// Liang-Barsky line clipping test.
function segmentIntersectsRect(a, b, rect) {
  if (!a || !b || !rect) return false;
  const x0 = finite(a.x, Number.NaN);
  const y0 = finite(a.y, Number.NaN);
  const x1 = finite(b.x, Number.NaN);
  const y1 = finite(b.y, Number.NaN);
  if (![x0, y0, x1, y1].every(Number.isFinite)) return false;

  const dx = x1 - x0;
  const dy = y1 - y0;

  let t0 = 0;
  let t1 = 1;

  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (!clip(-dx, x0 - rect.minX)) return false;
  if (!clip(dx, rect.maxX - x0)) return false;
  if (!clip(-dy, y0 - rect.minY)) return false;
  if (!clip(dy, rect.maxY - y0)) return false;
  return t1 >= t0;
}

function buildBand(color, width) {
  return Object.freeze({
    color: String(color),
    width: Math.max(0.5, finite(width, 1)),
  });
}

export function pathIntersectsTileBounds(path, bounds, padding = 0) {
  if (!Array.isArray(path) || path.length === 0 || !bounds) return false;
  const pad = Math.max(0, finite(padding, 0));
  const rect = {
    minX: finite(bounds.minX, 0) - pad,
    minY: finite(bounds.minY, 0) - pad,
    maxX: finite(bounds.maxX, 0) + pad,
    maxY: finite(bounds.maxY, 0) + pad,
  };

  const points = [];
  for (const point of path) {
    const x = finite(point?.x, Number.NaN);
    const y = finite(point?.y, Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p = { x, y };
    points.push(p);
    if (pointInRect(p, rect)) return true;
  }

  for (let i = 1; i < points.length; i += 1) {
    if (segmentIntersectsRect(points[i - 1], points[i], rect)) return true;
  }
  return false;
}

export function projectTilePath(path, projectPoint) {
  if (!Array.isArray(path) || typeof projectPoint !== 'function') return [];
  const out = [];
  for (const point of path) {
    const x = finite(point?.x, Number.NaN);
    const y = finite(point?.y, Number.NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const projected = projectPoint(x, y);
    if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) continue;
    out.push({
      x: finite(projected.x, 0),
      y: finite(projected.y, 0),
    });
  }
  return out;
}

export function drawPolylineBands(ctx, points, bands) {
  if (!ctx || !Array.isArray(points) || points.length < 2 || !Array.isArray(bands) || bands.length === 0) return false;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const band of bands) {
    const width = Math.max(0.5, finite(band?.width, 1));
    const color = String(band?.color || 'rgba(0,0,0,0.8)');
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  return true;
}

export function createRiverBands(zoom) {
  const z = clamp(finite(zoom, 1), 0.35, 3.5);
  return Object.freeze([
    buildBand('rgba(17,46,84,0.36)', Math.max(1.4, 7.6 * z)),
    buildBand('rgba(28,68,130,0.86)', Math.max(1.2, 5.4 * z)),
    buildBand('rgba(50,110,200,0.92)', Math.max(1.0, 3.6 * z)),
    buildBand('rgba(142,194,244,0.56)', Math.max(0.8, 1.25 * z)),
  ]);
}

export function createRoadBands(zoom) {
  const z = clamp(finite(zoom, 1), 0.35, 3.5);
  return Object.freeze([
    buildBand('rgba(63,46,29,0.48)', Math.max(1.0, 2.8 * z)),
    buildBand('rgba(158,125,82,0.86)', Math.max(0.8, 1.9 * z)),
    buildBand('rgba(197,162,116,0.34)', Math.max(0.6, 0.95 * z)),
  ]);
}

export function drawCrossingMarker(ctx, {
  x,
  y,
  tileW,
  tileH,
  zoom = 1,
} = {}) {
  if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const z = clamp(finite(zoom, 1), 0.35, 3.5);
  const halfW = Math.max(2, finite(tileW, 64) * z * 0.14);
  const halfH = Math.max(1, finite(tileH, 32) * z * 0.08);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - halfH);
  ctx.lineTo(x + halfW, y);
  ctx.lineTo(x, y + halfH);
  ctx.lineTo(x - halfW, y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(143,108,66,0.90)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(71,50,30,0.82)';
  ctx.lineWidth = Math.max(0.8, 1.1 * z);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(208,176,132,0.62)';
  ctx.lineWidth = Math.max(0.6, 0.8 * z);
  ctx.beginPath();
  ctx.moveTo(x - (halfW * 0.62), y);
  ctx.lineTo(x + (halfW * 0.62), y);
  ctx.stroke();
  ctx.restore();
  return true;
}
