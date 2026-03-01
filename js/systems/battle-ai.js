import * as CONST from '../constants.js';
import { applyCommandEffects } from './combat-rules.js';
import { classifyAttackSide, getAttackDirectionAgainstDefender, ATTACK_SIDE } from './flank.js';

const dist = (a, b) => Math.hypot((b.x || 0) - (a.x || 0), (b.y || 0) - (a.y || 0));
const hpPct = (unit) => {
  const maxHp = Math.max(1, Number(unit?.maxHp ?? 1));
  return Math.max(0, Number(unit?.hp ?? 0)) / maxHp;
};

export function clampToBattleBounds(point, bounds, pad = 0) {
  const xMin = Number(bounds?.xMin ?? 0) + Number(pad || 0);
  const xMax = Number(bounds?.xMax ?? 0) - Number(pad || 0);
  const yMin = Number(bounds?.yMin ?? 0) + Number(pad || 0);
  const yMax = Number(bounds?.yMax ?? 0) - Number(pad || 0);
  return {
    x: Math.max(Math.min(Number(point?.x ?? xMin), xMax), xMin),
    y: Math.max(Math.min(Number(point?.y ?? yMin), yMax), yMin),
  };
}

function isCavalry(unit) {
  const role = String(unit?.role || unit?.class || '').toLowerCase();
  return role.includes('cav') || role === 'cavalry';
}

export function scoreTarget(attacker, target, ctx = {}) {
  if (!attacker || !target || target.dead || target.hp <= 0) return -Infinity;
  const cfg = ctx.cfg || CONST.BATTLE_AI;
  const d = dist(attacker, target);
  let score = Math.max(0, 1200 - d);
  score += (1 - hpPct(target)) * 500 * Number(cfg.AI_TARGET_LOWHP_WEIGHT ?? 0.5);
  if (target.moraleState === 'routing' || target.moraleState === 'shaken') {
    score += Number(cfg.AI_TARGET_ROUTING_BONUS ?? 120);
  }
  if (isCavalry(attacker)) {
    const attackDir = getAttackDirectionAgainstDefender(attacker, target);
    const side = classifyAttackSide(Number(target.facing || 0), attackDir);
    if (side === ATTACK_SIDE.REAR) score += 160;
    else if (side === ATTACK_SIDE.FLANK_LEFT || side === ATTACK_SIDE.FLANK_RIGHT) score += 90;
  }
  return score;
}

export function pickTarget(attacker, enemies, ctx = {}) {
  let best = null;
  let bestScore = -Infinity;
  for (const enemy of enemies || []) {
    const score = scoreTarget(attacker, enemy, ctx);
    if (score > bestScore) {
      best = enemy;
      bestScore = score;
    }
  }
  return best;
}

export function computeFlankApproachPoint(attacker, target, bounds, cfg = CONST.BATTLE_AI) {
  const dx = (attacker?.x || 0) - (target?.x || 0);
  const dy = (attacker?.y || 0) - (target?.y || 0);
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const perpX = -ny;
  const perpY = nx;
  const side = ((attacker?.unitId?.length || 0) % 2 === 0) ? 1 : -1;
  const offset = Math.max(30, Math.min(90, len * 0.45));
  const forward = Math.max(24, Math.min(80, len * 0.25));
  const raw = {
    x: (target?.x || 0) + (perpX * offset * side) - (nx * forward),
    y: (target?.y || 0) + (perpY * offset * side) - (ny * forward),
  };
  return clampToBattleBounds(raw, bounds, Number(cfg.AI_BOUNDS_PAD_PX ?? 0));
}

function countLocalUnits(unit, units, radius) {
  const r2 = radius * radius;
  let count = 0;
  for (const other of units || []) {
    if (!other || other.dead || other.hp <= 0 || other.unitId === unit.unitId) continue;
    const dx = (other.x || 0) - (unit.x || 0);
    const dy = (other.y || 0) - (unit.y || 0);
    if ((dx * dx) + (dy * dy) <= r2) count += 1;
  }
  return count;
}

export function computeSkirmishKiteStep(unit, target, speedPerSec, dtSec, bounds, cfg = CONST.BATTLE_AI) {
  if (!unit || !target) return { x: unit?.x || 0, y: unit?.y || 0, movedAway: false, hitBounds: false };
  const dx = (target.x || 0) - (unit.x || 0);
  const dy = (target.y || 0) - (unit.y || 0);
  const d = Math.hypot(dx, dy) || 1;
  const base = Math.max(0, speedPerSec) * Math.max(0, dtSec);
  const step = base * Number(cfg.SKIRMISH_KITE_SPEED_MULT ?? 1);
  const raw = { x: (unit.x || 0) - (dx / d) * step, y: (unit.y || 0) - (dy / d) * step };
  const clamped = clampToBattleBounds(raw, bounds, Number(cfg.AI_BOUNDS_PAD_PX ?? 0));
  const movedAway = dist(clamped, target) > dist(unit, target);
  const hitBounds = Math.abs(clamped.x - raw.x) > 0.001 || Math.abs(clamped.y - raw.y) > 0.001;
  return { ...clamped, movedAway, hitBounds };
}

export function updateEnemyAI({ battle, dtMs, cfg = CONST.BATTLE_AI, bounds } = {}) {
  if (!battle) return;
  const dtSec = Math.max(0, Number(dtMs || 0) / 1000);
  const nowSec = Number(battle.timeSec || 0);
  const enemies = (battle.enemyUnits || []).filter((u) => !u.dead && u.hp > 0);
  const players = (battle.playerUnits || []).filter((u) => !u.dead && u.hp > 0);

  for (const unit of enemies) {
    if (!unit) continue;

    if (unit.aiApproachPoint) {
      unit.aiApproachPoint = clampToBattleBounds(unit.aiApproachPoint, bounds, Number(cfg.AI_BOUNDS_PAD_PX ?? 0));
      const approachDist = dist(unit, unit.aiApproachPoint);
      const elapsed = nowSec - Number(unit.aiApproachSetAtSec ?? nowSec);
      if (elapsed > Number(cfg.AI_MAX_APPROACH_TIME_SEC ?? 4)) {
        unit.aiApproachPoint = null;
      } else {
        const window = Number(cfg.AI_STALL_WINDOW_SEC ?? 0.5);
        if (!Number.isFinite(unit.aiApproachLastCheckAtSec) || (nowSec - unit.aiApproachLastCheckAtSec) >= window) {
          const lastDist = Number.isFinite(unit.aiLastApproachDist) ? unit.aiLastApproachDist : approachDist;
          const progress = lastDist - approachDist;
          if (progress < Number(cfg.AI_STALL_MIN_PROGRESS_PX ?? 8)) unit.aiStallSec = Number(unit.aiStallSec || 0) + (nowSec - Number(unit.aiApproachLastCheckAtSec ?? nowSec));
          else unit.aiStallSec = 0;
          unit.aiLastApproachDist = approachDist;
          unit.aiApproachLastCheckAtSec = nowSec;
        }
        if (Number(unit.aiStallSec || 0) > Number(cfg.AI_STALL_ABORT_SEC ?? 1.8)) {
          unit.aiApproachPoint = null;
        }
      }
    }

    const localRadius = Number(cfg.AI_LOCAL_RADIUS ?? 200);
    const allyCount = countLocalUnits(unit, enemies, localRadius);
    const enemyCount = countLocalUnits(unit, players, localRadius);
    const outnumberedRatio = enemyCount / Math.max(1, allyCount);

    if (Number(unit.morale ?? 100) < Number(cfg.AI_RETREAT_MORALE ?? 25)
      || hpPct(unit) < Number(cfg.AI_RETREAT_HP_PCT ?? 0.2)
      || outnumberedRatio >= Number(cfg.AI_OUTNUMBERED_RATIO ?? 1.5)) {
      applyCommandEffects(unit, CONST.BATTLE_COMMANDS.RETREAT);
      continue;
    }

    if (!Number.isFinite(unit.aiNextRetargetAtSec) || nowSec >= unit.aiNextRetargetAtSec) {
      unit.aiNextRetargetAtSec = nowSec + Number(cfg.AI_RETARGET_SEC ?? 1.2);
      const target = pickTarget(unit, players, { cfg });
      if (!target) continue;
      unit.targetId = target.unitId;
      unit.focusTargetId = target.unitId;

      if (unit.isRanged) {
        applyCommandEffects(unit, CONST.BATTLE_COMMANDS.SKIRMISH);
      } else if (isCavalry(unit)) {
        applyCommandEffects(unit, CONST.BATTLE_COMMANDS.FOCUS);
        unit.aiApproachPoint = computeFlankApproachPoint(unit, target, bounds, cfg);
        unit.aiApproachSetAtSec = nowSec;
        unit.aiLastApproachDist = dist(unit, unit.aiApproachPoint);
        unit.aiApproachLastCheckAtSec = nowSec;
        unit.aiStallSec = 0;
      } else {
        applyCommandEffects(unit, CONST.BATTLE_COMMANDS.FOCUS);
      }
    }

    unit.aiTickDtSec = dtSec;
  }
}

export default {
  clampToBattleBounds,
  scoreTarget,
  pickTarget,
  computeFlankApproachPoint,
  computeSkirmishKiteStep,
  updateEnemyAI,
};
