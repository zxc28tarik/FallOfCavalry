import { describe, expect, it } from 'vitest';
import { getHudControlLines } from '../../js/ui/hud.js';

describe('hud control lines', () => {
  it('returns empty outside map mode', () => {
    expect(getHudControlLines({ mode: 'battle' })).toBe('');
    expect(getHudControlLines({ mode: 'city' })).toBe('');
  });

  it('returns default map controls when build mode is inactive', () => {
    const text = getHudControlLines({
      mode: 'map',
      mapBuildMode: {
        active: false,
        defId: 'wall',
        selectedBuildingId: null,
      },
    });
    expect(text).toContain('Kamera: Ok tuslari/WASD + ekran kenari');
    expect(text).toContain('B: insa modu');
  });

  it('includes selected build def when build mode is active', () => {
    const text = getHudControlLines({
      mode: 'map',
      mapBuildMode: {
        active: true,
        defId: 'gatehouse',
        selectedBuildingId: null,
      },
    });
    expect(text).toContain('Insa: Kapi');
    expect(text).toContain('1-4/Tab: sec');
    expect(text).toContain('B/Esc: cik');
  });

  it('shows selected-building hint when build mode is inactive but a building is selected', () => {
    const text = getHudControlLines({
      mode: 'map',
      mapBuildMode: {
        active: false,
        defId: 'granary',
        selectedBuildingId: 'granary_4_8_1',
      },
    });
    expect(text).toContain('Secili yapi var');
    expect(text).toContain('B: insa modu');
  });
});
