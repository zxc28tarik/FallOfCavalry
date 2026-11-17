import Phaser from 'phaser';
import { BattleManager } from './core/BattleManager.js';
import { BattleSimulation } from './core/BattleSimulation.js';
import { SectorManager } from './sector/SectorManager.js';
import { SectorRenderer } from './sector/SectorRenderer.js';
import { DeployScreen } from './ui/DeployScreen.js';
import { VISUAL_PROFILES } from './config/visualProfiles.js';
import { VisualSoldierPool } from './visual/VisualSoldierPool.js';
import { createTestBattleData } from './data/testBattleData.js';
import * as FormationController from './unit/FormationController.js';
import { BattleInputController } from './input/BattleInputController.js';
import { TacticalOrderController } from './input/TacticalOrderController.js';
import { createBattleData, extractBattleResult } from './BattleAdapter.js';

// ── Pending army data (BattleBoot.launchBattle → BattleScene.create köprüsü) ─
// Modül-düzeyinde saklanır; create() bir kez okuyup temizler.
let _pendingArmyData = null;

/**
 * Ana oyundan savaş başlatmadan önce ordu verisini ayarlar.
 * BattleBoot.launchBattle() tarafından çağrılır.
 * @param {{ attackerArmy: object, defenderArmy: object }|null} data
 */
export function setPendingArmyData(data) {
  _pendingArmyData = data;
}

// Distinct placeholder tint per profile so they're visually distinguishable
const FALLBACK_COLORS = {
  tiny_warrior:               0x8b7355,
  tiny_lancer:                0x5a7a8a,
  tiny_archer:                0x6b8b3a,
  mounted_knight_placeholder: 0x8b6090,
};
const DEFAULT_FALLBACK_COLOR = 0x888888;

export class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
    this.battleManager     = null;
    this.visualSoldierPool = null;
    /** @type {import('./unit/UnitGroup.js').UnitGroup[]} */
    this._unitGroups       = [];
    this.inputController   = null;
    this.simulation        = null;
    /** @type {SectorManager|null} */
    this.sectorManager     = null;
    /** @type {SectorRenderer|null} */
    this.sectorRenderer    = null;
    /** @type {DeployScreen|null} */
    this.deployScreen      = null;
    /** @type {TacticalOrderController|null} */
    this.tacticalController = null;
    /** true olduğunda battle loop aktif, deploy ekranı kapalı */
    this._battleStarted    = false;
    this.fpsText           = null;
    this.debugLabel        = null;
    this._profileInfoText  = null;
    this._poolInfoText     = null;
    this._sectorInfoText   = null;
    /** Seçili grubun aktif emrini gösteren overlay metni */
    this._orderInfoText    = null;
    /** Sektör geçiş tuşları — [ önceki, ] sonraki */
    this._keyPrevSector    = null;
    this._keyNextSector    = null;
    /** @type {Set<string>} */
    this._failedAtlasKeys  = new Set();
    /** @type {Object<string, 'pending'|'disk'|'fallback'>} */
    this._assetLoadStatus  = {};
  }

  preload() {
    const seen = new Set();
    for (const profile of Object.values(VISUAL_PROFILES)) {
      if (seen.has(profile.atlasKey)) continue;
      seen.add(profile.atlasKey);
      this._assetLoadStatus[profile.atlasKey] = 'pending';
    }

    this.load.on('loaderror', (file) => {
      if (Object.prototype.hasOwnProperty.call(this._assetLoadStatus, file.key)) {
        this._failedAtlasKeys.add(file.key);
      }
    });

    for (const atlasKey of Object.keys(this._assetLoadStatus)) {
      this.load.atlas(
        atlasKey,
        `assets/battle/${atlasKey}.png`,
        `assets/battle/${atlasKey}.json`,
      );
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // ── Asset resolution ───────────────────────────────────────────────────
    let diskCount     = 0;
    let fallbackCount = 0;

    for (const atlasKey of Object.keys(this._assetLoadStatus)) {
      const loadedFromDisk =
        !this._failedAtlasKeys.has(atlasKey) && this.textures.exists(atlasKey);

      if (loadedFromDisk) {
        this._assetLoadStatus[atlasKey] = 'disk';
        diskCount++;
        console.info(`[BattleScene] Atlas loaded from disk: "${atlasKey}"`);
      } else {
        this._generateFallbackTexture(atlasKey);
        this._assetLoadStatus[atlasKey] = 'fallback';
        fallbackCount++;
        console.info(`[BattleScene] Fallback texture generated for atlas "${atlasKey}"`);
      }
    }

    // ── Core systems ───────────────────────────────────────────────────────
    this.battleManager = new BattleManager(this);

    // ── Animation registration ─────────────────────────────────────────────
    for (const profile of Object.values(VISUAL_PROFILES)) {
      this._registerProfileAnimations(profile);
    }

    // ── VisualSoldierPool ─────────────────────────────────────────────────
    this.visualSoldierPool = new VisualSoldierPool(this, 350);

    // ── Savaş verisi: ana oyundan (armyData) veya test verisi ────────────────
    const armyData = _pendingArmyData;
    _pendingArmyData = null;   // tüket — bir daha okunmasın

    let playerGroups, enemyGroups;
    if (armyData) {
      ({ playerGroups, enemyGroups } = createBattleData(
        armyData.attackerArmy,
        armyData.defenderArmy,
      ));
      console.info('[BattleScene] Ordu verisi BattleAdapter\'dan yüklendi.');
    } else {
      ({ playerGroups, enemyGroups } = createTestBattleData());
      console.info('[BattleScene] Test savaş verisi kullanılıyor.');
    }

    this._unitGroups = [...playerGroups, ...enemyGroups];
    const totalSoldiers = this._unitGroups.reduce((sum, g) => sum + g.size, 0);

    // ── Debug overlay ──────────────────────────────────────────────────────
    this.fpsText = this.add.text(12, 12, 'FPS: --', {
      fontFamily: 'monospace', fontSize: '14px', color: '#00ff88',
    });

    this.debugLabel = this.add.text(12, 32, 'Battle Mode — OK', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
    });

    const profileCount = Object.keys(VISUAL_PROFILES).length;
    this._profileInfoText = this.add.text(12, 52,
      `Profiles: ${profileCount}  |  Disk: ${diskCount}  |  Fallback: ${fallbackCount}`,
      { fontFamily: 'monospace', fontSize: '13px', color: '#aaaaff' },
    );

    this._poolInfoText = this.add.text(12, 68,
      `Groups: ${this._unitGroups.length}  |  Soldiers: ${totalSoldiers}  |  Pool: ${this.visualSoldierPool.capacity}`,
      { fontFamily: 'monospace', fontSize: '13px', color: '#ffcc66' },
    );

    this._sectorInfoText = this.add.text(12, 84,
      'Sector: -- | P:-- E:--',
      { fontFamily: 'monospace', fontSize: '13px', color: '#88ddff' },
    );

    this._orderInfoText = this.add.text(12, 100, 'Emir: Yok  [Q/W/E/R/T]', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffaa44',
    });

    // ── Input controller ──────────────────────────────────────────────────
    this.inputController = new BattleInputController(this, this._unitGroups);

    // ── Sektör geçiş tuşları ──────────────────────────────────────────────
    this._keyPrevSector = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET,
    );
    this._keyNextSector = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET,
    );

    // ── F10: ModularSoldierVisualTest debug sahnesi aç/kapat ─────────────
    // SoldierContainer + SoldierContainerPool + ModularFrameResolver pipeline debug.
    // BattleScene çalışmaya devam eder; debug sahne overlay olarak bindirilir.
    this.input.keyboard.on('keydown-F10', () => {
      if (!this.scene.get('ModularSoldierVisualTest')) return;
      if (this.scene.isActive('ModularSoldierVisualTest')) {
        this.scene.stop('ModularSoldierVisualTest');
        console.info('[BattleScene] ModularSoldierVisualTest kapatıldı');
      } else {
        this.scene.launch('ModularSoldierVisualTest');
        console.info('[BattleScene] ModularSoldierVisualTest başlatıldı — ESC/F10 ile kapat');
      }
    });

    // ── F11: LayerStressTest debug sahnesi aç/kapat ───────────────────────
    // BattleScene çalışmaya devam eder; stress test overlay olarak bindirilir.
    this.input.keyboard.on('keydown-F11', () => {
      if (!this.scene.get('LayerStressTest')) return; // kayıtlı değilse sessizce çık
      if (this.scene.isActive('LayerStressTest')) {
        this.scene.stop('LayerStressTest');
        console.info('[BattleScene] LayerStressTest kapatıldı');
      } else {
        this.scene.launch('LayerStressTest');
        console.info('[BattleScene] LayerStressTest başlatıldı — ESC/F11 ile kapat');
      }
    });

    // ── SectorManager (initSectors henüz çağrılmaz) ───────────────────────
    this.sectorManager = new SectorManager(totalSoldiers);

    // ── SectorRenderer (mountSector henüz çağrılmaz) ──────────────────────
    this.sectorRenderer = new SectorRenderer(
      this,
      this.visualSoldierPool,
      this.sectorManager,
    );

    // ── DeployScreen — savaş başlamadan önce kullanıcıya gösterilir ────────
    // BattleSimulation, _onDeployConfirmed içinde onBattleComplete callback ile oluşturulur.
    this.deployScreen = new DeployScreen(
      this,
      this.sectorManager,
      playerGroups,
      (sectorCount, assignments) => {
        this._onDeployConfirmed(sectorCount, assignments);
      },
    );
    this.deployScreen.show();
  }

  /**
   * Deploy ekranı onaylandığında çağrılır.
   * Sektörleri kullanıcının atamasına göre kurar ve savaşı başlatır.
   *
   * @param {number}              sectorCount
   * @param {Map<string, number>} assignments  groupId → sectorIndex
   */
  _onDeployConfirmed(sectorCount, assignments) {
    const playerGroups = this._unitGroups.filter(g => g.side === 'player');
    const enemyGroups  = this._unitGroups.filter(g => g.side === 'enemy');

    // Sektör nesnelerini oluştur (boş gruplarla)
    this.sectorManager.initSectors(sectorCount, [], []);

    // Oyuncu gruplarını kullanıcının seçimine göre ata
    for (let i = 0; i < sectorCount; i++) {
      this.sectorManager.sectors[i].playerUnitGroups = playerGroups
        .filter(g => assignments.get(g.id) === i);
    }

    // Düşman grupları round-robin
    enemyGroups.forEach((g, i) => {
      this.sectorManager.sectors[i % sectorCount].enemyUnitGroups.push(g);
    });

    console.info(
      `SectorManager: ${sectorCount} sektör | ` +
      `recommended=${this.sectorManager.recommendedCount} | ` +
      `allowed=${this.sectorManager.minAllowed}-${this.sectorManager.maxAllowed}`,
    );

    // Aktif sektörü görsel olarak kur
    this.sectorRenderer.mountSector(this.sectorManager.activeSectorId);

    // BattleSimulation — onBattleComplete callback'li olarak burada oluşturulur
    const pg = this._unitGroups.filter(g => g.side === 'player');
    const eg = this._unitGroups.filter(g => g.side === 'enemy');
    this.simulation = new BattleSimulation(
      this,
      pg,
      eg,
      this.sectorManager,
      () => this._onBattleComplete(),
    );
    this.simulation.start();

    // Taktik emir kontrolcüsü — Q/W/E/R/T tuşlarını dinler
    this.tacticalController = new TacticalOrderController(
      this,
      () => this.inputController?.selectedGroup ?? null,
    );

    this._battleStarted = true;
  }

  /**
   * BattleSimulation._checkVictory tarafından çağrılır.
   * Sonucu konsola yazar ve ana oyuna 'battleComplete' eventi gönderir.
   *
   */
  _onBattleComplete() {
    if (!this.sectorManager) return;

    const result = extractBattleResult(this.sectorManager);

    console.info(
      '[Battle] Sonuç:\n' + JSON.stringify(result, null, 2),
    );
    console.info(
      '// Ana oyundan çağrı:\n' +
      '// import { launchBattle } from \'./battle/BattleBoot.js\';\n' +
      '// launchBattle({ attackerArmy, defenderArmy });\n' +
      '//\n' +
      '// Sonuç dinleme:\n' +
      '// window.addEventListener(\'battleComplete\', (e) => {\n' +
      '//   const result = e.detail;\n' +
      '//   applyBattleResult(attackerArmy, defenderArmy, result);\n' +
      '// });',
    );

    window.dispatchEvent(
      new CustomEvent('battleComplete', { detail: result }),
    );
  }

  update(time, delta) {
    // Deploy ekranı açıkken battle loop çalışmaz
    if (!this._battleStarted) return;

    this.battleManager?.update(time, delta);
    this.inputController?.update(delta);
    this.simulation?.update(delta, time);
    this.sectorManager?.simulatePassiveSectors(time);

    // ── Sektör geçiş tuşları ──────────────────────────────────────────────
    if (this._keyPrevSector && Phaser.Input.Keyboard.JustDown(this._keyPrevSector)) {
      this._switchSectorRelative(-1);
    }
    if (this._keyNextSector && Phaser.Input.Keyboard.JustDown(this._keyNextSector)) {
      this._switchSectorRelative(+1);
    }

    // ── Debug overlay güncelle ─────────────────────────────────────────────
    if (this.fpsText) {
      this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    }
    if (this._sectorInfoText && this.sectorManager) {
      const active = this.sectorManager.activeSector;
      this._sectorInfoText.setText(
        `Sector: ${active?.name ?? '-'} | ` +
        `P:${active?.playerAliveSoldiers ?? '--'} ` +
        `E:${active?.enemyAliveSoldiers ?? '--'}`,
      );
    }
    if (this._orderInfoText) {
      const selected = this.inputController?.selectedGroup ?? null;
      const orderLabel = selected?.currentOrder?.label ?? 'Yok';
      this._orderInfoText.setText(`Emir: ${orderLabel}  [Q/W/E/R/T]`);
    }
  }

  // ── Sektör geçiş yardımcısı ───────────────────────────────────────────────

  /**
   * @param {number} direction  +1 ileri, -1 geri
   */
  _switchSectorRelative(direction) {
    if (!this.sectorManager || !this.sectorRenderer) return;
    const sectors = this.sectorManager.sectors;
    if (sectors.length <= 1) return;

    const idx    = sectors.findIndex(s => s.id === this.sectorManager.activeSectorId);
    const newIdx = (idx + direction + sectors.length) % sectors.length;
    this.sectorRenderer.switchToSector(sectors[newIdx].id);
  }

  // ── Spawn yardımcısı (geriye dönük uyumluluk için bırakıldı) ─────────────

  /**
   * Artık create() tarafından çağrılmıyor — SectorRenderer üstlendi.
   * Dış kullanım veya test ortamı için korundu.
   */
  _spawnUnitGroup(group) {
    const spacing  = FormationController.getFormationSpacing(group);
    const acquired = [];

    for (let i = 0; i < group.soldiers.length; i++) {
      const soldier = group.soldiers[i];
      const slot = FormationController.getSlotPosition(
        i, group.position, group.formationType, spacing, group.size,
      );
      const vs = this.visualSoldierPool.acquire(soldier.visualProfileId, slot.x, slot.y);
      if (!vs) {
        console.warn(`[BattleScene] Pool doldu — "${group.id}" grubunun ${i}. askeri atlandı`);
      }
      acquired.push(vs);
    }

    group.bindVisuals(acquired);
    FormationController.updateGroupPositions(group, acquired);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _generateFallbackTexture(atlasKey) {
    const profile = Object.values(VISUAL_PROFILES).find(p => p.atlasKey === atlasKey);
    const color   = (profile && FALLBACK_COLORS[profile.id]) ?? DEFAULT_FALLBACK_COLOR;
    const gfx     = this.add.graphics();
    gfx.fillStyle(color, 1);
    gfx.fillRect(0, 0, 32, 32);
    gfx.generateTexture(atlasKey, 32, 32);
    gfx.destroy();
  }

  _registerProfileAnimations(profile) {
    if (!this.textures.exists(profile.atlasKey)) return;

    const frameNames = this.textures.get(profile.atlasKey).getFrameNames();
    if (!frameNames || frameNames.length === 0) return;

    for (const [animRole, animName] of Object.entries(profile.animations)) {
      if (!animName) continue;
      if (this.anims.exists(animName)) continue;

      const pattern        = new RegExp(`^${animName}_\\d+$`);
      const matchingFrames = frameNames.filter(f => pattern.test(f));

      if (matchingFrames.length === 0) {
        console.warn(
          `[BattleScene] No frames matching "${animName}_N" in atlas "${profile.atlasKey}"` +
          ` (role: ${animRole}) — skipped`,
        );
        continue;
      }

      const isLooping = animRole === 'idle' || animRole === 'walk' || animRole === 'gallop';
      this.anims.create({
        key:       animName,
        frames:    this.anims.generateFrameNames(profile.atlasKey, {
          prefix: `${animName}_`, start: 0, end: matchingFrames.length - 1,
        }),
        frameRate: 8,
        repeat:    isLooping ? -1 : 0,
      });
    }
  }

  shutdown() {
    this.deployScreen?.hide();
    this.deployScreen    = null;
    this.tacticalController?.destroy();
    this.tacticalController = null;
    this.sectorRenderer?.destroy();
    this.sectorRenderer  = null;
    this.simulation?.destroy();
    this.simulation      = null;
    this.sectorManager   = null;
    this.inputController?.destroy();
    this.inputController = null;
    this._unitGroups     = [];
    this.visualSoldierPool?.releaseAll();
    this.visualSoldierPool = null;
    this.battleManager?.destroy();
    this.battleManager    = null;
    this._profileInfoText = null;
    this._poolInfoText    = null;
    this._sectorInfoText  = null;
    this._orderInfoText   = null;
    this._keyPrevSector   = null;
    this._keyNextSector   = null;
    this._battleStarted   = false;
    this._failedAtlasKeys.clear();
  }
}
