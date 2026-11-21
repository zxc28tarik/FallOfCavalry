import * as CONST from '../constants.js';

const runtime = {
  party: null,
  map: null,
  worldSeed: 1,
  offersByCity: new Map(),
};

const CONTRACT_TYPES = Object.freeze(['BANDIT', 'DELIVER', 'SCOUT', 'DEFEND', 'ESCORT', 'ASSASSINATE', 'COURIER', 'RELIEF']);

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

function isAtWarForFaction({ ownerFactionId, warState, factions } = {}) {
  if (!ownerFactionId) return false;

  const wars = Array.isArray(warState?.wars) ? warState.wars : (Array.isArray(warState?.activeWars) ? warState.activeWars : []);
  if (wars.some((war) => {
    const a = war?.a || war?.attacker || war?.left || war?.factionA;
    const b = war?.b || war?.defender || war?.right || war?.factionB;
    const active = war?.active !== false;
    return active && (a === ownerFactionId || b === ownerFactionId);
  })) return true;

  const rels = factions?.relations;
  if (rels && typeof rels === 'object') {
    return Object.entries(rels).some(([key, value]) => {
      if (!Number.isFinite(Number(value)) || Number(value) > Number(CONST.DIPLOMACY_RELATIONS?.WAR_THRESHOLD ?? -35)) return false;
      return String(key).split(/[:|]/).includes(ownerFactionId);
    });
  }

  return false;
}

function buildContractBase({ id, type, cityId, title, desc, rewardGold, rewardRenown, ownerFactionId, isWarContract = false }) {
  return {
    id,
    type,
    cityId,
    title,
    desc,
    ownerFactionId: ownerFactionId || null,
    factionId: ownerFactionId || null,
    isWarContract,
    progress: 0,
    accepted: false,
    completed: false,
    rewardGold: Math.floor(rewardGold),
    rewardRenown: Math.floor(rewardRenown),
  };
}

export function setContractsRuntimeContext({ party, map, worldSeed } = {}) {
  if (party && typeof party === 'object') runtime.party = party;
  if (map && typeof map === 'object') runtime.map = map;
  if (Number.isFinite(worldSeed)) runtime.worldSeed = worldSeed;
}

function getSettlements(map) {
  return Array.isArray(map?.settlements) ? map.settlements.filter((s) => s?.id != null) : [];
}

function getPois(map) {
  return Array.isArray(map?.pois) ? map.pois : [];
}

function getSettlementById(map, cityId) {
  return getSettlements(map).find((s) => s.id === cityId) || null;
}

function settlementName(settlement, fallbackId = 'Unknown') {
  return settlement?.name || settlement?.label || settlement?.id || fallbackId;
}

function distanceBetweenSettlements(a, b) {
  const ax = Number(a?.tx ?? a?.x ?? 0);
  const ay = Number(a?.ty ?? a?.y ?? 0);
  const bx = Number(b?.tx ?? b?.x ?? 0);
  const by = Number(b?.ty ?? b?.y ?? 0);
  return Math.hypot(ax - bx, ay - by);
}

function createBanditContract({ cityId, day, seed, rng, ownerFactionId, cityName }) {
  const factionFlavor = ownerFactionId && ownerFactionId !== CONST.FACTION.ID.BANDITS
    ? ` for ${ownerFactionId}`
    : '';
  return {
    ...buildContractBase({
      id: `ct-bandit-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'BANDIT',
      cityId,
      title: `Clear Bandit Patrol${factionFlavor}`,
      desc: `Suppress raiders threatening ${cityName}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.1,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE,
      ownerFactionId,
    }),
    targetRegionId: `region-${hashString(`${seed}:${cityId}:${day}:bandit`) % 16}`,
    requiredCount: Math.max(1, Number(CONST.CONTRACTS.BANDIT_BATTLE_COUNT || 1)),
  };
}

function createDeliveryContract({ cityId, day, rng, map, ownerFactionId, cityName }) {
  const settlements = getSettlements(map).filter((s) => s.id !== cityId);
  const target = pickOne(settlements, rng, null);
  const minFood = Math.floor(CONST.CONTRACTS.DELIVERY_FOOD_MIN);
  const maxFood = Math.floor(CONST.CONTRACTS.DELIVERY_FOOD_MAX);
  const amount = clampInt(minFood + Math.floor(rng() * (Math.max(minFood + 1, maxFood + 1) - minFood)), minFood, maxFood);
  return {
    ...buildContractBase({
      id: `ct-deliver-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'DELIVER',
      cityId,
      title: 'Deliver Food Caravan',
      desc: `Move wheat from ${cityName} to ${settlementName(target, 'target city')}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.35,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 0.9,
      ownerFactionId,
    }),
    targetCityId: target?.id || cityId,
    requiredAmount: amount,
    requiredCount: amount,
  };
}

function createScoutContract({ cityId, day, rng, map, ownerFactionId }) {
  const ruins = getPois(map).filter((poi) => poi?.id && poi.type === 'ruin');
  const targetPoi = pickOne(ruins, rng, null);
  return {
    ...buildContractBase({
      id: `ct-scout-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'SCOUT',
      cityId,
      title: 'Scout Nearby Ruin',
      desc: `Explore ruin ${targetPoi?.id || 'target'} and report back.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.25,
      ownerFactionId,
    }),
    targetPoiId: targetPoi?.id || null,
    requiredCount: Math.max(1, Number(CONST.CONTRACTS.SCOUT_POI_COUNT || 1)),
  };
}

function createDefendContract({ cityId, day, rng, ownerFactionId, cityName }) {
  const requiredCount = Math.max(1, Number(CONST.CONTRACTS.DEFEND_WAVE_COUNT ?? 2));
  const windowDays = Math.max(1, Number(CONST.CONTRACTS.DEFEND_WINDOW_DAYS ?? 3));
  return {
    ...buildContractBase({
      id: `ct-defend-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'DEFEND',
      cityId,
      title: `Defend ${cityName}`,
      desc: `Defend ${cityName} against raids (${requiredCount} battles in ${windowDays} days).`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.45,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.5,
      ownerFactionId,
      isWarContract: true,
    }),
    requiredCount,
    windowDays,
  };
}

function createEscortContract({ cityId, day, rng, map, ownerFactionId, cityName }) {
  const from = getSettlementById(map, cityId);
  const others = getSettlements(map).filter((s) => s.id !== cityId);
  const minDistance = Number(CONST.CONTRACTS.ESCORT_DISTANCE_MIN ?? 10);
  const maxDistance = Number(CONST.CONTRACTS.ESCORT_DISTANCE_MAX ?? 25);
  const candidates = others.filter((target) => {
    const d = distanceBetweenSettlements(from, target);
    return d >= minDistance && d <= maxDistance;
  });
  const target = pickOne(candidates.length ? candidates : others, rng, null);
  return {
    ...buildContractBase({
      id: `ct-escort-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'ESCORT',
      cityId,
      title: `Escort caravan from ${cityName}`,
      desc: `Escort caravan from ${cityName} to ${settlementName(target, 'target city')}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.2,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.1,
      ownerFactionId,
    }),
    targetCityId: target?.id || cityId,
    routeFromName: cityName,
    routeToName: settlementName(target, target?.id || cityId),
    maxBanditEncounters: 1,
    escortBanditEncounters: 0,
    requiredCount: 1,
  };
}

function createAssassinateContract({ cityId, day, rng, seed, ownerFactionId }) {
  const targetRegionId = `region-${hashString(`${seed}:${cityId}:${day}:leader`) % 16}`;
  return {
    ...buildContractBase({
      id: `ct-assassinate-${cityId}-${day}-${Math.floor(rng() * 10000)}`,
      type: 'ASSASSINATE',
      cityId,
      title: 'Eliminate Bandit Leader',
      desc: `Eliminate a notorious bandit leader near ${targetRegionId}.`,
      rewardGold: CONST.CONTRACTS.REWARD_GOLD_BASE * 1.6,
      rewardRenown: CONST.CONTRACTS.REWARD_RENOWN_BASE * 1.65,
      ownerFactionId,
      isWarContract: true,
    }),
    targetFactionId: CONST.FACTION.ID.BANDITS,
    targetRegionId,
    targetPower: Number(CONST.CONTRACTS.ASSASSINATE_TARGET_POWER ?? 1.5),
    requiredCount: 1,
  };
}

/**
 * A city-to-city letter uses an authentic existing settlement. Completing it
 * requires entering the actual target city; viewing the board cannot credit it.
 */
function createCourierContract({cityId,day,rng,map,ownerFactionId,cityName}) {
  const source=getSettlementById(map,cityId);
  const destinations=getSettlements(map)
    .filter(s=>String(s.id)!==String(cityId))
    .sort((a,b)=>distanceBetweenSettlements(source,a)-distanceBetweenSettlements(source,b))
    .slice(0,12);
  const target=pickOne(destinations,rng,null);
  if(!target)return null;
  return {
    ...buildContractBase({
      id:`ct-courier-${cityId}-${day}-${Math.floor(rng()*10000)}`,
      type:'COURIER',cityId,
      title:'Mühürlü Ferman',
      desc:`${cityName} şehrinden ${settlementName(target)} şehrine mühürlü haberi götür.`,
      rewardGold:CONST.CONTRACTS.REWARD_GOLD_BASE*0.9,
      rewardRenown:CONST.CONTRACTS.REWARD_RENOWN_BASE,
      ownerFactionId,
    }),
    targetCityId:target.id,requiredCount:1,
  };
}
/** Food relief is credited only by a real successful wheat sale at target. */
function createReliefContract({cityId,day,rng,map,ownerFactionId,cityName}) {
  const source=getSettlementById(map,cityId);
  const destinations=getSettlements(map)
    .filter(s=>String(s.id)!==String(cityId))
    .sort((a,b)=>Number(a.security??50)-Number(b.security??50)
      ||distanceBetweenSettlements(source,a)-distanceBetweenSettlements(source,b))
    .slice(0,16);
  const target=pickOne(destinations,rng,null);
  if(!target)return null;
  const amount=Math.max(4,Math.min(20,Math.floor(Number(CONST.CONTRACTS.DELIVERY_FOOD_MIN)||8)));
  return {
    ...buildContractBase({
      id:`ct-relief-${cityId}-${day}-${Math.floor(rng()*10000)}`,
      type:'RELIEF',cityId,
      title:'Halka Erzak Yardımı',
      desc:`${cityName} adına ${settlementName(target)} pazarına ${amount} buğday sat.`,
      rewardGold:CONST.CONTRACTS.REWARD_GOLD_BASE*1.15,
      rewardRenown:CONST.CONTRACTS.REWARD_RENOWN_BASE*1.2,
      ownerFactionId,
    }),
    targetCityId:target.id,requiredAmount:amount,requiredCount:amount,
    civicSecurityBonus:3,
  };
}

export function generateContractsForCity({ cityId, day, seed, map, worldState, factions, warState } = {}) {
  const chosenMap = map || worldState?.map || runtime.map || { settlements: [], pois: [] };
  const worldSeed = Number.isFinite(seed)
    ? seed
    : (Number.isFinite(worldState?.seed) ? worldState.seed : runtime.worldSeed);
  const key = `${cityId ?? 'city'}:${Number(day || 1)}:${worldSeed}`;
  const rng = makeRng(hashString(key));
  const settlement = getSettlementById(chosenMap, cityId);
  const ownerFactionId = settlement?.ownerFactionId || settlement?.owner || null;
  const cityName = settlementName(settlement, cityId);
  const warActive = isAtWarForFaction({ ownerFactionId, warState, factions: factions || worldState?.factions });

  const pool = warActive
    ? ['DEFEND', 'ASSASSINATE', 'BANDIT', 'ESCORT', 'DELIVER', 'DEFEND', 'ASSASSINATE']
    : ['BANDIT', 'DELIVER', 'SCOUT', 'ESCORT', 'BANDIT', 'SCOUT'];
  const selected = [];
  while (selected.length < 3 && pool.length) {
    const picked = pickOne(pool, rng);
    if (!picked) break;
    if (!selected.includes(picked)) selected.push(picked);
    if (selected.length < 3 && selected.includes('SCOUT') && !pool.includes('ESCORT')) pool.push('ESCORT');
  }

  if (!selected.includes('BANDIT')) selected[0] = 'BANDIT';
  if (!warActive && !selected.includes('SCOUT')) selected[1] = 'SCOUT';
  if (!selected.includes('ESCORT')) selected[2] = 'ESCORT';

  if (warActive && !selected.some((type) => type === 'DEFEND' || type === 'ASSASSINATE')) {
    const warType = pickOne(['DEFEND', 'ASSASSINATE'], rng, 'DEFEND');
    const replaceCandidates = [0, 1, 2].filter((idx) => selected[idx] !== 'ESCORT');
    const replaceIndex = pickOne(replaceCandidates, rng, 1);
    selected[replaceIndex] = warType;
  }

  // Keep the original three offers, then add two separate civilian paths.
  // During wartime, the existing DEFEND/ASSASSINATE slot remains intact.
  const expanded = [...selected.slice(0,3),'COURIER','RELIEF'];
  const contracts = expanded.map((type) => {
    if (!CONTRACT_TYPES.includes(type)) return null;
    if (type === 'BANDIT') return createBanditContract({ cityId, day, seed: worldSeed, rng, ownerFactionId, cityName });
    if (type === 'DELIVER') return createDeliveryContract({ cityId, day, rng, map: chosenMap, ownerFactionId, cityName });
    if (type === 'SCOUT') return createScoutContract({ cityId, day, rng, map: chosenMap, ownerFactionId });
    if (type === 'DEFEND') return createDefendContract({ cityId, day, rng, ownerFactionId, cityName });
    if (type === 'ESCORT') return createEscortContract({ cityId, day, rng, map: chosenMap, ownerFactionId, cityName });
    if (type === 'ASSASSINATE') return createAssassinateContract({ cityId, day, rng, seed: worldSeed, ownerFactionId });
    if (type === 'COURIER') return createCourierContract({cityId,day,rng,map:chosenMap,ownerFactionId,cityName});
    if (type === 'RELIEF') return createReliefContract({cityId,day,rng,map:chosenMap,ownerFactionId,cityName});
    return null;
  }).filter(Boolean);

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
    if (contract.type === 'DEFEND' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits' && event.locationCityId === contract.cityId) {
        contract.progress = prev + 1;
      }
    }
    if (contract.type === 'ASSASSINATE' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits' && event.isTargetLeader) {
        contract.progress = prev + 1;
      }
    }
    if (contract.type === 'ESCORT' && event.type === 'BATTLE_WON') {
      if (event.enemyFaction === 'bandits' && !contract.completed) {
        contract.escortBanditEncounters = Number(contract.escortBanditEncounters ?? 0) + 1;
      }
    }
    if (contract.type === 'ESCORT' && event.type === 'ESCORT_COMPLETE') {
      const success = Boolean(event.success);
      if (event.fromCityId === contract.cityId && event.toCityId === contract.targetCityId && success) {
        contract.progress = 1;
      }
    }
    if (contract.type === 'COURIER' && event.type === 'CITY_VISITED') {
      if (String(event.cityId) === String(contract.targetCityId)) contract.progress=1;
    }
    if (contract.type === 'RELIEF' && event.type === 'DELIVERED') {
      if (event.itemId === 'food' && String(event.cityId)===String(contract.targetCityId))
        contract.progress=prev+Math.max(0,Number(event.qty??0));
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

    const required = (contract.type === 'DELIVER' || contract.type === 'RELIEF')
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

export function completeContract(contractId, party = runtime.party, options = {}) {
  if (!party || !Array.isArray(party.contracts) || !contractId) return null;
  const idx = party.contracts.findIndex((c) => c?.id === contractId);
  if (idx < 0) return null;
  const contract = party.contracts[idx];
  if (!contract.completed) return null;

  const resolvedWarState = options?.warState || null;
  const isWarNow = isAtWarForFaction({ ownerFactionId: contract.ownerFactionId || contract.factionId, warState: resolvedWarState, factions: options?.factions });
  const warContractTypes = new Set(['DEFEND', 'ASSASSINATE']);
  const warBonus = warContractTypes.has(contract.type) && isWarNow
    ? Number(CONST.CONTRACTS.WAR_CONTRACT_BONUS_RENOWN ?? 0)
    : 0;

  party.gold = Math.floor(Number(party.gold ?? 0) + Number(contract.rewardGold ?? 0));
  party.renown = Math.floor(Number(party.renown ?? 0) + Number(contract.rewardRenown ?? 0) + warBonus);

  const completed = { ...contract, bonusRenown: warBonus };
  // Civilian relief improves the actual beneficiary settlement, not an
  // unverified quest title or a synthetic regional economy location.
  if (contract.type === 'RELIEF' && typeof options?.onCivicRelief === 'function') {
    options.onCivicRelief(completed);
  }
  party.contracts.splice(idx, 1);

  if (warBonus > 0 && typeof options?.onRelationBonus === 'function') {
    options.onRelationBonus(completed);
  }

  return completed;
}

export function emitContractEvent(event, party = runtime.party) {
  return updateContractProgress(event, party);
}

export function getActiveContracts(party = runtime.party) {
  if (!party || !Array.isArray(party.contracts)) return [];
  return party.contracts;
}
