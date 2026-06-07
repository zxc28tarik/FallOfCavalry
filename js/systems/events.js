import * as CONST from '../constants.js';

const EVENT_TYPES = Object.freeze({
  WAR_FRONT_CRISIS: 'WAR_FRONT_CRISIS',
  WAR_TAX: 'WAR_TAX',
  BANDIT_SPIKE: 'BANDIT_SPIKE',
  REFUGEE_INFLUX: 'REFUGEE_INFLUX',
  SIEGE_THREAT: 'SIEGE_THREAT',
});

function pickRng(rng) {
  return typeof rng === 'function' ? rng : Math.random;
}

function randomIntInclusive(min, max, rng) {
  const lo = Math.floor(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(pickRng(rng)() * ((hi - lo) + 1));
}

function eventId(type, day, rng) {
  const suffix = Math.floor(pickRng(rng)() * 1e8).toString(36);
  return `${type}-${day}-${suffix}`;
}

function hasEventType(eventState, type) {
  return (eventState?.activeEvents || []).some((ev) => ev?.type === type);
}

function normalizeEventState(eventState) {
  if (!eventState || typeof eventState !== 'object') return createInitialEventState();
  if (!Array.isArray(eventState.activeEvents)) eventState.activeEvents = [];
  if (!Array.isArray(eventState.history)) eventState.history = [];
  return eventState;
}

function findFrontlineCity(war, worldState) {
  const settlements = Array.isArray(worldState?.settlements) ? worldState.settlements : [];
  if (!settlements.length) return null;
  const ids = new Set([war?.aId, war?.bId].filter(Boolean));
  const candidates = settlements.filter((city) => ids.has(city?.ownerFactionId || city?.owner || city?.factionId));
  if (!candidates.length) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i += 1) {
    const city = candidates[i];
    const score = Number(city?.garrison ?? 0) + Number(city?.population ?? 0) * 0.01;
    const bestScore = Number(best?.garrison ?? 0) + Number(best?.population ?? 0) * 0.01;
    if (score > bestScore) best = city;
  }
  return best;
}

function resolveRegionId(city, worldState) {
  if (city?.regionId) return city.regionId;
  if (Number.isFinite(city?.tx) && Number.isFinite(city?.ty)) {
    return `tile:${Math.floor(city.tx / 10)}:${Math.floor(city.ty / 10)}`;
  }
  return worldState?.regionId || 'war-zone';
}

export function createInitialEventState() {
  return { activeEvents: [], history: [] };
}

export function getActiveEvents(eventState, currentDay) {
  const state = normalizeEventState(eventState);
  const day = Number.isFinite(currentDay) ? Math.floor(currentDay) : 1;
  const keep = [];
  state.activeEvents.forEach((ev) => {
    if (Number(ev?.endDay ?? 0) < day) state.history.push(ev);
    else keep.push(ev);
  });
  state.activeEvents = keep;
  return state.activeEvents;
}

export function addEvent(eventState, event, cfg = CONST.EVENTS) {
  const state = normalizeEventState(eventState);
  if (!event || typeof event !== 'object') return;
  const maxActive = Math.max(1, Number(cfg?.MAX_ACTIVE_EVENTS ?? CONST.EVENTS.MAX_ACTIVE_EVENTS));
  while (state.activeEvents.length >= maxActive) {
    const oldest = state.activeEvents.shift();
    if (oldest) state.history.push(oldest);
  }
  state.activeEvents.push(event);
}

export function rollWarEvents({
  eventState,
  warState,
  factionsState: _factionsState,
  worldState,
  currentDay,
  cfg = CONST.EVENTS,
  rng,
} = {}) {
  const state = normalizeEventState(eventState);
  if (!cfg?.ENABLED) return;

  const activeWars = Array.isArray(warState?.wars)
    ? warState.wars.filter((war) => war?.active !== false)
    : [];
  if (!activeWars.length) return;

  const roll = pickRng(rng);
  const chance = Number(warState?.crisisActive ? cfg.CRISIS_EVENT_CHANCE : cfg.BASE_WAR_EVENT_CHANCE);
  if (roll() > chance) return;

  const war = activeWars
    .slice()
    .sort((a, b) => Math.abs(Number(b?.warscore ?? 0)) - Math.abs(Number(a?.warscore ?? 0)))[0];
  if (!war) return;

  const frontline = findFrontlineCity(war, worldState);
  const factionsInvolved = [war.aId, war.bId].filter(Boolean);
  const eventTypeWeights = [
    EVENT_TYPES.WAR_FRONT_CRISIS,
    EVENT_TYPES.SIEGE_THREAT,
    EVENT_TYPES.WAR_TAX,
    EVENT_TYPES.BANDIT_SPIKE,
    EVENT_TYPES.REFUGEE_INFLUX,
  ];
  const pickedType = eventTypeWeights[Math.floor(roll() * eventTypeWeights.length)] || EVENT_TYPES.WAR_FRONT_CRISIS;

  if ((pickedType === EVENT_TYPES.WAR_TAX || pickedType === EVENT_TYPES.BANDIT_SPIKE) && hasEventType(state, pickedType)) return;

  const duration = randomIntInclusive(
    Number(cfg.EVENT_DURATION_DAYS_MIN ?? 3),
    Number(cfg.EVENT_DURATION_DAYS_MAX ?? 7),
    roll,
  );

  const event = {
    id: eventId(pickedType, currentDay, roll),
    type: pickedType,
    startDay: Number(currentDay ?? 1),
    endDay: Number(currentDay ?? 1) + duration,
    factionsInvolved,
  };

  if (pickedType === EVENT_TYPES.WAR_FRONT_CRISIS || pickedType === EVENT_TYPES.SIEGE_THREAT || pickedType === EVENT_TYPES.REFUGEE_INFLUX) {
    event.cityId = frontline?.id || null;
  }
  if (pickedType === EVENT_TYPES.BANDIT_SPIKE || pickedType === EVENT_TYPES.SIEGE_THREAT) {
    event.regionId = resolveRegionId(frontline, worldState);
  }

  if (pickedType === EVENT_TYPES.REFUGEE_INFLUX && !factionsInvolved.includes('player')) {
    event.factionsInvolved = ['player', ...factionsInvolved.slice(0, 1)];
  }

  addEvent(state, event, cfg);
}

export function getBanditCapFromEvents(activeEvents, defaultCap, cfg = CONST.EVENTS) {
  const base = Math.max(0, Number(defaultCap ?? 0));
  const hasSpike = Array.isArray(activeEvents) && activeEvents.some((event) => event?.type === EVENT_TYPES.BANDIT_SPIKE);
  if (!hasSpike) return base;
  return Math.max(base, Math.ceil(base * Number(cfg?.BANDIT_SPIKE_MULT ?? 1)));
}

export function getWarTradeTariffMultiplier(activeEvents, settlement, ownerFactionId, cfg = CONST.EVENTS) {
  if (!Array.isArray(activeEvents) || !activeEvents.length) return 1;
  const cityId = settlement?.id || null;
  const owner = ownerFactionId || settlement?.ownerFactionId || settlement?.owner || null;
  const impacted = activeEvents.some((event) => {
    if (event?.type !== EVENT_TYPES.WAR_TAX && event?.type !== EVENT_TYPES.WAR_FRONT_CRISIS) return false;
    if (event?.cityId && cityId && event.cityId === cityId) return true;
    return Array.isArray(event?.factionsInvolved) && owner && event.factionsInvolved.includes(owner);
  });
  return impacted ? Number(cfg?.WAR_TRADE_TARIFF_MULT ?? 1) : 1;
}

export function getEventTypeLabel(type) {
  return {
    [EVENT_TYPES.WAR_FRONT_CRISIS]: 'War Front Crisis',
    [EVENT_TYPES.WAR_TAX]: 'War Tax',
    [EVENT_TYPES.BANDIT_SPIKE]: 'Bandit Spike',
    [EVENT_TYPES.REFUGEE_INFLUX]: 'Refugee Influx',
    [EVENT_TYPES.SIEGE_THREAT]: 'Siege Threat',
  }[type] || type;
}

export function getEventDescription(event) {
  const city = event?.cityId ? ` @ ${event.cityId}` : '';
  const region = event?.regionId ? ` (${event.regionId})` : '';
  switch (event?.type) {
    case EVENT_TYPES.WAR_FRONT_CRISIS:
      return `Frontline escalates${city}. Trade and contract pressure increase.`;
    case EVENT_TYPES.WAR_TAX:
      return 'Emergency taxes drain gold and increase trade tariffs.';
    case EVENT_TYPES.BANDIT_SPIKE:
      return `Bandit activity surges${region}. Roads are less safe.`;
    case EVENT_TYPES.REFUGEE_INFLUX:
      return `Refugees arrive${city}. Renown and sympathy can rise.`;
    case EVENT_TYPES.SIEGE_THREAT:
      return `City under siege risk${city || region}. Defenders are stretched.`;
    default:
      return 'Ongoing campaign pressure.';
  }
}

export { EVENT_TYPES };
