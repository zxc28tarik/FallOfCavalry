import { hashStr, mulberry32 } from '../utils.js';

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createBattleRng({ worldSeed, encounterId, day }) {
  const seedKey = `${worldSeed ?? 0}|${encounterId ?? 'enc'}|${day ?? 1}|battle_rewards`;
  const baseRng = mulberry32(hashStr(seedKey));
  return {
    next() {
      return baseRng();
    },
    range(min, max) {
      const low = Math.min(min, max);
      const high = Math.max(min, max);
      return low + (baseRng() * (high - low));
    },
    roll(chance) {
      return baseRng() < clampNumber(Number(chance ?? 0), 0, 1);
    },
    int(min, maxInclusive) {
      const low = Math.ceil(Math.min(min, maxInclusive));
      const high = Math.floor(Math.max(min, maxInclusive));
      return Math.floor(this.range(low, high + 1));
    },
  };
}

export function computeEnemyPower({ battle }) {
  const enemyUnits = Array.isArray(battle?.enemyUnits) ? battle.enemyUnits : [];
  return enemyUnits.reduce((sum, enemy) => {
    const hpMax = Math.max(1, Number(enemy?.maxHp ?? enemy?.hpMax ?? enemy?.hp ?? 1));
    const attackPower = Math.max(1, Number(enemy?.atk ?? enemy?.attackPower ?? enemy?.rangedDamage ?? 1));
    return sum + (hpMax * 0.08) + (attackPower * 0.5);
  }, 0);
}

export function generateBattleLoot({ cfg, rng, enemyPower }) {
  const lootCfg = cfg || {};
  const minGold = Math.max(0, Number(lootCfg.LOOT_GOLD_MIN ?? 0));
  const maxGold = Math.max(minGold, Number(lootCfg.LOOT_GOLD_MAX ?? minGold));
  const powerScale = 1 + (Math.max(0, Number(enemyPower ?? 0)) / 120);
  const baseGold = minGold + rng.range(0, maxGold - minGold);
  const gold = Math.max(0, Math.floor(baseGold * powerScale));

  const items = [];
  if (rng.roll(Number(lootCfg.LOOT_ITEM_CHANCE ?? 0))) {
    const dropCount = rng.int(1, 2);
    const itemPool = ['food', 'arrows'];
    for (let i = 0; i < dropCount; i += 1) {
      const id = itemPool[rng.int(0, itemPool.length - 1)];
      const existing = items.find((entry) => entry.id === id);
      if (existing) existing.qty += 1;
      else items.push({ id, qty: 1 });
    }
  }

  return { gold, items };
}

export function computeRenownDelta({ cfg, enemyPower, casualtiesInfo, routingInfo }) {
  const rewardCfg = cfg || {};
  const deadCount = Math.max(0, Number(casualtiesInfo?.deadCount ?? 0));
  let delta = Number(rewardCfg.RENOWN_BASE ?? 0) + (Math.max(0, Number(enemyPower ?? 0)) * Number(rewardCfg.RENOWN_PER_ENEMY_POWER ?? 0));
  delta -= deadCount * Number(rewardCfg.RENOWN_CASUALTY_PENALTY ?? 0);
  if (routingInfo?.manyRouted) delta -= Number(rewardCfg.RENOWN_ROUTING_PENALTY ?? 0);
  return Math.max(0, Math.floor(delta));
}
