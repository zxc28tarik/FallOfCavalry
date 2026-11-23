/**
 * WEB V1.74 — player-explicit workshop steward appointment.
 *
 * Uses the existing NamedCharacter roster + CharacterOrganization assignment
 * save record. A steward is an administrative assignment only, NOT an owner,
 * salaried worker, shop inventory holder or production multiplier.
 */
import * as CONST from '../constants.js';
import { canPlayerManageSettlement } from './city-state.js';
import { discoverCharacterProductionSources } from './character-production-sources.js';
import {
  WORKSHOP_STEWARD_ROLE, startCharacterAssignment, completeCharacterAssignment,
} from './character-organization.js';

const currentCityId = city => city?.id == null ? null : String(city.id);
const sourceList = city => city && Array.isArray(city.cityState?.parcels)
  ? discoverCharacterProductionSources([city])
    .filter(source => source.type === 'production'
      && String(source.settlementId) === currentCityId(city)) : [];
const activeDuties = organization => Array.isArray(organization?.assignments)
  ? organization.assignments.filter(row => row?.assignmentStatus === 'active') : [];
const localNamed = (roster, cityId) => Array.isArray(roster?.characters)
  ? roster.characters.filter(person => person?.kind === 'named'
    && person.status === 'alive' && String(person.location?.settlementId) === cityId) : [];

/** The displayed roster is read-only and scoped to one real city. */
export function listCityWorkshopStewards({
  city, party, roster, organization,
} = {}) {
  const cityId = currentCityId(city);
  const sources = sourceList(city);
  const duties = activeDuties(organization);
  const residents = localNamed(roster, cityId);
  const byId = new Map(residents.map(person => [person.id, person]));
  const assigned = new Set(duties.map(duty => duty.characterId));
  return {
    cityId,
    canManage: !!cityId && canPlayerManageSettlement(
      city, party?.factionId || CONST.FACTION.ID.PLAYER),
    eligible: residents.filter(person => !assigned.has(person.id))
      .map(person => ({ characterId: person.id, name: person.name, role: person.role }))
      .sort((a, b) => a.characterId.localeCompare(b.characterId, 'en')),
    sources: sources.map(source => {
      const matches = duties.filter(duty => duty.assignmentRole === WORKSHOP_STEWARD_ROLE
        && duty.branch === 'trade_network'
        && String(duty.assignmentLocation?.settlementId) === cityId
        && duty.assignmentSource?.type === 'production'
        && duty.assignmentSource?.id === source.id);
      const valid = matches.length === 1 ? byId.get(matches[0].characterId) : null;
      return {
        sourceId: source.id,
        steward: valid ? {
          characterId: valid.id, name: valid.name,
          role: valid.role, startDay: matches[0].assignmentStartDay,
        } : null,
        occupied: matches.length > 0,
      };
    }),
  };
}

function gate({ city, party, roster, organization, sourceId, day }) {
  if (!Number.isSafeInteger(day) || day < 1 || day > 10000000) {
    return { ok: false, message: 'Geçersiz gün.' };
  }
  if (!currentCityId(city) || !canPlayerManageSettlement(
    city, party?.factionId || CONST.FACTION.ID.PLAYER)) {
    return { ok: false, message: 'Bu şehirde görevlendirme yetkin yok.' };
  }
  if (!Array.isArray(roster?.characters)
    || !Array.isArray(organization?.assignments)) {
    return { ok: false, message: 'Karakter görevlendirme kaydı bulunmuyor.' };
  }
  if (typeof sourceId !== 'string' || !sourceList(city).some(source => source.id === sourceId)) {
    return { ok: false, message: 'İlgili gerçek atölye artık mevcut değil.' };
  }
  return { ok: true };
}

/** Appoints precisely one living local NamedCharacter to ONE built workshop. */
export function appointCityWorkshopSteward({
  city, party, roster, organization, sourceId, characterId, day,
} = {}) {
  const pre = gate({ city, party, roster, organization, sourceId, day });
  if (!pre.ok) return pre;
  const view = listCityWorkshopStewards({ city, party, roster, organization });
  const source = view.sources.find(row => row.sourceId === sourceId);
  if (!source || source.occupied) {
    return { ok: false, message: 'Atölyenin kayıtlı nezaretçisi var.' };
  }
  const person = view.eligible.find(row => row.characterId === characterId);
  if (!person) return { ok: false, message: 'Bu kişi uygun ve boşta olan bir önemli karakter değil.' };
  const cityId = currentCityId(city);
  const ok = startCharacterAssignment(organization, characterId, {
    roster, settlements: [city], day,
    branch: 'trade_network',
    assignmentRole: WORKSHOP_STEWARD_ROLE,
    assignmentLocation: { kind: 'settlement', settlementId: cityId },
    assignmentSource: { type: 'production', id: sourceId, settlementId: cityId },
    reason: 'Oyuncu tarafindan atanmis atölye nezaretçisi.',
  });
  return ok
    ? { ok: true, characterId, sourceId, message: 'Atölye nezaretçisi atandı. Ücret veya mülkiyet aktarılmadı.' }
    : { ok: false, message: 'Görevlendirme mevcut karakter görev kuralları nedeniyle reddedildi.' };
}

/** Ends only the exact source-bound workshop duty, keeping its history. */
export function releaseCityWorkshopSteward({
  city, party, roster, organization, sourceId, characterId, day,
} = {}) {
  const pre = gate({ city, party, roster, organization, sourceId, day });
  if (!pre.ok) return pre;
  const view = listCityWorkshopStewards({ city, party, roster, organization });
  const source = view.sources.find(row => row.sourceId === sourceId);
  if (!source?.steward || source.steward.characterId !== characterId) {
    return { ok: false, message: 'Bu atölye için doğrulanmış aktif atama bulunamadı.' };
  }
  const ok = completeCharacterAssignment(organization, characterId, {
    roster, day, reason: 'Oyuncu tarafindan atölye nezaretçiligi sonlandirildi.',
  });
  return ok
    ? { ok: true, characterId, sourceId, message: 'Atölye nezaretçisi görevden alındı. Görev geçmişi korundu.' }
    : { ok: false, message: 'Görev kapatılamadı; tarih ve karakter durumunu kontrol et.' };
}
