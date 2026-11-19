import * as CONST from '../constants.js';
import {
  spawnBanditOnRegisteredRoute, nextBanditRouteTarget, validBanditRoute,
  getBanditRoadPatrolWaypoints,
} from './quest-world-party-links.js';

const DEFAULT_FACTION_IDS = ['ottoman', 'hre', 'polish', 'spanish', 'venice'];

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function distance(a, b) {
  return Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));
}

function getWorldBounds(worldState) {
  const tile = Number(worldState?.tileSize ?? worldState?.TILE_SIZE ?? CONST.WORLD.TILE_SIZE);
  const width = Number(worldState?.width ?? CONST.WORLD.MAP_WIDTH) * tile;
  const height = Number(worldState?.height ?? CONST.WORLD.MAP_HEIGHT) * tile;
  return { minX: 0, minY: 0, maxX: Math.max(tile, width), maxY: Math.max(tile, height), tileSize: tile };
}

function clampToBounds(x, y, bounds) {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
  };
}

function getSettlements(worldState) {
  return Array.isArray(worldState?.settlements) ? worldState.settlements : [];
}

function ownerFactionIdOf(settlement) {
  if (!settlement || typeof settlement !== 'object') return null;
  return settlement.ownerFactionId || settlement.owner || settlement.factionId || null;
}

function getFactionIds(factions) {
  if (Array.isArray(factions)) {
    return factions.map((f) => f?.id).filter(Boolean);
  }
  if (factions && typeof factions === 'object') {
    return Object.keys(factions).filter(Boolean);
  }
  return DEFAULT_FACTION_IDS.slice();
}

function chooseFactionForPatrol(worldState, factions) {
  const cityOwners = getSettlements(worldState)
    .map((s) => ownerFactionIdOf(s))
    .filter((id) => id && id !== 'bandit' && id !== 'bandits');
  if (cityOwners.length > 0) return cityOwners[Math.floor(Math.random() * cityOwners.length)];

  const ids = getFactionIds(factions).filter((id) => id !== 'bandit' && id !== 'bandits');
  if (ids.length > 0) return ids[Math.floor(Math.random() * ids.length)];
  return 'ottoman';
}

function findCityForFaction(worldState, factionId) {
  const settlements = getSettlements(worldState);
  const owned = settlements.filter((s) => ownerFactionIdOf(s) === factionId);
  if (owned.length > 0) return owned[Math.floor(Math.random() * owned.length)];
  if (settlements.length > 0) return settlements[Math.floor(Math.random() * settlements.length)];
  return null;
}

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function pickRoamTarget(worldState, fromX, fromY) {
  const bounds = getWorldBounds(worldState);
  const radius = Math.max(bounds.tileSize * 2, Math.min(bounds.maxX, bounds.maxY) * 0.12);
  const tx = fromX + randomInRange(-radius, radius);
  const ty = fromY + randomInRange(-radius, radius);
  return clampToBounds(tx, ty, bounds);
}

function pickOtherSettlement(worldState, fromSettlementId, preferredFactionId = null) {
  const settlements = getSettlements(worldState);
  let options = settlements.filter((s) => s?.id !== fromSettlementId);
  if (preferredFactionId) {
    const preferred = options.filter((s) => ownerFactionIdOf(s) === preferredFactionId);
    if (preferred.length > 0) options = preferred;
  }
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function getSpeedByKind(kind, cfg) {
  if (kind === 'patrol') return Number(cfg?.PATROL_SPEED ?? 1.1);
  if (kind === 'caravan') return Number(cfg?.CARAVAN_SPEED ?? 0.8);
  return Number(cfg?.BANDIT_SPEED ?? 1.0);
}

function getAggroRadius(kind, cfg) {
  if (kind === 'patrol') return Number(cfg?.PATROL_AGGRO_RADIUS ?? 4);
  if (kind === 'bandit') return Number(cfg?.BANDIT_AGGRO_RADIUS ?? 4);
  return 0;
}


function getRoadPoints(worldState) {
  const roads = Array.isArray(worldState?.roads) ? worldState.roads : [];
  const points = [];
  roads.forEach((road) => {
    (road?.path || []).forEach((pt) => {
      if (Number.isFinite(pt?.x) && Number.isFinite(pt?.y)) points.push({ x: Number(pt.x), y: Number(pt.y) });
    });
  });
  return points;
}

function nearestRoadPoint(points, x, y) {
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;
  points.forEach((pt) => {
    const dist = Math.hypot(pt.x - x, pt.y - y);
    if (dist < bestDist) {
      bestDist = dist;
      best = pt;
    }
  });
  return best;
}

export function findRoadPath(worldState, fromX, fromY, toX, toY) {
  const roadPoints = getRoadPoints(worldState);
  if (!roadPoints.length) return [];
  const startRoad = nearestRoadPoint(roadPoints, fromX, fromY);
  const endRoad = nearestRoadPoint(roadPoints, toX, toY);
  if (!startRoad || !endRoad) return [];
  const waypoints = [];
  if (Math.hypot(fromX - startRoad.x, fromY - startRoad.y) > 1) waypoints.push({ x: startRoad.x, y: startRoad.y });
  const steps = Math.max(1, Math.floor(Math.hypot(endRoad.x - startRoad.x, endRoad.y - startRoad.y) / Math.max(8, getWorldBounds(worldState).tileSize * 0.8)));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    waypoints.push({
      x: startRoad.x + ((endRoad.x - startRoad.x) * t),
      y: startRoad.y + ((endRoad.y - startRoad.y) * t),
    });
  }
  waypoints.push({ x: toX, y: toY });
  return waypoints;
}

export function createInitialWorldAiState() {
  return { parties: [], lastRespawnDay: 0 };
}

export function spawnPartyBandit(worldState, factions, cfg = {}, { tradeRoutes = [], routeIndex = 0 } = {}) {
  const bounds = getWorldBounds(worldState);
  const settlements = getSettlements(worldState);
  let x = randomInRange(bounds.minX, bounds.maxX);
  let y = randomInRange(bounds.minY, bounds.maxY);
  if (settlements.length > 0) {
    const near = settlements[Math.floor(Math.random() * settlements.length)];
    x = Number(near?.x ?? x) + randomInRange(-bounds.tileSize * 1.5, bounds.tileSize * 1.5);
    y = Number(near?.y ?? y) + randomInRange(-bounds.tileSize * 1.5, bounds.tileSize * 1.5);
  }
  const linked = spawnBanditOnRegisteredRoute(worldState, tradeRoutes, routeIndex);
  const clamped = linked ? clampToBounds(linked.x, linked.y, bounds)
    : clampToBounds(x, y, bounds);
  const target = linked
    ? { x: linked.targetX, y: linked.targetY }
    : pickRoamTarget(worldState, clamped.x, clamped.y);
  return {
    id: makeId('bandit'),
    ...(linked ? { routeId: linked.routeId, homeCityId: linked.homeCityId } : {}),
    factionId: 'bandits',
    kind: 'bandit',
    x: clamped.x,
    y: clamped.y,
    targetX: target.x,
    targetY: target.y,
    speed: getSpeedByKind('bandit', cfg),
    alive: true,
    path: null,
    pathIndex: 0,
  };
}

export function spawnPartyPatrol(worldState, factions, ownerFactionId, cfg = {}) {
  const factionId = ownerFactionId || chooseFactionForPatrol(worldState, factions);
  const home = findCityForFaction(worldState, factionId);
  const bounds = getWorldBounds(worldState);
  const sx = Number(home?.x ?? randomInRange(bounds.minX, bounds.maxX));
  const sy = Number(home?.y ?? randomInRange(bounds.minY, bounds.maxY));
  const targetCity = pickOtherSettlement(worldState, home?.id, factionId) || pickOtherSettlement(worldState, home?.id, null);
  return {
    id: makeId('patrol'),
    factionId,
    kind: 'patrol',
    x: sx,
    y: sy,
    targetX: Number(targetCity?.x ?? sx),
    targetY: Number(targetCity?.y ?? sy),
    speed: getSpeedByKind('patrol', cfg),
    alive: true,
    homeCityId: home?.id,
    path: null,
    pathIndex: 0,
  };
}

export function spawnPartyCaravan(worldState, factions, ownerFactionId, cfg = {}) {
  const factionId = ownerFactionId || chooseFactionForPatrol(worldState, factions);
  const fromCity = findCityForFaction(worldState, factionId) || getSettlements(worldState)[0] || null;
  const toCity = pickOtherSettlement(worldState, fromCity?.id, null) || fromCity;
  const bounds = getWorldBounds(worldState);
  const sx = Number(fromCity?.x ?? randomInRange(bounds.minX, bounds.maxX));
  const sy = Number(fromCity?.y ?? randomInRange(bounds.minY, bounds.maxY));
  return {
    id: makeId('caravan'),
    factionId,
    kind: 'caravan',
    x: sx,
    y: sy,
    targetX: Number(toCity?.x ?? sx),
    targetY: Number(toCity?.y ?? sy),
    speed: getSpeedByKind('caravan', cfg),
    alive: true,
    homeCityId: fromCity?.id,
    path: null,
    pathIndex: 0,
  };
}


export function getBanditCap(worldEvents, defaultCap, eventsCfg = null) {
  const base = Math.max(0, Number(defaultCap ?? 0));
  const spikeMult = Number(eventsCfg?.BANDIT_SPIKE_MULT ?? 1.5);
  const hasSpike = Array.isArray(worldEvents) && worldEvents.some((ev) => ev?.type === 'BANDIT_SPIKE');
  if (!hasSpike) return base;
  return Math.max(base, Math.ceil(base * spikeMult));
}

export function ensureWorldParties({
  aiState, worldState, factions, cfg, currentDay, banditCapOverride,
  tradeRoutes = [],
}) {
  if (!aiState || !Array.isArray(aiState.parties)) return;
  const respawnDays = Number(cfg?.RESPAWN_INTERVAL_DAYS ?? 3);
  const dayNow = Number(currentDay ?? 0);
  if (aiState.parties.length === 0 && aiState.lastRespawnDay === 0) {
    aiState.lastRespawnDay = dayNow;
  }

  const elapsed = dayNow - Number(aiState.lastRespawnDay ?? 0);
  const hasRoomByType = (kind, max) => aiState.parties.filter((p) => p?.alive !== false && p?.kind === kind).length < max;
  if (elapsed < respawnDays && aiState.parties.length > 0) return;

  const banditCap = Number.isFinite(banditCapOverride) ? Number(banditCapOverride) : Number(cfg?.MAX_BANDIT_PARTIES ?? 0);
  while (hasRoomByType('bandit', banditCap)) {
    const routeIndex = aiState.parties.filter((p) => p?.kind === 'bandit').length;
    aiState.parties.push(spawnPartyBandit(worldState, factions, cfg, { tradeRoutes, routeIndex }));
  }
  const hasSettlements = getSettlements(worldState).length > 0;
  while (hasSettlements && hasRoomByType('patrol', Number(cfg?.MAX_PATROL_PARTIES ?? 0))) {
    aiState.parties.push(spawnPartyPatrol(worldState, factions, null, cfg));
  }
  while (hasSettlements && hasRoomByType('caravan', Number(cfg?.MAX_CARAVAN_PARTIES ?? 0))) {
    aiState.parties.push(spawnPartyCaravan(worldState, factions, null, cfg));
  }

  aiState.lastRespawnDay = dayNow;
}

function pickNextTarget(party, worldState, tradeRoutes) {
  if (party.kind === 'bandit') {
    return nextBanditRouteTarget(party, worldState, tradeRoutes)
      || pickRoamTarget(worldState, party.x, party.y);
  }
  const destination = pickOtherSettlement(worldState, party.homeCityId, party.kind === 'patrol' ? party.factionId : null);
  if (destination) return { x: Number(destination.x), y: Number(destination.y) };
  return pickRoamTarget(worldState, party.x, party.y);
}

function factionIsHostileToPlayer(partyFactionId, playerFactionId) {
  if (!partyFactionId) return false;
  if (partyFactionId === 'bandits' || partyFactionId === 'bandit') return true;
  if (!playerFactionId) return false;
  return partyFactionId !== playerFactionId;
}

export function updateWorldParties({
  aiState, worldState, playerParty, factions: _factions, cfg, dtSec,
  tradeRoutes = [],
}) {
  if (!aiState || !Array.isArray(aiState.parties)) return [];
  const dt = Number(dtSec ?? 0);
  const encounters = [];
  if (!Number.isFinite(dt) || dt <= 0) return encounters;

  const tileSize = getWorldBounds(worldState).tileSize;
  const despawnDistance = Number(cfg?.DESPAWN_DISTANCE ?? 40) * tileSize;
  const playerFactionId = playerParty?.factionId || playerParty?.ownerFactionId || null;

  aiState.parties.forEach((party) => {
    if (!party || party.alive === false || party.escortQuestId) return;
    // Quest escorts have a dedicated source-checked world-road lifecycle.

    if (!Array.isArray(party.path) || party.path.length === 0 || party.pathIndex >= party.path.length) {
      const linkedBandit = validBanditRoute(party, worldState, tradeRoutes);
      const roadPath = linkedBandit
        ? getBanditRoadPatrolWaypoints(party, worldState, tradeRoutes) : [];
      const path = linkedBandit
        ? (roadPath.length ? roadPath : [{ x: Number(party.targetX), y: Number(party.targetY) }])
        : findRoadPath(worldState, party.x, party.y, party.targetX, party.targetY);
      party.path = path.length ? path : [{ x: Number(party.targetX ?? party.x), y: Number(party.targetY ?? party.y) }];
      party.pathIndex = 0;
    }

    const waypoint = party.path[party.pathIndex] || { x: Number(party.targetX ?? party.x), y: Number(party.targetY ?? party.y) };
    const dx = Number(waypoint.x) - Number(party.x ?? 0);
    const dy = Number(waypoint.y) - Number(party.y ?? 0);
    const dist = Math.hypot(dx, dy);
    const speed = Math.max(0.01, Number(party.speed ?? getSpeedByKind(party.kind, cfg))) * tileSize;
    const step = speed * dt;

    if (dist <= Math.max(step, tileSize * 0.2)) {
      party.x = Number(waypoint.x ?? party.x);
      party.y = Number(waypoint.y ?? party.y);
      party.pathIndex += 1;
      if (party.pathIndex >= party.path.length) {
        const next = pickNextTarget(party, worldState, tradeRoutes);
        party.targetX = next.x;
        party.targetY = next.y;
        party.path = null;
        party.pathIndex = 0;
      }
    } else {
      party.x += (dx / Math.max(0.0001, dist)) * step;
      party.y += (dy / Math.max(0.0001, dist)) * step;
    }

    if (playerParty && Number.isFinite(playerParty.x) && Number.isFinite(playerParty.y)) {
      const playerDist = Math.hypot(playerParty.x - party.x, playerParty.y - party.y);
      const aggro = getAggroRadius(party.kind, cfg) * tileSize;
      if (aggro > 0 && playerDist <= aggro && factionIsHostileToPlayer(party.factionId, playerFactionId)) {
        encounters.push({ type: 'BANDIT_ENCOUNTER', partyId: party.id, factionId: party.factionId, x: party.x, y: party.y });
      }
      if (playerDist > despawnDistance) {
        party.alive = false;
      }
    }
  });

  const patrols = aiState.parties.filter((p) => p?.alive !== false && p?.kind === 'patrol');
  const bandits = aiState.parties.filter((p) => p?.alive !== false && p?.kind === 'bandit');
  const purgeDist = Number(cfg?.PATROL_AGGRO_RADIUS ?? 4) * tileSize;
  patrols.forEach((patrol) => {
    bandits.forEach((bandit) => {
      if (bandit.alive === false) return;
      if (distance(patrol, bandit) <= purgeDist) bandit.alive = false;
    });
  });

  aiState.parties = aiState.parties.filter((p) => p?.alive !== false);
  return encounters;
}

export function removeWorldParty(aiState, partyId) {
  if (!aiState || !Array.isArray(aiState.parties) || !partyId) return;
  aiState.parties = aiState.parties.filter((party) => party?.id !== partyId);
}
