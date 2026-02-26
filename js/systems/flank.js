export const ATTACK_SIDE = Object.freeze({
  FRONT: 'front',
  FLANK: 'flank',
  REAR: 'rear',
});

function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len <= 1e-6) return null;
  return { x: x / len, y: y / len };
}

export function classifyAttackSide(defenderFacingRad, attackDirVec) {
  const facing = normalize(Math.cos(defenderFacingRad || 0), Math.sin(defenderFacingRad || 0)) || { x: 1, y: 0 };
  const attack = normalize(attackDirVec?.x || 0, attackDirVec?.y || 0);
  if (!attack) return ATTACK_SIDE.FRONT;
  const dot = Math.max(-1, Math.min(1, (facing.x * attack.x) + (facing.y * attack.y)));
  const angleDiffDeg = (Math.acos(dot) * 180) / Math.PI;
  if (angleDiffDeg <= 60) return ATTACK_SIDE.FRONT;
  if (angleDiffDeg <= 120) return ATTACK_SIDE.FLANK;
  return ATTACK_SIDE.REAR;
}

export function resolveFlankBonuses(side, flankTuning) {
  if (side === ATTACK_SIDE.REAR) {
    return {
      damageMult: Number(flankTuning?.REAR_MULT ?? 1.3),
      moraleBonus: Number(flankTuning?.REAR_MORALE_BONUS ?? 8),
    };
  }
  if (side === ATTACK_SIDE.FLANK) {
    return {
      damageMult: Number(flankTuning?.FLANK_MULT ?? 1.15),
      moraleBonus: Number(flankTuning?.FLANK_MORALE_BONUS ?? 4),
    };
  }
  return { damageMult: 1, moraleBonus: 0 };
}

export function getAttackDirectionAgainstDefender(attacker, defender) {
  if (Number.isFinite(attacker?.attackDirX) && Number.isFinite(attacker?.attackDirY)) {
    const incoming = normalize(attacker.attackDirX, attacker.attackDirY);
    if (incoming) return { x: -incoming.x, y: -incoming.y };
  }
  const dx = Number(attacker?.x ?? 0) - Number(defender?.x ?? 0);
  const dy = Number(attacker?.y ?? 0) - Number(defender?.y ?? 0);
  return normalize(dx, dy) || { x: Math.cos(defender?.facing || 0), y: Math.sin(defender?.facing || 0) };
}
