import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnPartyBandit } from '../../js/systems/world-ai.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import {
  reserveEscortCargo, recordEscortCargoRaid, inspectLiveBanditCargo,
  witnessBanditCargoBattleVictory, recoverWitnessedBanditCargo,
} from '../../js/systems/quest-escort-cargo.js';

const world = () => ({
  width: 30, height: 20, tileSize: 32,
  settlements: [
    { id: 0, type: 'city', tx: 4, ty: 6, x: 144, y: 208,
      marketStock: [{ id: 'wheat', qty: 10 }, { id: 'iron', qty: 8 },
        { id: 'cloth', qty: 7 }] },
    { id: 1, type: 'city', tx: 10, ty: 6, x: 336, y: 208,
      marketStock: [{ id: 'wheat', qty: 0 }] },
  ],
  roads: [{ from: 0, to: 1, path: [
    { x: 4, y: 6 }, { x: 7, y: 7 }, { x: 10, y: 6 },
  ] }],
});
const tradeRoutes = [{ id: 'route:0:1', fromCityId: 0,
  toCityId: 1, roadBacked: true }];
const catalog = [
  { id: 'wheat', name: 'Buğday', unitValue: 8 },
  { id: 'iron', name: 'Demir', unitValue: 25 },
  { id: 'cloth', name: 'Kumaş', unitValue: 30 },
];
const setup = () => {
  const worldState = world();
  const template = QUEST_DEFS.find(x => x.id === 'escort_first_caravan');
  const quest = {
    ...JSON.parse(JSON.stringify(template)
      .replaceAll('{{targetRouteId}}', 'route:0:1')
      .replaceAll('{{issuerFactionId}}', 'ottoman')),
    id: 'quest_recover', status: 'active', templateId: template.id,
    targetRouteId: 'route:0:1', issuerFactionId: 'ottoman',
    createdAt: 3,
  };
  const caravan = spawnQuestEscortCaravan(quest, worldState, tradeRoutes, 4);
  const reserved = reserveEscortCargo({
    caravan, quest, worldState, tradeRoutes, currentDay: 4, catalog,
  });
  if (!reserved?.length) throw Error('Real cargo source fixture missing');
  const bandit = spawnPartyBandit(worldState, {}, {}, { tradeRoutes });
  const worldAi = { parties: [caravan, bandit] };
  const loot = recordEscortCargoRaid({ caravan, bandit, remainingPercent: 75 });
  const enemyId = `wai-${bandit.id}`;
  const battle = {
    phase: 'result', result: 'victory', resolvedAt: 1795165000000,
    enemyId, battleResult: { result: 'victory', enemyId },
  };
  const witness = () => witnessBanditCargoBattleVictory({
    battle, bandit, worldAi, enemyId, linkedWorldPartyId: bandit.id,
    worldState, tradeRoutes,
  });
  const playerParty = { gold: 100, inventory: {
    items: [{ id: 'wheat', name: 'Buğday', qty: 2, unitValue: 8 }],
    capacity: null,
  } };
  const claim = (params = {}) => recoverWitnessedBanditCargo({
    battle, bandit, worldAi, enemyId,
    linkedWorldPartyId: bandit.id, playerParty, catalog, ...params,
  });
  return { worldState, quest, caravan, bandit, worldAi, loot,
    battle, enemyId, witness, playerParty, claim };
};
const count = items => items.reduce((n,x) => n+x.qty,0);

describe('WEB V1.30 — sourced bandit raid loot victory recovery', () => {
  it('credits only genuine stolen whole units once to canonical player inventory', () => {
    const p = setup();
    expect(count(p.loot)).toBe(6); // 24 * (100-75)%.
    const before = count(p.playerParty.inventory.items);
    const gold = p.playerParty.gold;
    expect(p.witness()).toBe(true);
    expect(p.witness()).toBe(false);
    const gained = p.claim();
    expect(gained).toEqual(p.loot);
    expect(count(p.playerParty.inventory.items)).toBe(before + 6);
    expect(p.playerParty.gold).toBe(gold);
    expect(p.claim()).toEqual([]);
    expect(inspectLiveBanditCargo(p.bandit)).toEqual([]);
    expect(p.caravan.escortCargo).toBe(100); // No invented scalar battle effects.
  });

  it('rejects forged battle results, world party clones and mismatched enemy IDs', () => {
    const p = setup();
    const before = structuredClone(p.playerParty.inventory);
    const forgedBattle = { ...p.battle, battleResult: { ...p.battle.battleResult } };
    expect(p.claim({ battle: forgedBattle })).toEqual([]);
    expect(witnessBanditCargoBattleVictory({
      battle: forgedBattle, bandit: { ...p.bandit },
      worldAi: p.worldAi, enemyId: p.enemyId,
      linkedWorldPartyId: p.bandit.id, worldState: p.worldState, tradeRoutes,
    })).toBe(false);
    expect(p.witness()).toBe(true);
    expect(p.claim({ bandit: { ...p.bandit } })).toEqual([]);
    expect(p.claim({ enemyId: 'wai-impostor' })).toEqual([]);
    expect(p.claim({ linkedWorldPartyId: 'impostor' })).toEqual([]);
    expect(p.claim({ worldAi: { parties: [{ ...p.bandit }] } })).toEqual([]);
    expect(p.playerParty.inventory).toEqual(before);
  });

  it('refuses defeat or unreadied battles and cannot mark a saved JSON clone', () => {
    const p = setup();
    p.battle.result = 'defeat';
    p.battle.battleResult.result = 'defeat';
    expect(p.witness()).toBe(false);
    p.battle.result = 'victory'; p.battle.battleResult.result = 'victory';
    p.battle.phase = 'active';
    expect(p.witness()).toBe(false);
    p.battle.phase = 'result';
    expect(p.witness()).toBe(true);
    p.battle.result = 'defeat';
    expect(p.claim()).toEqual([]);
    p.battle.result = 'victory';
    expect(count(p.claim())).toBe(6);
    const clone = JSON.parse(JSON.stringify(p.battle));
    expect(p.claim({ battle: clone })).toEqual([]);
    expect(p.witness()).toBe(false);
  });

  it('never credits untrusted or JSON-restored bandit loot fields', () => {
    const p = setup();
    p.bandit.loot = [{ id: 'wheat', qty: 9999 }];
    p.bandit.cargoManifest = [{ id: 'iron', qty: 9999 }];
    expect(p.witness()).toBe(true);
    const gained = p.claim();
    expect(count(gained)).toBe(6);
    expect(p.playerParty.inventory.items.find(x=>x.id === 'wheat').qty)
      .toBeLessThan(1000);
    const clone = JSON.parse(JSON.stringify(p.bandit));
    clone.loot = [{ id: 'wheat', qty: 9999 }];
    expect(inspectLiveBanditCargo(clone)).toEqual([]);
  });

  it('rejects dead, removed or rerouted bandits before any inventory credit', () => {
    const a = setup(); a.bandit.alive = false;
    expect(a.witness()).toBe(false);
    const b = setup();
    b.bandit.routeId = 'route:other';
    expect(b.witness()).toBe(false);
    const c = setup();
    expect(c.witness()).toBe(true);
    c.worldAi.parties = [c.caravan];
    expect(c.claim()).toEqual([]);
    expect(count(c.playerParty.inventory.items)).toBe(2);
  });

  it('is atomic when inventory is corrupt and retries only with a valid inventory', () => {
    const p = setup();
    expect(p.witness()).toBe(true);
    p.playerParty.inventory.items = [
      { id: 'wheat', qty: Number.NaN },
      { id: 'iron', qty: 5 },
    ];
    const before = [...p.playerParty.inventory.items];
    expect(p.claim()).toEqual([]);
    expect(p.playerParty.inventory.items).toEqual(before);
    expect(count(inspectLiveBanditCargo(p.bandit))).toBe(6);
    p.playerParty.inventory.items = [{ id: 'wheat', qty: 2 }];
    expect(count(p.claim())).toBe(6);
    expect(p.claim()).toEqual([]);
  });

  it('rejects non-catalog rewards and cannot duplicate goods with a reused receipt', () => {
    const p = setup(); expect(p.witness()).toBe(true);
    expect(p.claim({ catalog: [{ id: 'iron' }] })).toEqual([]);
    expect(count(inspectLiveBanditCargo(p.bandit))).toBe(6);
    expect(count(p.claim())).toBe(6);
    p.bandit.alive = false;
    expect(p.claim()).toEqual([]);
  });

  it('persists only recovered player items through JSON, never a loot authority', () => {
    const p = setup();
    p.witness(); p.claim();
    const snapshot = JSON.parse(JSON.stringify(p.playerParty.inventory));
    expect(snapshot.items.reduce((sum,x) => sum+x.qty,0)).toBe(8);
    expect(JSON.stringify(p.bandit)).not.toContain('stockBridge');
    expect(JSON.stringify(p.bandit)).not.toContain('loot');
    const reloadedPlayer = { inventory: snapshot };
    expect(p.claim({ playerParty: reloadedPlayer })).toEqual([]);
    expect(reloadedPlayer.inventory.items.reduce((sum,x) => sum+x.qty,0)).toBe(8);
  });
});
