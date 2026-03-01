import assert from 'node:assert/strict';
import * as CONST from '../constants.js';
import { computeWeatherForDay, getWeatherTint } from './weather.js';

{
  const a = computeWeatherForDay({ worldSeed: 777, dayIndex: 4, regionId: 'north' });
  const b = computeWeatherForDay({ worldSeed: 777, dayIndex: 4, regionId: 'north' });
  assert.deepEqual(a, b);
}

{
  const day0 = computeWeatherForDay({ worldSeed: 777, dayIndex: 0, regionId: 'north' });
  const day1 = computeWeatherForDay({ worldSeed: 777, dayIndex: 1, regionId: 'north' });
  const day2 = computeWeatherForDay({ worldSeed: 777, dayIndex: 2, regionId: 'north' });
  assert.notEqual(day0.timeOfDay, day1.timeOfDay);
  assert.notEqual(day1.timeOfDay, day2.timeOfDay);
}

{
  const nightTint = getWeatherTint({ type: 'CLEAR', timeOfDay: 'NIGHT' }, CONST.WEATHER);
  assert.ok(nightTint.a >= CONST.WEATHER.NIGHT_TINT_ALPHA);
}

{
  const baseTint = getWeatherTint({ type: 'CLEAR', timeOfDay: 'DAY' }, CONST.WEATHER);
  const fogTint = getWeatherTint({ type: 'FOG', timeOfDay: 'DAY' }, CONST.WEATHER);
  assert.ok(fogTint.a >= CONST.WEATHER.FOG_ALPHA);
  assert.ok(fogTint.a >= baseTint.a);
}

console.log('weather smoke tests passed');
