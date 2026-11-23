/**
 * WEB V1.73 — actual production-source character contacts for real city plots.
 *
 * A registered NamedCharacter may originate from an existing industrial
 * workshop. This is provenance only: it NEVER proves employment, wages,
 * ownership, workshop staffing, trade-network membership or production buffs.
 * No global NPC generation, save mutation, invented jobs or additional ledgers.
 */
import { discoverCharacterProductionSources } from './character-production-sources.js';
import { getSettlementCharacters } from './world-characters.js';

const encode = value => encodeURIComponent(String(value)).replace(/~/g, '%7E');
const sortText = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });

/**
 * Reuses Character System v2's registered physical workshop source list.
 * Only current living NamedCharacters whose original identity AND saved
 * creation event match that exact source can appear in this report.
 */
export function getCityWorkshopContacts(city, roster) {
  const cityId = city?.id == null ? null : String(city.id);
  const empty = { cityId, sourceCount: 0, contactCount: 0, sources: [] };
  if (!cityId || !Array.isArray(city?.cityState?.parcels)) return empty;
  const sources = discoverCharacterProductionSources([city])
    .filter(source => source.type === 'production' && String(source.settlementId) === cityId);
  if (!sources.length) return empty;

  const residentActors = getSettlementCharacters(roster, cityId)
    .filter(actor => actor?.kind === 'named' && actor.status === 'alive');
  const rows = [];
  for (const parcel of city.cityState.parcels) {
    if (parcel?.id == null || parcel.state === 'locked' || !Array.isArray(parcel.buildingIds)) continue;
    for (const buildingId of new Set(parcel.buildingIds)) {
      if (typeof buildingId !== 'string') continue;
      const sourceId = 'built-' + encode(cityId) + '~' + encode(parcel.id)
        + '~' + encode(buildingId);
      const source = sources.find(x => x.id === sourceId);
      if (!source) continue;
      const identityPrefix = 'npc:source-production~' + encode(cityId)
        + '~' + encode(source.id) + ':';
      const contacts = residentActors.filter(person => {
        if (!person.id.startsWith(identityPrefix)
          || !/^[1-9]\d{0,6}$/.test(person.id.slice(identityPrefix.length))) return false;
        return person.history?.some(event => event?.type === 'created'
          && event.sourceType === 'production' && event.sourceId === source.id);
      }).map(person => ({
        characterId: person.id, name: person.name, role: person.role,
        importance: person.importance,
      })).sort((a, b) => sortText(a.characterId, b.characterId));
      rows.push({
        sourceId: source.id, parcelId: String(parcel.id),
        buildingId, contacts,
      });
    }
  }
  rows.sort((a, b) => sortText(a.parcelId, b.parcelId)
    || sortText(a.buildingId, b.buildingId));
  return {
    cityId, sourceCount: rows.length,
    contactCount: rows.reduce((sum, row) => sum + row.contacts.length, 0),
    sources: rows,
  };
}
