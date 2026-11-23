/**
 * G3D source-scope gate: non-destructive visual migration.
 * Existing gameplay authority is frozen at the V1.75 archive baseline.
 * Changes to protected code require an explicit, separately reviewed step.
 */
import { execFileSync } from 'node:child_process';

const BASELINE = '5641184f3cf745bfbc37c86740a261c97edb3662';
const protectedPaths = ['js/battle', 'js/systems', 'js/managers', 'js/ui', 'js/game-modes'];
let diff;
try {
  diff = execFileSync('git', [
    'diff', '--name-status', BASELINE, 'HEAD', '--', ...protectedPaths,
  ], { encoding: 'utf8' }).trim();
} catch (error) {
  console.error('[G3D] Baseline commit bulunamadı; kontrol atlanamaz.', error.message);
  process.exit(1);
}

if (diff) {
  console.error('[G3D] Korunan oyun kodu bu bağımsız 3D geliştirmesinde değişmiş:');
  console.error(diff);
  console.error('İşlemi durdur. Önce eski en iyi işlevleri karşılaştırıp ayrı onaylı entegrasyon adımı oluştur.');
  process.exit(1);
}

console.log('[G3D] PASS: V1.75 korumalı savaş, dünya, şehir, sistem ve UI dosyaları değişmemiş.');
