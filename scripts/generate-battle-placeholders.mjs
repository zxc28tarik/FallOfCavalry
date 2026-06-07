/**
 * generate-battle-placeholders.mjs
 *
 * Phaser 3 atlas formatında test sprite'ları üretir.
 * Her animasyon için farklı renk + frame numarası işaretçisi.
 *
 * Çalıştırma:
 *   node scripts/generate-battle-placeholders.mjs
 *
 * Çıktı:
 *   assets/battle/tiny_swords_warrior.png  + .json
 *   assets/battle/tiny_swords_lancer.png   + .json
 *   assets/battle/tiny_swords_archer.png   + .json
 *
 * Gerçek Tiny Swords assetleri gelince:
 *   1. assets/battle/ içine yerleştir
 *   2. Phaser atlas format gerekiyorsa: node scripts/convert-tinyswords.mjs
 *   3. visualProfiles.js'te directionMode, scale, frameRate güncelle
 */

import fs   from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const FRAME_W = 32;
const FRAME_H = 32;
const OUT_DIR = path.join(process.cwd(), 'assets', 'battle');

// ── Profil tanımları ──────────────────────────────────────────────────────────
// Her animasyon: RGBA temel renk + frame sayısı
// Renkler görsel olarak ayırt edilebilir olacak şekilde seçildi.

/** @typedef {{ r:number, g:number, b:number }} RGB */

/**
 * @typedef {{ name: string, frames: number, rgb: RGB }} AnimDef
 * @typedef {{ atlasKey: string, animations: AnimDef[] }} ProfileDef
 */

/** @type {ProfileDef[]} */
const PROFILES = [
  {
    atlasKey: 'tiny_swords_warrior',
    animations: [
      { name: 'tiny_warrior_idle',   frames: 4, rgb: { r: 160, g: 100, b:  40 } },  // kahverengi
      { name: 'tiny_warrior_walk',   frames: 8, rgb: { r: 200, g: 150, b:  70 } },  // açık kahve
      { name: 'tiny_warrior_attack', frames: 6, rgb: { r: 210, g:  50, b:  50 } },  // kırmızı
      { name: 'tiny_warrior_death',  frames: 5, rgb: { r:  70, g:  70, b:  70 } },  // koyu gri
    ],
  },
  {
    atlasKey: 'tiny_swords_lancer',
    animations: [
      { name: 'tiny_lancer_idle',   frames: 4, rgb: { r:  50, g:  90, b: 160 } },  // mavi
      { name: 'tiny_lancer_walk',   frames: 8, rgb: { r:  80, g: 130, b: 200 } },  // açık mavi
      { name: 'tiny_lancer_attack', frames: 6, rgb: { r:   0, g: 180, b: 200 } },  // cyan
      { name: 'tiny_lancer_death',  frames: 5, rgb: { r:  60, g:  60, b:  80 } },  // koyu mavi-gri
    ],
  },
  {
    atlasKey: 'tiny_swords_archer',
    animations: [
      { name: 'tiny_archer_idle',   frames: 4, rgb: { r:  50, g: 130, b:  50 } },  // yeşil
      { name: 'tiny_archer_walk',   frames: 8, rgb: { r:  90, g: 170, b:  70 } },  // açık yeşil
      { name: 'tiny_archer_attack', frames: 6, rgb: { r: 200, g: 180, b:  20 } },  // sarı
      { name: 'tiny_archer_death',  frames: 5, rgb: { r:  60, g:  70, b:  60 } },  // koyu yeşil-gri
    ],
  },
];

// ── Frame çizim yardımcıları ──────────────────────────────────────────────────

/**
 * Bir frame'i PNG buffer'ına çizer.
 * @param {Buffer} data    PNG.data buffer
 * @param {number} totalW  toplam atlas genişliği
 * @param {number} frameX  bu frame'in x offset'i
 * @param {RGB}    rgb     temel renk
 * @param {number} frameIdx  0-bazlı frame indeksi (0=en açık, arttıkça koyulaşır)
 * @param {number} totalFrames toplam frame sayısı (koyulaştırma için)
 */
function drawFrame(data, totalW, frameX, rgb, frameIdx, totalFrames) {
  // Her frame hafifçe koyulaşır (animasyon ilerlemesini gösterir)
  const darken = 1 - (frameIdx / totalFrames) * 0.3;
  const r = Math.round(rgb.r * darken);
  const g = Math.round(rgb.g * darken);
  const b = Math.round(rgb.b * darken);

  for (let py = 0; py < FRAME_H; py++) {
    for (let px = 0; px < FRAME_W; px++) {
      const idx = ((py * totalW) + (frameX + px)) * 4;

      // İç border (beyaz) — çerçeve sınırları görünsün
      const isBorder = px === 0 || px === FRAME_W - 1 || py === 0 || py === FRAME_H - 1;
      if (isBorder) {
        data[idx]     = 220;
        data[idx + 1] = 220;
        data[idx + 2] = 220;
        data[idx + 3] = 255;
        continue;
      }

      // Basit adam silueti: baş (merkez üst), gövde (merkez), bacaklar
      const cx = Math.floor(FRAME_W / 2);
      const headY = 6;
      const bodyTop = 12;
      const bodyBot = 22;

      const isHead  = py >= headY - 3 && py <= headY + 3 && px >= cx - 3 && px <= cx + 3;
      const isBody  = py >= bodyTop && py <= bodyBot && px >= cx - 2 && px <= cx + 2;
      const isLegs  = py > bodyBot && py <= FRAME_H - 4 &&
                      ((px >= cx - 3 && px <= cx - 1) || (px >= cx + 1 && px <= cx + 3));

      // Silah göstergesi — saldırı animasyonunda kırmızı çizgi
      const isSword = rgb.r > 180 && py >= 8 && py <= 24 && px >= cx + 4 && px <= cx + 7;

      if (isHead || isBody || isLegs) {
        // Asker rengi — temel rengin parlak versiyonu
        data[idx]     = Math.min(255, r + 60);
        data[idx + 1] = Math.min(255, g + 60);
        data[idx + 2] = Math.min(255, b + 60);
        data[idx + 3] = 255;
      } else if (isSword) {
        data[idx]     = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 120;
        data[idx + 3] = 255;
      } else {
        // Arka plan
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }
  }

  // Frame numarası göstergesi — üst sol köşede beyaz noktalar
  // frameIdx=0 → 1 nokta, frameIdx=1 → 2 nokta vb. (max 8)
  const dotCount = Math.min(frameIdx + 1, 8);
  for (let d = 0; d < dotCount; d++) {
    const dotX = 2 + d * 3;
    const dotY = 2;
    if (dotX + 1 < FRAME_W) {
      const idx = ((dotY * totalW) + (frameX + dotX)) * 4;
      data[idx]     = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }
}

// ── Atlas üretici ─────────────────────────────────────────────────────────────

/**
 * Tek bir profil için PNG + JSON üretir ve diske yazar.
 * @param {ProfileDef} profile
 */
function generateAtlas(profile) {
  // Toplam frame sayısı
  const totalFrames = profile.animations.reduce((s, a) => s + a.frames, 0);
  const totalW = totalFrames * FRAME_W;

  // PNG oluştur
  const png  = new PNG({ width: totalW, height: FRAME_H });
  const data = png.data;

  /** @type {Object<string, object>} Phaser atlas frames */
  const frameData = {};

  let xOffset = 0;
  for (const anim of profile.animations) {
    for (let fi = 0; fi < anim.frames; fi++) {
      const frameName = `${anim.name}_${fi}`;
      drawFrame(data, totalW, xOffset, anim.rgb, fi, anim.frames);

      frameData[frameName] = {
        frame:           { x: xOffset, y: 0, w: FRAME_W, h: FRAME_H },
        rotated:         false,
        trimmed:         false,
        spriteSourceSize: { x: 0, y: 0, w: FRAME_W, h: FRAME_H },
        sourceSize:       { w: FRAME_W, h: FRAME_H },
      };

      xOffset += FRAME_W;
    }
  }

  // PNG'yi yaz
  const pngPath = path.join(OUT_DIR, `${profile.atlasKey}.png`);
  fs.writeFileSync(pngPath, PNG.sync.write(png));

  // JSON atlasını yaz (Phaser 3 hash formatı)
  const atlasJson = {
    frames: frameData,
    meta: {
      app:     'FallOfCavalry placeholder generator',
      version: '1.0',
      image:   `${profile.atlasKey}.png`,
      format:  'RGBA8888',
      size:    { w: totalW, h: FRAME_H },
      scale:   '1',
    },
  };

  const jsonPath = path.join(OUT_DIR, `${profile.atlasKey}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(atlasJson, null, 2));

  // Rapor
  console.log(`\n✅ ${profile.atlasKey}`);
  console.log(`   PNG : ${pngPath}  (${totalW}x${FRAME_H})`);
  console.log(`   JSON: ${jsonPath}`);
  console.log(`   Frames: ${totalFrames} toplam`);
  for (const anim of profile.animations) {
    console.log(`     ${anim.name}_0..${anim.name}_${anim.frames - 1}  (${anim.frames} frame)`);
  }
}

// ── Çalıştır ──────────────────────────────────────────────────────────────────

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('🎨 Fall of Cavalry — Battle Placeholder Atlas Üretici');
console.log(`   Çıktı: ${OUT_DIR}`);
console.log('   Format: Phaser 3 Hash Atlas (PNG + JSON)');
console.log('   Frame: 32×32 px, yatay strip\n');

for (const profile of PROFILES) {
  generateAtlas(profile);
}

console.log('\n✔ Tamamlandı. Oyunu başlatmak için: npm run dev');
console.log('\n📋 Gerçek Tiny Swords assetleri gelince:');
console.log('   1. Tiny Swords paketini indir: https://pixelfrog-assets.itch.io/tiny-swords');
console.log('   2. PNG dosyalarını assets/battle/ içine koy (aynı atlasKey adlarıyla)');
console.log('   3. JSON atlas dosyaları üret (TexturePacker veya scripts/convert-tinyswords.mjs)');
console.log('   4. visualProfiles.js\'te scale/frameRate güncelle');
console.log('   5. directionMode: Tiny Swords 1 yönlüdür → directionMode: \'1dir\'');
