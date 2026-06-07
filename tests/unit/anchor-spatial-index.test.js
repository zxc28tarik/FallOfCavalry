import { describe, expect, it } from 'vitest';
import { AnchorSpatialIndex, hashLodScore } from '../../js/rendering/dimetric/anchor-spatial-index.js';

describe('AnchorSpatialIndex', () => {
  it('queries anchors inside visible bounds plus margin only', () => {
    const anchors = [
      { x: 4, y: 4 },
      { x: 14, y: 14 },
      { x: 40, y: 40 },
    ];
    const index = new AnchorSpatialIndex(anchors, 'forest', 8);
    const visible = index.queryVisible({ minX: 10, minY: 10, maxX: 20, maxY: 20 }, 4);

    expect(visible).toContain(anchors[1]);
    expect(visible).not.toContain(anchors[0]);
    expect(visible).not.toContain(anchors[2]);
  });

  it('assigns deterministic lod scores for the same anchor set', () => {
    const first = [{ x: 3, y: 7 }, { x: 12, y: 8 }];
    const second = [{ x: 3, y: 7 }, { x: 12, y: 8 }];

    new AnchorSpatialIndex(first, 'mountain', 64);
    new AnchorSpatialIndex(second, 'mountain', 64);

    expect(first.map((anchor) => anchor.lodScore)).toEqual(second.map((anchor) => anchor.lodScore));
    expect(first[0].lodScore).toBe(hashLodScore(3, 7, 2));
  });

  it('returns the same visible anchors regardless of caller zoom arguments', () => {
    const anchors = [
      { x: 8, y: 8 },
      { x: 12, y: 12 },
      { x: 18, y: 18 },
      { x: 48, y: 48 },
    ];
    const index = new AnchorSpatialIndex(anchors, 'forest', 8);
    const bounds = { minX: 10, minY: 10, maxX: 20, maxY: 20 };

    const close = index.queryVisible(bounds, 2, 1.0);
    const far = index.queryVisible(bounds, 2, 0.5);

    expect(far).toEqual(close);
    expect(far).toContain(anchors[1]);
    expect(far).toContain(anchors[2]);
  });
});
