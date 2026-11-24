# GEMINI — G3D-03A-R3: YÜRÜYÜŞ SNAPSHOT'LARINDA KAMERA ODAĞINI KORU (TEK HATA)

## Görev sınırı
G3D-03A-R2 dosyasını (`fall_of_cavalry_g3d_03a_r2_y_r_y_kamera_kadraj_d_zeltmesi.html`) **birebir temel al**. Bu aşamada sadece **`Battle3DRenderer.sync(..., {preserveCamera:true})` parametresinin R2'de yanlışlıkla devre dışı kalması** düzeltilecek. İlk R2 yürüyüş kadrajını koru; bu kez **sonraki bütün yürüyüş leg snapshot'larında kadraj bozulmamalı**. Yeni model, yürüyüş pozları, sınıf, render mimarisi, savaş, AI, performans/optimizasyon, UI tasarımı veya proje entegrasyonu YOK.

**TEK TESLİM**: `FallOfCavalry_G3D03A_R3_KAMERA_ODAGI_KORUNMUS.html`. Tamamen bağımsız offline tek HTML, harici JS/CSS/CDN/ZIP yok. Başka çıktı dosyası istemiyorum.

## Bağımsız QA (2026-11-24)
- G3D-03A-R2 orijinal dosya **309671 bayt, 6669 satır**, SHA256 `f3f571c17de58a92b7b38035a5c356aeeb5bf914e2b2a9a02972c8f4f7029662`; arşiv `archive/gemini-g3d03a-r2-original-20261124`, commit `6b053ae61e0ed16615d9b9146a4a08e13f202515`. QA `docs/3d-migration/checkpoints/G3D-03A-R2-INCOMING-20261124.md`.
- **23/23 birim test**, gerçek Chromium SwiftShader WebGL 3/3 shader LINK true, `glError=0`, merkez 300 (150/150, hidden18/12), 7 asker batch, 11 total draw call, batı62/doğu50/boş0, normal pointer click 1440/768/390px PASS. Gerçek `file://` bu QA ortamında policy nedeniyle `ERR_BLOCKED_BY_ADMINISTRATOR`, ayrı doğrulanmadı. FPS ölçülmedi.
- İlk önizleme kadrajı düzeldi: 1440x900'de sol x=12..364, sağ x=1004..1428 paneller açıkken **8/8 dost yürüyen piyadenin ekran koordinatı açık merkez bölgede**; 16 gerçek yürüyüş kaydı. İlk R1'daki boşa kamera bakma sorunu böylece çözüldü.
- **YENİ REGRESYON:** Bir sonraki yürüyüş aşamasında kamera hedefi otomatik olarak sektör merkezine sıçrıyor. Gömülü test 23 yalnız ilk frame'i saydığı için yanlışı yakalayamıyor.

## Hatanın kesin sebebi
Önceki G3D-03A-R1'in doğru `Battle3DRenderer.sync(snapshot,options)` davranışı:
```js
if (this.cameraController && !options.preserveCamera) {
    this.cameraController.setBoundsAndTarget(derived.bounds, derived.cameraTarget, Boolean(options.snapCamera));
} else if (this.cameraController && options.preserveCamera) {
    this.cameraController.setBoundsAndTarget(derived.bounds, null, false);
}
```

R2 bunu yanlışlıkla:
```js
if (this.cameraController) {
    this.cameraController.setBoundsAndTarget(derived.bounds, derived.cameraTarget, Boolean(options.snapCamera));
}
```
ile değiştirdi. `setBoundsAndTarget` bir `target` alınca `desired.targetX/Z`'yi **zorla** güncelliyor. `_onFrameTick()` periyodik olarak `this.renderer.sync(previewSnap, { preserveCamera: true })` çağırdığından kamera kümeden uzaklaşıyor.

Bağımsız gerçek Chromium'da yürüyüş başlatıldıktan sonra sonraki leg zorlanarak ölçülen **kesin değerler**:
```json
{"beforeLeg1":{"targetX":-17,"targetZ":-19.87,"distance":35,"yaw":-0.14,"pitch":0.78},"afterLeg1":{"targetX":0.1,"targetZ":-3.4,"distance":35,"yaw":-0.14,"pitch":0.78},"legIndex":1}
```
İlk kadrajda yürüyüşçüleri görüyoruz, sonraki leg'de **0.1,-3.4** ordu ortasına hedeflenmesi YANLIŞ.

## Zorunlu en küçük kod düzeltmesi
1. `Battle3DRenderer.sync` içine R1'deki **`options.preserveCamera`** ayrımını geri koy. `preserveCamera:true` çağrısında **bounds güncellensin**, ama `desired.targetX,targetZ,distance,yaw,pitch` otomatik `derived.cameraTarget` ile overwrite edilmesin. Bounds dışında kalmış target varsa yalnız meşru bounds clamp yapılabilir; aktif küme odak koordinatı geçerliyken değişmemeli.
2. `preserveCamera:false` veya parametre yokken normal sektör değiştirme / boş veri / `snapCamera` / merkez odakla davranışları R2'deki gibi çalışmaya devam etsin. `focusOnSectorCenter` ve kullanıcı kamera WASD/pan/zoom/rotation kontrollerini bozma.
3. `_buildWalkPreviewSnapshot` içindeki **dost 8 piyade** focusCenter hesaplaması, `toggleWalkPreview` başlangıç kamerası `distance=35,yaw=-0.14,pitch=0.78`, 16 yürüyen veri seçimi, `_savedCameraStateBeforeWalk` on/off geri dönüş korunacak. Bu fonksiyonlarda gereksiz yeni değişiklik yapma. `_onFrameTick` ve `SoldierVisualRegistry` animasyon mantığını değiştirme.
4. **Sektör değişimi, boş veri, context lost, dispose/reinit** sırasında eski hareket/camera hedefleri taşmasın. `_stopWalkPreviewSilently` davranışı korunur; yeni lifecycle sistemi yazma.

## Gerçek regresyon testi — 24. test (veya aynı güvencenin genişletilmiş 23. testi)
Önceki 23 testi SILME / değiştirerek kolaylaştırma. **Yeni 24. test** tercih edilir:
- Gerçek `createTestBattleData` snapshot ve `Battle3DPreviewController + Battle3DRenderer` fixture üzerinde test panelini (görsel önizleme kontrolünü) başlat; kamera istenen 8 dost piyadeye odaklansın.
- `walkPreviewLeg=0` iken başlangıç `cam.desired` değerlerini kaydet, proje edilen ekran koordinatlarında paneller arası **en az 6 görünür yürüyen piyade** doğrula.
- `walkPreviewElapsed=2.39; walkPreviewNextLegAt=2.4; _onFrameTick(0.02)` yoluyla **fiilen** bir sonraki leg'e geç; `cam.desired.targetX/Z` değişmemiş olsun. Gerekirse `cam.syncTransform(1)` ile projeksiyonu ölç. Aynısını leg 2 ve 3 için doğrula. Sadece ilk leg'i test etme; hiçbir adımda otomatik orta alan odağına dönüşme.
- Kamera önizleme açıkken kullanıcı `panRelative` ve `zoomBy` uygularsa sonraki snapshot aynı kullanıcı pan/zoom'unu korusun; kamerayı istemsiz resetleme. Önizleme kapanınca başlangıçta kaydedilen eski `targetX/Z,distance,yaw,pitch` geri gelsin.
- Gerçek 300 askerden hiçbirinde `viewId,side,groupId,unitClass,activeWeapon,weaponLoadout,armorLoadout,mountType,hp` değişmesin; geçici snapshot sadece 16 askerin pozisyonunu değiştirir. Orijinal `SectorManager` salt okunur.
- Test 24'ün R2'de **FAIL**, düzeltilmiş R3'te **PASS** olması hedefi. Testi boolean sabit döndürerek geçirme. Yeni test sayısı **24/24 PASS** olmalı.

## Fiziksel ekran doğrulaması
- Gerçek Chromium/WebGL'de 1440×900 sol/right paneller açıkken **önizlemeden önce**, ilk yürüyüşte ve **en az iki sonraki yürüyüş leg'inde** screenshot ve projeksiyon kontrolü. Orta alan yaklaşık x364..1004, y84..834; **her aşamada 6+ yürüyen dost piyade** görünür olmalı. Yürüyüş sona erdirilince kamera önceki konumuna geri dönmeli.
- 1440×900, 768×900, 390×844 UI test/yürüyüş tuşları normal pointer ile tıklanmalı, overlay/taşma regresyonu olmamalı. Context kaybı → manuel reinit, üç shader LINK true, `gl.getError=0`. Yapamadığın testi 'DOĞRULANMADI' yaz.
- Gerçek `file://` çalıştırmadıysan PASS deme. FPS/VRAM uydurma.

## KESİN KORUMA KAPILARI
- 206 model şablon, `prim/mat/localMat` tüm parça geometrileri; 44/43/41 piyade, 200 süvari kombinasyonu. `Mat4`, `createSoldierPartTemplates`, `classifySoldierArchetype`, `resolveCavalryVisualVariant` ve eski model görünüşleri değişmesin.
- 12 grup, 442 asker test verisi birebir; 150/150 görünürlük, hiddenAlive 18/12, merkez 300, batı62, doğu50, boş0.
- Swordsman yürüyüş rig testte korunacak, ama normal orduya sahte kılıçlı geçirilmez. Önceki 22. kimlik testi zorunlu PASS.
- 7 asker batch, 11 sahne toplam draw call referansı, GPU instance buffer kullanımı, context loss/restore, fallback ve 23 eski test korunur. 3D preview hâlâ özel `FOC_THREE` WebGL renderer'dır ve gerçek Fall of Cavalry savaş otoritesine bağlı DEĞİLDİR.
- `main`, `archive/**`, `GEMINI.md`, checkpoint ve BEST kayıtları değişmeyecek. ChatGPT aday kaydı / bağımsız QA / koruma ve sonradan entegrasyonu yönetir.

**BİR TEK İNDİRİLEBİLİR HTML**: `FallOfCavalry_G3D03A_R3_KAMERA_ODAGI_KORUNMUS.html`. Kısa diff/test özeti ekle ve **DUR**. G3D-03B/süvari animasyonu/AI/pathfinding/ana oyun entegrasyonu veya şehir sistemlerine GEÇME.
