/**
 * Web campaign player character creation.
 * Character identity is persistent campaign data, not a rendered soldier or a new faction.
 * Effects are intentionally modest and provisional until the full Character System is integrated.
 */
export const CHARACTER_ORIGINS = Object.freeze([
  { id: 'soldier', name: 'Tecrübeli asker', description: 'Disiplinli bir maiyet başlangıcı.', boosts: { command: 10, courage: 10, leadership: 5 }, gold: 0, morale: 4, renown: 0 },
  { id: 'merchant', name: 'Tüccar ailesi', description: 'Pazar bağlantıları ve ticaret eğitimi.', boosts: { trade: 15, persuasion: 8, observation: 2 }, gold: 80, morale: 0, renown: 0 },
  { id: 'scribe', name: 'Kâtip / medrese', description: 'Kayıt, gözlem ve idare tecrübesi.', boosts: { intelligence: 10, administration: 10, observation: 5 }, gold: 0, morale: 0, renown: 2 },
  { id: 'traveler', name: 'Seyyah / haberci', description: 'Yol bilgisi ve insanlarla temas.', boosts: { observation: 10, persuasion: 10, courage: 5 }, gold: 30, morale: 2, renown: 0 },
]);

export const CHARACTER_FOCUSES = Object.freeze([
  { id: 'command', name: 'Kumandanlık', stat: 'command' },
  { id: 'trade', name: 'Ticaret', stat: 'trade' },
  { id: 'diplomacy', name: 'İkna', stat: 'persuasion' },
  { id: 'administration', name: 'Yönetim', stat: 'administration' },
  { id: 'leadership', name: 'Liderlik', stat: 'leadership' },
]);

export const CHARACTER_AGES = Object.freeze([
  { id: 'young', name: 'Genç' },
  { id: 'mature', name: 'Olgun' },
  { id: 'elder', name: 'Yaşlı' },
]);

export const CHARACTER_STAT_KEYS = Object.freeze([
  'intelligence', 'observation', 'persuasion', 'leadership', 'command',
  'trade', 'administration', 'courage', 'experience',
]);

export const CHARACTER_CULTURES = Object.freeze([
  { id: 'ottoman', name: 'Osmanlı' },
  { id: 'hre', name: 'Orta Avrupa' },
  { id: 'polish', name: 'Leh' },
  { id: 'spanish', name: 'İber' },
  { id: 'venice', name: 'Venedikli' },
]);

function knownId(list, value, fallback) {
  return list.some((entry) => entry.id === value) ? value : fallback;
}

function clampStat(value, fallback = 35) {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : fallback;
}

export function defaultCharacterDraft(factionId = 'ottoman') {
  return {
    name: '',
    cultureId: knownId(CHARACTER_CULTURES, factionId, 'ottoman'),
    originId: 'soldier',
    focusId: 'command',
    ageGroup: 'mature',
  };
}

export function validateCharacterDraft(draft, factionId = 'ottoman') {
  const source = draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {};
  const rawName = String(source.name ?? '');
  if (/[<>\x00-\x1F\x7F]/u.test(rawName)) {
    return { ok: false, error: 'Karakter adında kontrol işareti veya < > kullanılamaz.' };
  }
  const name = rawName.trim().replace(/\s+/gu, ' ');
  const length = Array.from(name).length;
  if (length < 2 || length > 32 || /[<>\x00-\x1F\x7F]/u.test(name)) {
    return { ok: false, error: 'Karakter adı 2–32 karakter olmalı; kontrol işaretleri ve < > kullanılamaz.' };
  }
  const defaults = defaultCharacterDraft(factionId);
  return {
    ok: true,
    value: {
      name,
      cultureId: knownId(CHARACTER_CULTURES, source.cultureId, defaults.cultureId),
      originId: knownId(CHARACTER_ORIGINS, source.originId, defaults.originId),
      focusId: knownId(CHARACTER_FOCUSES, source.focusId, defaults.focusId),
      ageGroup: knownId(CHARACTER_AGES, source.ageGroup, defaults.ageGroup),
    },
  };
}

export function createPlayerCharacter(draft, factionId = 'ottoman') {
  const result = validateCharacterDraft(draft, factionId);
  if (!result.ok) return result;

  const value = result.value;
  const origin = CHARACTER_ORIGINS.find((entry) => entry.id === value.originId);
  const focus = CHARACTER_FOCUSES.find((entry) => entry.id === value.focusId);
  const stats = Object.fromEntries(CHARACTER_STAT_KEYS.map((key) => [key, 35]));
  stats.experience = 20;
  for (const [key, bonus] of Object.entries(origin.boosts)) {
    stats[key] = clampStat(stats[key] + bonus);
  }
  stats[focus.stat] = clampStat(stats[focus.stat] + 12);

  return {
    ok: true,
    character: {
      schemaVersion: 1,
      id: 'player-hero',
      name: value.name,
      cultureId: value.cultureId,
      originId: value.originId,
      focusId: value.focusId,
      ageGroup: value.ageGroup,
      importance: 'A',
      stats,
    },
    startingModifiers: { gold: origin.gold, morale: origin.morale, renown: origin.renown },
  };
}

/** Legacy saves have no character; do not fabricate or overwrite their campaign history. */
export function normalizePlayerCharacter(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const validated = validateCharacterDraft(value, value.cultureId);
  if (!validated.ok) return null;
  const recreated = createPlayerCharacter(validated.value, value.cultureId).character;
  const stats = {};
  for (const key of CHARACTER_STAT_KEYS) {
    stats[key] = clampStat(value.stats?.[key], recreated.stats[key]);
  }
  return { ...recreated, stats };
}
