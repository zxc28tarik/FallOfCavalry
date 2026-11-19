import { describe, expect, it } from 'vitest';
import {
  emptyQuestEventLedger, normalizeQuestEventLedger, captureQuestEventLedger,
  recordVerifiedBattleQuestEvent, restoreQuestEventLedger,
} from '../../js/systems/quest-event-ledger.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const battle = () => ({
  phase: 'result', result: 'victory', resolvedAt: 1795082400000,
  enemyId: 'bandit_42',
  battleResult: {
    winner: 'player', result: 'victory',
    enemyId: 'bandit_42', enemyFactionId: 'bandits',
  },
});
const event = {
  eventId: 'battle:bandit_42:1795082400000', source: 'battle_result',
  enemyId: 'bandit_42', enemyFactionId: 'bandits', result: 'victory', day: 7,
};

describe('WEB V1.16: verified observations vs inert saved quest history', () => {
  it('starts empty for old saves and captures a bounded versioned record', () => {
    expect(emptyQuestEventLedger()).toEqual({ version: 1, observed: [], pending: [] });
    const norm = new SaveSystem().normalizePayload({ schemaVersion: 1, game: {} });
    expect(norm.data.game.questEventLedger).toEqual(emptyQuestEventLedger());
    expect(captureQuestEventLedger(null)).toEqual(emptyQuestEventLedger());
  });

  it('accepts a real finished battle once, not an arbitrary outcome or duplicate', () => {
    const ledger = emptyQuestEventLedger();
    const resolved = battle();
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: resolved, currentDay: 7 })).toBe(true);
    expect(ledger.observed).toEqual([event]);
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: resolved, currentDay: 7 })).toBe(false);
    expect(ledger.observed).toHaveLength(1);
    const fake = battle();
    fake.battleResult.result = 'defeat';
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: fake, currentDay: 7 })).toBe(false);
    fake.battleResult.result = 'victory';
    fake.phase = 'playing';
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: fake, currentDay: 7 })).toBe(false);
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: battle(), currentDay: -1 })).toBe(false);
  });

  it('retains canonical colon-separated enemy IDs without losing source identity', () => {
    const complex = battle();
    complex.enemyId = 'world:party:42';
    complex.battleResult.enemyId = 'world:party:42';
    const ledger = emptyQuestEventLedger();
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: complex, currentDay: 7 })).toBe(true);
    const loaded = restoreQuestEventLedger(captureQuestEventLedger(ledger));
    expect(loaded.pending[0].enemyId).toBe('world:party:42');
    expect(loaded.pending[0].eventId).toBe('battle:world:party:42:1795082400000');
    expect(loaded.observed).toEqual([]);
  });

  it('retains well-formed saved events ONLY as pending history, never live proof', () => {
    const ledger = emptyQuestEventLedger();
    expect(recordVerifiedBattleQuestEvent(ledger, { battle: battle(), currentDay: 7 })).toBe(true);
    const saved = captureQuestEventLedger(ledger);
    expect(saved.observed).toEqual([event]);
    const loaded = restoreQuestEventLedger(saved);
    expect(loaded.observed).toEqual([]);
    expect(loaded.pending).toEqual([event]);
    expect(recordVerifiedBattleQuestEvent(loaded, { battle: battle(), currentDay: 7 })).toBe(false);
    expect(captureQuestEventLedger(loaded).pending).toEqual([event]);
  });

  it('rejects invented IDs, impossible results, excess records and forged live status', () => {
    const forged = normalizeQuestEventLedger({
      version: 1, observed: [
        { ...event, eventId: 'battle:unrelated:1795082400000' },
        { ...event, result: 'commander_captured' },
        { ...event, enemyId: '<script>' },
        { ...event, day: 999999999 },
        event, event,
      ],
      pending: [event],
    }, { forLoad: true });
    expect(forged.observed).toEqual([]);
    expect(forged.pending).toEqual([event]);
    const wrongVersion = normalizeQuestEventLedger({ version: 999, observed: [event] });
    expect(wrongVersion).toEqual(emptyQuestEventLedger());
  });

  it('does not make saved battle entries unlock quest objectives or rewards', () => {
    const manager = new QuestManager(null, { applyEffect: () => {
      throw new Error('Should not grant reward'); 
    } }, null);
    manager.addQuest({
      id: 'quest_ledger_test', templateId: 'secure_trade_route',
      status: 'active', objectives: [{ id: 'resolve_bandit_threat' }],
      completionPaths: [{ id: 'defeat_bandits', requiredOutcome: 'bandits_defeated',
        rewards: { gold: 300 } }],
    });
    const untrusted = restoreQuestEventLedger({ version: 1, observed: [event], pending: [] });
    expect(untrusted.observed).toHaveLength(0);
    expect(manager.activeQuests[0].objectives[0].outcome).toBeUndefined();
    expect(manager.completeQuest('quest_ledger_test', 'defeat_bandits')).toBeUndefined();
  });

  it('roundtrips safely through the existing SaveManager and SaveSystem sidecar', () => {
    const state = { mode: 'map', day: 7,
      map: { settlements: [] }, questEventLedger: emptyQuestEventLedger(),
    };
    recordVerifiedBattleQuestEvent(state.questEventLedger, {
      battle: battle(), currentDay: state.day,
    });
    const manager = new SaveManager(state);
    manager.init({
      playerParty: { gold: 0, roster: [] }, itemCatalog: [], settings: {},
      worldManager: { enemyParties: [], worldAi: { lastRespawnDay: 0, parties: [] },
        lastEncounterEndTimeByEnemyId: {} },
      ensureInventoryModel: () => {}, ensureRosterState: () => {},
    });
    const payload = manager.buildSavePayload();
    expect(payload.game.questEventLedger.observed).toHaveLength(1);
    const parsed = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(payload)));
    expect(parsed.data.game.questEventLedger.observed).toEqual([]);
    expect(parsed.data.game.questEventLedger.pending).toEqual([event]);
  });
});
