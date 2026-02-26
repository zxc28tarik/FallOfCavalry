import * as CONST from '../constants.js';

export function inferUnitRole(entry) {
  if (entry?.isRanged) return 'archer';
  const id = String(entry?.id || '').toLowerCase();
  const klass = String(entry?.class || '').toLowerCase();
  if (id.includes('cav') || klass.includes('cav')) return 'cavalry';
  if (id.includes('spear') || id.includes('pike') || klass.includes('spear') || klass.includes('pike')) return 'spearman';
  return 'infantry';
}

export function getCounterEffect({ attackerRole, defenderRole, isChargeHit = false, cfg = {} }) {
  const result = { dmgMult: 1, moraleBonus: 0 };
  if (attackerRole === 'spearman' && defenderRole === 'cavalry') {
    result.dmgMult *= Number(cfg.SPEAR_VS_CAV_MULT ?? 1);
    result.moraleBonus += Number(cfg.COUNTER_MORALE_BONUS ?? 0);
  } else if (attackerRole === 'cavalry' && defenderRole === 'archer') {
    result.dmgMult *= Number(cfg.CAV_VS_ARCHER_MULT ?? 1);
    result.moraleBonus += Number(cfg.COUNTER_MORALE_BONUS ?? 0);
  } else if (attackerRole === 'infantry' && defenderRole === 'spearman') {
    result.dmgMult *= Number(cfg.INF_VS_SPEAR_MULT ?? 1);
  }
  if (isChargeHit) {
    result.dmgMult *= Number(cfg.CHARGE_DMG_MULT ?? 1);
    result.moraleBonus += Number(cfg.CHARGE_MORALE_SHOCK ?? 0);
  }
  return result;
}

export function computeChargeState({ unit, dt, cfg = {} }) {
  if (!unit) return;
  const cooldown = Math.max(0, Number(unit.chargeCooldown || 0) - dt);
  unit.chargeCooldown = cooldown;
  const moveSpeed = Math.hypot(Number(unit.vx || 0), Number(unit.vy || 0));
  const movingFast = moveSpeed >= Number(cfg.CHARGE_MOVE_SPEED_THRESHOLD ?? 0);
  if (unit.role === 'cavalry' && cooldown <= 0 && movingFast) {
    unit.chargeMeter = Math.min(1.5, Number(unit.chargeMeter || 0) + (Number(cfg.CHARGE_BUILD_PER_SEC ?? 0) * dt));
  } else {
    unit.chargeMeter = Math.max(0, Number(unit.chargeMeter || 0) - (Number(cfg.CHARGE_DECAY_PER_SEC ?? 0) * dt));
  }
  unit.chargeReady = unit.role === 'cavalry' && unit.chargeCooldown <= 0 && unit.chargeMeter >= Number(cfg.CHARGE_READY_THRESHOLD ?? 1);
}

export function isBracedSpearman(defender, cfg = {}) {
  if (!defender || defender.role !== 'spearman') return false;
  if (defender.command !== CONST.BATTLE_COMMANDS.HOLD) return false;
  const speed = Math.hypot(Number(defender.vx || 0), Number(defender.vy || 0));
  return speed <= Number(cfg.BRACE_SPEED_MAX ?? 0);
}
