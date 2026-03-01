import assert from 'node:assert/strict';
import { DIPLOMACY_ACTIONS, DIPLOMACY_RELATIONS } from '../constants.js';
import { ensureFactionState, getRelation } from './factions.js';
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
  factions.relations['hre|player'] = -60;
  const party = { gold: 200 };
  const ok = buyTruce({ factions, targetFactionId: 'hre', party, cfg: DIPLOMACY_ACTIONS });
  assert.equal(ok, true);
  assert.equal(party.gold, 50);
  assert.ok(getRelation(factions, 'player', 'hre', DIPLOMACY_RELATIONS) > DIPLOMACY_RELATIONS.WAR_THRESHOLD);
})();

(function testImproveRelations() {
  const factions = makeState();
  factions.relations['ottoman|player'] = -20;
  const party = { gold: 120 };
  const ok = improveRelations({ factions, targetFactionId: 'ottoman', party, cfg: DIPLOMACY_ACTIONS });
  assert.equal(ok, true);
  assert.equal(party.gold, 40);
  assert.equal(getRelation(factions, 'player', 'ottoman', DIPLOMACY_RELATIONS), -5);
})();

(function testDeclareWar() {
  const factions = makeState();
  factions.relations['player|venice'] = 20;
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
