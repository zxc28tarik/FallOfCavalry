import { POI_TYPES, REGION_MODIFIERS } from '../constants.js';

export function createInitialRegionState() {
  return { modifiers: [] };
}

function ensureRegionState(regionState) {
  if (!regionState || typeof regionState !== 'object') return createInitialRegionState();
  if (!Array.isArray(regionState.modifiers)) regionState.modifiers = [];
  return regionState;
}

export function addRegionModifier(regionState, modifier) {
  const state = ensureRegionState(regionState);
  if (!modifier || !modifier.id || !modifier.regionId) return;
  const startDay = Number.isFinite(modifier.startDay) ? Math.floor(modifier.startDay) : 1;
  const endDay = Number.isFinite(modifier.endDay) ? Math.floor(modifier.endDay) : startDay;
  const idx = state.modifiers.findIndex((entry) => entry?.id === modifier.id && entry?.regionId === modifier.regionId);
  const next = {
    id: String(modifier.id),
    regionId: String(modifier.regionId),
    startDay,
    endDay,
  };
  if (idx >= 0) state.modifiers[idx] = next;
  else state.modifiers.push(next);
}

export function removeRegionModifier(regionState, { id, regionId } = {}) {
  const state = ensureRegionState(regionState);
  if (!id || !regionId) return;
  state.modifiers = state.modifiers.filter((entry) => !(entry?.id === id && entry?.regionId === regionId));
}

export function getActiveRegionModifiers(regionState, regionId, currentDay) {
  const state = ensureRegionState(regionState);
  const day = Number.isFinite(currentDay) ? Math.floor(currentDay) : 1;
  state.modifiers = state.modifiers.filter((entry) => Number.isFinite(entry?.endDay) && Number(entry.endDay) >= day);
  if (!regionId) return [];
  return state.modifiers.filter((entry) => entry.regionId === regionId);
}

function resolveDuration(modifierCfg, fallback = 3) {
  const duration = Number(modifierCfg?.durationDays ?? fallback);
  return Math.max(1, Math.floor(duration));
}

export function applyPOIOutcomeToRegion({ regionState, poi, outcomeType, cfg = REGION_MODIFIERS, currentDay = 1 } = {}) {
  const state = ensureRegionState(regionState);
  const poiType = String(poi?.type || '').toLowerCase();
  const regionId = String(poi?.regionId || 'unknown');
  const day = Math.max(1, Math.floor(Number(currentDay) || 1));

  if (!regionId || regionId === 'unknown') return;

  if (poiType === POI_TYPES.SHRINE) {
    if (outcomeType === 'blessing' || outcomeType === 'clue' || outcomeType === 'loot') {
      const base = cfg?.PILGRIMAGE || REGION_MODIFIERS.PILGRIMAGE;
      addRegionModifier(state, {
        id: base.id,
        regionId,
        startDay: day,
        endDay: day + resolveDuration(base),
      });
    }
    return;
  }

  if (poiType === POI_TYPES.FORT) {
    if (outcomeType === 'fort_cleared' || outcomeType === 'loot') {
      removeRegionModifier(state, { id: (cfg?.HIGH_BANDITRY || REGION_MODIFIERS.HIGH_BANDITRY).id, regionId });
    }
    return;
  }

  if (poiType === POI_TYPES.BATTLEFIELD) {
    if (outcomeType === 'loot') {
      const prosperity = cfg?.PROSPERITY || REGION_MODIFIERS.PROSPERITY;
      addRegionModifier(state, {
        id: prosperity.id,
        regionId,
        startDay: day,
        endDay: day + Math.max(2, Math.floor(resolveDuration(prosperity) * 0.5)),
      });
    } else if (outcomeType === 'ambush' || outcomeType === 'nothing') {
      const famine = cfg?.FAMINE || REGION_MODIFIERS.FAMINE;
      addRegionModifier(state, {
        id: famine.id,
        regionId,
        startDay: day,
        endDay: day + Math.max(2, Math.floor(resolveDuration(famine) * 0.4)),
      });
    }
  }
}
