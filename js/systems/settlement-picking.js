import * as CONST from '../constants.js';

function normalizeTileSize(tileSize) {
  return Math.max(1, Number(tileSize) || Number(CONST.WORLD?.TILE_SIZE) || 32);
}

function normalizeSettlementTile(settlement, tileSize) {
  const size = normalizeTileSize(tileSize);
  const tx = Number.isFinite(settlement?.tx)
    ? Number(settlement.tx)
    : Math.floor(Number(settlement?.x ?? 0) / size);
  const ty = Number.isFinite(settlement?.ty)
    ? Number(settlement.ty)
    : Math.floor(Number(settlement?.y ?? 0) / size);
  const px = Number.isFinite(settlement?.x) ? Number(settlement.x) : ((tx + 0.5) * size);
  const py = Number.isFinite(settlement?.y) ? Number(settlement.y) : ((ty + 0.5) * size);
  return { tx, ty, px, py };
}

function isFinitePoint(x, y) {
  return Number.isFinite(x) && Number.isFinite(y);
}

export function getSettlementHitRadii(settlement, { isDimetric = false } = {}) {
  const type = String(settlement?.type || 'village').toLowerCase();
  if (!isDimetric) return { radiusX: 0.95, radiusY: 0.95 };
  const footprintW = type === 'city' ? 2.2 : type === 'fort' ? 1.8 : type === 'town' ? 1.6 : 1.25;
  const footprintH = type === 'city' ? 1.75 : type === 'fort' ? 1.45 : type === 'town' ? 1.35 : 1.1;
  return {
    radiusX: Math.max(0.8, footprintW * 0.60),
    radiusY: Math.max(0.8, footprintH * 0.62),
  };
}

export function getSettlementInteractRangeTiles(settlement, { isDimetric = false } = {}) {
  const type = String(settlement?.type || 'village').toLowerCase();
  if (isDimetric) {
    if (type === 'city') return 3.35;
    if (type === 'fort') return 2.95;
    if (type === 'town') return 2.65;
    return 2.25;
  }
  if (type === 'fort' || type === 'city') return 2.35;
  if (type === 'town') return 2.15;
  return 1.9;
}

export function distanceToSettlementTiles(settlement, worldX, worldY, { tileSize } = {}) {
  if (!settlement || !isFinitePoint(worldX, worldY)) return Number.POSITIVE_INFINITY;
  const size = normalizeTileSize(tileSize);
  const worldTileX = Number(worldX) / size;
  const worldTileY = Number(worldY) / size;
  const st = normalizeSettlementTile(settlement, size);
  return Math.hypot(worldTileX - st.tx, worldTileY - st.ty);
}

export function isWorldPointNearSettlement(settlement, worldX, worldY, options = {}) {
  const dist = distanceToSettlementTiles(settlement, worldX, worldY, options);
  if (!Number.isFinite(dist)) return false;
  const range = Number.isFinite(options?.rangeTiles)
    ? Number(options.rangeTiles)
    : getSettlementInteractRangeTiles(settlement, options);
  return dist <= Math.max(0.1, range);
}

export function findSettlementAtWorldPoint(map, worldX, worldY, options = {}) {
  if (!map || !Array.isArray(map.settlements) || !isFinitePoint(worldX, worldY)) return null;

  const size = normalizeTileSize(options.tileSize);
  const worldTileX = Number(worldX) / size;
  const worldTileY = Number(worldY) / size;
  const isDimetric = Boolean(options.isDimetric);
  const hitScale = Math.max(0.5, Number(options.maxHitScale) || 1.0);

  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const settlement of map.settlements) {
    if (!settlement) continue;

    const st = normalizeSettlementTile(settlement, size);
    if (!Number.isFinite(st.tx) || !Number.isFinite(st.ty)) continue;

    const { radiusX, radiusY } = getSettlementHitRadii(settlement, { isDimetric });
    const rx = Math.max(0.1, radiusX * hitScale);
    const ry = Math.max(0.1, radiusY * hitScale);
    const dx = worldTileX - st.tx;
    const dy = worldTileY - st.ty;
    const nx = dx / rx;
    const ny = dy / ry;
    const score = (nx * nx) + (ny * ny);
    if (score > 1.0) continue;

    const dist = Math.hypot(dx, dy);
    if (score < bestScore - 1e-6 || (Math.abs(score - bestScore) <= 1e-6 && dist < bestDist)) {
      best = settlement;
      bestScore = score;
      bestDist = dist;
    }
  }

  return best;
}
