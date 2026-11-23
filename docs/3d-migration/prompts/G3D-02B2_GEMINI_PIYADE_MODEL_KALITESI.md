# GEMINI — G3D-02B2: 1650 PİYADE 3D MODEL KALİTESİ (TEK HTML)

## GÖREVİN VE KAPSAM
Sana verilen **`fall_of_cavalry_g3d_02b1_r1_3d_asker_optimizasyonu.html`** dosyasını doğrudan geliştir. Bu bir yeni oyun değildir. Bu turda **yalnız üç piyade şablonunun (mızraklı, tüfekli, kılıç-kalkanlı) 3D insan silueti ve ekipman görsel kalitesini artır**. Atlı modelleri, UI, arazi, kamera, sektör/savaş sistemi ve animasyon ayrı görevlerdir. Kapsam genişletme.

**ÇIKTI: TAM OLARAK 1 İNDİRİLEBİLİR HTML, `FallOfCavalry_G3D02B2_PIYADE_GORSEL_KALITE.html`.** JS/CSS/asset/3D model dosyasını ayrıca indirtme. Tek HTML `file://` üzerinden internet olmadan açılmalı. Tasarım kaynakları gerekiyorsa HTML içine göm.

## BAŞLANGIÇ KORUMASI
- ChatGPT orijinal G3D-02B1-R1'i arşivledi: `archive/gemini-g3d02b1-r1-original-20261123`, commit `16e5c62711db8756692d93ba96607180a8bdd212`; orijinal SHA256 `5a8c7116266f37b28950dd34932f3a1ed553cbd8d53ab4b7fefeb0b2ee7a001b`.
- R1'de **300 görünür asker**, **5 instanced soldier batch**, bütün renk/kimlik, **150+150 limit**, gizli asker sayıları, geri gelen **40 dost tüfekçi** `grp_p_musketeers_right` ve **38 düşman arkebüzcü** `grp_e_arquebusiers_south` değerleri var. Her şeyi koru.
- Aynı HTML'deki tüm arazi/çimen-toprak dokusu/ışık/sis, kamera WASD-orbit-pan-zoom, sektör sekmeleri, boş veri/WebGL uyarısı, `dispose/re-init`, test paneli ve kontroller aynen kalsın.
- Kılıçlı piyade şablonunu görsel şablon kaydında tut; denemek için mevcut R2 gruplarının yerine yeni kılıçlı birlik koyma. `createTestBattleData()`, `projectActiveSector3D()`, `SoldierVisualRegistry.sync()` ve savaş verisini değiştirme.
- Mevcut özel `FOC_THREE`'yi bu görevde başka motorla değiştirme; özellikle sıfırdan daha basit bir renderer yazma. Bu preview hâlâ gerçek FOC runtime veya Three.js ile tam entegre DEĞİL; öyle gösterme.

## YALNIZ PİYADE GEOMETRİSİ VE GÖRÜNÜMÜ
1. `createSoldierPartTemplates()` içinde **insanBase** ve `infantry_pikeman`, `infantry_musketeer`, `infantry_swordsman` şablonlarını iyileştir. Tarihsel 1650 bağlamına uygun, uzaktan da ayırt edilen **ölçülü low-poly** estetik: daha anatomik gövde-omuz/bel ve bacak oranı, kolların birbirinden ayırt edilmesi, el ve bot silueti, kemer/kaftan/ceket, başlık.
2. **Mızraklı piyade:** 3.8 m civarı mızrak/yön, kavrama pozu, omuz/kol uyumu, görünür metal uç. Mızrak havada kopuk veya gövdenin içinden geçiyor gibi görünmesin.
3. **Tüfekçi/arkebüzcü:** uzun namlulu ateşli silah, belirgin ahşap dipçik, iki el tutuşu, uygun başlık ve bantolyer. Silah, kolla ve gövdeyle görsel olarak hizalı olsun. Yeni nişan/atış mekaniği yazma.
4. **Kılıç-kalkanlı piyade:** düzgün tutulan kısa/orta kılıç, kalkan/kabza, diğer sınıflardan ayırt edilen şablon. **Kılıçlı birlikleri mevcut demo ordusuna ekleme**; şablon içi test/ayrı geliştirme önizlemesi yeterlidir.
5. Tarihsel tutarlılık: dönemin Osmanlı ve Avrupa için uygun olabilecek genel referans siluetleri; hiçbir fraksiyona `side` bilgisinden dolayı uydurma benzersiz üniforma zorunluluğu getirme. Aktif gerçek `weaponLoadout`, `armorLoadout` alanlarından olmayan silah takma; mevcut örnekler için yalnız görünen aktif silahın temsili.
6. Askerlerin ölçüsünü ve pozisyon `soldier.position` verisini değiştirme. Hareket/animasyon, çarpışma, hasar, savaş AI, formasyon, deploy ve aftermath ekleme. Yerleşim sabit.
7. **Okunabilirliği artır; parça kalabalığı yapma.** Yakın kamera ve RTS taktik kamera mesafesinde insan/silah siluetinin belirginliğini koru. Gereksiz mikro parçalar yerine anatomik silueti ve malzeme/renk tonlarını iyileştir.
8. Mümkünse az sayıda **paylaşımlı geometri tipi** ve mevcut per-instance RGBA/metalness üzerinden ilerle. Parça/malzeme eklemen gerekiyorsa batch sayısı **5'i tercihen korusun, en fazla 8**; düşürmek için önemli tarihi/siluet detaylarını silme. Mevcut kılıçlı/atlı şablonları dokunmadan koru.

## SINIRLAR / DOĞRULAMA
- Tüm geliştirmeler **tek mevcut HTML üzerinde**; harici dosya yok.
- 300 asker + 5 (veya açıklamalı en çok 8) soldier batch; 300 askerin gerçekten çizimi için WebGL yolu bozulmamalı. `viewId` stable, duplicate=0, boş snapshot=0; sektör 0/1/2 → 300/62/50; hiddenAlive 18/12.
- Kılıçlı/atlı şablonları kaybolmasın. Üç piyade şablonunda eski parçaların ne şekilde korunduğunu veya iyileştirildiğini açıkla; yalnız kaynak kodda daha fazla şekil olduğuna bakıp görsel QA PASS deme.
- Gömülü 5 testi gerçekten çalıştır; en az bir yeni **piyade şablonları ve güvenli silah görünürlüğü** testi ekleyebilirsin, fakat mevcut testleri silme/kolaylaştırma.
- Gerçek tarayıcı/WebGL açıksa ekran görüntüsüyle yakın ve RTS uzaklık görünümünü kontrol et. Yapamadıysan `GÖRSEL QA DOĞRULANAMADI` de. Ölçülmemiş FPS uydurma.
- Tek dosya, bağımsız/offline; yeni snippet, ZIP, PNG, JS, model veya testleri ayrı kullanıcıya teslim etme.

## GITHUB VE SONLANDIRMA
Gemini, `main`, `archive/**`, `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`, `docs/3d-migration/checkpoints/**` dosyalarına dokunamaz. BEST seçimi, arşiv, regresyon karşılaştırması ve son entegrasyon yalnızca ChatGPT'nin görevidir.

**Bitince sadece `FallOfCavalry_G3D02B2_PIYADE_GORSEL_KALITE.html` dosyasını indirilebilir olarak teslim et. Kısaca gerçek değişiklikleri, test sonuçlarını ve kalan sınırlamaları bildir. Sonraki B3 (süvari), animasyon, sektör sistemi veya gerçek FOC entegrasyonuna GEÇME.**
