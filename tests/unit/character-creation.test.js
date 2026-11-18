import { describe, expect, it } from 'vitest';
import {
  CHARACTER_STAT_KEYS,
  createPlayerCharacter,
  defaultCharacterDraft,
  normalizePlayerCharacter,
  validateCharacterDraft,
} from '../../js/systems/character-creation.js';
import StartScreen from '../../js/ui/start-screen.js';
import { SaveManager } from '../../js/managers/SaveManager.js';
import SaveSystem from '../../js/systems/save-system.js';

const draft = (changes = {}) => ({
  ...defaultCharacterDraft('ottoman'),
  name: 'Mehmed Çelebi',
  ...changes,
});

describe('campaign character creation', () => {
  it('validates the name and prevents embedded markup or control characters', () => {
    expect(validateCharacterDraft(draft({ name: 'A' })).ok).toBe(false);
    expect(validateCharacterDraft(draft({ name: '<img>' })).ok).toBe(false);
    expect(validateCharacterDraft(draft({ name: 'Test\nAd' })).ok).toBe(false);
    expect(validateCharacterDraft(draft({ name: '  Mehmed   Çelebi  ' })).value.name).toBe('Mehmed Çelebi');
  });

  it('uses deterministic bounded 0–100 stats and stable player ID', () => {
    const first = createPlayerCharacter(draft(), 'ottoman');
    const second = createPlayerCharacter(draft(), 'ottoman');
    expect(first).toEqual(second);
    expect(first.character.id).toBe('player-hero');
    expect(Object.keys(first.character.stats)).toEqual(CHARACTER_STAT_KEYS);
    expect(Object.values(first.character.stats).every((value) => Number.isInteger(value) && value >= 0 && value <= 100)).toBe(true);
    expect(first.character.stats.command).toBe(57);
    expect(first.character.stats.courage).toBe(45);
  });

  it('makes origins and expertise meaningfully different without changing factions', () => {
    const soldier = createPlayerCharacter(draft(), 'ottoman');
    const merchant = createPlayerCharacter(draft({ originId: 'merchant', focusId: 'trade' }), 'ottoman');
    expect(merchant.character.stats.trade).toBeGreaterThan(soldier.character.stats.trade);
    expect(merchant.startingModifiers.gold).toBe(80);
    expect(soldier.startingModifiers.morale).toBe(4);
    expect(merchant.character.cultureId).toBe('ottoman');
    expect(merchant.character).not.toHaveProperty('factionId');
  });

  it('defaults invalid enum values instead of persisting arbitrary identifiers', () => {
    const value = createPlayerCharacter(draft({
      cultureId: 'invalid', originId: 'unsupported', focusId: 'bad', ageGroup: 'nope',
    }), 'polish').character;
    expect(value.cultureId).toBe('polish');
    expect(value.originId).toBe('soldier');
    expect(value.focusId).toBe('command');
    expect(value.ageGroup).toBe('mature');
  });

  it('preserves stored stats and sanitizes legacy or malformed save fields', () => {
    expect(normalizePlayerCharacter(null)).toBeNull();
    const base = createPlayerCharacter(draft(), 'ottoman').character;
    const loaded = normalizePlayerCharacter({
      ...base,
      stats: { command: 99, courage: 900, trade: -4, leadership: Infinity },
    });
    expect(loaded).toMatchObject({ id: 'player-hero', name: 'Mehmed Çelebi' });
    expect(loaded.stats.command).toBe(99);
    expect(loaded.stats.courage).toBe(100);
    expect(loaded.stats.trade).toBe(0);
    expect(loaded.stats.leadership).toBe(base.stats.leadership);
  });

  it('creates readable preview without injecting character name as HTML', () => {
    const preview = { textContent: '', innerHTML: 'unchanged' };
    const screen = new StartScreen({ state: {}, saveSystem: {} });
    screen.selectedId = 'ottoman';
    screen.dom = {
      characterPreview: preview,
      characterNameInput: { value: 'Ayşe Hatun' },
      characterOriginInput: { value: 'scribe' },
      characterFocusInput: { value: 'administration' },
    };
    expect(screen.refreshCharacterPreview()).toBe(true);
    expect(preview.textContent).toContain('Ayşe Hatun');
    expect(preview.textContent).toContain('Yönetim');
    expect(preview.innerHTML).toBe('unchanged');
  });

  it('serializes and loads the same identity without changing the save schema version', () => {
    const character = createPlayerCharacter(draft({ ageGroup: 'young' }), 'ottoman').character;
    const state = { day: 1, mode: 'map', map: { settlements: [] }, camera: { x: 0, y: 0, zoom: 1 } };
    const party = { gold: 100, x: 10, y: 15, character, roster: [], inventory: { items: [] } };
    const manager = new SaveManager(state);
    manager.init({
      playerParty: party,
      worldManager: { enemyParties: [], syncBuildingStateToMap: () => null },
      ensureInventoryModel: () => {},
      settings: {},
    });
    const data = manager.buildSavePayload();
    expect(data.schemaVersion).toBe(1);
    expect(data.game.playerParty.character).toEqual(character);
    const migrated = new SaveSystem().normalizePayload(JSON.parse(JSON.stringify(data)));
    expect(migrated.ok).toBe(true);
    expect(migrated.data.game.playerParty.character).toEqual(character);
    const legacy = new SaveSystem().normalizePayload({ schemaVersion: 1, game: { playerParty: { gold: 100 } } });
    expect(legacy.data.game.playerParty.character).toBeNull();
  });
});
