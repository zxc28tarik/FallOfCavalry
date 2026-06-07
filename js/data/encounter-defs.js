export const ENCOUNTER_TYPE = Object.freeze({
  BANDIT: 'bandit',
  CARAVAN: 'caravan',
  ENEMY_PATROL: 'enemy_patrol',
  REFUGEE: 'refugee',
  TRAVELING_MERCHANT: 'traveling_merchant',
  MESSENGER: 'messenger',
  VILLAGERS: 'villagers',
  NOBLE: 'noble',
});

export const ENCOUNTER_TYPES = Object.freeze([
  ENCOUNTER_TYPE.BANDIT,
  ENCOUNTER_TYPE.CARAVAN,
  ENCOUNTER_TYPE.ENEMY_PATROL,
  ENCOUNTER_TYPE.REFUGEE,
  ENCOUNTER_TYPE.TRAVELING_MERCHANT,
  ENCOUNTER_TYPE.MESSENGER,
  ENCOUNTER_TYPE.VILLAGERS,
  ENCOUNTER_TYPE.NOBLE,
]);

export const ENCOUNTER_KIND_TO_TYPE = Object.freeze({
  bandit: ENCOUNTER_TYPE.BANDIT,
  caravan: ENCOUNTER_TYPE.CARAVAN,
  patrol: ENCOUNTER_TYPE.ENEMY_PATROL,
  enemy_patrol: ENCOUNTER_TYPE.ENEMY_PATROL,
  refugee: ENCOUNTER_TYPE.REFUGEE,
  traveling_merchant: ENCOUNTER_TYPE.TRAVELING_MERCHANT,
  merchant: ENCOUNTER_TYPE.TRAVELING_MERCHANT,
  messenger: ENCOUNTER_TYPE.MESSENGER,
  villagers: ENCOUNTER_TYPE.VILLAGERS,
  villager: ENCOUNTER_TYPE.VILLAGERS,
  noble: ENCOUNTER_TYPE.NOBLE,
});

export const SURPRISE_ENCOUNTER_TYPES = Object.freeze(new Set([
  ENCOUNTER_TYPE.BANDIT,
  ENCOUNTER_TYPE.CARAVAN,
  ENCOUNTER_TYPE.ENEMY_PATROL,
  ENCOUNTER_TYPE.REFUGEE,
  ENCOUNTER_TYPE.TRAVELING_MERCHANT,
  ENCOUNTER_TYPE.MESSENGER,
]));

export const ENCOUNTER_DEFS = Object.freeze({
  [ENCOUNTER_TYPE.BANDIT]: Object.freeze({
    title: 'Haydut / Eskiya',
    intro: 'Silahli bir haydut grubu yolu kesiyor.',
    visible: true,
    surprise: true,
    hostile: true,
    options: Object.freeze([
      { id: 'fight', label: 'Savas', outcome: 'battle' },
      { id: 'flee', label: 'Kac', outcome: 'map' },
      { id: 'bribe', label: 'Rusvet ver', outcome: 'resource', costGold: 18 },
      { id: 'intimidate', label: 'Korkut', outcome: 'resource', skill: 'command' },
      { id: 'offer_join', label: 'Teklif et', outcome: 'recruit_bandits', skill: 'charisma' },
      { id: 'demand_surrender', label: 'Teslim olmalarini iste', outcome: 'resource', skill: 'command' },
    ]),
  }),
  [ENCOUNTER_TYPE.CARAVAN]: Object.freeze({
    title: 'Kervan',
    intro: 'Yuklu bir kervan temkinli sekilde yaklasiyor.',
    visible: true,
    surprise: true,
    options: Object.freeze([
      { id: 'trade', label: 'Ticaret yap', outcome: 'trade' },
      { id: 'info', label: 'Bilgi al', outcome: 'info' },
      { id: 'escort', label: 'Refakat et', outcome: 'quest_placeholder' },
      { id: 'toll', label: 'Gecis ucreti iste', outcome: 'resource', skill: 'command' },
      { id: 'rob', label: 'Soy', outcome: 'battle' },
      { id: 'pass', label: 'Gec', outcome: 'map' },
    ]),
  }),
  [ENCOUNTER_TYPE.ENEMY_PATROL]: Object.freeze({
    title: 'Dusman Devriyesi',
    intro: 'Dusman devriyesi sizi fark ediyor.',
    visible: true,
    surprise: true,
    hostile: true,
    options: Object.freeze([
      { id: 'fight', label: 'Savas', outcome: 'battle' },
      { id: 'flee', label: 'Kac', outcome: 'map' },
      { id: 'hide', label: 'Saklan', outcome: 'map', skill: 'intelligence' },
      { id: 'negotiate_passage', label: 'Gecis izni muzakeresi', outcome: 'map', skill: 'charisma' },
      { id: 'false_flag', label: 'Sahte bayrakla gec', outcome: 'map', skill: 'intelligence' },
      { id: 'surrender', label: 'Teslim ol', outcome: 'resource' },
    ]),
  }),
  [ENCOUNTER_TYPE.REFUGEE]: Object.freeze({
    title: 'Multeci / Gocmen',
    intro: 'Yorgun bir gocmen kafilesi yardim ariyor.',
    visible: true,
    surprise: true,
    options: Object.freeze([
      { id: 'help', label: 'Yardim et', outcome: 'resource' },
      { id: 'give_supplies', label: 'Erzak ver', outcome: 'resource', costFood: 3 },
      { id: 'info', label: 'Bilgi al', outcome: 'info' },
      { id: 'direct_refugees', label: 'Yonlendir', outcome: 'reputation', skill: 'charisma' },
      { id: 'hire', label: 'Ise al', outcome: 'recruit' },
      { id: 'pass', label: 'Gec', outcome: 'map' },
    ]),
  }),
  [ENCOUNTER_TYPE.TRAVELING_MERCHANT]: Object.freeze({
    title: 'Gezgin Tuccar',
    intro: 'Gezgin bir tuccar nadir mallar gostermek istiyor.',
    visible: true,
    surprise: true,
    options: Object.freeze([
      { id: 'trade', label: 'Ticaret yap', outcome: 'trade' },
      { id: 'info', label: 'Bilgi al', outcome: 'info' },
      { id: 'special_goods', label: 'Ozel mal sor', outcome: 'info', skill: 'charisma' },
      { id: 'hire', label: 'Ise al', outcome: 'recruit' },
      { id: 'pass', label: 'Gec', outcome: 'map' },
    ]),
  }),
  [ENCOUNTER_TYPE.MESSENGER]: Object.freeze({
    title: 'Haberci',
    intro: 'Aceleci bir haberci yolunuza cikiyor.',
    visible: true,
    surprise: true,
    options: Object.freeze([
      { id: 'let_pass', label: 'Gecir', outcome: 'map' },
      { id: 'stop', label: 'Durdur', outcome: 'info' },
      { id: 'read', label: 'Oku', outcome: 'info', skill: 'intelligence' },
      { id: 'seize', label: 'El koy', outcome: 'resource' },
      { id: 'follow', label: 'Takip et', outcome: 'quest_placeholder' },
      { id: 'interrogate', label: 'Sorgula', outcome: 'info', skill: 'intelligence' },
    ]),
  }),
  [ENCOUNTER_TYPE.VILLAGERS]: Object.freeze({
    title: 'Koyluler',
    intro: 'Koyluler yol kenarinda toplanmis.',
    visible: true,
    surprise: false,
    options: Object.freeze([
      { id: 'talk', label: 'Konus', outcome: 'info', skill: 'charisma' },
      { id: 'info', label: 'Bilgi al', outcome: 'info' },
      { id: 'help', label: 'Yardim et', outcome: 'reputation' },
      { id: 'demand_supplies', label: 'Erzak talep et', outcome: 'resource' },
      { id: 'call_recruits', label: 'Asker cagrisi yap', outcome: 'recruit', skill: 'command' },
      { id: 'pass', label: 'Gec', outcome: 'map' },
    ]),
  }),
  [ENCOUNTER_TYPE.NOBLE]: Object.freeze({
    title: 'Soylu / Bey',
    intro: 'Muttefik bir soylu maiyetiyle ilerliyor.',
    visible: true,
    surprise: false,
    friendly: true,
    options: Object.freeze([
      { id: 'greet', label: 'Selamla', outcome: 'reputation' },
      { id: 'talk', label: 'Konus', outcome: 'info', skill: 'charisma' },
      { id: 'info', label: 'Bilgi al', outcome: 'info' },
      { id: 'ask_help', label: 'Yardim iste', outcome: 'resource', skill: 'charisma' },
      { id: 'coordinate', label: 'Birlik koordinasyonu', outcome: 'reputation', skill: 'command' },
      { id: 'quest', label: 'Gorev al/ver', outcome: 'quest_placeholder' },
    ]),
  }),
});

export function normalizeEncounterType(value) {
  const raw = String(value || '').trim().toLowerCase();
  return ENCOUNTER_KIND_TO_TYPE[raw] || (ENCOUNTER_TYPES.includes(raw) ? raw : ENCOUNTER_TYPE.BANDIT);
}

export function getEncounterDef(type) {
  return ENCOUNTER_DEFS[normalizeEncounterType(type)] || ENCOUNTER_DEFS[ENCOUNTER_TYPE.BANDIT];
}

export function canSurpriseEncounter(type) {
  return SURPRISE_ENCOUNTER_TYPES.has(normalizeEncounterType(type));
}
