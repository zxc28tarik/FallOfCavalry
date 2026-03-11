import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import { DIPLOMACY_ACTIONS, DIPLOMACY_RELATIONS } from '../../js/constants.js';
import { ensureFactionState, getRelation, setRelation } from '../../js/systems/factions.js';
import {
  buyTruce,
  improveRelations,
  declareWar,
  applyContractRelationBonus,
  applyTradeCaravanAttackPenalty,
} from '../../js/systems/diplomacy.js';

function makeState() {
  return ensureFactionState({ relations: {} }, DIPLOMACY_RELATIONS);
}

describe('diplomacy', () => {
  it('testBuyTruce', () => {
    const factions = makeState();
    // Use setRelation API (relKey uses ':' separator, not '|').
    // Set well below WAR_THRESHOLD (-80) to ensure WAR stance.
    setRelation(factions, 'player', 'hre', -85, DIPLOMACY_RELATIONS);
    const party = { gold: 200 };
    const ok = buyTruce({ factions, targetFactionId: 'hre', party, cfg: DIPLOMACY_ACTIONS });
    assert.equal(ok, true);
    assert.equal(party.gold, 50);
    assert.ok(getRelation(factions, 'player', 'hre') > DIPLOMACY_RELATIONS.WAR_THRESHOLD);
  });

  it('testImproveRelations', () => {
    const factions = makeState();
    setRelation(factions, 'player', 'ottoman', -20, DIPLOMACY_RELATIONS);
    const party = { gold: 120 };
    const ok = improveRelations({ factions, targetFactionId: 'ottoman', party, cfg: DIPLOMACY_ACTIONS });
    assert.equal(ok, true);
    assert.equal(party.gold, 40);
    assert.equal(getRelation(factions, 'player', 'ottoman', DIPLOMACY_RELATIONS), -5);
  });

  it('testDeclareWar', () => {
    const factions = makeState();
    setRelation(factions, 'player', 'venice', 20, DIPLOMACY_RELATIONS);
    declareWar({ factions, targetFactionId: 'venice', cfg: DIPLOMACY_ACTIONS });
    assert.ok(getRelation(factions, 'player', 'venice', DIPLOMACY_RELATIONS) <= DIPLOMACY_RELATIONS.WAR_THRESHOLD);
  });

  it('testContractBonus', () => {
    const factions = makeState();
    applyContractRelationBonus({ factions, contract: { factionId: 'polish' }, cfg: DIPLOMACY_ACTIONS });
    assert.equal(getRelation(factions, 'player', 'polish', DIPLOMACY_RELATIONS), DIPLOMACY_ACTIONS.CONTRACT_REWARD_RELATION_BONUS);
  });

  it('testCaravanPenalty', () => {
    const factions = makeState();
    applyTradeCaravanAttackPenalty({ factions, caravanFactionId: 'spanish', cfg: DIPLOMACY_ACTIONS });
    assert.equal(getRelation(factions, 'player', 'spanish', DIPLOMACY_RELATIONS), DIPLOMACY_ACTIONS.KILLING_NEUTRAL_CARAVAN_PENALTY);
  });
});
