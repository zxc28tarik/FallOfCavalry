# FOC WEB — Kaynak kod uyarıları ve ölü değişken temizliği (2026-11-17)

**Bağlam:** [77 eski dosya ve asset temizliği](2026-11-17-web-unused-code-assets-cleanup.md) sonrasındaki küçük kaynak kalıntıları.
**Kapsam:** Dört mevcut kod dosyasında, **çalışma zamanı davranışını değiştirmeden** kullanılmayan argüman ve eski ESLint susturma satırları çıkarıldı.

| Dosya | Değişiklik |
|---|---|
| `js/battle/BattleScene.js` | `winner` parametresi sonuç metodu tarafından hiç okunmadığı için aracı callback ve ölü parametre kaldırıldı; savaş sonucu hâlâ `extractBattleResult(sectorManager)` üzerinden hesaplanıyor |
| `js/battle/core/BattleManager.js` | Artık gerekmediği ESLint tarafından bildirilen `eslint-disable` satırı kaldırıldı; stublar korunuyor |
| `js/battle/visual/VisualSoldier.js` | Aynı şekilde gerekçesiz `eslint-disable` kaldırıldı |
| `js/rendering/dimetric/terrain-scene-renderer.js` | Kullanılmayan yalnızca yardımcı fonksiyona ait `drawScreenDiamond` ve `biomeIds` destructure'ları, ayrıca kullanılmayan `snap` destructure'ı kaldırıldı; ana çizim parametreleri ve görünür davranış değişmedi |

## Doğrulama
- Yerel `foc.zip` kaynak kopyasına **aynı metinsel değişiklikler** uygulandı.
- `node scripts/check-conflicts.mjs`: **PASS**.
- `node node_modules/eslint/bin/eslint.js js/ tests/`: **PASS, sıfır hata ve sıfır uyarı** (önceden 6 uyarı).
- `node --check`: 218 JavaScript dosyası, **0 sözdizimi hatası**.
- Bu doğrulama ZIP'teki eski kaynak kopyasına uygulanmıştır; GitHub güncel HEAD için tam `npm test` / Vite build / tarayıcı smoke testleri bu denetimde **koşulmamıştır**.
- `js/main.js`, oyun verileri, harita, şehir ve assetler **değiştirilmedi**.

> Bu temizleme, kullanılabilecek ama henüz uygulanmamış özelliklerin stublarını veya oynanış kararlarını silmez. Daha ileri refactor ayrı test PR'larıyla yapılacaktır.
