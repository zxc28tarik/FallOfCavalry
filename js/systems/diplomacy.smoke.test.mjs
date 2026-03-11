import assert from 'node:assert/strict';
import { DIPLOMACY_ACTIONS, DIPLOMACY_RELATIONS } from '../constants.js';
import { ensureFactionState, getRelation, setRelation } from './factions.js';
import {
  buyTruce,
  improveRelations,
  declareWar,
  applyContractRelationBonus,
  applyTradeCaravanAttackPenalty,
} from './diplomacy.js';

function makeState() {
  return ensureFactionState({ relations: {} }, DIPLOMACY_RELATIONS);
}

(function testBuyTruce() {
  const factions = makeState();
  // Use setRelation API (relKey uses ':' separator, not '|').
  // Set well below WAR_THRESHOLD (-80) to ensure WAR stance.
  setRelation(factions, 'player', 'hre', -85, DIPLOMACY_RELATIONS);
  const party = { gold: 200 };
  const ok = buyTruce({ factions, targetFactionId: 'hre', party, cfg: DIPLOMACY_ACTIONS });
  assert.equal(ok, true);
  assert.equal(party.gold, 50);
  assert.ok(getRelation(factions, 'player', 'hre') > DIPLOMACY_RELATIONS.WAR_THRESHOLD);
})();

(function testImproveRelations() {
  const factions = makeState();
  setRelation(factions, 'player', 'ottoman', -20, DIPLOMACY_RELATIONS);
  const party = { gold: 120 };
  const ok = improveRelations({ factions, targetFactionId: 'ottoman', party, cfg: DIPLOMACY_ACTIONS });
  assert.equal(ok, true);
  assert.equal(party.gold, 40);
  assert.equal(getRelation(factions, 'player', 'ottoman', DIPLOMACY_RELATIONS), -5);
})();

(function testDeclareWar() {
  const factions = makeState();
  setRelation(factions, 'player', 'venice', 20, DIPLOMACY_RELATIONS);
  declareWar({ factions, targetFactionId: 'venice', cfg: DIPLOMACY_ACTIONS });
  assert.ok(getRelation(factions, 'player', 'venice', DIPLOMACY_RELATIONS) <= DIPLOMACY_RELATIONS.WAR_THRESHOLD);
})();

(function testContractBonus() {
  const factions = makeState();
  applyContractRelationBonus({ factions, contract: { factionId: 'polish' }, cfg: DIPLOMACY_ACTIONS });
  assert.equal(getRelation(factions, 'player', 'polish', DIPLOMACY_RELATIONS), DIPLOMACY_ACTIONS.CONTRACT_REWARD_RELATION_BONUS);
})();

(function testCaravanPenalty() {
  const factions = makeState();
  applyTradeCaravanAttackPenalty({ factions, caravanFactionId: 'spanish', cfg: DIPLOMACY_ACTIONS });
  assert.equal(getRelation(factions, 'player', 'spanish', DIPLOMACY_RELATIONS), DIPLOMACY_ACTIONS.KILLING_NEUTRAL_CARAVAN_PENALTY);
})();

console.log('diplomacy.smoke.test.mjs passed');
