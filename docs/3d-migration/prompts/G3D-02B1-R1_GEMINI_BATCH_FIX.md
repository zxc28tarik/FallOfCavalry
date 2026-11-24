# GEMINI — G3D-02B1-R1 / ASKER GÖRSELLERİNİ KORUYARAK BATCH ve VERİ REGRESYONUNU DÜZELT

Bu bir **G3D-02B1 düzeltmesi**, sonraki savaş aşaması değil. Kullanıcının sana verdiği `fall_of_cavalry_g3d_02b1_3d_asker_g_r_n_rl.html` dosyasını tam kaynak al. **Kodunu doğrudan düzelt**, açıklama veya bağımsız mockup sunma. Kullanıcıya **yalnız bir**, çift tıklanabilir, internetsiz, `file://` ile açılabilen **`FallOfCavalry_G3D02B1_R1_DUZELTILMIS.html`** dosyası ver; ZIP/ayrı JS/CSS/test dosyaları indirtme.

## ChatGPT gerçek QA sonucu — DEĞİŞTİRME / GİZLEME
- Ham G3D-02B1 (167124 byte), birebir SHA-256 `7c0771f32474f660968903c488a41fefcf1e9bfd40982a20d944c8ba072da78a`, koruma dalı `archive/gemini-g3d02b1-original-20261123`, arşiv commit'i `f08e4459ad8a785a73ffa9b990c15a195a69af36`.
- ChatGPT QA: `docs/3d-migration/checkpoints/G3D-02B1-INCOMING-20261123.md`. Bağımsız Chromium'da gömülü 5 testin **4'ü geçti, biri KALDI**: 300 asker için `SoldierVisualRegistry.sync().stats.batchCount=22`; birinci test `batchCount <= 16` istiyor. Bu bir gerçek FAIL. Testi kaldırmak veya üst sınırı yükseltmek YASAK.
- Gerçek WebGL görüntüsü bu denetim ortamında doğrulanamadı. Test edildiğini iddia etme. Önceki R2 de ayrı `archive/gemini-g3d02a-r2-original-20261123` dalında korunuyor.

## ZORUNLU GELİŞTİRME 1 — GERÇEK INSTANCING BATCH OPTİMİZASYONU
Şimdi `SoldierVisualRegistry._rebuildInstanceBatches`, `InstancedBatchGroup`, `WebGLRenderer._renderInstancedBatches` katmanını optimize et.
- 300 askerin tüm gövde, kol, bacak, baş, miğfer, kılıç, tüfek, mızrak, at, eyer, kalkan ve renk parçalarını KORU; 3D silueti azaltarak testten geçme.
- Mevcut bölümleme `primitive:material` ile 22 grup üretiyor. Daha büyük gruplarda **per-instance renk / malzeme özelliklerini shader attribute** üzerinden iletip geometriye göre birleştirme kullanabilirsin. Opaque ve transparent parçalar için gerektiğinde ayrı gruplar tut. ANGLE_instanced_arrays kapasitesi, shader program link, attribute divisor reset ve gl buffer yaşam döngüsü güvenli olsun.
- WebGL1 instancing extension yoksa eski fallback yolu çalışmaya devam etsin; renklendirme/ışık hatası olmasın.
- **Merkez 150+150 görünür askerde batchCount <= 16, ideal 4–10**; sayı gerçek hesap sonucu olmalı. Tek bir büyük gizli mesh veya askerleri azaltmak kabul değil.
- Bir snapshot tekrar sync edildiğinde `lastCreated=0` ve cache eski görsel referanslarını korumalı; her frame yeniden model kurma. Sektör 0 -> 1 -> 2 -> boş veri -> geri dönüşte GPU buffer leak olmamalı.
- FPS veya gerçek ekranda görünüm ölçülmediyse başarı iddia etme.

## ZORUNLU GELİŞTİRME 2 — R2 ÖRNEK VERİ GERİLEME KAYBI
Bu işte sadece çizim istenmişti fakat sen R2 `createTestBattleData()` içinde iki grubu değiştirdin. **R2 verisini aynen geri getir**:
- `grp_p_swordsmen_right` yerine R2'deki `grp_p_musketeers_right`: 40 asker, `unitClass: 'musketeer'`, `activeWeapon: 'matchlock_musket'` ve orijinal loadout/armor/pozisyon alanları.
- `grp_e_swordsmen_south` yerine R2'deki `grp_e_arquebusiers_south`: 38 asker, `unitClass: 'arquebusier'`, `activeWeapon: 'arquebus'` ve orijinal alanlar.
- Kesin veriler R2 arşivindeki `ORIGINAL_GEMINI_R2_TEK_HTML.html` içinde. Diğer test gruplarını, asker sayısını, konumları ve veri modelini değiştirme. **Kılıçlı arketip modelini kodda koru**, yalnız R2 verisinde olmayan yeni asker sınıfı eklemek için test ordularını bozma.
- R2 zaten gerçek GitHub `SectorManager` ve `SoldierInstance` kodu değildir; bu sözde altyapıyı gerçek oyunla entegre ettim DİYE SUNMA. Kaynak entegrasyonu ChatGPT'nin korunmuş görev listesindedir.

## DOKUNULMAYACAKLAR
- Önceki kaliteli arazi, doku, yol izleri, kamera, WASD/Q-E/fare/zoom/focus, atmosfer, üç demo sektörü, arayüz, WebGL fallback, close/re-init, görünür/hiddenAlive cap, asker kayıtları ve tüm siluetler.
- `GEMINI.md`, `docs/3d-migration/checkpoints/**`, BEST registry, `archive/**`, Github main/PR, kayıt/backup dosyalarını DEĞİŞTİRME. ChatGPT bütün saklama, BEST seçme ve regresyon kabulü işlemlerini üstlenir.
- Yeni saldırı, yürüme, hasar, simülasyon, AI, deploy, şehir, dünya veya animasyon sistemi ekleme. Bu alt görev tamamlandığında DUR.

## TEST VE TESLİM
1. Kendi mevcut `Birim Testleri` butonunda **5/5 PASS** olmalı, testleri gevşetmeden.
2. Merkez 300, Batı 62, Doğu 50, boş veri 0; aynı snapshot tekrar -> sıfır yeni asker; kamera/resize/dispose/reinit geri dönüşü çalışmalı.
3. Aynı görünür asker model parçalarının ve taraf renklerinin göründüğünü mümkünse gerçek WebGL tarayıcı testinde dene.
4. Önceki R2 iki grup kimliği ve silah/ekipman alanları birebir korunmalı.
5. Tek HTML dış modül/CDN gerektirmemeli; dosya adı **`FallOfCavalry_G3D02B1_R1_DUZELTILMIS.html`**.
6. Gözlem/ölçüm yapılmadıysa dürüstçe belirt. Yeni sürümün 'gerçek FOC kampanya savaşına entegre' olduğunu iddia etme.

**SADECE B1-R1 DÜZELTİLMİŞ TEK HTML'Yİ VER VE DUR.**
