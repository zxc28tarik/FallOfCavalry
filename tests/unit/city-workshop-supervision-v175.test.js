import { describe, expect, it } from 'vitest';
import * as CONST from '../../js/constants.js';
import { createWorldCharacterRoster, promoteWorldCharacter } from '../../js/systems/world-characters.js';
import { emptyCharacterOrganizationState } from '../../js/systems/character-organization.js';
import { discoverCharacterProductionSources } from '../../js/systems/character-production-sources.js';
import {
  appointCityWorkshopSteward, releaseCityWorkshopSteward,
} from '../../js/systems/city-workshop-assignments.js';
import { getCityWorkshopStewardAudits } from '../../js/systems/city-workshop-supervision.js';
import { planCityMarketProduction } from '../../js/systems/city-market-cycle.js';

function setup({ building = 'blacksmith', owner = 'player', stock = {} } = {}) {
  const city = {
    id: 'edirne-v175', name: 'Edirne', type: 'city', tier: 3,
    ownerFactionId: owner, population: 0,
    cityState: {
      parcels: [{ id: 'industrial-lot', state: 'occupied', buildingIds: [building] }],
      infrastructure: { installedBuildingIds: [], improvementLevels: {} },
    },
  };
  const market = {
    stocks: Object.fromEntries(CONST.TRADE_ITEMS.map(item => [item.id, stock[item.id] ?? 0])),
    demand: Object.fromEntries(CONST.TRADE_ITEMS.map(item => [item.id, 0])),
    momentum: {},
  };
  const roster = createWorldCharacterRoster({ seed: 175, settlements: [city], perSettlement: 2 });
  expect(promoteWorldCharacter(roster, roster.characters[0].id, { day: 2 })).toBe(true);
  const organization = emptyCharacterOrganizationState();
  const sourceId = discoverCharacterProductionSources([city])
    .find(source => source.type === 'production')?.id;
  expect(sourceId).toBeTruthy();
  const characterId = roster.characters[0].id;
  const party = { factionId: 'player', gold: 400 };
  const values = { city, market, roster, organization, party, sourceId, characterId, day: 5 };
  return values;
}
const inspect = x => getCityWorkshopStewardAudits(x).audits;

describe('WEB V1.75 — source-bound, read-only workshop steward inspection', () => {
  it('does not fabricate an inspection for an unstaffed real shop', () => {
    const x = setup({ stock: { iron: 2, wood: 2 } });
    expect(inspect(x)).toEqual([]);
  });

  it('reports only actual production forecasts for a living appointed steward without mutation', () => {
    const x = setup({ stock: { iron: 2, wood: 2 } });
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    const before = JSON.stringify(x);
    const plan = planCityMarketProduction(x.city, x.market);
    const report = inspect(x);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({
      sourceId: x.sourceId, stewardCharacterId: x.characterId,
      status: 'ready', buildingId: 'blacksmith',
      plannedBatches: plan.rows.find(row => row.buildingId === 'blacksmith').plannedBatches,
      scope: 'city_building_type', buildingCount: 1,
      inputs: [
        { itemId: 'iron', perBatch: 1, available: 2 },
        { itemId: 'wood', perBatch: 1, available: 2 },
      ],
    });
    expect(JSON.stringify(x)).toBe(before);
    expect(x.party.gold).toBe(400);
  });

  it('identifies the same exact missing input as the authoritative market planner', () => {
    const x = setup({ stock: { iron: 3, wood: 0 } });
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    const real = planCityMarketProduction(x.city, x.market)
      .rows.find(row => row.buildingId === 'blacksmith');
    expect(real.blockedReason).toBe('missing_input');
    const report = inspect(x)[0];
    expect(report.status).toBe('missing_input');
    expect(report.missingInputId).toBe(real.missingInputId);
    expect(report.plannedBatches).toBe(0);
  });

  it('distinguishes full storage from raw-material shortage', () => {
    const x = setup({
      building: 'paper_mill',
      stock: { cloth: 3, paper: CONST.MARKET.STOCK_CEIL_CITY },
    });
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    expect(inspect(x)[0]).toMatchObject({
      buildingId: 'paper_mill', status: 'storage_full',
      blockedReason: 'storage_full', plannedBatches: 0,
    });
  });

  it('never invents a recipe or goods for catalogued but unmodelled workshops', () => {
    const x = setup({ building: 'soapworks' });
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    expect(inspect(x)[0]).toMatchObject({
      buildingId: 'soapworks', status: 'unmodelled',
      plannedBatches: null, inputs: [],
    });
  });

  it('reports market unavailable instead of guessing stock or money', () => {
    const x = setup();
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    x.market = null;
    expect(inspect(x)[0]).toMatchObject({
      status: 'market_unavailable', plannedBatches: null,
    });
  });

  it('denies inspection of foreign city even if the roster has a prior appointment', () => {
    const x = setup();
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    x.city.ownerFactionId = 'ottoman';
    expect(getCityWorkshopStewardAudits(x)).toMatchObject({
      canInspect: false, audits: [],
    });
  });

  it('a dead, moved or deleted character cannot report from an old assignment', () => {
    const x = setup();
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    x.roster.characters[0].status = 'dead';
    expect(inspect(x)).toEqual([]);
    x.roster.characters[0].status = 'alive';
    x.roster.characters[0].location.settlementId = 'elsewhere';
    expect(inspect(x)).toEqual([]);
    x.roster.characters[0].location.settlementId = x.city.id;
    x.city.cityState.parcels[0].buildingIds = [];
    expect(inspect(x)).toEqual([]);
  });

  it('completed duty is history, never current reporting authority', () => {
    const x = setup();
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    expect(releaseCityWorkshopSteward({ ...x, day: 7 }).ok).toBe(true);
    expect(inspect({ ...x, day: 8 })).toEqual([]);
    expect(x.organization.assignments[0].assignmentStatus).toBe('completed');
  });

  it('does not show future-day or unauthenticated audit authority', () => {
    const x = setup();
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    expect(inspect({ ...x, day: 4 })).toEqual([]);
    expect(inspect({ ...x, day: -1 })).toEqual([]);
    x.organization.assignments[0].assignmentSource.id = 'built-fake';
    expect(inspect(x)).toEqual([]);
  });

  it('marks completed daily tick clearly and preserves existing market ledger', () => {
    const x = setup({ stock: { iron: 1, wood: 1 } });
    expect(appointCityWorkshopSteward(x).ok).toBe(true);
    x.market.mcDay = 5;
    const before = JSON.stringify(x.market);
    expect(inspect(x)[0].processedToday).toBe(true);
    expect(JSON.stringify(x.market)).toBe(before);
  });
});
