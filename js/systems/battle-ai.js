import * as CONST from '../constants.js';

const MAX_LOCAL_SCAN = 18;
const MAX_TARGET_SCAN = 24;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dist(a, b) {
  return Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
}

export function scoreTarget(attacker, target, ctx = {}) {
  if (!attacker || !target || target.dead || target.hp <= 0) return Number.NEGATIVE_INFINITY;
  const cfg = ctx.cfg || CONST.BATTLE_AI;
  const d = dist(attacker, target);
  const hpPct = clamp((target.hp || 1) / Math.max(1, target.maxHp || 1), 0, 1);
  const distanceScore = 180 / (1 + d);
  const lowHpScore = (1 - hpPct) * Number(cfg.AI_TARGET_LOWHP_WEIGHT ?? CONST.BATTLE_AI.AI_TARGET_LOWHP_WEIGHT);
  const routingBonus = (target.moraleState === 'routing' || target.moraleState === 'shaken')
    ? Number(cfg.AI_TARGET_ROUTING_BONUS ?? CONST.BATTLE_AI.AI_TARGET_ROUTING_BONUS)
    : 0;

  let flankScore = 0;
  const cavalry = Boolean(attacker.isCavalry || String(attacker.class || '').includes('cav'));
  if (cavalry) {
    const tf = Number(target.facing ?? 0);
    const toAttacker = Math.atan2((attacker.y || 0) - (target.y || 0), (attacker.x || 0) - (target.x || 0));
    const rel = Math.atan2(Math.sin(toAttacker - tf), Math.cos(toAttacker - tf));
    const absRel = Math.abs(rel);
    if (absRel > Math.PI * 0.75) flankScore += 28;
    else if (absRel > Math.PI * 0.35) flankScore += 14;
  }

  return distanceScore + lowHpScore + routingBonus + flankScore;
}

export function pickTarget(attacker, enemies, ctx = {}) {
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let checked = 0;
  for (const enemy of enemies || []) {
    if (!enemy || enemy.dead || enemy.hp <= 0) continue;
    checked += 1;
    const s = scoreTarget(attacker, enemy, ctx);
    if (s > bestScore) {
      bestScore = s;
      best = enemy;
    }
    if (checked >= MAX_TARGET_SCAN) break;
  }
  return best;
}

export function computeFlankApproachPoint(attacker, target, cfg = CONST.BATTLE_AI) {
  if (!attacker || !target) return { x: attacker?.x || 0, y: attacker?.y || 0 };
  const tx = Number(target.x || 0);
  const ty = Number(target.y || 0);
  const ex = Number(attacker.x || 0);
  const ey = Number(attacker.y || 0);
  const dx = ex - tx;
  const dy = ey - ty;
  const mag = Math.max(0.001, Math.hypot(dx, dy));
  const nx = dx / mag;
  const ny = dy / mag;
  const px = -ny;
  const py = nx;
  const side = ((attacker.unitId || '').length % 2 === 0) ? 1 : -1;
  const lateral = Math.max(24, Math.min(90, mag * 0.45));
  const rear = Math.max(12, Math.min(50, mag * 0.20));
  return {
    x: tx + (nx * rear) + (px * lateral * side),
    y: ty + (ny * rear) + (py * lateral * side),
  };
}

export function updateEnemyAI({ battle, dt, cfg = CONST.BATTLE_AI, getLocalCounts } = {}) {
  if (!battle || !Number.isFinite(dt) || dt <= 0) return;
  const enemies = battle.enemyUnits || [];
  const players = battle.playerUnits || [];
  if (!enemies.length || !players.length) return;

  const retargetSec = Math.max(0.2, Number(cfg.AI_RETARGET_SEC ?? CONST.BATTLE_AI.AI_RETARGET_SEC));
  battle.aiRetargetTimer = Number(battle.aiRetargetTimer || 0) - dt;
  const shouldRetarget = battle.aiRetargetTimer <= 0;
  if (shouldRetarget) battle.aiRetargetTimer = retargetSec;

  const radius = Math.max(40, Number(cfg.AI_LOCAL_RADIUS ?? CONST.BATTLE_AI.AI_LOCAL_RADIUS));
  const outnumberedRatio = Math.max(1.1, Number(cfg.AI_OUTNUMBERED_RATIO ?? CONST.BATTLE_AI.AI_OUTNUMBERED_RATIO));

  const localCounts = (unit) => {
    if (typeof getLocalCounts === 'function') return getLocalCounts(unit, radius);
    let allies = 0;
    let foes = 0;
    const r2 = radius * radius;
    let scanned = 0;
    for (const a of enemies) {
      if (!a || a.dead || a.hp <= 0) continue;
      const dx = (a.x || 0) - (unit.x || 0);
      const dy = (a.y || 0) - (unit.y || 0);
      if ((dx * dx + dy * dy) <= r2) allies += 1;
      scanned += 1;
      if (scanned >= MAX_LOCAL_SCAN) break;
    }
    scanned = 0;
    for (const p of players) {
      if (!p || p.dead || p.hp <= 0) continue;
      const dx = (p.x || 0) - (unit.x || 0);
      const dy = (p.y || 0) - (unit.y || 0);
      if ((dx * dx + dy * dy) <= r2) foes += 1;
      scanned += 1;
      if (scanned >= MAX_LOCAL_SCAN) break;
    }
    return { allies, foes };
  };

  for (const unit of enemies) {
    if (!unit || unit.dead || unit.hp <= 0) continue;

    const hpPct = (unit.hp || 1) / Math.max(1, unit.maxHp || 1);
    const morale = Number(unit.morale ?? 100);
    const lc = localCounts(unit);
    const overwhelmed = (lc.foes || 0) > Math.max(1, lc.allies || 0) * outnumberedRatio;
    if (morale < Number(cfg.AI_RETREAT_MORALE ?? CONST.BATTLE_AI.AI_RETREAT_MORALE)
      || hpPct < Number(cfg.AI_RETREAT_HP_PCT ?? CONST.BATTLE_AI.AI_RETREAT_HP_PCT)
      || overwhelmed) {
      unit.command = CONST.BATTLE_COMMANDS.RETREAT;
      unit.retreating = true;
      continue;
    }

    if (unit.isRanged) {
      unit.command = CONST.BATTLE_COMMANDS.SKIRMISH;
      unit.skirmish = true;
    }

    const curr = players.find((p) => p.unitId === unit.targetId && !p.dead && p.hp > 0);
    if (!curr || shouldRetarget) {
      const next = pickTarget(unit, players, { cfg });
      unit.targetId = next?.unitId || null;
      if (next && (unit.isCavalry || String(unit.class || '').includes('cav'))) {
        unit.approachPoint = computeFlankApproachPoint(unit, next, cfg);
      }
    }
  }
}

export default {
  scoreTarget,
  pickTarget,
  updateEnemyAI,
  computeFlankApproachPoint,
};
