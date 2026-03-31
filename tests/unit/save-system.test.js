import { describe, expect, it } from 'vitest';
import SaveSystem, { normalizeBuildingState } from '../../js/systems/save-system.js';

describe('SaveSystem building-state normalization', () => {
  it('returns null for non-object building payloads', () => {
    expect(normalizeBuildingState(null)).toBeNull();
    expect(normalizeBuildingState([])).toBeNull();
    expect(normalizeBuildingState('invalid')).toBeNull();
  });

  it('sanitizes building entries and nextId', () => {
    const normalized = normalizeBuildingState({
      nextId: 'x',
      buildings: [
        { id: 9, defId: 'wall', anchorX: '3', anchorY: 4, state: 1 },
        { defId: '', anchorX: 10, anchorY: 12 },
        { defId: 'keep', anchorX: 7.8, anchorY: 9.1, state: 'placed' },
      ],
    });

    expect(normalized).toEqual({
      nextId: 3,
      buildings: [
        { id: 'wall_3_4_0', defId: 'wall', anchorX: 3, anchorY: 4, state: 'default' },
        { id: 'keep_7_9_2', defId: 'keep', anchorX: 7, anchorY: 9, state: 'placed' },
      ],
    });
  });

  it('normalizes buildings during payload migration', () => {
    const saveSystem = new SaveSystem();
    const result = saveSystem.normalizePayload({
      schemaVersion: 1,
      game: {
        day: 8,
        buildings: {
          nextId: 1,
          buildings: [
            { defId: 'gatehouse', anchorX: 12.4, anchorY: 8.6 },
            { defId: '', anchorX: 1, anchorY: 2 },
          ],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data.game.buildings).toEqual({
      nextId: 2,
      buildings: [
        { id: 'gatehouse_12_8_0', defId: 'gatehouse', anchorX: 12, anchorY: 8, state: 'default' },
      ],
    });
  });
});

