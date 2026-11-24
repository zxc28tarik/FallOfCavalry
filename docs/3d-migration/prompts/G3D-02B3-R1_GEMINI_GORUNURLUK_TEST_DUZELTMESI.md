# GEMINI — G3D-02B3-R1: GÖRÜNÜR SÜVARİ TESTİ HATASI (TEK HTML)

## Görev sınırı
**G3D-02B3 dosyasını yeniden yazma.** Kullanıcının sağladığı `fall_of_cavalry_g3d_02b3_at_ve_s_vari_3d_model_kalitesi.html` dosyasını aç. **Yalnızca G3D-02B3'ün başarısız 3. doğrulama testindeki görünür/hiddenAlive süvari sayısı varsayımını düzelt**; koruma ve regresyon kontrolü dışında iş değiştirme. B4, animasyon, savaş AI, yeni kod modülleri, yeni at modelleri YASAK.

## Bağımsız ChatGPT QA bulguları — gerçek sonuç
- Orijinal B3 GitHub arşivi: `archive/gemini-g3d02b3-original-20261124`, commit `57a1dc6230c3dda623a11b9446603a22ba779d2d`; `docs/3d-migration/checkpoints/G3D-02B3-INCOMING-20261124.md`.
- B3 yüklemesinin SHA256'sı: `0cafaf8fb577b7f5af229a2885b4147bd314a677ec756cfffa13d9c5813a8122`.
- Bağımsız Node VM ve gerçek Chromium/WebGL testinde **5 gömülü testten yalnızca 4'ü PASS**, test #3 FAIL.
- Hata metni: **`Merkez dost süvariler kılıçlı (32) olmalı, gelen: 14`**.
- Gerçek merkez sektör toplamı: oyuncuda 168 kişi, düşmanda 162; G3D-01 görünür limit **150 dost + 150 düşman**. **18 dost + 12 düşman hiddenAlive**.
- Bu yüzden tam grup 32 kılıçlı ve 30 mızraklı süvari olarak veride bulunsa da görünür `projectActiveSector3D(sm).soldiers` listesinde **14 sabre + 18 lance** var. B3'ün `SoldierVisualRegistry.sync` bunu doğru gösteriyor; sorun testin tam grup sayılarını görünür sayı sanması.
- Sektör 1 (Batı) = **28 karabina + 34 tabanca** = 62 görünür. Sektör 2 (Doğu) = **24 karabina + 26 kılıç** = 50 görünür.
- 7 soldier instance batch, gerçek Chromium'da toplam sahne draw call **11**; `gl.getError()=0`, shader programları link PASS, boş mod/sector switch/dispose/reinit çalıştı. Bu rakamları değiştirmek veya yeniden optimize etmek bu görevin konusu değil.

## Yapılacak tek düzeltme
1. `runBattle3DUnitTests()` içindeki **`runCase('3. Süvari Aktif Silah Seçimi ...'`** testini gerçek görünürlük mantığına göre onar.
2. Beklentileri **tam `UnitGroup.soldiers.length`** üzerinden değil `s0Snap.soldiers` ve `classifySoldierArchetype(s)` / `resolveCavalryVisualVariant(s)` üzerinden hesapla. Görünür aktif silahlara göre doğru sayıyı test et. Merkez için `s0Stats.cavalryWeapons.sabre===14` ve `s0Stats.cavalryWeapons.lance===18` beklenir; bunun neden böyle olduğunu yorumda açıkla. Tercihen görünür snapshot'tan hesapla ve ayrıca bilinen 14/18 sınırını kontrol et.
3. Ayrıca merkezde `s0Snap.visible.player===150`, `s0Snap.visible.enemy===150`, `s0Snap.hiddenAlive.player===18`, `s0Snap.hiddenAlive.enemy===12` doğrula. Gizli askerleri sayımdan silme veya onları görünür yapma!
4. Sektör 1'de 28 carbine + 34 pistol ve sektör 2'de 24 carbine + 26 sabre eşleşmelerini koru. Bunları asker verisine ve `activeWeapon`'a bakarak doğrula. Bir asker kılıçlı değilse sırf test için kılıçlıya dönüştürme.
5. Başarısız test koşullarını kaldırma, teste `return true` yazarak geçirme veya gerçek kontrollere dokunma. Rapor, gerçekten test çalıştırıldığında **5/5** olmalı.
6. Mümkünse B2'den taşınan sektör değişimi/boş snapshot ve aynı viewId test kapsamasının hâlâ bulunduğunu da doğrula; eski diğer 4 testi silme veya kolaylaştırma.

## KESİN KORUMA
**B3'ün 200 süvari şablonunu**, at anatomisi ve silah görünümünü, B2'nin mızraklı 44/tüfekçi 43/kılıçlı 41 piyade parçalarını, zemin, kamera, WebGL renderer, 7 batch, 12 grup ve konum/kimlik, 150/150 limit, 18/12 hiddenAlive, sektör 0→1→2, fallback/boş veri, dispose/re-init, HUD ve CSS'yi aynen koru.
- B3'teki yeni `cavalry_lance`, `cavalry_sabre`, `cavalry_carbine`, `cavalry_pistol` modelleri ve örnek grupların aktif silahları değişmemeli.
- `FOC_THREE` yerine yeni motor yazma, Three.js ekleme; proje gerçek ana FOC runtime'a bağlı değildir, bağlıymış gibi iddia etme.
- **Sadece test #3'ün yanlış beklentisini düzeltmek**, gerekirse küçük test açıklaması güncellemek serbest; üretim rendering/savaş/veri/modele dokunma.

## Teslimden önce QA
- HTML inline CSS/JS; internet/CDN/harici kaynak yok. Mümkünse `file://` üzerinden aç; test ortamı kısıtını doğru bildir.
- Gömülü 5 testin tamamını gerçekten çalıştır. Gerçek Chromium/WebGL açabiliyorsan merkez 300 / batı 62 / doğu 50, aktif silah sayaçlarını, 7 soldier batch, Shader LINK_STATUS, gl.getError ve dispose/reinit'i doğrula. Ölçülmemiş FPS uydurma.
- Test/üretim kodu diff özetinde **hangi satırları değiştirdiğini** kısaca belirt. Orijinal HTML'nin kalan işlevleri korunmalı.

## GitHub yetkisi ve tek teslim
GitHub arşivleri, BEST kaydı, sürüm karşılaştırması ve son entegrasyon **ChatGPT'nin sorumluluğunda**. Gemini `main`, `archive/**`, `GEMINI.md`, checkpoint, koruma scriptleri ve BEST dosyalarına **dokunmayacak**.

**TEK DOSYA:** `FallOfCavalry_G3D02B3_R1_TEST_DUZELTILMIS.html`. Kullanıcıya sadece 1 indirilebilir, bağımsız, offline HTML ver; ayrı ZIP/JS/CSS/test/model isteme.

**G3D-02B3-R1'i bitir ve DUR.** B4 veya başka aşamaya geçme.
