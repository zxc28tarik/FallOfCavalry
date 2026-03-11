import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import * as CONST from '../../js/constants.js';
import {
  setContractsRuntimeContext,
  generateContractsForCity,
  acceptContract,
  updateContractProgress,
  completeContract,
} from '../../js/systems/contracts.js';

describe('contracts', () => {
  it('block 1', () => {
    const map = {
      settlements: [
        { id: 'city-a', name: 'City A', tx: 0, ty: 0, ownerFactionId: 'kingdom_a' },
        { id: 'city-b', name: 'City B', tx: 12, ty: 0, ownerFactionId: 'kingdom_a' },
        { id: 'city-c', name: 'City C', tx: 25, ty: 0, ownerFactionId: 'kingdom_b' },
      ],
      pois: [
        { id: 'poi-ruin-1', type: 'ruin' },
        { id: 'poi-camp-1', type: 'camp' },
      ],
    };

    const factions = {
      relations: {
        'kingdom_a|kingdom_b': -50,
      },
    };

    const party = { gold: 100, renown: 10, contracts: [] };
    setContractsRuntimeContext({ party, map, worldSeed: 777 });

    const peaceful = generateContractsForCity({ cityId: 'city-c', day: 3, seed: 777, map, factions, warState: { wars: [] } });
    assert.equal(peaceful.length, 3, 'must produce 3 contracts in peace');
    assert.ok(peaceful.some((c) => c.type === 'ESCORT'), 'peace pool should include escort');

    const warRun = generateContractsForCity({ cityId: 'city-a', day: 3, seed: 777, map, factions, warState: { wars: [{ a: 'kingdom_a', b: 'kingdom_b', active: true }] } });
    const warRunAgain = generateContractsForCity({ cityId: 'city-a', day: 3, seed: 777, map, factions, warState: { wars: [{ a: 'kingdom_a', b: 'kingdom_b', active: true }] } });
    assert.deepEqual(warRun, warRunAgain, 'contracts should be deterministic for same city/day/seed');
    assert.ok(warRun.some((c) => c.type === 'DEFEND' || c.type === 'ASSASSINATE'), 'war city should have war contract chance');

    const defendOffer = warRun.find((c) => c.type === 'DEFEND') || {
      id: 'manual-defend',
      type: 'DEFEND',
      accepted: true,
      completed: false,
      cityId: 'city-a',
      requiredCount: 2,
      progress: 0,
      rewardGold: 50,
      rewardRenown: 10,
      ownerFactionId: 'kingdom_a',
    };
    const escortOffer = peaceful.find((c) => c.type === 'ESCORT') || {
      id: 'manual-escort',
      type: 'ESCORT',
      accepted: true,
      completed: false,
      cityId: 'city-c',
      targetCityId: 'city-b',
      requiredCount: 1,
      progress: 0,
      rewardGold: 50,
      rewardRenown: 10,
      ownerFactionId: 'kingdom_b',
    };
    const assassinateOffer = warRun.find((c) => c.type === 'ASSASSINATE') || {
      id: 'manual-assassin',
      type: 'ASSASSINATE',
      accepted: true,
      completed: false,
      cityId: 'city-a',
      requiredCount: 1,
      progress: 0,
      rewardGold: 50,
      rewardRenown: 10,
      ownerFactionId: 'kingdom_a',
    };

    if (defendOffer.id !== 'manual-defend') acceptContract(defendOffer.id, party);
    if (escortOffer.id !== 'manual-escort') acceptContract(escortOffer.id, party);
    if (assassinateOffer.id !== 'manual-assassin') acceptContract(assassinateOffer.id, party);
    if (defendOffer.id === 'manual-defend') party.contracts.push(defendOffer);
    if (escortOffer.id === 'manual-escort') party.contracts.push(escortOffer);
    if (assassinateOffer.id === 'manual-assassin') party.contracts.push(assassinateOffer);

    updateContractProgress({ type: 'BATTLE_WON', enemyFaction: 'bandits', locationCityId: 'city-a' }, party);
    assert.equal(party.contracts.find((c) => c.id === defendOffer.id)?.progress, 1, 'defend should progress on local bandit victory');

    updateContractProgress({ type: 'ESCORT_COMPLETE', fromCityId: escortOffer.cityId, toCityId: escortOffer.targetCityId, success: true }, party);
    assert.equal(party.contracts.find((c) => c.id === escortOffer.id)?.completed, true, 'escort should complete on successful route');

    updateContractProgress({ type: 'BATTLE_WON', enemyFaction: 'bandits', isTargetLeader: true }, party);
    assert.equal(party.contracts.find((c) => c.id === assassinateOffer.id)?.completed, true, 'assassinate should complete when target leader is killed');

    const warReady = party.contracts.find((c) => c.type === 'DEFEND');
    warReady.progress = warReady.requiredCount;
    warReady.completed = true;
    const beforeRenown = party.renown;
    const completed = completeContract(warReady.id, party, {
      warState: { wars: [{ a: 'kingdom_a', b: 'kingdom_b', active: true }] },
      factions,
    });
    assert.ok(completed, 'war contract should be claimable');
    assert.equal(party.renown, beforeRenown + completed.rewardRenown + CONST.CONTRACTS.WAR_CONTRACT_BONUS_RENOWN, 'war contract should add renown bonus');
  });
});
