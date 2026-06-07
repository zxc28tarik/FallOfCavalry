/**
 * AnimationResolver — SoldierInstance state + activeWeapon → Phaser anim key çözümleyici.
 *
 * Pure functions — Phaser import etmez.
 * VisualSoldier veya SoldierInstance import etmez; parametre olarak alır.
 *
 * Dışa aktarılan API:
 *   resolveAnimationKey(soldier, action, profile) → string | null
 *   resolveAndPlay(visualSoldier, soldier, action) → void
 */

import { getVisualProfile } from '../config/visualProfiles.js';

// ── Silah → animasyon anahtar tablosu ────────────────────────────────────────

/**
 * activeWeapon string'ini standart animasyon anahtar adına çevirir.
 * Küçük harf karşılaştırması yapılır.
 */
const WEAPON_ANIM_MAP = {
  // Kılıç ailesi
  sword:      'sword_attack',
  pala:       'sword_attack',
  yatagan:    'sword_attack',
  'kılıç':    'sword_attack',
  // Mızrak ailesi
  spear:      'spear_attack',
  'kargı':    'spear_attack',
  'mızrak':   'spear_attack',
  // Yay ailesi
  bow:        'bow_attack',
  yay:        'bow_attack',
  'türk yayı':'bow_attack',
  // Balta ailesi
  axe:        'axe_attack',
  balta:      'axe_attack',
  aybalta:    'axe_attack',
  // Topuz ailesi
  mace:       'mace_attack',
  topuz:      'mace_attack',
  'gürz':     'mace_attack',
  'bozdoğan': 'mace_attack',
  // Ateşli silah ailesi
  musket:     'musket_attack',
  'tüfek':    'musket_attack',
};

/**
 * activeWeapon string'ini animasyon lookup anahtarına çevirir.
 * @param {string|null} activeWeapon
 * @returns {string}
 */
function _weaponToAnimKey(activeWeapon) {
  if (!activeWeapon) return 'melee_attack';
  return WEAPON_ANIM_MAP[activeWeapon.toLowerCase()] ?? 'melee_attack';
}

// ── Profile lookup yardımcısı ─────────────────────────────────────────────────

/**
 * profile.animations + profile.fallbackAnimations üzerinden anim adını bulur.
 * Zincir:
 *   1. profile.animations[key]
 *   2. profile.fallbackAnimations[key] → profile.animations[fallbackValue]
 *   3. null
 *
 * @param {object}      profile
 * @param {string}      key
 * @returns {string|null}
 */
function _resolveFromProfile(profile, key) {
  // 1. Doğrudan animations tablosuna bak
  const direct = profile.animations?.[key] ?? null;
  if (direct) return direct;

  // 2. Fallback tablosunda aranan key için alternatif key var mı?
  const fallbackKey = profile.fallbackAnimations?.[key] ?? null;
  if (fallbackKey) {
    const viaFallback = profile.animations?.[fallbackKey] ?? null;
    if (viaFallback) return viaFallback;
  }

  return null;
}

// ── Ana export fonksiyonlar ───────────────────────────────────────────────────

/**
 * Bir asker + eylem + profil üçlüsü için Phaser animasyon key'ini çözer.
 *
 * Hiçbir zaman throw etmez — çözüm bulunamazsa null döner.
 *
 * @param {{ activeWeapon: string|null, bodyType?: string, mountType?: string|null }} soldier
 * @param {"idle"|"walk"|"attack"|"death"} action
 * @param {object} profile  VisualProfile (getVisualProfile() sonucu)
 * @returns {string|null}
 */
export function resolveAnimationKey(soldier, action, profile) {
  if (!profile) return null;

  // ── Saldırı ─────────────────────────────────────────────────────────────
  if (action === 'attack') {
    const weaponKey = _weaponToAnimKey(soldier.activeWeapon);

    // Zincir: silah bazlı key → melee_attack → idle
    return (
      _resolveFromProfile(profile, weaponKey)
      ?? _resolveFromProfile(profile, 'melee_attack')
      ?? profile.animations?.idle
      ?? null
    );
  }

  // ── Ölüm ────────────────────────────────────────────────────────────────
  if (action === 'death') {
    return profile.animations?.death ?? null;
  }

  // ── Yürüyüş ─────────────────────────────────────────────────────────────
  if (action === 'walk') {
    const isMounted = profile.bodyType === 'mounted' || soldier.mountType != null;
    if (isMounted) {
      // Atlı birimler önce gallop, sonra walk, son çare idle
      return (
        profile.animations?.gallop
        ?? profile.animations?.walk
        ?? profile.animations?.idle
        ?? null
      );
    }
    return profile.animations?.walk ?? null;
  }

  // ── Boşta ───────────────────────────────────────────────────────────────
  if (action === 'idle') {
    return profile.animations?.idle ?? null;
  }

  return null;
}

/**
 * soldier.visualProfileId üzerinden profili alır, animasyon key'ini çözer ve oynatır.
 * Profil bulunamazsa veya key çözülemezse sessizce döner.
 *
 * @param {import('./VisualSoldier.js').VisualSoldier}                              visualSoldier
 * @param {{ visualProfileId: string, activeWeapon: string|null, bodyType?: string, mountType?: string|null }} soldier
 * @param {"idle"|"walk"|"attack"|"death"} action
 */
export function resolveAndPlay(visualSoldier, soldier, action) {
  const profile = getVisualProfile(soldier.visualProfileId);
  if (!profile) {
    console.warn(`[AnimationResolver] Profil bulunamadı: "${soldier.visualProfileId}"`);
    return;
  }

  const key = resolveAnimationKey(soldier, action, profile);
  if (!key) return;

  // VisualSoldier.playAnimation içeride key'i tekrar çözer;
  // buradaki amaç: null check ile gereksiz çağrıyı önlemek.
  visualSoldier.playAnimation(action, soldier.activeWeapon);
}
