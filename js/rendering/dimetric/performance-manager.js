export const DIMETRIC_QUALITY_PROFILES = Object.freeze([
  Object.freeze({
    level: 0,
    lodBias: 0,
    featureDensityScale: 1.0,
    chunkBudgetScale: 1.0,
    enableBanners: true,
    enableActorOcclusionGhosts: true,
  }),
  Object.freeze({
    level: 1,
    lodBias: 0,
    featureDensityScale: 0.90,
    chunkBudgetScale: 0.92,
    enableBanners: true,
    enableActorOcclusionGhosts: true,
  }),
  Object.freeze({
    level: 2,
    lodBias: 1,
    featureDensityScale: 0.78,
    chunkBudgetScale: 0.84,
    enableBanners: true,
    enableActorOcclusionGhosts: true,
  }),
  Object.freeze({
    level: 3,
    lodBias: 1,
    featureDensityScale: 0.66,
    chunkBudgetScale: 0.72,
    enableBanners: false,
    enableActorOcclusionGhosts: true,
  }),
  Object.freeze({
    level: 4,
    lodBias: 2,
    featureDensityScale: 0.54,
    chunkBudgetScale: 0.58,
    enableBanners: false,
    enableActorOcclusionGhosts: false,
  }),
  Object.freeze({
    level: 5,
    lodBias: 2,
    featureDensityScale: 0.42,
    chunkBudgetScale: 0.45,
    enableBanners: false,
    enableActorOcclusionGhosts: false,
  }),
]);

function clampInt(value, min, max) {
  const n = Math.floor(Number.isFinite(value) ? Number(value) : min);
  return Math.max(min, Math.min(max, n));
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export class DimetricPerformanceManager {
  constructor(options = {}) {
    const maxProfileLevel = DIMETRIC_QUALITY_PROFILES.length - 1;
    const requestedMinLevel = Number.isFinite(options.minLevel) ? Number(options.minLevel) : 0;
    const requestedMaxLevel = Number.isFinite(options.maxLevel) ? Number(options.maxLevel) : maxProfileLevel;

    this.windowSize = Math.max(8, clampInt(options.windowSize, 8, 240));
    this.minLevel = clampInt(requestedMinLevel, 0, maxProfileLevel);
    this.maxLevel = clampInt(requestedMaxLevel, this.minLevel, maxProfileLevel);
    this.stagePressureEnabled = options.stagePressureEnabled !== false;
    this.degradeBelowFps = Math.max(10, numberOr(options.degradeBelowFps, 44));
    this.upgradeAboveFps = Math.max(this.degradeBelowFps + 1, numberOr(options.upgradeAboveFps, 56));
    this.adjustCooldownFrames = Math.max(0, clampInt(options.adjustCooldownFrames, 0, 600));
    this.level = clampInt(options.startLevel, this.minLevel, this.maxLevel);
    this.frameTimes = [];
    this.stageWindowSize = Math.max(8, clampInt(options.stageWindowSize, 8, 240));
    this.stageSamples = new Map();
    this.totalFrames = 0;
    this.lastAdjustmentFrame = -1000000;
  }

  getAverageFrameMs() {
    if (!this.frameTimes.length) return 1000 / 60;
    const sum = this.frameTimes.reduce((acc, value) => acc + value, 0);
    return sum / this.frameTimes.length;
  }

  getAverageFps() {
    const avgMs = this.getAverageFrameMs();
    if (!Number.isFinite(avgMs) || avgMs <= 0) return 60;
    return 1000 / avgMs;
  }

  getQualityProfile() {
    const baseLevel = clampInt(this.level, 0, DIMETRIC_QUALITY_PROFILES.length - 1);
    const pressure = this.getPressureAdjustment();
    const effectiveLevel = clampInt(baseLevel + pressure, this.minLevel, this.maxLevel);
    const baseProfile = DIMETRIC_QUALITY_PROFILES[effectiveLevel];
    if (!pressure) return baseProfile;
    return {
      ...baseProfile,
      level: effectiveLevel,
      adaptivePressure: pressure,
      baseLevel,
    };
  }

  recordFrameMs(frameMs) {
    const ms = numberOr(frameMs, NaN);
    if (!Number.isFinite(ms) || ms <= 0) return;

    this.totalFrames += 1;
    this.frameTimes.push(ms);
    if (this.frameTimes.length > this.windowSize) this.frameTimes.shift();

    if ((this.totalFrames - this.lastAdjustmentFrame) < this.adjustCooldownFrames) return;

    const avgFps = this.getAverageFps();
    if (avgFps < this.degradeBelowFps && this.level < this.maxLevel) {
      this.level += 1;
      this.lastAdjustmentFrame = this.totalFrames;
      return;
    }
    if (avgFps > this.upgradeAboveFps && this.level > this.minLevel) {
      this.level -= 1;
      this.lastAdjustmentFrame = this.totalFrames;
    }
  }

  recordFrameBreakdown(breakdown = {}) {
    if (!breakdown || typeof breakdown !== 'object') return;
    for (const [rawStage, rawMs] of Object.entries(breakdown)) {
      if (typeof rawStage !== 'string') continue;
      const stage = rawStage.trim().toLowerCase();
      if (!stage) continue;
      const ms = numberOr(rawMs, NaN);
      if (!Number.isFinite(ms) || ms < 0) continue;

      const samples = this.stageSamples.get(stage) || [];
      samples.push(ms);
      if (samples.length > this.stageWindowSize) samples.shift();
      this.stageSamples.set(stage, samples);
    }
  }

  getPressureAdjustment() {
    if (!this.stagePressureEnabled || this.frameTimes.length === 0) return 0;

    const avgMs = Math.max(0.01, this.getAverageFrameMs());
    const stages = this.getStageAverages();
    const worldMs = Number(stages.world) || 0;
    const fxMs = Number(stages.fx) || 0;
    const worldShare = worldMs / avgMs;
    const fxShare = fxMs / avgMs;

    let pressure = 0;
    if (avgMs > 17.4) pressure += 1;
    if (avgMs > 21.5) pressure += 1;
    if (worldMs > 8 && worldShare > 0.62) pressure += 1;
    else if (fxMs > 3 && fxShare > 0.28) pressure += 1;

    return clampInt(pressure, 0, 2);
  }

  getStageAverages() {
    const averages = {};
    for (const [stage, samples] of this.stageSamples.entries()) {
      if (!Array.isArray(samples) || samples.length === 0) continue;
      const sum = samples.reduce((acc, value) => acc + value, 0);
      averages[stage] = sum / samples.length;
    }
    return averages;
  }

  getStageTelemetry(maxStages = 4) {
    const limit = Math.max(1, clampInt(maxStages, 1, 16));
    const avgFrameMs = Math.max(0.01, this.getAverageFrameMs());
    const entries = [];
    for (const [stage, samples] of this.stageSamples.entries()) {
      if (!Array.isArray(samples) || samples.length === 0) continue;
      const sum = samples.reduce((acc, value) => acc + value, 0);
      const avgMs = sum / samples.length;
      entries.push({
        stage,
        avgMs,
        sampleCount: samples.length,
        frameSharePct: (avgMs / avgFrameMs) * 100,
      });
    }
    entries.sort((a, b) => b.avgMs - a.avgMs);
    return entries.slice(0, limit);
  }

  reset(level = this.minLevel) {
    this.level = clampInt(level, this.minLevel, this.maxLevel);
    this.frameTimes.length = 0;
    this.stageSamples.clear();
    this.totalFrames = 0;
    this.lastAdjustmentFrame = -1000000;
  }

  getTelemetry() {
    const profile = this.getQualityProfile();
    return {
      level: this.level,
      effectiveLevel: Number.isFinite(profile?.level) ? profile.level : this.level,
      adaptivePressure: Number.isFinite(profile?.adaptivePressure) ? profile.adaptivePressure : 0,
      avgFps: this.getAverageFps(),
      avgMs: this.getAverageFrameMs(),
      sampleCount: this.frameTimes.length,
      stageAverages: this.getStageAverages(),
    };
  }
}

export default DimetricPerformanceManager;
