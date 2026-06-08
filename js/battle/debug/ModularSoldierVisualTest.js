/**
 * ModularSoldierVisualTest — SoldierContainer + SoldierContainerPool canlı debug sahnesi.
 *
 * BattleScene'den bağımsız olarak çalışır; F10 ile açılır/kapanır.
 * SoldierContainer / SoldierContainerPool / ModularFrameResolver zincirini
 * gerçek Phaser runtime'ında test eder.
 *
 * ── Gözlemlenen özellikler ─────────────────────────────────────────────────
 *  • body frame 0001 iken helmet, sword, shield de 0001 oluyor mu?
 *  • direction değişince tüm layerlar aynı direction'a geçiyor mu?
 *  • action değişince tüm layerlar aynı action'a geçiyor mu?
 *  • setEquipment 2. çağrıda eski layerlar temizleniyor mu?
 *  • releaseAll crash veriyor mu?
 *
 * ── Kontroller ─────────────────────────────────────────────────────────────
 *  [SPACE]    action döngüsü: idle → walk → attack → death
 *  [←] [→]   frameIndex -1 / +1
 *  [↑] [↓]   direction döngüsü: south → east → north → west
 *  [TAB]      seçili asker döngüsü (#0–4)
 *  [1]–[5]    seçili askere ekipman presetini uygula
 *  [A]        oto-frame ilerleme aç/kapat (8 fps)
 *  [R]        releaseAll test et (tüm containerları boşalt + yeniden oluştur)
 *  [ESC/F10]  sahneyi kapat → BattleScene'e dön
 */

import Phaser from 'phaser';
import { SoldierContainerPool } from '../visual/SoldierContainerPool.js';
import { resolveLayerFrameFromAtlas } from '../visual/ModularFrameResolver.js';

// ── Public exports (saf, test edilebilir) ────────────────────────────────────

export const SCENE_KEY       = 'ModularSoldierVisualTest';
export const ATLAS_KEY       = '__mvt_atlas';   // çarpışma önlemek için prefix
export const ATLAS_LAYERS    = ['body', 'helmet_tolga', 'sword_01', 'shield_round', 'armor'];
export const ATLAS_ACTIONS   = ['idle', 'walk', 'attack', 'death'];
export const ATLAS_DIRS      = ['south', 'east', 'north', 'west'];
export const ATLAS_FRAME_COUNT = 2;

/**
 * Atlas'a kaydedilecek tüm frame adlarını üretir.
 * Saf fonksiyon — Phaser bağımlılığı yok; test edilebilir.
 *
 * @returns {string[]}  'body/idle/south/0000.png' formatında frame adları
 */
export function buildAtlasFrameNames() {
  const names = [];
  for (const layerId of ATLAS_LAYERS) {
    for (const action of ATLAS_ACTIONS) {
      for (const dir of ATLAS_DIRS) {
        for (let fi = 0; fi < ATLAS_FRAME_COUNT; fi++) {
          names.push(`${layerId}/${action}/${dir}/${String(fi).padStart(4, '0')}.png`);
        }
      }
    }
  }
  return names;
}

// ── Sahne-özel sabitler ───────────────────────────────────────────────────────

/** Atlas hücre boyutu */
const CELL_W = 16;
const CELL_H = 32;

/** 5 asker yatay konumları */
const SOLDIER_Y     = 340;
const SOLDIER_X_0   = 180;
const SOLDIER_GAP   = 185;

/** Ekipman presetleri (1–5 tuşlarına karşılık) */
const EQUIPMENT_PRESETS = [
  { label: '#1  body',                           eq: { body: true } },
  { label: '#2  body + helmet',                  eq: { body: true, helmet_tolga: true } },
  { label: '#3  body + helmet + sword',          eq: { body: true, helmet_tolga: true, sword_01: true } },
  { label: '#4  body + helmet + sword + shield', eq: { body: true, helmet_tolga: true, sword_01: true, shield_round: true } },
  { label: '#5  full',                           eq: { body: true, armor: true, helmet_tolga: true, sword_01: true, shield_round: true } },
];

const POOL_CAPACITY = 20;   // gerçek oyun değerinden küçük — test için yeterli

// ─────────────────────────────────────────────────────────────────────────────

export class ModularSoldierVisualTest extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEY });

    /** @type {SoldierContainerPool|null} */
    this._pool = null;

    /**
     * Aktif askerler: { sc: SoldierContainer, presetIdx: number, x: number, y: number }
     * @type {Array<{sc: object, presetIdx: number, x: number, y: number}>}
     */
    this._soldiers = [];

    // ── Global durum (tüm askerler aynı anda güncellenir) ─────────────────
    this._actionIdx = 0;     // ATLAS_ACTIONS indeksi
    this._dirIdx    = 0;     // ATLAS_DIRS indeksi
    this._frameIdx  = 0;     // 0 … ATLAS_FRAME_COUNT-1

    // ── Seçim ────────────────────────────────────────────────────────────
    this._selectedIdx = 0;

    // ── Oto-ilerleme ─────────────────────────────────────────────────────
    this._autoAdvance = false;
    this._autoMs      = 0;

    // ── Overlay ─────────────────────────────────────────────────────────
    /** @type {Phaser.GameObjects.Text|null} */
    this._debugText  = null;
    /** @type {Phaser.GameObjects.Text|null} */
    this._statusText = null;
    /** @type {Phaser.GameObjects.Graphics|null} */
    this._selIndicator = null;
    /** @type {Phaser.GameObjects.Text[]} */
    this._labelTexts = [];
    /** @type {string[]} atlas'a kaydedilen frame adları cache */
    this._allFrameNames = [];

    this._tick = 0;
  }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload() {
    // Dış asset gerekmez — atlas create()'te üretilir.
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0d14');

    this._allFrameNames = buildAtlasFrameNames();

    this._buildAtlas();
    this._initPool();
    this._spawnSoldiers();
    this._setupKeys();
    this._setupOverlay();
    this._refreshSelection();
    this._applyGlobalState();
    this._refreshOverlay();

    this._status('Hazır — [SPACE] action  [←→] frame  [↑↓] yön  [TAB] seç  [1-5] ekipman  [A] oto  [R] releaseAll');
  }

  update(_time, delta) {
    this._tick++;

    if (this._autoAdvance) {
      this._autoMs += delta;
      if (this._autoMs >= 125) {  // 8 fps
        this._autoMs -= 125;
        this._frameIdx = (this._frameIdx + 1) % ATLAS_FRAME_COUNT;
        this._applyGlobalState();
      }
    }

    if (this._tick % 8 === 0) {
      this._refreshOverlay();
    }
  }

  shutdown() {
    if (this._pool) {
      this._pool.releaseAll();
      this._pool.destroy();
      this._pool = null;
    }
    if (this.textures.exists(ATLAS_KEY)) {
      this.textures.remove(ATLAS_KEY);
    }
    this.input.keyboard.removeAllListeners();
    this._soldiers    = [];
    this._labelTexts  = [];
    this._debugText   = null;
    this._statusText  = null;
    this._selIndicator = null;
  }

  // ── Atlas üretimi ─────────────────────────────────────────────────────────

  /**
   * Tek bir canvas texture oluşturur; her layer×frameIndex için renkli bir hücre çizer.
   * Tüm action×direction kombinasyonları aynı piksel bölgesine yönlenir —
   * piksel içeriği değil frame adı değişimi test edilir.
   *
   * Atlas düzeni:
   *   Sütun = layer indeksi  (0–4)
   *   Satır  = frameIndex    (0–1)
   *   Hücre  = 16×32 px
   */
  _buildAtlas() {
    if (this.textures.exists(ATLAS_KEY)) {
      this.textures.remove(ATLAS_KEY);
    }

    const W  = ATLAS_LAYERS.length * CELL_W;   // 80
    const H  = ATLAS_FRAME_COUNT * CELL_H;      // 64

    const ct  = this.textures.createCanvas(ATLAS_KEY, W, H);
    const ctx = ct.getContext();

    /** Layer başına temel renk ve çizim fonksiyonu */
    const LAYER_DRAW = [
      // 0 body — tam insan silueti (ten rengi)
      (cx, cy) => {
        ctx.fillStyle = '#c09060';
        ctx.fillRect(cx + 1, cy, 14, 32);
        ctx.fillStyle = '#e0b080';
        ctx.fillRect(cx + 5, cy + 1, 6, 6);    // baş
        ctx.fillRect(cx + 4, cy + 8, 8, 10);   // gövde
        ctx.fillRect(cx + 4, cy + 19, 3, 7);   // sol bacak
        ctx.fillRect(cx + 9, cy + 19, 3, 7);   // sağ bacak
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(cx + 2, cy + 2, 3, 3);    // highlight
      },
      // 1 helmet_tolga — gri miğfer (üst bölge)
      (cx, cy) => {
        ctx.fillStyle = '#778899';
        ctx.fillRect(cx + 4, cy + 2, 8, 2);    // ağız
        ctx.fillRect(cx + 5, cy + 0, 6, 4);    // kubbe
        ctx.fillStyle = '#9baabb';
        ctx.fillRect(cx + 6, cy + 1, 4, 2);    // parlaklık
      },
      // 2 sword_01 — gümüş kılıç (sağ taraf)
      (cx, cy) => {
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(cx + 12, cy + 4, 2, 20);  // bıçak
        ctx.fillRect(cx + 10, cy + 12, 6, 2);  // koruyucu
        ctx.fillStyle = '#886644';
        ctx.fillRect(cx + 12, cy + 24, 2, 4);  // sap
      },
      // 3 shield_round — kahve-kırmızı kalkan (sol taraf)
      (cx, cy) => {
        ctx.fillStyle = '#7b3a1a';
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 14, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#aa5522';
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 14, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ddaa55';
        ctx.beginPath();
        ctx.arc(cx + 4, cy + 14, 1, 0, Math.PI * 2);
        ctx.fill();
      },
      // 4 armor — mavi-çelik göğüs zırhı (orta)
      (cx, cy) => {
        ctx.fillStyle = '#3a5fa5';
        ctx.fillRect(cx + 3, cy + 7, 10, 12);  // göğüs
        ctx.fillStyle = '#5577cc';
        ctx.fillRect(cx + 4, cy + 8, 8, 4);    // highlight
        ctx.fillStyle = '#2a4a88';
        ctx.fillRect(cx + 3, cy + 16, 10, 3);  // alt kenar
      },
    ];

    for (let li = 0; li < ATLAS_LAYERS.length; li++) {
      for (let fi = 0; fi < ATLAS_FRAME_COUNT; fi++) {
        const cx = li * CELL_W;
        const cy = fi * CELL_H;

        // Siyah zemin
        ctx.fillStyle = '#000000';
        ctx.fillRect(cx, cy, CELL_W, CELL_H);

        // Layer şeklini çiz
        LAYER_DRAW[li](cx, cy);

        // Frame 1: hafif parlak overlay (animasyon farkını görsel göster)
        if (fi === 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.fillRect(cx, cy, CELL_W, CELL_H);
        }

        // Çerçeve — hücre sınırlarını göster
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(cx, cy, CELL_W, CELL_H);
      }
    }

    ct.refresh();

    // Tüm frame adlarını atlas'a kaydet
    // action×direction farkı piksel seviyesinde değil; tümü aynı hücreye yönlenir.
    for (let li = 0; li < ATLAS_LAYERS.length; li++) {
      const layerId = ATLAS_LAYERS[li];
      for (const action of ATLAS_ACTIONS) {
        for (const dir of ATLAS_DIRS) {
          for (let fi = 0; fi < ATLAS_FRAME_COUNT; fi++) {
            const name = `${layerId}/${action}/${dir}/${String(fi).padStart(4, '0')}.png`;
            ct.add(name, 0, li * CELL_W, fi * CELL_H, CELL_W, CELL_H);
          }
        }
      }
    }
  }

  // ── Pool & asker kurulumu ─────────────────────────────────────────────────

  _initPool() {
    this._pool = new SoldierContainerPool(this, {
      capacity: POOL_CAPACITY,
      atlasKey: ATLAS_KEY,
    });
  }

  /** 5 askeri başlangıç presetleriyle oluşturur. */
  _spawnSoldiers() {
    this._soldiers = [];
    for (let i = 0; i < 5; i++) {
      const x   = SOLDIER_X_0 + i * SOLDIER_GAP;
      const preset = EQUIPMENT_PRESETS[i];
      const sc  = this._pool.acquire({
        visualEquipment: preset.eq,
        x,
        y:          SOLDIER_Y,
        masterState: {
          action:     ATLAS_ACTIONS[this._actionIdx],
          direction:  ATLAS_DIRS[this._dirIdx],
          frameIndex: this._frameIdx,
        },
      });

      if (!sc) {
        console.warn(`[ModularSoldierVisualTest] Pool kapasitesi aşıldı — asker #${i} oluşturulamadı`);
        continue;
      }

      // Sahneye display layer ayarla (y bazlı depth)
      sc.container.setDepth(SOLDIER_Y + i);

      this._soldiers.push({ sc, presetIdx: i, x, y: SOLDIER_Y });
    }
  }

  // ── Klavye kurulumu ───────────────────────────────────────────────────────

  _setupKeys() {
    const kb = this.input.keyboard;

    // SPACE → action döngüsü
    kb.on('keydown-SPACE', () => {
      this._actionIdx = (this._actionIdx + 1) % ATLAS_ACTIONS.length;
      this._applyGlobalState();
      this._status(`Action → ${ATLAS_ACTIONS[this._actionIdx]}`);
    });

    // ← → → frameIndex
    kb.on('keydown-LEFT', () => {
      this._frameIdx = Math.max(0, this._frameIdx - 1);
      this._applyGlobalState();
    });
    kb.on('keydown-RIGHT', () => {
      this._frameIdx = Math.min(ATLAS_FRAME_COUNT - 1, this._frameIdx + 1);
      this._applyGlobalState();
    });

    // ↑ ↓ → direction döngüsü
    kb.on('keydown-UP',   () => {
      this._dirIdx = (this._dirIdx + 1) % ATLAS_DIRS.length;
      this._applyGlobalState();
      this._status(`Direction → ${ATLAS_DIRS[this._dirIdx]}`);
    });
    kb.on('keydown-DOWN', () => {
      this._dirIdx = (this._dirIdx - 1 + ATLAS_DIRS.length) % ATLAS_DIRS.length;
      this._applyGlobalState();
      this._status(`Direction → ${ATLAS_DIRS[this._dirIdx]}`);
    });

    // TAB → seçili asker döngüsü
    kb.on('keydown-TAB', () => {
      this._selectedIdx = (this._selectedIdx + 1) % this._soldiers.length;
      this._refreshSelection();
      this._status(`Seçili asker: #${this._selectedIdx}  ${EQUIPMENT_PRESETS[this._soldiers[this._selectedIdx]?.presetIdx ?? 0]?.label}`);
    });

    // 1-5 → seçili askere ekipman presetini uygula
    for (let n = 1; n <= 5; n++) {
      const presetIdx = n - 1;
      kb.on(`keydown-${n}`, () => {
        const entry = this._soldiers[this._selectedIdx];
        if (!entry) return;
        const preset = EQUIPMENT_PRESETS[presetIdx];
        entry.sc.setEquipment(preset.eq);
        entry.presetIdx = presetIdx;
        this._status(`#${this._selectedIdx} ekipman → ${preset.label}`);
        this._refreshOverlay();
      });
    }

    // A → oto-ilerleme toggle
    kb.on('keydown-A', () => {
      this._autoAdvance = !this._autoAdvance;
      this._autoMs = 0;
      this._status(`Oto-frame: ${this._autoAdvance ? 'AÇIK (8fps)' : 'KAPALI'}`);
    });

    // R → releaseAll test
    kb.on('keydown-R', () => {
      this._pool.releaseAll();
      this._soldiers = [];
      this._spawnSoldiers();
      this._refreshSelection();
      this._applyGlobalState();
      this._status('releaseAll() çağrıldı — tüm askerler yeniden oluşturuldu ✓');
    });

    // ESC / F10 → kapat
    kb.on('keydown-ESC', () => this._close());
    kb.on('keydown-F10', () => this._close());
  }

  // ── Global durum ──────────────────────────────────────────────────────────

  /** Mevcut global action/direction/frameIndex'i tüm askerlere uygular. */
  _applyGlobalState() {
    const state = {
      action:     ATLAS_ACTIONS[this._actionIdx],
      direction:  ATLAS_DIRS[this._dirIdx],
      frameIndex: this._frameIdx,
    };
    for (const { sc } of this._soldiers) {
      sc.setMasterState(state);
    }
  }

  // ── Seçim göstergesi ──────────────────────────────────────────────────────

  /** Seçili askerin altındaki highlight dikdörtgenini günceller. */
  _refreshSelection() {
    if (!this._selIndicator) {
      this._selIndicator = this.add.graphics();
      this._selIndicator.setDepth(500);
      this._selIndicator.setScrollFactor(0);
    }
    this._selIndicator.clear();

    const entry = this._soldiers[this._selectedIdx];
    if (!entry) return;

    this._selIndicator.lineStyle(2, 0xffcc44, 0.9);
    this._selIndicator.strokeRect(entry.x - 20, entry.y - 38, 40, 48);

    this._selIndicator.fillStyle(0xffcc44, 0.12);
    this._selIndicator.fillRect(entry.x - 20, entry.y - 38, 40, 48);
  }

  // ── Overlay ───────────────────────────────────────────────────────────────

  _setupOverlay() {
    const OW = 420, OH = 340;

    // Sol üst panel arka planı
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.82);
    bg.fillRoundedRect(0, 0, OW, OH, 4);
    bg.lineStyle(1, 0x44aaff, 0.85);
    bg.strokeRoundedRect(0, 0, OW, OH, 4);
    bg.setScrollFactor(0).setDepth(200);

    this.add.text(8, 6, `🧪  ${SCENE_KEY}  —  [ESC/F10] kapat`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#66ccff',
    }).setScrollFactor(0).setDepth(201);

    this._debugText = this.add.text(8, 24, '...', {
      fontFamily: 'monospace', fontSize: '10px', color: '#00ee88',
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(201);

    this._statusText = this.add.text(8, 320, '— Hazır —', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffcc44',
    }).setScrollFactor(0).setDepth(201);

    // Sağ üst: kısa tuş referansı
    const HX   = 1280 - 250;
    const bgR  = this.add.graphics();
    bgR.fillStyle(0x000000, 0.72);
    bgR.fillRoundedRect(HX - 4, 0, 246, 190, 4);
    bgR.setScrollFactor(0).setDepth(200);

    const help = [
      '── Kontroller ──────────────────',
      '[SPACE]  action ileri',
      '[←] [→]  frameIndex ±1',
      '[↑] [↓]  direction değiştir',
      '[TAB]    seçili asker ileri',
      '[1-5]    ekipman presetini uygula',
      '[A]      oto-frame 8fps',
      '[R]      releaseAll + yeniden oluştur',
      '[ESC/F10] kapat',
      '── Presetler ───────────────────',
      '1: body',
      '2: body+helmet',
      '3: body+helmet+sword',
      '4: body+helmet+sword+shield',
      '5: full (5 layer)',
    ].join('\n');

    this.add.text(HX, 8, help, {
      fontFamily: 'monospace', fontSize: '10px', color: '#aabbcc', lineSpacing: 2,
    }).setScrollFactor(0).setDepth(201);

    // Asker etiketleri
    for (let i = 0; i < 5; i++) {
      const lbl = this.add.text(
        SOLDIER_X_0 + i * SOLDIER_GAP,
        SOLDIER_Y + 28,
        `#${i}`,
        { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' },
      ).setOrigin(0.5, 0).setDepth(201);
      this._labelTexts.push(lbl);
    }
  }

  _status(msg) {
    if (this._statusText) this._statusText.setText(msg);
  }

  _refreshOverlay() {
    if (!this._debugText) return;

    const stats  = this._pool?.getStats() ?? { capacity: 0, inUse: 0, available: 0, created: 0 };
    const action = ATLAS_ACTIONS[this._actionIdx];
    const dir    = ATLAS_DIRS[this._dirIdx];
    const fi     = this._frameIdx;

    // Seçili asker layer bilgisi
    const selEntry   = this._soldiers[this._selectedIdx];
    const selPreset  = selEntry ? EQUIPMENT_PRESETS[selEntry.presetIdx]?.label ?? '—' : '—';
    const selLayers  = selEntry ? selEntry.sc.layers.size : 0;

    // Seçili askerin mevcut frame adları (resolver'dan)
    let layerFrameLines = '  (asker yok)';
    if (selEntry) {
      const parts = [];
      for (const [layerId] of selEntry.sc.layers) {
        const frame = resolveLayerFrameFromAtlas({
          layerId,
          action,
          direction: dir,
          frameIndex: fi,
          frameNames: this._allFrameNames,
        });
        parts.push(`  ${layerId.padEnd(16)}: ${frame ?? '— gizli'}`);
      }
      layerFrameLines = parts.length > 0 ? parts.join('\n') : '  (layer yok)';
    }

    // Toplam aktif layer sayısı
    let totalLayers = 0;
    for (const { sc } of this._soldiers) totalLayers += sc.layers.size;

    const lines = [
      '── Pool ───────────────────────────────────',
      `capacity: ${stats.capacity}   created: ${stats.created}   inUse: ${stats.inUse}   available: ${stats.available}`,
      '── Global Durum ───────────────────────────',
      `action:     ${action.padEnd(10)}  [SPACE]`,
      `direction:  ${dir.padEnd(10)}  [↑↓]`,
      `frameIndex: ${String(fi).padEnd(10)}  [←→]  auto: ${this._autoAdvance ? 'AÇIK ▶' : 'off'}`,
      `atlasKey:   ${ATLAS_KEY}`,
      '── Seçili Asker ───────────────────────────',
      `#${this._selectedIdx}  ${selPreset}  (${selLayers} layer)`,
      '  Frame adları (resolver çıktısı):',
      layerFrameLines,
      '──────────────────────────────────────────',
      `Toplam aktif layer: ${totalLayers}   (${this._soldiers.length} asker)`,
    ];

    this._debugText.setText(lines.join('\n'));

    // Asker etiketlerini güncelle
    for (let i = 0; i < this._labelTexts.length; i++) {
      const entry = this._soldiers[i];
      const txt   = this._labelTexts[i];
      if (!txt) continue;
      const preset = entry ? EQUIPMENT_PRESETS[entry.presetIdx]?.label ?? `#${i}` : `#${i}`;
      txt.setText(preset.replace(/^#\d+\s+/, `#${i} `));
      txt.setColor(i === this._selectedIdx ? '#ffcc44' : '#aabbcc');
    }
  }

  // ── Kapatma ───────────────────────────────────────────────────────────────

  _close() {
    console.info(`[${SCENE_KEY}] Kapanıyor — ESC/F10`);
    // Phaser bazı durumlarda shutdown() lifecycle'ını otomatik çağırmayabilir
    // (sahne RUNNING yerine farklı durumda ise). Cleanup'ı güvence altına almak
    // için burada açıkça çağırıyoruz. shutdown() null guard içerdiğinden
    // çift çağrı zararsız.
    this.shutdown();
    this.scene.stop(SCENE_KEY);
  }
}
