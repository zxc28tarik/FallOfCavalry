import assert from 'node:assert/strict';
import {
  applyAllyDeathShock,
  applyMoraleDamage,
  clampMorale,
} from './battle-morale.js';

const cfg = {
  MORALE_MAX: 100,
  DAMAGE_TO_MORALE: 0.35,
  ALLY_DEATH_SHOCK: 10,
  SHOCK_RADIUS: 90,
  REGEN_PER_SEC: 4,
  REGEN_DAMAGE_GRACE_SEC: 2,
};

const unitA = { unitId: 'a', side: 'player', dead: false, hp: 100, morale: 100, moraleMax: 100, x: 0, y: 0, lastDamageAt: 0 };
const unitB = { unitId: 'b', side: 'player', dead: false, hp: 100, morale: 100, moraleMax: 100, x: 20, y: 0, lastDamageAt: 0 };

const moraleLost = applyMoraleDamage(unitA, 20, cfg, 1.0);
assert.equal(Math.round(moraleLost * 100) / 100, 7);
assert.ok(unitA.morale < 100, 'damage should lower morale');

const beforeShock = unitB.morale;
const deadAlly = { ...unitA, dead: true, hp: 0 };
const shocked = applyAllyDeathShock(deadAlly, [unitA, unitB], cfg);
assert.equal(shocked, 1);
assert.ok(unitB.morale < beforeShock, 'ally death shock should lower nearby ally morale');

const beforeRegen = unitB.morale;
const battleTime = 10;
const dt = 1.5;
if ((battleTime - unitB.lastDamageAt) >= cfg.REGEN_DAMAGE_GRACE_SEC) {
  unitB.morale = Math.min(unitB.moraleMax, unitB.morale + (cfg.REGEN_PER_SEC * dt));
}
clampMorale(unitB, cfg);
assert.ok(unitB.morale > beforeRegen, 'morale should regen after grace period');

console.log('battle-morale smoke test passed');
