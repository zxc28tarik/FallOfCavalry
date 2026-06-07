/**
 * tacticalOrders.js — Taktik emir tanımları.
 *
 * Her emir şu alanları barındırır:
 *   id               — benzersiz tanımlayıcı
 *   key              — klavye kısayolu (Q / W / E / R / T)
 *   label            — Türkçe görüntü adı (HUD overlay'de gösterilir)
 *   weaponPriority   — aktif silah seçimi için öncelik listesi;
 *                      _resolveActiveWeapon bu sırada ilk eşleşeni seçer
 *   allowMelee       — false ise grup yakın dövüşe girmez
 *   retreatFromMelee — true ise yaklaşan düşmandan kaçınır (BattleSimulation okur)
 */

/** @typedef {{ id: string, key: string, label: string, weaponPriority: string[], allowMelee: boolean, retreatFromMelee: boolean }} TacticalOrder */

/** @type {Record<string, TacticalOrder>} */
export const TACTICAL_ORDERS = {
  hold_ranged: {
    id:               'hold_ranged',
    key:              'Q',
    label:            'Mesafeden Tut',
    weaponPriority:   [
      'bow', 'türk yayı', 'yay',
      'musket', 'tüfek',
      'cirit',
      'spear', 'mızrak',
      'sword', 'pala', 'yatagan',
    ],
    allowMelee:       false,
    retreatFromMelee: true,
  },

  prepare_melee: {
    id:               'prepare_melee',
    key:              'W',
    label:            'Yakın Savaşa Hazırlan',
    weaponPriority:   [
      'sword', 'pala', 'yatagan',
      'mızrak', 'spear',
      'axe', 'balta',
      'bow', 'türk yayı', 'musket',
    ],
    allowMelee:       true,
    retreatFromMelee: false,
  },

  free_fire: {
    id:               'free_fire',
    key:              'E',
    label:            'Serbest Ateş',
    weaponPriority:   [
      'bow', 'türk yayı', 'yay',
      'musket', 'tüfek',
      'cirit',
      'spear', 'mızrak',
      'sword', 'pala', 'yatagan',
    ],
    allowMelee:       true,
    retreatFromMelee: false,
  },

  shoot_and_retreat: {
    id:               'shoot_and_retreat',
    key:              'R',
    label:            'At-Geri Çekil',
    weaponPriority:   [
      'bow', 'türk yayı', 'yay',
      'cirit',
      'musket', 'tüfek',
      'spear', 'mızrak',
      'sword', 'pala',
    ],
    allowMelee:       false,
    retreatFromMelee: true,
  },

  anti_cavalry_spear: {
    id:               'anti_cavalry_spear',
    key:              'T',
    label:            'Süvari Karşıtı Mızrak',
    weaponPriority:   [
      'spear', 'mızrak', 'pike', 'pika',
      'sword', 'pala', 'yatagan',
      'axe', 'bow',
    ],
    allowMelee:       true,
    retreatFromMelee: false,
  },
};

/**
 * id'ye göre emir tanımını döndürür; bulunamazsa null.
 * @param {string} id
 * @returns {TacticalOrder|null}
 */
export function getOrder(id) {
  return TACTICAL_ORDERS[id] ?? null;
}

/**
 * Tanımlı tüm emirleri dizi olarak döndürür.
 * @returns {TacticalOrder[]}
 */
export function getAllOrders() {
  return Object.values(TACTICAL_ORDERS);
}
