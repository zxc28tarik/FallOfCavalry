import { getBuildingDef } from '../../data/building-defs.js';

export const WALL_MASK = Object.freeze({
  N: 8,
  S: 4,
  E: 2,
  W: 1,
});

const NEIGHBORS = Object.freeze([
  Object.freeze({ dir: 'N', dx: 0, dy: -1, bit: WALL_MASK.N }),
  Object.freeze({ dir: 'S', dx: 0, dy: 1, bit: WALL_MASK.S }),
  Object.freeze({ dir: 'E', dx: 1, dy: 0, bit: WALL_MASK.E }),
  Object.freeze({ dir: 'W', dx: -1, dy: 0, bit: WALL_MASK.W }),
]);

const REQUIRED_ATTACH_DIRS = Object.freeze({
  N: Object.freeze(['S', 'SE', 'SW']),
  S: Object.freeze(['N', 'NE', 'NW']),
  E: Object.freeze(['W', 'NW', 'SW']),
  W: Object.freeze(['E', 'NE', 'SE']),
});

export const WALL_VARIANT_MAP = Object.freeze({
  0: 'pillar',
  1: 'cap_w',
  2: 'cap_e',
  3: 'straight_ew',
  4: 'cap_s',
  5: 'corner_sw',
  6: 'corner_se',
  7: 'tee_s',
  8: 'cap_n',
  9: 'corner_nw',
  10: 'corner_ne',
  11: 'tee_n',
  12: 'straight_ns',
  13: 'tee_w',
  14: 'tee_e',
  15: 'cross',
});

function tileKey(x, y) {
  return `${x},${y}`;
}

function normalizeDirection(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function getInstanceById(buildingId, options = {}) {
  if (!buildingId) return null;
  if (typeof options.getBuildingById === 'function') {
    return options.getBuildingById(buildingId) || null;
  }
  if (options.buildings instanceof Map) {
    return options.buildings.get(buildingId) || null;
  }
  return null;
}

function getDefByIdOrInstance(buildingId, instance = null, options = {}) {
  if (instance?.defId) {
    const defFromInstance = getBuildingDef(instance.defId);
    if (defFromInstance) return defFromInstance;
  }
  if (typeof options.getDefById === 'function') {
    return options.getDefById(buildingId) || null;
  }
  if (typeof buildingId === 'string' && buildingId.length > 0) {
    const first = buildingId.split('_')[0];
    const def = getBuildingDef(first);
    if (def) return def;
  }
  return null;
}

function isWallConnectorDef(def) {
  if (!def || typeof def !== 'object') return false;
  if (def.id === 'wall') return true;
  return Array.isArray(def.wallAttachPoints) && def.wallAttachPoints.length > 0;
}

function doesAttachPointMatch(def, instance, neighborX, neighborY, currentDirection) {
  const points = Array.isArray(def.wallAttachPoints) ? def.wallAttachPoints : [];
  if (points.length === 0) return false;
  if (!instance || !Number.isFinite(instance.anchorX) || !Number.isFinite(instance.anchorY)) return true;

  const localX = Math.floor(neighborX - instance.anchorX);
  const localY = Math.floor(neighborY - instance.anchorY);
  const pointsOnTile = points.filter((point) => Math.floor(point?.dx || 0) === localX && Math.floor(point?.dy || 0) === localY);
  if (pointsOnTile.length === 0) return false;

  const required = REQUIRED_ATTACH_DIRS[currentDirection] || [];
  if (!required.length) return true;

  for (const point of pointsOnTile) {
    const dir = normalizeDirection(point?.dir);
    if (!dir) return true;
    if (required.includes(dir)) return true;
  }
  return false;
}

function resolveNeighborBuildingId(tileX, tileY, tileIndex) {
  if (tileIndex instanceof Map) return tileIndex.get(tileKey(tileX, tileY)) || null;
  if (tileIndex && typeof tileIndex === 'object') return tileIndex[tileKey(tileX, tileY)] || null;
  return null;
}

function hasWallConnection(tileX, tileY, neighbor, tileIndex, options = {}) {
  const neighborX = tileX + neighbor.dx;
  const neighborY = tileY + neighbor.dy;
  const neighborBuildingId = resolveNeighborBuildingId(neighborX, neighborY, tileIndex);
  if (!neighborBuildingId) return false;

  const neighborInstance = getInstanceById(neighborBuildingId, options);
  const neighborDef = getDefByIdOrInstance(neighborBuildingId, neighborInstance, options);
  if (!isWallConnectorDef(neighborDef)) return false;
  if (neighborDef.id === 'wall') return true;
  return doesAttachPointMatch(neighborDef, neighborInstance, neighborX, neighborY, neighbor.dir);
}

export function buildWallConnectionMask(tileX, tileY, tileIndex, options = {}) {
  let mask = 0;
  for (const neighbor of NEIGHBORS) {
    if (hasWallConnection(tileX, tileY, neighbor, tileIndex, options)) {
      mask |= neighbor.bit;
    }
  }
  return mask;
}

export function resolveWallVariant(tileX, tileY, tileIndex, options = {}) {
  const mask = buildWallConnectionMask(tileX, tileY, tileIndex, options);
  return WALL_VARIANT_MAP[mask] || WALL_VARIANT_MAP[0];
}

