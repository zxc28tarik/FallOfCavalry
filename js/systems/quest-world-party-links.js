/**
 * WEB V1.18: registered world-party provenance (NO fabricated commanders).
 * Route links refer to actual EconomyManager routes with two real settlements.
 * Saved party metadata is always re-checked against the live world registry.
 */
import {
  canonicalRoadForRoute, roadWorldWaypoints, patrolWaypointsOnRoad,
} from './world-trade-road-topology.js';
import {localBanditRouteAnchors} from './world-ai-local-sources.js';

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
const rec = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const id = (value) => typeof value === 'string' && ID.test(value);
const loc = (s) => rec(s) && Number.isFinite(s.x) && Number.isFinite(s.y);
const isBandit = (party) => party?.kind === 'bandit'
  && party?.factionId === 'bandits'
  && (!party.encounterType || party.encounterType === 'bandit');

export function registeredTradeRoute(worldState, tradeRoutes, routeId) {
  if (!id(routeId) || !Array.isArray(tradeRoutes)) return null;
  const row = tradeRoutes.find((route) => route?.id === routeId);
  if (!row || row.fromCityId == null || row.toCityId == null
    || String(row.fromCityId) === String(row.toCityId)) return null;
  const settlements = Array.isArray(worldState?.settlements) ? worldState.settlements : [];
  const from = settlements.find((s) => String(s?.id) === String(row.fromCityId));
  const to = settlements.find((s) => String(s?.id) === String(row.toCityId));
  if (!loc(from) || !loc(to)) return null;
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (!Number.isFinite(len) || len < 0.1) return null;
  const hasRoadNetwork = Array.isArray(worldState?.roads) && worldState.roads.length > 0;
  const roadLink = hasRoadNetwork ? canonicalRoadForRoute(worldState, row) : null;
  // Real EconomyManager road records use the canonical road's own route id.
  // Correct endpoint IDs alone must not make a forged route ID authoritative.
  // No-road legacy worlds retain their existing source-validation contract.
  if (hasRoadNetwork && (!roadLink || roadLink.id !== routeId)) return null;
  return { routeId, from, to, road: roadLink?.road || null };
}

function distanceToSegment(x, y, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1,
    ((x - a.x) * dx + (y - a.y) * dy) / Math.max(0.00001, dx * dx + dy * dy)));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

export function validBanditRoute(party, worldState, tradeRoutes) {
  if (!isBandit(party) || !Number.isFinite(party?.x)
    || !Number.isFinite(party?.y)) return null;
  const link = registeredTradeRoute(worldState, tradeRoutes, party.routeId);
  if (!link) return null;
  // A route-bound patrol's destination is always one of the registered
  // endpoints; imported save metadata cannot send it elsewhere and keep
  // claiming to be the route's defender/attacker.
  const toA = Math.hypot(Number(party.targetX) - link.from.x,
    Number(party.targetY) - link.from.y);
  const toB = Math.hypot(Number(party.targetX) - link.to.x,
    Number(party.targetY) - link.to.y);
  if (!Number.isFinite(toA) || Math.min(toA, toB) > 1) return null;
  const road = roadWorldWaypoints(worldState, link.road);
  const tile = Number(worldState?.tileSize || 32);
  const margin = Math.max(64, (Number.isFinite(tile) ? tile : 32) * 4);
  const onRoad = road.length > 1
    ? road.slice(1).some((point, i) =>
      distanceToSegment(party.x, party.y, road[i], point) <= margin)
    : distanceToSegment(party.x, party.y, link.from, link.to) <= margin;
  return onRoad ? link : null;
}

/**
 * Only called for a NEW engine-generated bandit. Spawn it on a real trade
 * route instead of labeling an unrelated bandit elsewhere as route-linked.
 */
export function spawnBanditOnRegisteredRoute(worldState, tradeRoutes, routeIndex = 0,
  { playerParty = null, cfg = {} } = {}) {
  const valid = (Array.isArray(tradeRoutes) ? tradeRoutes : [])
    .map((route) => registeredTradeRoute(worldState, tradeRoutes, route?.id))
    .filter(Boolean);
  if (!valid.length) return null;
  const inActiveRegion = Number.isFinite(playerParty?.x) && Number.isFinite(playerParty?.y);
  // The player's active area is a streaming window; never relabel a random
  // local bandit as a distant real-route threat. Instead use a waypoint on a
  // physically registered road that is ACTUALLY in that active area.
  const candidates = inActiveRegion
    ? valid.map(link => ({
      link, anchors: localBanditRouteAnchors(worldState, link, playerParty, cfg),
    })).filter(row => row.anchors.length)
    : valid.map(link => ({ link, anchors: [] }));
  if (!candidates.length) return null;
  const priority = candidates.filter(({ link }) => {
    const route = tradeRoutes.find(r => r?.id === link.routeId);
    return Boolean(route?.recentLoss || Number(route?.damage ?? 0) > 0);
  });
  const pool = priority.length ? priority : candidates;
  const row = pool[Math.abs(Math.floor(routeIndex)) % pool.length];
  const link = row.link;
  const roadPoints = roadWorldWaypoints(worldState, link.road);
  const middle = inActiveRegion
    ? row.anchors[Math.floor(row.anchors.length / 2)]
    : roadPoints.length
      ? roadPoints[Math.floor(roadPoints.length / 2)]
      : { x: (link.from.x + link.to.x) / 2, y: (link.from.y + link.to.y) / 2 };
  return {
    routeId: link.routeId,
    x: middle.x,
    y: middle.y,
    targetX: link.to.x,
    targetY: link.to.y,
    homeCityId: String(link.from.id),
  };
}

/** Return the opposite endpoint. Route-bound bandits stay on their own road. */
export function getBanditRoadPatrolWaypoints(party, worldState, tradeRoutes) {
  const link = validBanditRoute(party, worldState, tradeRoutes);
  return link?.road ? patrolWaypointsOnRoad(worldState, link, party) : [];
}

export function nextBanditRouteTarget(party, worldState, tradeRoutes) {
  const link = validBanditRoute(party, worldState, tradeRoutes);
  if (!link) return null;
  const toA = Math.hypot(party.x - link.from.x, party.y - link.from.y);
  const toB = Math.hypot(party.x - link.to.x, party.y - link.to.y);
  // Pick farther endpoint; at the endpoint itself this reverses the patrol.
  const next = toA <= toB ? link.to : link.from;
  return { x: next.x, y: next.y };
}

/**
 * Rebuild source IDs for rendering/encounters, not trusting a persisted
 * commanderId string. Commander is identified only by an explicit registry
 * partyId/worldPartyId link and a live (non-dead) commander entry.
 */
export function validatedPartyQuestLinks(party, { worldState, tradeRoutes, commanders } = {}) {
  if (!rec(party) || !id(party.id)) return {};
  const route = validBanditRoute(party, worldState, tradeRoutes);
  const partyCommander = Array.isArray(commanders) ? commanders.find((c) =>
    rec(c) && id(c.id) && (c.partyId === party.id || c.worldPartyId === party.id)
    && c.alive !== false && c.status !== 'dead') : null;
  return {
    ...(route ? { routeId: route.routeId } : {}),
    ...(partyCommander ? { commanderId: partyCommander.id } : {}),
  };
}
