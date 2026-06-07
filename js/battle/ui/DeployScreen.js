/**
 * DeployScreen — savaş başlamadan önce oyuncunun sektör sayısını
 * ve grup atamalarını yapılandırdığı ekran.
 *
 * Saf mantık (testable):
 *   selectedSectorCount, assignments Map, clamp, validate
 *
 * Phaser-bağımlı kısım:
 *   _buildUI() → Graphics, Text, Container, interactive
 *
 * Kural: SectorManager/UnitGroup import etmez — referanslar constructor'dan gelir.
 *        Phaser import etmez — scene.add.* / scene.input.* ile çalışır.
 */

const SECTOR_SOLDIER_LIMIT = 150;

export class DeployScreen {
  /**
   * @param {Phaser.Scene}                                          scene
   * @param {import('../sector/SectorManager.js').SectorManager}   sectorManager
   * @param {import('../unit/UnitGroup.js').UnitGroup[]}            playerGroups
   * @param {(sectorCount: number, assignments: Map) => void}       onDeployConfirmed
   */
  constructor(scene, sectorManager, playerGroups, onDeployConfirmed) {
    this.scene              = scene;
    this.sectorManager      = sectorManager;
    this.playerGroups       = playerGroups;
    this.onDeployConfirmed  = onDeployConfirmed;

    /** Kullanıcının seçtiği sektör sayısı. Başlangıç: önerilen değer. */
    this.selectedSectorCount = sectorManager.recommendedCount;

    /**
     * Her grubun atandığı sektör indeksi.
     * Map<groupId: string, sectorIndex: number>
     */
    this.assignments = new Map();

    /** @type {Phaser.GameObjects.Container|null} */
    this._container = null;

    this._visible = false;

    // Round-robin başlangıç atamaları
    this._initAssignments();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** UI'ı oluşturur ve gösterir. */
  show() {
    this._visible = true;
    this._buildUI();
  }

  /** UI container'ı yok eder. */
  hide() {
    this._container?.destroy();
    this._container = null;
    this._visible   = false;
  }

  // ── Saf mantık (Phaser bağımsız, test edilebilir) ──────────────────────────

  /** Sektör sayısını bir azaltır — minAllowed sınırını geçmez. */
  _tryDecrementSectorCount() {
    if (this.selectedSectorCount <= this.sectorManager.minAllowed) return;
    this.selectedSectorCount--;
    this._clampAssignments();
    this._refreshUI();
  }

  /** Sektör sayısını bir artırır — maxAllowed sınırını geçmez. */
  _tryIncrementSectorCount() {
    if (this.selectedSectorCount >= this.sectorManager.maxAllowed) return;
    this.selectedSectorCount++;
    this._refreshUI();
  }

  /**
   * Bir grubun atandığı sektörü direction kadar ileri/geri taşır.
   * [0, selectedSectorCount-1] sınırlarını aşamaz.
   * @param {string} groupId
   * @param {number} direction  +1 veya -1
   */
  _adjustGroupSector(groupId, direction) {
    const current = this.assignments.get(groupId) ?? 0;
    const next    = current + direction;
    if (next < 0 || next >= this.selectedSectorCount) return;
    this.assignments.set(groupId, next);
    this._refreshUI();
  }

  /**
   * Grupları selectedSectorCount'a göre round-robin atar.
   * Her sektör sayısı değişikliğinde veya başlangıçta çağrılır.
   */
  _initAssignments() {
    const count = Math.max(this.selectedSectorCount, 1);
    this.playerGroups.forEach((group, i) => {
      this.assignments.set(group.id, i % count);
    });
  }

  /**
   * selectedSectorCount azaldığında, sınırı aşan atamalar son sektöre çekilir.
   * Kullanıcının geçerli atamaları korunur.
   */
  _clampAssignments() {
    const max = this.selectedSectorCount - 1;
    for (const [groupId, sectorIdx] of this.assignments) {
      if (sectorIdx > max) {
        this.assignments.set(groupId, max);
      }
    }
  }

  /**
   * Belirli sektöre atanmış oyuncu asker sayısını döner.
   * group.soldiers.length kullanılır (deploy anında alive kontrolü gerekmez).
   * @param {number} sectorIndex
   * @returns {number}
   */
  _getSectorSoldierCount(sectorIndex) {
    let total = 0;
    for (const [groupId, idx] of this.assignments) {
      if (idx === sectorIndex) {
        const group = this.playerGroups.find(g => g.id === groupId);
        if (group) total += group.soldiers.length;
      }
    }
    return total;
  }

  /**
   * Hiçbir sektör SECTOR_SOLDIER_LIMIT'i aşmıyorsa true döner.
   * @returns {boolean}
   */
  _validateSectors() {
    for (let i = 0; i < this.selectedSectorCount; i++) {
      if (this._getSectorSoldierCount(i) > SECTOR_SOLDIER_LIMIT) return false;
    }
    return true;
  }

  /**
   * Doğrulamayı geçerse onDeployConfirmed'ı çağırır ve ekranı kapatır.
   * Geçemezse uyarı gösterir.
   */
  _confirmDeploy() {
    if (!this._validateSectors()) {
      if (this._visible) {
        this._showWarning(
          `Her sektörde en fazla ${SECTOR_SOLDIER_LIMIT} oyuncu askeri olabilir!`,
        );
      }
      return;
    }
    this.onDeployConfirmed(this.selectedSectorCount, this.assignments);
    this.hide();
  }

  // ── UI (Phaser bağımlı) ────────────────────────────────────────────────────

  /**
   * Container'ı yeniden oluşturur.
   * Sektör sayısı veya atama değiştiğinde çağrılır.
   * _visible === false ise hiçbir şey yapmaz.
   */
  _refreshUI() {
    if (!this._visible) return;
    this._container?.destroy();
    this._container = null;
    this._buildUI();
  }

  /** Tüm UI elemanlarını oluşturur. show() ve _refreshUI() tarafından çağrılır. */
  _buildUI() {
    const container = this.scene.add.container(0, 0);
    this._container = container;

    this._buildBackground(container);
    this._buildTitle(container);
    this._buildSectorSelector(container);
    this._buildGroupList(container);
    this._buildSectorSummary(container);
    this._buildStartButton(container);
  }

  _buildBackground(container) {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 1280, 720);
    container.add(bg);
  }

  _buildTitle(container) {
    const title = this.scene.add.text(640, 50, 'SAVAŞ DÜZENİ', {
      fontFamily: 'serif',
      fontSize:   '44px',
      color:      '#ffffff',
      fontStyle:  'bold',
    }).setOrigin(0.5, 0);
    container.add(title);
  }

  _buildSectorSelector(container) {
    const { scene } = this;

    // ◄ butonu
    const decBtn = scene.add.text(520, 118, '◄', {
      fontFamily: 'monospace',
      fontSize:   '36px',
      color:      '#ffcc00',
    }).setInteractive({ useHandCursor: true });
    decBtn.on('pointerup', () => this._tryDecrementSectorCount());
    decBtn.on('pointerover', () => decBtn.setColor('#ffee88'));
    decBtn.on('pointerout',  () => decBtn.setColor('#ffcc00'));

    // Sektör sayısı metni
    const countText = scene.add.text(640, 118, `Sektör: ${this.selectedSectorCount}`, {
      fontFamily: 'monospace',
      fontSize:   '30px',
      color:      '#ffffff',
    }).setOrigin(0.5, 0);

    // ► butonu
    const incBtn = scene.add.text(760, 118, '►', {
      fontFamily: 'monospace',
      fontSize:   '36px',
      color:      '#ffcc00',
    }).setInteractive({ useHandCursor: true });
    incBtn.on('pointerup', () => this._tryIncrementSectorCount());
    incBtn.on('pointerover', () => incBtn.setColor('#ffee88'));
    incBtn.on('pointerout',  () => incBtn.setColor('#ffcc00'));

    // Bilgi satırı
    const info = scene.add.text(640, 164,
      `Önerilen: ${this.sectorManager.recommendedCount}  |  ` +
      `İzin verilen: ${this.sectorManager.minAllowed} - ${this.sectorManager.maxAllowed}`,
      { fontFamily: 'monospace', fontSize: '15px', color: '#aaaaaa' },
    ).setOrigin(0.5, 0);

    container.add([decBtn, countText, incBtn, info]);
  }

  _buildGroupList(container) {
    const { scene } = this;

    const hdr = scene.add.text(640, 208, '── GRUP ATAMALARI ──', {
      fontFamily: 'monospace', fontSize: '17px', color: '#88ddff',
    }).setOrigin(0.5, 0);
    container.add(hdr);

    this.playerGroups.forEach((group, rowIdx) => {
      const y          = 242 + rowIdx * 38;
      const sectorIdx  = this.assignments.get(group.id) ?? 0;

      const label = scene.add.text(250, y,
        `${group.id}  (${group.soldiers.length} asker)`,
        { fontFamily: 'monospace', fontSize: '15px', color: '#dddddd' },
      );

      const arrow = scene.add.text(580, y,
        `→  Sektör ${sectorIdx + 1}`,
        { fontFamily: 'monospace', fontSize: '15px', color: '#ffff88' },
      );

      const prevBtn = scene.add.text(740, y, '◄', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffcc00',
      }).setInteractive({ useHandCursor: true });
      prevBtn.on('pointerup', () => this._adjustGroupSector(group.id, -1));

      const nextBtn = scene.add.text(784, y, '►', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffcc00',
      }).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerup', () => this._adjustGroupSector(group.id, +1));

      container.add([label, arrow, prevBtn, nextBtn]);
    });
  }

  _buildSectorSummary(container) {
    const { scene } = this;
    const listBottom = 242 + this.playerGroups.length * 38 + 16;

    const hdr = scene.add.text(640, listBottom, '── SEKTÖR ÖZETİ ──', {
      fontFamily: 'monospace', fontSize: '17px', color: '#88ddff',
    }).setOrigin(0.5, 0);
    container.add(hdr);

    let xOff = 200;
    for (let i = 0; i < this.selectedSectorCount; i++) {
      const count = this._getSectorSoldierCount(i);
      const over  = count > SECTOR_SOLDIER_LIMIT;
      const t = scene.add.text(xOff, listBottom + 28,
        `Sektör ${i + 1}: ${count} asker`,
        { fontFamily: 'monospace', fontSize: '14px', color: over ? '#ff4444' : '#aaffaa' },
      );
      container.add(t);
      xOff += 220;
    }
  }

  _buildStartButton(container) {
    const { scene } = this;
    const btn = scene.add.text(1090, 660, '[ SAVAŞI BAŞLAT ]', {
      fontFamily:      'monospace',
      fontSize:        '22px',
      color:           '#22ff22',
      fontStyle:       'bold',
      backgroundColor: '#0a2a0a',
      padding:         { x: 20, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setColor('#88ff88'));
    btn.on('pointerout',  () => btn.setColor('#22ff22'));
    btn.on('pointerup',   () => this._confirmDeploy());

    container.add(btn);
  }

  /**
   * Doğrulama hatası için kısa uyarı metni ekler.
   * @param {string} message
   */
  _showWarning(message) {
    if (!this._container) return;
    const t = this.scene.add.text(640, 598, `⚠  ${message}`, {
      fontFamily: 'monospace', fontSize: '17px', color: '#ff4444',
    }).setOrigin(0.5);
    this._container.add(t);
  }
}
