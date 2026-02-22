/**
 * FallOfCavalry - Game Constants
 * Tüm sabit değerler ve magic number'lar burada
 * HİÇBİR BAĞIMLILIĞI YOK - İLK YÜKLENECEK DOSYA
 */

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
  DEFAULT_KEYBINDS,
  SAVE,
  UI,
  DEBUG,
  ECONOMY,
  DIPLOMACY,
};