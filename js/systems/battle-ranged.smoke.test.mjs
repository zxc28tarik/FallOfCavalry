import assert from 'node:assert/strict';
import {
  initBattleAmmoFromParty,
  consumeAmmo,
  canUnitFireRanged,
  tickSuppression,
} from './battle-ranged.js';

const cfg = {
  SUPPRESS_DURATION_SEC: 2,
  SUPPRESS_SPEED_MULT: 0.6,
  SUPPRESS_MORALE_DRAIN_PER_SEC: 7,
  MELEE_EMERGENCY_RANGE_MULT: 0.2,
  AMMO_PER_SHOT: 1,
};

{
  const party = { inventory: { items: [{ id: 'arrows', qty: 25 }] } };
  const ammo = initBattleAmmoFromParty({ party, cfg });
  assert.equal(ammo.startAmmo, 25);
  assert.equal(ammo.ammo, 25);
}

{
  const battle = { playerAmmo: 2 };
  assert.equal(consumeAmmo({ battle, side: 'player', amount: 1 }), true);
  assert.equal(battle.playerAmmo, 1);
  assert.equal(consumeAmmo({ battle, side: 'player', amount: 3 }), false);
  assert.equal(battle.playerAmmo, 1);
}

{
  const melee = { isRanged: false, side: 'player', attackRange: 100, meleeRange: 10 };
  assert.equal(canUnitFireRanged(melee, { playerAmmo: 5 }, cfg, 90), false);

  const holdFire = { isRanged: true, holdFire: true, side: 'player', attackRange: 100, meleeRange: 10 };
  assert.equal(canUnitFireRanged(holdFire, { playerAmmo: 5 }, cfg, 90), false);

  const noAmmo = { isRanged: true, holdFire: false, side: 'player', attackRange: 100, meleeRange: 10 };
  assert.equal(canUnitFireRanged(noAmmo, { playerAmmo: 0 }, cfg, 90), false);

  const tooClose = { isRanged: true, holdFire: false, side: 'player', attackRange: 100, meleeRange: 15 };
  assert.equal(canUnitFireRanged(tooClose, { playerAmmo: 5 }, cfg, 10), false);
}

{
  const unit = { morale: 50, suppressedUntil: 10 };
  tickSuppression({ unit, dtMs: 1000, battleTimeSec: 9, cfg });
  assert.equal(unit.morale, 43);
}

console.log('battle-ranged smoke test passed');
