import assert from 'node:assert/strict';
import {
  createInitialWorldAiState,
  ensureWorldParties,
  updateWorldParties,
} from './world-ai.js';

const cfg = {
  MAX_BANDIT_PARTIES: 2,
  MAX_PATROL_PARTIES: 1,
  MAX_CARAVAN_PARTIES: 1,
  BANDIT_SPEED: 1,
  PATROL_SPEED: 1,
  CARAVAN_SPEED: 1,
  BANDIT_AGGRO_RADIUS: 4,
  PATROL_AGGRO_RADIUS: 4,
  DESPAWN_DISTANCE: 40,
  RESPAWN_INTERVAL_DAYS: 3,
};

const worldState = {
  width: 20,
  height: 20,
  tileSize: 10,
  settlements: [
    { id: 'c1', x: 20, y: 20, ownerFactionId: 'ottoman' },
    { id: 'c2', x: 120, y: 20, ownerFactionId: 'ottoman' },
    { id: 'c3', x: 20, y: 120, ownerFactionId: 'hre' },
  ],
};

const ai = createInitialWorldAiState();
ensureWorldParties({ aiState: ai, worldState, factions: [{ id: 'ottoman' }, { id: 'hre' }], cfg, currentDay: 1 });

const byKind = (kind) => ai.parties.filter((p) => p.kind === kind).length;
assert.equal(byKind('bandit'), 2, 'ensureWorldParties should spawn max bandits');
assert.equal(byKind('patrol'), 1, 'ensureWorldParties should spawn max patrols');
assert.equal(byKind('caravan'), 1, 'ensureWorldParties should spawn max caravans');

const bandit = ai.parties.find((p) => p.kind === 'bandit');
assert.ok(bandit, 'bandit should exist');
bandit.x = 50;
bandit.y = 50;
bandit.targetX = 50;
bandit.targetY = 50;

const playerParty = { x: 52, y: 52, factionId: 'ottoman' };
const encounters = updateWorldParties({ aiState: ai, worldState, playerParty, factions: [], cfg, dtSec: 0.1 });
assert.ok(encounters.some((e) => e.partyId === bandit.id), 'updateWorldParties should trigger encounter when player is near');

const targetCheckAi = createInitialWorldAiState();
targetCheckAi.parties.push({
  id: 'b-target',
  factionId: 'bandits',
  kind: 'bandit',
  x: 70,
  y: 70,
  targetX: 70,
  targetY: 70,
  speed: 1,
  alive: true,
});
const prevRandom = Math.random;
Math.random = () => 0.9;
updateWorldParties({ aiState: targetCheckAi, worldState, playerParty: { x: 0, y: 0, factionId: 'ottoman' }, factions: [], cfg, dtSec: 0.2 });
Math.random = prevRandom;
assert.ok(targetCheckAi.parties[0].targetX !== 70 || targetCheckAi.parties[0].targetY !== 70, 'party should pick a new target on arrival');

const caravan = ai.parties.find((p) => p.kind === 'caravan');
assert.ok(caravan, 'caravan should exist');
caravan.x = 1000;
caravan.y = 1000;
updateWorldParties({ aiState: ai, worldState, playerParty: { x: 0, y: 0, factionId: 'ottoman' }, factions: [], cfg, dtSec: 0.1 });
assert.ok(!ai.parties.some((p) => p.id === caravan.id), 'distant party should be despawned');

console.log('world-ai smoke test passed');
