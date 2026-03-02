function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function createDefaultSettings(cfg = {}) {
  return {
    fxEnabled: Boolean(cfg.DEFAULT_FX_ENABLED ?? true),
    cameraShakeEnabled: Boolean(cfg.DEFAULT_CAMERA_SHAKE_ENABLED ?? true),
    weatherEnabled: Boolean(cfg.DEFAULT_WEATHER_ENABLED ?? true),
    difficultyMult: clamp(
      cfg.DEFAULT_DIFFICULTY_MULT ?? 1,
      Number(cfg.DIFFICULTY_MIN ?? 0.7),
      Number(cfg.DIFFICULTY_MAX ?? 1.5),
    ),
  };
}

export function applySettingsPatch(settings, patch = {}, cfg = {}) {
  const base = settings && typeof settings === 'object' ? settings : createDefaultSettings(cfg);
  const next = { ...base };

  if (Object.prototype.hasOwnProperty.call(patch, 'fxEnabled')) next.fxEnabled = Boolean(patch.fxEnabled);
  if (Object.prototype.hasOwnProperty.call(patch, 'cameraShakeEnabled')) next.cameraShakeEnabled = Boolean(patch.cameraShakeEnabled);
  if (Object.prototype.hasOwnProperty.call(patch, 'weatherEnabled')) next.weatherEnabled = Boolean(patch.weatherEnabled);
  if (Object.prototype.hasOwnProperty.call(patch, 'difficultyMult')) {
    next.difficultyMult = clamp(
      patch.difficultyMult,
      Number(cfg.DIFFICULTY_MIN ?? 0.7),
      Number(cfg.DIFFICULTY_MAX ?? 1.5),
    );
  }

  return next;
}

export function serializeSettings(settings) {
  if (!settings || typeof settings !== 'object') return {};
  return {
    fxEnabled: Boolean(settings.fxEnabled),
    cameraShakeEnabled: Boolean(settings.cameraShakeEnabled),
    weatherEnabled: Boolean(settings.weatherEnabled),
    difficultyMult: Number(settings.difficultyMult),
  };
}

export function deserializeSettings(raw, cfg = {}) {
  const defaults = createDefaultSettings(cfg);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  return applySettingsPatch(defaults, raw, cfg);
}
