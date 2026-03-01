import { applyBattleOutcomes, tickHealing } from './casualties.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(function testApplyBattleOutcomes() {
  const party = {
    roster: [
      { id: 'u1', name: 'Dead One', hp: 100, maxHp: 100, status: 'healthy', healProgress: 0 },
      { id: 'u2', name: 'Wounded One', hp: 100, maxHp: 100, status: 'healthy', healProgress: 0 },
    ],
  };
  const battle = {
    playerUnits: [
      { rosterId: 'u1', hp: 0, hpMax: 100, moraleState: 'steady' },
      { rosterId: 'u2', hp: 20, hpMax: 100, moraleState: 'routing' },
    ],
  };
  applyBattleOutcomes({
    battle,
    party,
    cfg: {
      WOUNDED_HP_THRESHOLD_PCT: 0.35,
      WOUNDED_BASE_CHANCE: 0.4,
      WOUNDED_ROUTE_BONUS_CHANCE: 0.2,
    },
    rng: () => 0.1,
  });
  assert(party.roster.length === 1, 'dead unit should be removed from roster');
  assert(party.roster[0].id === 'u2', 'survivor should remain');
  assert(party.roster[0].status === 'wounded', 'low hp routed unit should become wounded');
})();

(function testTickHealing() {
  const party = {
    roster: [
      { id: 'u3', status: 'wounded', healProgress: 0.8 },
    ],
  };
  tickHealing({
    party,
    cfg: { HEAL_PER_DAY: 0.2, HEAL_CAMP_MULT: 1.5, HEAL_STARVING_MULT: 0.3 },
    isCamp: true,
    isStarving: false,
  });
  assert(party.roster[0].status === 'healthy', 'unit should recover at progress >= 1');
  assert(party.roster[0].healProgress === 0, 'heal progress should reset on recovery');
})();

console.log('casualties.smoke.test: OK');
