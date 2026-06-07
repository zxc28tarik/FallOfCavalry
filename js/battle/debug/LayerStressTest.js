/**
 * LayerStressTest — Phaser 3 katmanlı asker görsel performans testi.
 *
 * Test BattleScene'den bağımsız olarak çalışır; combat kodu kullanmaz.
 * BattleScene'deki F11 tuşuyla açılır/kapanır.
 *
 * ── Slot / Layer Havuzu (production referansı) ─────────────────────────────
 *  Slot 00  body            — kıyafetli karakter
 *  Slot 01  leg_armor       — ayak-bacak zırhı
 *  Slot 02  body_armor      — gövde zırhı
 *  Slot 03  helmet          — miğfer / başlık
 *  Slot 04  arm_armor       — kol zırhı
 *  Slot 05  shoulder_armor  — omuz zırhı
 *  Slot 06  polearm         — mızrak / kargı / polearm sınıfı
 *  Slot 07  sword_1         — kılıç sınıfı 1 (ana el)
 *  Slot 08  sword_2         — kılıç sınıfı 2 (yan el / ikinci kılıç)
 *  Slot 09  blunt           — balta / gürz / topuz / bozdoğan
 *  Slot 10  firearm         — tüfek / tabanca sınıfı
 *  Slot 11  bow             — yay sınıfı
 *  Slot 12  shield          — kalkan
 *  Slot 13  javelin         — cirit
 *  Slot 14  mount           — at / mount
 *
 * ── Layer sınırı politikası ────────────────────────────────────────────────
 *  Kodda yapay hard cap YOKTUR.
 *  Bir askerin kaç dolu ekipman slotu varsa o kadar layer oluşturulur.
 *  Üst sınır ekonomi, loadout kuralları ve AI sektör dağılımı tarafından
 *  dolaylı olarak belirlenir:
 *
 *    Tipik asker (standart piyade/süvari):    4-7 layer
 *    Veteran / çift silah + tam zırh:         7-10 layer
 *    Nadir elit (Kapıkulu, ağır süvari):     10-12 layer
 *
 *  Uç senaryo örneği — aynı sektörde:
 *    150 Kapıkulu × 12 layer = 1.800 player sprite
 *    150 AI hafif piyade × 4 layer =  600 enemy sprite
 *    Toplam aktif sektör yükü: 2.400 sprite  ← stres hedefi
 *
 *  Bu değer test senaryolarıyla birebir örtüşür; [1] = 300×8 = 2.400.
 *
 * ── Stress Test Senaryoları (toplam sektör sprite bütçesi) ────────────────
 * [1] 300 × 8  = 2.400  ← UÇ STRES — maks. gerçekçi sektör yükü
 * [2] 300 × 10 = 3.000  ← tüm askerler veteran seviyesi (kıyaslama)
 * [3] 300 × 12 = 3.600  ← tüm askerler Kapıkulu seviyesi (worst-case teorik)
 * [4] 300 × 13 = 3.900  ← 13 slot dolu (mount dahil); salt render üst sınırı
 *
 * ── Toggle Modları ─────────────────────────────────────────────────────────
 * [I] idle    [W] walk    [A] attack
 * [M] sinüs hareketi   [F] fake frame tint   [V] layer visibility toggle
 * [ESC / F11] kapat
 */

import Phaser from 'phaser';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const SOLDIER_COUNT = 300;
const COLS          = 20;
// ROWS = 15  (300 / 20)
const GAP_X         = 44;
const GAP_Y         = 42;
const ORIGIN_X      = 110;
const ORIGIN_Y      = 72;

/**
 * Tam slot havuzu — üretim kodu bu listeye bakarak layer oluşturacak.
 * İndeks = layer sırası (render depth order).
 */
const SLOT_POOL = [
  { id: 'body',           label: 'Vücut',         color: 0xc09060 },  //  0
  { id: 'leg_armor',      label: 'Bacak zırhı',   color: 0x4a4a5a },  //  1
  { id: 'body_armor',     label: 'Gövde zırhı',   color: 0x3a5fa5 },  //  2
  { id: 'helmet',         label: 'Miğfer',        color: 0x778899 },  //  3
  { id: 'arm_armor',      label: 'Kol zırhı',     color: 0x55667a },  //  4
  { id: 'shoulder_armor', label: 'Omuz zırhı',    color: 0x8b6914 },  //  5
  { id: 'polearm',        label: 'Polearm',        color: 0x5a3a1a },  //  6
  { id: 'sword_1',        label: 'Kılıç 1',       color: 0xd4d4d4 },  //  7
  { id: 'sword_2',        label: 'Kılıç 2',       color: 0xaaaaaa },  //  8
  { id: 'blunt',          label: 'Gürz/Balta',    color: 0x666666 },  //  9
  { id: 'firearm',        label: 'Tüfek/Tabanca', color: 0x2a2a3a },  // 10
  { id: 'bow',            label: 'Yay',           color: 0x7b5a2a },  // 11
  { id: 'shield',         label: 'Kalkan',        color: 0x7b3a1a },  // 12
  { id: 'javelin',        label: 'Cirit',         color: 0xaa8855 },  // 13
  { id: 'mount',          label: 'At/Mount',      color: 0x8b4513 },  // 14
];

/** Toplam slot sayısı (maksimum olası layer) */
const SLOT_COUNT = SLOT_POOL.length; // 15

/**
 * Stress test senaryoları.
 *
 * Senaryo [1] (300×8 = 2400) → uç stres hedefi.
 * Gerçek bir sektörde bu değer 150 Kapıkulu (12L) + 150 AI hafif (4L)
 * kombinasyonuyla doğal olarak elde edilir; 300 tam ekipmanlı asker olmaz.
 *
 * Senaryo [2-4] → render motorunun teorik üst sınırını ölçmek için.
 * Bu değerlere production'da ekonomik/loadout kuralları sayesinde ulaşılmaz;
 * yalnızca "sistem ne kadar taşır?" sorusunu yanıtlar.
 *
 * Layer sayısı per-asker bir tasarım limiti değildir. Sınır yok.
 */
const SCENARIOS = [
  { key: 'ONE',   layers: 8,  label: 'Uç stres (8L × 300)',          sprite: 2400 },
  { key: 'TWO',   layers: 10, label: 'Teorik veteran (10L × 300)',    sprite: 3000 },
  { key: 'THREE', layers: 12, label: 'Teorik Kapıkulu (12L × 300)',   sprite: 3600 },
  { key: 'FOUR',  layers: 13, label: 'Render üst sınırı (13L × 300)', sprite: 3900 },
];

/** Fake frame update için tint sırası */
const FRAME_TINTS = [0xffffff, 0xdddddd, 0xbbbbbb, 0xdddddd];

/** Texture key prefix — diğer scene'lerin texturelerinden ayrışsın */
const TEX_PREFIX = '__lst_';

// ─────────────────────────────────────────────────────────────────────────────

export class LayerStressTest extends Phaser.Scene {
  constructor() {
    super({ key: 'LayerStressTest' });

    /** @type {Phaser.GameObjects.Container[]} */
    this._containers   = [];

    /**
     * Her asker için layer sprite dizisi.
     * _layerSprites[soldierIndex][layerIndex]
     * @type {Phaser.GameObjects.Sprite[][]}
     */
    this._layerSprites = [];

    /** @type {string[]} Bu scene tarafından üretilen texture key'leri */
    this._texKeys = [];

    // ── Test durumu ─────────────────────────────────────────────────────────
    this._layerMode        = 8;       // 8 | 10 | 12 | 13
    this._animMode         = 'idle';  // 'idle' | 'walk' | 'attack'
    this._moveEnabled      = false;
    this._fakeFrameEnabled = false;
    this._visToggleEnabled = false;

    // ── İç zamanlama ────────────────────────────────────────────────────────
    this._frameIdx   = 0;   // 0-3 döngüsü (fake frame / anim adımı)
    this._animMs     = 0;   // animasyon zamanlayıcısı (ms birikimi)
    this._movePhase  = 0;   // sinüs hareketi fazı (radian)
    this._visFrame   = 0;   // görünürlük toggle sayacı

    this._tick       = 0;   // update çağrısı sayısı

    /** Son 60 frame'lik delta buffer (frame time hesabı için) */
    this._ftBuf  = new Float32Array(60);
    this._ftIdx  = 0;

    // ── Overlay bileşenleri ─────────────────────────────────────────────────
    /** @type {Phaser.GameObjects.Text|null} */
    this._debugText  = null;
    /** @type {Phaser.GameObjects.Text|null} */
    this._statusText = null;
  }

  // ── Phaser lifecycle ───────────────────────────────────────────────────────

  preload() {
    // Dış asset gerekmez — tüm texture'lar create()'te üretilir.
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0d1a');

    this._generateTextures();
    this._buildContainers(this._layerMode);
    this._setupKeys();
    this._setupOverlay();
  }

  update(_time, delta) {
    this._tick++;

    // ── Frame time buffer ──────────────────────────────────────────────────
    this._ftBuf[this._ftIdx % 60] = this.game.loop.delta;
    this._ftIdx++;

    // ── Animasyon tick ─────────────────────────────────────────────────────
    // Idle/walk: 8 fps, attack: 12 fps
    const animFps    = this._animMode === 'attack' ? 12 : 8;
    const animPeriod = 1000 / animFps;
    this._animMs += delta;
    if (this._animMs >= animPeriod) {
      this._animMs  -= animPeriod;
      this._frameIdx = (this._frameIdx + 1) & 3; // % 4
      this._visFrame++;
    }

    // ── Hareket fazı ──────────────────────────────────────────────────────
    if (this._moveEnabled) {
      this._movePhase += delta * 0.0015;
    }

    // ── Asker güncelleme döngüsü ──────────────────────────────────────────
    const lc = this._layerMode;

    for (let si = 0; si < SOLDIER_COUNT; si++) {
      const c  = this._containers[si];
      const sp = this._layerSprites[si];

      // Hareket — container pozisyonunu sinüs dalgasıyla kaydır
      if (this._moveEnabled) {
        const bx = ORIGIN_X + (si % COLS) * GAP_X;
        const by = ORIGIN_Y + Math.floor(si / COLS) * GAP_Y;
        c.x = bx + Math.sin(this._movePhase + si * 0.09) * 5;
        c.y = by + Math.cos(this._movePhase * 0.8  + si * 0.07) * 3;
      }

      // Fake frame update — her layer'ın tint'ini değiştir (dirty flag olmadan)
      if (this._fakeFrameEnabled) {
        const tint = FRAME_TINTS[this._frameIdx];
        for (let li = 0; li < lc; li++) {
          sp[li].setTint(tint);
        }
      }

      // Visibility toggle — ilk 2 slot (body + leg_armor) daima görünür
      if (this._visToggleEnabled) {
        for (let li = 2; li < lc; li++) {
          sp[li].setVisible(((this._visFrame + li) & 1) === 0);
        }
      }
    }

    // ── Overlay güncelleme (her 10 tick) ─────────────────────────────────
    if (this._tick % 10 === 0) {
      this._refreshOverlay();
    }
  }

  shutdown() {
    this._destroyContainers();
    this._removeTextures();
    this.input.keyboard.removeAllListeners();
  }

  // ── Texture üretimi ────────────────────────────────────────────────────────

  /**
   * SLOT_POOL'daki her slot için 16×32 px bir placeholder texture üretir.
   * Slot rengiyle boyanmış basit asker silueti.
   */
  _generateTextures() {
    this._texKeys = [];

    for (let i = 0; i < SLOT_COUNT; i++) {
      const key   = `${TEX_PREFIX}slot_${i}`;
      const slot  = SLOT_POOL[i];
      const color = slot.color;

      if (!this.textures.exists(key)) {
        const g = this.add.graphics();

        // Ana dolgu
        g.fillStyle(color, 1.0);
        g.fillRect(1, 0, 14, 28);

        // Asker silueti (body olmayan layer'lar için hafif offsetli)
        const bright = _brighten(color, 55);
        g.fillStyle(bright, 1.0);
        // Baş
        g.fillRect(5, 1, 6, 6);
        // Gövde
        g.fillRect(4, 8, 8, 10);
        // Bacaklar
        g.fillRect(4, 19, 3, 7);
        g.fillRect(9, 19, 3, 7);

        // Küçük highlight (üst sol)
        g.fillStyle(0xffffff, 0.18);
        g.fillRect(2, 2, 3, 3);

        // Slot indeksini nokta olarak göster (sol alt)
        // 0-3 arası noktalar — hangi layer olduğu görülsün
        const dotCount = Math.min(i % 4 + 1, 4);
        g.fillStyle(0xffffff, 0.55);
        for (let d = 0; d < dotCount; d++) {
          g.fillRect(2 + d * 3, 24, 2, 2);
        }

        // İnce dış border
        g.lineStyle(1, 0xffffff, 0.2);
        g.strokeRect(0, 0, 16, 32);

        g.generateTexture(key, 16, 32);
        g.destroy();
      }

      this._texKeys.push(key);
    }
  }

  _removeTextures() {
    for (const key of this._texKeys) {
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
    }
    this._texKeys = [];
  }

  // ── Container yönetimi ─────────────────────────────────────────────────────

  /**
   * Belirtilen katman sayısında 300 asker konteyneri oluşturur.
   * Varsa eskiler önce temizlenir.
   *
   * layerCount, SLOT_POOL'un ilk N slotunu kullanır.
   * Production'da layerCount'un üst sınırı YOKTUR — bu bir tasarım kararı.
   * Bu fonksiyondaki tek clamp, SLOT_POOL dizisinin eleman sayısı (SLOT_COUNT)
   * ile sınırlıdır: sadece tanımlı texture kadar slot üretilebilir.
   * Yeni slot eklemek için SLOT_POOL ve SLOT_COUNT'u büyüt.
   *
   * @param {number} layerCount  kaç slot — üst sınır: SLOT_POOL boyutu (şu an 15)
   */
  _buildContainers(layerCount) {
    this._destroyContainers();

    // Yalnızca dizi taşmasını engeller — tasarım limiti değildir.
    const lc = Math.min(Math.max(layerCount, 1), SLOT_COUNT);
    this._layerMode    = lc;
    this._containers   = [];
    this._layerSprites = [];

    for (let si = 0; si < SOLDIER_COUNT; si++) {
      const col = si % COLS;
      const row = Math.floor(si / COLS);
      const x   = ORIGIN_X + col * GAP_X;
      const y   = ORIGIN_Y + row * GAP_Y;

      const container = this.add.container(x, y);
      const sprites   = [];

      for (let li = 0; li < lc; li++) {
        const sp = this.add.sprite(0, 0, this._texKeys[li]);
        sp.setOrigin(0.5, 0.85);
        container.add(sp);
        sprites.push(sp);
      }

      this._containers.push(container);
      this._layerSprites.push(sprites);
    }

    // İç sayaçları sıfırla
    this._frameIdx = 0;
    this._animMs   = 0;
  }

  _destroyContainers() {
    for (const c of this._containers) {
      c.destroy(true); // destroyChildren = true
    }
    this._containers   = [];
    this._layerSprites = [];
  }

  // ── Klavye ────────────────────────────────────────────────────────────────

  _setupKeys() {
    const kb = this.input.keyboard;

    // Stress test senaryoları
    for (const s of SCENARIOS) {
      kb.on(`keydown-${s.key}`, () => {
        this._buildContainers(s.layers);
        this._status(`★ ${s.label}  →  ${s.sprite.toLocaleString()} sprite`);
      });
    }

    // Animasyon modları
    kb.on('keydown-I', () => { this._animMode = 'idle';   this._status('Animasyon → IDLE'); });
    kb.on('keydown-W', () => { this._animMode = 'walk';   this._status('Animasyon → WALK'); });
    kb.on('keydown-A', () => { this._animMode = 'attack'; this._status('Animasyon → ATTACK'); });

    // Toggle modlar
    kb.on('keydown-M', () => {
      this._moveEnabled = !this._moveEnabled;
      this._movePhase   = 0;
      if (!this._moveEnabled) this._resetPositions();
      this._status(`Hareket: ${this._moveEnabled ? 'AÇIK ▶' : 'KAPALI ■'}`);
    });
    kb.on('keydown-F', () => {
      this._fakeFrameEnabled = !this._fakeFrameEnabled;
      if (!this._fakeFrameEnabled) this._clearTints();
      this._status(`Fake Frame: ${this._fakeFrameEnabled ? 'AÇIK ▶' : 'KAPALI ■'}`);
    });
    kb.on('keydown-V', () => {
      this._visToggleEnabled = !this._visToggleEnabled;
      if (!this._visToggleEnabled) this._showAllLayers();
      this._status(`Vis Toggle: ${this._visToggleEnabled ? 'AÇIK ▶' : 'KAPALI ■'}`);
    });

    // Kapat
    kb.on('keydown-ESC', () => this.scene.stop('LayerStressTest'));
    kb.on('keydown-F11', () => this.scene.stop('LayerStressTest'));
  }

  _resetPositions() {
    for (let si = 0; si < SOLDIER_COUNT; si++) {
      const c = this._containers[si];
      c.x = ORIGIN_X + (si % COLS) * GAP_X;
      c.y = ORIGIN_Y + Math.floor(si / COLS) * GAP_Y;
    }
  }

  _clearTints() {
    for (const spArr of this._layerSprites) {
      for (const sp of spArr) sp.clearTint();
    }
  }

  _showAllLayers() {
    for (const spArr of this._layerSprites) {
      for (const sp of spArr) sp.setVisible(true);
    }
  }

  // ── Debug Overlay ──────────────────────────────────────────────────────────

  _setupOverlay() {
    const OW = 390, OH = 268;
    const HX  = 1280 - 310;

    // Sol üst: metrik paneli
    const bgL = this.add.graphics();
    bgL.fillStyle(0x000000, 0.80);
    bgL.fillRoundedRect(0, 0, OW, OH, 4);
    bgL.lineStyle(1, 0xff6600, 0.9);
    bgL.strokeRoundedRect(0, 0, OW, OH, 4);
    bgL.setScrollFactor(0).setDepth(200);

    this.add.text(8, 6, '⚔  LayerStressTest  —  [ESC / F11] kapat', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff8844',
    }).setScrollFactor(0).setDepth(201);

    this._debugText = this.add.text(8, 24, '...', {
      fontFamily: 'monospace', fontSize: '11px', color: '#00ee88',
      lineSpacing: 2,
    }).setScrollFactor(0).setDepth(201);

    this._statusText = this.add.text(8, 250, '— Hazır —', {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffcc44',
    }).setScrollFactor(0).setDepth(201);

    // Sağ üst: kısa tuş referansı
    const bgR = this.add.graphics();
    bgR.fillStyle(0x000000, 0.74);
    bgR.fillRoundedRect(HX - 4, 0, 306, 210, 4);
    bgR.setScrollFactor(0).setDepth(200);

    const helpLines = [
      '── Stres Senaryoları ─────────────────',
      '[1]  8L×300 → 2.400  ← UÇ STRES HEDEFİ',
      '[2] 10L×300 → 3.000  teorik veteran',
      '[3] 12L×300 → 3.600  teorik Kapıkulu',
      '[4] 13L×300 → 3.900  render üst sınırı',
      '── Gerçek Savaş Bütçesi ──────────────',
      'Normal:    ~1.000-1.600 top. sprite',
      'Ağır:      ~1.800-2.200 top. sprite',
      'Uç stres:  ~2.400 top. sprite',
      '  (=150×12 Kapıkulu + 150×4 AI)',
      '── Layer Sınırı YOK ──────────────────',
      'Ekonomi + loadout + AI = doğal limit',
      'Tipik: 4-7L / Elit: 10-12L / hard cap yok',
      '── Toggle ────────────────────────────',
      '[I/W/A] anim  [M] hareket',
      '[F] fake frame  [V] vis toggle',
    ].join('\n');

    this.add.text(HX, 8, helpLines, {
      fontFamily: 'monospace', fontSize: '10px', color: '#aabbcc', lineSpacing: 2,
    }).setScrollFactor(0).setDepth(201);
  }

  _status(msg) {
    if (this._statusText) this._statusText.setText(msg);
  }

  _refreshOverlay() {
    const fps = Math.round(this.game.loop.actualFps);

    // Ortalama frame time (son 60 örnek)
    let ftSum = 0;
    const ftN = Math.min(this._ftIdx, 60);
    for (let i = 0; i < ftN; i++) ftSum += this._ftBuf[i];
    const avgFt = ftN > 0 ? (ftSum / ftN).toFixed(2) : '--';

    const lc           = this._layerMode;
    const totalSprites = SOLDIER_COUNT * lc;

    // Görünür sprite sayısı
    let visCount = 0;
    for (const spArr of this._layerSprites) {
      for (let i = 0; i < spArr.length; i++) {
        if (spArr[i].visible) visCount++;
      }
    }

    // Sahne kök GO sayısı (container'lar dahil; sprite'lar container içinde)
    const goCount = this.children.list.length;

    // FPS renkli gösterge
    const fpsTag = fps >= 55 ? '✅' : fps >= 40 ? '⚠️' : '❌';

    // Aktif slotların kısa listesi
    const activeSlots = SLOT_POOL.slice(0, lc).map(s => s.id).join(', ');
    // Uzunsa kes
    const slotsDisplay = activeSlots.length > 46
      ? activeSlots.slice(0, 43) + '...'
      : activeSlots;

    // Gerçek savaş bütçesi referansı — kaçıncı bölgede olduğumuzu göster
    const budgetTag =
      totalSprites <= 1600 ? 'normal savaş'  :
      totalSprites <= 2200 ? 'ağır savaş'    :
      totalSprites <= 2400 ? '⚠ uç stres'    :
                             '☠ teorik üst';

    const lines = [
      `FPS:  ${String(fps).padStart(4)} ${fpsTag}   |  Frame: ${avgFt} ms`,
      '──────────────────────────────────────────',
      `Aktif asker:     ${String(SOLDIER_COUNT).padStart(4)}`,
      `Layer / asker:   ${String(lc).padStart(4)}  (havuz: ${SLOT_COUNT} slot, cap yok)`,
      `Toplam sprite:   ${String(totalSprites).padStart(5)}  — ${budgetTag}`,
      `Görünür sprite:  ${String(visCount).padStart(5)}`,
      `Root GameObjects:${String(goCount).padStart(5)}  (overlay dahil)`,
      '──────────────────────────────────────────',
      `Slotlar: ${slotsDisplay}`,
      '──────────────────────────────────────────',
      `Animasyon: ${this._animMode.toUpperCase().padEnd(8)} | Hareket: ${this._moveEnabled ? 'ON ' : 'off'}`,
      `Fake Frame: ${this._fakeFrameEnabled ? 'ON ' : 'off'}         | VisTog:  ${this._visToggleEnabled ? 'ON ' : 'off'}`,
    ];

    this._debugText.setText(lines.join('\n'));
  }
}

// ── Yardımcı fonksiyon ─────────────────────────────────────────────────────

/**
 * Bir hex rengi belirtilen miktarda aydınlatır.
 * @param {number} color  0xRRGGBB
 * @param {number} amount 0-255
 * @returns {number}
 */
function _brighten(color, amount) {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >>  8) & 0xff) + amount);
  const b = Math.min(255, ( color        & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}
