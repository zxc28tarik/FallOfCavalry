import { describe, expect, it } from 'vitest';
import {
  createRiverBands,
  createRoadBands,
  drawCrossingMarker,
  drawPolylineBands,
  pathIntersectsTileBounds,
  projectTilePath,
} from '../../js/rendering/dimetric/path-layer.js';

function makeCtxStub() {
  const calls = {
    beginPath: 0,
    moveTo: 0,
    lineTo: 0,
    stroke: 0,
    fill: 0,
    save: 0,
    restore: 0,
  };
  return {
    calls,
    lineJoin: '',
    lineCap: '',
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    save() { calls.save += 1; },
    restore() { calls.restore += 1; },
    beginPath() { calls.beginPath += 1; },
    moveTo() { calls.moveTo += 1; },
    lineTo() { calls.lineTo += 1; },
    closePath() {},
    stroke() { calls.stroke += 1; },
    fill() { calls.fill += 1; },
  };
}

describe('dimetric path layer', () => {
  it('detects whether path intersects visible tile bounds', () => {
    const bounds = { minX: 10, minY: 10, maxX: 20, maxY: 20 };
    const inside = [{ x: 5, y: 5 }, { x: 12, y: 14 }];
    const outside = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
    const crossingSegment = [{ x: 0, y: 15 }, { x: 30, y: 15 }];
    expect(pathIntersectsTileBounds(inside, bounds)).toBe(true);
    expect(pathIntersectsTileBounds(outside, bounds)).toBe(false);
    expect(pathIntersectsTileBounds(outside, bounds, 10)).toBe(true);
    expect(pathIntersectsTileBounds(crossingSegment, bounds)).toBe(true);
  });

  it('projects tile paths and skips invalid points', () => {
    const path = [
      { x: 1, y: 2 },
      { x: Number.NaN, y: 4 },
      { x: 3, y: 5 },
    ];
    const projected = projectTilePath(path, (x, y) => ({ x: x * 10, y: y * 10 }));
    expect(projected).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 50 },
    ]);
  });

  it('builds river/road bands with stable structure', () => {
    const rivers = createRiverBands(1);
    const roads = createRoadBands(1);
    expect(rivers).toHaveLength(4);
    expect(roads).toHaveLength(3);
    expect(rivers[0].width).toBeGreaterThan(rivers[3].width);
    expect(roads[0].width).toBeGreaterThan(roads[2].width);
  });

  it('draws polyline bands when enough points exist', () => {
    const ctx = makeCtxStub();
    const points = [{ x: 1, y: 1 }, { x: 10, y: 10 }, { x: 20, y: 8 }];
    const bands = [{ color: 'rgba(0,0,0,0.8)', width: 3 }, { color: 'rgba(255,255,255,0.5)', width: 1 }];
    const drawn = drawPolylineBands(ctx, points, bands);
    expect(drawn).toBe(true);
    expect(ctx.calls.stroke).toBe(2);
    expect(ctx.calls.moveTo).toBe(2);
  });

  it('draws crossing marker with valid coordinates', () => {
    const ctx = makeCtxStub();
    const ok = drawCrossingMarker(ctx, {
      x: 100,
      y: 80,
      tileW: 64,
      tileH: 32,
      zoom: 1,
    });
    expect(ok).toBe(true);
    expect(ctx.calls.fill).toBe(1);
    expect(ctx.calls.stroke).toBe(2);
  });
});
