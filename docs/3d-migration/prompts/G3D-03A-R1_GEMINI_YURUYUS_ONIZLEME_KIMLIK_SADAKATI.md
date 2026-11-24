# GEMINI — G3D-03A-R1: YÜRÜYÜŞ ÖNİZLEMESİNDE MODEL / SİLAH KİMLİĞİNİ KORU

## GÖREV — HATA DÜZELTMESİ, YENİ AŞAMA DEĞİL
Sana verilen **`fall_of_cavalry_g3d_03a_piyade_3d_hareket_ve_y_r_y_g_rselleri.html`** dosyasını birebir temel al. Gemini sadece bu HTML üzerinde en küçük gerekli düzeltmeleri yapacak. **G3D-03A-R1** yürüyüş önizlemesinin mevcut askerlerin görsel kimliği, sınıfı ve aktif silahını değiştirmesi sorununu düzeltir, bunu yakalayan bir regresyon testi ekler ve mümkünse önizlemenin görünürlüğünü küçük kontrollü bir kamera düzenlemesiyle iyileştirir. **G3D-03B, süvari animasyonu, savaş AI, gerçek FOC entegrasyonu, yeni modeller ve yeni HUD sistemleri YOK.**

YALNIZCA 1 bağımsız indirilebilir çevrimdışı HTML:
**`FallOfCavalry_G3D03A_R1_ONIZLEME_KIMLIK_DUZELTMESI.html`**.
Tek script ve CSS içeride, harici CDN/JS/CSS/model/ZIP yok.

## Bağımsız ChatGPT QA — gerçek kanıt
- Orijinal G3D-03A **298527 bayt**, 6418 satır, SHA256 `70ab87c14b5dc88a7346accc1215435305ec5a3d9023307e84a6ecc6068cd1cd`. Arşiv branch `archive/gemini-g3d03a-original-20261124`, commit `e8fb449d83e56dbec8c379aa537a2a7961c2a95d`. Rapor `docs/3d-migration/checkpoints/G3D-03A-INCOMING-20261124.md`.
- Gerçek Chromium/SwiftShader'da gömülü testler **21/21 PASS**; 3 shader LINK true, glError 0; merkez 300=150/150, 7 soldier batches, 11 total scene draw calls; batı 62, doğu 50, boş 0; 1440/768/390px üst bar normal pointer tıklanabilir.
- 16 piyade önizlemesi **gerçekten yürüyor**: sabit `viewId`, x=-16→-13.304 (hedef -10.5), `walkPhase` artıyor, `walkBlend` 0→1; önizleme kapandıktan ~3.5s sonra x ve `walkBlend` başlangıç/0 ve movingCount=0.
- **BÜTÜN MODEL KORUMASI GEÇTİ:** Eski G3D-02C-R1 ile bütün **206 şablonun** her parçasının `prim`, `mat`, `localMat[16]` dizisi birebir aynı. 6 piyade (44/43/41 iki taraf) + 200 süvari. Aynı 12 grup ve 442 asker verisi birebir aynı. `rigGroup` etiketi yeni ama orijinal model geometrisi aynı.
- **TESTLERİN KAÇIRDIĞI HATA:** `Battle3DPreviewController._buildWalkPreviewSnapshot(legIndex)` şunu yapıyor:
  ```js
  const previewClass = previewedInfantry % 3 === 0 ? 'swordsman' : s.unitClass;
  const previewWeapon = previewedInfantry % 3 === 0 ? 'broadsword' : s.activeWeapon;
  return { ...s, unitClass: previewClass, activeWeapon: previewWeapon, position: {...} };
  ```
  Bu yüzden hareket önizlemesinde **5 mevcut askerin aynı viewId'si altında sahte model/silah gösteriliyor**. Dört mızraklı **pikeman/pike→swordsman/broadsword**, bir tüfekçi **musketeer/matchlock_musket→swordsman/broadsword**. Gerçek gözlenen ID'ler: `SECTOR_1650_01:grp_p_pikemen_center_s3`, `_s6`, `_s22`, `_s43`, `SECTOR_1650_01:grp_p_musketeers_left_s10`.
  Bu onaylanmadı. `SectorManager` kaynak verisi değişmiyor ama anlık **SoldierVisualRegistry.templateKey gerçekten değişiyor**. Gerçek savaş görselleştirmesinde bu ciddi kimlik hatasıdır.

## ZORUNLU DÜZELTME
1. `_buildWalkPreviewSnapshot` hareket edilen 16 asker için **yalnız `position` değerini kopya snapshot üzerinden değiştir**. Her asker için `viewId`, `soldierId`, `groupId`, `unitClass`, `activeWeapon`, `weaponLoadout`, `armorLoadout`, `mountType`, `bodyType`, `combatRole`, `side`, `hp`, `state` **birebir kaynak snapshot ile aynı kalsın**. `createTestBattleData`, `SectorManager` veya orijinal `SoldierInstance` örneklerini kesinlikle mutasyona uğratma.
2. **Önizlemede olmadığı hâlde kılıçlı gösterme.** Mevcut test ordusunda gerçek `swordsman` birliği YOK; yalnız pikeman ve musketeer var. Normal demo ordusunu **sırf üç sınıfı göstermek için değiştirme**. İki gerçek piyade sınıfının yürüyüşünü göster; swordsman yürüyüş algoritmasını eski test 15 ve 16'daki bağımsız sentetik `SEC_GAIT:sw` / `SEC_WEP:sw` senaryolarında koru. Kılıçlıyı ayrıca görselleştirmek istersen yalnız bağımsız ve açıkça etiketlenmiş izole test sahnesinde **yeni ayrı test-only viewId** kullan; hiçbir orijinal askere kılıç modeli giydirme ve 300 görünür sınırını bozma. Bu son özellik isteğe bağlı, G3D-03A-R1 için şart değil.
3. Önizleme UI açıklamasını GERÇEK örnek gruplara göre dürüst yaz: merkezde yürüyüşe çıkan **mızraklı ve tüfekli piyadeler**. Swordsman görselini normal orduda varmış gibi iddia etme.
4. `SoldierVisualRegistry` `sync()` mevcut viewId için şablon değişikliğine izin vermeye devam edebilir: gerçek oyun verisinde aktif silah gerçekten değişirse görünüm değişmelidir. Sorun **preview klonunun sahte `activeWeapon` değiştirmesi**. Registry'de asıl gerekli davranışı devre dışı bırakma.

## YENİ TEST — ÖNCEDEN FAIL, DÜZELTİLDİKTEN SONRA PASS
Önceki **21/21** testi aynen tut. Yeni **22. gerçek birim testi** ekle:
- Gerçek `createTestBattleData` + `projectActiveSector3D` ile merkez snapshot hazırla.
- `_buildWalkPreviewSnapshot(0)` ve devamındaki legIndex 1/2/3 snapshot'larını üret; mümkünse bu testin controller bağımsız fiilen çalışması için minimal gerekli fixture kullan, protokolü değiştirme.
- Her kaynak ve preview `viewId` için **tüm kimlik/silah/zırh sınıf alanları deep equal**; `position` ayrı yeni obje olabilir ve yalnız örnek 16 askerinki değişebilir. `SectorManager` kayıtları deep freeze/canonical snapshot kıyaslamasıyla mutasyonsuz.
- `SoldierVisualRegistry.sync(preview)` öncesi/sonrası **her viewId için `templateKey` aynı** (piyade/kalkan/aktif silah dönüştürme yok).
- 16 asker pozisyon hedefi ve interpolasyon çalışmalı; ON→OFF devamında aynı model, aynı 300 visible / 7 batches, `movingCount` sonunda 0.
- Swordsman isolated tests 15/16 devam etmeli. Test 22 yalnız sabit sayı doğrulaması değil, **kaynak→preview map eşitliği** üzerinden çalışmalı. Testleri kaldırmak/şart gevşetmek yasak.

## ÖNİZLEME GÖRÜNÜRLÜĞÜ (KÜÇÜK/OPSİYONEL)
- Bağımsız QA ekran görüntüsünde 16 yürüyen örneğin çoğu ekranın sol kenarında, mevcut iki büyük panel nedeniyle görsel kalitesi anlaşılması zor. Uygun olursa **yalnız 'Yürüyüş Önizlemesi' başlatılırken seçilmiş piyadelerin yakınındaki bir noktaya kamerayı yumuşakça odakla**, kontrolü kullanıcıdan alma ve önizleme kapanınca mümkünse önceki kamera hedefini geri getir. **Kamera sınıfının davranışını veya önceden çalışan responsive UI'yi genel olarak değiştirme.** Böyle bir işlem riskliyse ekleme; birinci öncelik model kimliği.
- Kullanıcı test panelinden önizlemeyi başlatabilsin; üst menüye yeni düğme koyma. Yürüyen örnekler 1440×900'de gerçekten ekranda seçilebilir olmalı.

## KORUMA — HİÇBİR GERİLEME
- Önceki G3D-03A: 21/21 test, model 206 şablon ve `localMat` geometrisi, `rigGroup` yürüme, `Mat4.fromPivotEulerOffset`, `computeInfantryPartLocalMatrix`, 16 piyade yürüme, hedef interpolasyon, yön dönüşü, duruşa dönüş.
- 12 grup 442 asker ham veri, 150/150 sınır, hidden 18/12; merkez 300, batı 62, doğu 50, boş 0, kaynak ordu verisi salt okunur.
- 7 asker çizim grubu, shader link ve context lost/restored, `bufferSubData` ile mevcut GPU instance buffer yeniden kullanımı, ANGLE fallback, dispose/reinit, tüm WebGL kontrolleri ve responsive arayüz aynen korunur.
- **FOC_THREE custom önizleme**, gerçek Three.js değil, gerçek battle runtime/AI entegre değil. Bu turda entegre etmeye çalışma.
- Performans takibi: `_updateBatchBuffersInPlace` şu an her hareketli karede bütün asker part matrisi üzerinden geçer, `new Int32Array` üretir ve bütün batch'leri `bufferSubData` ile günceller. Bu durum 0 GPU buffer allocation ile aynı şey değildir. R1 scope'unda kapsamlı GPU optimizasyonuna girme; sonucu dürüst belirt ve sonraki aşamaya risk olarak kaydet, FPS uydurma.

## BAĞIMSIZ QA / TESLİM
1. HTML JS parse ve tek offline script PASS.
2. **22/22 gömülü test gerçekten PASS**, özellikle yeni test 22 eski HTML'de FAIL olmalı.
3. Gerçek Chromium/WebGL mümkünse normal fareyle test paneli ve yürüyüş önizlemesi, 16 piyade hareketi, sınıf/aktif silah kimliği sabit, shader 3/3 LINK true, glError 0, 300/62/50/0, 7 batch, kapatma/yeniden açma kontrolü. file:// doğrudan denenmediyse 'doğrulanmadı' olarak yaz.
4. Model ve ordu verilerini eski G3D-03A HTML'yle `prim/mat/localMat/ID` bazında karşılaştır; grafik kalitesini koru.
5. Hangi satırlarda düzeltme olduğunu ve nedenini 3–6 cümleyle açıkla, bitir.

**TEK HTML DOSYASI: `FallOfCavalry_G3D03A_R1_ONIZLEME_KIMLIK_DUZELTMESI.html`.** GitHub `main`, `archive/**`, BEST ve checkpoint/koruma dosyalarına dokunma; ChatGPT kod denetimini ve kaynak arşivini yönetir.

**R1'i bitir ve DUR.** G3D-03B/animasyon genişlemesi/süvari saldırısı/AI/pathfinding/gerçek FOC entegrasyonu YOK.
