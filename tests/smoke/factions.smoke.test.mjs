import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import {
  createInitialFactionState,
  getRelation,
  setRelation,
  adjustRelation,
  getStance,
} from '../../js/systems/factions.js';

const cfg = {
  MIN_REL: -100,
  MAX_REL: 100,
  ALLY_THRESHOLD: 50,
  WAR_THRESHOLD: -30,
  START_RELATIONS: {
    'player:kingdom_a': 20,
    'player:kingdom_b': 0,
    'player:bandits': -60,
    'kingdom_a:kingdom_b': -10,
    'kingdom_a:bandits': -80,
    'kingdom_b:bandits': -70,
  },
};

const factions = [
  { id: 'player' },
  { id: 'kingdom_a' },
  { id: 'kingdom_b' },
  { id: 'bandits' },
];

describe('factions', () => {
  it('block 1', () => {
    const state = createInitialFactionState({ factions, cfg });
    assert.equal(getRelation(state, 'player', 'kingdom_a'), 20);
    assert.equal(getRelation(state, 'kingdom_a', 'player'), 20);
    assert.equal(getRelation(state, 'kingdom_b', 'player'), 0);
    assert.equal(getRelation(state, 'kingdom_a', 'bandits'), -80);

    setRelation(state, 'player', 'bandits', -999, cfg);
    assert.equal(getRelation(state, 'player', 'bandits'), -100);
    setRelation(state, 'player', 'bandits', 999, cfg);
    assert.equal(getRelation(state, 'player', 'bandits'), 100);
    adjustRelation(state, 'player', 'bandits', -500, cfg);
    assert.equal(getRelation(state, 'player', 'bandits'), -100);

    setRelation(state, 'player', 'kingdom_b', 50, cfg);
    assert.equal(getStance(state, 'player', 'kingdom_b', cfg), 'ALLY');
    setRelation(state, 'player', 'kingdom_b', -30, cfg);
    assert.equal(getStance(state, 'player', 'kingdom_b', cfg), 'WAR');
    setRelation(state, 'player', 'kingdom_b', 10, cfg);
    assert.equal(getStance(state, 'player', 'kingdom_b', cfg), 'NEUTRAL');
  });
});
