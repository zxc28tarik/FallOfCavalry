import { describe, it, expect, vi } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { QuestManager } from '../../js/managers/QuestManager.js';
import WorldPartyManager from '../../js/managers/WorldPartyManager.js';
import { WorldSimManager } from '../../js/managers/WorldSimManager.js';
import QuestEscortHud from '../../js/ui/QuestEscortHud.js';
import { createInitialWorldAiState, spawnPartyBandit, removeWorldParty } from '../../js/systems/world-ai.js';
import { linkedEscortBattleThreat } from '../../js/systems/quest-escort-threat-battle.js';

const map = {
  width: 40, height: 20, tileSize: 32,
  settlements: [
    { id: 0, type: 'city', tx: 4, ty: 6, x: 144, y: 208 },
    { id: 1, type: 'city', tx: 16, ty: 6, x: 528, y: 208 },
  ],
  roads: [{ from: 0, to: 1, path: [
    { x: 4, y: 6 }, { x: 10, y: 6 }, { x: 16, y: 6 },
  ] }],
};
const routes = [{ id: 'route:0:1', fromCityId: 0, toCityId: 1, roadBacked: true }];
function quest(id = 'quest_guard_24') {
  const data = QUEST_DEFS.find(q => q.id === 'escort_first_caravan');
  const copy = JSON.parse(JSON.stringify(data)
    .replaceAll('{{targetRouteId}}', routes[0].id)
    .replaceAll('{{issuerFactionId}}', 'ottoman'));
  return { ...copy, id, templateId: data.id, status: 'active', createdAt: 3,
    targetRouteId: routes[0].id, issuerFactionId: 'ottoman' };
}
function fixture() {
  const effects = [];
  const qm = new QuestManager({ pushOverlay: vi.fn() },
    { applyEffect: e => effects.push(e) }, null);
  qm.addQuest(quest());
  const state = { mode: 'map', day: 4, map };
  const world = { state, worldAi: createInitialWorldAiState(), enemyParties: [] };
  const playerParty = { x: 144, y: 208, gold: 0, speed: 150,
    hasDestination: false, moveState: 'idle', selected: true };
  const game = {
    state, playerParty, questManager: qm, worldManager: world,
    economyManager: { ensureTradeRoutes: () => routes },
    getWorldAiCfgWithRegionMods: () => ({
      MAX_BANDIT_PARTIES: 0, MAX_PATROL_PARTIES: 0, MAX_CARAVAN_PARTIES: 0,
      MAX_REFUGEE_PARTIES: 0, MAX_TRAVELING_MERCHANT_PARTIES: 0,
      MAX_MESSENGER_PARTIES: 0, MAX_VILLAGER_PARTIES: 0, MAX_NOBLE_PARTIES: 0,
      CARAVAN_SPEED: 1.4,
    }),
    getBanditCapWithEvents: () => 0,
  };
  const manager = new WorldPartyManager();
  manager.init(world, game);
  manager.ensureWorldParties();
  const caravan = world.worldAi.parties.find(p => p.escortQuestId);
  const bandit = spawnPartyBandit(map, {}, { BANDIT_SPEED: 0.01 },
    { tradeRoutes: routes });
  bandit.x = caravan.x + 32; bandit.y = caravan.y;
  world.worldAi.parties.push(bandit);
  return { world, game, manager, qm, effects, caravan, bandit, playerParty };
}
const battle = (bandit, result, resolvedAt = 1795094200000) => ({
  enemyId: `wai-${bandit.id}`, phase: 'result', result, resolvedAt,
  battleResult: {
    enemyId: `wai-${bandit.id}`, enemyFactionId: 'bandits', result,
    winner: result === 'victory' ? 'player' : 'enemy',
  },
});
function context(f, b) {
  return { battle: b, enemyId: b.enemyId, linkedWorldPartyId: f.bandit.id };
}

describe('WEB V1.24 — genuine guarded escort combat', () => {
  it('counts only a live same-route guard victory, without creating any reward', () => {
    const f = fixture();
    const b = battle(f.bandit, 'victory');
    expect(linkedEscortBattleThreat({
      ...context(f, b), worldAi: f.world.worldAi, questManager: f.qm,
      worldState: map, tradeRoutes: routes, currentDay: 4,
    })).toMatchObject({ quest: f.qm.activeQuests[0],
      caravan: f.caravan, bandit: f.bandit, result: 'victory' });
    expect(f.manager.recordEscortGuardBattle(context(f, b))).toMatchObject({
      relevant: true, defended: true, retainBandit: false,
    });
    expect(f.caravan.escortDefended).toBe(1);
    expect(f.effects).toEqual([]);
    expect(f.qm.completedQuests).toEqual([]);
    expect(f.manager.recordEscortGuardBattle(context(f, b))).toMatchObject({
      relevant: true, defended: false,
    });
    expect(f.caravan.escortDefended).toBe(1);
    // The production exit removes the single defeated world threat.
    removeWorldParty(f.world.worldAi, f.bandit.id);
    f.manager.updateWorldParties(0.1);
    expect(f.caravan.escortElapsedSeconds).toBeGreaterThan(0);
    expect(f.qm.activeQuests).toHaveLength(1);
  });

  it('retains the actual victorious bandit on guard defeat and applies the canonical escort failure once', () => {
    const f = fixture();
    const outcome = f.manager.recordEscortGuardBattle(context(f, battle(f.bandit, 'defeat')));
    expect(outcome).toMatchObject({ relevant: true, retainBandit: true, failed: true });
    expect(f.qm.activeQuests).toHaveLength(0);
    expect(f.qm.failedQuests).toMatchObject([{
      failReason: 'escort_guard_defeated', status: 'failed',
    }]);
    expect(f.caravan.alive).toBe(false);
    expect(f.bandit.alive).toBe(true);
    expect(f.world.worldAi.parties).toContain(f.bandit);
    expect(f.effects).toEqual([{
      type: 'damage_trade_route', routeId: routes[0].id, amount: 2,
    }]);
    expect(f.manager.recordEscortGuardBattle(context(f, battle(f.bandit, 'defeat')))
      .relevant).toBe(false);
    expect(f.effects).toHaveLength(1);
  });

  it('never accepts a clone, distant bandit, other enemy ID or fabricated victory result', () => {
    const f = fixture();
    const original = battle(f.bandit, 'victory');
    const src = () => ({
      ...context(f, original), worldAi: f.world.worldAi,
      questManager: f.qm, worldState: map, tradeRoutes: routes, currentDay: 4,
    });
    expect(linkedEscortBattleThreat({
      ...src(), linkedWorldPartyId: 'made-up-bandit',
    })).toBeNull();
    const fake = { ...f.bandit, id: f.bandit.id };
    f.world.worldAi.parties = [f.caravan, fake];
    expect(linkedEscortBattleThreat(src())).toBeNull();
    f.world.worldAi.parties = [f.caravan, f.bandit];
    const farX = f.bandit.x;
    f.bandit.x = 999;
    expect(linkedEscortBattleThreat(src())).toBeNull();
    f.bandit.x = farX;
    expect(linkedEscortBattleThreat({
      ...src(), battle: { ...original,
        battleResult: { ...original.battleResult, winner: 'enemy' } },
    })).toBeNull();
    expect(linkedEscortBattleThreat({
      ...src(), tradeRoutes: [{ ...routes[0], id: 'route:other' }],
    })).toBeNull();
    expect(f.caravan.escortDefended).toBe(0);
    expect(f.effects).toEqual([]);
  });

  it('actual player motion can follow a moving convoy across a multi-waypoint road, without teleport', () => {
    const f = fixture();
    removeWorldParty(f.world.worldAi, f.bandit.id);
    f.caravan.x = 400;
    const hud = new QuestEscortHud(f.game);
    f.game.questEscortHud = hud;
    hud._party = f.caravan;
    hud.followId = f.caravan.id;
    f.playerParty.x = 140;
    const world = {
      state: f.game.state, getMovementContextAt: () => ({
        terrainLabel: 'road', speedMult: 1, blocked: false,
      }),
      clampToWorld: (x, y) => ({ x, y }),
      completePlayerArrival: () => {
        f.playerParty.x = f.playerParty.destX;
        f.playerParty.y = f.playerParty.destY;
        f.playerParty.hasDestination = false;
      },
    };
    const sim = new WorldSimManager();
    sim.init(world, f.game);
    const x0 = f.playerParty.x;
    for (let i = 0; i < 24; i++) {
      f.caravan.x += 5;
      sim.updatePlayerParty(0.1);
    }
    expect(f.playerParty.x).toBeGreaterThan(x0 + 70);
    expect(f.playerParty.x).toBeLessThan(f.caravan.x);
    expect(hud.followId).toBe(f.caravan.id);
    expect(Math.hypot(f.playerParty.x - f.caravan.x,
      f.playerParty.y - f.caravan.y)).toBeLessThan(160);
    // Being close may clear hasDestination without disabling follow.
    // Move the caravan away and confirm a fresh real movement target.
    // The convoy must remain on the verified road; a world caravan
    // cannot legally jump 500 pixels beyond the destination to be chased.
    f.caravan.x = 528;
    f.playerParty.x = 140;
    f.playerParty.y = 208;
    f.playerParty.hasDestination = false;
    hud.assignedTarget = null;
    hud.followId = f.caravan.id;
    f.playerParty.moveState = 'idle';
    sim.updatePlayerParty(0.1);
    // A follow waypoint can be reached in one normal movement tick, so
    // hasDestination is not itself a required long-lived flag.
    expect(f.playerParty.x).toBeGreaterThan(140);
    // The normal world-speed multiplier permits reaching this 44px waypoint
    // in one movement tick; reaching an assigned point is not teleporting.
    expect(f.playerParty.x).toBeLessThanOrEqual(184.01);
    // A manual map click overrides the followers' target.
    f.playerParty.hasDestination = true;
    f.playerParty.destX = 1000;
    sim.updatePlayerParty(0.1);
    expect(hud.followId).toBeNull();
    expect(f.playerParty.destX).toBe(1000);
  });

  it('manual click overrides following even after auto target is released near the convoy', () => {
    const f = fixture();
    const hud = new QuestEscortHud(f.game);
    hud._party = f.caravan;
    hud.followId = f.caravan.id;
    f.playerParty.x = f.caravan.x;
    f.playerParty.y = f.caravan.y;
    expect(hud.refreshFollowTarget()).toBe(true);
    expect(hud.assignedTarget).toBeNull();
    expect(f.playerParty.hasDestination).toBe(false);
    f.playerParty.destX = f.caravan.x + 300;
    f.playerParty.destY = f.caravan.y + 100;
    f.playerParty.hasDestination = true;
    expect(hud.refreshFollowTarget()).toBe(false);
    expect(hud.followId).toBeNull();
    expect(f.playerParty.destX).toBe(f.caravan.x + 300);
    expect(f.playerParty.hasDestination).toBe(true);
  });

  it('following ends on blocked terrain, manual stops and leaving map mode', () => {
    const f = fixture();
    const hud = new QuestEscortHud(f.game);
    hud.followId = f.caravan.id;
    hud._party = f.caravan;
    f.playerParty.x = f.caravan.x + 500;
    expect(hud.refreshFollowTarget()).toBe(true);
    expect(f.playerParty.hasDestination).toBe(true);
    f.playerParty.moveState = 'blocked';
    expect(hud.refreshFollowTarget()).toBe(false);
    expect(hud.followId).toBeNull();
    expect(f.playerParty.hasDestination).toBe(false);
    hud.followId = f.caravan.id;
    hud._party = f.caravan;
    f.game.state.mode = 'city';
    expect(hud.refreshFollowTarget()).toBe(false);
    expect(hud.followId).toBeNull();
  });
});
