import test from 'node:test';
import assert from 'node:assert/strict';

import {
  inferUnitRole,
  getCounterEffect,
  computeChargeState,
  isBracedSpearman,
} from './battle-counters.js';

test('inferUnitRole classifies ranged/cav/spear/default', () => {
  assert.equal(inferUnitRole({ id: 'arch_1', isRanged: true }), 'archer');
  assert.equal(inferUnitRole({ id: 'light_cav_raider', class: 'infantry' }), 'cavalry');
  assert.equal(inferUnitRole({ id: 'town_guard', class: 'spearman' }), 'spearman');
  assert.equal(inferUnitRole({ id: 'militia', class: 'infantry' }), 'infantry');
});

test('getCounterEffect applies configured matchup multipliers', () => {
  const cfg = {
    SPEAR_VS_CAV_MULT: 1.4,
    CAV_VS_ARCHER_MULT: 1.3,
    INF_VS_SPEAR_MULT: 1.1,
    COUNTER_MORALE_BONUS: 7,
    CHARGE_DMG_MULT: 1.6,
    CHARGE_MORALE_SHOCK: 10,
  };
  assert.deepEqual(getCounterEffect({ attackerRole: 'spearman', defenderRole: 'cavalry', cfg }), { dmgMult: 1.4, moraleBonus: 7 });
  assert.deepEqual(getCounterEffect({ attackerRole: 'cavalry', defenderRole: 'archer', cfg, isChargeHit: true }), { dmgMult: 2.08, moraleBonus: 17 });
});

test('computeChargeState builds ready charge and respects cooldown', () => {
  const cfg = {
    CHARGE_MOVE_SPEED_THRESHOLD: 20,
    CHARGE_BUILD_PER_SEC: 1,
    CHARGE_DECAY_PER_SEC: 0.5,
    CHARGE_READY_THRESHOLD: 1,
  };
  const unit = { role: 'cavalry', vx: 30, vy: 0, chargeMeter: 0, chargeCooldown: 0 };
  computeChargeState({ unit, dt: 1, cfg });
  assert.equal(unit.chargeReady, true);
  unit.chargeCooldown = 2;
  computeChargeState({ unit, dt: 0.5, cfg });
  assert.equal(unit.chargeReady, false);
});

test('isBracedSpearman requires HOLD command and low speed', () => {
  const cfg = { BRACE_SPEED_MAX: 6 };
  assert.equal(isBracedSpearman({ role: 'spearman', command: 'hold', vx: 1, vy: 1 }, cfg), true);
  assert.equal(isBracedSpearman({ role: 'spearman', command: 'focus', vx: 0, vy: 0 }, cfg), false);
  assert.equal(isBracedSpearman({ role: 'cavalry', command: 'hold', vx: 0, vy: 0 }, cfg), false);
});
