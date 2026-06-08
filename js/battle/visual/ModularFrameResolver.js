/**
 * ModularFrameResolver.js
 *
 * TexturePacker single-atlas içindeki frame adlarını bileşenlerinden üretir.
 * Katmanlı (modüler) karakter rendering altyapısının temel adresleme birimi.
 *
 * Frame adı yapısı:
 *   {layerId}/{action}/{direction}/{frameIndex:04d}.png
 *
 * Örnekler:
 *   body/walk/south/0000.png
 *   body/idle/east/0003.png
 *   helmet_tolga/walk/north_east/0012.png
 *   sword_01/attack_spear/south/0001.png
 *
 * Tasarım ilkeleri:
 *   - Phaser bağımlılığı yok. Saf veri dönüşüm modülü.
 *   - activeWeapon veya silah durumu bu katmana dahil edilmez;
 *     silah görselliği layerId ile ifade edilir (ör. 'sword_01').
 *   - direction ve action adları normalize edilmez — değişmeden yazılır.
 *     Gelecekte atlas değişirse adları burada değil atlas üretiminde değiştir.
 *   - layerId alanı visualEquipment slotlarıyla bire bir örtüşür.
 *
 * Public API:
 *   padFrameIndex(n)                  → '0003' | null
 *   resolveLayerFrame(params)         → 'body/walk/south/0003.png' | null
 *   resolveLayerFrameFromAtlas(params) → doğrulanmış frame adı | fallback | null
 */

// ── Frame index padding ───────────────────────────────────────────────────────

/**
 * Frame numarasını 4 haneli sıfır dolgulu stringe çevirir.
 * Float verilirse tam sayıya indirgenir (floor).
 *
 * @param {number} n  0-tabanlı, negatif olmayan tamsayı (veya float)
 * @returns {string|null}  '0000'–'9999'+ veya geçersiz girişte null
 *
 * @example
 *   padFrameIndex(0)   // '0000'
 *   padFrameIndex(3)   // '0003'
 *   padFrameIndex(12)  // '0012'
 *   padFrameIndex(1000)// '1000'
 */
export function padFrameIndex(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  return String(Math.floor(n)).padStart(4, '0');
}

// ── Temel frame adı üretimi ───────────────────────────────────────────────────

/**
 * Katman bileşenlerinden atlas frame adı üretir.
 * Atlas'ın gerçekten o frame'i içerip içermediğini doğrulamaz;
 * doğrulama için resolveLayerFrameFromAtlas kullan.
 *
 * @param {object} params
 * @param {string} params.layerId    Katman kimliği: 'body', 'helmet_tolga', 'sword_01' vb.
 *                                   visualEquipment slotlarıyla aynı isimlendirmeyi kullan.
 * @param {string} params.action     Animasyon eylemi: 'walk', 'idle', 'attack_spear' vb.
 * @param {string} params.direction  Yön: 'south', 'north_east' vb. — aynen korunur.
 * @param {number} params.frameIndex 0-tabanlı kare numarası.
 *
 * (Diğer alanlar —ör. activeWeapon— yoksayılır ve çıktıyı etkilemez.)
 *
 * @returns {string|null}  'layerId/action/direction/XXXX.png' veya geçersiz girişte null
 *
 * @example
 *   resolveLayerFrame({ layerId:'body', action:'walk', direction:'south', frameIndex:3 })
 *   // → 'body/walk/south/0003.png'
 */
export function resolveLayerFrame({ layerId, action, direction, frameIndex } = {}) {
  if (typeof layerId    !== 'string' || layerId.trim()    === '') return null;
  if (typeof action     !== 'string' || action.trim()     === '') return null;
  if (typeof direction  !== 'string' || direction.trim()  === '') return null;

  const pad = padFrameIndex(frameIndex);
  if (pad === null) return null;

  return `${layerId}/${action}/${direction}/${pad}.png`;
}

// ── Atlas doğrulamalı çözümleme ───────────────────────────────────────────────

/**
 * resolveLayerFrame'i çağırdıktan sonra sonucu frameNames listesinde arar.
 *
 * Tam frame bulunamazsa aynı layerId/action/direction'ın 0. karesine (fallback)
 * düşer; o da yoksa null döner.
 *
 * frameNames sağlanmazsa doğrulama yapılmaz ve üretilen ad aynen döner
 * (test ortamı veya atlas henüz yüklenmediyse kullanılır).
 *
 * @param {object}   params
 * @param {string}   params.layerId
 * @param {string}   params.action
 * @param {string}   params.direction
 * @param {number}   params.frameIndex
 * @param {string[]} [params.frameNames]  Atlas'taki tüm frame adları (opsiyonel)
 * @returns {string|null}
 *
 * @example
 *   resolveLayerFrameFromAtlas({
 *     layerId:'body', action:'walk', direction:'south', frameIndex:99,
 *     frameNames: ['body/walk/south/0000.png', 'body/walk/south/0001.png'],
 *   })
 *   // → 'body/walk/south/0000.png'  (fallback: frame 0)
 */
export function resolveLayerFrameFromAtlas({ layerId, action, direction, frameIndex, frameNames } = {}) {
  const candidate = resolveLayerFrame({ layerId, action, direction, frameIndex });
  if (candidate === null) return null;

  // frameNames yoksa doğrulama yapma
  if (!Array.isArray(frameNames)) return candidate;

  if (frameNames.includes(candidate)) return candidate;

  // Fallback: aynı katman/eylem/yönün ilk karesi
  if (frameIndex !== 0) {
    const fallback = resolveLayerFrame({ layerId, action, direction, frameIndex: 0 });
    if (fallback !== null && frameNames.includes(fallback)) return fallback;
  }

  return null;
}
