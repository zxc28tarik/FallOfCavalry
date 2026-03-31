import * as CONST from '../../constants.js';

export const TRANSITION_BITS = Object.freeze({
  N: 1 << 0,
  E: 1 << 1,
  S: 1 << 2,
  W: 1 << 3,
  NE: 1 << 4,
  SE: 1 << 5,
  SW: 1 << 6,
  NW: 1 << 7,
});

export const TRANSITION_DIRECTIONS = Object.freeze([
  Object.freeze({ key: 'N', bit: TRANSITION_BITS.N, dx: 0, dy: -1, cardinal: true }),
  Object.freeze({ key: 'E', bit: TRANSITION_BITS.E, dx: 1, dy: 0, cardinal: true }),
  Object.freeze({ key: 'S', bit: TRANSITION_BITS.S, dx: 0, dy: 1, cardinal: true }),
  Object.freeze({ key: 'W', bit: TRANSITION_BITS.W, dx: -1, dy: 0, cardinal: true }),
  Object.freeze({ key: 'NE', bit: TRANSITION_BITS.NE, dx: 1, dy: -1, cardinal: false }),
  Object.freeze({ key: 'SE', bit: TRANSITION_BITS.SE, dx: 1, dy: 1, cardinal: false }),
  Object.freeze({ key: 'SW', bit: TRANSITION_BITS.SW, dx: -1, dy: 1, cardinal: false }),
  Object.freeze({ key: 'NW', bit: TRANSITION_BITS.NW, dx: -1, dy: -1, cardinal: false }),
]);

const DIAGONAL_CARDINAL_SUPPORT = Object.freeze({
  NE: Object.freeze([TRANSITION_BITS.N, TRANSITION_BITS.E]),
  SE: Object.freeze([TRANSITION_BITS.S, TRANSITION_BITS.E]),
  SW: Object.freeze([TRANSITION_BITS.S, TRANSITION_BITS.W]),
  NW: Object.freeze([TRANSITION_BITS.N, TRANSITION_BITS.W]),
});

const BIOME_TRANSITION_PRIORITY = Object.freeze({
  [CONST.BIOME?.SEA ?? 0]: 100,
  [CONST.BIOME?.SHORE ?? 1]: 90,
  [CONST.BIOME?.SNOW ?? 6]: 80,
  [CONST.BIOME?.MOUNTAIN ?? 5]: 70,
  [CONST.BIOME?.HILLS ?? 4]: 60,
  [CONST.BIOME?.FOREST ?? 3]: 50,
  [CONST.BIOME?.PLAINS ?? 2]: 40,
});

export function getBiomeTransitionPriority(biome) {
  if (!Number.isFinite(biome)) return 0;
  const value = BIOME_TRANSITION_PRIORITY[biome];
  return Number.isFinite(value) ? value : 0;
}

export function shouldBlendNeighbor(centerBiome, neighborBiome) {
  if (!Number.isFinite(centerBiome) || !Number.isFinite(neighborBiome)) return false;
  if (centerBiome === neighborBiome) return false;
  return getBiomeTransitionPriority(neighborBiome) > getBiomeTransitionPriority(centerBiome);
}

function hasDiagonalCardinalSupport(directionKey, cardinalMask) {
  const supportBits = DIAGONAL_CARDINAL_SUPPORT[directionKey];
  if (!Array.isArray(supportBits) || supportBits.length === 0) return false;
  for (const bit of supportBits) {
    if ((cardinalMask & bit) === bit) return true;
  }
  return false;
}

export function computeTransitionMask({
  tx,
  ty,
  mapWidth,
  mapHeight,
  resolveBiomeAt,
  centerBiome,
} = {}) {
  if (typeof resolveBiomeAt !== 'function') return 0;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return 0;
  if (!Number.isFinite(mapWidth) || !Number.isFinite(mapHeight)) return 0;
  if (mapWidth <= 0 || mapHeight <= 0) return 0;

  let cardinalMask = 0;
  const diagonalCandidates = [];
  for (const dir of TRANSITION_DIRECTIONS) {
    const nx = tx + dir.dx;
    const ny = ty + dir.dy;
    if (nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) continue;
    const neighborBiome = resolveBiomeAt(nx, ny);
    if (!shouldBlendNeighbor(centerBiome, neighborBiome)) continue;
    if (dir.cardinal) {
      cardinalMask |= dir.bit;
    } else {
      diagonalCandidates.push(dir);
    }
  }

  let mask = cardinalMask;
  for (const dir of diagonalCandidates) {
    if (!hasDiagonalCardinalSupport(dir.key, cardinalMask)) continue;
    mask |= dir.bit;
  }
  return mask;
}
