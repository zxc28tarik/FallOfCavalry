import assert from 'node:assert/strict';
import * as CONST from '../constants.js';
import {
  clampToBattleBounds,
  scoreTarget,
  updateEnemyAI,
  computeSkirmishKiteStep,
} from './battle-ai.js';

const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

{
  const clamped = clampToBattleBounds({ x: -10, y: 120 }, bounds, 10);
  assert.equal(clamped.x, 10);
  assert.equal(clamped.y, 90);
}

{
  const attacker = { x: 0, y: 0, class: 'infantry' };
  const farHealthy = { x: 500, y: 0, hp: 100, maxHp: 100, moraleState: 'steady' };
  const nearRouting = { x: 80, y: 0, hp: 20, maxHp: 100, moraleState: 'routing' };
  assert.ok(scoreTarget(attacker, nearRouting, { cfg: CONST.BATTLE_AI }) > scoreTarget(attacker, farHealthy, { cfg: CONST.BATTLE_AI }));
}

{
  const battle = {
    timeSec: 10,
    enemyUnits: [{ unitId: 'e1', side: 'enemy', x: 10, y: 10, hp: 10, maxHp: 100, morale: 10, class: 'infantry' }],
    playerUnits: [{ unitId: 'p1', side: 'player', x: 30, y: 10, hp: 100, maxHp: 100, morale: 100, class: 'infantry' }],
  };
  updateEnemyAI({ battle, dtMs: 100, cfg: CONST.BATTLE_AI, bounds });
  assert.equal(battle.enemyUnits[0].command, CONST.BATTLE_COMMANDS.RETREAT);
}

{
  const unit = { x: 20, y: 20 };
  const target = { x: 22, y: 20 };
  const res = computeSkirmishKiteStep(unit, target, 100, 0.1, bounds, CONST.BATTLE_AI);
  const d0 = Math.hypot(target.x - unit.x, target.y - unit.y);
  const d1 = Math.hypot(target.x - res.x, target.y - res.y);
  assert.ok(d1 > d0);
}

{
  const cfg = { ...CONST.BATTLE_AI, AI_MAX_APPROACH_TIME_SEC: 9, AI_STALL_WINDOW_SEC: 0.2, AI_STALL_MIN_PROGRESS_PX: 1000, AI_STALL_ABORT_SEC: 0.3 };
  const cav = { unitId: 'ecav', side: 'enemy', x: 10, y: 10, hp: 100, maxHp: 100, morale: 100, class: 'cavalry', aiApproachPoint: { x: 90, y: 90 }, aiApproachSetAtSec: 0, aiLastApproachDist: 113, aiApproachLastCheckAtSec: 0, aiStallSec: 0 };
  const battle = { timeSec: 0.25, enemyUnits: [cav], playerUnits: [{ unitId: 'p1', side: 'player', x: 80, y: 80, hp: 100, maxHp: 100, morale: 100, class: 'infantry' }] };
  updateEnemyAI({ battle, dtMs: 250, cfg, bounds });
  battle.timeSec = 0.6;
  updateEnemyAI({ battle, dtMs: 350, cfg, bounds });
  assert.equal(cav.aiApproachPoint, null);
}

console.log('battle-ai smoke tests passed');
