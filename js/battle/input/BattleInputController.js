/**
 * BattleInputController — sol tık ile UnitGroup seçimi,
 * sağ tık ile hareket hedefi, frame başı lerp ile formasyon hareketi.
 *
 * Phaser'a bağımlıdır (input events, Graphics, time.delayedCall).
 * Saf JS mantığı (seçim, hareket hesabı) ayrı export fonksiyonlarda tutulur
 * ki birim testleri Phaser olmadan çalışabilsin.
 */
import * as FormationController from '../unit/FormationController.js';

// ── Saf yardımcı fonksiyonlar (Phaser bağımsız, export edilir) ────────────────

/**
 * Bir UnitGroup için tıklama seçim yarıçapını hesaplar.
 * Büyük grup = daha geniş seçim alanı.
 * @param {{ size: number }} group
 * @returns {number} piksel
 */
export function getSelectionRadius(group) {
  return 60 + group.size * 3;
}

/**
 * Verilen dünya koordinatına en yakın player UnitGroup'u bulur.
 * Birden fazla grup yarıçap içindeyse en yakın olanı döner.
 * Sadece side === "player" gruplar dikkate alınır.
 *
 * @param {Array<{side:string, position:{x:number,y:number}, size:number}>} unitGroups
 * @param {number} px  Dünya X
 * @param {number} py  Dünya Y
 * @returns {object|null}
 */
export function findNearestPlayerGroup(unitGroups, px, py) {
  let nearestGroup = null;
  let nearestDist  = Infinity;

  for (const group of unitGroups) {
    if (group.side !== 'player') continue;

    const dx     = px - group.position.x;
    const dy     = py - group.position.y;
    const dist   = Math.sqrt(dx * dx + dy * dy);
    const radius = getSelectionRadius(group);

    if (dist < radius && dist < nearestDist) {
      nearestDist  = dist;
      nearestGroup = group;
    }
  }

  return nearestGroup;
}

// ── Lerp (dahili yardımcı, export edilmez) ────────────────────────────────────

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ── BattleInputController ─────────────────────────────────────────────────────

export class BattleInputController {
  /**
   * @param {Phaser.Scene} scene
   * @param {Array}        unitGroups  UnitGroup[] — player + enemy
   */
  constructor(scene, unitGroups) {
    this._scene      = scene;
    this._unitGroups = unitGroups;

    /** @type {object|null} Seçili UnitGroup */
    this.selectedGroup = null;

    /** @type {Phaser.GameObjects.Graphics|null} Seçim halkası */
    this.selectionIndicator = null;

    // Sağ tıkta browser context menu'sü açmasın
    scene.game.canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Phaser pointer listener
    scene.input.on('pointerdown', this._onPointerDown, this);
  }

  // ── Input handlers ──────────────────────────────────────────────────────────

  /** @param {Phaser.Input.Pointer} pointer */
  _onPointerDown(pointer) {
    if (pointer.leftButtonDown()) {
      this._handleLeftClick(pointer.x, pointer.y);
    } else if (pointer.rightButtonDown()) {
      this._handleRightClick(pointer.x, pointer.y);
    }
  }

  _handleLeftClick(px, py) {
    const group = findNearestPlayerGroup(this._unitGroups, px, py);

    // Önceki seçim halkasını kaldır
    if (this.selectionIndicator) {
      this.selectionIndicator.destroy();
      this.selectionIndicator = null;
    }

    this.selectedGroup = group;

    if (group) {
      this._drawSelectionIndicator(group.position.x, group.position.y);
    }
  }

  _handleRightClick(px, py) {
    if (!this.selectedGroup) return;

    this.selectedGroup.targetPosition = { x: px, y: py };
    this._drawTargetMarker(px, py);
  }

  // ── Görsel ─────────────────────────────────────────────────────────────────

  /**
   * Seçili grubun merkezi etrafında yeşil daire çizer.
   * Daire Graphics nesnesinin local (0,0)'ında çizilir;
   * nesne setPosition ile taşınır.
   */
  _drawSelectionIndicator(x, y) {
    const gfx = this._scene.add.graphics();
    gfx.lineStyle(2, 0x00ff00, 1);
    gfx.strokeCircle(0, 0, 40);
    gfx.setPosition(x, y);
    this.selectionIndicator = gfx;
  }

  /**
   * Hedef noktada kırmızı X çizer, 500ms sonra yok olur.
   */
  _drawTargetMarker(x, y) {
    const gfx  = this._scene.add.graphics();
    const size = 8;
    gfx.lineStyle(2, 0xff0000, 1);
    gfx.lineBetween(-size, -size,  size,  size);
    gfx.lineBetween( size, -size, -size,  size);
    gfx.setPosition(x, y);

    this._scene.time.delayedCall(500, () => {
      gfx.destroy();
    });
  }

  // ── Frame güncellemesi ──────────────────────────────────────────────────────

  /**
   * Her frame çağrılır. Tüm grupları lerp ile targetPosition'a taşır,
   * ardından FormationController.updateGroupPositions ile askerleri günceller.
   *
   * @param {number} delta  ms cinsinden geçen süre (Phaser scene.update'in delta'sı)
   */
  update(delta) {
    const lerpFactor = 1 - Math.pow(0.01, delta / 1000);

    for (const group of this._unitGroups) {
      const dx   = group.targetPosition.x - group.position.x;
      const dy   = group.targetPosition.y - group.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 2) {
        group.position.x = lerp(group.position.x, group.targetPosition.x, lerpFactor);
        group.position.y = lerp(group.position.y, group.targetPosition.y, lerpFactor);
      } else if (dist > 0) {
        // Titreme önleme: hedefe yapış
        group.position.x = group.targetPosition.x;
        group.position.y = group.targetPosition.y;
      }

      // Askerleri güncel grup pozisyonuna taşı
      FormationController.updateGroupPositions(group, group._visualSoldiers);
    }

    // Seçim halkasını grup ile birlikte taşı
    if (this.selectionIndicator && this.selectedGroup) {
      this.selectionIndicator.setPosition(
        this.selectedGroup.position.x,
        this.selectedGroup.position.y,
      );
    }
  }

  // ── Temizlik ───────────────────────────────────────────────────────────────

  destroy() {
    if (this._scene?.input) {
      this._scene.input.off('pointerdown', this._onPointerDown, this);
    }
    if (this.selectionIndicator) {
      this.selectionIndicator.destroy();
      this.selectionIndicator = null;
    }
    this.selectedGroup = null;
    this._unitGroups   = null;
    this._scene        = null;
  }
}
