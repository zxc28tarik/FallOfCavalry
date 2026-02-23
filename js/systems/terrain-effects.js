import * as CONST from '../constants.js';

function biomeToTerrainKey(biomeCode) {
  switch (biomeCode) {
    case CONST.BIOME.FOREST: return 'FOREST';
    case CONST.BIOME.HILLS: return 'HILLS';
    case CONST.BIOME.MOUNTAIN: return 'MOUNTAIN';
    case CONST.BIOME.SNOW: return 'SNOW';
    case CONST.BIOME.SHORE: return 'SHORE';
    default: return 'PLAINS';
  }
}

function getBiomeAt(state, x, y) {
  const map = state?.map;
  if (!map?.biomes || !Number.isFinite(map?.width) || !Number.isFinite(map?.height)) return null;
  const tile = Number.isFinite(CONST.WORLD?.TILE_SIZE) ? CONST.WORLD.TILE_SIZE : 60;
  const tx = Math.max(0, Math.min(map.width - 1, Math.floor((x || 0) / tile)));
  const ty = Math.max(0, Math.min(map.height - 1, Math.floor((y || 0) / tile)));
  return map.biomes[(ty * map.width) + tx] ?? null;
}

export function getBattleTerrainContext(state, battle) {
  const fallbackKey = 'PLAINS';
  const settlement = battle?.settlement || null;
  const x = Number.isFinite(settlement?.x) ? settlement.x : (state?.player?.x ?? state?.playerParty?.x ?? 0);
  const y = Number.isFinite(settlement?.y) ? settlement.y : (state?.player?.y ?? state?.playerParty?.y ?? 0);
  const biome = getBiomeAt(state, x, y);
  const terrainKey = biomeToTerrainKey(biome);
  return {
    terrainKey: terrainKey || fallbackKey,
    mods: CONST.TERRAIN_MODS[terrainKey] || CONST.TERRAIN_MODS.PLAINS,
  };
}

export default { getBattleTerrainContext };
