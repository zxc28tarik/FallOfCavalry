import test from 'node:test';
import assert from 'node:assert/strict';

import {
  initBattleAmmoFromParty,
  consumeAmmo,
  shouldUseMeleeFallback,
  applySuppressionOnHit,
} from './battle-ranged.js';

test('initBattleAmmoFromParty reads arrows from inventory', () => {
  const out = initBattleAmmoFromParty({
    party: { inventory: { items: [{ id: 'grain', qty: 4 }, { id: 'arrows', qty: 13 }] } },
  });
  assert.deepEqual(out, { startAmmo: 13, ammo: 13 });
});

test('consumeAmmo decrements and blocks at zero', () => {
  const battle = { playerAmmo: 2 };
  assert.equal(consumeAmmo({ battle, side: 'player', amount: 1 }), true);
  assert.equal(battle.playerAmmo, 1);
  assert.equal(consumeAmmo({ battle, side: 'player', amount: 2 }), false);
  assert.equal(battle.playerAmmo, 1);
});

test('suppression helper and fallback math are sane', () => {
  const target = {};
  applySuppressionOnHit({
    attacker: { isRanged: true },
    target,
    battleTimeSec: 12,
    cfg: { SUPPRESS_DURATION_SEC: 1.5 },
  });
  assert.equal(target.suppressedUntil, 13.5);

  const fallbackNoAmmo = shouldUseMeleeFallback({
    unit: { isRanged: true, side: 'player', rangedRange: 200 },
    dist: 150,
    battle: { playerAmmo: 0 },
    cfg: { MELEE_EMERGENCY_RANGE_MULT: 0.35, AMMO_PER_SHOT: 1 },
  });
  assert.equal(fallbackNoAmmo, true);

  const fallbackEmergencyRange = shouldUseMeleeFallback({
    unit: { isRanged: true, side: 'player', rangedRange: 200 },
    dist: 60,
    battle: { playerAmmo: 99 },
    cfg: { MELEE_EMERGENCY_RANGE_MULT: 0.35, AMMO_PER_SHOT: 1 },
  });
  assert.equal(fallbackEmergencyRange, true);
});
