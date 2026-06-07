import { describe, expect, it } from 'vitest';
import { DimetricPerformanceManager } from '../../js/rendering/dimetric/performance-manager.js';

describe('dimetric performance manager', () => {
  it('starts with level 0 profile by default', () => {
    const mgr = new DimetricPerformanceManager();
    const profile = mgr.getQualityProfile();
    expect(profile.level).toBe(0);
    expect(profile.lodBias).toBe(0);
  });

  it('degrades quality on sustained low fps', () => {
    const mgr = new DimetricPerformanceManager({
      windowSize: 10,
      adjustCooldownFrames: 0,
      degradeBelowFps: 50,
      upgradeAboveFps: 80,
    });
    for (let i = 0; i < 15; i += 1) mgr.recordFrameMs(30); // ~33 fps
    expect(mgr.getQualityProfile().level).toBeGreaterThan(0);
  });

  it('upgrades quality on sustained high fps', () => {
    const mgr = new DimetricPerformanceManager({
      windowSize: 10,
      adjustCooldownFrames: 0,
      startLevel: 4,
      degradeBelowFps: 40,
      upgradeAboveFps: 55,
    });
    for (let i = 0; i < 15; i += 1) mgr.recordFrameMs(10); // 100 fps
    expect(mgr.getQualityProfile().level).toBeLessThan(4);
  });

  it('respects min/max bounds', () => {
    const mgr = new DimetricPerformanceManager({
      minLevel: 1,
      maxLevel: 2,
      startLevel: 2,
      adjustCooldownFrames: 0,
      degradeBelowFps: 30,
      upgradeAboveFps: 60,
    });
    for (let i = 0; i < 20; i += 1) mgr.recordFrameMs(100); // very low fps
    expect(mgr.getQualityProfile().level).toBe(2);
    for (let i = 0; i < 20; i += 1) mgr.recordFrameMs(5); // very high fps
    expect(mgr.getQualityProfile().level).toBe(1);
  });

  it('records stage breakdown averages and exposes top telemetry', () => {
    const mgr = new DimetricPerformanceManager({
      windowSize: 10,
      stageWindowSize: 10,
    });
    for (let i = 0; i < 10; i += 1) {
      mgr.recordFrameMs(16);
      mgr.recordFrameBreakdown({
        world: 9 + (i * 0.1),
        fx: 2.5,
        ui: 1.5,
      });
    }
    const averages = mgr.getStageAverages();
    expect(averages.world).toBeGreaterThan(9);
    expect(averages.fx).toBeCloseTo(2.5, 6);
    expect(averages.ui).toBeCloseTo(1.5, 6);

    const top = mgr.getStageTelemetry(2);
    expect(top).toHaveLength(2);
    expect(top[0].stage).toBe('world');
    expect(top[0].avgMs).toBeGreaterThan(top[1].avgMs);
    expect(top[0].frameSharePct).toBeGreaterThan(0);
  });

  it('clears stage telemetry on reset', () => {
    const mgr = new DimetricPerformanceManager();
    mgr.recordFrameMs(16);
    mgr.recordFrameBreakdown({ world: 8, ui: 2 });
    expect(Object.keys(mgr.getTelemetry().stageAverages)).toContain('world');

    mgr.reset();
    expect(mgr.getStageTelemetry().length).toBe(0);
    expect(Object.keys(mgr.getTelemetry().stageAverages)).toHaveLength(0);
  });

  it('applies adaptive pressure when world stage dominates frame budget', () => {
    const mgr = new DimetricPerformanceManager({
      startLevel: 0,
      minLevel: 0,
      maxLevel: 5,
      adjustCooldownFrames: 9999,
      degradeBelowFps: 10,
      upgradeAboveFps: 120,
    });
    for (let i = 0; i < 16; i += 1) {
      mgr.recordFrameMs(18.8);
      mgr.recordFrameBreakdown({ world: 12.2, fx: 3.2, ui: 1.8 });
    }
    const profile = mgr.getQualityProfile();
    const telemetry = mgr.getTelemetry();
    expect(mgr.level).toBe(0);
    expect(profile.level).toBeGreaterThan(0);
    expect(profile.adaptivePressure).toBeGreaterThan(0);
    expect(telemetry.effectiveLevel).toBe(profile.level);
    expect(telemetry.adaptivePressure).toBe(profile.adaptivePressure);
  });

  it('disables adaptive pressure when stagePressureEnabled=false', () => {
    const mgr = new DimetricPerformanceManager({
      stagePressureEnabled: false,
      startLevel: 1,
      minLevel: 1,
      maxLevel: 5,
      adjustCooldownFrames: 9999,
      degradeBelowFps: 10,
      upgradeAboveFps: 120,
    });
    for (let i = 0; i < 12; i += 1) {
      mgr.recordFrameMs(19.2);
      mgr.recordFrameBreakdown({ world: 13.0, fx: 3.0, ui: 1.4 });
    }
    const profile = mgr.getQualityProfile();
    const telemetry = mgr.getTelemetry();
    expect(profile.level).toBe(1);
    expect(telemetry.effectiveLevel).toBe(1);
    expect(telemetry.adaptivePressure).toBe(0);
  });

  it('derives chunk build limits from world stage budget', () => {
    const mgr = new DimetricPerformanceManager({ stageWindowSize: 10 });

    mgr.recordFrameBreakdown({ world: 7.5 });
    expect(mgr.getFrameChunkBuildLimit()).toBe(4);

    mgr.reset();
    mgr.recordFrameBreakdown({ world: 12 });
    expect(mgr.getFrameChunkBuildLimit()).toBe(2);

    mgr.reset();
    mgr.recordFrameBreakdown({ world: 18 });
    expect(mgr.getFrameChunkBuildLimit()).toBe(1);
  });
});
