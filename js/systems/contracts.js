import * as CONST from '../constants.js';

const runtime = {
  party: null,
  map: null,
  worldSeed: 1,
  offersByCity: new Map(),
};

function hashString(input) {
  const text = String(input || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeRng(seedValue) {
  let s = (Number(seedValue) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pickOne(list, rng, fallback = null) {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  const idx = Math.max(0, Math.min(list.length - 1, Math.floor(rng() * list.length)));
  return list[idx];
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.floor(v)));
}

export function setContractsRuntimeContext({ party, map, worldSeed } = {}) {
  if (party && typeof party === 'object') runtime.party = party;
  if (map && typeof map === 'object') runtime.map = map;
  if (Number.isFinite(worldSeed)) runtime.worldSeed = worldSeed;
}

function getSettlements(map) {
  return Array.isArray(map?.settlements) ? map.settlements.filter((s) => s?.id) : [];
}

function getPois(map) {
  return Array.isArray(map?.pois) ? map.pois : [];
}

function createBanditContract({ cityId, day, seed, rng }) {
  return {
    id: `ct-bandit-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
    type: 'BANDIT',
    cityId,
    targetRegionId: `region-${hashString(`${seed}:${cityId}:${day}:bandit`) % 16}`,
    progress: 0,
    requiredCount: Math.max(1, Number(CONST.CONTRACTS.BANDIT_BATTLE_COUNT || 1)),
    rewardGold: Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE * 1.1),
    rewardRenown: Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE),
    accepted: false,
    completed: false,
  };
}

function createDeliveryContract({ cityId, day, seed, rng, map }) {
  const settlements = getSettlements(map).filter((s) => s.id !== cityId);
  const target = pickOne(settlements, rng, null);
  const minFood = Math.floor(CONST.CONTRACTS.DELIVERY_FOOD_MIN);
  const maxFood = Math.floor(CONST.CONTRACTS.DELIVERY_FOOD_MAX);
  const amount = clampInt(minFood + Math.floor(rng() * (Math.max(minFood + 1, maxFood + 1) - minFood)), minFood, maxFood);
  return {
    id: `ct-deliver-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
    type: 'DELIVER',
    cityId,
    targetCityId: target?.id || cityId,
    requiredAmount: amount,
    progress: 0,
    requiredCount: amount,
    rewardGold: Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE * 1.35),
    rewardRenown: Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE * 0.9),
    accepted: false,
    completed: false,
  };
}

function createScoutContract({ cityId, day, seed, rng, map }) {
  const ruins = getPois(map).filter((poi) => poi?.id && poi.type === 'ruin');
  const targetPoi = pickOne(ruins, rng, null);
  return {
    id: `ct-scout-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
    type: 'SCOUT',
    cityId,
    targetPoiId: targetPoi?.id || null,
    progress: 0,
    requiredCount: Math.max(1, Number(CONST.CONTRACTS.SCOUT_POI_COUNT || 1)),
    rewardGold: Math.floor(CONST.CONTRACTS.REWARD_GOLD_BASE),
    rewardRenown: Math.floor(CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.25),
    accepted: false,
    completed: false,
  };
}

export function generateContractsForCity({ cityId, day, seed, map } = {}) {
  const chosenMap = map || runtime.map || { settlements: [], pois: [] };
  const worldSeed = Number.isFinite(seed) ? seed : runtime.worldSeed;
  const key = `${cityId || 'city'}:${Number(day || 1)}:${worldSeed}`;
  const rng = makeRng(hashString(key));
  const contracts = [
    createBanditContract({ cityId, day, seed: worldSeed, rng }),
    createDeliveryContract({ cityId, day, seed: worldSeed, rng, map: chosenMap }),
    createScoutContract({ cityId, day, seed: worldSeed, rng, map: chosenMap }),
  ];
  runtime.offersByCity.set(String(cityId || ''), contracts.map((c) => ({ ...c })));
  return contracts;
}

export function acceptContract(contractId, party = runtime.party) {
  if (!party || !contractId) return null;
  if (!Array.isArray(party.contracts)) party.contracts = [];
  const already = party.contracts.find((c) => c?.id === contractId);
  if (already) return already;

  const offer = Array.from(runtime.offersByCity.values())
    .flat()
    .find((contract) => contract?.id === contractId);

  if (!offer) return null;
  const accepted = { ...offer, accepted: true, completed: false, progress: Math.max(0, Number(offer.progress ?? 0)) };
  party.contracts.push(accepted);
  return accepted;
}

export function updateContractProgress(event, party = runtime.party) {
  if (!party || !Array.isArray(party.contracts) || !event || typeof event !== 'object') return [];
  const changed = [];

  party.contracts.forEach((contract) => {
    if (!contract?.accepted || contract?.completed) return;
    const prev = Number(contract.progress ?? 0);
    if (contract.type === 'BANDIT' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits') {
        contract.progress = prev + 1;
      }
    }
    if (contract.type === 'DELIVER' && event.type === 'DELIVERED') {
      if (event.itemId === 'food' && event.cityId === contract.targetCityId) {
        contract.progress = prev + Math.max(0, Number(event.qty ?? 0));
      }
    }
    if (contract.type === 'SCOUT' && event.type === 'POI_EXPLORED') {
      if (event.poiId && event.poiId === contract.targetPoiId) {
        contract.progress = prev + 1;
      }
    }

    const required = contract.type === 'DELIVER'
      ? Math.max(1, Number(contract.requiredAmount ?? contract.requiredCount ?? 1))
      : Math.max(1, Number(contract.requiredCount ?? 1));

    if (contract.progress >= required) {
      contract.completed = true;
      contract.progress = required;
    }

    if (contract.progress !== prev || contract.completed) changed.push(contract);
  });

  return changed;
}

export function completeContract(contractId, party = runtime.party) {
  if (!party || !Array.isArray(party.contracts) || !contractId) return null;
  const idx = party.contracts.findIndex((c) => c?.id === contractId);
  if (idx < 0) return null;
  const contract = party.contracts[idx];
  if (!contract.completed) return null;

  party.gold = Math.floor(Number(party.gold ?? 0) + Number(contract.rewardGold ?? 0));
  party.renown = Math.floor(Number(party.renown ?? 0) + Number(contract.rewardRenown ?? 0));
  party.contracts.splice(idx, 1);
  return contract;
}

export function emitContractEvent(event, party = runtime.party) {
  return updateContractProgress(event, party);
}

export function getActiveContracts(party = runtime.party) {
  if (!party || !Array.isArray(party.contracts)) return [];
  return party.contracts;
}
