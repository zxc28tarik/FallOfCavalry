/**
 * WEB V1.18: registered world-party provenance (NO fabricated commanders).
 * Route links refer to actual EconomyManager routes with two real settlements.
 * Saved party metadata is always re-checked against the live world registry.
 */
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
  return { routeId, from, to };
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
  const tile = Number(worldState?.tileSize || 32);
  const margin = Math.max(64, (Number.isFinite(tile) ? tile : 32) * 4);
  return distanceToSegment(party.x, party.y, link.from, link.to) <= margin ? link : null;
}

/**
 * Only called for a NEW engine-generated bandit. Spawn it on a real trade
 * route instead of labeling an unrelated bandit elsewhere as route-linked.
 */
export function spawnBanditOnRegisteredRoute(worldState, tradeRoutes, routeIndex = 0) {
  const valid = (Array.isArray(tradeRoutes) ? tradeRoutes : [])
    .map((route) => registeredTradeRoute(worldState, tradeRoutes, route?.id))
    .filter(Boolean);
  if (!valid.length) return null;
  const priority = valid.filter((v) => {
    const route = tradeRoutes.find((r) => r?.id === v.routeId);
    return Boolean(route?.recentLoss || Number(route?.damage ?? 0) > 0);
  });
  const pool = priority.length ? priority : valid;
  const link = pool[Math.abs(Math.floor(routeIndex)) % pool.length];
  const t = 0.5;
  return {
    routeId: link.routeId,
    x: link.from.x + (link.to.x - link.from.x) * t,
    y: link.from.y + (link.to.y - link.from.y) * t,
    targetX: link.to.x,
    targetY: link.to.y,
    homeCityId: String(link.from.id),
  };
}

/** Return the opposite endpoint. Route-bound bandits stay on their own road. */
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
