# Fall of Cavalry — G3D-03C-R1 Antigravity / bağımsız QA ve KABUL

**Tarih:** 2026-11-24  
**Karar:** **ACCEPTED — bağımsız `FOC_THREE` HTML/WebGL 3D görsel önizleme için.** Önceki G3D-03C'de gerçek Chromium'da başarısız olan 31/32/33 görsel pozları ve tek-saldırıya rağmen sonsuz tekrar sorunu düzeldi. Gerçek **37/37** test PASS. Bu kabul, gerçek Fall of Cavalry savaş otoritesi, Unity, AI, hasar, mermi, isabet, cephane veya gerçek savaşa entegrasyon değildir. **Ana `main`, korumalı eski BEST ve diğer arşivler değiştirilmedi.** Antigravity görsel uygulama yardımcısıdır; mimari ve ana geliştirme ChatGPT'de.

## Dosya / kriptografik koruma
- Antigravity'nin teslim ettiği `FallOfCavalry_G3D03C_R1_PIYADE_POZLARI_DUZELTILMIS.html` **420537 bayt / 8779 mantıksal satır**, SHA256 **`8b2eb0974937531fe1734f775335579aa9e171e923262cee27ee73ffaa8e0063`**.
- Kullanıcının ayrıca yüklediği `G3D03C_WORKING.html` tam SHA256 eşit, **420537 bayt / aynı byte**.
- Kullanıcının `ORIGINAL_GEMINI_G3D03C.html` **410812 bayt**, SHA256 **`eed1bb30ec3a75552518ea3b5229c3188abe44c4238a01956fd3bec6f12d68ac`**; eski G3D-03C arşivindeki orijinal ile aynı.
- Yeni orijinal arşiv dalı **`archive/antigravity-g3d03c-r1-original-20261124`**, commit **`6a689c90efee4e7ea80e9f34ff3bcbdec0484e14`**.
- Kaynak dosya: `docs/3d-migration/candidates/G3D-03C-R1/ORIGINAL_ANTIGRAVITY_G3D03C_R1.html`.
- Yerel `git hash-object` **`89088744c77d54c69436bdaa8a0667ddd0869c2d`** = GitHub `fetch_file.sha` **birebir**. Orijinal dosya GitHub'da **içeriği değişmeden** korunmuştur.

## Önceki G3D-03C ile bağımsız regresyon karşılaştırması
- `difflib.SequenceMatcher(autojunk=False)` ile iki HTML'nin her farklı satır bloğu analiz edildi: değiştirilmiş işlevler yalnız `evaluateInfantryCombatPose` (mızrak pitch/thrust; tüfek reload pitch/hand; kalkan yaw/dx), `SoldierVisualRegistry.setSoldierVisualCombatAction`, `SoldierVisualRegistry.sync` ve `SoldierVisualRegistry.update`; yeni **37. test** eklendi. HTML başlık metinleri ve test moduna otomatik girebilmek için küçük `?runTests=1` / `#tests` kolaylığı eklendi.
- **Gerçek Node VM kod yürütme**: Her iki HTML, iki ayrı `vm.runInNewContext`'te üretici fonksiyonları çalıştırılarak kıyaslandı. **206/206 model şablonu**, `prim/mat/localMat[16]` bütün parçalar tam JSON eşit; iki model kanonik SHA256 **`016215bad63bc6db8af0f2798041753cb0e256b4644a5cab0c50ffafb8dcf9e9`**, 0 geometri farkı. (Bu kanonik hash önceki raporlardaki farklı serileştirme/sıralama hash'i ile doğrudan karşılaştırılmaz; aynı yöntemle iki dosya eşit.)
- **12/12 grup, 442/442 kaynak asker**: iki dosyanın `createTestBattleData()` fiilen üretilen çıktı JSON hash'i **`557fb08283ad7c03011937f86e972f6ce0a05fed908866a780fd40e2c7fdfeb5`** ve birebir eşit.
- Piyade 44/43/41 parçalı modeller, 200 süvari varyantı, silah ve ekipmanlar, piyade yürüyüşü ve süvari at yürüyüş/tırıs animasyonları korunuyor; kılıçlı yalnız sentetik test sahnesinde.

## Gerçek Chromium WebGL QA
- Xvfb sanal ekran + gerçek Chromium + ANGLE SwiftShader, HTML `page.set_content(html)`. **`file://` çift tıklama ayrıca test edilmedi**, fiziksel GPU FPS/VRAM ölçülmedi. `node --check` hem orijinal hem R1 scriptte PASS.
- Normal Playwright `#btnRunTests.click()` ile 37 test fiilen yürütüldü. DOM dinamik sonuç **`Sonuç: 37 / 37 doğrulama testi başarıyla geçti.`**; 37 `.test-item`'ın her birinde `pass`, 0 fail; önceki 31/32/33 dahil hepsi PASS. `pageerror=[]`.
- Ayrı bağımsız gerçek GL yaşam döngüsü/sector testi: ilk sahne **300=150/150**, 7 soldier instanced batch, **11 sahne draw call**, üç program **mesh/instanced/line 3/3 LINK_STATUS true**, normal `gl.getError()===0`.
- Sektör 1 **62 (28/34)**, sektör 2 **50 (24/26)**, merkez 300, boş veri **0 asker, 0 batch, 4 draw call**, tekrar normal veri 300. Her aktif GL durumda 3/3 LINK true ve error0.
- `Sahneyi Kapat` **normal pointer click PASS**: lifecycle `KAPATILDI (Disposed)`, fallback visible; `Yeniden Başlat` PASS: yeniden 300/7, 3 shader LINK true, glError0. `Context Kaybı Testi` → `WEBGL HATA / GERİ DÖNÜŞ` fallback, `CONTEXT_LOST_WEBGL=37442` beklenen durum; **manuel** reinit PASS, 3 program ve render geri. Otomatik `webglcontextrestored` donanım/browser ucu doğrulanmadı.
- 1440×900, 768×900, 390×844: `Birim Testleri` ve `Piyade Savaş Pozları` test butonu normal Playwright click ile açılıp kapandı, yatay taşma 0.
- QA kanıt PNG: `/mnt/data/foc_03cr1_qa/initial.png`, `tests.png`, `combat_begin.png`, `combat_after_4s.png`, `combat_after_9s.png`; önceki G3D-03C ile karşılaştırmada 3D sahne, formasyonlar, kamera görünür.

## Tek seferlik saldırı — bağımsız test
- Gerçek Chromium WebGL içindeki **gerçek `SoldierVisualRegistry`/300 asker render kaydından** UI ile `#btnToggleCombatPreview` açıldı: 16 mevcut mızraklı/tüfekli için `isCombatActing=true`.
- Aynı tarayıcıda bu kayıtlar için **260 × 0.05s = 13 saniye simülasyon zamanı** `reg.update(dt)` ile ilerletildi. Sonuç **0 aktif / 16 tamamlanmış / 0 actionBlend**. Aynı `_buildCombatPreviewSnapshot()` yeniden `sync(...,{preserveCamera:true})` edilince **0 yeniden tetikleme**; tüm 16 `combatFinished=true`. Ek 37. test önceki 3 piyade tipinde gerçek `update` döngüsüyle PASS.
- **Sınırlama:** Bu zaman ilerletme gerçek duvar saati/FPS ölçümü değildir. Screenshot `combat_after_9s.png` içinde hâlâ `16 Eylem` görülebilir; yazılımsal SwiftShader render'ın gerçek zamanla aynı miktarda simülasyon `dt` ilerlediği kanıtı değildir. Gerçek hedef cihazda anlık animasyon hızı ayrıca test edilecek.
- `#unitTestPanel` başlığında `(37/37)` hâlâ statik, ama `#unitTestSummary` ve 37 test sonucu çalıştırılarak hesaplanan gerçek sonuç. İleride test bozulduğunda başlık yanıltmasın diye dinamikleştirilmesi küçük UI takibi, **bu tur kabul engeli değil**.

## Sonraki kontrollü kapı
- **G3D-03C-R1 yalnız görsel prototip olarak kabul edildi.** Ana FallOfCavalry savaş runtime'ına veya Unity'ye merge yapılmadı. 
- Önceden planlandığı gibi görsel işlerin büyük bölümünü yeniden üretmeden önce **bir piyade + bir süvariyi** seçerek **Unity taşınabilirlik denemesi** ana geliştiricinin yönetiminde, izole çalışma alanında yapılmalı. Önizleme `FOC_THREE` özel renderer; otomatik FBX dosyası oluşturduğu ya da Unity rig ile doğrudan uyumlu olduğu iddia edilmez. 
- Antigravity yalnız sınırlı yeni görsel görevleri yapabilir; GitHub branch/BEST/main, gerçek battle runtime/AI/Unity entegrasyonunu ChatGPT yönetir.
