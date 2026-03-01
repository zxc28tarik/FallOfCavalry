import assert from 'node:assert/strict';
import {
  inferUnitRole,
  getCounterEffect,
  computeChargeState,
  isBracedSpearman,
} from './battle-counters.js';

const cfg = {
  BATTLE_COUNTERS: {
    SPEAR_VS_CAV_DMG_MULT: 1.4,
    SPEAR_VS_CAV_MORALE_BONUS: 8,
    CAV_VS_ARCHER_DMG_MULT: 1.3,
    CAV_VS_ARCHER_MORALE_BONUS: 5,
    INFANTRY_VS_SPEAR_DMG_MULT: 1.05,
    COUNTER_BASE_MORALE_BONUS: 1,
  },
  BATTLE_CHARGE: {
    CHARGE_BUILD_PER_SEC: 30,
    CHARGE_READY_THRESHOLD: 60,
    CHARGE_DMG_MULT: 1.5,
    CHARGE_MORALE_BONUS: 7,
    CHARGE_COOLDOWN_SEC: 4,
    BRACE_CHARGE_REDUCTION_MULT: 0.5,
    BRACE_THORNS_DMG_FRACTION: 0.25,
  },
};

assert.equal(inferUnitRole({ isRanged: true, id: 'anything' }), 'archer');
assert.equal(inferUnitRole({ class: 'heavy_cav' }), 'cavalry');
assert.equal(inferUnitRole({ id: 'veteran_spearman' }), 'spearman');
assert.equal(inferUnitRole({ id: 'line_infantry' }), 'infantry');

const spearCounter = getCounterEffect({ attackerRole: 'spearman', defenderRole: 'cavalry', cfg });
assert.equal(spearCounter.dmgMult, 1.4);
assert.equal(spearCounter.moraleBonus, 9);

const cavCounter = getCounterEffect({ attackerRole: 'cavalry', defenderRole: 'archer', cfg });
assert.equal(cavCounter.dmgMult, 1.3);
assert.equal(cavCounter.moraleBonus, 6);

const cav = { role: 'cavalry', vx: 40, vy: 0, chargeMeter: 0, chargeReady: false, chargeCooldownRemaining: 0 };
computeChargeState({ unit: cav, dtSec: 1, cfg });
computeChargeState({ unit: cav, dtSec: 1, cfg });
assert.equal(cav.chargeReady, true);

cav.chargeMeter = 0;
cav.chargeReady = false;
cav.chargeCooldownRemaining = 2;
computeChargeState({ unit: cav, dtSec: 1, cfg });
assert.equal(cav.chargeMeter, 0);

cav.chargeCooldownRemaining = 0;
computeChargeState({ unit: cav, dtSec: 2, cfg });
assert.equal(cav.chargeReady, true);

assert.equal(isBracedSpearman({ role: 'spearman', command: 'hold', vx: 0.5, vy: 0.4, moraleState: 'steady' }), true);
assert.equal(isBracedSpearman({ role: 'spearman', command: 'focus', vx: 0, vy: 0 }), false);
assert.equal(isBracedSpearman({ role: 'cavalry', command: 'hold', vx: 0, vy: 0 }), false);

console.log('battle-counters smoke tests passed');
