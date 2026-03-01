import * as CONST from '../constants.js';

const WEATHER_TYPES = ['CLEAR', 'RAIN', 'SNOW', 'FOG'];

function hash32(input) {
  let h = 2166136261 >>> 0;
  const text = String(input ?? '');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function shouldSnowInsteadOfRain(regionInfo = null) {
  if (!regionInfo || typeof regionInfo !== 'object') return false;
  const latitude = Number(regionInfo.latitude ?? regionInfo.lat ?? NaN);
  if (Number.isFinite(latitude) && Math.abs(latitude) >= 0.62) return true;
  const biome = String(regionInfo.biome || '').toUpperCase();
  return biome === 'SNOW' || biome === 'MOUNTAIN';
}

export function computeWeatherForDay({ worldSeed, dayIndex, regionId, regionInfo = null, cfg = CONST.WEATHER } = {}) {
  const normalizedDay = Number.isFinite(dayIndex) ? Math.max(0, Math.floor(dayIndex)) : 0;
  const seedKey = `${worldSeed ?? 1337}|${normalizedDay}|${regionId ?? 'global'}`;
  const rng = mulberry32(hash32(seedKey));

  const rainChance = Number(cfg?.RAIN_CHANCE ?? CONST.WEATHER.RAIN_CHANCE);
  const snowChance = Number(cfg?.SNOW_CHANCE ?? CONST.WEATHER.SNOW_CHANCE);
  const fogChance = Number(cfg?.FOG_CHANCE ?? CONST.WEATHER.FOG_CHANCE);

  let type = 'CLEAR';
  const roll = rng();
  if (roll < rainChance) {
    type = shouldSnowInsteadOfRain(regionInfo) ? 'SNOW' : 'RAIN';
  } else if (roll < rainChance + snowChance) {
    type = 'SNOW';
  } else if (roll < rainChance + snowChance + fogChance) {
    type = 'FOG';
  }

  const phase = normalizedDay % 4;
  const timeOfDay = phase === 0 ? 'DAY' : phase === 1 ? 'EVENING' : phase === 2 ? 'NIGHT' : 'DAWN';

  return {
    type: WEATHER_TYPES.includes(type) ? type : 'CLEAR',
    timeOfDay,
  };
}

export function getWeatherTint(weather, cfg = CONST.WEATHER) {
  const type = weather?.type || 'CLEAR';
  const timeOfDay = weather?.timeOfDay || 'DAY';
  const tint = { r: 0, g: 0, b: 0, a: 0 };

  if (timeOfDay === 'EVENING') {
    tint.r = 255;
    tint.g = 150;
    tint.b = 70;
    tint.a = 0.12;
  } else if (timeOfDay === 'NIGHT') {
    tint.r = 20;
    tint.g = 36;
    tint.b = 74;
    tint.a = Math.max(0, Number(cfg?.NIGHT_TINT_ALPHA ?? CONST.WEATHER.NIGHT_TINT_ALPHA));
  } else if (timeOfDay === 'DAWN') {
    tint.r = 165;
    tint.g = 120;
    tint.b = 190;
    tint.a = 0.1;
  }

  if (type === 'FOG') {
    const fog = Math.max(0, Number(cfg?.FOG_ALPHA ?? CONST.WEATHER.FOG_ALPHA));
    tint.r = 220;
    tint.g = 224;
    tint.b = 230;
    tint.a += fog;
  }

  tint.a = Math.max(0, Math.min(0.95, tint.a));
  return tint;
}
