/**
 * Fall of Cavalry WEB — versioned character *production* policy.
 * Role weights are PROVISIONAL implementation fixtures, NOT approved historical
 * demographics. Source meanings mirror the existing Character System v2 decision
 * record: village/town/city/fort/inn/port/tribe/business/mine/caravanserai/
 * military training/production/quest/event.
 *
 * This catalog does not create companions, war parties, commanders, family
 * membership, sect, religion or faction loyalty.
 */
export const CHARACTER_PRODUCTION_REVISION = 1;

export const CHARACTER_SOURCE_TYPES = Object.freeze([
  'village', 'town', 'city', 'fort', 'inn', 'port', 'tribe',
  'business', 'mine', 'caravanserai', 'military-training',
  'production', 'quest', 'event',
]);

// Settlement sources refer directly to an authoritative settlement ID.
// Every other source must be registered by its owning system before use.
export const SETTLEMENT_SOURCE_TYPES = Object.freeze({
  village: Object.freeze(['village']),
  town: Object.freeze(['town']),
  city: Object.freeze(['city', 'capital']),
  fort: Object.freeze(['fort', 'fortress', 'castle', 'stronghold']),
});

export const CHARACTER_SOURCE_ROLES = Object.freeze({
  village: Object.freeze({ artisan: 6, traveler: 2, scholar: 1, commander: 1 }),
  town: Object.freeze({ merchant: 4, artisan: 4, administrator: 1, scholar: 1 }),
  city: Object.freeze({ merchant: 3, artisan: 2, administrator: 2, scholar: 2, commander: 1 }),
  fort: Object.freeze({ commander: 7, traveler: 2, administrator: 1 }),
  inn: Object.freeze({ traveler: 6, merchant: 3, scholar: 1 }),
  port: Object.freeze({ merchant: 6, traveler: 3, administrator: 1 }),
  tribe: Object.freeze({ traveler: 5, commander: 4, merchant: 1 }),
  business: Object.freeze({ artisan: 4, merchant: 4, administrator: 2 }),
  mine: Object.freeze({ artisan: 6, administrator: 2, traveler: 2 }),
  caravanserai: Object.freeze({ merchant: 5, traveler: 4, administrator: 1 }),
  'military-training': Object.freeze({ commander: 8, scholar: 1, administrator: 1 }),
  production: Object.freeze({ artisan: 8, merchant: 1, administrator: 1 }),
  quest: Object.freeze({ traveler: 2, merchant: 2, scholar: 2, commander: 2, administrator: 1, artisan: 1 }),
  event: Object.freeze({ traveler: 2, merchant: 2, scholar: 2, commander: 2, administrator: 1, artisan: 1 }),
});
