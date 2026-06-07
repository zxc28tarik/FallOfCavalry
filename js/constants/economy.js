// FallOfCavalry - Economy constants
import { ALL_TRADE_GOODS } from './trade-goods.js';
export {
  TRADE_GOODS,
  ALL_TRADE_GOODS,
  TRADE_GOOD_BY_ID,
  TRADE_GOOD_ID_ALIASES,
  normalizeTradeGoodId,
} from './trade-goods.js';

export const TRADE_ITEMS = Object.freeze(ALL_TRADE_GOODS.map((item) => Object.freeze({ ...item })));

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
  PLAINS: Object.freeze({ wheat: 3, flour: 1, meat: 2, wool: 1 }),
  FOREST: Object.freeze({ wood: 3, timber: 2, meat: 2, fur: 1 }),
  HILLS: Object.freeze({ iron: 3, stone: 2, wood: 2 }),
  SHORE: Object.freeze({ fish: 3, salt: 3, olive_oil: 1, cloth: 1 }),
  MOUNTAIN: Object.freeze({ iron: 3, stone: 3, fur: 1, meat: -2 }),
  SNOW: Object.freeze({ fur: 2, meat: -2, wheat: -3 }),
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

export const CONTRACTS = Object.freeze({
  REWARD_GOLD_BASE: 40,
  REWARD_RENOWN_BASE: 8,
  DELIVERY_FOOD_MIN: 20,
  DELIVERY_FOOD_MAX: 60,
  BANDIT_BATTLE_COUNT: 1,
  SCOUT_POI_COUNT: 1,
  DEFEND_WINDOW_DAYS: 3,
  DEFEND_WAVE_COUNT: 2,
  ESCORT_DISTANCE_MIN: 10,
  ESCORT_DISTANCE_MAX: 25,
  ASSASSINATE_TARGET_POWER: 1.5,
  WAR_CONTRACT_BONUS_RENOWN: 5,
});

export const ACCOUNTING = Object.freeze({
  NEGATIVE_GOLD_MORALE_PENALTY: 4,
  AUTO_OPEN: true,
});

export const CAMPAIGN_OBJECTIVES = Object.freeze({
  WIN_RENOWN: 200,
  WIN_GOLD: 5000,
  LOSE_GOLD: -50,
  LOSE_STARVE_DAYS: 5,
});

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
