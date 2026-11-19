/**
 * WEB Character System v2 V1.16 — bounded, non-authoritative quest event ledger.
 *
 * In-session observations originate at existing gameplay resolution points.
 * Saved entries are forever PENDING history on reload: a local save is not
 * independent evidence of battle/quest victory and MUST NOT unlock rewards.
 * This version intentionally has no objective-outcome mapping.
 */
export const QUEST_EVENT_LEDGER_VERSION = 1;
const LIMIT = 1024;
const EVENT_ID = /^battle:[a-zA-Z0-9_.:-]{1,128}:[1-9]\d{0,15}$/;
const ENTITY_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const DAY = (day) => Number.isSafeInteger(day) && day >= 1 && day <= 10000000;
const record = (item) => item && typeof item === 'object' && !Array.isArray(item);

export function emptyQuestEventLedger() {
  return { version: QUEST_EVENT_LEDGER_VERSION, observed: [], pending: [] };
}

function normalizeRow(row) {
  if (!record(row) || row.source !== 'battle_result'
    || typeof row.eventId !== 'string' || !EVENT_ID.test(row.eventId)
    || typeof row.enemyId !== 'string' || !ENTITY_ID.test(row.enemyId)
    || typeof row.enemyFactionId !== 'string' || !ENTITY_ID.test(row.enemyFactionId)
    || !['victory', 'defeat'].includes(row.result) || !DAY(row.day)) return null;
  const parts = row.eventId.split(':');
  if (parts.length !== 3 || parts[1] !== row.enemyId) return null;
  return {
    eventId: row.eventId, source: 'battle_result',
    enemyId: row.enemyId, enemyFactionId: row.enemyFactionId,
    result: row.result, day: row.day,
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
export function recordVerifiedBattleQuestEvent(ledger, { battle, currentDay } = {}) {
  if (!record(ledger) || !Array.isArray(ledger.observed)
    || !Array.isArray(ledger.pending) || !DAY(currentDay)
    || !record(battle) || battle.phase !== 'result'
    || !record(battle.battleResult)
    || !['victory', 'defeat'].includes(battle.result)
    || battle.result !== battle.battleResult.result
    || battle.battleResult.enemyId !== battle.enemyId
    || !Number.isSafeInteger(battle.resolvedAt) || battle.resolvedAt <= 0
    || battle.battleResult.winner !== (battle.result === 'victory' ? 'player' : 'enemy')) return false;
  const row = normalizeRow({
    eventId: `battle:${battle.enemyId}:${battle.resolvedAt}`,
    source: 'battle_result',
    enemyId: battle.enemyId,
    enemyFactionId: battle.battleResult.enemyFactionId,
    result: battle.result, day: currentDay,
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
