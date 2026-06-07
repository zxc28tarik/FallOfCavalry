#!/usr/bin/env node
/* global process, URLSearchParams */

import fs from 'node:fs';
import path from 'node:path';
import osmtogeojson from 'osmtogeojson';
import { PNG } from 'pngjs';

const OVERPASS_URL = 'https://overpass-api.openhistoricalmap.org/api/interpreter';
const OUT_DIR = 'assets/world-map';
const RAW_POLITICS_PATH = path.join(OUT_DIR, 'raw-ohm-1648-politics.json');
const RAW_EXTRA_POLITICS_PATH = path.join(OUT_DIR, 'raw-ohm-1648-extra-politics.json');
const RAW_COASTLINE_PATH = path.join(OUT_DIR, 'raw-ohm-1648-coastline.json');
const RAW_WATER_PATH = path.join(OUT_DIR, 'raw-ohm-1648-large-water.json');
const RAW_ISLANDS_PATH = path.join(OUT_DIR, 'raw-ohm-1648-islands.json');
const OWNER_PATH = path.join(OUT_DIR, 'owner.bin');
const TERRAIN_PATH = path.join(OUT_DIR, 'terrain.bin');
const COLORS_PATH = path.join(OUT_DIR, 'faction-colors.json');
const PREVIEW_PATH = path.join(OUT_DIR, 'owner-preview.png');
const REPORT_PATH = path.join(OUT_DIR, 'ohm-extraction-report.json');
const FORCE_WRITE = process.argv.includes('--force');

const TARGET_WIDTH = 1995;
const TARGET_HEIGHT = 1504;
const TERRAIN_WATER = 0;
const TERRAIN_LAND = 1;
const OWNER_UNASSIGNED = 0;
const DATE = '1648-12-31';

const BBOX = Object.freeze({
  south: 25,
  west: -15,
  north: 71,
  east: 55,
});

const FACTIONS = Object.freeze([
  { ownerId: 4, slug: 'hre', name: 'Heiliges Romisches Reich', relationId: 2831515, priority: 10, color: [144, 135, 116] },
  { ownerId: 1, slug: 'ottoman', name: 'Devlet-i Aliyye-i Osmaniyye', relationId: 2860343, priority: 20, color: [177, 65, 48] },
  {
    ownerId: 12,
    slug: 'safevid',
    name: 'Devlet-i Safeviyye',
    priority: 25,
    color: [53, 142, 93],
    writePolicy: 'only-unassigned-land',
    manualPolygons: [
      [
        [43.8, 38.8],
        [46.2, 40.5],
        [50.8, 40.8],
        [55.0, 37.6],
        [55.0, 29.4],
        [53.1, 26.3],
        [49.0, 27.4],
        [46.8, 29.3],
        [44.8, 32.7],
        [43.1, 36.0],
        [43.8, 38.8],
      ],
    ],
    source: 'manual-coarse-1648-safavid',
  },
  { ownerId: 11, slug: 'russia', name: 'Russkoye Tsarstvo', relationId: 2851884, priority: 30, color: [143, 164, 96] },
  { ownerId: 10, slug: 'poland_lithuania', name: 'Rzeczpospolita Obojga Narodow', relationId: 2693974, priority: 40, color: [203, 126, 142] },
  { ownerId: 2, slug: 'spain', name: 'Monarquia Hispanica', relationId: 2860342, priority: 50, color: [219, 173, 58] },
  {
    ownerId: 5,
    slug: 'france',
    name: 'Royaume de France',
    priority: 55,
    color: [49, 86, 166],
    writePolicy: 'only-unassigned-land',
    manualPolygons: [
      [
        [-4.85, 48.55],
        [-1.65, 50.85],
        [2.25, 50.85],
        [4.55, 49.65],
        [4.95, 47.15],
        [5.45, 45.55],
        [4.25, 43.45],
        [1.55, 42.82],
        [-1.78, 43.28],
        [-4.35, 46.35],
        [-4.85, 48.55],
      ],
    ],
    source: 'manual-coarse-1648-france',
  },
  { ownerId: 8, slug: 'sweden', name: 'Konungariket Sverige', relationId: 2851938, priority: 60, color: [64, 132, 181] },
  { ownerId: 9, slug: 'denmark_norway', name: 'Kongerigerne Danmark og Norge', relationId: 2851862, priority: 70, color: [199, 112, 72] },
  { ownerId: 7, slug: 'portugal', name: 'Reino de Portugal', relationId: 2878364, priority: 80, color: [104, 136, 74] },
  {
    ownerId: 17,
    slug: 'morocco',
    name: "Saltanatu's-Serife",
    priority: 90,
    color: [143, 58, 73],
    extraRelationIds: [2861416],
    writePolicy: 'only-unassigned-land',
    source: 'ohm-1666-alawi-fallback-for-1648-morocco',
  },
  {
    ownerId: 3,
    slug: 'austria',
    name: 'Haus Osterreich',
    priority: 195,
    color: [236, 197, 69],
    extraRelationIds: [2809508],
    writePolicy: 'unassigned-or-hre',
    manualPolygons: [
      [
        [12.0, 50.35],
        [14.7, 51.05],
        [17.35, 50.25],
        [18.65, 49.2],
        [17.3, 48.45],
        [14.2, 48.55],
        [12.05, 49.15],
        [12.0, 50.35],
      ],
      [
        [16.0, 48.7],
        [18.2, 49.45],
        [21.7, 49.2],
        [22.45, 48.0],
        [20.8, 47.25],
        [18.15, 47.05],
        [16.15, 47.55],
        [16.0, 48.7],
      ],
      [
        [14.1, 46.6],
        [16.7, 46.65],
        [17.55, 45.85],
        [16.45, 45.25],
        [14.65, 45.45],
        [14.1, 46.6],
      ],
    ],
    source: 'ohm-austrian-circle-plus-manual-bohemia-royal-hungary-croatia',
  },
  { ownerId: 15, slug: 'papal_states', name: 'Stato della Chiesa', relationId: 2809353, priority: 200, color: [186, 151, 191] },
  { ownerId: 6, slug: 'netherlands', name: 'Republiek der Zeven Verenigde Nederlanden', relationId: 2848631, priority: 210, color: [222, 168, 45] },
  { ownerId: 16, slug: 'swiss', name: 'Eidgenossenschaft', relationId: 2831181, priority: 220, color: [214, 205, 181] },
  { ownerId: 19, slug: 'savoy', name: 'Ducato di Savoia', relationId: 2893900, priority: 230, color: [191, 128, 95] },
  { ownerId: 14, slug: 'genoa', name: 'Repubblica di Genova', relationId: 2852275, priority: 240, color: [184, 109, 112] },
  { ownerId: 18, slug: 'tuscany', name: 'Granducato di Toscana', relationId: 2832268, priority: 250, color: [198, 174, 87] },
  { ownerId: 13, slug: 'venice', name: 'Serenissima Repubblica di Venezia', relationId: 2835825, priority: 260, color: [78, 152, 137] },
]);

const PROBLEMATIC = Object.freeze([
  {
    name: 'Royaume de France',
    patterns: ['France|Royaume de France|Kingdom of France'],
    dates: ['1620-12-31', '1635-12-31', '1647-12-31', '1648-06-30', '1649-12-31', '1650-12-31', '1655-12-31', '1670-12-31', '1680-12-31'],
  },
  {
    name: 'Devlet-i Safeviyye',
    patterns: ['Safevi|Safavid|Safavi|Persia|Iran'],
    dates: ['1600-12-31', '1620-12-31', '1645-12-31', '1648-12-31', '1650-12-31', '1660-12-31', '1680-12-31'],
  },
  {
    name: "Saltanatu's-Serife",
    patterns: ['Morocco|Maroc|Sherife|Sharif|Saadi|Alawi|Moroccan'],
    dates: ['1645-12-31', '1648-12-31', '1650-12-31', '1666-12-31'],
  },
  {
    name: 'Haus Osterreich',
    patterns: ['Austria|Osterreich|Österreich|Habsburg|Austrian Circle|Hungary'],
    dates: ['1648-12-31'],
  },
]);

const WATER_SEEDS = Object.freeze([
  [-12, 45],
  [2, 56],
  [18, 58],
  [15, 37],
  [28, 43],
  [36, 45.5],
  [51, 42],
]);

const MAIN_LAND_SEEDS = Object.freeze([
  { name: 'Western Europe mainland', lon: 2.0, lat: 47.0 },
  { name: 'Central Europe mainland', lon: 15.0, lat: 50.0 },
  { name: 'Eastern Europe mainland', lon: 30.0, lat: 52.0 },
  { name: 'Scandinavia mainland', lon: 16.0, lat: 63.0 },
  { name: 'Anatolia mainland', lon: 34.0, lat: 39.0 },
  { name: 'Caucasus / Safavid mainland', lon: 47.0, lat: 35.0 },
  { name: 'North Africa mainland', lon: 9.0, lat: 32.0 },
  { name: 'Morocco mainland', lon: -6.0, lat: 32.0 },
]);

const STRAIT_WATER_CORRIDORS = Object.freeze([
  { name: 'Strait of Gibraltar', from: [-5.85, 36.2], to: [-5.2, 35.9], thickness: 2 },
  { name: 'Dardanelles', from: [26.05, 40.45], to: [26.85, 40.18], thickness: 1 },
  { name: 'Bosphorus', from: [28.98, 41.25], to: [29.1, 40.92], thickness: 1 },
  { name: 'Kerch Strait', from: [36.45, 45.42], to: [36.7, 45.12], thickness: 1 },
  { name: 'Oresund', from: [12.55, 56.1], to: [12.75, 55.55], thickness: 1 },
  { name: 'Great Belt', from: [10.8, 55.75], to: [11.25, 55.0], thickness: 1 },
  { name: 'Gulf of Suez / northern Red Sea', from: [32.7, 29.8], to: [34.1, 27.8], thickness: 7 },
  { name: 'Gulf of Aqaba', from: [34.8, 29.6], to: [35.0, 28.0], thickness: 5 },
  { name: 'Red Sea within bbox', from: [34.5, 27.8], to: [37.1, 25.0], thickness: 11 },
  { name: 'Persian Gulf within bbox', from: [48.4, 30.1], to: [52.7, 26.0], thickness: 12 },
]);

const LARGE_WATER_NAMES = Object.freeze([
  'Caspian Sea',
  'Hazar Denizi',
  'Kaspische See',
  'Касп',
  'Aral Sea',
  'Арал',
  'Ladoga',
  'Ладож',
  'Onega',
  'Онеж',
]);

const GEOGRAPHIC_CHECKS = Object.freeze([
  { name: 'Mediterranean Sea', lon: 15.0, lat: 37.0, expected: TERRAIN_WATER },
  { name: 'Adriatic Sea', lon: 15.0, lat: 43.5, expected: TERRAIN_WATER },
  { name: 'Aegean Sea', lon: 25.0, lat: 38.0, expected: TERRAIN_WATER },
  { name: 'English Channel', lon: -1.0, lat: 50.2, expected: TERRAIN_WATER },
  { name: 'North Sea', lon: 3.0, lat: 55.0, expected: TERRAIN_WATER },
  { name: 'Black Sea', lon: 34.0, lat: 43.0, expected: TERRAIN_WATER },
  { name: 'Atlantic Ocean', lon: -10.0, lat: 45.0, expected: TERRAIN_WATER },
  { name: 'Red Sea north', lon: 35.0, lat: 27.0, expected: TERRAIN_WATER },
  { name: 'Caspian Sea', lon: 50.0, lat: 42.0, expected: TERRAIN_WATER },
  { name: 'Aral Sea', lon: 59.0, lat: 45.0, expected: TERRAIN_WATER },
  { name: 'Lake Ladoga', lon: 31.3, lat: 60.8, expected: TERRAIN_WATER },
  { name: 'Lake Onega', lon: 35.6, lat: 61.9, expected: TERRAIN_WATER },
  { name: 'Britain', lon: -2.5, lat: 53.0, expected: TERRAIN_WATER },
  { name: 'Ireland', lon: -8.0, lat: 53.0, expected: TERRAIN_WATER },
  { name: 'Iceland', lon: -19.0, lat: 65.0, expected: TERRAIN_WATER },
  { name: 'Sicily', lon: 14.0, lat: 37.5, expected: TERRAIN_WATER },
  { name: 'Sardinia', lon: 9.0, lat: 40.0, expected: TERRAIN_WATER },
  { name: 'Corsica', lon: 9.0, lat: 42.0, expected: TERRAIN_WATER },
  { name: 'Crete', lon: 25.0, lat: 35.2, expected: TERRAIN_WATER },
  { name: 'Cyprus', lon: 33.0, lat: 35.0, expected: TERRAIN_WATER },
  { name: 'Malta', lon: 14.4, lat: 35.9, expected: TERRAIN_WATER },
  { name: 'France mainland', lon: 2.0, lat: 47.0, expected: TERRAIN_LAND },
  { name: 'Anatolia mainland', lon: 34.0, lat: 39.0, expected: TERRAIN_LAND },
  { name: 'North Africa coast', lon: 10.0, lat: 32.0, expected: TERRAIN_LAND },
  { name: 'Scandinavian mainland', lon: 15.0, lat: 63.0, expected: TERRAIN_LAND },
  { name: 'Western Russia mainland', lon: 40.0, lat: 56.0, expected: TERRAIN_LAND },
  { name: 'Lake Van area treated as land', lon: 43.3, lat: 38.6, expected: TERRAIN_LAND },
  { name: 'Lake Urmia area treated as land', lon: 45.5, lat: 37.7, expected: TERRAIN_LAND },
  { name: 'Lake Vanern area treated as land', lon: 13.2, lat: 58.9, expected: TERRAIN_LAND },
  { name: 'Lake Vattern area treated as land', lon: 14.5, lat: 58.3, expected: TERRAIN_LAND },
  { name: 'Lake Geneva area treated as land', lon: 6.5, lat: 46.4, expected: TERRAIN_LAND },
  { name: 'Lake Balaton area treated as land', lon: 17.7, lat: 46.8, expected: TERRAIN_LAND },
]);

const OWNER_IDS = Object.freeze({
  ottoman: 1,
  spain: 2,
  austria: 3,
  hre: 4,
  france: 5,
  sweden: 8,
  denmarkNorway: 9,
  polandLithuania: 10,
  russia: 11,
  safevid: 12,
  papal: 15,
  morocco: 17,
  tuscany: 18,
  savoy: 19,
});

const OWNER_CLEAR_POLYGONS = Object.freeze([
  {
    name: 'Sicily owner cleanup',
    polygons: [
      [
        [11.8, 38.6],
        [15.8, 38.6],
        [16.1, 36.3],
        [12.1, 36.2],
        [11.8, 38.6],
      ],
    ],
  },
  {
    name: 'Malta owner cleanup',
    polygons: [
      [
        [14.0, 36.2],
        [14.8, 36.2],
        [14.8, 35.6],
        [14.0, 35.6],
        [14.0, 36.2],
      ],
    ],
  },
]);

const OWNER_OVERRIDES = Object.freeze([
  {
    name: 'Austria core and Habsburg hereditary lands',
    ownerId: OWNER_IDS.austria,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'hre-transfer',
    polygons: [
      [
        [9.4, 47.8],
        [17.4, 49.6],
        [18.8, 47.8],
        [17.3, 45.1],
        [12.0, 45.6],
        [9.4, 47.8],
      ],
      [
        [13.2, 51.2],
        [18.6, 51.2],
        [18.9, 49.1],
        [14.0, 48.7],
        [12.0, 49.1],
        [13.2, 51.2],
      ],
      [
        [16.0, 48.7],
        [22.6, 48.9],
        [22.7, 45.2],
        [16.0, 45.0],
        [16.0, 48.7],
      ],
    ],
  },
  {
    name: 'Spanish Netherlands',
    ownerId: OWNER_IDS.spain,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'hre-transfer',
    polygons: [
      [
        [2.45, 51.55],
        [6.6, 51.55],
        [6.6, 49.45],
        [2.45, 49.45],
        [2.45, 51.55],
      ],
    ],
  },
  {
    name: 'Free County of Burgundy',
    ownerId: OWNER_IDS.spain,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre, OWNER_IDS.france],
    category: 'hre-transfer',
    polygons: [
      [
        [5.2, 48.4],
        [7.35, 48.3],
        [7.45, 46.15],
        [5.4, 46.05],
        [5.2, 48.4],
      ],
    ],
  },
  {
    name: 'Duchy of Milan',
    ownerId: OWNER_IDS.spain,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'italy-transfer',
    polygons: [
      [
        [7.6, 46.45],
        [10.35, 46.45],
        [10.35, 44.65],
        [8.0, 44.45],
        [7.6, 46.45],
      ],
    ],
  },
  {
    name: 'Kingdom of Naples mainland',
    ownerId: OWNER_IDS.spain,
    replaceOwners: [OWNER_UNASSIGNED],
    category: 'italy-transfer',
    polygons: [
      [
        [12.1, 42.2],
        [18.8, 42.1],
        [18.8, 38.6],
        [15.2, 38.8],
        [12.5, 40.2],
        [12.1, 42.2],
      ],
    ],
  },
  {
    name: 'Royal Holstein',
    ownerId: OWNER_IDS.denmarkNorway,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'hre-transfer',
    polygons: [
      [
        [8.4, 55.2],
        [11.4, 55.2],
        [11.4, 53.75],
        [8.4, 53.75],
        [8.4, 55.2],
      ],
    ],
  },
  {
    name: 'Swedish HRE holdings',
    ownerId: OWNER_IDS.sweden,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'hre-transfer',
    polygons: [
      [
        [12.6, 54.65],
        [14.7, 54.65],
        [14.9, 53.55],
        [12.8, 53.35],
        [12.6, 54.65],
      ],
      [
        [11.15, 54.05],
        [11.85, 54.05],
        [11.85, 53.65],
        [11.15, 53.65],
        [11.15, 54.05],
      ],
      [
        [8.55, 53.75],
        [10.1, 53.75],
        [10.1, 52.85],
        [8.55, 52.85],
        [8.55, 53.75],
      ],
    ],
  },
  {
    name: 'Ottoman North Africa except Morocco',
    ownerId: OWNER_IDS.ottoman,
    replaceOwners: [OWNER_UNASSIGNED],
    category: 'ottoman-unassigned',
    polygons: [
      [
        [-1.3, 35.8],
        [12.0, 36.2],
        [25.0, 33.9],
        [35.0, 31.8],
        [35.0, 25.0],
        [-1.3, 25.0],
        [-1.3, 35.8],
      ],
    ],
  },
  {
    name: 'Ottoman Middle East and Arabia',
    ownerId: OWNER_IDS.ottoman,
    replaceOwners: [OWNER_UNASSIGNED],
    category: 'ottoman-unassigned',
    polygons: [
      [
        [34.0, 37.3],
        [44.0, 37.5],
        [49.0, 31.5],
        [55.0, 25.0],
        [35.0, 25.0],
        [34.0, 37.3],
      ],
    ],
  },
  {
    name: 'Ottoman Danubian vassals',
    ownerId: OWNER_IDS.ottoman,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre, OWNER_IDS.austria],
    category: 'ottoman-vassal',
    polygons: [
      [
        [20.3, 48.3],
        [29.4, 48.4],
        [29.2, 43.7],
        [21.2, 43.7],
        [20.3, 48.3],
      ],
    ],
  },
  {
    name: 'Ottoman Crimea and northern Black Sea',
    ownerId: OWNER_IDS.ottoman,
    replaceOwners: [OWNER_UNASSIGNED],
    category: 'ottoman-vassal',
    polygons: [
      [
        [27.0, 46.3],
        [39.0, 46.6],
        [39.2, 44.2],
        [29.0, 44.2],
        [27.0, 46.3],
      ],
    ],
  },
  {
    name: 'Ottoman western Caucasus',
    ownerId: OWNER_IDS.ottoman,
    replaceOwners: [OWNER_UNASSIGNED],
    category: 'ottoman-vassal',
    polygons: [
      [
        [37.0, 45.4],
        [44.3, 45.2],
        [44.0, 40.6],
        [38.8, 40.5],
        [37.0, 45.4],
      ],
    ],
  },
  {
    name: 'Safevid eastern Caucasus and Azerbaijan',
    ownerId: OWNER_IDS.safevid,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.ottoman, OWNER_IDS.russia],
    category: 'safevid-unassigned',
    polygons: [
      [
        [42.5, 42.8],
        [50.8, 42.6],
        [50.8, 37.7],
        [44.0, 37.7],
        [42.5, 42.8],
      ],
    ],
  },
  {
    name: 'Zaporozhian Host',
    ownerId: OWNER_IDS.polandLithuania,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.ottoman, OWNER_IDS.russia],
    category: 'zaporozhian',
    polygons: [
      [
        [29.0, 49.6],
        [38.6, 49.3],
        [38.7, 46.0],
        [31.2, 45.9],
        [29.0, 49.6],
      ],
    ],
  },
  {
    name: 'Modena and Parma to Papal States',
    ownerId: OWNER_IDS.papal,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'italy-nearest',
    polygons: [
      [
        [9.4, 45.3],
        [11.5, 45.3],
        [11.5, 44.0],
        [9.4, 44.0],
        [9.4, 45.3],
      ],
    ],
  },
  {
    name: 'Lucca Piombino Massa-Carrara to Tuscany',
    ownerId: OWNER_IDS.tuscany,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'italy-nearest',
    polygons: [
      [
        [9.2, 44.6],
        [11.5, 44.6],
        [11.4, 42.4],
        [9.2, 42.4],
        [9.2, 44.6],
      ],
    ],
  },
  {
    name: 'Mantua Montferrat Monaco to Savoy',
    ownerId: OWNER_IDS.savoy,
    replaceOwners: [OWNER_UNASSIGNED, OWNER_IDS.hre],
    category: 'italy-nearest',
    polygons: [
      [
        [6.8, 45.8],
        [9.8, 45.8],
        [10.8, 44.8],
        [8.0, 43.45],
        [6.8, 43.45],
        [6.8, 45.8],
      ],
    ],
  },
  {
    name: 'San Marino to Papal States',
    ownerId: OWNER_IDS.papal,
    replaceOwners: [OWNER_UNASSIGNED],
    category: 'italy-nearest',
    polygons: [
      [
        [12.2, 44.1],
        [12.7, 44.1],
        [12.7, 43.75],
        [12.2, 43.75],
        [12.2, 44.1],
      ],
    ],
  },
]);

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function project(lon, lat) {
  const x = ((lon - BBOX.west) / (BBOX.east - BBOX.west)) * (TARGET_WIDTH - 1);
  const y = ((BBOX.north - lat) / (BBOX.north - BBOX.south)) * (TARGET_HEIGHT - 1);
  return [x, y];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function rgbaIdx(width, x, y) {
  return (y * width + x) * 4;
}

async function overpass(query, cachePath, retries = 3) {
  if (fs.existsSync(cachePath)) {
    return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}: ${await response.text()}`);
      const text = await response.text();
      fs.writeFileSync(cachePath, text);
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

function politicalQuery() {
  const ids = FACTIONS.map((faction) => faction.relationId).filter(Boolean).join(',');
  return `[out:json][timeout:240];relation(id:${ids});out geom;`;
}

function extraPoliticalQuery() {
  const ids = [...new Set(FACTIONS.flatMap((faction) => faction.extraRelationIds || []))].join(',');
  return `[out:json][timeout:180];relation(id:${ids});out geom;`;
}

function coastlineQuery() {
  const { south, west, north, east } = BBOX;
  return `[out:json][timeout:240];way(${south},${west},${north},${east})["natural"="coastline"];out geom qt;`;
}

function waterQuery() {
  const { south, west, north, east } = BBOX;
  const names = LARGE_WATER_NAMES.join('|');
  return `[out:json][timeout:180];
(
  way(${south},${west},${north},${east})["natural"="water"]["name"~"${names}",i];
  relation(${south},${west},${north},${east})["natural"="water"]["name"~"${names}",i];
);
out geom qt;`;
}

function islandQuery() {
  const { south, west, north, east } = BBOX;
  return `[out:json][timeout:120];
(
  node(${south},${west},${north},${east})["place"~"^(island|islet)$"];
  way(${south},${west},${north},${east})["place"~"^(island|islet)$"];
  relation(${south},${west},${north},${east})["place"~"^(island|islet)$"];
);
out tags center qt;`;
}

function featuresFromOsm(osmJson) {
  return osmtogeojson(osmJson, { flatProperties: true }).features || [];
}

function normalizeAllInnerBoundaryRelations(osmJson) {
  const fixes = [];
  for (const element of osmJson.elements || []) {
    if (element.type !== 'relation' || element.tags?.type !== 'boundary') continue;
    const ways = (element.members || []).filter((member) => member.type === 'way');
    const outerCount = ways.filter((member) => member.role === 'outer').length;
    const innerCount = ways.filter((member) => member.role === 'inner').length;
    if (ways.length === 0 || outerCount > 0 || innerCount === 0) continue;
    for (const member of ways) {
      if (member.role === 'inner') member.role = 'outer';
    }
    fixes.push({
      relationId: element.id,
      name: element.tags?.name || null,
      nameEn: element.tags?.['name:en'] || null,
      changedWays: innerCount,
      reason: 'Boundary relation has inner ways but no outer ways; treated as outer for polygonization.',
    });
  }
  return fixes;
}

function relationFeatureMap(osmJson) {
  const features = featuresFromOsm(osmJson);
  const byId = new Map();
  for (const feature of features) {
    const rawId = feature.properties?.id;
    const match = /^relation\/(\d+)$/.exec(String(rawId || ''));
    if (match) byId.set(Number(match[1]), feature);
  }
  return byId;
}

function featurePolygonCount(feature) {
  if (!feature?.geometry) return 0;
  if (feature.geometry.type === 'Polygon') return 1;
  if (feature.geometry.type === 'MultiPolygon') return feature.geometry.coordinates.length;
  return 0;
}

function featureRingCount(feature) {
  if (!feature?.geometry) return 0;
  if (feature.geometry.type === 'Polygon') return feature.geometry.coordinates.length;
  if (feature.geometry.type === 'MultiPolygon') {
    return feature.geometry.coordinates.reduce((sum, polygon) => sum + polygon.length, 0);
  }
  return 0;
}

function featureFromManualPolygons(faction) {
  if (!faction.manualPolygons?.length) return null;
  return {
    type: 'Feature',
    properties: {
      id: `manual/${faction.slug}`,
      name: faction.name,
      source: faction.source || 'manual-coarse-polygon',
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: faction.manualPolygons.map((ring) => [ring]),
    },
  };
}

function factionWritePredicate(faction, terrain, owner) {
  if (faction.writePolicy === 'only-unassigned-land') {
    return (idx) => terrain[idx] !== TERRAIN_WATER && owner[idx] === OWNER_UNASSIGNED;
  }
  if (faction.writePolicy === 'unassigned-or-hre') {
    return (idx) => terrain[idx] !== TERRAIN_WATER && (owner[idx] === OWNER_UNASSIGNED || owner[idx] === 4);
  }
  return (idx) => terrain[idx] !== TERRAIN_WATER;
}

function factionFeatures(faction, relationFeaturesById, extraRelationFeaturesById) {
  const features = [];
  if (faction.relationId) {
    const feature = relationFeaturesById.get(faction.relationId);
    if (feature) features.push({ type: 'ohm-relation', relationId: faction.relationId, feature });
  }
  for (const relationId of faction.extraRelationIds || []) {
    const feature = extraRelationFeaturesById.get(relationId);
    if (feature) features.push({ type: 'ohm-extra-relation', relationId, feature });
  }
  const manual = featureFromManualPolygons(faction);
  if (manual) features.push({ type: 'manual-polygon', relationId: null, feature: manual });
  return features;
}

function rasterizeFeature(target, feature, value, options = {}) {
  const geometry = feature?.geometry;
  if (!geometry) return 0;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  let changed = 0;
  for (const polygon of polygons) {
    changed += rasterizePolygon(target, polygon, value, options);
  }
  return changed;
}

function rasterizePolygon(target, polygon, value, options = {}) {
  if (!polygon?.length) return 0;
  const { holeValue = OWNER_UNASSIGNED } = options;
  let changed = rasterizeCoordinateRing(target, polygon[0], value, options);
  for (let i = 1; i < polygon.length; i++) {
    changed += rasterizeCoordinateRing(target, polygon[i], holeValue, options);
  }
  return changed;
}

function rasterizeCoordinateRing(target, coordinateRing, value, options = {}) {
  const ring = coordinateRing
    .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
    .map(([lon, lat]) => ({ lon, lat }));
  if (ring.length < 4) return 0;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.lon !== last.lon || first.lat !== last.lat) ring.push({ lon: first.lon, lat: first.lat });
  return rasterizeSingleRing(target, ring, value, options);
}

function rasterizeSingleRing(target, ring, value, options = {}) {
  const { shouldWrite } = options;
  const buckets = Array.from({ length: TARGET_HEIGHT }, () => []);
  const projected = ring.map((point) => project(point.lon, point.lat));
  for (let i = 0; i < projected.length - 1; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[i + 1];
    if (Math.abs(y1 - y2) < 0.0001) continue;
    const edgeMinY = Math.min(y1, y2);
    const edgeMaxY = Math.max(y1, y2);
    const minY = Math.max(0, Math.ceil(edgeMinY - 0.5));
    const maxY = Math.min(TARGET_HEIGHT - 1, Math.floor(edgeMaxY - 0.5));
    for (let y = minY; y <= maxY; y++) {
      const scanY = y + 0.5;
      if (scanY < edgeMinY || scanY >= edgeMaxY) continue;
      const t = (scanY - y1) / (y2 - y1);
      buckets[y].push(x1 + t * (x2 - x1));
    }
  }

  let changed = 0;
  for (let y = 0; y < TARGET_HEIGHT; y++) {
    const xs = buckets[y];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      const start = clamp(Math.ceil(xs[i] - 0.5), 0, TARGET_WIDTH - 1);
      const end = clamp(Math.floor(xs[i + 1] - 0.5), 0, TARGET_WIDTH - 1);
      for (let x = start; x <= end; x++) {
        const idx = y * TARGET_WIDTH + x;
        if ((!shouldWrite || shouldWrite(idx)) && target[idx] !== value) {
          target[idx] = value;
          changed++;
        }
      }
    }
  }
  return changed;
}

function drawLine(mask, x0, y0, x1, y1, thickness = 2) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const sx = x < tx ? 1 : -1;
  const dy = -Math.abs(ty - y);
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;

  while (true) {
    for (let yy = y - thickness; yy <= y + thickness; yy++) {
      for (let xx = x - thickness; xx <= x + thickness; xx++) {
        if (xx >= 0 && yy >= 0 && xx < TARGET_WIDTH && yy < TARGET_HEIGHT) mask[yy * TARGET_WIDTH + xx] = 1;
      }
    }
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawTerrainWaterLine(terrain, x0, y0, x1, y1, thickness = 1) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const sx = x < tx ? 1 : -1;
  const dy = -Math.abs(ty - y);
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  let changed = 0;

  while (true) {
    for (let yy = y - thickness; yy <= y + thickness; yy++) {
      for (let xx = x - thickness; xx <= x + thickness; xx++) {
        if (xx < 0 || yy < 0 || xx >= TARGET_WIDTH || yy >= TARGET_HEIGHT) continue;
        const idx = yy * TARGET_WIDTH + xx;
        if (terrain[idx] !== TERRAIN_WATER) {
          terrain[idx] = TERRAIN_WATER;
          changed++;
        }
      }
    }
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }

  return changed;
}

function applyStraitWaterCorridors(terrain) {
  return STRAIT_WATER_CORRIDORS.map((corridor) => {
    const [x1, y1] = project(corridor.from[0], corridor.from[1]);
    const [x2, y2] = project(corridor.to[0], corridor.to[1]);
    return {
      name: corridor.name,
      from: { lon: corridor.from[0], lat: corridor.from[1] },
      to: { lon: corridor.to[0], lat: corridor.to[1] },
      thickness: corridor.thickness,
      changedTiles: drawTerrainWaterLine(terrain, x1, y1, x2, y2, corridor.thickness),
    };
  });
}

function drawCoastlineBarrier(coastlineElements) {
  const barrier = new Uint8Array(TARGET_WIDTH * TARGET_HEIGHT);
  for (const way of coastlineElements) {
    if (!way.geometry || way.geometry.length < 2) continue;
    for (let i = 0; i < way.geometry.length - 1; i++) {
      const [x1, y1] = project(way.geometry[i].lon, way.geometry[i].lat);
      const [x2, y2] = project(way.geometry[i + 1].lon, way.geometry[i + 1].lat);
      drawLine(barrier, x1, y1, x2, y2, 1);
    }
  }
  return barrier;
}

function floodWaterFromSeeds(barrier) {
  const water = new Uint8Array(TARGET_WIDTH * TARGET_HEIGHT);
  const queue = new Uint32Array(TARGET_WIDTH * TARGET_HEIGHT);
  let head = 0;
  let tail = 0;

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= TARGET_WIDTH || y >= TARGET_HEIGHT) return;
    const idx = y * TARGET_WIDTH + x;
    if (water[idx] || barrier[idx]) return;
    water[idx] = 1;
    queue[tail++] = idx;
  };

  for (const [lon, lat] of WATER_SEEDS) {
    const [x, y] = project(lon, lat);
    push(Math.round(x), Math.round(y));
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % TARGET_WIDTH;
    const y = Math.floor(idx / TARGET_WIDTH);
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return water;
}

function tileIndexFromLonLat(lon, lat) {
  if (lon < BBOX.west || lon > BBOX.east || lat < BBOX.south || lat > BBOX.north) return -1;
  const [x, y] = project(lon, lat);
  const tx = clamp(Math.round(x), 0, TARGET_WIDTH - 1);
  const ty = clamp(Math.round(y), 0, TARGET_HEIGHT - 1);
  return ty * TARGET_WIDTH + tx;
}

function removeIslandComponents(terrain) {
  const total = TARGET_WIDTH * TARGET_HEIGHT;
  const keep = new Uint8Array(total);
  const visited = new Uint8Array(total);
  const queue = new Uint32Array(total);
  const keptSeedNames = [];

  const push = (idx, tail) => {
    if (idx < 0 || idx >= total || visited[idx] || terrain[idx] === TERRAIN_WATER) return tail;
    visited[idx] = 1;
    keep[idx] = 1;
    queue[tail++] = idx;
    return tail;
  };

  let head = 0;
  let tail = 0;
  for (const seed of MAIN_LAND_SEEDS) {
    const idx = tileIndexFromLonLat(seed.lon, seed.lat);
    if (idx === -1 || terrain[idx] === TERRAIN_WATER || visited[idx]) continue;
    keptSeedNames.push(seed.name);
    tail = push(idx, tail);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % TARGET_WIDTH;
    const y = Math.floor(idx / TARGET_WIDTH);
    if (x > 0) tail = push(idx - 1, tail);
    if (x < TARGET_WIDTH - 1) tail = push(idx + 1, tail);
    if (y > 0) tail = push(idx - TARGET_WIDTH, tail);
    if (y < TARGET_HEIGHT - 1) tail = push(idx + TARGET_WIDTH, tail);
  }

  let islandTilesConverted = 0;
  for (let i = 0; i < total; i++) {
    if (terrain[i] !== TERRAIN_WATER && keep[i] === 0) {
      terrain[i] = TERRAIN_WATER;
      islandTilesConverted++;
    }
  }

  return { islandTilesConverted, keptSeedNames };
}

function terrainCheck(terrain, check) {
  const idx = tileIndexFromLonLat(check.lon, check.lat);
  if (idx === -1) {
    return {
      ...check,
      expectedName: check.expected === TERRAIN_WATER ? 'water' : 'land',
      actual: null,
      actualName: 'outside-bbox',
      pass: check.expected === TERRAIN_WATER,
      note: 'Outside configured bbox; treated as non-playable water/outside map.',
    };
  }
  const actual = terrain[idx];
  return {
    ...check,
    expectedName: check.expected === TERRAIN_WATER ? 'water' : 'land',
    actual,
    actualName: actual === TERRAIN_WATER ? 'water' : actual === TERRAIN_LAND ? 'land' : `unexpected-${actual}`,
    pass: actual === check.expected,
  };
}

function largeWaterFeatureSummary(waterFeatures) {
  return waterFeatures.map((feature) => ({
    id: feature.properties?.id || null,
    name: feature.properties?.name || feature.properties?.['name:en'] || null,
    natural: feature.properties?.natural || null,
    type: feature.geometry?.type || null,
    polygonCount: featurePolygonCount(feature),
    ringCount: featureRingCount(feature),
  }));
}

function featureFromPolygons(name, polygons) {
  return {
    type: 'Feature',
    properties: { id: `manual/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name },
    geometry: {
      type: 'MultiPolygon',
      coordinates: polygons.map((ring) => [ring]),
    },
  };
}

function applyOwnerClearPolygons(owner, fallbackBlocked) {
  return OWNER_CLEAR_POLYGONS.map((clear) => {
    const previousOwnerCounts = {};
    const feature = featureFromPolygons(clear.name, clear.polygons);
    const changedTiles = rasterizeFeature(owner, feature, OWNER_UNASSIGNED, {
      shouldWrite: (idx) => {
        fallbackBlocked[idx] = 1;
        const currentOwner = owner[idx];
        if (currentOwner === OWNER_UNASSIGNED) return false;
        previousOwnerCounts[currentOwner] = (previousOwnerCounts[currentOwner] || 0) + 1;
        return true;
      },
    });
    return {
      name: clear.name,
      changedTiles,
      previousOwnerCounts,
      fallbackBlocked: true,
    };
  });
}

function applyOwnerOverrides(owner, terrain) {
  return OWNER_OVERRIDES.map((override) => {
    const replaceOwners = new Set(override.replaceOwners || [OWNER_UNASSIGNED]);
    const previousOwnerCounts = {};
    const feature = featureFromPolygons(override.name, override.polygons);
    const changedTiles = rasterizeFeature(owner, feature, override.ownerId, {
      shouldWrite: (idx) => {
        if (terrain[idx] !== TERRAIN_LAND) return false;
        const currentOwner = owner[idx];
        if (currentOwner === override.ownerId || !replaceOwners.has(currentOwner)) return false;
        previousOwnerCounts[currentOwner] = (previousOwnerCounts[currentOwner] || 0) + 1;
        return true;
      },
    });
    return {
      name: override.name,
      category: override.category,
      ownerId: override.ownerId,
      replaceOwners: override.replaceOwners || [OWNER_UNASSIGNED],
      changedTiles,
      previousOwnerCounts,
      hreTilesTransferred: previousOwnerCounts[OWNER_IDS.hre] || 0,
    };
  });
}

function fillUnassignedLandByNearestOwner(owner, terrain, fallbackBlocked) {
  const total = TARGET_WIDTH * TARGET_HEIGHT;
  const queue = new Uint32Array(total);
  let head = 0;
  let tail = 0;

  for (let idx = 0; idx < total; idx++) {
    if (terrain[idx] === TERRAIN_LAND && owner[idx] !== OWNER_UNASSIGNED) queue[tail++] = idx;
  }
  const seedTiles = tail;

  const filledByOwner = {};
  while (head < tail) {
    const idx = queue[head++];
    const sourceOwner = owner[idx];
    const x = idx % TARGET_WIDTH;
    const y = Math.floor(idx / TARGET_WIDTH);

    const visit = (next) => {
      if (terrain[next] !== TERRAIN_LAND || fallbackBlocked[next] || owner[next] !== OWNER_UNASSIGNED) return;
      owner[next] = sourceOwner;
      filledByOwner[sourceOwner] = (filledByOwner[sourceOwner] || 0) + 1;
      queue[tail++] = next;
    };
    if (x > 0) visit(idx - 1);
    if (x < TARGET_WIDTH - 1) visit(idx + 1);
    if (y > 0) visit(idx - TARGET_WIDTH);
    if (y < TARGET_HEIGHT - 1) visit(idx + TARGET_WIDTH);
  }

  let remainingUnassignedLand = 0;
  for (let idx = 0; idx < total; idx++) {
    if (terrain[idx] === TERRAIN_LAND && !fallbackBlocked[idx] && owner[idx] === OWNER_UNASSIGNED) remainingUnassignedLand++;
  }

  return {
    method: 'multi-source-land-bfs-nearest-owner',
    seedTiles,
    filledTiles: Object.values(filledByOwner).reduce((sum, value) => sum + value, 0),
    filledByOwner,
    remainingUnassignedLand,
  };
}

function clearWaterOwners(owner, terrain) {
  let cleared = 0;
  for (let i = 0; i < owner.length; i++) {
    if (terrain[i] === TERRAIN_WATER && owner[i] !== OWNER_UNASSIGNED) {
      owner[i] = OWNER_UNASSIGNED;
      cleared++;
    }
  }
  return cleared;
}

function largeWaterName(feature) {
  return [
    feature.properties?.name,
    feature.properties?.['name:en'],
    feature.properties?.['name:tr'],
    feature.properties?.['name:ru'],
  ]
    .filter(Boolean)
    .join(' | ');
}

function isAcceptedLargeWaterFeature(feature) {
  const name = largeWaterName(feature);
  if (/воронеж|канал|canal|hafen|harbou?r|port/i.test(name)) return false;
  return (
    /caspian sea|hazar denizi|kaspische see/i.test(name) ||
    /касп/i.test(name) ||
    /aral sea/i.test(name) ||
    /арал/i.test(name) ||
    /\bladoga\b/i.test(name) ||
    /ладож/i.test(name) ||
    /\bonega\b/i.test(name) ||
    /онеж/i.test(name)
  );
}

function countBytes(bytes, value) {
  let count = 0;
  for (const byte of bytes) if (byte === value) count++;
  return count;
}

function makePreview(owner, terrain) {
  const png = new PNG({ width: TARGET_WIDTH, height: TARGET_HEIGHT });
  const colorByOwner = new Map(FACTIONS.map((faction) => [faction.ownerId, faction.color]));
  for (let y = 0; y < TARGET_HEIGHT; y++) {
    for (let x = 0; x < TARGET_WIDTH; x++) {
      const idx = y * TARGET_WIDTH + x;
      let rgb;
      if (terrain[idx] === TERRAIN_WATER) rgb = [158, 204, 211];
      else rgb = colorByOwner.get(owner[idx]) || [214, 214, 204];
      const p = rgbaIdx(TARGET_WIDTH, x, y);
      png.data[p] = rgb[0];
      png.data[p + 1] = rgb[1];
      png.data[p + 2] = rgb[2];
      png.data[p + 3] = 255;
    }
  }
  return png;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function probeProblematic() {
  const output = [];
  for (const item of PROBLEMATIC) {
    const rows = [];
    for (const date of item.dates) {
      const pattern = item.patterns[0];
      const query = `[out:json][timeout:60];
(
  relation["name"~"${pattern}",i](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  relation["name:en"~"${pattern}",i](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out tags bb qt;`;
      const cache = path.join(OUT_DIR, `raw-ohm-probe-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${date}.json`);
      const result = await overpass(query, cache, 2);
      const matches = (result.elements || [])
        .filter((element) => {
          const tags = element.tags || {};
          return tags.start_date <= date && (!tags.end_date || tags.end_date > date);
        })
        .map((element) => ({
          id: element.id,
          name: element.tags?.name || null,
          nameEn: element.tags?.['name:en'] || null,
          startDate: element.tags?.start_date || null,
          endDate: element.tags?.end_date || null,
          adminLevel: element.tags?.admin_level || null,
          bounds: element.bounds || null,
        }));
      rows.push({ date, matches: matches.slice(0, 12), matchCount: matches.length });
    }
    output.push({ name: item.name, probes: rows });
  }
  return output;
}

async function main() {
  const generatedOutputs = [OWNER_PATH, TERRAIN_PATH, COLORS_PATH, PREVIEW_PATH, REPORT_PATH];
  const existingOutputs = generatedOutputs.filter((file) => fs.existsSync(file));
  if (existingOutputs.length > 0 && !FORCE_WRITE) {
    throw new Error(`Refusing to overwrite existing world-map assets without --force: ${existingOutputs.join(', ')}`);
  }

  ensureDir();
  const politics = await overpass(politicalQuery(), RAW_POLITICS_PATH);
  const extraPolitics = await overpass(extraPoliticalQuery(), RAW_EXTRA_POLITICS_PATH);
  const coastline = await overpass(coastlineQuery(), RAW_COASTLINE_PATH);
  const waterData = await overpass(waterQuery(), RAW_WATER_PATH);
  const islandData = await overpass(islandQuery(), RAW_ISLANDS_PATH);
  const boundaryRoleFixes = normalizeAllInnerBoundaryRelations(politics);
  boundaryRoleFixes.push(...normalizeAllInnerBoundaryRelations(extraPolitics));

  const owner = new Uint8Array(TARGET_WIDTH * TARGET_HEIGHT);
  const terrain = new Uint8Array(TARGET_WIDTH * TARGET_HEIGHT);
  terrain.fill(TERRAIN_LAND);

  const coastlineBarrier = drawCoastlineBarrier(coastline.elements || []);
  const sea = floodWaterFromSeeds(coastlineBarrier);
  for (let i = 0; i < terrain.length; i++) {
    if (sea[i]) terrain[i] = TERRAIN_WATER;
  }

  const rawWaterFeatures = featuresFromOsm(waterData);
  const waterFeatures = rawWaterFeatures.filter(isAcceptedLargeWaterFeature);
  for (const feature of waterFeatures) {
    rasterizeFeature(terrain, feature, TERRAIN_WATER, { holeValue: TERRAIN_LAND });
  }
  const islandComponentResult = removeIslandComponents(terrain);
  const straitCorridors = applyStraitWaterCorridors(terrain);

  const relationById = new Map((politics.elements || []).map((element) => [element.id, element]));
  const extraRelationById = new Map((extraPolitics.elements || []).map((element) => [element.id, element]));
  const relationFeaturesById = relationFeatureMap(politics);
  const extraRelationFeaturesById = relationFeatureMap(extraPolitics);
  const factionReports = [];
  for (const faction of [...FACTIONS].sort((a, b) => a.priority - b.priority)) {
    const sources = factionFeatures(faction, relationFeaturesById, extraRelationFeaturesById);
    const shouldWrite = factionWritePredicate(faction, terrain, owner);
    for (const source of sources) {
      rasterizeFeature(owner, source.feature, faction.ownerId, {
        holeValue: OWNER_UNASSIGNED,
        shouldWrite,
      });
    }
    const relation = faction.relationId ? relationById.get(faction.relationId) : null;
    const extraRelations = (faction.extraRelationIds || []).map((relationId) => extraRelationById.get(relationId)).filter(Boolean);
    factionReports.push({
      ownerId: faction.ownerId,
      name: faction.name,
      slug: faction.slug,
      relationId: faction.relationId || null,
      extraRelationIds: faction.extraRelationIds || [],
      ohmName: relation?.tags?.name || null,
      ohmNameEn: relation?.tags?.['name:en'] || null,
      startDate: relation?.tags?.start_date || null,
      endDate: relation?.tags?.end_date || null,
      source: faction.source || (faction.relationId ? 'ohm-1648-relation' : 'unknown'),
      writePolicy: faction.writePolicy || 'overwrite-land',
      sourceDetails: sources.map((source) => ({
        type: source.type,
        relationId: source.relationId,
        polygonCount: featurePolygonCount(source.feature),
        ringCount: featureRingCount(source.feature),
      })),
      extraRelationNames: extraRelations.map((extraRelation) => ({
        relationId: extraRelation.id,
        name: extraRelation.tags?.name || null,
        nameEn: extraRelation.tags?.['name:en'] || null,
        startDate: extraRelation.tags?.start_date || null,
        endDate: extraRelation.tags?.end_date || null,
      })),
      polygonCount: sources.reduce((sum, source) => sum + featurePolygonCount(source.feature), 0),
      ringCount: sources.reduce((sum, source) => sum + featureRingCount(source.feature), 0),
    });
  }

  const fallbackBlocked = new Uint8Array(owner.length);
  const ownerClearReports = applyOwnerClearPolygons(owner, fallbackBlocked);
  const ownerOverrideReports = applyOwnerOverrides(owner, terrain);
  let clearedWaterOwners = clearWaterOwners(owner, terrain);
  const fallbackReport = fillUnassignedLandByNearestOwner(owner, terrain, fallbackBlocked);
  clearedWaterOwners += clearWaterOwners(owner, terrain);

  const ownerCounts = {};
  for (const value of owner) ownerCounts[value] = (ownerCounts[value] || 0) + 1;
  for (const report of factionReports) {
    report.tileCount = ownerCounts[report.ownerId] || 0;
    report.mapPercent = Number(((report.tileCount / owner.length) * 100).toFixed(3));
  }

  const colors = {};
  for (const faction of FACTIONS) {
    colors[faction.slug] = {
      ownerId: faction.ownerId,
      name: faction.name,
      rgb: faction.color,
      source: 'historical-distinct-debug-color',
    };
  }

  fs.writeFileSync(OWNER_PATH, owner);
  fs.writeFileSync(TERRAIN_PATH, terrain);
  writeJson(COLORS_PATH, colors);
  fs.writeFileSync(PREVIEW_PATH, PNG.sync.write(makePreview(owner, terrain)));

  const problematic = await probeProblematic();
  const waterTiles = countBytes(terrain, TERRAIN_WATER);
  const landTiles = terrain.length - waterTiles;
  const unassignedLandTiles = owner.reduce((sum, value, idx) => sum + (value === OWNER_UNASSIGNED && terrain[idx] !== TERRAIN_WATER ? 1 : 0), 0);
  const waterOwnerNonZero = owner.reduce((sum, value, idx) => sum + (value !== OWNER_UNASSIGNED && terrain[idx] === TERRAIN_WATER ? 1 : 0), 0);
  const unexpectedTerrainValues = {};
  for (const value of terrain) {
    if (value !== TERRAIN_WATER && value !== TERRAIN_LAND) unexpectedTerrainValues[value] = (unexpectedTerrainValues[value] || 0) + 1;
  }

  const report = {
    method: 'ohm-1648-mainland-only-terrain-v1',
    date: DATE,
    bbox: BBOX,
    targetGrid: { width: TARGET_WIDTH, height: TARGET_HEIGHT, tiles: TARGET_WIDTH * TARGET_HEIGHT },
    source: {
      overpassUrl: OVERPASS_URL,
      politicsCache: RAW_POLITICS_PATH,
      extraPoliticsCache: RAW_EXTRA_POLITICS_PATH,
      coastlineCache: RAW_COASTLINE_PATH,
      waterCache: RAW_WATER_PATH,
      islandsCache: RAW_ISLANDS_PATH,
    },
    simplificationRules: {
      terrainEncoding: {
        water: TERRAIN_WATER,
        land: TERRAIN_LAND,
      },
      rivers: 'ignored; rasterized as land',
      smallLakes: 'ignored; rasterized as land',
      elevation: 'ignored',
      islands: 'converted to water by connected component analysis, using mainland seed components only',
      largeWaters: LARGE_WATER_NAMES,
      straitCorrections: 'short water corridors keep narrow straits open after rasterization',
    },
    geographyQueryCounts: {
      coastlineWays: (coastline.elements || []).length,
      largeWaterElements: (waterData.elements || []).length,
      largeWaterFeaturesUsed: waterFeatures.length,
      islandTaggedElements: (islandData.elements || []).length,
    },
    islandDetection: {
      method: 'connected-component-mainland-seeds',
      mainLandSeeds: MAIN_LAND_SEEDS,
      keptSeedNames: islandComponentResult.keptSeedNames,
      islandTilesConverted: islandComponentResult.islandTilesConverted,
      placeIslandTagsQueriedForDiagnostics: true,
    },
    straitCorrections: straitCorridors,
    largeWaterFeatures: largeWaterFeatureSummary(waterFeatures),
    projection: {
      type: 'equirectangular',
      reason: 'The campaign map is a fixed atlas-style Europe map; equirectangular keeps the pipeline simple and deterministic for the 1995x1504 grid.',
    },
    terrainCounts: {
      waterTiles,
      landTiles,
      waterPercent: Number(((waterTiles / terrain.length) * 100).toFixed(3)),
      landPercent: Number(((landTiles / terrain.length) * 100).toFixed(3)),
      unexpectedTerrainValues,
    },
    ownerCounts,
    unassignedLandTiles,
    unassignedLandPercent: Number(((unassignedLandTiles / terrain.length) * 100).toFixed(3)),
    waterOwnerNonZero,
    clearedWaterOwners,
    ownerPostProcess: {
      clearReports: ownerClearReports,
      overrideReports: ownerOverrideReports,
      hreTilesTransferred: ownerOverrideReports.reduce((sum, item) => sum + item.hreTilesTransferred, 0),
      fallback: fallbackReport,
    },
    geographicChecks: GEOGRAPHIC_CHECKS.map((check) => terrainCheck(terrain, check)),
    boundaryRoleFixes,
    factions: factionReports.sort((a, b) => a.ownerId - b.ownerId),
    problematic,
    files: {
      owner: OWNER_PATH,
      terrain: TERRAIN_PATH,
      colors: COLORS_PATH,
      preview: PREVIEW_PATH,
    },
  };

  writeJson(REPORT_PATH, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
