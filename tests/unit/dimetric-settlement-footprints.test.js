import { describe, expect, it } from 'vitest';
import { getDimetricSettlementFootprint } from '../../js/rendering/dimetric/settlement-footprints.js';

describe('dimetric settlement footprints', () => {
  it('returns type-specific footprint for forts', () => {
    const out = getDimetricSettlementFootprint({ type: 'fort' });
    expect(out.footprintW).toBe(2);
    expect(out.footprintH).toBe(2);
    expect(out.depthMul).toBeGreaterThan(1.6);
    expect(out.occluderH).toBeGreaterThan(2.5);
  });

  it('falls back to default values for unknown type', () => {
    const out = getDimetricSettlementFootprint({ type: 'unknown_type' });
    expect(out.footprintW).toBe(1);
    expect(out.footprintH).toBe(1);
    expect(out.depthMul).toBeCloseTo(1.2, 6);
    expect(out.minPixelW).toBeCloseTo(1.25, 6);
  });

  it('handles empty settlement payload safely', () => {
    const out = getDimetricSettlementFootprint(null);
    expect(out.footprintW).toBeGreaterThanOrEqual(1);
    expect(out.footprintH).toBeGreaterThanOrEqual(1);
    expect(out.occluderW).toBeGreaterThan(0);
    expect(out.occluderH).toBeGreaterThan(0);
  });
});
