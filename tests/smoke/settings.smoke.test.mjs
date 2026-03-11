import assert from 'node:assert/strict';
import { it, describe } from 'vitest';
import { createDefaultSettings, applySettingsPatch, serializeSettings, deserializeSettings } from '../../js/systems/settings.js';

const CFG = {
  DEFAULT_FX_ENABLED: true,
  DEFAULT_CAMERA_SHAKE_ENABLED: true,
  DEFAULT_WEATHER_ENABLED: true,
  DEFAULT_DIFFICULTY_MULT: 1.0,
  DIFFICULTY_MIN: 0.7,
  DIFFICULTY_MAX: 1.5,
};

describe('settings', () => {
  it('block 1', () => {
    const defaults = createDefaultSettings(CFG);
    assert.equal(defaults.fxEnabled, true);
    assert.equal(defaults.cameraShakeEnabled, true);
    assert.equal(defaults.weatherEnabled, true);
    assert.equal(defaults.difficultyMult, 1.0);

    const patched = applySettingsPatch(defaults, { fxEnabled: false, difficultyMult: 9 }, CFG);
    assert.equal(patched.fxEnabled, false);
    assert.equal(patched.difficultyMult, 1.5);

    const serialized = serializeSettings(patched);
    assert.deepEqual(Object.keys(serialized).sort(), ['cameraShakeEnabled', 'difficultyMult', 'fxEnabled', 'weatherEnabled']);

    const restored = deserializeSettings({ cameraShakeEnabled: false, difficultyMult: 0.1 }, CFG);
    assert.equal(restored.cameraShakeEnabled, false);
    assert.equal(restored.fxEnabled, true);
    assert.equal(restored.difficultyMult, 0.7);
  });
});
