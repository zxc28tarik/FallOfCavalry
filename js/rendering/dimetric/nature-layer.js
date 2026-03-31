function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashNoise(tx, ty, seed = 0) {
  const x = finite(tx, 0);
  const y = finite(ty, 0);
  const s = finite(seed, 0);
  const n = Math.sin((x * 12.9898) + (y * 78.233) + (s * 37.719)) * 43758.5453;
  return n - Math.floor(n);
}

function normalizeLod(lodLevel) {
  const lod = String(lodLevel || 'full').toLowerCase();
  if (lod === 'minimal') return 'minimal';
  if (lod === 'reduced') return 'reduced';
  return 'full';
}

const DEFAULT_BIOME_IDS = Object.freeze({
  SEA: 0,
  SHORE: 1,
  PLAINS: 2,
  FOREST: 3,
  HILLS: 4,
  MOUNTAIN: 5,
  SNOW: 6,
});

function resolveBiomeIds(biomeIds) {
  return {
    SEA: finite(biomeIds?.SEA, DEFAULT_BIOME_IDS.SEA),
    SHORE: finite(biomeIds?.SHORE, DEFAULT_BIOME_IDS.SHORE),
    PLAINS: finite(biomeIds?.PLAINS, DEFAULT_BIOME_IDS.PLAINS),
    FOREST: finite(biomeIds?.FOREST, DEFAULT_BIOME_IDS.FOREST),
    HILLS: finite(biomeIds?.HILLS, DEFAULT_BIOME_IDS.HILLS),
    MOUNTAIN: finite(biomeIds?.MOUNTAIN, DEFAULT_BIOME_IDS.MOUNTAIN),
    SNOW: finite(biomeIds?.SNOW, DEFAULT_BIOME_IDS.SNOW),
  };
}

export function resolveDimetricNatureVariant({
  kind = 'forest',
  tx = 0,
  ty = 0,
  fogLevel = 2,
} = {}) {
  const safeKind = String(kind || 'forest').toLowerCase();
  const x = finite(tx, 0);
  const y = finite(ty, 0);
  const fog = Math.max(0, Math.floor(finite(fogLevel, 2)));
  const fogBias = fog <= 1 ? 0.06 : 0;

  if (safeKind === 'forest') {
    const nA = hashNoise((x * 0.83) + 11.3, (y * 1.21) + 17.9, 411);
    const nB = hashNoise((x * 1.19) + 5.7, (y * 0.73) + 9.1, 733);
    const nC = hashNoise((x * 0.59) + 3.7, (y * 1.53) + 2.1, 991);
    const nD = hashNoise((x * 0.43) + 8.8, (y * 0.67) + 6.2, 1231);
    return {
      kind: 'forest',
      family: nA > 0.12 ? 'conifer' : 'broadleaf',
      scale: clamp(0.86 + (nB * 0.38), 0.78, 1.32),
      crownBias: clamp((nB - 0.5) * 0.44, -0.20, 0.20),
      lean: clamp((nC - 0.5) * 0.28, -0.14, 0.14),
      tint: clamp(((nD - 0.5) * 0.26) - fogBias, -0.18, 0.18),
    };
  }

  const isLarge = safeKind === 'mountain_large';
  const nA = hashNoise((x * 1.07) + 4.4, (y * 0.73) + 1.2, 1771);
  const nB = hashNoise((x * 0.61) + 9.9, (y * 1.09) + 12.4, 2017);
  const nC = hashNoise((x * 1.43) + 6.7, (y * 0.53) + 5.5, 2203);
  const nD = hashNoise((x * 0.33) + 14.2, (y * 1.31) + 2.7, 2467);

  return {
    kind: isLarge ? 'mountain_large' : 'mountain',
    ridge: nA > 0.70 ? 'sharp' : nA > 0.38 ? 'split' : 'round',
    scale: clamp((isLarge ? 1.20 : 0.95) + (nB * (isLarge ? 0.35 : 0.30)), isLarge ? 1.10 : 0.88, isLarge ? 1.55 : 1.28),
    skew: clamp((nC - 0.5) * 0.30, -0.16, 0.16),
    snow: clamp((isLarge ? 0.24 : 0.15) + (nA * 0.28) - fogBias, 0, 0.56),
    tint: clamp((nD - 0.5) * 0.20, -0.18, 0.18),
  };
}

export function sampleDimetricGroundDecal({
  tx = 0,
  ty = 0,
  biome = DEFAULT_BIOME_IDS.PLAINS,
  fogLevel = 2,
  lodLevel = 'full',
  qualityLevel = 0,
  featureDensityScale = 1,
  biomeIds,
} = {}) {
  const ids = resolveBiomeIds(biomeIds);
  const x = finite(tx, 0);
  const y = finite(ty, 0);
  const fog = Math.max(0, Math.floor(finite(fogLevel, 2)));
  if (fog <= 0) return null;

  const safeBiome = finite(biome, ids.PLAINS);
  if (safeBiome === ids.SEA || safeBiome === ids.MOUNTAIN) return null;

  const lod = normalizeLod(lodLevel);
  const q = Math.max(0, Math.floor(finite(qualityLevel, 0)));
  const density = clamp(finite(featureDensityScale, 1), 0.2, 1.0);

  const baseChance = safeBiome === ids.PLAINS
    ? 0.11
    : safeBiome === ids.FOREST
      ? 0.07
      : safeBiome === ids.HILLS
        ? 0.09
        : safeBiome === ids.SNOW
          ? 0.05
          : safeBiome === ids.SHORE
            ? 0.06
            : 0;
  if (baseChance <= 0) return null;

  const lodScale = lod === 'minimal' ? 0.42 : lod === 'reduced' ? 0.74 : 1.0;
  const qualityScale = q >= 4 ? 0.42 : q >= 2 ? 0.66 : 1.0;
  const chance = baseChance * density * lodScale * qualityScale;

  const spawnNoise = hashNoise((x * 0.77) + 13.1, (y * 1.09) + 4.2, 9049);
  if (spawnNoise > chance) return null;

  const typeNoise = hashNoise((x * 1.31) + 2.4, (y * 0.61) + 8.9, 9137);
  const type = safeBiome === ids.SNOW
    ? (typeNoise > 0.55 ? 'stone_chip' : 'frost_patch')
    : safeBiome === ids.SHORE
      ? (typeNoise > 0.52 ? 'drift' : 'reed')
      : safeBiome === ids.FOREST
        ? (typeNoise > 0.62 ? 'stone_chip' : typeNoise > 0.34 ? 'leaf_litter' : 'moss_patch')
        : safeBiome === ids.HILLS
          ? (typeNoise > 0.42 ? 'stone_chip' : 'dry_tuft')
          : (typeNoise > 0.70 ? 'flower_patch' : typeNoise > 0.40 ? 'dry_tuft' : 'grass_tuft');

  const alphaNoise = hashNoise((x * 0.49) + 3.5, (y * 1.47) + 1.7, 9241);
  const sizeNoise = hashNoise((x * 0.93) + 7.1, (y * 0.57) + 6.3, 9329);
  const offsetNoiseX = hashNoise((x * 1.17) + 5.3, (y * 0.41) + 2.2, 9413);
  const offsetNoiseY = hashNoise((x * 0.37) + 9.8, (y * 1.27) + 3.8, 9521);
  const toneNoise = hashNoise((x * 0.71) + 1.9, (y * 0.87) + 7.4, 9677);

  return {
    kind: 'ground_decal',
    type,
    scale: clamp(0.26 + (sizeNoise * 0.42), 0.22, 0.78),
    alpha: clamp((fog === 1 ? 0.35 : 0.58) + ((alphaNoise - 0.5) * 0.14), 0.22, 0.78),
    offsetX: clamp((offsetNoiseX - 0.5) * 0.34, -0.17, 0.17),
    offsetY: clamp((offsetNoiseY - 0.5) * 0.24, -0.12, 0.12),
    tone: clamp((toneNoise - 0.5) * 0.30, -0.20, 0.20),
  };
}
