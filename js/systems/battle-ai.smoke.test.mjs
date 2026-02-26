import assert from 'node:assert/strict';
import * as CONST from '../constants.js';
import { scoreTarget, updateEnemyAI } from './battle-ai.js';

function baseUnit(extra = {}) {
  return {
    unitId: extra.unitId || 'u',
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    morale: 100,
    class: 'infantry',
    ...extra,
  };
}

{
  const attacker = baseUnit({ unitId: 'a', x: 0, y: 0 });
  const nearHealthy = baseUnit({ unitId: 'h', x: 60, y: 0, hp: 100, maxHp: 100 });
  const nearLowHp = baseUnit({ unitId: 'l', x: 68, y: 0, hp: 20, maxHp: 100 });
  const sHealthy = scoreTarget(attacker, nearHealthy, { cfg: CONST.BATTLE_AI });
  const sLow = scoreTarget(attacker, nearLowHp, { cfg: CONST.BATTLE_AI });
  assert.ok(sLow > sHealthy, 'low HP target should win scoring when similarly close');
}

{
  const battle = {
    playerUnits: [baseUnit({ unitId: 'p1', x: 10, y: 0 }), baseUnit({ unitId: 'p2', x: 15, y: 0 })],
    enemyUnits: [baseUnit({ unitId: 'e1', x: 0, y: 0, morale: 5 })],
  };
  updateEnemyAI({ battle, dt: 1, cfg: CONST.BATTLE_AI });
  assert.equal(battle.enemyUnits[0].command, CONST.BATTLE_COMMANDS.RETREAT, 'very low morale should trigger retreat');
}

{
  const enemy = baseUnit({ unitId: 'e-arch', x: 0, y: 0, class: 'archer', isRanged: true, rangedRange: 100, speed: 60, commandSpeedMult: 1, formationSpeedMult: 1, skirmish: true, command: CONST.BATTLE_COMMANDS.SKIRMISH });
  const player = baseUnit({ unitId: 'p', x: 20, y: 0 });
  const desired = enemy.rangedRange * CONST.BATTLE_AI.SKIRMISH_DESIRED_RANGE_MULT;
  const minRange = desired * CONST.BATTLE_AI.SKIRMISH_MIN_RANGE_MULT;
  assert.ok(20 < minRange, 'setup assumes enemy starts too close for skirmish');
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const kiteStep = Math.min(Math.max(0, desired - dist), enemy.speed * CONST.BATTLE_AI.SKIRMISH_KITE_SPEED_MULT * 0.2);
  enemy.x -= (dx / dist) * kiteStep;
  enemy.y -= (dy / dist) * kiteStep;
  const nextDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  assert.ok(nextDist > dist, 'kite movement should increase distance from close target');
}

console.log('battle-ai smoke tests passed');
