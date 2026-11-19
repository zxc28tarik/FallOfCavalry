/**
 * V1.19 — topology of genuinely generated road segments.
 *
 * A road in the procedural world is {from, to, path} in TILE coordinates.
 * The runtime settlement positions are in WORLD PIXELS, with tx/ty retained.
 * Legacy trade routes based only on settlement list order are not roads.
 */
import * as CONST from '../constants.js';

const usable = (s) => s && typeof s === 'object'
  && Number.isFinite(s.x) && Number.isFinite(s.y);
const tile = (world) => Number(world?.tileSize || CONST.WORLD.TILE_SIZE || 32);
const routeId = (from, to) => `route:${from}:${to}`;
const topologyCache = new WeakMap();

function settlementTilePosition(s, tileSize) {
  return {
    x: Number.isFinite(s?.tx) ? s.tx : (s.x / tileSize - 0.5),
    y: Number.isFinite(s?.ty) ? s.ty : (s.y / tileSize - 0.5),
  };
}

/** Reject invalid, dangling, or physically disconnected road metadata. */
export function canonicalRoadLinks(worldState) {
  if (!Array.isArray(worldState?.roads) || !Array.isArray(worldState?.settlements)) return [];
  const saved = topologyCache.get(worldState.roads);
  if (saved?.settlements === worldState.settlements
    && saved.tileSize === tile(worldState)) return saved.links;
  const settlements = new Map(worldState.settlements
    .filter((s) => s?.id != null && usable(s)).map((s) => [String(s.id), s]));
  const links = [];
  const seen = new Set();
  const size = tile(worldState);
  for (const road of worldState.roads) {
    if (road?.from == null || road?.to == null || !Array.isArray(road.path)
      || road.path.length < 2 || String(road.from) === String(road.to)) continue;
    const from = settlements.get(String(road.from));
    const to = settlements.get(String(road.to));
    if (!from || !to) continue;
    const key = [String(road.from), String(road.to)].sort().join('|');
    if (seen.has(key)) continue;
    const first = road.path[0];
    const last = road.path[road.path.length - 1];
    if (!Number.isFinite(first?.x) || !Number.isFinite(first?.y)
      || !Number.isFinite(last?.x) || !Number.isFinite(last?.y)) continue;
    const f = settlementTilePosition(from, size);
    const t = settlementTilePosition(to, size);
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= 2;
    // A path can be reversed, but must actually connect these map tiles.
    if (!((near(first, f) && near(last, t))
      || (near(first, t) && near(last, f)))) continue;
    seen.add(key);
    links.push({
      id: routeId(road.from, road.to),
      fromCityId: road.from, toCityId: road.to,
      from, to, road,
    });
  }
  topologyCache.set(worldState.roads, {
    settlements: worldState.settlements, tileSize: size, links,
  });
  return links;
}

export function canonicalRoadForRoute(worldState, route) {
  if (!route || route.fromCityId == null || route.toCityId == null) return null;
  return canonicalRoadLinks(worldState).find((link) =>
    (String(link.fromCityId) === String(route.fromCityId)
      && String(link.toCityId) === String(route.toCityId))
    || (String(link.fromCityId) === String(route.toCityId)
      && String(link.toCityId) === String(route.fromCityId))) || null;
}

export function roadWorldWaypoints(worldState, road) {
  if (!Array.isArray(road?.path)) return [];
  const size = tile(worldState);
  const points = [];
  for (const p of road.path) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.y)) return [];
    const x = (p.x + 0.5) * size;
    const y = (p.y + 0.5) * size;
    if (!points.length || Math.hypot(x - points.at(-1).x, y - points.at(-1).y) > 0.01) {
      points.push({ x, y });
    }
  }
  return points;
}

/** For a road-linked bandit, follow actual road tiles in the correct direction. */
export function patrolWaypointsOnRoad(worldState, link, party) {
  const pts = roadWorldWaypoints(worldState, link?.road);
  if (pts.length < 2 || !Number.isFinite(party?.x)
    || !Number.isFinite(party?.y) || !Number.isFinite(party?.targetX)
    || !Number.isFinite(party?.targetY)) return [];
  const destination = { x: party.targetX, y: party.targetY };
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const forward = near(destination, pts.at(-1)) <= near(destination, pts[0]);
  const ordered = forward ? pts : [...pts].reverse();
  // Enter the route at the closest point to the current party position.
  let start = 0;
  let min = Infinity;
  for (let i = 0; i < ordered.length; i += 1) {
    const d = near(party, ordered[i]);
    if (d < min) { min = d; start = i; }
  }
  return ordered.slice(start);
}
