/**
 * ProjectileManager — ranged saldırılarda görseli hedefe taşıyan sistem.
 *
 * Tüm projectile'lar tek bir Phaser.Graphics objesi üzerine çizilir.
 * Gerçek sprite atlas yokken renkli nokta/çizgi placeholder kullanılır.
 * Atlas eklenince Prompt 9+ sonrasında sprite yoluna geçilebilir.
 *
 * Kural: Phaser sınıflarını extend etmez.
 *        getWeaponVisualProfile üzerinden veri alır.
 */

import { getWeaponVisualProfile } from '../config/weaponVisualProfiles.js';

// ── Renk sabitleri ────────────────────────────────────────────────────────────

const COLOR_WHITE  = 0xffffff;
const COLOR_YELLOW = 0xffff00;
const COLOR_ORANGE = 0xff8800;
const COLOR_GRAY   = 0x888888;

/** weaponId'ye göre placeholder projectile rengi. */
function _colorForWeapon(weaponId) {
  if (!weaponId) return COLOR_WHITE;
  const id = weaponId.toLowerCase();
  if (id === 'bow' || id === 'yay' || id === 'türk yayı') return COLOR_YELLOW;
  if (id === 'cirit') return COLOR_ORANGE;
  return COLOR_WHITE;
}

// ── ProjectileManager ─────────────────────────────────────────────────────────

export class ProjectileManager {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;

    /** @type {object[]} Uçan projectile listesi */
    this._active = [];

    /**
     * Tüm projectile'lar tek Graphics'e çizilir.
     * Her frame: clear → hepsini yeniden çiz.
     */
    this._graphics = scene.add.graphics();
  }

  // ── Güncelleme döngüsü ────────────────────────────────────────────────────

  /**
   * BattleSimulation.update() tarafından her frame çağrılır.
   * @param {number} delta  ms
   */
  update(delta) {
    const dt = delta / 1000;
    const now = this.scene.time.now;

    // Pozisyon ilerlet ve çıkarılacakları işaretle
    const toRemove = [];

    for (const proj of this._active) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      const dx   = proj.targetX - proj.x;
      const dy   = proj.targetY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8) {
        proj.onHit();
        toRemove.push(proj);
      } else if (now - proj.born > proj.maxLifetime) {
        // Sessizce kaldır — hasar verme
        toRemove.push(proj);
      }
    }

    // Çıkart (döngü dışında, splice güvenli)
    for (const proj of toRemove) {
      const idx = this._active.indexOf(proj);
      if (idx !== -1) this._active.splice(idx, 1);
    }

    // Graphics'i temizle ve kalan projectile'ları yeniden çiz
    this._graphics.clear();
    for (const proj of this._active) {
      this._drawProjectile(proj, getWeaponVisualProfile(proj.weaponId));
    }
  }

  // ── Ateşleme ─────────────────────────────────────────────────────────────

  /**
   * Yeni bir projectile oluşturur veya instant-hit ise anında hasar verir.
   *
   * @param {number}   fromX
   * @param {number}   fromY
   * @param {number}   toX
   * @param {number}   toY
   * @param {string}   weaponId
   * @param {Function} onHit   Projectile hedefe ulaşınca veya instant hit'te çağrılır
   */
  fireProjectile(fromX, fromY, toX, toY, weaponId, onHit) {
    const profile = getWeaponVisualProfile(weaponId);

    // Profil yoksa → anında hasar
    if (!profile) {
      onHit();
      return;
    }

    // instantHit silah (musket, tabanca) → muzzle flash + anında hasar
    if (profile.instantHit) {
      this._showMuzzleFlash(fromX, fromY, profile);
      onHit();
      return;
    }

    // Spawn offset uygula
    const spawnX = fromX + (profile.spawnOffset?.x ?? 0);
    const spawnY = fromY + (profile.spawnOffset?.y ?? 0);

    // Yön vektörü hesapla
    const dx   = toX - spawnX;
    const dy   = toY - spawnY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = profile.speed ?? 400;

    // Sıfır mesafede güvenlik
    const vx = dist > 0 ? (dx / dist) * speed : speed;
    const vy = dist > 0 ? (dy / dist) * speed : 0;

    this._active.push({
      x:           spawnX,
      y:           spawnY,
      targetX:     toX,
      targetY:     toY,
      vx,
      vy,
      speed,
      scale:       profile.scale ?? 0.8,
      weaponId,
      onHit,
      born:        this.scene.time.now,
      maxLifetime: 3000,
    });
  }

  // ── Çizim ─────────────────────────────────────────────────────────────────

  /**
   * Tek bir projectile'ı ana Graphics üzerine çizer.
   * Bu metod update() döngüsü içinde çağrılır — Graphics önceden clear edilmiştir.
   *
   * @param {object}      proj
   * @param {object|null} profile  WeaponVisualProfile veya null
   */
  _drawProjectile(proj, profile) {
    const color = _colorForWeapon(proj.weaponId);

    // Yön göstergeli çizgi (ok, cirit)
    if (profile?.rotationMode === 'face_direction') {
      const angle  = Math.atan2(proj.vy, proj.vx);
      const length = 8;
      const x2     = proj.x + Math.cos(angle) * length;
      const y2     = proj.y + Math.sin(angle) * length;

      this._graphics.lineStyle(2, color, 1);
      this._graphics.lineBetween(proj.x, proj.y, x2, y2);
      return;
    }

    // Renkli nokta (genel fallback)
    const radius = proj.weaponId === 'cirit' ? 4 : 3;
    this._graphics.fillStyle(color, 1);
    this._graphics.fillCircle(proj.x, proj.y, radius);
  }

  // ── Muzzle flash ──────────────────────────────────────────────────────────

  /**
   * Instant-hit silahlar için anlık görsel efekt.
   * Ayrı Graphics objesi — projectile döngüsünden bağımsız yaşar.
   *
   * @param {number} x
   * @param {number} y
   * @param {object} profile  WeaponVisualProfile
   */
  _showMuzzleFlash(x, y, profile) {
    // Beyaz/sarı parlama
    const flashGfx = this.scene.add.graphics();
    flashGfx.fillStyle(0xffffaa, 0.8);
    flashGfx.fillCircle(x, y, 12);

    this.scene.time.delayedCall(120, () => {
      flashGfx.destroy();
    });

    // Duman — varsa
    if (profile?.smoke) {
      const smokeGfx = this.scene.add.graphics();
      smokeGfx.fillStyle(COLOR_GRAY, 0.5);
      smokeGfx.fillCircle(
        x + (profile.spawnOffset?.x ?? 0),
        y + (profile.spawnOffset?.y ?? 0),
        8,
      );

      this.scene.time.delayedCall(300, () => {
        smokeGfx.destroy();
      });
    }
  }

  // ── Temizlik ──────────────────────────────────────────────────────────────

  destroy() {
    this._graphics.destroy();
    this._active = [];
  }
}
