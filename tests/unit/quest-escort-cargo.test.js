import { describe, expect, it } from 'vitest';
import { QUEST_DEFS } from '../../js/data/quest-defs.js';
import { spawnPartyBandit } from '../../js/systems/world-ai.js';
import { spawnQuestEscortCaravan } from '../../js/systems/quest-caravan-escort.js';
import {
  reserveEscortCargo, inspectLiveEscortCargo, recordEscortCargoRaid,
  inspectLiveBanditCargo, deliverEscortCargo, outstandingEscortCargoForSave,
} from '../../js/systems/quest-escort-cargo.js';

function setup() {
  const worldState = {
    width: 30, height: 20, tileSize: 32,
    settlements: [
      { id: 0, type: 'city', tx: 4, ty: 6, x: 144, y: 208,
        marketStock: [
          { id: 'wheat', qty: 9 }, { id: 'iron', qty: 8 },
          { id: 'cloth', qty: 8 }, { id: 'fake_goods', qty: 500 },
        ] },
      { id: 1, type: 'city', tx: 10, ty: 6, x: 336, y: 208,
        marketStock: [{ id: 'wheat', qty: 2 }, { id: 'iron', qty: 0 }] },
    ],
    roads: [{ from: 0, to: 1,
      path: [{ x: 4, y: 6 }, { x: 7, y: 7 }, { x: 10, y: 6 }] }],
  };
  const tradeRoutes = [{
    id: 'route:0:1', fromCityId: 0, toCityId: 1, roadBacked: true,
  }];
  const template = QUEST_DEFS.find(x => x.id === 'escort_first_caravan');
  const quest = {
    ...JSON.parse(JSON.stringify(template)
      .replaceAll('{{targetRouteId}}', 'route:0:1')
      .replaceAll('{{issuerFactionId}}', 'ottoman')),
    id: 'quest_escort_goods', status: 'active', createdAt: 3,
    templateId: 'escort_first_caravan',
    targetRouteId: 'route:0:1', issuerFactionId: 'ottoman',
  };
  const catalog = [{ id: 'wheat' }, { id: 'iron' }, { id: 'cloth' }];
  const caravan = spawnQuestEscortCaravan(quest, worldState, tradeRoutes, 4);
  const reserve = () => reserveEscortCargo({
    caravan, quest, worldState, tradeRoutes, currentDay: 4,
    catalog, maxUnits: 24,
  });
  return { worldState, tradeRoutes, quest, caravan, catalog, reserve };
}
const quantity = rows => rows.reduce((n,x) => n + x.qty, 0);

describe('WEB V1.27 — real settlement cargo reservation / in-process loot', () => {
  it('only reserves catalog goods from the real source settlement; no phantom stock', () => {
    const { worldState, caravan, reserve } = setup();
    const reserved = reserve();
    expect(reserved).toEqual([
      { id: 'wheat', qty: 9 }, { id: 'iron', qty: 8 },
      { id: 'cloth', qty: 7 },
    ]);
    expect(worldState.settlements[0].marketStock.map(x => x.qty))
      .toEqual([0, 0, 1, 500]);
    expect(quantity(inspectLiveEscortCargo(caravan))).toBe(24);
    expect(reserve()).toBeNull(); // Never debit twice.
    expect(worldState.settlements[1].marketStock[0].qty).toBe(2);
  });

  it('rejects JSON party clone, fake settlement stock, missing road and wrong quest', () => {
    const p = setup();
    expect(reserveEscortCargo({ caravan: { ...p.caravan }, quest: p.quest,
      worldState: p.worldState, tradeRoutes: p.tradeRoutes,
      currentDay: 4, catalog: p.catalog })).toBeNull();
    expect(reserveEscortCargo({ caravan: p.caravan,
      quest: { ...p.quest, id: 'wrong_id' },
      worldState: p.worldState, tradeRoutes: p.tradeRoutes,
      currentDay: 4, catalog: p.catalog })).toBeNull();
    expect(reserveEscortCargo({ caravan: p.caravan, quest: p.quest,
      worldState: { ...p.worldState, roads: [] }, tradeRoutes: p.tradeRoutes,
      currentDay: 4, catalog: p.catalog })).toBeNull();
    expect(p.worldState.settlements[0].marketStock[0].qty).toBe(9);
    const empty = setup();
    empty.worldState.settlements[0].marketStock = [
      { id: 'fake_goods', qty: 200 }, { id: 'wheat', qty: -5 },
      { id: 'cloth', qty: Number.NaN },
    ];
    expect(empty.reserve()).toBeNull();
    expect(empty.worldState.settlements[0].marketStock[0].qty).toBe(200);
  });

  it('moves exact whole units to a real road bandit once, without minting player loot', () => {
    const p = setup();
    expect(quantity(p.reserve())).toBe(24);
    const bandit = spawnPartyBandit(p.worldState, {}, {}, {
      tradeRoutes: p.tradeRoutes,
    });
    const gained = recordEscortCargoRaid({
      caravan: p.caravan, bandit, remainingPercent: 78,
    });
    expect(quantity(gained)).toBe(5);
    expect(quantity(inspectLiveEscortCargo(p.caravan))).toBe(19);
    expect(quantity(inspectLiveBanditCargo(bandit))).toBe(5);
    expect(recordEscortCargoRaid({
      caravan: p.caravan, bandit, remainingPercent: 78,
    })).toEqual([]);
    expect(quantity(inspectLiveBanditCargo(bandit))).toBe(5);
    expect(p.worldState.settlements[1].marketStock[0].qty).toBe(2);
  });

  it('won\'t transfer source goods to an invented bandit or other road', () => {
    const p = setup(); p.reserve();
    const bandit = spawnPartyBandit(p.worldState, {}, {}, {
      tradeRoutes: p.tradeRoutes,
    });
    expect(recordEscortCargoRaid({
      caravan: p.caravan, bandit: { ...bandit }, remainingPercent: 50,
    })).toEqual([]);
    bandit.routeId = 'route:0:3';
    expect(recordEscortCargoRaid({
      caravan: p.caravan, bandit, remainingPercent: 50,
    })).toEqual([]);
    expect(quantity(inspectLiveEscortCargo(p.caravan))).toBe(24);
    expect(inspectLiveBanditCargo({ ...bandit })).toEqual([]);
  });

  it('delivers surviving units only to the genuine destination after arrival', () => {
    const p = setup(); p.reserve();
    expect(deliverEscortCargo({
      caravan: p.caravan, quest: p.quest, worldState: p.worldState,
      tradeRoutes: p.tradeRoutes, currentDay: 4,
    })).toBeNull();
    p.caravan.escortArrived = true;
    expect(deliverEscortCargo({
      caravan: p.caravan, quest: p.quest, worldState: p.worldState,
      tradeRoutes: p.tradeRoutes, currentDay: 4,
    })).toEqual([{ id: 'wheat', qty: 9 }, { id: 'iron', qty: 8 },
      { id: 'cloth', qty: 7 }]);
    expect(p.worldState.settlements[1].marketStock)
      .toEqual([{ id: 'wheat', qty: 11 }, { id: 'iron', qty: 8 },
        { id: 'cloth', qty: 7 }]);
    expect(deliverEscortCargo({
      caravan: p.caravan, quest: p.quest, worldState: p.worldState,
      tradeRoutes: p.tradeRoutes, currentDay: 4,
    })).toBeNull();
    expect(inspectLiveEscortCargo(p.caravan)).toEqual([]);
  });

  it('returns only outstanding unlost cargo in the SAVE SNAPSHOT; not runtime', () => {
    const p = setup(); p.reserve();
    const bandit = spawnPartyBandit(p.worldState, {}, {}, {
      tradeRoutes: p.tradeRoutes,
    });
    recordEscortCargoRaid({
      caravan: p.caravan, bandit, remainingPercent: 78,
    });
    const snapshot = outstandingEscortCargoForSave([p.caravan]);
    expect([...snapshot.get('0')].reduce((n,[,v])=>n+v,0)).toBe(19);
    expect(quantity(inspectLiveEscortCargo(p.caravan))).toBe(19);
    expect(p.worldState.settlements[0].marketStock[0].qty).toBe(0);
    expect(outstandingEscortCargoForSave([{ ...p.caravan }]).size).toBe(0);
    p.caravan.escortArrived = true;
    expect(outstandingEscortCargoForSave([p.caravan]).size).toBe(0);
  });
});
