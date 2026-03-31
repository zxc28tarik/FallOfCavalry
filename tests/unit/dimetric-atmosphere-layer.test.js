import { describe, expect, it } from 'vitest';
import {
  getDimetricWaterShimmerStrength,
  getDimetricWaterShimmerStride,
  renderDimetricAtmosphereOverlay,
  resolveDimetricAtmosphere,
} from '../../js/rendering/dimetric/atmosphere-layer.js';

function makeCtxStub() {
  let fillRectCalls = 0;
  return {
    fillStyle: '',
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    fillRect() {
      fillRectCalls += 1;
    },
    getFillRectCalls() {
      return fillRectCalls;
    },
  };
}

describe('dimetric atmosphere layer', () => {
  it('resolves stronger tint at night than day', () => {
    const day = resolveDimetricAtmosphere({ type: 'CLEAR', timeOfDay: 'DAY' }, { qualityLevel: 0 });
    const night = resolveDimetricAtmosphere({ type: 'CLEAR', timeOfDay: 'NIGHT' }, { qualityLevel: 0 });
    expect(day.top.a).toBeLessThan(night.top.a);
    expect(day.vignette).toBeLessThan(night.vignette);
  });

  it('applies quality scaling to atmosphere intensity', () => {
    const high = resolveDimetricAtmosphere({ type: 'FOG', timeOfDay: 'EVENING' }, { qualityLevel: 0 });
    const low = resolveDimetricAtmosphere({ type: 'FOG', timeOfDay: 'EVENING' }, { qualityLevel: 4 });
    expect(low.top.a).toBeLessThan(high.top.a);
    expect(low.bottom.a).toBeLessThan(high.bottom.a);
  });

  it('renders overlay with gradient and vignette', () => {
    const ctx = makeCtxStub();
    const ok = renderDimetricAtmosphereOverlay(
      ctx,
      1280,
      720,
      resolveDimetricAtmosphere({ type: 'RAIN', timeOfDay: 'DAWN' }, { qualityLevel: 0 }),
    );
    expect(ok).toBe(true);
    expect(ctx.getFillRectCalls()).toBeGreaterThanOrEqual(1);
  });

  it('computes bounded shimmer strength and adaptive stride', () => {
    const s0 = getDimetricWaterShimmerStrength({ timeMs: 5000, tx: 12, ty: 8, qualityLevel: 0 });
    const s1 = getDimetricWaterShimmerStrength({ timeMs: 5100, tx: 12, ty: 8, qualityLevel: 0 });
    expect(s0).toBeGreaterThanOrEqual(0);
    expect(s0).toBeLessThanOrEqual(1);
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s1).toBeLessThanOrEqual(1);
    expect(s0).not.toBe(s1);

    const full = getDimetricWaterShimmerStride({ zoom: 1.1, qualityLevel: 0 });
    const reduced = getDimetricWaterShimmerStride({ zoom: 0.62, qualityLevel: 2 });
    const minimal = getDimetricWaterShimmerStride({ zoom: 0.40, qualityLevel: 4 });
    expect(full).toBe(1);
    expect(reduced).toBeGreaterThanOrEqual(2);
    expect(minimal).toBe(4);
  });
});

