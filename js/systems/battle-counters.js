import * as CONST from '../constants.js';

const MOVING_SPEED_THRESHOLD = 8;
const BRACE_SPEED_THRESHOLD = 3;

function toRoleToken(entry) {
  const id = String(entry?.id || entry?.sourceId || '').toLowerCase();
  const cls = String(entry?.class || '').toLowerCase();
  const name = String(entry?.name || entry?.label || '').toLowerCase();
  return `${id} ${cls} ${name}`;
}

export function inferUnitRole(entry) {
  if (entry?.isRanged) return 'archer';
  const token = toRoleToken(entry);
  if (token.includes('heavy') || token.includes('guard') || token.includes('legion')) return 'heavy_inf';
  if (token.includes('elite_cav') || token.includes('elite cav') || token.includes('knight')) return 'elite_cav';
  if (token.includes('siege') || token.includes('breaker') || token.includes('shock')) return 'siege';
  if (token.includes('cav')) return 'cavalry';
  if (token.includes('spear') || token.includes('pike')) return 'spearman';
  return 'infantry';
}

export function getCounterEffect({ attackerRole, defenderRole, cfg } = {}) {
  const counters = cfg?.BATTLE_COUNTERS || cfg || CONST.BATTLE_COUNTERS;
  const baseMorale = Number(counters.COUNTER_BASE_MORALE_BONUS ?? 0);
  if (attackerRole === 'spearman' && defenderRole === 'cavalry') {
    return {
      dmgMult: Number(counters.SPEAR_VS_CAV_DMG_MULT ?? 1),
      moraleBonus: Number(counters.SPEAR_VS_CAV_MORALE_BONUS ?? 0) + baseMorale,
    };
  }
  if (attackerRole === 'cavalry' && defenderRole === 'archer') {
    return {
      dmgMult: Number(counters.CAV_VS_ARCHER_DMG_MULT ?? 1),
      moraleBonus: Number(counters.CAV_VS_ARCHER_MORALE_BONUS ?? 0) + baseMorale,
    };
  }
  if (attackerRole === 'infantry' && defenderRole === 'spearman') {
    return {
      dmgMult: Number(counters.INFANTRY_VS_SPEAR_DMG_MULT ?? 1),
      moraleBonus: baseMorale,
    };
  }
  if (attackerRole === 'heavy_inf' && defenderRole === 'infantry') {
    return {
      dmgMult: Number(counters.HEAVY_INF_VS_INF_DMG_MULT ?? 1),
      moraleBonus: baseMorale,
    };
  }
  if (attackerRole === 'elite_cav' && defenderRole === 'infantry') {
    return {
      dmgMult: Number(counters.ELITE_CAV_VS_INF_DMG_MULT ?? counters.CAV_VS_ARCHER_DMG_MULT ?? 1),
      moraleBonus: Number(counters.CAV_VS_ARCHER_MORALE_BONUS ?? 0) + baseMorale,
    };
  }
  if (attackerRole === 'elite_cav' && defenderRole === 'archer') {
    return {
      dmgMult: Number(counters.ELITE_CAV_VS_ARCHER_DMG_MULT ?? counters.CAV_VS_ARCHER_DMG_MULT ?? 1),
      moraleBonus: Number(counters.CAV_VS_ARCHER_MORALE_BONUS ?? 0) + 2 + baseMorale,
    };
  }
  if (attackerRole === 'siege' && (defenderRole === 'heavy_inf' || defenderRole === 'siege')) {
    return {
      dmgMult: Number(counters.SIEGE_VS_HEAVY_DMG_MULT ?? 1),
      moraleBonus: baseMorale,
    };
  }
  if (attackerRole === 'siege' && defenderRole === 'infantry') {
    return {
      dmgMult: Number(counters.SIEGE_VS_INF_DMG_MULT ?? 1),
      moraleBonus: baseMorale,
    };
  }
  return { dmgMult: 1, moraleBonus: baseMorale };
}

export function computeChargeState({ unit, dtSec, cfg } = {}) {
  if (!unit || unit.role !== 'cavalry') return;
  const chargeCfg = cfg?.BATTLE_CHARGE || cfg || CONST.BATTLE_CHARGE;
  unit.chargeCooldownRemaining = Math.max(0, Number(unit.chargeCooldownRemaining || 0));
  if (unit.chargeCooldownRemaining > 0) return;

  const speed = Math.hypot(Number(unit.vx || 0), Number(unit.vy || 0));
  const meter = Math.max(0, Number(unit.chargeMeter || 0));
  if (speed > MOVING_SPEED_THRESHOLD) {
    unit.chargeMeter = meter + (Number(chargeCfg.CHARGE_BUILD_PER_SEC ?? 0) * dtSec);
  } else {
    unit.chargeMeter = Math.max(0, meter - (Number(chargeCfg.CHARGE_BUILD_PER_SEC ?? 0) * dtSec * 0.4));
  }
  const threshold = Number(chargeCfg.CHARGE_READY_THRESHOLD ?? 0);
  unit.chargeReady = unit.chargeMeter >= threshold;
}

export function isBracedSpearman(defender, cfg = null) {
  if (!defender || defender.role !== 'spearman') return false;
  if (defender.command !== CONST.BATTLE_COMMANDS.HOLD) return false;
  if (defender.moraleState === 'routing') return false;
  const speed = Math.hypot(Number(defender.vx || 0), Number(defender.vy || 0));
  const threshold = Number(cfg?.BATTLE_CHARGE?.BRACE_SPEED_THRESHOLD ?? BRACE_SPEED_THRESHOLD);
  return speed <= threshold;
}
