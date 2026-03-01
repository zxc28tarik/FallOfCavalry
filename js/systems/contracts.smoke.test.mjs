import assert from 'node:assert/strict';
import {
  setContractsRuntimeContext,
  generateContractsForCity,
  acceptContract,
  updateContractProgress,
  completeContract,
} from './contracts.js';

const map = {
  settlements: [
    { id: 'city-a' },
    { id: 'city-b' },
  ],
  pois: [
    { id: 'poi-ruin-1', type: 'ruin' },
    { id: 'poi-camp-1', type: 'camp' },
  ],
};

const party = { gold: 100, renown: 10, contracts: [] };
setContractsRuntimeContext({ party, map, worldSeed: 777 });

const run1 = generateContractsForCity({ cityId: 'city-a', day: 3, seed: 777, map });
const run2 = generateContractsForCity({ cityId: 'city-a', day: 3, seed: 777, map });
assert.deepEqual(run1, run2, 'contracts should be deterministic for same city/day/seed');
assert.equal(run1.length, 3, 'must produce 3 contracts');

const bandit = run1.find((c) => c.type === 'BANDIT');
const deliver = run1.find((c) => c.type === 'DELIVER');
const scout = run1.find((c) => c.type === 'SCOUT');
assert.ok(bandit && deliver && scout, 'all three contract types should exist');

acceptContract(bandit.id, party);
acceptContract(deliver.id, party);
acceptContract(scout.id, party);

updateContractProgress({ type: 'BATTLE_WON', enemyFaction: 'bandits', regionId: bandit.targetRegionId }, party);
assert.ok((party.contracts.find((c) => c.id === bandit.id)?.progress ?? 0) > 0, 'bandit progress should increment');

updateContractProgress({ type: 'DELIVERED', itemId: 'food', qty: 5, cityId: deliver.targetCityId }, party);
assert.ok((party.contracts.find((c) => c.id === deliver.id)?.progress ?? 0) >= 5, 'delivery progress should increment');

updateContractProgress({ type: 'POI_EXPLORED', poiType: 'ruin', poiId: scout.targetPoiId }, party);
assert.equal(party.contracts.find((c) => c.id === scout.id)?.completed, true, 'scout contract should complete');

const beforeGold = party.gold;
const beforeRenown = party.renown;
const completed = completeContract(scout.id, party);
assert.ok(completed, 'completed contract should be claimable');
assert.ok(party.gold > beforeGold, 'gold reward should be added');
assert.ok(party.renown > beforeRenown, 'renown reward should be added');

console.log('contracts smoke test passed');
