/**
 * FormationController — birlik slot pozisyonlarını hesaplayan saf matematik modülü.
 *
 * Kurallar:
 *  - Phaser import etmez.
 *  - UnitGroup veya SoldierInstance'ı import etmez; primitive parametreler alır.
 *  - getVisualProfile ile spacing'i okur, VisualSoldier.setPosition() ile uygular.
 */
import { getVisualProfile } from '../config/visualProfiles.js';

const DEFAULT_SPACING = 24;

// ── Slot hesaplama ────────────────────────────────────────────────────────────

/**
 * Bir formasyondaki tek slot'un dünya koordinatını hesaplar.
 *
 * "line"  — Tüm askerler aynı y'de, x boyunca merkez-hizalı yayılır.
 * "column" — Tüm askerler aynı x'de, y boyunca aşağı uzar.
 * "loose"  — 2'li sıra düzeni (cols=2).
 *
 * @param {number}            index          Birlik içindeki asker sırası (0-tabanlı)
 * @param {{x:number,y:number}} groupPosition Birliğin merkez dünya koordinatı
 * @param {string}            formationType  "line" | "column" | "loose"
 * @param {number}            spacing        Askerler arası piksel mesafesi
 * @param {number}            totalSlots     Birliğin toplam asker sayısı
 * @returns {{x:number, y:number}}
 */
function getSlotPosition(index, groupPosition, formationType, spacing, totalSlots) {
  switch (formationType) {
    case 'line': {
      // Merkez-hizalı: (totalSlots-1)/2 offset ile simetrik yayılım
      const x = groupPosition.x + (index - (totalSlots - 1) / 2) * spacing;
      return { x, y: groupPosition.y };
    }

    case 'column': {
      return {
        x: groupPosition.x,
        y: groupPosition.y + index * spacing,
      };
    }

    case 'loose': {
      const cols = 2;
      const col  = index % cols;
      const row  = Math.floor(index / cols);
      return {
        x: groupPosition.x + (col - 0.5) * spacing,
        y: groupPosition.y + row * spacing,
      };
    }

    default:
      console.warn(
        `[FormationController] Bilinmeyen formasyon tipi "${formationType}" — "line" kullanılıyor`,
      );
      return getSlotPosition(index, groupPosition, 'line', spacing, totalSlots);
  }
}

// ── Spacing hesaplama ─────────────────────────────────────────────────────────

/**
 * Birliğin ilk askerinin VisualProfile'ına göre ideal slot aralığını döndürür.
 * Atlı birliklerde 1.5× çarpan uygulanır.
 *
 * @param {{ soldiers: Array<{visualProfileId:string, bodyType:string}>, size:number }} unitGroup
 * @returns {number} Piksel cinsinden spacing
 */
function getFormationSpacing(unitGroup) {
  if (!unitGroup.soldiers || unitGroup.soldiers.length === 0) return DEFAULT_SPACING;

  const firstSoldier = unitGroup.soldiers[0];
  const profile = getVisualProfile(firstSoldier.visualProfileId);

  if (!profile) return DEFAULT_SPACING;

  const base = profile.formationSpacing ?? DEFAULT_SPACING;
  return firstSoldier.bodyType === 'mounted' ? base * 1.5 : base;
}

// ── Toplu pozisyon güncelleme ─────────────────────────────────────────────────

/**
 * Bir birliğin tüm VisualSoldier'larını formasyon slotlarına yerleştirir.
 * Şu an doğrudan setPosition — lerp Prompt 6'da gelecek.
 *
 * @param {{ soldiers:Array, position:{x:number,y:number}, formationType:string, size:number }} unitGroup
 * @param {Array<import('../visual/VisualSoldier.js').VisualSoldier|null>} visualSoldiers
 *   UnitGroup._visualSoldiers ile aynı liste (null olabilir — pool doluysa)
 */
function updateGroupPositions(unitGroup, visualSoldiers) {
  const spacing    = getFormationSpacing(unitGroup);
  const totalSlots = unitGroup.size;

  for (let i = 0; i < visualSoldiers.length; i++) {
    const vs = visualSoldiers[i];
    if (!vs) continue;

    const slot = getSlotPosition(
      i, unitGroup.position, unitGroup.formationType, spacing, totalSlots,
    );
    vs.setPosition(slot.x, slot.y);
  }
}

export { getSlotPosition, getFormationSpacing, updateGroupPositions };
