const _SERIES_PROFILE = Object.freeze({
  h1: Object.freeze({
    city: Object.freeze({
      profileScale: 0.93,
      spriteScale: 0.95,
      h3Scale: 0.94,
      anchorDelta: 0.010,
      shadowScale: 0.96,
      palette: Object.freeze({ stone: -0.06, roof: 0.02, plaster: -0.02 }),
      h3PoolCity: Object.freeze([0, 1]),
      h3PoolFort: Object.freeze([0]),
    }),
    fort: Object.freeze({
      profileScale: 0.92,
      spriteScale: 0.94,
      h3Scale: 0.93,
      anchorDelta: 0.010,
      shadowScale: 0.95,
      palette: Object.freeze({ stone: -0.08, roof: 0.01, plaster: -0.03 }),
      h3PoolCity: Object.freeze([0, 1]),
      h3PoolFort: Object.freeze([0]),
    }),
  }),
  h2: Object.freeze({
    city: Object.freeze({
      profileScale: 0.98,
      spriteScale: 0.99,
      h3Scale: 0.98,
      anchorDelta: 0.006,
      shadowScale: 1.00,
      palette: Object.freeze({ stone: -0.02, roof: 0.06, plaster: 0.01 }),
      h3PoolCity: Object.freeze([1, 0]),
      h3PoolFort: Object.freeze([1, 0]),
    }),
    fort: Object.freeze({
      profileScale: 0.97,
      spriteScale: 0.98,
      h3Scale: 0.97,
      anchorDelta: 0.006,
      shadowScale: 0.99,
      palette: Object.freeze({ stone: -0.03, roof: 0.05, plaster: 0.00 }),
      h3PoolCity: Object.freeze([1, 0]),
      h3PoolFort: Object.freeze([1, 0]),
    }),
  }),
  h3: Object.freeze({
    city: Object.freeze({
      profileScale: 1.00,
      spriteScale: 1.00,
      h3Scale: 1.00,
      anchorDelta: 0.000,
      shadowScale: 1.02,
      palette: Object.freeze({ stone: 0.02, roof: 0.04, plaster: 0.03 }),
      h3PoolCity: Object.freeze([6, 0, 1]),
      h3PoolFort: Object.freeze([0, 1]),
    }),
    fort: Object.freeze({
      profileScale: 1.00,
      spriteScale: 1.00,
      h3Scale: 1.00,
      anchorDelta: 0.000,
      shadowScale: 1.02,
      palette: Object.freeze({ stone: 0.02, roof: 0.03, plaster: 0.02 }),
      h3PoolCity: Object.freeze([6, 0, 1]),
      h3PoolFort: Object.freeze([0, 1]),
    }),
  }),
  h5: Object.freeze({
    city: Object.freeze({
      profileScale: 1.05,
      spriteScale: 1.06,
      h3Scale: 1.05,
      anchorDelta: -0.008,
      shadowScale: 1.08,
      palette: Object.freeze({ stone: 0.07, roof: -0.01, plaster: 0.07 }),
      h3PoolCity: Object.freeze([6, 1]),
      h3PoolFort: Object.freeze([2, 1, 0]),
    }),
    fort: Object.freeze({
      profileScale: 1.04,
      spriteScale: 1.04,
      h3Scale: 1.04,
      anchorDelta: -0.008,
      shadowScale: 1.06,
      palette: Object.freeze({ stone: 0.06, roof: -0.02, plaster: 0.06 }),
      h3PoolCity: Object.freeze([6, 1]),
      h3PoolFort: Object.freeze([2, 1, 0]),
    }),
  }),
});

const _FACTION_SERIES_ORDER = Object.freeze({
  ottoman: Object.freeze(['h3', 'h5', 'h3', 'h2']),
  hre: Object.freeze(['h2', 'h3', 'h1']),
  polish: Object.freeze(['h2', 'h3', 'h5']),
  spanish: Object.freeze(['h3', 'h5', 'h2']),
  venice: Object.freeze(['h3', 'h1', 'h2']),
  bandit: Object.freeze(['h1', 'h2']),
});

const _CITY_FAMILIES_BY_FACTION = Object.freeze({
  ottoman: Object.freeze(['imperial-ottoman', 'rumelian-frontier', 'anatolian-market', 'danubian-garrison']),
  hre: Object.freeze(['rhine-gothic', 'alpine-burg', 'bohemian-stone', 'hanseatic-brick']),
  polish: Object.freeze(['masovian-brick', 'lithuanian-woodstone', 'galician-citadel', 'silesian-walled']),
  spanish: Object.freeze(['castilian-alcazar', 'andalusian-courtyard', 'aragonese-fort', 'navarre-mountain']),
  venice: Object.freeze(['lagoon-canal', 'terraferma-commune', 'adriatic-port', 'levant-mercantile']),
  bandit: Object.freeze(['stockade', 'hillhold']),
});

const _CITY_STRUCTURE_BY_FAMILY = Object.freeze({
  'imperial-ottoman': Object.freeze({ wallWScale: 1.02, wallHScale: 0.98, wallYShift: -0.005, houseDensity: 0.95, towerBias: 0.20, roofSteepness: 0.92 }),
  'rumelian-frontier': Object.freeze({ wallWScale: 0.95, wallHScale: 1.03, wallYShift: 0.006, houseDensity: 1.08, towerBias: 0.12, roofSteepness: 1.03 }),
  'anatolian-market': Object.freeze({ wallWScale: 1.07, wallHScale: 0.92, wallYShift: 0.000, houseDensity: 1.18, towerBias: 0.05, roofSteepness: 0.86 }),
  'danubian-garrison': Object.freeze({ wallWScale: 0.92, wallHScale: 1.08, wallYShift: -0.008, houseDensity: 0.88, towerBias: 0.28, roofSteepness: 1.05 }),
  'rhine-gothic': Object.freeze({ wallWScale: 0.94, wallHScale: 1.08, wallYShift: -0.008, houseDensity: 0.90, towerBias: 0.26, roofSteepness: 1.10 }),
  'alpine-burg': Object.freeze({ wallWScale: 0.90, wallHScale: 1.12, wallYShift: -0.010, houseDensity: 0.82, towerBias: 0.31, roofSteepness: 1.16 }),
  'bohemian-stone': Object.freeze({ wallWScale: 1.00, wallHScale: 1.00, wallYShift: 0.000, houseDensity: 0.98, towerBias: 0.18, roofSteepness: 1.00 }),
  'hanseatic-brick': Object.freeze({ wallWScale: 1.06, wallHScale: 0.94, wallYShift: 0.006, houseDensity: 1.12, towerBias: 0.10, roofSteepness: 0.95 }),
  'masovian-brick': Object.freeze({ wallWScale: 1.02, wallHScale: 0.97, wallYShift: 0.004, houseDensity: 1.02, towerBias: 0.12, roofSteepness: 0.96 }),
  'lithuanian-woodstone': Object.freeze({ wallWScale: 0.95, wallHScale: 1.02, wallYShift: -0.002, houseDensity: 1.10, towerBias: 0.14, roofSteepness: 1.03 }),
  'galician-citadel': Object.freeze({ wallWScale: 0.91, wallHScale: 1.10, wallYShift: -0.010, houseDensity: 0.86, towerBias: 0.30, roofSteepness: 1.14 }),
  'silesian-walled': Object.freeze({ wallWScale: 0.98, wallHScale: 1.03, wallYShift: -0.004, houseDensity: 0.94, towerBias: 0.22, roofSteepness: 1.04 }),
  'castilian-alcazar': Object.freeze({ wallWScale: 0.93, wallHScale: 1.06, wallYShift: -0.008, houseDensity: 0.88, towerBias: 0.29, roofSteepness: 1.06 }),
  'andalusian-courtyard': Object.freeze({ wallWScale: 1.08, wallHScale: 0.90, wallYShift: 0.010, houseDensity: 1.16, towerBias: 0.05, roofSteepness: 0.86 }),
  'aragonese-fort': Object.freeze({ wallWScale: 0.96, wallHScale: 1.04, wallYShift: -0.006, houseDensity: 0.92, towerBias: 0.24, roofSteepness: 1.06 }),
  'navarre-mountain': Object.freeze({ wallWScale: 0.90, wallHScale: 1.12, wallYShift: -0.012, houseDensity: 0.82, towerBias: 0.33, roofSteepness: 1.20 }),
  'lagoon-canal': Object.freeze({ wallWScale: 1.10, wallHScale: 0.88, wallYShift: 0.010, houseDensity: 1.16, towerBias: 0.03, roofSteepness: 0.82 }),
  'terraferma-commune': Object.freeze({ wallWScale: 1.04, wallHScale: 0.95, wallYShift: 0.004, houseDensity: 1.08, towerBias: 0.11, roofSteepness: 0.93 }),
  'adriatic-port': Object.freeze({ wallWScale: 1.06, wallHScale: 0.93, wallYShift: 0.008, houseDensity: 1.14, towerBias: 0.08, roofSteepness: 0.88 }),
  'levant-mercantile': Object.freeze({ wallWScale: 1.02, wallHScale: 0.97, wallYShift: 0.002, houseDensity: 1.12, towerBias: 0.09, roofSteepness: 0.92 }),
  stockade: Object.freeze({ wallWScale: 0.86, wallHScale: 1.06, wallYShift: 0.010, houseDensity: 0.90, towerBias: 0.04, roofSteepness: 1.08 }),
  hillhold: Object.freeze({ wallWScale: 0.88, wallHScale: 1.09, wallYShift: -0.008, houseDensity: 0.82, towerBias: 0.20, roofSteepness: 1.12 }),
});

const _SERIES_STRUCTURE_BIAS = Object.freeze({
  h1: Object.freeze({ wallWScale: -0.05, wallHScale: -0.01, houseDensity: -0.08, towerBias: -0.03, roofSteepness: 0.08 }),
  h2: Object.freeze({ wallWScale: -0.01, wallHScale: 0.02, houseDensity: -0.01, towerBias: 0.00, roofSteepness: 0.03 }),
  h3: Object.freeze({ wallWScale: 0.02, wallHScale: 0.02, houseDensity: 0.03, towerBias: 0.02, roofSteepness: 0.00 }),
  h5: Object.freeze({ wallWScale: 0.06, wallHScale: 0.04, houseDensity: 0.02, towerBias: 0.05, roofSteepness: -0.04 }),
});

function _hash32(text) {
  const s = String(text || '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 255;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function _clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Number(v) || 0));
}

function _seriesBucketType(type) {
  return type === 'fort' ? 'fort' : 'city';
}

function _pickSeries(type, factionId, seed, cityRegion, variant) {
  const order = _FACTION_SERIES_ORDER[factionId] || _FACTION_SERIES_ORDER.bandit;
  const h = _hash32(`${type}:${factionId}:${seed}:${cityRegion}:${variant}`);
  return order[h % order.length] || 'h3';
}

function _pickCityFamily(type, factionId, seed, cityRegion, variant) {
  if (type === 'fort') return null;
  const list = _CITY_FAMILIES_BY_FACTION[factionId] || _CITY_FAMILIES_BY_FACTION.bandit;
  const h = _hash32(`family:${type}:${factionId}:${seed}:${cityRegion}:${variant}`);
  return list[h % list.length] || list[0];
}

function _buildCityStructure(series, cityFamily, cityRegion, variant) {
  const fam = _CITY_STRUCTURE_BY_FAMILY[cityFamily] || _CITY_STRUCTURE_BY_FAMILY.stockade;
  const bias = _SERIES_STRUCTURE_BIAS[series] || _SERIES_STRUCTURE_BIAS.h3;
  const regionShift = ((Number(cityRegion) || 0) % 6 - 2.5) * 0.005;
  const variantShift = ((Number(variant) || 0) % 7 - 3.0) * 0.004;
  return Object.freeze({
    wallWScale: _clamp(fam.wallWScale + bias.wallWScale + regionShift * 0.40, 0.80, 1.24),
    wallHScale: _clamp(fam.wallHScale + bias.wallHScale - regionShift * 0.28, 0.78, 1.26),
    wallYShift: _clamp(fam.wallYShift + variantShift * 0.35, -0.08, 0.08),
    houseDensity: _clamp(fam.houseDensity + bias.houseDensity + variantShift * 0.45, 0.60, 1.40),
    towerBias: _clamp(fam.towerBias + bias.towerBias - variantShift * 0.30, 0.00, 0.60),
    roofSteepness: _clamp(fam.roofSteepness + bias.roofSteepness, 0.70, 1.30),
  });
}

function _mergePalette(a, b) {
  return Object.freeze({
    stone: (a?.stone || 0) + (b?.stone || 0),
    roof: (a?.roof || 0) + (b?.roof || 0),
    plaster: (a?.plaster || 0) + (b?.plaster || 0),
  });
}

export function isHommInspiredSettlementType(type) {
  const t = String(type || '').toLowerCase();
  return t === 'city' || t === 'town' || t === 'fort';
}

export function buildSettlementStyleSpec({
  settlement = null,
  type = 'village',
  factionId = 'bandit',
  seed = 0,
  cityRegion = 0,
  variant = 0,
} = {}) {
  const t = String(type || 'village').toLowerCase();
  if (!isHommInspiredSettlementType(t)) {
    return Object.freeze({
      type: t,
      series: 'native',
      signature: `native:${t}`,
      profileScale: 1,
      spriteScale: 1,
      h3Scale: 1,
      anchorDelta: 0,
      shadowScale: 1,
      palette: Object.freeze({ stone: 0, roof: 0, plaster: 0 }),
      h3Pool: null,
      useAdaptedH3: false,
      h3Exact: false,
      h3Morph: 0,
      cityFamily: null,
      cityStructure: null,
      fortVariantOffset: 0,
      modifiers: Object.freeze([]),
    });
  }

  const fid = String(factionId || 'bandit').toLowerCase();
  const series = _pickSeries(t, fid, seed, cityRegion, variant);
  const family = _SERIES_PROFILE[series] || _SERIES_PROFILE.h3;
  const base = family[_seriesBucketType(t)] || family.city;

  const regionShift = ((Number(cityRegion) || 0) % 6 - 2.5) * 0.004;
  const variantShift = ((Number(variant) || 0) % 7 - 3.0) * 0.003;
  const settlementShift = ((_hash32(`${settlement?.name || ''}:${fid}`) % 13) - 6) * 0.0018;

  const profileScale = _clamp(base.profileScale + regionShift * 0.50 + settlementShift, 0.86, 1.16);
  const spriteScale = _clamp(base.spriteScale + variantShift * 0.55, 0.86, 1.18);
  const h3Scale = _clamp(base.h3Scale + settlementShift * 0.80, 0.86, 1.20);
  const anchorDelta = _clamp(base.anchorDelta + regionShift * 0.45, -0.08, 0.08);
  const shadowScale = _clamp(base.shadowScale + variantShift * 0.45, 0.82, 1.24);
  const h3Pool = t === 'fort' ? base.h3PoolFort : base.h3PoolCity;
  const cityFamily = _pickCityFamily(t, fid, seed, cityRegion, variant);
  const cityStructure = cityFamily ? _buildCityStructure(series, cityFamily, cityRegion, variant) : null;
  const fortVariantOffset = _hash32(`fort-layout:${fid}:${series}:${cityRegion}`) % 7;
  // Default city/town to HoMM3 base with 40% style adaptation.
  // Fort remains procedural by default unless modifiers override.
  const useAdaptedH3 = t === 'fort' ? false : true;
  const h3Exact = false;
  const h3Morph = t === 'city' || t === 'town' ? 0.40 : 0;

  return Object.freeze({
    type: t,
    series,
    signature: `${series}:${t}:${cityFamily || 'none'}:r${cityRegion | 0}:v${variant | 0}:fo${fortVariantOffset}`,
    profileScale,
    spriteScale,
    h3Scale,
    anchorDelta,
    shadowScale,
    palette: _mergePalette(base.palette, null),
    h3Pool: Array.isArray(h3Pool) ? Object.freeze([...h3Pool]) : null,
    useAdaptedH3,
    h3Exact,
    h3Morph,
    cityFamily,
    cityStructure,
    fortVariantOffset,
    modifiers: Object.freeze([]),
  });
}

export function applySettlementModifierStack(spec, modifiers = []) {
  const base = spec || buildSettlementStyleSpec();
  if (!Array.isArray(modifiers) || modifiers.length === 0) return base;

  let profileScale = base.profileScale;
  let spriteScale = base.spriteScale;
  let h3Scale = base.h3Scale;
  let anchorDelta = base.anchorDelta;
  let shadowScale = base.shadowScale;
  let palette = _mergePalette(base.palette, null);
  let useAdaptedH3 = base.useAdaptedH3 === true;
  let h3Exact = base.h3Exact === true;
  let h3Morph = _clamp(base.h3Morph, 0, 1);

  for (const raw of modifiers) {
    if (!raw || typeof raw !== 'object') continue;
    const kind = String(raw.kind || '').toLowerCase();
    const strength = _clamp(raw.strength, 0, 2) || 1;
    if (kind === 'fortified') {
      profileScale += 0.015 * strength;
      shadowScale += 0.018 * strength;
      palette = _mergePalette(palette, { stone: 0.02 * strength, roof: -0.01 * strength, plaster: 0.00 });
    } else if (kind === 'trade-hub') {
      palette = _mergePalette(palette, { stone: 0.00, roof: 0.02 * strength, plaster: 0.03 * strength });
      spriteScale += 0.010 * strength;
    } else if (kind === 'war-torn') {
      palette = _mergePalette(palette, { stone: -0.03 * strength, roof: -0.02 * strength, plaster: -0.03 * strength });
      h3Scale -= 0.008 * strength;
      anchorDelta += 0.006 * strength;
    } else if (kind === 'h3-blend') {
      useAdaptedH3 = true;
      h3Exact = false;
      h3Morph = Math.max(h3Morph, 0.35);
    } else if (kind === 'procedural') {
      useAdaptedH3 = false;
      h3Exact = false;
      h3Morph = 0;
    } else if (kind === 'h3-exact') {
      useAdaptedH3 = true;
      h3Exact = true;
      h3Morph = 0;
    } else if (kind === 'h3-morph') {
      const rawMorph = Number.isFinite(raw.percent)
        ? raw.percent
        : (Number.isFinite(raw.value) ? raw.value : strength);
      const normalized = rawMorph > 1 ? rawMorph / 100 : rawMorph;
      h3Morph = _clamp(normalized, 0, 1);
    }
  }

  return Object.freeze({
    ...base,
    profileScale: _clamp(profileScale, 0.80, 1.24),
    spriteScale: _clamp(spriteScale, 0.80, 1.24),
    h3Scale: _clamp(h3Scale, 0.80, 1.24),
    anchorDelta: _clamp(anchorDelta, -0.10, 0.10),
    shadowScale: _clamp(shadowScale, 0.72, 1.30),
    palette: _mergePalette(palette, null),
    useAdaptedH3,
    h3Exact,
    h3Morph: _clamp(h3Morph, 0, 1),
    modifiers: Object.freeze(modifiers.map((m) => ({ ...m }))),
  });
}

export function settlementStyleCacheKey(spec) {
  if (!spec || typeof spec !== 'object') return 'legacy';
  return String(spec.signature || `legacy:${spec.type || ''}`);
}
