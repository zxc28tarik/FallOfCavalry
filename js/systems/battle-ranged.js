function getEmergencyMeleeRange(unit, cfg = {}) {
  const meleeRange = Number(unit?.meleeRange);
  if (Number.isFinite(meleeRange) && meleeRange > 0) return meleeRange;
  const range = Number(unit?.rangedRange ?? unit?.attackRange ?? 0);
  const mult = Number(cfg?.MELEE_EMERGENCY_RANGE_MULT ?? 0.25);
  return Math.max(0, range * mult);
}

export function initBattleAmmoFromParty({ party } = {}) {
  const items = Array.isArray(party?.inventory?.items) ? party.inventory.items : [];
  const arrows = items.find((item) => item?.id === 'arrows');
  const startAmmo = Math.max(0, Math.floor(Number(arrows?.qty ?? 0)));
  return { startAmmo, ammo: startAmmo };
}

export function consumeAmmo({ battle, side, amount } = {}) {
  if (side !== 'player') return true;
  if (!battle || !Number.isFinite(amount) || amount <= 0) return false;
  const currentAmmo = Math.max(0, Math.floor(Number(battle.playerAmmo ?? 0)));
  const required = Math.max(0, Math.floor(amount));
  if (currentAmmo < required) return false;
  battle.playerAmmo = Math.max(0, currentAmmo - required);
  return true;
}

export function canUnitFireRanged(unit, battle, cfg = {}, distToTarget = Number.POSITIVE_INFINITY) {
  if (!unit?.isRanged) return false;
  if (unit.holdFire === true) return false;
  if (unit.side === 'player' && Math.max(0, Number(battle?.playerAmmo ?? 0)) <= 0) return false;

  const emergencyMeleeRange = getEmergencyMeleeRange(unit, cfg);
  return Number(distToTarget) > emergencyMeleeRange;
}

export function applySuppressionOnHit({ target, battleTimeSec, cfg } = {}) {
  if (!target) return;
  const now = Number(battleTimeSec || 0);
  const duration = Math.max(0, Number(cfg?.SUPPRESS_DURATION_SEC ?? 0));
  const nextUntil = now + duration;
  target.suppressedUntil = Math.max(Number(target.suppressedUntil || 0), nextUntil);
}

export function tickSuppression({ unit, dtMs, battleTimeSec, cfg } = {}) {
  if (!unit) return;
  unit.suppressionSpeedMult = 1;

  const until = Number(unit.suppressedUntil || 0);
  if (!Number.isFinite(until) || until <= Number(battleTimeSec || 0)) return;

  const dtSec = Math.max(0, Number(dtMs || 0) / 1000);
  const speedMult = Number(cfg?.SUPPRESS_SPEED_MULT ?? 1);
  unit.suppressionSpeedMult = Number.isFinite(speedMult) && speedMult > 0 ? speedMult : 1;

  const moraleDrainPerSec = Math.max(0, Number(cfg?.SUPPRESS_MORALE_DRAIN_PER_SEC ?? 0));
  if (!Number.isFinite(unit.morale)) return;
  unit.morale = Math.max(0, unit.morale - (moraleDrainPerSec * dtSec));
}

export function shouldUseMeleeFallback({ unit, distToTarget, cfg = {}, battle } = {}) {
  if (!unit?.isRanged) return false;
  const emergencyMeleeRange = getEmergencyMeleeRange(unit, cfg);
  if (Number(distToTarget) <= emergencyMeleeRange) return true;

  if (unit.side === 'player') {
    const ammo = Math.max(0, Number(battle?.playerAmmo ?? 0));
    return ammo <= 0;
  }
  return false;
}

export default {
  initBattleAmmoFromParty,
  consumeAmmo,
  canUnitFireRanged,
  applySuppressionOnHit,
  tickSuppression,
  shouldUseMeleeFallback,
};
