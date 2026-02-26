export function initBattleAmmoFromParty({ party } = {}) {
  const items = Array.isArray(party?.inventory?.items) ? party.inventory.items : [];
  const arrows = items.find((entry) => entry?.id === 'arrows');
  const startAmmo = Math.max(0, Math.floor(Number(arrows?.qty ?? 0)));
  return { startAmmo, ammo: startAmmo };
}

export function consumeAmmo({ battle, side, amount } = {}) {
  if (!battle || side !== 'player') return true;
  const spend = Math.max(0, Math.floor(Number(amount ?? 0)));
  if (spend <= 0) return true;
  const current = Number.isFinite(battle.playerAmmo) ? battle.playerAmmo : 0;
  if (current < spend) return false;
  battle.playerAmmo = current - spend;
  return true;
}

export function shouldUseMeleeFallback({ unit, dist, battle, cfg } = {}) {
  if (!unit?.isRanged) return false;
  const range = Math.max(0, Number(unit.rangedRange ?? 0));
  const emergencyMult = Math.max(0, Number(cfg?.MELEE_EMERGENCY_RANGE_MULT ?? 0.35));
  const emergencyRange = range * emergencyMult;
  const inEmergencyRange = Number.isFinite(dist) && dist <= emergencyRange;

  const hasAmmo = unit.side !== 'player'
    || battle?.playerAmmo === Number.POSITIVE_INFINITY
    || Number(battle?.playerAmmo ?? 0) >= Math.max(1, Number(cfg?.AMMO_PER_SHOT ?? 1));

  return !hasAmmo || inEmergencyRange;
}

export function applySuppressionOnHit({ attacker, target, battleTimeSec, cfg } = {}) {
  if (!attacker?.isRanged || !target) return;
  const now = Number(battleTimeSec ?? 0);
  const duration = Math.max(0, Number(cfg?.SUPPRESS_DURATION_SEC ?? 1.5));
  target.suppressedUntil = now + duration;
}
