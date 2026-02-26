import test from 'node:test';
import assert from 'node:assert/strict';

import { ATTACK_SIDE, classifyAttackSide, resolveFlankBonuses } from './flank.js';

test('classifyAttackSide uses front/flank/rear thresholds', () => {
  const facing = 0;
  assert.equal(classifyAttackSide(facing, { x: 1, y: 0 }), ATTACK_SIDE.FRONT);
  assert.equal(classifyAttackSide(facing, { x: 0, y: 1 }), ATTACK_SIDE.FLANK);
  assert.equal(classifyAttackSide(facing, { x: -1, y: 0 }), ATTACK_SIDE.REAR);
});

test('resolveFlankBonuses picks proper multipliers', () => {
  const tuning = { FLANK_MULT: 1.2, REAR_MULT: 1.4, FLANK_MORALE_BONUS: 5, REAR_MORALE_BONUS: 9 };
  assert.deepEqual(resolveFlankBonuses(ATTACK_SIDE.FRONT, tuning), { damageMult: 1, moraleBonus: 0 });
  assert.deepEqual(resolveFlankBonuses(ATTACK_SIDE.FLANK, tuning), { damageMult: 1.2, moraleBonus: 5 });
  assert.deepEqual(resolveFlankBonuses(ATTACK_SIDE.REAR, tuning), { damageMult: 1.4, moraleBonus: 9 });
});
