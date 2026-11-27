import { describe, expect, it } from 'vitest';
import { EconomyManager } from '../../js/managers/EconomyManager.js';
import {
  canonicalRoadLinks, roadWorldWaypoints, patrolWaypointsOnRoad,
} from '../../js/systems/world-trade-road-topology.js';
import {
  registeredTradeRoute, spawnBanditOnRegisteredRoute,
  validBanditRoute, getBanditRoadPatrolWaypoints,
} from '../../js/systems/quest-world-party-links.js';
import { spawnPartyBandit, updateWorldParties } from '../../js/systems/world-ai.js';

const settlements = [
  { id: 'A', x: 144, y: 208, tx: 4, ty: 6, type: 'city' },
  { id: 'B', x: 336, y: 208, tx: 10, ty: 6, type: 'fort' },
  { id: 'C', x: 528, y: 336, tx: 16, ty: 10, type: 'city' },
  { id: 'D', x: 720, y: 336, tx: 22, ty: 10, type: 'fort' },
];
const roads = [
  { from: 'A', to: 'B', path: [
    { x: 4, y: 6 }, { x: 7, y: 7 }, { x: 10, y: 6 },
  ] },
  { from: 'C', to: 'D', path: [
    { x: 16, y: 10 }, { x: 19, y: 10 }, { x: 22, y: 10 },
  ] },
];
const world = () => ({
  width: 30, height: 20, tileSize: 32, settlements, roads,
});
const bandit = () => ({
  id: 'route-bandit', kind: 'bandit', factionId: 'bandits',
  routeId: 'route:A:B', x: 256, y: 240, targetX: 336, targetY: 208,
});
const economy = (worldState) => new EconomyManager({ map: worldState });

describe('WEB V1.19 — canonical generated-road trade routes and pixel path', () => {
  it('rejects malformed roads, path endpoint mismatch, and dangling settlement IDs', () => {
    const badWorld = { ...world(), roads: [
      { from: 'A', to: 'C', path: [{ x: 4, y: 6 }, { x: 7, y: 7 }] },
      { from: 'A', to: 'missing', path: roads[0].path },
      { from: 'A', to: 'A', path: roads[0].path },
      { from: 'A', to: 'B', path: [] },
      roads[0], roads[0], roads[1],
    ] };
    expect(canonicalRoadLinks(badWorld).map(r => r.id))
      .toEqual(['route:A:B', 'route:C:D']);
    expect(canonicalRoadLinks(badWorld)).toBe(canonicalRoadLinks(badWorld));
  });

  it('preserves old list-order routes for compatibility but issues new tasks only on true roads', () => {
    const w = world();
    const em = economy(w);
    const reg = em.ensureTradeRoutes();
    expect(reg.map(r=>r.id)).toEqual([
      'route:A:B', 'route:C:D', 'route:B:C',
    ]);
    expect(reg.filter(r=>r.roadBacked).map(r=>r.id))
      .toEqual(['route:A:B', 'route:C:D']);
    expect(em.pickQuestTargetRoute('route_connected_to_target_city', { targetCityId: 'C' }))
      .toBe('route:C:D');
    expect(em.pickQuestTargetRoute('route_connected_to_target_city', { targetCityId: 'B' }))
      .toBe('route:A:B');
    expect(em.pickQuestTargetRoute('route_with_recent_loss')).toBe('route:A:B');
    expect(reg[0]).toBe(em.ensureTradeRoutes()[0]);
  });

  it('upgrades an early list-order registry when real roads become available, retaining modifiers', () => {
    const w = { ...world(), roads: [] };
    const em = economy(w);
    const before = em.ensureTradeRoutes();
    expect(before).toHaveLength(3);
    before[0].quality = 4;
    before[1].damage = 3;
    w.roads = roads;
    const upgraded = em.ensureTradeRoutes();
    expect(upgraded[0]).toMatchObject({
      id: 'route:A:B', roadBacked: true, quality: 4,
    });
    expect(upgraded.find(r=>r.id==='route:B:C')).toMatchObject({
      roadBacked: false, damage: 3,
    });
    expect(em.pickQuestTargetRoute('route_with_recent_loss')).toBe('route:A:B');
  });

  it('does not accept a physically nonexistent list-order route as bandit objective evidence', () => {
    const w = world();
    const routes = economy(w).ensureTradeRoutes();
    expect(registeredTradeRoute(w, routes, 'route:A:B')?.road?.from).toBe('A');
    expect(registeredTradeRoute(w, routes, 'route:B:C')).toBeNull();
    const forged = { ...bandit(), routeId: 'route:B:C',
      x: 432, y: 272, targetX: 528, targetY: 336 };
    expect(validBanditRoute(forged, w, routes)).toBeNull();
  });

  it('converts generated tile waypoints to world pixel centers and patrols real polyline', () => {
    const w = world();
    const path = roadWorldWaypoints(w, roads[0]);
    expect(path).toEqual([
      { x: 144, y: 208 }, { x: 240, y: 240 }, { x: 336, y: 208 },
    ]);
    const routes = economy(w).ensureTradeRoutes();
    const spawned = spawnBanditOnRegisteredRoute(w, routes, 0);
    expect(spawned).toMatchObject({
      routeId: 'route:A:B', x: 240, y: 240, targetX: 336, targetY: 208,
    });
    const taskParty = { ...bandit(), ...spawned };
    expect(validBanditRoute(taskParty, w, routes)).not.toBeNull();
    expect(validBanditRoute({ ...taskParty, y: 900 }, w, routes)).toBeNull();
    expect(getBanditRoadPatrolWaypoints(taskParty, w, routes))
      .toEqual([{ x: 240, y: 240 }, { x: 336, y: 208 }]);
    expect(patrolWaypointsOnRoad(w, { road: roads[0] }, {
      x: 336, y: 208, targetX: 144, targetY: 208,
    })).toEqual([...path].reverse());
  });

  it('moves a naturally spawned source-linked bandit on the real path not a diagonal shortcut', () => {
    const w = world();
    const routes = economy(w).ensureTradeRoutes();
    const p = spawnPartyBandit(w, {}, { BANDIT_SPEED: 1 }, { tradeRoutes: routes });
    const ai = { parties: [p] };
    updateWorldParties({
      aiState: ai, worldState: w, tradeRoutes: routes, factions: {},
      cfg: { BANDIT_SPEED: 1 }, dtSec: 1, playerParty: null,
    });
    expect(p.path).toEqual([{ x: 240, y: 240 }, { x: 336, y: 208 }]);
    expect(p.x).toBeGreaterThanOrEqual(240);
    expect(p.y).toBeLessThanOrEqual(240);
  });

  it('does not invent a road in a graph with only legacy list-order routes', () => {
    const w = { ...world(), roads: [
      { from: 'A', to: 'C', path: [{ x: 4, y: 6 }, { x: 5, y: 6 }] },
    ] };
    const em = economy(w);
    const routes = em.ensureTradeRoutes();
    expect(routes.every(r=>!r.roadBacked)).toBe(true);
    expect(registeredTradeRoute(w, routes, 'route:A:B')).toBeNull();
    expect(spawnBanditOnRegisteredRoute(w, routes)).toBeNull();
  });
});
