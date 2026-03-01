/**
 * FallOfCavalry - Game Constants
 * Tüm sabit değerler ve magic number'lar burada
 * HİÇBİR BAĞIMLILIĞI YOK - İLK YÜKLENECEK DOSYA
 */

export const BUILD_INFO = Object.freeze({
  version: '0.0.0-dev',
  builtAt: null,
});

// =============================================================================
// DÜNYA HARİTASI SABİTLERİ
// =============================================================================

export const WORLD = Object.freeze({
  // Harita boyutları
  TILE_SIZE: 60,
  MAP_WIDTH: 180,
  MAP_HEIGHT: 120,
  
  // Yükseklik eşikleri (0.0 - 1.0)
  SEA_LEVEL: 0.40,
  SHORE_MAX: 0.46,
  PLAIN_MAX: 0.72,
  MOUNTAIN_MIN: 0.72,
  SNOW_ALTITUDE: 0.88,
  
  // Renk kodları
  COLOR_SEA: '#1a4d6f',
  COLOR_SHORE: '#8b7355',
  COLOR_GRASS: '#4a6741',
  COLOR_FOREST: '#2d4a2b',
  COLOR_MOUNTAIN: '#5a524a',
  COLOR_SNOW: '#e8e8e8',
  
  // Dünya oluşturma
  RIVER_COUNT: 12,
  FOREST_DENSITY: 0.22,
  MOUNTAIN_DENSITY: 0.12,
});

// =============================================================================
// OYUN MEKANİĞİ SABİTLERİ
// =============================================================================

export const GAME = Object.freeze({
  // Zaman
  DAY_LENGTH_SEC: 15,
  AUTOSAVE_INTERVAL_SEC: 120,
  
  // Karşılaşma
  ENCOUNTER_COOLDOWN_SEC: 2.2,
  PLAYER_GHOST_DURATION_SEC: 8,
  
  // Savaş
  BATTLE_TIME_SCALE: 0.55,
  
  // Görünüm
  VIEW_WIDTH: 1280,
  VIEW_HEIGHT: 720,
  CAMERA_SPEED: 220,
  
  // Başlangıç değerleri
  STARTING_GOLD: 1000,
  STARTING_ARMY: 50,
  STARTING_RENOWN: 0,

  // 2.x Hareket / encounter tuning
  ROAD_SPEED_MULT: 1.2,
  OFFROAD_SPEED_MULT: 1.0,
  RIVER_CROSSING_PENALTY_MULT: 0.35,
  ENCOUNTER_CHANCE_ROAD: 0.6,
  ENCOUNTER_CHANCE_OFFROAD: 1.2,
  RIVER_BLOCK_NON_CROSSING: true,
});

export const SPRITES = Object.freeze({
  MAP_MARKER_SCALE: 1,
  BATTLE_UNIT_SCALE: 1,
});

export const BATTLE_FX = Object.freeze({
  HIT_FLASH_DURATION: 180,
  DEATH_FADE_DURATION: 600,
  DEATH_SHRINK_FACTOR: 0.6,
  HIT_FLASH_COLOR: 'rgba(255,255,255,0.8)',
});

export const BATTLE_FLANK = Object.freeze({
  FLANK_MULT: 1.15,
  REAR_MULT: 1.30,
  FLANK_MORALE_BONUS: 4,
  REAR_MORALE_BONUS: 8,
});

export const BATTLE_COUNTERS = Object.freeze({
  SPEAR_VS_CAV_DMG_MULT: 1.35,
  SPEAR_VS_CAV_MORALE_BONUS: 6,
  CAV_VS_ARCHER_DMG_MULT: 1.25,
  CAV_VS_ARCHER_MORALE_BONUS: 5,
  INFANTRY_VS_SPEAR_DMG_MULT: 1.05,
  COUNTER_BASE_MORALE_BONUS: 0,
});

export const BATTLE_CHARGE = Object.freeze({
  CHARGE_BUILD_PER_SEC: 28,
  CHARGE_READY_THRESHOLD: 100,
  CHARGE_DMG_MULT: 1.45,
  CHARGE_MORALE_BONUS: 8,
  CHARGE_COOLDOWN_SEC: 5,
  BRACE_CHARGE_REDUCTION_MULT: 0.55,
  BRACE_THORNS_DMG_FRACTION: 0.3,
});

// =============================================================================
// YERLEŞİM TİPLERİ VE ÖZELLİKLERİ
// =============================================================================

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

// =============================================================================
// BİRİM SİSTEMİ
// =============================================================================

export const UNIT = Object.freeze({
  // Birim tipleri
  TYPE: {
    PIKE_INF: 'pike_inf',
    ARCHER: 'archer',
    MUSKETEER: 'musketeer',
    CAV_ARCHER: 'cav_archer',
    CAV_PIKE: 'cav_pike',
    CARBINE_CAV: 'carbine_cav',
    HEAVY_CAV: 'heavy_cav',
  },
  
  // Duruşlar
  STANCE: {
    HOLD: 'hold',
    DEFEND: 'defend',
    ATTACK: 'attack',
    KITE: 'kite',
  },
  
  // Recruit maliyetleri
  COST: {
    PIKE_INF: 50,
    ARCHER: 60,
    MUSKETEER: 80,
    CAV_ARCHER: 100,
    CAV_PIKE: 120,
    CARBINE_CAV: 150,
    HEAVY_CAV: 200,
  },
});

// =============================================================================
// FACTION SİSTEMİ
// =============================================================================

export const FACTION = Object.freeze({
  ID: {
    OTTOMAN: 'ottoman',
    HRE: 'hre',
    POLISH: 'polish',
    SPANISH: 'spanish',
    VENICE: 'venice',
    BANDIT: 'bandit',
  },
  
  // Faction renkleri (FACTION_VISUALS'dan gelecek)
  // Bu sabitleri buraya koyduk ki import döngüsü olmasın
});



export const FACTIONS = Object.freeze([
  { id: FACTION.ID.OTTOMAN, name: 'Osmanlı', color: '#c0392b', doctrine: 'Sipahi Hücumu', desc: 'Hızlı taarruz ve çeviklik.', startingGold: 120, startingArmy: 0, startingRenown: 10, armyHint: 'Sipahi ağırlıklı başlangıç.' },
  { id: FACTION.ID.HRE, name: 'Kutsal Roma', color: '#f1c40f', doctrine: 'İmparatorluk Disiplini', desc: 'Düzenli birlikler ve dayanıklılık.', startingGold: 110, startingArmy: 0, startingRenown: 8, armyHint: 'Dengeli düzenli kuvvet.' },
  { id: FACTION.ID.POLISH, name: 'Lehistan', color: '#ffffff', doctrine: 'Kanat Süvarisi', desc: 'Şok hücum ve moral.', startingGold: 115, startingArmy: 0, startingRenown: 9, armyHint: 'Husaria etkisi (tematik).' },
  { id: FACTION.ID.SPANISH, name: 'İspanya', color: '#e74c3c', doctrine: 'Tercio Duvarı', desc: 'Denge ve sürdürülebilirlik.', startingGold: 110, startingArmy: 0, startingRenown: 8, armyHint: 'Piyade çekirdeği (tematik).' },
  { id: FACTION.ID.VENICE, name: 'Venedik', color: '#16a085', doctrine: 'Ticaret Prensliği', desc: 'Ekonomi ve esneklik.', startingGold: 130, startingArmy: 0, startingRenown: 6, armyHint: 'Paralı asker esnekliği.' },
  { id: FACTION.ID.BANDIT, name: 'Haydutlar', color: '#95a5a6', doctrine: 'Dağınık Baskın', desc: 'Riskli ama hızlı başlangıç.', startingGold: 90, startingArmy: 0, startingRenown: 2, armyHint: 'Düşük şöhret, düşük kaynak.' },
]);

// =============================================================================
// KARŞILAŞMA TİPLERİ
// =============================================================================

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

// =============================================================================
// ARAZİ TİPLERİ VE ÖZELLİKLERİ
// =============================================================================

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
  [BIOME.SEA]: '#1a4d6f',
  [BIOME.SHORE]: '#8b7355',
  [BIOME.PLAINS]: '#6f8f4e',
  [BIOME.FOREST]: '#2f5a33',
  [BIOME.HILLS]: '#7a6a4a',
  [BIOME.MOUNTAIN]: '#5a524a',
  [BIOME.SNOW]: '#e6edf5',
});

export const BIOME_BAND_PARAMS = Object.freeze({
  SNOW_HEIGHT: 0.7,
  MOUNTAIN_HEIGHT: 0.56,
  HILL_HEIGHT: 0.48,
  COLD_BAND_EDGE: 0.1,
  COLD_BAND_BLEND: 0.18,
  FOREST_BASE_CHANCE: 0.34,
  FOREST_MOISTURE_WEIGHT: 0.3,
  SMOOTH_RADIUS: 1,
  POI_MIN: 5,
  POI_MAX: 12,
  POI_MIN_SETTLEMENT_DIST: 4,
});



export const TRADE_ITEMS = Object.freeze([
  { id: 'grain', name: 'Grain', basePrice: 4, weight: 1 },
  { id: 'meat', name: 'Meat', basePrice: 6, weight: 1 },
  { id: 'wood', name: 'Wood', basePrice: 5, weight: 2 },
  { id: 'iron', name: 'Iron', basePrice: 11, weight: 3 },
  { id: 'cloth', name: 'Cloth', basePrice: 7, weight: 1 },
  { id: 'salt', name: 'Salt', basePrice: 8, weight: 1 },
]);

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
    { id: 'light_cav', label: 'Light Cavalry', class: 'cavalry', cost: 19, hp: 96, maxHp: 96, atk: 14, def: 6, wage: 3, speed: 88, isRanged: false },
    { id: 'crossbow', label: 'Crossbow', class: 'archer', cost: 15, hp: 82, maxHp: 82, atk: 12, def: 5, wage: 2, speed: 68, isRanged: true, rangedRange: 220, rangedDamage: 12, rangedCooldown: 1.25 },
  ]),
  3: Object.freeze([
    { id: 'men_at_arms', label: 'Men-at-Arms', class: 'infantry', cost: 18, hp: 112, maxHp: 112, atk: 15, def: 9, wage: 3, speed: 70 },
    { id: 'veteran_archer', label: 'Veteran Archer', class: 'archer', cost: 20, hp: 88, maxHp: 88, atk: 14, def: 6, wage: 3, speed: 70, isRanged: true, rangedRange: 230, rangedDamage: 14, rangedCooldown: 1.15 },
  ]),
});

export const TRADE_PRICE_PARAMS = Object.freeze({
  supplyWeight: 0.08,
  demandWeight: 0.22,
  biomeWeight: 0.1,
  tierWeight: 0.07,
  sellFactor: 0.68,
  maxScarcityBoost: 0.35,
});

export const MARKET = Object.freeze({
  DRIFT_STOCK_STEP_RANGE: Object.freeze([-3, 5]),
  DRIFT_DEMAND_STEP_RANGE: Object.freeze([-0.08, 0.10]),
  DEMAND_MEAN_REVERT: 0.12,
  STOCK_FLOOR: 0,
  STOCK_CEIL_CITY: 80,
  STOCK_CEIL_TOWN: 55,
  STOCK_CEIL_VILLAGE: 35,
  MOMENTUM_DECAY: 0.55,
  MOMENTUM_MAX_ABS: 0.35,
  MOMENTUM_PER_QTY: 0.015,
});

export const MARKET_BIOME_PRODUCTION = Object.freeze({
  PLAINS: Object.freeze({ grain: 3, meat: 2, cloth: 0 }),
  FOREST: Object.freeze({ wood: 3, meat: 2 }),
  HILLS: Object.freeze({ iron: 3, wood: 2 }),
  SHORE: Object.freeze({ salt: 3, cloth: 2 }),
  MOUNTAIN: Object.freeze({ iron: 3, meat: -2 }),
  SNOW: Object.freeze({ meat: -2, grain: -3 }),
});



export const SUPPLIES = Object.freeze({
  DAILY_BASE_CONSUMPTION: 1,
  DAILY_PER_UNIT_CONSUMPTION: 0.15,
  STARVATION_MORALE_PENALTY: 6,
  STARVATION_SPEED_MULT: 0.75,
});

export const CAPACITY = Object.freeze({
  BASE_CAPACITY: 40,
  PER_UNIT_CAPACITY: 2,
  OVERCAP_SPEED_MULT_MIN: 0.55,
});

export const CAMP = Object.freeze({
  RAID_BASE_CHANCE: 0.06,
  WATCH_MULT: Object.freeze({ low: 1.4, med: 1.0, high: 0.7 }),
  CAMP_CONSUMPTION_MULT: 0.5,
  CAMP_HEAL_PER_DAY: 2,
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


export const ACCOUNTING = Object.freeze({
  NEGATIVE_GOLD_MORALE_PENALTY: 4,
  AUTO_OPEN: true,
});


export const PERF = Object.freeze({
  PROJECTILE_POOL: 128,
  FLOATTEXT_POOL: 64,
  HIDDEN_TICK_THROTTLE_MS: 250,
});


export const ARMOR_TYPE = Object.freeze({
  NONE: 'none',
  LIGHT: 'light',
  MEDIUM: 'medium',
  HEAVY: 'heavy',
});

export const ARMOR_MITIGATION = Object.freeze({
  [ARMOR_TYPE.NONE]: 0.0,
  [ARMOR_TYPE.LIGHT]: 0.10,
  [ARMOR_TYPE.MEDIUM]: 0.22,
  [ARMOR_TYPE.HEAVY]: 0.35,
});

export const DAMAGE_TYPE = Object.freeze({
  CUT: 'cut',
  PIERCE: 'pierce',
  BLUNT: 'blunt',
});

export const DAMAGE_VS_ARMOR = Object.freeze({
  [DAMAGE_TYPE.CUT]: Object.freeze({ none: 0.00, light: 0.02, medium: 0.00, heavy: -0.06 }),
  [DAMAGE_TYPE.PIERCE]: Object.freeze({ none: 0.00, light: 0.03, medium: 0.05, heavy: 0.12 }),
  [DAMAGE_TYPE.BLUNT]: Object.freeze({ none: 0.00, light: 0.00, medium: 0.10, heavy: 0.04 }),
});

export const TERRAIN_MODS = Object.freeze({
  PLAINS: Object.freeze({ speed: 1.0, acc: 1.0, charge: 1.0 }),
  FOREST: Object.freeze({ speed: 0.85, acc: 0.95, charge: 0.80 }),
  HILLS: Object.freeze({ speed: 0.92, acc: 1.05, charge: 0.95 }),
  MOUNTAIN: Object.freeze({ speed: 0.80, acc: 1.00, charge: 0.75 }),
  SNOW: Object.freeze({ speed: 0.82, acc: 0.92, charge: 0.80 }),
  SHORE: Object.freeze({ speed: 0.88, acc: 0.95, charge: 0.85 }),
});

export const BATTLE_COMMANDS = Object.freeze({
  HOLD: 'hold',
  FOCUS: 'focus',
  SKIRMISH: 'skirmish',
  RETREAT: 'retreat',
});

export const BATTLE_AI = Object.freeze({
  AI_RETARGET_SEC: 1.25,
  AI_TARGET_LOWHP_WEIGHT: 0.5,
  AI_TARGET_ROUTING_BONUS: 180,
  AI_LOCAL_RADIUS: 190,
  AI_OUTNUMBERED_RATIO: 1.6,
  AI_RETREAT_MORALE: 26,
  AI_RETREAT_HP_PCT: 0.22,
  SKIRMISH_DESIRED_RANGE_MULT: 0.88,
  SKIRMISH_MIN_RANGE_MULT: 0.58,
  SKIRMISH_KITE_SPEED_MULT: 1.2,
  AI_BOUNDS_PAD_PX: 16,
  AI_MAX_APPROACH_TIME_SEC: 5,
  AI_STALL_WINDOW_SEC: 0.5,
  AI_STALL_MIN_PROGRESS_PX: 8,
  AI_STALL_ABORT_SEC: 1.8,
  SKIRMISH_BOUNDS_FAIL_HOLD_SEC: 0.6,
});


export const FORMATION = Object.freeze({
  LINE: 'line',
  COLUMN: 'column',
  WEDGE: 'wedge',
  SCATTER: 'scatter',
});

export const DEPLOY = Object.freeze({
  PREVIEW_UNIT_SPACING: 28,
  PREVIEW_DEPTH: 4,
  ROTATE_STEP_DEG: 15,
  DEFAULT_FORMATION: FORMATION.LINE,
});

export const BATTLE_FORMATION = Object.freeze({
  COHESION_RADIUS: 55,
  COHESION_ALLY_CAP: 3,
  LINE_DEF_BONUS: 0.15,
  COLUMN_SPEED_BONUS: 0.10,
  WEDGE_FRONT_ATK_BONUS: 0.20,
  WEDGE_REAR_ATK_BONUS: 0.08,
  WEDGE_FRONT_SLOTS: 3,
  SCATTER_RANGED_TAKEN_REDUCTION: 0.15,
  SCATTER_ALLY_DEATH_SHOCK_REDUCTION: 0.35,
});

// =============================================================================
// SAVAŞ SİSTEMİ
// =============================================================================

export const BATTLE = Object.freeze({
  // Savaş alanı
  DEPLOYMENT_WIDTH: 600,
  DEPLOYMENT_HEIGHT: 400,
  BATTLEFIELD_WIDTH: 1200,
  BATTLEFIELD_HEIGHT: 800,
  
  // Moral
  MORALE_MAX: 100,
  MORALE_FLEE_THRESHOLD: 20,
  MORALE_ROUT_THRESHOLD: 10,
  
  // Menziller (pixel)
  RANGE_MELEE: 15,
  RANGE_ARCHER: 180,
  RANGE_MUSKET: 150,
  RANGE_CARBINE: 120,
  
  // Formasyonlar
  FORMATION: {
    LINE: 'line',
    WEDGE: 'wedge',
    LOOSE: 'loose',
    CIRCLE: 'circle',
  },
  
  // Taktikler
  TACTIC: {
    STANDARD: 'standard',
    DEFENSIVE: 'defensive',
    AGGRESSIVE: 'aggressive',
    SKIRMISH: 'skirmish',
  },
  
  // Hız çarpanları
  SPEED: {
    INFANTRY: 1.0,
    CAVALRY: 2.0,
    HEAVY_CAV: 1.5,
  },
});

export const BATTLE_MORALE = Object.freeze({
  MORALE_MAX: 100,
  DAMAGE_TO_MORALE: 0.35,
  ALLY_DEATH_SHOCK: 10,
  SHOCK_RADIUS: 90,
  OUTNUMBERED_RADIUS: 140,
  OUTNUMBERED_DRAIN_PER_SEC: 6,
  REGEN_PER_SEC: 4,
  REGEN_DAMAGE_GRACE_SEC: 2,
  REGEN_ALLY_RADIUS: 80,
  FLEE_THRESHOLD: 35,
  ROUT_THRESHOLD: 15,
  SHAKEN_ATTACK_COOLDOWN_MULT: 1.2,
  SHAKEN_ATTACK_MULT: 0.9,
  ROUT_SPEED_MULT: 1.2,
  ROUT_DEF_MULT: 0.75,
});

export const BATTLE_RANGED = Object.freeze({
  SUPPRESS_DURATION_SEC: 2.5,
  SUPPRESS_SPEED_MULT: 0.75,
  SUPPRESS_MORALE_DRAIN_PER_SEC: 5,
  MELEE_EMERGENCY_RANGE_MULT: 0.2,
  AMMO_PER_SHOT: 1,
});

export const BATTLE_CASUALTIES = Object.freeze({
  WOUNDED_HP_THRESHOLD_PCT: 0.35,
  WOUNDED_BASE_CHANCE: 0.4,
  WOUNDED_ROUTE_BONUS_CHANCE: 0.2,
  WOUNDED_HP_MAX_MULT: 0.8,
  WOUNDED_ATK_MULT: 0.9,
  HEAL_PER_DAY: 0.4,
  HEAL_CAMP_MULT: 1.5,
  HEAL_STARVING_MULT: 0.3,
});

// =============================================================================
// TUŞ ATAMA VARSAYILANLARI
// =============================================================================

export const DEFAULT_KEYBINDS = Object.freeze({
  // Hareket
  moveUp: 'w',
  moveDown: 's',
  moveLeft: 'a',
  moveRight: 'd',
  
  // Kamera
  cameraUp: 'ArrowUp',
  cameraDown: 'ArrowDown',
  cameraLeft: 'ArrowLeft',
  cameraRight: 'ArrowRight',
  
  // Oyun kontrolü
  togglePause: ' ',
  quickSave: 'F5',
  quickLoad: 'F9',
  toggleDebug: 'F3',
  
  // Etkileşim
  interact: 'Enter',
  cancel: 'Escape',
  
  // Savaş
  battlePause: 'p',
  battleSpeed1: '1',
  battleSpeed2: '2',
  battleSpeed3: '3',
});

// =============================================================================
// KAYIT SİSTEMİ
// =============================================================================

export const SAVE = Object.freeze({
  KEY: 'fallOfCavalry_save_v1',
  VERSION: 1,
  AUTOSAVE_KEY: 'fallOfCavalry_autosave_v1',
  AUTOSAVE_SLOTS: 3,
  MANUAL_SAVE_SLOTS: 10,
});

// =============================================================================
// UI SABİTLERİ
// =============================================================================

export const UI = Object.freeze({
  // Zamanlama
  TOOLTIP_DELAY: 500,
  NOTIFICATION_DURATION: 3000,
  MODAL_ANIMATION_MS: 300,
  
  // Z-index katmanları
  Z_INDEX: {
    BASE: 1,
    HUD: 30,
    BATTLE_HUD: 30,
    CORNER_PANEL: 35,
    TOOLTIP: 40,
    DEBUG: 45,
    MODAL: 50,
  },
  
  // Minimap
  MINIMAP_SIZE: 220,
  MINIMAP_ZOOM: 0.1,
});

export const TUTORIAL_HINTS = Object.freeze({
  ENABLED_DEFAULT: true,
  MAX_DAYS: 3,
  MAX_REALTIME_SEC: 600,
  COOLDOWN_MS: 6500,
  PRIORITY: Object.freeze({
    encounter: 100,
    battleDeploy: 90,
    battleCmd: 90,
    city: 80,
    poi: 70,
    camp: 60,
    movement: 50,
  }),
});

export const HINT_TEXT = Object.freeze({
  encounter: 'İpucu: Karşılaşmada Fight ile savaşa gir veya Retreat ile geri çekil.',
  movement: 'İpucu: Haritada WASD / sürükle ile gez, mouse tekeri ile zoom.',
  city: 'İpucu: Şehir yakınında C ile şehre gir (Recruit/Trade).',
  poi: 'İpucu: POI yakınında E ile incele (ganimet/pusu/ipucu).',
  camp: 'İpucu: K ile kamp kur, nöbet seç; erzak tüketimi düşer.',
  battleDeploy: 'İpucu: Deploy: 1-4 formasyon, Q/E dön, tıkla yerleştir, Enter başlat.',
  battleCmd: 'İpucu: Komutlar: H Hold, F Focus, K Skirmish, R Retreat.',
});

// =============================================================================
// DEBUG MOD
// =============================================================================

export const DEBUG = Object.freeze({
  ENABLED: false,
  LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
  SHOW_FPS: true,
  SHOW_HITBOXES: false,
  SHOW_PATHFINDING: false,
  GOD_MODE: false,
});

// =============================================================================
// EKONOMİ SİSTEMİ
// =============================================================================

export const ECONOMY = Object.freeze({
  // Kaynak tipleri
  RESOURCE: {
    GOLD: 'gold',
    FOOD: 'food',
    WOOD: 'wood',
    STONE: 'stone',
    IRON: 'iron',
  },
  
  // Başlangıç fiyatları
  BASE_PRICE: {
    FOOD: 2,
    WOOD: 5,
    STONE: 8,
    IRON: 15,
  },
  
  // Ticaret
  TRADE_TAX: 0.10,
  MERCHANT_SPAWN_CHANCE: 0.05,
});

// =============================================================================
// DİPLOMASİ SİSTEMİ (İLERİDE)
// =============================================================================

export const DIPLOMACY = Object.freeze({
  RELATION: {
    MIN: -100,
    MAX: 100,
    NEUTRAL: 0,
    FRIENDLY: 50,
    ALLIED: 80,
    HOSTILE: -50,
    WAR: -80,
  },
  
  TREATY_TYPE: {
    ALLIANCE: 'alliance',
    WAR: 'war',
    TRADE: 'trade',
    NON_AGGRESSION: 'non_aggression',
  },
});

// =============================================================================
// EXPORT ALL (Kolaylık için)
// =============================================================================

export default {
  WORLD,
  GAME,
  SETTLEMENT,
  UNIT,
  FACTION,
  ENCOUNTER,
  TERRAIN,
  BATTLE,
  BATTLE_FLANK,
  BATTLE_COUNTERS,
  BATTLE_CHARGE,
  DEFAULT_KEYBINDS,
  SAVE,
  UI,
  TUTORIAL_HINTS,
  HINT_TEXT,
  DEBUG,
  ECONOMY,
  DIPLOMACY,
  ACCOUNTING,
  PERF,
  MARKET,
  MARKET_BIOME_PRODUCTION,
  ARMOR_TYPE,
  ARMOR_MITIGATION,
  DAMAGE_TYPE,
  DAMAGE_VS_ARMOR,
  TERRAIN_MODS,
  BATTLE_COMMANDS,
  BATTLE_AI,
  FORMATION,
  DEPLOY,
  BATTLE_FORMATION,
  BATTLE_MORALE,
  BATTLE_RANGED,
  BATTLE_CASUALTIES,
};
