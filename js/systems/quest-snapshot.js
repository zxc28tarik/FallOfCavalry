/**
 * WEB V1.14 — canonical, bounded, fail-closed quest snapshot.
 *
 * Save files are NOT authority for templates, rewards, world effects,
 * completion paths, objective evidence or quest participant appointments.
 * Resuming reconstructs quests from the current shipped QUEST_DEFS.
 * Prior objective "outcomes" are retained only as INERT claims, never
 * treated as verified path-completion evidence on load.
 */
import { QUEST_DEFS } from '../data/quest-defs.js';

export const QUEST_SNAPSHOT_VERSION = 1;
const LIMIT = 512;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{1,127}$/;
// Canonical world settlement IDs can be a single numeric token ('0'..'880').
const WORLD_TARGET_ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const DAY = (x) => Number.isSafeInteger(x) && x >= 0 && x <= 10000000;
const isRecord = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const targetFields = Object.freeze([
  'targetCityId', 'targetRouteId', 'targetRegionId',
  'targetFortId', 'targetCommanderId', 'nearestCityId', 'issuerFactionId',
]);
const onlyId = (x) => typeof x === 'string' && ID.test(x);

export function emptyQuestSnapshot() {
  return { version: QUEST_SNAPSHOT_VERSION, active: [], completed: [], failed: [] };
}

function normalizeRow(row, phase) {
  if (!isRecord(row) || !onlyId(row.id) || !onlyId(row.templateId)) return null;
  const template = QUEST_DEFS.find((def) => def.id === row.templateId);
  if (!template) return null;
  if (phase === 'active') {
    if (!['active', 'available'].includes(row.status) || !DAY(row.createdAt)
      || !isRecord(row.targets)) return null;
    const targets = {};
    for (const key of targetFields) {
      const value = row.targets[key] ?? null;
      if (value !== null && !(typeof value === 'string' && WORLD_TARGET_ID.test(value))
        && !(Number.isSafeInteger(value) && value >= 0)) return null;
      targets[key] = value === null ? null : String(value);
    }
    const priorClaims = Array.isArray(row.objectiveClaims) ? row.objectiveClaims : [];
    if (priorClaims.length > 32) return null;
    const allowedOutcomes = new Set(template.completionPaths.map((p) => p.requiredOutcome).filter(Boolean));
    const allowedObjectives = new Set(template.objectives.map((o) => o.id));
    const claims = [];
    const seen = new Set();
    for (const claim of priorClaims) {
      if (!isRecord(claim) || !allowedObjectives.has(claim.objectiveId)
        || !allowedOutcomes.has(claim.outcome) || seen.has(claim.objectiveId)) return null;
      seen.add(claim.objectiveId);
      claims.push({ objectiveId: claim.objectiveId, outcome: claim.outcome });
    }
    if (row.assignedCharacterId != null && (typeof row.assignedCharacterId !== 'string'
      || !/^npc:[^\s<>]{1,400}:[1-9]\d{0,6}$/.test(row.assignedCharacterId))) return null;
    return {
      id: row.id, templateId: row.templateId, status: row.status,
      createdAt: row.createdAt, targets,
      assignedCharacterId: row.assignedCharacterId ?? null, objectiveClaims: claims,
    };
  }
  if (phase === 'completed') {
    if (!onlyId(row.pathId)
      || !template.completionPaths.some((p) => p.id === row.pathId)) return null;
    return { id: row.id, templateId: row.templateId, pathId: row.pathId };
  }
  if (phase === 'failed') {
    if (typeof row.reason !== 'string' || row.reason.trim().length === 0
      || row.reason.length > 120 || /[<>\r\n\t]/.test(row.reason)) return null;
    return { id: row.id, templateId: row.templateId, reason: row.reason.trim() };
  }
  return null;
}

export function normalizeQuestSnapshot(input) {
  const result = emptyQuestSnapshot();
  if (!isRecord(input) || input.version !== QUEST_SNAPSHOT_VERSION) return result;
  const seen = new Set();
  for (const phase of ['active', 'completed', 'failed']) {
    if (!Array.isArray(input[phase])) continue;
    for (const item of input[phase].slice(0, LIMIT)) {
      const row = normalizeRow(item, phase);
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      result[phase].push(row);
    }
    result[phase].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  }
  return result;
}

function targetsFromQuest(quest) {
  return Object.fromEntries(targetFields.map((key) => [key, quest?.[key] ?? null]));
}

export function captureQuestSnapshot(questManager) {
  const active = (questManager?.activeQuests || []).map((quest) => ({
    id: quest.id, templateId: quest.templateId,
    status: quest.status, createdAt: quest.createdAt,
    targets: targetsFromQuest(quest),
    assignedCharacterId: quest.assignedCharacterId ?? null,
    // Any objective claim loaded from a save stays pending; runtime outcomes
    // must not be allowed to transitively "verify" older save contents.
    objectiveClaims: (() => {
      const activeOutcomes = (quest.objectives || [])
        .filter((o) => o.outcome != null)
        .map((o) => ({ objectiveId: o.id, outcome: o.outcome }));
      const savedClaims = Array.isArray(quest.pendingObjectiveClaims)
        ? quest.pendingObjectiveClaims : [];
      const liveIds = new Set(activeOutcomes.map(c => c.objectiveId));
      return [...activeOutcomes, ...savedClaims.filter(c => !liveIds.has(c.objectiveId))];
    })(),
  }));
  const completed = (questManager?.completedQuests || []).map((q) => ({
    id: q.id, templateId: q.templateId, pathId: q.completedPath,
  }));
  const failed = (questManager?.failedQuests || []).map((q) => ({
    id: q.id, templateId: q.templateId, reason: q.failReason || 'unspecified',
  }));
  return normalizeQuestSnapshot({
    version: QUEST_SNAPSHOT_VERSION, active, completed, failed,
  });
}

function knownTarget(targets, { settlements = [], tradeRoutes = [], commanders = [], regionIds = [], factionIds = [] } = {}) {
  const settlementsById = new Map(settlements.filter((s) => s?.id != null)
    .map((s) => [String(s.id), s]));
  const city = (id) => id == null || settlementsById.has(id);
  const t = targets;
  if (!city(t.targetCityId) || !city(t.nearestCityId)
    || (t.targetFortId != null && !(
      settlementsById.has(t.targetFortId)
      && /fort|castle/i.test(String(settlementsById.get(t.targetFortId)?.type || ''))))
    || (t.targetRouteId != null
      && !tradeRoutes.some((r) => r?.id === t.targetRouteId))
    || (t.targetCommanderId != null
      && !commanders.some((x) => x?.id === t.targetCommanderId))
    || (t.targetRegionId != null && !regionIds.includes(t.targetRegionId)
      && !(t.targetRegionId.startsWith('region:')
        && settlementsById.has(t.targetRegionId.slice(7))))
    || (t.issuerFactionId != null && factionIds.length > 0
      && !factionIds.includes(t.issuerFactionId))) return false;
  return true;
}

function reconstruct(row, context) {
  const template = QUEST_DEFS.find((q) => q.id === row.templateId);
  if (!template || !knownTarget(row.targets, context)) return null;
  // Escape-safe whitelist in normalizeRow prevents JSON injection.
  const serialized = JSON.stringify(template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g,
    (token, key) => row.targets[key] ?? token);
  if (/\{\{[a-zA-Z0-9_]+\}\}/.test(serialized)) return null;
  let instance;
  try { instance = JSON.parse(serialized); } catch { return null; }
  return {
    ...instance,
    id: row.id, templateId: row.templateId,
    createdAt: row.createdAt, status: row.status,
    ...row.targets,
    // NO objective outcomes or assignedCharacterId are trusted from save.
    pendingObjectiveClaims: row.objectiveClaims,
  };
}

/**
 * Restores a canonical quest graph without calling QuestManager.addQuest,
 * completeQuest, failQuest, overlays or WorldEffectManager.
 *
 * Rejected/expired entries are not created in runtime. Completed/failed
 * entries are archival ID locks only (archived:true), not reward receipts.
 */
export function restoreQuestSnapshot(questManager, input, {
  currentDay, ...context
} = {}) {
  const snapshot = normalizeQuestSnapshot(input);
  if (!Array.isArray(questManager?.activeQuests)
    || !Array.isArray(questManager?.completedQuests)
    || !Array.isArray(questManager?.failedQuests)) {
    return { restored: 0, rejected: snapshot.active.length, acceptedIds: [] };
  }
  const active = [];
  let rejected = 0;
  for (const row of snapshot.active) {
    const quest = reconstruct(row, context);
    if (!quest || !DAY(currentDay) || row.createdAt > currentDay
      || (Number.isSafeInteger(quest.timeLimitDays)
        && quest.createdAt + quest.timeLimitDays < currentDay)) {
      rejected += 1;
      continue;
    }
    active.push(quest);
  }
  questManager.activeQuests = active;
  questManager.completedQuests = snapshot.completed.map((x) => ({
    id: x.id, templateId: x.templateId,
    status: 'completed', completedPath: x.pathId,
    objectives: [], archived: true,
  }));
  questManager.failedQuests = snapshot.failed.map((x) => ({
    id: x.id, templateId: x.templateId,
    status: 'failed', failReason: x.reason, archived: true,
  }));
  return {
    restored: active.length, rejected,
    acceptedIds: active.map((q) => q.id),
  };
}
