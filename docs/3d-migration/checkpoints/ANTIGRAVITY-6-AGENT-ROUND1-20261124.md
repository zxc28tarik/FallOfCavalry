# Fall of Cavalry — Antigravity 6 Ajanslı Tur 1 / Bağımsız QA

**Tarih:** 2026-11-24. **Karar:** **6/6 BAĞIMSIZ ADAY PASS**; **henüz birleşik G3D-03D kabul edilmedi**. Ana geliştirici ve sürüm/merge denetimi ChatGPT'de, Antigravity yalnız görsel uygulayıcı.

## Kullanıcı ZIP arşivi ve korunan baseline
- ZIP: `focvisi(1).zip` (**1,993,760 bytes / 44 kayıt**), SHA256 `102cb99301ab3b63659f67420427cabfe1d7d10a896263bf8cbe8207d16aaf5c`. Konuşmada tam orijinal korunmuştur; sandbox birebir sabit kopya `/mnt/data/FOC_6_AJAN_TUR1_ORIJINAL_20261124.zip`.
- Korunan base: `BASE_KORUNMUS_G3D03C_R1.html` 420,537 byte, SHA256 `8b2eb0974937531fe1734f775335579aa9e171e923262cee27ee73ffaa8e0063` = önceki kabul edilmiş Antigravity G3D-03C-R1.
- ZIP altı bağımsız `AJANLAR/01..06/DELIVERABLE.html` ve her biri için eşit `WORKING.html`, `CHANGELOG.md`, `TASK.md`, bazılarında patch ve screenshot içeriyor. Her ajan kendi dosyasını değiştiriyor; ortak baseline bozulmamış.

## Bağımsız Node VM geometri + ordu karşılaştırması
Altı HTML'nin `createSoldierPartTemplates()` ve `createTestBattleData()` fonksiyonları **ayrı JS sandbox'larında gerçekten çağrılıp** base ile kıyaslandı.
- **6/6 adayda 206/206 model anahtarının her parçasının `prim/mat/localMat[16]` değerleri birebir aynı.** Ajan 01 ve 02 yeni animasyon için rigGroup metadata'sı ekledi, bu nedenle tüm nesne JSON hash'i değişebilir; orijinal mesh verisi değişmedi.
- **6/6 adayda 12 grup/442 asker kaynak verisi derin JSON eşit.** Kimlik, aktif silah, pozisyon, ekipman, yan/HP bozulmadı.
- Tek inline JS, harici script/CDN yok, **6/6 `node --check` PASS**.

## Gerçek Chromium + Xvfb + ANGLE SwiftShader
HTML `page.set_content` yöntemiyle, her aday ayrı context'te normal `#btnRunTests` kullanıcı pointer tıklaması. `file://` doğrudan çalıştırma veya fiziksel GPU FPS ölçülmedi.

| Ajan | Yetki sınırı | Gerçek sonuç | SHA256 (DELIVERABLE) |
|---|---|---|---|
| 01_ATLI_MIZRAK | süvari mızrak görsel hamlesi | **38/38 PASS** | `e108fd72f82bae1a8d7ae41d2c18c79efb9fa5f8e8815f58500e8a373051aac2` |
| 02_ATLI_KILIC | süvari kılıç savuruşu | **38/38 PASS** | `b7587460bbdff99bdc1d2c61ff07d13034e9b488c0f2b05acc7ea159aaa81b72` |
| 03_ATLI_ATESLI | süvari karabina/tabanca pozları | **38/38 PASS** | `32e5b010584bca10b82a4ece63720945f2368d83537de3f6a71cbeb4e4147cd5` |
| 04_AT_TOYNAK | at gait/toynak/5 at tipi | **38/38 PASS** | `e43a694e78763e45d37737e92e2c9852f143d68518662a8ea5474f6da9fb74ce` |
| 05_KARA_BARUT | namlu flash/duman FX buffer | **38/38 PASS ayrı uzun tekrar** | `68f6fbc5730326bb168e2501090b98bbde4ce04e5c01bc6791ee8a3959cc1f37` |
| 06_SAHA_GORSELLIK | zemin/ışık/sis/siluet | **38/38 PASS** | `e3455b1a4f02cd9bc3a223cd1e1fcd431c018841540ead306fe826c6c727adca` |

İlk 05 denemesinde Playwright click 10s timeout; **yeniden Chromium + 90s izinli aynı doğal pointer click** ile 47.18 saniye sonra `38/38`, 38 sonuç, `fail=[]`, `AKTİF (WebGL)`, fallback gizli, `pageerrors=[]`. 05 test38 mock GL'de çok sayıda renderer draw çağrısı yapar; yavaş SwiftShader performansı **ayrı takip riski**, başarısız test değildir. Diğer adaylar ilk seferde geçti.

Altı adayda ilk WebGL sahnesi `300 (7 Batch)`, `150/150`, `Instanced WebGL (ANGLE)`, `glError=0`, `pageerrors=[]`. **Her adayın tüm sektör/context/dispose/mobile döngüsü bu turda bağımsız uçtan uca yeniden sınanmadı;** önceki test suite'i korundu ve test 38 çalıştı.

## Birleşik sürüm için engeller
1. Ajan **01/02/03 aynı `computeCavalryPartLocalMatrix` ve `SoldierVisualRegistry` lifecycle/sync/update yöntemlerini değiştiriyor**. Bir ajanın `DELIVERABLE`sı diğerini dosyayı üzerine yazmakla siler. Fonksiyon tabanlı görsel entegrasyon gerekir, sonuca göre yeni birleşik HTML test edilmeli.
2. Ajan 04 at `walkBlend/trotBlend` ve binici rig matematiğini değiştirmiş; 01/02/03 saldırı state'iyle birleştirirken pozların çakışmaması gerek.
3. Ajan 05 WebGL draw/transparent blend/depth state ve FX instance pool ekliyor. 7 soldier batch korunurken FX eklendiğinde toplam draw call sayısı değişebilir; GPU context lost/dispose/reinit ve kısa efekt ömrü ayrıca ölçülmeli. Test stres süresi 47.18s.
4. Ajan 06 shader, sis/ışık/terrain değiştiriyor; Agent 05 şeffaf dumanıyla kombine görsel QA şart. Görsel tercih kullanıcı onayı gerektirebilir.
5. Her ajanın ek testi **38** numaralı ve farklıdır. Birleştirilmiş HTML'de önceki 37 ile altı yeni test **38–43** olacak, **43/43 gerçek Chromium PASS** beklenir. Header'a sabit 43/43 yazmak test sonucu değildir.
6. Ayrı ajan PASS =/= birleşik sürüm PASS. **Şu anda kabul edilmiş son bütünleşik kaynak G3D-03C-R1**, GitHub `main`, BEST, gerçek battle ve Unity'de hiçbir değişiklik yok.

## Sonraki adım
`docs/3d-migration/prompts/ANTIGRAVITY-G3D03D-6-AGENT-SAFE-VISUAL-INTEGRATION-20261124.md` görsel kod birleştirme brifi. Tek yazıcı ajan + aynı anda 5 bağımsız salt okunur QA ajanı; ana geliştirici ChatGPT oluşacak tek HTML'yi yeniden bağımsız denetleyecek. Orijinal ZIP/kaynaklar korunacak.