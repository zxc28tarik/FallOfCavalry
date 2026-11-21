/**
 * Authoritative Character System v2 social source gate.
 *
 * Catalog comes from trusted authored game content (not from save JSON).
 * Runtime state and old saves can store relationships and legacy snapshots,
 * but cannot define new HouseState or CliqueState through those snapshots.
 */
import { AUTHORED_CHARACTER_SOCIAL_SOURCE_MANIFEST } from '../data/character-social-source-manifest.js';
import { compileCharacterSocialSourceManifest } from './character-social-source-manifest.js';
import { emptyCharacterSocialState, normalizeCharacterSocialState } from './character-social.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const edges = (data) => ({
  houseMemberships: data.houseMemberships,
  cliqueMemberships: data.cliqueMemberships,
  houseCliqueLinks: data.houseCliqueLinks,
});

/** Validate approved authored data against real NamedCharacters/settlements. */
export function getAuthoritativeCharacterSocialGroups({
  catalog, roster, settlements,
} = {}) {
  // The default source is trusted authored game content. Invalid, unapproved,
  // or partially unresolved manifest records activate NOTHING (atomic gate).
  // Existing explicit catalog injection is kept for trusted boot/test fixtures.
  const compiled = catalog === undefined
    ? compileCharacterSocialSourceManifest(AUTHORED_CHARACTER_SOCIAL_SOURCE_MANIFEST, {
      roster, settlements,
    }) : null;
  const approved = catalog === undefined
    ? (compiled.accepted ? compiled.catalog : null) : catalog;
  // Never pass relationships from the source catalog to runtime: authored
  // identity/leadership/group hierarchy only.
  const parsed = normalizeCharacterSocialState({
    houses: Array.isArray(approved?.houses) ? approved.houses : [],
    cliques: Array.isArray(approved?.cliques) ? approved.cliques : [],
  }, { roster, settlements });
  return { houses: parsed.houses, cliques: parsed.cliques };
}

/**
 * Reconstruct from canonical definitions, then accept only explicit links
 * referring to the SAME group definitions. The definition snapshot in a
 * V1.7 save is compatibility data, never source authority.
 */
export function reconcileCharacterSocialState(snapshot, options = {}) {
  const groups = getAuthoritativeCharacterSocialGroups(options);
  const cleaned = normalizeCharacterSocialState(snapshot, options);
  const houses = new Set(cleaned.houses.filter((h) =>
    groups.houses.some((canonical) => same(h, canonical))).map((h) => h.houseId));
  const cliques = new Set(cleaned.cliques.filter((g) =>
    groups.cliques.some((canonical) => same(g, canonical))).map((g) => g.cliqueId));
  return normalizeCharacterSocialState({
    ...groups,
    houseMemberships: cleaned.houseMemberships.filter((x) => houses.has(x.houseId)),
    cliqueMemberships: cleaned.cliqueMemberships.filter((x) => cliques.has(x.cliqueId)),
    houseCliqueLinks: cleaned.houseCliqueLinks.filter((x) =>
      houses.has(x.houseId) && cliques.has(x.cliqueId)),
  }, options);
}

/**
 * Validate EACH snapshot independently before combining. This prevents a
 * forged legacy group with a colliding ID from attaching to an official one.
 */
export function restoreAuthorizedCharacterSocialState(current, legacyPending, options = {}) {
  const groups = getAuthoritativeCharacterSocialGroups(options);
  const a = reconcileCharacterSocialState(current, options);
  const b = reconcileCharacterSocialState(legacyPending, options);
  return normalizeCharacterSocialState({
    ...groups,
    houseMemberships: [...a.houseMemberships, ...b.houseMemberships],
    cliqueMemberships: [...a.cliqueMemberships, ...b.cliqueMemberships],
    houseCliqueLinks: [...a.houseCliqueLinks, ...b.houseCliqueLinks],
  }, options);
}

/**
 * Retain legacy/unverified records for future authorized migration, but never
 * expose them as runtime groups or valid memberships.
 */
export function retainPendingCharacterSocialSnapshot(current, legacyPending, options = {}) {
  const pending = normalizeCharacterSocialState(legacyPending, options);
  const fromSave = normalizeCharacterSocialState(current, options);
  const canonical = getAuthoritativeCharacterSocialGroups(options);
  const hasUnverifiedGroups = fromSave.houses.some((g) =>
    !canonical.houses.some((approved) => same(g, approved)))
    || fromSave.cliques.some((g) =>
      !canonical.cliques.some((approved) => same(g, approved)));
  if (!hasUnverifiedGroups) return pending;
  // No lossy deletion: preserve the old complete snapshot as inactive data.
  return normalizeCharacterSocialState({
    houses: [...pending.houses, ...fromSave.houses],
    cliques: [...pending.cliques, ...fromSave.cliques],
    houseMemberships: [...pending.houseMemberships, ...fromSave.houseMemberships],
    cliqueMemberships: [...pending.cliqueMemberships, ...fromSave.cliqueMemberships],
    houseCliqueLinks: [...pending.houseCliqueLinks, ...fromSave.houseCliqueLinks],
  }, options);
}

export function isCharacterSocialEmpty(data) {
  const normalized = data || emptyCharacterSocialState();
  return !normalized.houses?.length && !normalized.cliques?.length
    && !Object.values(edges(normalized)).some((items) => items?.length);
}
