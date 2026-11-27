/**
 * WEB Character System v2 V1.17 — source-scoped, bounded quest event ledger.
 *
 * In-session observations originate at existing gameplay resolution points.
 * Saved entries are forever PENDING history on reload: a local save is not
 * independent evidence of battle/quest victory and MUST NOT unlock rewards.
 * Only a separate, in-session, canonical-source matcher may advance objectives.
 */
import { isLiveEscortParty } from './quest-caravan-escort.js';
import { registeredTradeRoute, validBanditRoute } from './quest-world-party-links.js';
import { hasWitnessedMissingCaravanBandits, isRuntimeRouteBandit } from './quest-route-recon.js';

export const QUEST_EVENT_LEDGER_VERSION = 1;
const LIMIT = 1024;
const EVENT_ID = /^(?:battle|encounter|caravan|recon):[a-zA-Z0-9_.:-]{1,128}:[1-9]\d{0,15}$/;
const ENTITY_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const DAY = (day) => Number.isSafeInteger(day) && day >= 1 && day <= 10000000;
const record = (item) => item && typeof item === 'object' && !Array.isArray(item);

export function emptyQuestEventLedger() {
  return { version: QUEST_EVENT_LEDGER_VERSION, observed: [], pending: [] };
}

function normalizeRow(row) {
  if (!record(row) || !['battle_result', 'encounter_choice', 'caravan_arrival', 'route_recon'].includes(row.source)
    || typeof row.eventId !== 'string' || !EVENT_ID.test(row.eventId)
    || typeof row.enemyId !== 'string' || !ENTITY_ID.test(row.enemyId)
    || typeof row.enemyFactionId !== 'string' || !ENTITY_ID.test(row.enemyFactionId)
    || !DAY(row.day)) return null;
  const prefix = row.source === 'battle_result' ? 'battle:'
    : row.source === 'caravan_arrival' ? 'caravan:'
      : row.source === 'route_recon' ? 'recon:' : 'encounter:';
  if (!row.eventId.startsWith(prefix)) return null;
  // World-party IDs may contain colons. Only the final segment is the time.
  const lastColon = row.eventId.lastIndexOf(':');
  if (row.eventId.slice(prefix.length, lastColon) !== row.enemyId) return null;
  const base = {
    eventId: row.eventId, source: row.source, enemyId: row.enemyId,
    enemyFactionId: row.enemyFactionId, result: row.result, day: row.day,
  };
  if (row.source === 'route_recon') {
    if (row.result !== 'bandits_located' || row.partyType !== 'bandit'
      || row.enemyFactionId !== 'bandits'
      || typeof row.questId !== 'string' || !ENTITY_ID.test(row.questId)
      || typeof row.routeId !== 'string' || !ENTITY_ID.test(row.routeId))
      return null;
    return { ...base, partyType: 'bandit', questId: row.questId, routeId: row.routeId };
  }
  if (row.source === 'caravan_arrival') {
    if (row.result !== 'caravan_arrived' || row.partyType !== 'caravan'
      || typeof row.questId !== 'string' || !ENTITY_ID.test(row.questId)
      || typeof row.routeId !== 'string' || !ENTITY_ID.test(row.routeId)
      || typeof row.fromCityId !== 'string' || !ENTITY_ID.test(row.fromCityId)
      || typeof row.toCityId !== 'string' || !ENTITY_ID.test(row.toCityId)) return null;
    return {
      ...base, partyType: 'caravan', questId: row.questId,
      routeId: row.routeId, fromCityId: row.fromCityId, toCityId: row.toCityId,
    };
  }
  if (row.source === 'encounter_choice') {
    if (row.result !== 'messenger_caught'
      || row.partyType !== 'messenger' || row.optionId !== 'seize') return null;
    return { ...base, partyType: 'messenger', optionId: 'seize' };
  }
  if (!['victory', 'defeat'].includes(row.result)) return null;
  if (row.partyType != null && row.partyType !== 'bandit') return null;
  if (row.routeId != null && (row.partyType !== 'bandit'
    || typeof row.routeId !== 'string' || !ENTITY_ID.test(row.routeId))) return null;
  if (row.commanderId != null && (typeof row.commanderId !== 'string'
    || !ENTITY_ID.test(row.commanderId))) return null;
  return {
    ...base,
    ...(row.partyType === 'bandit' ? { partyType: 'bandit' } : {}),
    ...(row.routeId != null ? { routeId: row.routeId } : {}),
    ...(row.commanderId != null ? { commanderId: row.commanderId } : {}),
  };
}

/** Restrict saved observations to pending, inert campaign history. */
export function normalizeQuestEventLedger(input, { forLoad = false } = {}) {
  const ledger = emptyQuestEventLedger();
  if (!record(input) || input.version !== QUEST_EVENT_LEDGER_VERSION) return ledger;
  const seen = new Set();
  for (const phase of ['observed', 'pending']) {
    for (const inputRow of (Array.isArray(input[phase]) ? input[phase] : []).slice(0, LIMIT)) {
      const row = normalizeRow(inputRow);
      if (!row || seen.has(row.eventId) || seen.size >= LIMIT) continue;
      seen.add(row.eventId);
      // Observed status is process-local. Even a forged "observed" save row
      // cannot be revived as live verified evidence after load.
      ledger[forLoad ? 'pending' : phase].push(row);
    }
  }
  const compare = (a, b) => a.eventId.localeCompare(b.eventId, 'en');
  ledger.observed.sort(compare);
  ledger.pending.sort(compare);
  return ledger;
}

/**
 * Called ONLY after the current BattleManager has resolved an actual result.
 * The battle object is inspected directly; result strings alone never suffice.
 * Recording has no authority to mutate quest objectives or player rewards.
 */
export function recordVerifiedBattleQuestEvent(ledger, {
  battle, currentDay, enemyParty = null, tradeRoutes = [], commanders = [],
} = {}) {
  if (!record(ledger) || !Array.isArray(ledger.observed)
    || !Array.isArray(ledger.pending) || !DAY(currentDay)
    || !record(battle) || battle.phase !== 'result'
    || !record(battle.battleResult)
    || !['victory', 'defeat'].includes(battle.result)
    || battle.result !== battle.battleResult.result
    || battle.battleResult.enemyId !== battle.enemyId
    || !Number.isSafeInteger(battle.resolvedAt) || battle.resolvedAt <= 0
    || battle.battleResult.winner !== (battle.result === 'victory' ? 'player' : 'enemy')) return false;
  // A battle's location is NOT a trade route ID. Source party must be
  // explicitly assigned to a real world route/commander for objective proof.
  const sameParty = record(enemyParty) && enemyParty.id === battle.enemyId
    && enemyParty.factionId === battle.battleResult.enemyFactionId;
  const bandit = sameParty && enemyParty.encounterType === 'bandit'
    && (enemyParty.worldPartyKind === 'bandit' || enemyParty.kind === 'bandit');
  const routeId = bandit && typeof enemyParty.routeId === 'string'
    && Array.isArray(tradeRoutes) && tradeRoutes.some((route) => route?.id === enemyParty.routeId)
    ? enemyParty.routeId : null;
  const commanderId = sameParty && typeof enemyParty.commanderId === 'string'
    && Array.isArray(commanders) && commanders.some((commander) => commander?.id === enemyParty.commanderId)
    ? enemyParty.commanderId : null;
  const row = normalizeRow({
    eventId: `battle:${battle.enemyId}:${battle.resolvedAt}`,
    source: 'battle_result',
    enemyId: battle.enemyId,
    enemyFactionId: battle.battleResult.enemyFactionId,
    result: battle.result, day: currentDay,
    ...(bandit ? { partyType: 'bandit' } : {}),
    ...(routeId ? { routeId } : {}),
    ...(commanderId ? { commanderId } : {}),
  });
  if (!row || ledger.observed.some((e) => e.eventId === row.eventId)
    || ledger.pending.some((e) => e.eventId === row.eventId)
    || ledger.observed.length + ledger.pending.length >= LIMIT) return false;
  ledger.observed.push(row);
  ledger.observed.sort((a, b) => a.eventId.localeCompare(b.eventId, 'en'));
  return true;
}

/**
 * Only the actual messenger party and successful, canonical 'seize' encounter
 * option establish messenger capture. Placeholder follow/info never count.
 */
export function recordVerifiedMessengerCaptureEvent(ledger, {
  encounter, enemyParty, choice, resolution, currentDay, resolvedAt,
} = {}) {
  if (!record(ledger) || !Array.isArray(ledger.observed)
    || !Array.isArray(ledger.pending) || !DAY(currentDay)
    || !record(encounter) || !record(enemyParty)
    || encounter.enemyId !== enemyParty.id
    || encounter.encounterType !== 'messenger'
    || enemyParty.encounterType !== 'messenger'
    || !['messenger'].includes(enemyParty.worldPartyKind || enemyParty.kind)
    || choice?.id !== 'seize' || choice?.outcome !== 'resource'
    || resolution?.optionId !== 'seize' || resolution?.success !== true
    || resolution?.captured !== true
    || !Number.isSafeInteger(resolvedAt) || resolvedAt <= 0) return false;
  const row = normalizeRow({
    eventId: `encounter:${enemyParty.id}:${resolvedAt}`,
    source: 'encounter_choice', enemyId: enemyParty.id,
    enemyFactionId: enemyParty.factionId, partyType: 'messenger',
    optionId: 'seize', result: 'messenger_caught', day: currentDay,
  });
  if (!row || ledger.observed.some((e) => e.eventId === row.eventId)
    || ledger.pending.some((e) => e.eventId === row.eventId)
    || ledger.observed.length + ledger.pending.length >= LIMIT) return false;
  ledger.observed.push(row);
  ledger.observed.sort((a, b) => a.eventId.localeCompare(b.eventId, 'en'));
  return true;
}

export function captureQuestEventLedger(ledger) {
  return normalizeQuestEventLedger(ledger);
}

export function restoreQuestEventLedger(input) {
  // Pending entries retain historical context but are NOT completion receipts.
  return normalizeQuestEventLedger(input, { forLoad: true });
}


/**
 * Only an in-memory, runtime-spawned escort party may produce arrival proof.
 * No generic city entry, contract or imported JSON field can trigger it.
 */
export function recordVerifiedCaravanArrivalEvent(ledger, {
  party, quest, worldState, tradeRoutes = [], currentDay, resolvedAt,
} = {}) {
  if (!record(ledger) || !Array.isArray(ledger.observed)
    || !Array.isArray(ledger.pending)
    || !DAY(currentDay) || !isLiveEscortParty(party)
    || party?.kind !== 'caravan' || party?.alive === false
    || party?.escortArrived !== true || party?.escortFailed === true
    || party?.escortStarted !== true
    || !Number.isFinite(party.escortHull) || party.escortHull <= 0
    || !Number.isFinite(party.escortCargo) || party.escortCargo <= 0
    || party?.escortVisitedPoints < 2 || party?.escortElapsedSeconds < 1
    || !Number.isSafeInteger(resolvedAt) || resolvedAt <= 0
    || quest?.status !== 'active' || quest?.templateId !== 'escort_first_caravan'
    || quest?.id !== party.escortQuestId || quest.createdAt > currentDay
    || (Number.isSafeInteger(quest?.timeLimitDays)
      && quest.createdAt + quest.timeLimitDays < currentDay)
    || party.routeId !== quest.targetRouteId) return false;
  const link = registeredTradeRoute(worldState, tradeRoutes, party.routeId);
  if (!link?.road || String(link.from.id) !== String(party.homeCityId)
    || String(link.to.id) !== String(party.escortDestinationCityId)
    || Math.hypot(party.x - link.to.x, party.y - link.to.y)
      > Math.max(64, Number(worldState?.tileSize || 32) * 2)) return false;
  const row = normalizeRow({
    eventId: `caravan:${party.id}:${resolvedAt}`,
    source: 'caravan_arrival', enemyId: party.id,
    enemyFactionId: party.factionId, partyType: 'caravan',
    result: 'caravan_arrived', questId: quest.id, routeId: link.routeId,
    fromCityId: String(link.from.id), toCityId: String(link.to.id),
    day: currentDay,
  });
  if (!row || ledger.observed.some(e => e.eventId === row.eventId)
    || ledger.pending.some(e => e.eventId === row.eventId)
    || ledger.observed.length + ledger.pending.length >= LIMIT) return false;
  ledger.observed.push(row);
  ledger.observed.sort((a, b) => a.eventId.localeCompare(b.eventId, 'en'));
  return true;
}


/** Route reconnaissance can only be logged after 1.5s live observation of
 * a factory-generated bandit on the exact generated road; saved ledger rows
 * are inert and a generic encounter cannot claim that route. */
export function recordVerifiedMissingCaravanReconEvent(ledger, {
  party, quest, worldState, tradeRoutes = [], worldParties = [],
  playerParty, currentDay, resolvedAt,
} = {}) {
  const target = quest?.objectives?.find(o => o.id === 'find_caravan_fate');
  const path = quest?.completionPaths?.find(p => p.id === 'bandits_identified');
  if (!record(ledger) || !Array.isArray(ledger.observed)
    || !Array.isArray(ledger.pending) || !DAY(currentDay)
    || !Number.isSafeInteger(resolvedAt) || resolvedAt <= 0
    || !isRuntimeRouteBandit(party) || !Array.isArray(worldParties)
    || !worldParties.includes(party) || party.alive === false
    || !hasWitnessedMissingCaravanBandits(party, quest?.id)
    || quest?.status !== 'active' || quest.templateId !== 'investigate_missing_caravan'
    || !Number.isSafeInteger(quest.createdAt) || quest.createdAt > currentDay
    || (Number.isSafeInteger(quest.timeLimitDays)
      && quest.createdAt + quest.timeLimitDays < currentDay)
    || target?.type !== 'investigate' || target?.outcome != null
    || target?.targetRouteId !== quest.targetRouteId
    || path?.requiredOutcome !== 'bandits_located'
    || !Number.isFinite(playerParty?.x) || !Number.isFinite(playerParty?.y)) return false;
  const link = validBanditRoute(party, worldState, tradeRoutes);
  if (!link?.road || link.routeId !== quest.targetRouteId
    || Math.hypot(playerParty.x - party.x, playerParty.y - party.y)
      > Math.max(64, Number(worldState?.tileSize || 32) * 4)) return false;
  const row = normalizeRow({
    eventId: `recon:${party.id}:${resolvedAt}`,
    source: 'route_recon', enemyId: party.id,
    enemyFactionId: 'bandits', partyType: 'bandit',
    result: 'bandits_located', questId: quest.id,
    routeId: link.routeId, day: currentDay,
  });
  if (!row || ledger.observed.some(e => e.eventId === row.eventId)
    || ledger.pending.some(e => e.eventId === row.eventId)
    || ledger.observed.length + ledger.pending.length >= LIMIT) return false;
  ledger.observed.push(row);
  ledger.observed.sort((a,b) => a.eventId.localeCompare(b.eventId,'en'));
  return true;
}
