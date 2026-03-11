import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import {
  createBattleRng,
  computeEnemyPower,
  generateBattleLoot,
  computeRenownDelta,
} from '../../js/systems/battle-rewards.js';

const cfg = {
  LOOT_GOLD_MIN: 10,
  LOOT_GOLD_MAX: 60,
  LOOT_ITEM_CHANCE: 0.3,
  RENOWN_BASE: 5,
  RENOWN_PER_ENEMY_POWER: 0.5,
  RENOWN_CASUALTY_PENALTY: 2,
  RENOWN_ROUTING_PENALTY: 2,
};

describe('battle-rewards', () => {
  it('block 1', () => {
    const battle = {
      enemyUnits: [
        { hpMax: 100, attackPower: 12 },
        { hpMax: 120, attackPower: 15 },
      ],
    };
    const enemyPower = computeEnemyPower({ battle });

    const sameRngA = createBattleRng({ worldSeed: 111, encounterId: 'encA', day: 3 });
    const sameRngB = createBattleRng({ worldSeed: 111, encounterId: 'encA', day: 3 });
    const sameLootA = generateBattleLoot({ cfg, rng: sameRngA, enemyPower });
    const sameLootB = generateBattleLoot({ cfg, rng: sameRngB, enemyPower });
    assert.deepEqual(sameLootA, sameLootB, 'same seed params should produce same loot');

    const diffRng = createBattleRng({ worldSeed: 999, encounterId: 'encB', day: 3 });
    const diffLoot = generateBattleLoot({ cfg, rng: diffRng, enemyPower });
    assert.notDeepEqual(diffLoot, sameLootA, 'different seed/encounter should tend to differ');

    let lowSum = 0;
    let highSum = 0;
    for (let i = 0; i < 80; i += 1) {
      const lowRng = createBattleRng({ worldSeed: 50 + i, encounterId: `low-${i}`, day: 2 });
      const highRng = createBattleRng({ worldSeed: 50 + i, encounterId: `high-${i}`, day: 2 });
      lowSum += generateBattleLoot({ cfg, rng: lowRng, enemyPower: 25 }).gold;
      highSum += generateBattleLoot({ cfg, rng: highRng, enemyPower: 220 }).gold;
    }
    assert.ok(highSum > lowSum, 'higher enemy power should produce higher average gold');

    const renownLowCasualty = computeRenownDelta({
      cfg,
      enemyPower: 80,
      casualtiesInfo: { deadCount: 1 },
      routingInfo: { manyRouted: false },
    });
    const renownHighCasualty = computeRenownDelta({
      cfg,
      enemyPower: 80,
      casualtiesInfo: { deadCount: 5 },
      routingInfo: { manyRouted: false },
    });
    assert.ok(renownHighCasualty < renownLowCasualty, 'more casualties should lower renown delta');

    const renownNoRoute = computeRenownDelta({
      cfg,
      enemyPower: 100,
      casualtiesInfo: { deadCount: 0 },
      routingInfo: { manyRouted: false },
    });
    const renownRoute = computeRenownDelta({
      cfg,
      enemyPower: 100,
      casualtiesInfo: { deadCount: 0 },
      routingInfo: { manyRouted: true },
    });
    assert.equal(renownNoRoute - renownRoute, cfg.RENOWN_ROUTING_PENALTY, 'routing penalty should be applied');
  });
});
