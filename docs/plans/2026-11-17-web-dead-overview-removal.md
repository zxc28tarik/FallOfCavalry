# FOC Web — Ulaşılamayan dimetrik overview kodu temizliği

**Tarih:** 2026-11-17. **Kapsam:** `js/rendering/dimetric/terrain-scene-renderer.js`.

## Kanıt
- Eski kaynakta `const useOverviewTerrain = false` sabit tanımlı. Altındaki `if (useOverviewTerrain)` kolu ve yalnızca bu kolda çağrılan `renderDimetricOverviewTerrain()` hiçbir koşulda çalışmıyor.
- `renderDimetricOverviewForestCanopy()` yalnızca `useOverviewTerrain && lodLevel === 'minimal'` koşulunda çağrılıyor; aynı sabit nedeniyle **hiçbir zaman çalışmıyor**.
- Bu iki özel fonksiyonun yardımcı renk fonksiyonları ve yalnız onlara ait `biomeBaseRgb` import'u artık kullanılmıyor.
- Mevcut gerçek çim `terrainCache`, forest anchor, sis ve harita efektleri çizim yolları **korundu**. Kullanılan block scope bozulmadan ölü `if` dalı kaldırıldı.
- `overviewForestCount` ve `overviewStride` dönülen değerleri bu sabit kapalı yolda her zaman **0** idi; şimdi doğrudan 0 dönüyor. `effectiveMinimalMountainThreshold` hesaplaması `overviewCullBoost=0` değerine sadeleştirildi.

## Doğrulama
1. Eski kaynak Git blob'u `0cc7ce7130234eaa1a68785ee46022eaabb8dd2e`, yerel yeniden kurulan dosyayla **birebir aynı SHA**.
2. Değişiklik önce aynı yerel dosyada uygulandı, `node --check` PASS, `eslint js/ tests/` PASS (0 hata, 0 uyarı), conflict marker PASS.
3. GitHub'a yüklenen yeni dosyanın blob SHA'sı, bu testten geçen yerel dosyayla birebir aynı: `0b9c8e94c8391ed4060b35be60e4a4da38609d28`.
4. Çıkarılan yaklaşık **6434 karakter** eski/kapatılmış kaynak kodu. Aktif arayüzün davranışı değiştirilmediği varsayımı ayrıca GitHub `npm run validate` ve `npm run test` CI sonuçlarıyla doğrulanmalıdır.
5. Gerçek tarayıcı görsel regresyon testi ayrı bir kabul maddesi olmaya devam eder.
