import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnPartyBandit, updateWorldParties } from '../../js/systems/world-ai.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import {
  reserveEscortCargo, recordEscortCargoRaid, inspectLiveBanditCargo,
  inspectLiveEscortCargo, returnGuardRecoveredEscortCargo,
  witnessBanditCargoBattleVictory, recoverWitnessedBanditCargo,
  previewWitnessedBanditCargo, inspectCargoDispositions,
  disposeLiveBanditCargo, outstandingEscortCargoForSave,
} from '../../js/systems/quest-escort-cargo.js';

const catalog = [
  { id: 'wheat', name: 'Wheat', unitValue: 10 },
  { id: 'iron', name: 'Iron', unitValue: 20 },
  { id: 'cloth', name: 'Cloth', unitValue: 30 },
];
const tradeRoutes = [{ id: 'route:0:1',
  fromCityId: 0, toCityId: 1, roadBacked: true }];
const worldMap = () => ({
  width: 30, height: 20, tileSize: 32,
  settlements: [
    { id: 0, type: 'city', x: 144, y: 208, tx: 4, ty: 6,
      marketStock: [
        { id: 'wheat', qty: 50 }, { id: 'iron', qty: 20 },
        { id: 'cloth', qty: 20 },
      ] },
    { id: 1, type: 'city', x: 336, y: 208, tx: 10, ty: 6,
      marketStock: [
        { id: 'wheat', qty: 4 }, { id: 'iron', qty: 5 },
        { id: 'cloth', qty: 6 },
      ] },
  ],
  roads: [{ from: 0, to: 1, path: [
    { x: 4, y: 6 }, { x: 7, y: 7 }, { x: 10, y: 6 },
  ] }],
});
const newQuest = id => {
  const def = QUEST_DEFS.find(x => x.id === 'escort_first_caravan');
  return {
    ...JSON.parse(JSON.stringify(def)
      .replaceAll('{{targetRouteId}}', 'route:0:1')
      .replaceAll('{{issuerFactionId}}', 'ottoman')),
    id, status: 'active', templateId: def.id, createdAt: 3,
    targetRouteId: 'route:0:1', issuerFactionId: 'ottoman',
  };
};
function build() {
  const worldState = worldMap();
  const quest = newQuest('v132-main');
  const caravan = spawnQuestEscortCaravan(quest, worldState, tradeRoutes, 4);
  const reserved = reserveEscortCargo({
    caravan, quest, worldState, tradeRoutes, currentDay: 4, catalog,
  });
  const bandit = spawnPartyBandit(worldState, {}, { BANDIT_SPEED: 0.01 },
    { tradeRoutes });
  const aiState = { lastRespawnDay: 0, parties: [bandit, caravan] };
  const stolen = recordEscortCargoRaid({
    caravan, bandit, remainingPercent: 75,
  });
  const enemyId = `wai-${bandit.id}`;
  const battle = {
    phase: 'result', result: 'victory', resolvedAt: 1795169200000,
    enemyId, battleResult: { result: 'victory', enemyId },
  };
  const witness = () => witnessBanditCargoBattleVictory({
    battle, bandit, worldAi: aiState, enemyId,
    linkedWorldPartyId: bandit.id, worldState, tradeRoutes,
  });
  return { worldState, quest, caravan, bandit, aiState, stolen,
    reserved, enemyId, battle, witness };
}
const qty = items => items.reduce((n, x) => n + x.qty, 0);
const eventsFor = bandit => inspectCargoDispositions(128).filter(x =>
  x.banditId === bandit.id);

describe('WEB V1.32 — source-verified bandit cargo dispositions', () => {
  it('previews actual won cargo in the battle UI, but preview never creates an entitlement', () => {
    const p = build();
    expect(previewWitnessedBanditCargo(p.battle)).toEqual([]);
    expect(p.witness()).toBe(true);
    const preview = previewWitnessedBanditCargo(p.battle);
    expect(preview).toEqual(p.stolen);
    preview[0].qty = 99999;
    expect(previewWitnessedBanditCargo(p.battle)).toEqual(p.stolen);
    const playerParty = { inventory: { items: [] } };
    expect(qty(recoverWitnessedBanditCargo({
      battle: p.battle, bandit: p.bandit, worldAi: p.aiState,
      enemyId: p.enemyId, linkedWorldPartyId: p.bandit.id,
      playerParty, catalog,
    }))).toBe(6);
    expect(previewWitnessedBanditCargo(p.battle)).toEqual([]);
    expect(eventsFor(p.bandit)).toEqual([
      expect.objectContaining({
        kind: 'player_recovered', reason: 'player_victory_claimed',
        goods: p.stolen,
        sources: [expect.objectContaining({
          fromId: '0', questId: p.quest.id, goods: p.stolen,
        })],
      }),
    ]);
    expect(disposeLiveBanditCargo({
      bandit: p.bandit, reason: 'player_victory_claimed', battle: p.battle,
    })).toBeNull();
    expect(qty(playerParty.inventory.items)).toBe(6);
  });

  it('forfeits genuine unclaimed cargo on skipped battle exit exactly once', () => {
    const p = build();
    expect(p.witness()).toBe(true);
    const before = qty(inspectLiveBanditCargo(p.bandit));
    expect(before).toBe(6);
    expect(disposeLiveBanditCargo({
      bandit: p.bandit, battle: p.battle,
      reason: 'player_victory_forfeited',
    })).toMatchObject({ kind: 'unrecovered_loss',
      reason: 'player_victory_forfeited', goods: p.stolen });
    expect(disposeLiveBanditCargo({
      bandit: p.bandit, battle: p.battle,
      reason: 'player_victory_forfeited',
    })).toBeNull();
    expect(inspectLiveBanditCargo(p.bandit)).toEqual([]);
    expect(previewWitnessedBanditCargo(p.battle)).toEqual([]);
    expect(eventsFor(p.bandit)).toHaveLength(1);
    expect(qty(inspectLiveEscortCargo(p.caravan))).toBe(18);
  });

  it('only a real victory receipt can forfeit player encounter loot', () => {
    const p = build();
    expect(disposeLiveBanditCargo({
      bandit: p.bandit, battle: p.battle,
      reason: 'player_victory_forfeited',
    })).toBeNull();
    expect(disposeLiveBanditCargo({
      bandit: { ...p.bandit }, reason: 'patrol_kill',
    })).toBeNull();
    const before = qty(inspectLiveBanditCargo(p.bandit));
    p.witness();
    const forgedBattle = { ...p.battle };
    expect(disposeLiveBanditCargo({
      bandit: p.bandit, battle: forgedBattle,
      reason: 'player_victory_forfeited',
    })).toBeNull();
    expect(qty(inspectLiveBanditCargo(p.bandit))).toBe(before);
    expect(eventsFor(p.bandit)).toEqual([]);
  });

  it('classifies actual baseline WorldAI patrol killing bandit without granting cargo', () => {
    const p = build();
    const patrol = {
      id: 'patrol-qa', kind: 'patrol', factionId: 'ottoman',
      x: p.bandit.x, y: p.bandit.y,
      targetX: p.bandit.x, targetY: p.bandit.y,
      speed: 0.01, alive: true,
    };
    p.aiState.parties.push(patrol);
    const beforeCity = p.worldState.settlements[0].marketStock
      .map(x => x.qty);
    const removed = [];
    updateWorldParties({
      aiState: p.aiState, worldState: p.worldState,
      tradeRoutes, playerParty: { x: p.bandit.x, y: p.bandit.y,
        factionId: 'player' },
      cfg: { BANDIT_SPEED: 0.01, DESPAWN_DISTANCE: 500,
        PATROL_AGGRO_RADIUS: 4 },
      dtSec: 0.01,
      onBanditRemoved: (bandit, reason) => {
        removed.push(reason);
        disposeLiveBanditCargo({ bandit, reason });
      },
    });
    expect(removed).toEqual(['patrol_kill']);
    expect(p.bandit.alive).toBe(false);
    expect(p.aiState.parties).not.toContain(p.bandit);
    expect(eventsFor(p.bandit)).toEqual([
      expect.objectContaining({
        kind: 'unrecovered_loss', reason: 'patrol_kill', goods: p.stolen,
      }),
    ]);
    expect(p.worldState.settlements[0].marketStock.map(x => x.qty))
      .toEqual(beforeCity);
    expect(inspectLiveBanditCargo(p.bandit)).toEqual([]);
  });

  it('classifies actual WorldAI distance despawn and cannot replay an old reward', () => {
    const p = build();
    const reasons = [];
    updateWorldParties({
      aiState: p.aiState, worldState: p.worldState, tradeRoutes,
      playerParty: { x: 100000, y: 100000, factionId: 'player' },
      cfg: { DESPAWN_DISTANCE: 2, PATROL_AGGRO_RADIUS: 0 },
      dtSec: 0.1,
      onBanditRemoved: (bandit, reason) => {
        reasons.push(reason);
        disposeLiveBanditCargo({ bandit, reason });
      },
    });
    expect(reasons).toEqual(['out_of_range']);
    expect(eventsFor(p.bandit)[0]).toMatchObject({
      kind: 'unrecovered_loss', reason: 'out_of_range',
      goods: p.stolen,
    });
    expect(p.witness()).toBe(false);
    expect(inspectLiveBanditCargo(p.bandit)).toEqual([]);
  });

  it('audits full guard recovery plus the loss of other convoy goods separately', () => {
    const p = build();
    const second = newQuest('v132-second');
    const caravan2 = spawnQuestEscortCaravan(second, p.worldState, tradeRoutes, 4);
    const reserved2 = reserveEscortCargo({
      caravan: caravan2, quest: second, worldState: p.worldState,
      tradeRoutes, currentDay: 4, catalog,
    });
    expect(qty(reserved2)).toBeGreaterThan(0);
    const secondLoot = recordEscortCargoRaid({
      caravan: caravan2, bandit: p.bandit, remainingPercent: 75,
    });
    expect(qty(secondLoot)).toBeGreaterThan(0);
    p.bandit.alive = false;
    const returned = returnGuardRecoveredEscortCargo({
      caravan: p.caravan, bandit: p.bandit, quest: p.quest,
      worldState: p.worldState, tradeRoutes, currentDay: 4,
    });
    expect(returned).toEqual(p.stolen);
    const lost = disposeLiveBanditCargo({
      bandit: p.bandit, reason: 'escort_guard_kill',
    });
    expect(lost).toMatchObject({
      kind: 'unrecovered_loss', reason: 'escort_guard_kill',
      goods: secondLoot,
      sources: [expect.objectContaining({
        fromId: '0', questId: second.id, goods: secondLoot,
      })],
    });
    expect(eventsFor(p.bandit)).toEqual([
      expect.objectContaining({ kind: 'guard_returned', goods: p.stolen }),
      expect.objectContaining({ kind: 'unrecovered_loss', goods: secondLoot }),
    ]);
    expect(qty(inspectLiveEscortCargo(p.caravan))).toBe(24);
    expect(qty(inspectLiveEscortCargo(caravan2))).toBe(qty(reserved2) - qty(secondLoot));
    expect(inspectLiveBanditCargo(p.bandit)).toEqual([]);
    // A disposed bandit is no longer available to snapshot-refund goods.
    expect(outstandingEscortCargoForSave([p.caravan, caravan2, p.bandit])
      .get('0').get('wheat')).toBeLessThan(24 + qty(reserved2));
  });

  it('diagnostic output is bounded, immutable to consumers and never a save claim', () => {
    const p = build();
    p.bandit.alive = false;
    disposeLiveBanditCargo({ bandit: p.bandit, reason: 'out_of_range' });
    const rows = inspectCargoDispositions(128);
    const row = rows.find(x => x.banditId === p.bandit.id);
    expect(row).toBeTruthy();
    row.goods[0].qty = 999999;
    row.sources[0].goods[0].qty = 999999;
    expect(eventsFor(p.bandit)[0].goods).toEqual(p.stolen);
    expect(inspectCargoDispositions(0)).toEqual([]);
    expect(inspectCargoDispositions(1000).length).toBeLessThanOrEqual(128);
    expect(JSON.parse(JSON.stringify(p.bandit))).not.toHaveProperty('loot');
    expect(JSON.parse(JSON.stringify(p.bandit))).not.toHaveProperty('cargoDispositions');
  });
});
