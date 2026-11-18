/**
 * Character System v2 importance advancement. Character class is NOT a role,
 * battle rank, companion type, faction membership, or a random level system.
 *
 * These transitions copy the approved decision record (section 7). No
 * frequency, automatic promotion or stat/loyalty/relationship effect is set.
 * The caller's reviewTier is an explicit command classification, NOT proof
 * of player approval; gameplay must authorize the originating event.
 */
export const IMPORTANCE_ADVANCEMENT_RULES = Object.freeze({
  D: Object.freeze({ C: 'standard' }),
  C: Object.freeze({ B: 'rare', A: 'very-rare' }),
  B: Object.freeze({ A: 'standard' }),
  A: Object.freeze({}),
});

export function requiredImportanceReviewTier(from, to) {
  return Object.hasOwn(IMPORTANCE_ADVANCEMENT_RULES, from)
    && Object.hasOwn(IMPORTANCE_ADVANCEMENT_RULES[from], to)
    ? IMPORTANCE_ADVANCEMENT_RULES[from][to] : null;
}

export function advanceNamedCharacterImportance(roster, characterId, {
  toImportance,
  day = 1,
  reason,
  reviewTier = 'standard',
} = {}) {
  const characters = roster?.characters;
  if (!Array.isArray(characters)) return false;
  const person = characters.find((entry) => entry?.id === characterId);
  if (!person || person.kind !== 'named' || person.status !== 'alive') return false;
  const requiredTier = requiredImportanceReviewTier(person.importance, toImportance);
  if (!requiredTier || reviewTier !== requiredTier) return false;
  if (!Number.isSafeInteger(day) || day < 1 || day > 10000000) return false;
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 120
    || /[<>\r\n\t]/.test(reason)) return false;
  const lastDay = Array.isArray(person.history) && person.history.length
    ? person.history[person.history.length - 1]?.day : null;
  if (Number.isSafeInteger(lastDay) && day < lastDay) return false;

  const from = person.importance;
  person.importance = toImportance;
  person.history = [...(Array.isArray(person.history) ? person.history : []), {
    day,
    type: 'importance',
    from,
    to: toImportance,
    reviewTier,
    reason: reason.trim(),
  }].slice(-16);
  return true;
}
