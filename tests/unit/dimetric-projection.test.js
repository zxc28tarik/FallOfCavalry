import { describe, it, expect } from 'vitest';
import {
  buildAnchorAlignedConfig,
  screenToWorld,
  screenToWorldPrecise,
  worldToScreen,
} from '../../js/rendering/dimetric/projection.js';

describe('dimetric projection', () => {
  const camera = { x: 120, y: 80, zoom: 1.35 };
  const config = buildAnchorAlignedConfig({
    anchorTileX: 10,
    anchorTileY: 12,
    anchorWorldX: 560,
    anchorWorldY: 420,
    tileW: 64,
    tileH: 32,
    elevationPx: 24,
  });

  it('worldToScreen and screenToWorld are near-inverse', () => {
    const src = { tileX: 18.25, tileY: 7.75 };
    const screen = worldToScreen(src.tileX, src.tileY, camera, config, 0);
    const back = screenToWorld(screen.x, screen.y, camera, config, 0);
    expect(Math.abs(back.tileX - src.tileX)).toBeLessThan(1e-9);
    expect(Math.abs(back.tileY - src.tileY)).toBeLessThan(1e-9);
  });

  it('screenToWorldPrecise returns exact tile for tile center clicks', () => {
    for (let ty = 0; ty < 6; ty += 1) {
      for (let tx = 0; tx < 6; tx += 1) {
        const screen = worldToScreen(tx, ty, camera, config, 0);
        const picked = screenToWorldPrecise(screen.x, screen.y, camera, config, 0);
        expect(picked.tileX).toBe(tx);
        expect(picked.tileY).toBe(ty);
      }
    }
  });

  it('anchor config maps anchor tile exactly to anchor world point', () => {
    const anchorScreen = worldToScreen(10, 12, { x: 0, y: 0, zoom: 1 }, config, 0);
    expect(anchorScreen.worldX).toBeCloseTo(560, 6);
    expect(anchorScreen.worldY).toBeCloseTo(420, 6);
  });
});

