/**
 * WEB V1.75 — source-authenticated, read-only workshop steward audits.
 *
 * An actual assigned living NamedCharacter may report existing market stock
 * bottlenecks. Stewardship is NOT workshop ownership, employee payroll, a
 * production modifier, procurement authority or a financial transaction.
 * Production rows belong to an entire city/building CLASS, not one parcel.
 */
import { listCityWorkshopStewards } from './city-workshop-assignments.js';
import { getCityWorkshopContacts } from './city-workshop-contacts.js';
import { getCityWorkshopOperatingReport } from './city-workshop-accounts.js';

const validDay = day => Number.isSafeInteger(day) && day >= 1 && day <= 10000000;
const stockCount = (market, itemId) => {
  const n = market?.stocks?.[itemId];
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};
const plain = text => String(text ?? '').slice(0, 120);

/**
 * Returns only verified, locally present active stewards' inspection reports.
 * This method neither writes to any state nor issues orders on their behalf.
 * The normal daily production planner is the sole source of batch truth.
 */
export function getCityWorkshopStewardAudits({
  city, party, roster, organization, market, day,
} = {}) {
  const registry = listCityWorkshopStewards({ city, party, roster, organization });
  const empty = { cityId: registry.cityId, canInspect: registry.canManage, audits: [] };
  if (!registry.canManage || !validDay(day)) return empty;
  const contacts = getCityWorkshopContacts(city, roster);
  const workshopsBySource = new Map(contacts.sources.map(source => [source.sourceId, source]));
  const accounts = getCityWorkshopOperatingReport(city, market, { day });
  const byBuilding = new Map(accounts.rows.map(row => [row.buildingId, row]));

  const audits = [];
  for (const source of registry.sources) {
    // An occupied but absent, dead or moved steward has no reporting ability.
    if (!source.steward || day < source.steward.startDay) continue;
    const workshop = workshopsBySource.get(source.sourceId);
    if (!workshop) continue; // No trusted real building associated with source.
    const recipe = byBuilding.get(workshop.buildingId);
    let status = 'unmodelled';
    let summary = 'Bu bina türünün mevcut ekonomide üretim reçetesi yok.';
    if (!accounts.ok) {
      status = 'market_unavailable';
      summary = 'Pazar stokları henüz hazır değil; denetim tamamlanamadı.';
    } else if (recipe) {
      if (recipe.plannedBatches > 0) {
        status = recipe.plannedBatches < recipe.maxBatches ? 'partial' : 'ready';
        summary = status === 'ready'
          ? 'Mevcut şehir stokuyla planlanan üretim karşılanabiliyor.'
          : 'Şehirde bu üretim türü kısmen çalışabilir; darboğaz var.';
      } else if (recipe.blockedReason === 'missing_input') {
        status = 'missing_input';
        summary = recipe.missingInputId
          ? plain(recipe.missingInputId) + ' girdisi şehir genelinde yetersiz.'
          : 'Şehir genelinde hammadde yetersiz.';
      } else if (recipe.blockedReason === 'storage_full') {
        status = 'storage_full';
        summary = 'Ürün için şehir pazarındaki stok kapasitesi dolu.';
      } else {
        status = 'unavailable';
        summary = 'Mevcut stokla üretim planlanamıyor.';
      }
    }
    const inputs = recipe
      ? Object.entries(recipe.inputs).map(([itemId, perBatch]) => ({
        itemId, perBatch, available: stockCount(market, itemId),
      }))
      : [];
    audits.push({
      sourceId: source.sourceId,
      parcelId: workshop.parcelId,
      buildingId: workshop.buildingId,
      stewardCharacterId: source.steward.characterId,
      stewardName: source.steward.name,
      daysInDuty: day - source.steward.startDay,
      status, summary,
      // These are building-TYPE totals throughout this city, not output or
      // wages attributable to the individual steward or to this one parcel.
      scope: 'city_building_type',
      buildingCount: recipe?.buildingCount ?? null,
      plannedBatches: recipe?.plannedBatches ?? null,
      maxBatches: recipe?.maxBatches ?? null,
      blockedReason: recipe?.blockedReason ?? null,
      missingInputId: recipe?.missingInputId ?? null,
      outputId: recipe?.outputId ?? null,
      inputs,
      projectedNextCycle: !!accounts.ok,
      processedToday: accounts.processedToday,
    });
  }
  audits.sort((a, b) => a.sourceId.localeCompare(b.sourceId, 'en'));
  return { ...empty, audits };
}
