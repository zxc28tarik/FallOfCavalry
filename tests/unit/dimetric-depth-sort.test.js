import { describe, it, expect } from 'vitest';
import { compareByScreenBottomY, sortByScreenBottomY } from '../../js/rendering/dimetric/depth-sort.js';

describe('dimetric depth sort', () => {
  it('prioritizes lower screen bottom Y first', () => {
    const a = { screenBottomY: 100, layer: 5, sortId: 1 };
    const b = { screenBottomY: 220, layer: 5, sortId: 2 };
    expect(compareByScreenBottomY(a, b)).toBeLessThan(0);
    expect(compareByScreenBottomY(b, a)).toBeGreaterThan(0);
  });

  it('uses layer as secondary tiebreaker', () => {
    const a = { screenBottomY: 150, layer: 3, sortId: 1 };
    const b = { screenBottomY: 150, layer: 7, sortId: 1 };
    expect(compareByScreenBottomY(a, b)).toBeLessThan(0);
  });

  it('sortByScreenBottomY sorts stable keys in expected order', () => {
    const items = [
      { screenBottomY: 220, layer: 5, screenX: 60, sortId: 3, name: 'front' },
      { screenBottomY: 120, layer: 5, screenX: 60, sortId: 2, name: 'back' },
      { screenBottomY: 220, layer: 4, screenX: 70, sortId: 1, name: 'shadow' },
      { screenBottomY: 220, layer: 5, screenX: 40, sortId: 4, name: 'front-left' },
    ];
    const sorted = sortByScreenBottomY(items).map((it) => it.name);
    expect(sorted).toEqual(['back', 'shadow', 'front-left', 'front']);
  });
});

