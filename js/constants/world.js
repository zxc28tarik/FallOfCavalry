// FallOfCavalry - World constants

export const MIN_ZOOM = 0.5;
export const MAX_CACHE_BYTES = 96 * 1024 * 1024;

export const WORLD = Object.freeze({
  MAP_SOURCE: 'asset',
  ALLOW_PROCEDURAL_FALLBACK: false,

  // Harita boyutları
  TILE_SIZE: 32,
  MAP_WIDTH: 1995,
  MAP_HEIGHT: 1504,
  MAP_BBOX: Object.freeze({ south: 25, west: -15, north: 71, east: 55 }),
  MAP_PROJECTION: 'equirectangular',
  MAP_APPROX_WIDTH_KM: 5214.13,
  MAP_APPROX_HEIGHT_KM: 5120.72,
  MAP_KM_PER_TILE_X: 2.6136,
  MAP_KM_PER_TILE_Y: 3.4047,
  MAP_AVERAGE_KM_PER_TILE: 3.0092,
  MAP_KM_PER_WORLD_PIXEL_X: 0.08168,
  MAP_KM_PER_WORLD_PIXEL_Y: 0.1064,
  PROCEDURAL_MAP_WIDTH: 1068,
  PROCEDURAL_MAP_HEIGHT: 714,
  WORLD_MAP_FORCE_SINGLE_GRASS_BIOME: true,
  WORLD_MAP_FOREST_STRIDE: 5,
  WORLD_MAP_FOREST_DENSITY: 0.17,
  VISUAL_FEATURE_STRIDE: 2,
  FOREST_ANCHOR_DENSITY: 0.38,
  FOREST_RENDER_DENSITY_MULT: 0.5,
  MOUNTAIN_ANCHOR_DENSITY: 0.61,
  MIN_ZOOM,
  CAMERA_MIN_ZOOM: MIN_ZOOM,
  CAMERA_MAX_ZOOM: 5.0,

  // Yükseklik eşikleri (0.0 - 1.0)
  SEA_LEVEL: 0.305,
  SHORE_MAX: 0.365,
  PLAIN_MAX: 0.72,
  MOUNTAIN_MIN: 0.79,
  SNOW_ALTITUDE: 0.95,

  // Renk kodları
  COLOR_SEA: '#7a9dbc',
  COLOR_SHORE: '#ae9874',
  COLOR_GRASS: '#5b9853',
  COLOR_FOREST: '#597f3f',
  COLOR_MOUNTAIN: '#7a7066',
  COLOR_SNOW: '#e8e8e8',

  // Dünya oluşturma
  RIVER_COUNT: 6,
  FOREST_DENSITY: 0.12,
  MOUNTAIN_DENSITY: 0.22,
});

export const DIMETRIC = Object.freeze({
  USE_DIMETRIC: true,
  ALLOW_LEGACY_TOPDOWN: false,
  TILE_W: 64,
  TILE_H: 32,
  ELEVATION_PX: 24,
  TERRAIN_CHUNK_SIZE: 16,
  TERRAIN_MAX_CACHE_BYTES: MAX_CACHE_BYTES,
  // Weather/atmosphere/snow particle passes disabled for current map readability pass.
  ENABLE_WEATHER_EFFECTS: false,
  ATMOSPHERE_ENABLED: true,
  POLITICAL_TINT_ENABLED: false,
  WATER_SHIMMER_ENABLED: false,
  WATER_SHIMMER_MAX_TILES: 120,
  NATURE_DECALS_ENABLED: true,
  NATURE_DECAL_MAX: 128,
  AMBIENT_PARTICLES_ENABLED: false,
  AMBIENT_PARTICLE_MAX: 40,
  AMBIENT_WEATHER_PARTICLES_ENABLED: false,
  AMBIENT_WEATHER_PARTICLE_MAX: 24,
  DEBUG_WIREFRAME_ENABLED: false,
  DEBUG_WIREFRAME_SIZE: 16,
  DEBUG_WIREFRAME_ALPHA: 0.9,
});

export const TERRAIN = Object.freeze({
  TYPE: {
    WATER: 'water',
    SHORE: 'shore',
    GRASS: 'grass',
    FOREST: 'forest',
    MOUNTAIN: 'mountain',
    SNOW: 'snow',
  },

  // Hareket maliyetleri (1.0 = normal)
  COST: {
    WATER: 999,      // Geçilemez
    SHORE: 1.5,
    GRASS: 1.0,
    FOREST: 2.0,
    MOUNTAIN: 3.0,
    SNOW: 2.5,
  },

  // Görüş mesafesi (tile cinsinden)
  VISION: {
    WATER: 10,
    SHORE: 8,
    GRASS: 6,
    FOREST: 4,
    MOUNTAIN: 10,
    SNOW: 5,
  },
});

export const BIOME = Object.freeze({
  SEA: 0,
  SHORE: 1,
  PLAINS: 2,
  FOREST: 3,
  HILLS: 4,
  MOUNTAIN: 5,
  SNOW: 6,
});

export const BIOME_COLORS = Object.freeze({
  [BIOME.SEA]: '#7a9dbc',
  [BIOME.SHORE]: '#ae9874',
  [BIOME.PLAINS]: '#5b9853',
  [BIOME.FOREST]: '#597f3f',
  [BIOME.HILLS]: '#8a7a64',
  [BIOME.MOUNTAIN]: '#7a7066',
  [BIOME.SNOW]: '#e6edf5',
});

export const BIOME_BAND_PARAMS = Object.freeze({
  SNOW_HEIGHT: 0.88,
  MOUNTAIN_HEIGHT: 0.78,
  HILL_HEIGHT: 0.70,
  COLD_BAND_EDGE: 0.1,
  COLD_BAND_BLEND: 0.18,
  FOREST_BASE_CHANCE: 0.34,
  FOREST_MOISTURE_WEIGHT: 0.3,
  SMOOTH_RADIUS: 1,
  POI_MIN: 5,
  POI_MAX: 12,
  POI_MIN_SETTLEMENT_DIST: 4,
});

export const SETTLEMENT = Object.freeze({
  TYPE: {
    CITY: 'city',
    TOWN: 'town',
    VILLAGE: 'village',
    FORT: 'fort',
  },

  // Nüfus eşikleri
  CITY_MIN_POP: 5000,
  TOWN_MIN_POP: 1000,
  VILLAGE_MIN_POP: 100,

  // Ekonomi
  BASE_TAX_RATE: 0.15,
  CITY_INCOME: 500,
  TOWN_INCOME: 200,
  VILLAGE_INCOME: 50,

  // Garnizon
  CITY_GARRISON: 100,
  TOWN_GARRISON: 50,
  VILLAGE_GARRISON: 20,
});

export const SETTLEMENT_TIER = Object.freeze({
  village: 1,
  town: 2,
  city: 3,
  fort: 2,
});

export const RECRUIT_POOL_BY_TIER = Object.freeze({
  1: Object.freeze([
    { id: 'levy_spear', label: 'Levy Spear', class: 'infantry', cost: 9, hp: 90, maxHp: 90, atk: 11, def: 5, wage: 1, speed: 70 },
    { id: 'levy_archer', label: 'Levy Archer', class: 'archer', cost: 11, hp: 76, maxHp: 76, atk: 10, def: 4, wage: 1, speed: 72, isRanged: true, rangedRange: 210, rangedDamage: 10, rangedCooldown: 1.2 },
  ]),
  2: Object.freeze([
    { id: 'militia_sword', label: 'Militia Sword', class: 'infantry', cost: 13, hp: 98, maxHp: 98, atk: 13, def: 7, wage: 2, speed: 72 },
    { id: 'town_heavy_guard', label: 'Heavy Infantry', class: 'heavy_inf', cost: 24, hp: 136, maxHp: 136, atk: 16, def: 13, wage: 4, speed: 60 },
    { id: 'light_cav', label: 'Light Cavalry', class: 'cavalry', cost: 19, hp: 96, maxHp: 96, atk: 14, def: 6, wage: 3, speed: 88, isRanged: false },
    { id: 'crossbow', label: 'Crossbow', class: 'archer', cost: 15, hp: 82, maxHp: 82, atk: 12, def: 5, wage: 2, speed: 68, isRanged: true, rangedRange: 220, rangedDamage: 12, rangedCooldown: 1.25 },
  ]),
  3: Object.freeze([
    { id: 'men_at_arms', label: 'Men-at-Arms', class: 'infantry', cost: 18, hp: 112, maxHp: 112, atk: 15, def: 9, wage: 3, speed: 70 },
    { id: 'elite_cav_knight', label: 'Elite Cavalry', class: 'elite_cav', cost: 36, hp: 148, maxHp: 148, atk: 22, def: 14, wage: 7, speed: 98, isRanged: false },
    { id: 'siege_breaker', label: 'Siege Breaker', class: 'siege', cost: 34, hp: 156, maxHp: 156, atk: 28, def: 8, wage: 6, speed: 48, isRanged: false },
    { id: 'veteran_archer', label: 'Veteran Archer', class: 'archer', cost: 20, hp: 88, maxHp: 88, atk: 14, def: 6, wage: 3, speed: 70, isRanged: true, rangedRange: 230, rangedDamage: 14, rangedCooldown: 1.15 },
  ]),
});

export const WEATHER = Object.freeze({
  ENABLED: true,
  DAY_LENGTH_DAYS: 1,
  RAIN_CHANCE: 0.25,
  SNOW_CHANCE: 0.15,
  FOG_CHANCE: 0.2,
  RAIN_PARTICLES: 120,
  SNOW_PARTICLES: 80,
  FOG_ALPHA: 0.18,
  NIGHT_TINT_ALPHA: 0.35,
});

export const REGION_MODIFIERS = Object.freeze({
  FAMINE: Object.freeze({
    id: 'famine',
    tradeFoodPriceMult: 1.4,
    durationDays: 10,
  }),
  PROSPERITY: Object.freeze({
    id: 'prosperity',
    tradeAllPriceMult: 0.9,
    durationDays: 12,
  }),
  HIGH_BANDITRY: Object.freeze({
    id: 'high_banditry',
    banditSpawnMult: 1.5,
    durationDays: 8,
  }),
  PILGRIMAGE: Object.freeze({
    id: 'pilgrimage',
    renownGainMult: 1.2,
    durationDays: 7,
  }),
});

export const ENCOUNTER = Object.freeze({
  TYPE: {
    BANDIT: 'bandit',
    MERCHANT: 'merchant',
    NOBLE: 'noble',
    REFUGEE: 'refugee',
    SCOUT: 'scout',
  },

  // Haydut özellikleri
  BANDIT_STRENGTH_MIN: 20,
  BANDIT_STRENGTH_MAX: 80,
  BANDIT_GOLD_MIN: 50,
  BANDIT_GOLD_MAX: 200,

  // Tüccar özellikleri
  MERCHANT_GOLD_MIN: 100,
  MERCHANT_GOLD_MAX: 500,
  MERCHANT_ARMY_MAX: 30,
});

export const ENCOUNTER_RISK = Object.freeze({
  BASE: 1.0,
  ROAD_MULT: 0.70,
  OFFROAD_MULT: 1.15,
  BIOME_MULT: Object.freeze({ PLAINS: 1.0, FOREST: 1.15, HILLS: 1.10, MOUNTAIN: 1.25, SNOW: 1.20, SHORE: 1.05 }),
  STARVING_MULT: 1.35,
  LOW_SUPPLIES_MULT: 1.15,
  LOW_SUPPLIES_THRESHOLD: 2,
  CAMP_ACTIVE_MULT: 0.55,
  CAMP_RAID_BONUS: 0.30,
  MARKET_SCARCITY_MULT: 1.10,
  SCARCITY_STOCK_THRESHOLD: 4,
  MIN_MULT: 0.4,
  MAX_MULT: 2.5,
});

export const ENCOUNTER_RISK_UI = Object.freeze({
  LOW_MAX: 0.85,
  HIGH_MIN: 1.20,
});

export const WORLD_AI = Object.freeze({
  ENABLED: true,
  MAX_BANDIT_PARTIES: 4,
  MAX_PATROL_PARTIES: 3,
  MAX_CARAVAN_PARTIES: 3,
  BANDIT_SPEED: 1.0,
  PATROL_SPEED: 1.1,
  CARAVAN_SPEED: 0.8,
  BANDIT_AGGRO_RADIUS: 4,
  PATROL_AGGRO_RADIUS: 4,
  DESPAWN_DISTANCE: 40,
  RESPAWN_INTERVAL_DAYS: 3,
});

export const POI = Object.freeze({
  MIN_COUNT: 6,
  MAX_COUNT: 14,
  MIN_DISTANCE_TO_SETTLEMENT_TILES: 5,
  INTERACT_RADIUS_TILES: 1.4,
  COOLDOWN_DAYS: 2,
  AMBUSH_CHANCE_RUIN: 0.35,
  AMBUSH_CHANCE_CAMP: 0.20,
  OUTCOME: Object.freeze({
    LOOT: 'loot',
    AMBUSH: 'ambush',
    CLUE: 'clue',
    NOTHING: 'nothing',
  }),
  CLUE_CHANCE_RUIN: 0.18,
  CLUE_CHANCE_CAMP: 0.10,
  NOTHING_CHANCE_RUIN: 0.12,
  NOTHING_CHANCE_CAMP: 0.18,
  AMBUSH_RISK_MULT_ON_ROAD: 0.85,
  AMBUSH_RISK_MULT_OFFROAD: 1.15,
  AMBUSH_SETTLEMENT_TIER_MULT: Object.freeze({ 1: 0.96, 2: 1.0, 3: 1.08 }),
  RARE_LOOT_ROAD_MULT_ON_ROAD: 0.96,
  RARE_LOOT_ROAD_MULT_OFFROAD: 1.06,
  RARE_LOOT_SETTLEMENT_TIER_MULT: Object.freeze({ 1: 1.05, 2: 1.0, 3: 0.94 }),
  BIOME_RISK_MODS: Object.freeze({ PLAINS: 1.0, FOREST: 1.1, HILLS: 1.05, MOUNTAIN: 1.2, SNOW: 1.15, SHORE: 1.05 }),
  LOOT_GOLD_RANGE: Object.freeze([6, 18]),
  LOOT_FOOD_RANGE: Object.freeze([1, 4]),
  CLUE_REWARD_GOLD_RANGE: Object.freeze([3, 9]),
  CLUE_REWARD_FOOD_RANGE: Object.freeze([0, 2]),
  OPPORTUNITY_CHANCE_FROM_CLUE: 0.55,
  OPPORTUNITY_BONUS_PCT_RANGE: Object.freeze([15, 35]),
  OPPORTUNITY_DURATION_DAYS: 3,
  RARE_BONUS_CHANCE: 0.08,
  RARE_BONUS_GOLD_RANGE: Object.freeze([25, 60]),
  RARE_BONUS_ITEM_QTY_RANGE: Object.freeze([2, 5]),
  AMBUSH_LOSS_FOOD_RANGE: Object.freeze([1, 4]),
  AMBUSH_LOSS_GOLD_RANGE: Object.freeze([5, 20]),
  AMBUSH_MORALE_PENALTY_RANGE: Object.freeze([2, 6]),
  AMBUSH_LOSS_MODE_WEIGHTS: Object.freeze({ food: 0.45, gold: 0.30, morale: 0.25 }),
  AMBUSH_TEMPORARY: true,
});

export const POI_TYPES = Object.freeze({
  RUIN: 'ruin',
  CAMP: 'camp',
  FORT: 'fort',
  SHRINE: 'shrine',
  BATTLEFIELD: 'battlefield',
  CARAVAN_SITE: 'caravan_site',
});
