// FallOfCavalry - Core game system constants

export const BUILD_INFO = Object.freeze({
  version: '0.0.0-dev',
  builtAt: null,
});

export const GAME = Object.freeze({
  // Zaman
  DAY_LENGTH_SEC: 15,
  AUTOSAVE_INTERVAL_SEC: 120,

  // Karşılaşma
  ENCOUNTER_COOLDOWN_SEC: 2.2,
  ENCOUNTER_RATE_MULT: 0.005,
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
  PLAYER_WORLD_SPEED_MULT: 15,

  // 2.x Hareket / encounter tuning
  ROAD_SPEED_MULT: 1.2,
  OFFROAD_SPEED_MULT: 1.0,
  RIVER_CROSSING_PENALTY_MULT: 0.35,
  ENCOUNTER_CHANCE_ROAD: 0.6,
  ENCOUNTER_CHANCE_OFFROAD: 1.2,
  RIVER_BLOCK_NON_CROSSING: true,
});

export const SAVE = Object.freeze({
  KEY: 'fallOfCavalry_save_v1',
  VERSION: 1,
  AUTOSAVE_KEY: 'fallOfCavalry_autosave_v1',
  AUTOSAVE_SLOTS: 3,
  MANUAL_SAVE_SLOTS: 10,
});

export const PERF = Object.freeze({
  PROJECTILE_POOL: 128,
  FLOATTEXT_POOL: 64,
  HIDDEN_TICK_THROTTLE_MS: 250,
});

export const SPRITES = Object.freeze({
  MAP_MARKER_SCALE: 1,
  BATTLE_UNIT_SCALE: 1,
});

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

export const FACTION = Object.freeze({
  ID: {
    PLAYER: 'player',
    KINGDOM_A: 'kingdom_a',
    KINGDOM_B: 'kingdom_b',
    BANDITS: 'bandits',
    OTTOMAN: 'ottoman',
    HRE: 'hre',
    POLISH: 'polish',
    SPANISH: 'spanish',
    VENICE: 'venice',
    RUSSIA: 'russia',
    FRANCE: 'france',
    ENGLAND: 'england',
    SWEDEN: 'sweden',
    PORTUGAL: 'portugal',
    DENMARK: 'denmark',
    SAFAVID: 'safavid',
    AUSTRIA: 'austria',
    NETHERLANDS: 'netherlands',
    GENOA: 'genoa',
    PAPAL_STATES: 'papal_states',
    SWISS: 'swiss',
    MOROCCO: 'morocco',
    TUSCANY: 'tuscany',
    SAVOY: 'savoy',
    BANDIT: 'bandit',
  },

  // Faction renkleri (FACTION_VISUALS'dan gelecek)
  // Bu sabitleri buraya koyduk ki import döngüsü olmasın
});

export const FACTIONS = Object.freeze([
  { id: FACTION.ID.OTTOMAN, name: 'Osmanlı İmparatorluğu', color: '#c0392b', doctrine: 'Yeniçeri Disiplini', desc: 'Balkanlara ve Anadoluya hükmeden kadim imparatorluk.', startingGold: 130, startingArmy: 0, startingRenown: 15, armyHint: 'Güçlü yaya ve süvari birlikleri.' },
  { id: FACTION.ID.HRE, name: 'Kutsal Roma İmparatorluğu', color: '#111111', doctrine: 'Lejyon Düzeni', desc: 'Orta Avrupanın savunmacı ve disiplinli ordusu.', startingGold: 110, startingArmy: 0, startingRenown: 12, armyHint: 'Dengeli ve sağlam birlikler.' },
  { id: FACTION.ID.SPANISH, name: 'İspanya Krallığı', color: '#f57c00', doctrine: 'Tercio Taktiği', desc: 'Efsanevi Tercio birlikleriyle Batı Avrupaya hükmedin.', startingGold: 115, startingArmy: 0, startingRenown: 12, armyHint: 'Mızrakçı ve tüfekçi karması.' },
  { id: FACTION.ID.POLISH, name: 'Polonya Krallığı', color: '#8e44ad', doctrine: 'Kanatlı Hussarlar', desc: 'Efsanevi hussarlarla kuzeyde hükümranlık kurun.', startingGold: 100, startingArmy: 0, startingRenown: 10, armyHint: 'Süvari ağırlıklı saldırı gücü.' },
  { id: FACTION.ID.VENICE, name: 'Venedik Cumhuriyeti', color: '#1e88e5', doctrine: 'Ticaret Gücü', desc: 'Zengin ticaret ağı ve paralı askerlerle stratejik üstünlük.', startingGold: 200, startingArmy: 0, startingRenown: 8, armyHint: 'Az ama seçkin birlikler, yüksek altın.' },
  { id: FACTION.ID.RUSSIA, name: 'Rus Carligi', color: '#9ba978', doctrine: 'Step Siniri', desc: 'Dogu Avrupa ve kuzey bozkirlarinda genisleyen carlik.', playable: false },
  { id: FACTION.ID.FRANCE, name: 'Fransa Kralligi', color: '#597aa8', doctrine: 'Kraliyet Ordusu', desc: 'Bati Avrupa merkezli mavi sancakli krallik.', playable: false },
  { id: FACTION.ID.SWEDEN, name: 'Isvec Kralligi', color: '#d7a544', doctrine: 'Kuzey Ordusu', desc: 'Baltik ve Iskandinavya uzerinde yukselen kuzey gucu.', playable: false },
  { id: FACTION.ID.PORTUGAL, name: 'Portekiz Kralligi', color: '#6fa15f', doctrine: 'Atlantik Ticareti', desc: 'Iberyanin bati kiyisindaki denizci krallik.', playable: false },
  { id: FACTION.ID.DENMARK, name: 'Danimarka-Norvec', color: '#c66f50', doctrine: 'Kuzey Bogazlari', desc: 'Kuzey deniz yollarini tutan krallik.', playable: false },
  { id: FACTION.ID.SAFAVID, name: 'Safevi Devleti', color: '#4f9b84', doctrine: 'Kizilbas Ocagi', desc: 'Iran ve Kafkas hattinda Osmanlinin dogu rakibi.', playable: false },
  { id: FACTION.ID.AUSTRIA, name: 'Haus Osterreich', color: '#ecc545', doctrine: 'Habsburg Topraklari', desc: 'Avusturya, Bohemya ve Macar cekirdeginin hanedan gucu.', playable: false },
  { id: FACTION.ID.NETHERLANDS, name: 'Birlesik Hollanda Cumhuriyeti', color: '#dea82d', doctrine: 'Deniz Ticareti', desc: 'Kuzey Denizi ticaret aglarini tutan cumhuriyet.', playable: false },
  { id: FACTION.ID.GENOA, name: 'Cenova Cumhuriyeti', color: '#b86d70', doctrine: 'Ligurya Ticareti', desc: 'Akdeniz ticareti ve banka aglariyla ayakta duran denizci cumhuriyet.', playable: false },
  { id: FACTION.ID.PAPAL_STATES, name: 'Papal Devleti', color: '#ba97bf', doctrine: 'Ruhani Otorite', desc: 'Orta Italya merkezli papalik topraklari.', playable: false },
  { id: FACTION.ID.SWISS, name: 'Isvicre Konfederasyonu', color: '#d6cdb5', doctrine: 'Dag Konfederasyonu', desc: 'Alplerin savunmaci kanton birligi.', playable: false },
  { id: FACTION.ID.MOROCCO, name: "Saltanatu's-Serife", color: '#8f3a49', doctrine: 'Magreb Sultanligi', desc: 'Fas ve bati Magreb hattinda serif hanedan otoritesi.', playable: false },
  { id: FACTION.ID.TUSCANY, name: 'Toskana Grandukaligi', color: '#c6ae57', doctrine: 'Toskana Sehirleri', desc: 'Orta Italya ticaret ve zanaat merkezleri.', playable: false },
  { id: FACTION.ID.SAVOY, name: 'Savoy Dukaligi', color: '#bf805f', doctrine: 'Alp Gecitleri', desc: 'Alpler ve Piyemonte hattinda stratejik dukalik.', playable: false },
]);

export const FACTION_WAR = Object.freeze({
  WAR_DECL_THRESHOLD: -40,
  PEACE_TRUCE_THRESHOLD: -5,
  CITY_CAPTURE_WARSCORE: 20,
  BATTLE_WIN_WARSCORE: 5,
  BATTLE_LOSS_WARSCORE: -4,
  WARSCORE_TO_FORCE_PEACE: 60,
  WARSCORE_TO_FORCE_LOSS: -60,
  FRONTLINE_RADIUS: 10,
  CRISIS_WAR_COUNT_THRESHOLD: 2,
});

export const DIPLOMACY_ACTIONS = Object.freeze({
  TRUCE_COST_GOLD: 150,
  IMPROVE_RELATION_COST_GOLD: 80,
  IMPROVE_RELATION_DELTA: 15,
  DECLARE_WAR_RELATION_DELTA: -40,
  WAR_TRADE_PENALTY_MULT: 1.3,
  ALLY_TRADE_DISCOUNT_MULT: 0.85,
  CONTRACT_REWARD_RELATION_BONUS: 4,
  KILLING_NEUTRAL_CARAVAN_PENALTY: -25,
});

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

export const DIPLOMACY_RELATIONS = Object.freeze({
  MIN: -100,
  MAX: 100,
  NEUTRAL: 0,
  FRIENDLY: 50,
  ALLIED: 80,
  HOSTILE: -50,
  WAR: -80,
  WAR_THRESHOLD: -80,  // alias for WAR — used by getStance() and buyTruce()
  ALLY_THRESHOLD: 50,  // alias for FRIENDLY — used by getStance()
});

export const EVENTS = Object.freeze({
  ENABLED: true,
  MAX_ACTIVE_EVENTS: 4,
  BASE_WAR_EVENT_CHANCE: 0.25,
  CRISIS_EVENT_CHANCE: 0.6,
  EVENT_DURATION_DAYS_MIN: 3,
  EVENT_DURATION_DAYS_MAX: 7,
  WAR_TAX_GOLD_MULT: 1.15,
  WAR_TRADE_TARIFF_MULT: 1.2,
  BANDIT_SPIKE_MULT: 1.5,
  REFUGEE_RENOWN_BONUS: 5,
});

export const SETTINGS = Object.freeze({
  DEFAULT_FX_ENABLED: true,
  DEFAULT_CAMERA_SHAKE_ENABLED: true,
  DEFAULT_WEATHER_ENABLED: true,
  DEFAULT_DIFFICULTY_MULT: 1.0,
  DIFFICULTY_MIN: 0.7,
  DIFFICULTY_MAX: 1.5,
  DIFFICULTY_STEP: 0.1,
});
