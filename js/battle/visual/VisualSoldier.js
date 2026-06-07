import { getVisualProfile } from '../config/visualProfiles.js';
import { resolveAnimationKey } from './AnimationResolver.js';

/**
 * VisualSoldier — sahnedeki tek askerin sprite wrapper'ı.
 *
 * Kurallar:
 *  - Phaser.GameObjects.Sprite'ı EXTEND ETMEZ; içinde bir sprite tutar.
 *  - Pool tarafından acquire/release edilir; destroy() hiçbir zaman çağrılmaz.
 *  - Fallback texture (32×32 rect) BattleScene.preload() tarafından zaten
 *    üretilmiştir; VisualSoldier yeni texture yaratmaz.
 *  - Animasyon kaydı BattleScene._registerProfileAnimations() tarafından yapılır;
 *    VisualSoldier sadece oynatır.
 */
export class VisualSoldier {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;

    // Sprite ekran dışında, görünmez, pasif olarak başlar.
    this.sprite = scene.add.sprite(-1000, -1000, '__DEFAULT');
    this.sprite.setVisible(false);
    this.sprite.setActive(false);

    /** @type {object|null} Aktif VisualProfile */
    this._profile = null;
    /** @type {string|null} Aktif profil kimliği */
    this._profileId = null;
    /** @type {string|null} Son oynayan animasyon anahtarı */
    this._currentAnim = null;
  }

  // ── Pool arayüzü ───────────────────────────────────────────────────────────

  /**
   * Pool'dan alındığında çağrılır.
   * @param {string} profileId   VISUAL_PROFILES anahtarı
   * @param {number} x
   * @param {number} y
   */
  acquire(profileId, x, y) {
    const profile = getVisualProfile(profileId);
    if (!profile) {
      console.warn(`[VisualSoldier] Bilinmeyen profil "${profileId}" — tiny_warrior kullanılıyor`);
      this._profile   = getVisualProfile('tiny_warrior');
      this._profileId = 'tiny_warrior';
    } else {
      this._profile   = profile;
      this._profileId = profileId;
    }

    // Texture, scale, anchor
    this.sprite.setTexture(this._profile.atlasKey);
    this.sprite.setScale(this._profile.scale ?? 1.0);
    this.sprite.setOrigin(this._profile.anchorX ?? 0.5, this._profile.anchorY ?? 0.85);

    // Pozisyon
    this.sprite.setPosition(x, y);

    // Görünür ve aktif yap
    this.sprite.setVisible(true);
    this.sprite.setActive(true);

    this._currentAnim = null;

    // Idle animasyonuyla başla
    this.playAnimation('idle');
  }

  /**
   * Pool'a geri verildiğinde çağrılır. destroy() ÇAĞIRMAZ.
   */
  release() {
    this.sprite.setVisible(false);
    this.sprite.setActive(false);
    this.sprite.setPosition(-1000, -1000);

    if (this.sprite.anims) {
      this.sprite.anims.stop();
    }

    this._profile   = null;
    this._profileId = null;
    this._currentAnim = null;
  }

  // ── Hareket ───────────────────────────────────────────────────────────────

  /**
   * Anlık pozisyon set (tween ileride).
   * @param {number} x
   * @param {number} y
   */
  setPosition(x, y) {
    this.sprite.setPosition(x, y);
  }

  // ── Animasyon ─────────────────────────────────────────────────────────────

  /**
   * Animasyon çöz ve oynat.
   *
   * AnimationResolver.resolveAnimationKey üzerinden anim adı bulunur.
   * Aynı animasyon zaten oynuyorsa tekrar başlatılmaz.
   * Phaser'da kayıtlı değilse (fallback texture durumu) sessizce geçilir.
   *
   * @param {string}      action       "idle" | "walk" | "attack" | "death"
   * @param {string|null} activeWeapon  silah bazlı attack anim seçimi için
   */
  playAnimation(action, activeWeapon = null) {
    if (!this._profile) return;

    // AnimationResolver aracılığıyla gerçek Phaser anim key'ini bul
    const mockSoldier = { activeWeapon, visualProfileId: this._profileId };
    const animName    = resolveAnimationKey(mockSoldier, action, this._profile);
    if (!animName) return;

    // Zaten bu anim oynuyorsa tekrar başlatma
    if (this.sprite.anims?.currentAnim?.key === animName) return;

    // Phaser animasyon sistemi kayıtlı mı kontrol et
    if (this._scene.anims.exists(animName)) {
      this.sprite.play(animName, /* ignoreIfPlaying */ true);
    }
    // Kayıtlı değilse (fallback texture durumu) sessizce geç —
    // sprite görünür kalır, sadece animasyon oynamaz.

    this._currentAnim = animName;
  }

  // ── Gelecekte kullanılacak stub'lar ───────────────────────────────────────

  /** Seçili highlight (ileride implemente edilecek). */
  // eslint-disable-next-line no-unused-vars
  setSelected(_bool) {}

  /** Ölüm durumu (ileride implemente edilecek). */
  setDead() {}
}
