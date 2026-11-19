import { describe, it, expect, vi } from 'vitest';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnPartyBandit } from '../../js/systems/world-ai.js';
import {
  isRuntimeRouteBandit, observeMissingCaravanBandits,
  witnessMissingCaravanEncounter,
} from '../../js/systems/quest-route-recon.js';
import {
  emptyQuestEventLedger, recordVerifiedMissingCaravanReconEvent,
  restoreQuestEventLedger,
} from '../../js/systems/quest-event-ledger.js';
import { creditQuestObjectivesForVerifiedEvent } from '../../js/systems/quest-event-matcher.js';
import { spawnQuestEscortCaravan, tickQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';

const map = {
  width: 30, height: 20, tileSize: 32,
  settlements: [
    { id: 0, x: 144, y: 208, tx: 4, ty: 6, type: 'city' },
    { id: 1, x: 336, y: 208, tx: 10, ty: 6, type: 'city' },
  ],
  roads: [{ from: 0, to: 1, path: [
    { x: 4, y: 6 }, { x: 7, y: 7 }, { x: 10, y: 6 },
  ] }],
};
const routes = [{ id: 'route:0:1', fromCityId: 0, toCityId: 1, roadBacked: true }];
function quest(template, id) {
  const src = QUEST_DEFS.find(q => q.id === template);
  return {
    ...JSON.parse(JSON.stringify(src).replaceAll('{{targetRouteId}}', routes[0].id)
      .replaceAll('{{issuerFactionId}}', 'ottoman')),
    id, templateId: template, status: 'active', createdAt: 3,
    targetRouteId: routes[0].id, issuerFactionId: 'ottoman',
  };
}
const manager = (q) => {
  const effects = [], overlays = [];
  const qm = new QuestManager({ pushOverlay: (...args) => overlays.push(args) },
    { applyEffect: effect => effects.push(effect) }, null);
  qm.addQuest(q);
  return { qm, effects, overlays };
};
const live = () => spawnPartyBandit(map, {}, { BANDIT_SPEED: 1 }, { tradeRoutes: routes });
function record(party, q, player, ledger = emptyQuestEventLedger()) {
  return recordVerifiedMissingCaravanReconEvent(ledger, {
    party, quest: q, worldState: map, tradeRoutes: routes,
    worldParties: [party], playerParty: player,
    currentDay: 4, resolvedAt: 1795090000001,
  });
}
describe('WEB V1.23 — observed missing caravan source and caravan threat', () => {
  it('credits the exact missing caravan task after real continuous route-bandit sighting', () => {
    const q = quest('investigate_missing_caravan', 'quest-recon-1');
    const p = live();
    const player = { x: p.x, y: p.y };
    expect(isRuntimeRouteBandit(p)).toBe(true);
    expect(p.routeId).toBe(routes[0].id);
    const f = (dt, x = player.x) => observeMissingCaravanBandits({
      quest: q, party: p, worldState: map, tradeRoutes: routes,
      playerParty: { x, y: player.y }, currentDay: 4, dtSec: dt,
    });
    expect(f(0.5)).toBe(false);
    expect(f(0.5)).toBe(false);
    expect(f(0.5)).toBe(true);
    const ledger = emptyQuestEventLedger();
    expect(record(p, q, player, ledger)).toBe(true);
    const { qm, effects, overlays } = manager(q);
    const eventId = ledger.observed[0].eventId;
    expect(ledger.observed[0]).toMatchObject({
      source: 'route_recon', questId: q.id, routeId: routes[0].id,
      result: 'bandits_located',
    });
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: qm, eventId,
    })).toHaveLength(1);
    expect(q.objectives[0].outcome).toBe('bandits_located');
    expect(overlays).toHaveLength(1);
    expect(effects).toEqual([]);
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: qm, eventId,
    })).toEqual([]);
    expect(qm.completeQuest(q.id, 'bandits_identified')).toBe(true);
    expect(effects).toEqual([
      { type: 'change_player_gold', amount: 100 },
      { type: 'change_player_reputation', amount: 1 },
    ]);
  });

  it('recon observation resets when the player leaves the sight radius', () => {
    const q = quest('investigate_missing_caravan', 'quest-recon-reset');
    const p = live();
    const watch = (px, sec) => observeMissingCaravanBandits({
      quest: q, party: p, worldState: map, tradeRoutes: routes,
      playerParty: { x: px, y: p.y }, currentDay: 4, dtSec: sec,
    });
    expect(watch(p.x, 0.75)).toBe(false);
    expect(watch(p.x + 900, 0.3)).toBe(false);
    expect(watch(p.x, 0.8)).toBe(false);
    expect(watch(p.x, 0.75)).toBe(true);
    const bad = { ...p, x: p.x, y: p.y };
    expect(isRuntimeRouteBandit(bad)).toBe(false);
    expect(observeMissingCaravanBandits({
      quest: q, party: bad, worldState: map, tradeRoutes: routes,
      playerParty: { x: p.x, y: p.y }, currentDay: 4, dtSec: 1,
    })).toBe(false);
  });

  it('recognizes a true bandit encounter, but never a forged encounter mapping or distant encounter', () => {
    const q = quest('investigate_missing_caravan', 'quest-recon-encounter');
    const p = live();
    const enemyId = `wai-${p.id}`;
    const ctx = {
      quest: q, party: p, worldState: map, tradeRoutes: routes,
      playerParty: { x: p.x, y: p.y }, enemyId,
      encounter: { enemyId },
      worldEncounterPartyByEnemyId: { [enemyId]: p.id }, currentDay: 4,
    };
    expect(witnessMissingCaravanEncounter({
      ...ctx, encounter: { enemyId: 'different' },
    })).toBe(false);
    expect(witnessMissingCaravanEncounter({
      ...ctx, playerParty: { x: p.x + 2000, y: p.y },
    })).toBe(false);
    expect(record(p, q, ctx.playerParty)).toBe(false);
    expect(witnessMissingCaravanEncounter(ctx)).toBe(true);
    expect(record(p, q, ctx.playerParty)).toBe(true);
  });

  it('blocks imported/fake/old route party and pending saved events as authority', () => {
    const q = quest('investigate_missing_caravan', 'quest-recon-forged');
    const p = live();
    const fake = { ...p };
    expect(record(fake, q, { x: fake.x, y: fake.y })).toBe(false);
    const forgedLedger = restoreQuestEventLedger({
      version: 1, observed: [{
        eventId: 'recon:bandit-fake:1795090000001',
        source: 'route_recon', enemyId: 'bandit-fake',
        enemyFactionId: 'bandits', partyType: 'bandit',
        result: 'bandits_located', questId: q.id,
        routeId: routes[0].id, day: 4,
      }], pending: [],
    });
    expect(forgedLedger.observed).toEqual([]);
    expect(forgedLedger.pending).toHaveLength(1);
    const { qm } = manager(q);
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger: forgedLedger, questManager: qm,
      eventId: forgedLedger.pending[0].eventId,
    })).toEqual([]);
    expect(qm.completeQuest(q.id, 'bandits_identified')).not.toBe(true);
  });

  it('cannot borrow another quest ID, route or expired timeline', () => {
    const q = quest('investigate_missing_caravan', 'quest-recon-bound');
    const p = live();
    const player = { x: p.x, y: p.y };
    witnessMissingCaravanEncounter({
      quest: q, party: p, worldState: map, tradeRoutes: routes,
      playerParty: player, enemyId: `wai-${p.id}`,
      encounter: { enemyId: `wai-${p.id}` },
      worldEncounterPartyByEnemyId: { [`wai-${p.id}`]: p.id }, currentDay: 4,
    });
    const ledger = emptyQuestEventLedger();
    expect(record(p, q, player, ledger)).toBe(true);
    const wrong = quest('investigate_missing_caravan', 'quest-recon-other');
    const { qm } = manager(wrong);
    expect(creditQuestObjectivesForVerifiedEvent({
      ledger, questManager: qm, eventId: ledger.observed[0].eventId,
    })).toEqual([]);
    expect(wrong.objectives[0].outcome).toBeUndefined();
    q.timeLimitDays = 0;
    expect(record(p, q, player, emptyQuestEventLedger())).toBe(false);
  });

  it('an escorted caravan pauses at a real nearby bandit threat, not an invented result', () => {
    const q = quest('escort_first_caravan', 'quest-threat');
    const p = spawnQuestEscortCaravan(q, map, routes, 4, 2);
    const player = { x: p.x, y: p.y };
    expect(tickQuestEscortCaravan(p, {
      quest: q, worldState: map, tradeRoutes: routes,
      playerParty: player, currentDay: 4, dtSec: 0.2, threat: true,
    }).status).toBe('under_threat');
    expect(p.escortStarted).toBe(true);
    expect(p.escortVisitedPoints).toBe(0);
    expect(p.escortElapsedSeconds).toBe(0);
    expect(tickQuestEscortCaravan(p, {
      quest: q, worldState: map, tradeRoutes: routes,
      playerParty: player, currentDay: 4, dtSec: 0.2, threat: false,
    }).status).toBe('moving');
    expect(p.escortElapsedSeconds).toBeGreaterThan(0);
    expect(q.objectives[0].outcome).toBeUndefined();
  });
});
