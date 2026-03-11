// FallOfCavalry - Battle constants

export const BATTLE_FX = Object.freeze({
  HIT_FLASH_DURATION: 180,
  DEATH_FADE_DURATION: 600,
  DEATH_SHRINK_FACTOR: 0.6,
  HIT_FLASH_COLOR: 'rgba(255,255,255,0.8)',
  ENABLED: true,
  MAX_PARTICLES: 512,
  HIT_PARTICLES: 8,
  BLOOD_PARTICLES: 10,
  DUST_PARTICLES: 6,
  TRAIL_PARTICLES_PER_SEC: 12,
  PARTICLE_LIFETIME_SEC: 0.4,
  PARTICLE_GRAVITY: 80,
  PARTICLE_FRICTION: 0.9,
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
  HEAVY_INF_VS_INF_DMG_MULT: 1.2,
  ELITE_CAV_VS_INF_DMG_MULT: 1.3,
  ELITE_CAV_VS_ARCHER_DMG_MULT: 1.45,
  SIEGE_VS_HEAVY_DMG_MULT: 1.35,
  SIEGE_VS_INF_DMG_MULT: 1.25,
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

export const BATTLE_CAMERA = Object.freeze({
  ENABLED: true,
  BASE_ZOOM: 1.0,
  MAX_ZOOM_IN: 1.3,
  MAX_ZOOM_OUT: 0.8,
  SMOOTHING_SEC: 0.25,
  SHAKE_ENABLED: true,
  SHAKE_HIT_MAG: 6,
  SHAKE_CHARGE_MAG: 10,
  SHAKE_DURATION_SEC: 0.18,
  SHAKE_FALLOFF: 4.0,
  FOLLOW_STRENGTH: 0.2,
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

export const BATTLE_REWARDS = Object.freeze({
  LOOT_GOLD_MIN: 10,
  LOOT_GOLD_MAX: 60,
  LOOT_ITEM_CHANCE: 0.3,
  RENOWN_BASE: 5,
  RENOWN_PER_ENEMY_POWER: 0.5,
  RENOWN_CASUALTY_PENALTY: 2,
  RENOWN_ROUTING_PENALTY: 2,
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
