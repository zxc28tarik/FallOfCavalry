/**
 * V1.22: genuine quest-bound caravan escort, with a PROCESS-LOCAL spawn
 * authority. Saved JSON cannot manufacture a witnessed arrival.
 */
import { registeredTradeRoute } from './quest-world-party-links.js';
import { roadWorldWaypoints } from './world-trade-road-topology.js';

const liveEscorts = new WeakSet();
const same = (a, b) => a != null && b != null && String(a) === String(b);
const safeId = (x) => typeof x === 'string' && /^[a-zA-Z0-9][\w.:-]{0,127}$/.test(x);

export function validEscortQuest(quest, worldState, tradeRoutes, day) {
  if (quest?.templateId !== 'escort_first_caravan' || quest.status !== 'active'
    || !safeId(quest.id) || !Number.isSafeInteger(quest.createdAt)
    || quest.createdAt > day || quest.createdAt < 0
    || (Number.isSafeInteger(quest.timeLimitDays)
      && quest.createdAt + quest.timeLimitDays < day)
    || !quest.objectives?.some(o => o?.id === 'deliver_caravan_safely'
      && o.type === 'escort_party' && o.outcome == null
      && same(o.targetRouteId, quest.targetRouteId))
    || !quest.completionPaths?.some(p => p?.id === 'caravan_delivered'
      && p.requiredOutcome === 'caravan_arrived')) return null;
  const route = registeredTradeRoute(worldState, tradeRoutes, quest.targetRouteId);
  if (!route?.road) return null; // No legacy pseudo-roads.
  return route;
}

export function spawnQuestEscortCaravan(quest, worldState, tradeRoutes, day, speed = 0.8) {
  const route = validEscortQuest(quest, worldState, tradeRoutes, day);
  if (!route) return null;
  let points = roadWorldWaypoints(worldState, route.road);
  if (points.length < 2) return null;
  if (Math.hypot(points[0].x - route.from.x, points[0].y - route.from.y)
    > Math.hypot(points.at(-1).x - route.from.x, points.at(-1).y - route.from.y)) {
    points = [...points].reverse();
  }
  const party = {
    id: `quest-escort-${quest.id}`, kind: 'caravan',
    factionId: 'neutral', encounterType: 'caravan',
    escortQuestId: quest.id, routeId: route.routeId,
    homeCityId: route.from.id, escortDestinationCityId: route.to.id,
    x: route.from.x, y: route.from.y,
    targetX: route.to.x, targetY: route.to.y,
    alive: true, speed: Math.max(0.25, Number(speed) || 0.8),
    path: points, pathIndex: 0,
    escortStarted: false, escortElapsedSeconds: 0,
    escortSeparationSeconds: 0, escortVisitedPoints: 0,
    escortArrived: false, escortFailed: false,
  };
  liveEscorts.add(party);
  return party;
}

export function isLiveEscortParty(party) {
  return Boolean(party && liveEscorts.has(party));
}

export function tickQuestEscortCaravan(party, {
  quest, worldState, tradeRoutes, playerParty, currentDay, dtSec,
} = {}) {
  if (!isLiveEscortParty(party) || party.escortFailed || party.escortArrived)
    return { status: 'invalid' };
  const route = validEscortQuest(quest, worldState, tradeRoutes, currentDay);
  if (!route || quest.id !== party.escortQuestId
    || route.routeId !== party.routeId
    || !same(route.from.id, party.homeCityId)
    || !same(route.to.id, party.escortDestinationCityId)
    || !Number.isFinite(playerParty?.x) || !Number.isFinite(playerParty?.y))
    return { status: 'invalid' };

  const dt = Number(dtSec);
  if (!Number.isFinite(dt) || dt <= 0 || dt > 1) return { status: 'invalid' };
  const tileSize = Number(worldState?.tileSize || 32);
  const radius = Math.max(100, tileSize * 5);
  const distance = Math.hypot(party.x - playerParty.x, party.y - playerParty.y);
  if (!party.escortStarted) {
    if (distance > radius) return { status: 'awaiting_player' };
    party.escortStarted = true;
  }
  if (distance > radius) {
    party.escortSeparationSeconds += dt;
    if (party.escortSeparationSeconds >= 5) {
      party.escortFailed = true;
      return { status: 'failed' };
    }
    return { status: 'waiting_for_player' };
  }
  party.escortSeparationSeconds = 0;
  party.escortElapsedSeconds += dt;
  const pts = party.path;
  if (!Array.isArray(pts) || pts.length < 2
    || party.pathIndex < 0 || party.pathIndex > pts.length) return { status: 'invalid' };
  if (party.pathIndex < pts.length) {
    const target = pts[party.pathIndex];
    const dx = target.x - party.x;
    const dy = target.y - party.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(0.25, party.speed) * tileSize * dt;
    if (dist <= step) {
      party.x = target.x;
      party.y = target.y;
      party.pathIndex += 1;
      party.escortVisitedPoints += 1;
    } else {
      party.x += (dx / dist) * step;
      party.y += (dy / dist) * step;
    }
  }
  if (party.pathIndex < pts.length) return { status: 'moving' };
  // A particularly short road may be traversed in fewer than 1 second.
  // In that case the caravan remains at its real destination, with its
  // actual escort nearby, until the minimum witnessed time is met.
  if (party.escortElapsedSeconds < 1) return { status: 'confirming_arrival' };

  // A physical destination, at least two visited waypoints and a live
  // same-session proximity witness are mandatory for a successful arrival.
  if (Math.hypot(party.x - route.to.x, party.y - route.to.y)
    > tileSize * 2 || party.escortVisitedPoints < 2
    || party.escortElapsedSeconds < 1) return { status: 'invalid' };
  party.escortArrived = true;
  return { status: 'arrived', questId: quest.id, routeId: route.routeId };
}
