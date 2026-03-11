import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  clampToBattleBounds,
  scoreTarget,
  updateEnemyAI,
  computeSkirmishKiteStep,
  shouldUnitRetreat,
} from '../../js/systems/battle-ai.js';

const bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

describe('battle-ai', () => {
  it('block 1', () => {
    const clamped = clampToBattleBounds({ x: -10, y: 120 }, bounds, 10);
    assert.equal(clamped.x, 10);
    assert.equal(clamped.y, 90);
  });

  it('block 2', () => {
    const attacker = { x: 0, y: 0, class: 'infantry' };
    const farHealthy = { x: 500, y: 0, hp: 100, maxHp: 100, moraleState: 'steady' };
    const nearRouting = { x: 80, y: 0, hp: 20, maxHp: 100, moraleState: 'routing' };
    assert.ok(scoreTarget(attacker, nearRouting, { cfg: CONST.BATTLE_AI }) > scoreTarget(attacker, farHealthy, { cfg: CONST.BATTLE_AI }));
  });

  it('block 3', () => {
    const battle = {
      timeSec: 10,
      enemyUnits: [{ unitId: 'e1', side: 'enemy', x: 10, y: 10, hp: 10, maxHp: 100, morale: 10, class: 'infantry' }],
      playerUnits: [{ unitId: 'p1', side: 'player', x: 30, y: 10, hp: 100, maxHp: 100, morale: 100, class: 'infantry' }],
    };
    updateEnemyAI({ battle, dtMs: 100, cfg: CONST.BATTLE_AI, bounds });
    assert.equal(battle.enemyUnits[0].command, CONST.BATTLE_COMMANDS.RETREAT);
  });

  it('block 4', () => {
    const unit = { x: 20, y: 20 };
    const target = { x: 22, y: 20 };
    const res = computeSkirmishKiteStep(unit, target, 100, 0.1, bounds, CONST.BATTLE_AI);
    const d0 = Math.hypot(target.x - unit.x, target.y - unit.y);
    const d1 = Math.hypot(target.x - res.x, target.y - res.y);
    assert.ok(d1 > d0);
  });

  it('block 5', () => {
    const cfg = { ...CONST.BATTLE_AI, AI_MAX_APPROACH_TIME_SEC: 9, AI_STALL_WINDOW_SEC: 0.2, AI_STALL_MIN_PROGRESS_PX: 1000, AI_STALL_ABORT_SEC: 0.3 };
    const cav = { unitId: 'ecav', side: 'enemy', x: 10, y: 10, hp: 100, maxHp: 100, morale: 100, class: 'cavalry', aiApproachPoint: { x: 90, y: 90 }, aiApproachSetAtSec: 0, aiLastApproachDist: 113, aiApproachLastCheckAtSec: 0, aiStallSec: 0 };
    const battle = { timeSec: 0.25, enemyUnits: [cav], playerUnits: [{ unitId: 'p1', side: 'player', x: 80, y: 80, hp: 100, maxHp: 100, morale: 100, class: 'infantry' }] };
    updateEnemyAI({ battle, dtMs: 250, cfg, bounds });
    battle.timeSec = 0.6;
    updateEnemyAI({ battle, dtMs: 350, cfg, bounds });
    assert.equal(cav.aiApproachPoint, null);
  });

  it('block 6', () => {
    const archer = { x: 0, y: 0, role: 'archer', class: 'archer' };
    const highValue = { unitId: 'hv', x: 140, y: 0, hp: 100, maxHp: 100, moraleState: 'steady', isHighValueTarget: true, lineRole: 'reserve' };
    const normal = { unitId: 'n', x: 120, y: 0, hp: 100, maxHp: 100, moraleState: 'steady', isHighValueTarget: false, lineRole: 'frontline' };
    assert.ok(scoreTarget(archer, highValue, { cfg: CONST.BATTLE_AI }) > scoreTarget(archer, normal, { cfg: CONST.BATTLE_AI }));
  });

  it('block 7', () => {
    const elite = { x: 0, y: 0, role: 'elite_cav', class: 'elite_cav' };
    const flankHighValue = { unitId: 'f', x: 40, y: 5, hp: 100, maxHp: 100, moraleState: 'steady', isHighValueTarget: true, facing: Math.PI / 2, lineRole: 'reserve' };
    const basicFrontline = { unitId: 'b', x: 40, y: 40, hp: 100, maxHp: 100, moraleState: 'steady', isHighValueTarget: false, facing: 0, lineRole: 'frontline' };
    assert.ok(scoreTarget(elite, flankHighValue, { cfg: CONST.BATTLE_AI }) > scoreTarget(elite, basicFrontline, { cfg: CONST.BATTLE_AI }));
  });

  it('block 8', () => {
    const cfg = CONST.BATTLE_AI;
    const heavy = { role: 'heavy_inf', hp: 25, maxHp: 100, morale: 22 };
    const infantry = { role: 'infantry', hp: 25, maxHp: 100, morale: 22 };
    assert.equal(shouldUnitRetreat(heavy, { allyCount: 2, enemyCount: 2, cfg }), false);
    assert.equal(shouldUnitRetreat(infantry, { allyCount: 2, enemyCount: 2, cfg }), true);
  });

  it('block 9', () => {
    const battle = {
      timeSec: 0,
      enemyUnits: [{ unitId: 'elite-1', side: 'enemy', x: 20, y: 20, hp: 120, maxHp: 120, morale: 90, class: 'elite_cav', role: 'elite_cav', lineRole: 'flanker' }],
      playerUnits: [{ unitId: 'p-heavy', side: 'player', x: 80, y: 30, hp: 130, maxHp: 130, morale: 90, class: 'heavy_inf', role: 'heavy_inf', lineRole: 'frontline', isHighValueTarget: true }],
    };
    updateEnemyAI({ battle, dtMs: 100, cfg: CONST.BATTLE_AI, bounds });
    assert.ok(battle.enemyUnits[0].aiApproachPoint);
  });
});
