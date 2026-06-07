import * as CONST from '../constants.js';

const COMMON_AREA_LAYOUT = Object.freeze([
  {
    id: 'inner_citadel_core',
    label: 'Ic Kale ve Yonetim Cekirdegi',
    areaKind: 'inner_core',
    x: 50,
    y: 6,
    w: 40,
    h: 24,
    stateKind: 'landmark',
    areaTags: ['inner_core'],
    fixedBuildingIds: [
      'inner_citadel',
      'palace',
      'court_house',
      'imperial_mosque',
      'medrese',
      'defterhane_amire',
      'reisulkuttab_office',
      'bostanci_hq',
    ],
    starterBuildingIds: [],
    buildingPoolIds: [],
    buildDisabled: true,
    maxBuildingsByFill: { empty: 8, low: 8, half: 8, full: 8 },
    notes: ['Sehirdeki tek sabit tam dolu alandir.'],
  },
  {
    id: 'trade_area',
    label: 'Ticaret Alani',
    areaKind: 'trade',
    x: 48,
    y: 34,
    w: 19,
    h: 14,
    areaTags: ['trade'],
    fixedBuildingIds: [],
    starterBuildingIds: ['bazaar_market'],
    buildingPoolIds: ['bazaar_market', 'bedesten', 'guild_hall', 'customs_office'],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 2, full: 4 },
    notes: ['Baslangicta yalniz Pazar ile baslar.'],
  },
  {
    id: 'caravan_area',
    label: 'Hanlar ve Kervan Alani',
    areaKind: 'caravan',
    x: 69,
    y: 34,
    w: 23,
    h: 15,
    areaTags: ['caravan'],
    fixedBuildingIds: [],
    starterBuildingIds: ['han'],
    buildingPoolIds: ['han', 'merchant_han', 'caravanserai'],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 2, full: 3 },
    notes: ['Baslangicta yalniz Han ile baslar.'],
  },
  {
    id: 'housing_area',
    label: 'Konut Alani',
    areaKind: 'housing',
    x: 52,
    y: 50,
    w: 42,
    h: 18,
    areaTags: ['housing'],
    fixedBuildingIds: [],
    starterBuildingIds: ['poor_quarter'],
    buildingPoolIds: ['poor_quarter', 'modest_houses', 'affluent_houses', 'elite_mansions'],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 2, full: 4 },
    notes: ['Sosyal sinifa gore katmanlanir.'],
  },
  {
    id: 'military_area',
    label: 'Askeri Alan',
    areaKind: 'military',
    x: 12,
    y: 20,
    w: 19,
    h: 15,
    stateKind: 'special',
    areaTags: ['military'],
    fixedBuildingIds: [],
    starterBuildingIds: [],
    buildingPoolIds: ['barracks'],
    buildDisabled: true,
    maxBuildingsByFill: { empty: 0, low: 1, half: 1, full: 1 },
    notes: ['Bu alan su an beklemede. Recruit servisi aktif degil.'],
  },
  {
    id: 'health_area',
    label: 'Saglik Alani',
    areaKind: 'health',
    x: 27,
    y: 35,
    w: 19,
    h: 18,
    areaTags: ['health'],
    fixedBuildingIds: [],
    starterBuildingIds: [],
    buildingPoolIds: ['darussifa', 'great_hammam', 'pharmacy'],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 2, full: 3 },
    notes: ['Darussifa, Buyuk Hamam ve Eczane havuzu.'],
  },
  {
    id: 'production_area',
    label: 'Uretim ve Zanaat Alani',
    areaKind: 'production',
    x: 4,
    y: 34,
    w: 28,
    h: 24,
    areaTags: ['production'],
    fixedBuildingIds: [],
    starterBuildingIds: [],
    buildingPoolIds: [
      'tannery',
      'blacksmith',
      'carpenter',
      'weaving_house',
      'dyeworks',
      'soapworks',
      'paper_mill',
      'chandlery',
      'stoneworks',
      'farrier',
    ],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 2, full: 5 },
    notes: ['Doluluk arttikca 1-5 uretim yapisi gosterilebilir.'],
  },
  {
    id: 'food_area',
    label: 'Gida ve Ikmal Alani',
    areaKind: 'food',
    x: 19,
    y: 62,
    w: 37,
    h: 14,
    areaTags: ['food'],
    fixedBuildingIds: [],
    starterBuildingIds: [],
    buildingPoolIds: ['bakery', 'mill', 'granary_store', 'butcher_shop', 'fish_market'],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 3, full: 5 },
    notes: ['Kasaphane ve Balikhane bu havuzdadir.'],
  },
  {
    id: 'port_area',
    label: 'Deniz ve Liman Alani',
    areaKind: 'port',
    x: 82,
    y: 64,
    w: 14,
    h: 12,
    stateKind: 'special',
    areaTags: ['port'],
    fixedBuildingIds: [],
    starterBuildingIds: [],
    buildingPoolIds: [],
    buildDisabled: true,
    maxBuildingsByFill: { empty: 0, low: 0, half: 0, full: 0 },
    notes: ['Oyunda deniz olmadigi icin su an pasif durumdadir.'],
  },
  {
    id: 'culture_area',
    label: 'Meydan ve Kultur Alani',
    areaKind: 'culture',
    x: 40,
    y: 54,
    w: 18,
    h: 15,
    areaTags: ['culture'],
    fixedBuildingIds: [],
    starterBuildingIds: [],
    buildingPoolIds: ['at_meydani', 'fairground', 'monumental_public_building'],
    buildDisabled: false,
    maxBuildingsByFill: { empty: 0, low: 1, half: 2, full: 3 },
    notes: ['At Meydani, Panayir ve anitsal yapi havuzu.'],
  },
]);

function cloneArea(area) {
  return {
    ...area,
    areaTags: [...(area.areaTags || [])],
    fixedBuildingIds: [...(area.fixedBuildingIds || [])],
    starterBuildingIds: [...(area.starterBuildingIds || [])],
    buildingPoolIds: [...(area.buildingPoolIds || [])],
    maxBuildingsByFill: { ...(area.maxBuildingsByFill || {}) },
    notes: [...(area.notes || [])],
  };
}

function makeSceneDef({ id, name, factionId, theme }) {
  const factionKey = String(theme || 'ottoman');
  return Object.freeze({
    id,
    name,
    factionId,
    theme: factionKey,
    assetRoot: `assets/city-scenes/${factionKey}`,
    manifestPath: `assets/city-scenes/${factionKey}/manifests/cityscene_${factionKey}_full_manifest.template.json`,
    baseImage: null,
    areas: COMMON_AREA_LAYOUT,
    slots: COMMON_AREA_LAYOUT,
  });
}

const SCENE_DEFS = Object.freeze({
  ottoman_city_full: makeSceneDef({
    id: 'ottoman_city_full',
    name: 'Osmanli Alan Tabanli Sehir Sahnesi',
    factionId: CONST.FACTION.ID.OTTOMAN,
    theme: 'ottoman',
  }),
  hre_city_full: makeSceneDef({
    id: 'hre_city_full',
    name: 'HRE Alan Tabanli Sehir Sahnesi',
    factionId: CONST.FACTION.ID.HRE,
    theme: 'hre',
  }),
  venice_city_full: makeSceneDef({
    id: 'venice_city_full',
    name: 'Venedik Alan Tabanli Sehir Sahnesi',
    factionId: CONST.FACTION.ID.VENICE,
    theme: 'venice',
  }),
  polish_city_full: makeSceneDef({
    id: 'polish_city_full',
    name: 'Polonya Alan Tabanli Sehir Sahnesi',
    factionId: CONST.FACTION.ID.POLISH,
    theme: 'polish',
  }),
  spanish_city_full: makeSceneDef({
    id: 'spanish_city_full',
    name: 'Ispanya Alan Tabanli Sehir Sahnesi',
    factionId: CONST.FACTION.ID.SPANISH,
    theme: 'spanish',
  }),
});

export function getCitySceneDef(sceneId) {
  const scene = SCENE_DEFS[String(sceneId || '').trim()];
  if (!scene) return null;
  return {
    ...scene,
    areas: (scene.areas || []).map(cloneArea),
    slots: (scene.slots || []).map(cloneArea),
  };
}

export function listCitySceneDefs() {
  return Object.keys(SCENE_DEFS).map((sceneId) => getCitySceneDef(sceneId));
}

export function getDefaultCitySceneIdForFaction(factionId) {
  const normalized = String(factionId || CONST.FACTION.ID.OTTOMAN);
  if (normalized === CONST.FACTION.ID.HRE) return 'hre_city_full';
  if (normalized === CONST.FACTION.ID.VENICE) return 'venice_city_full';
  if (normalized === CONST.FACTION.ID.POLISH) return 'polish_city_full';
  if (normalized === CONST.FACTION.ID.SPANISH) return 'spanish_city_full';
  return 'ottoman_city_full';
}
