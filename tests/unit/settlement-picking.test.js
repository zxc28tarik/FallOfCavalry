import { describe, expect, it } from 'vitest';
import {
  distanceToSettlementTiles,
  findSettlementAtWorldPoint,
  getSettlementInteractRangeTiles,
  isWorldPointNearSettlement,
} from '../../js/systems/settlement-picking.js';

const TILE = 32;

function worldOfTile(tx, ty) {
  return {
    x: (tx + 0.5) * TILE,
    y: (ty + 0.5) * TILE,
  };
}

describe('settlement picking', () => {
  it('finds exact settlement hit in top-down mode', () => {
    const map = {
      settlements: [
        { id: 'v1', type: 'village', tx: 10, ty: 12, ...worldOfTile(10, 12) },
        { id: 'v2', type: 'village', tx: 20, ty: 22, ...worldOfTile(20, 22) },
      ],
    };
    const center = worldOfTile(10, 12);
    const hit = findSettlementAtWorldPoint(map, center.x, center.y, {
      tileSize: TILE,
      isDimetric: false,
    });
    expect(hit?.id).toBe('v1');
  });

  it('uses larger dimetric hit area for city/fort footprints', () => {
    const map = {
      settlements: [
        { id: 'city-a', type: 'city', tx: 30, ty: 30, ...worldOfTile(30, 30) },
      ],
    };
    const nearCityEdge = {
      x: 30.7 * TILE,
      y: 30.7 * TILE,
    };
    const hitTopDown = findSettlementAtWorldPoint(map, nearCityEdge.x, nearCityEdge.y, {
      tileSize: TILE,
      isDimetric: false,
    });
    const hitDimetric = findSettlementAtWorldPoint(map, nearCityEdge.x, nearCityEdge.y, {
      tileSize: TILE,
      isDimetric: true,
    });
    expect(hitTopDown).toBe(null);
    expect(hitDimetric?.id).toBe('city-a');
  });

  it('computes tile distance and near-range checks', () => {
    const fort = { id: 'f1', type: 'fort', tx: 8, ty: 8, ...worldOfTile(8, 8) };
    const near = worldOfTile(9, 9);
    const far = worldOfTile(13, 13);
    const distNear = distanceToSettlementTiles(fort, near.x, near.y, { tileSize: TILE });
    expect(distNear).toBeGreaterThan(2.0);
    expect(distNear).toBeLessThan(2.2);

    const range = getSettlementInteractRangeTiles(fort, { isDimetric: true });
    expect(range).toBeGreaterThan(2.0);
    expect(isWorldPointNearSettlement(fort, near.x, near.y, { tileSize: TILE, isDimetric: true })).toBe(true);
    expect(isWorldPointNearSettlement(fort, far.x, far.y, { tileSize: TILE, isDimetric: true })).toBe(false);
  });
});
