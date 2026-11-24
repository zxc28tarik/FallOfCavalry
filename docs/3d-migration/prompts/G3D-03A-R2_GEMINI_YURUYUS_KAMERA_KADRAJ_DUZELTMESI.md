# GEMINI — G3D-03A-R2: YÜRÜYÜŞ ÖNİZLEMESİ KAMERA KADRAJINI DÜZELT

## YALNIZCA BİR HATA — YENİ GELİŞTİRME AŞAMASI DEĞİL
Verilen **`fall_of_cavalry_g3d_03a_r1_y_r_y_nizlemesi_kimlik_d_zeltmesi.html`** dosyasını temel al. G3D-03A-R1'deki **22/22 test, 206 asker/süvari görsel şablonu ve 442 asıl asker verisi birebir korunmuş, 16 yürüyüşçünün kimlik/aktif silah değişimi 0'a düşmüş**. Ama yürüyüşü görünür kılmak için eklediğin otomatik kamera hareketi, örnekleri kadrajdan çıkartıyor.

**BU GÖREV SADECE OTOMATİK YÜRÜYÜŞ ÖNİZLEMESİ KAMERA KADRAJINI DÜZELTİR.** Yürüyüş, modeller, soldier registry, preview veri kimliği, animasyon, savaş mekaniği, UI tasarımı, maliyet/performans/AI/gerçek oyun entegrasyonu değişmeyecek. Tek offline HTML: **`FallOfCavalry_G3D03A_R2_KAMERA_KADRAJ_DUZELTILMIS.html`**.

## NET HATA / BAĞIMSIZ GERÇEK CHROMIUM KANITI
- Önceki R1 orijinal SHA256: `40fe66eb9227e122ff6e82d1f9a741dbd2eac086506383ca643df22a2bbff580`.
- Orijinal GitHub arşiv branch `archive/gemini-g3d03a-r1-original-20261124`, commit `ca02697b94e8e1aa2f385efa63efee13af001760`, yol `docs/3d-migration/candidates/G3D-03A-R1/ORIGINAL_GEMINI_G3D03A_R1.html`. QA raporu `docs/3d-migration/checkpoints/G3D-03A-R1-INCOMING-20261124.md`.
- Gerçek Chromium / 1440x900: `#btnRunTests` normal pointer ile çalışır; **22/22 PASS**, 3 shader LINK true, glError 0, 300 asker, 7 instanced batch, 11 sahne draw call. 1440/768/390 responsive pointer PASS. Model ve data, önceki 03A ile Node VM üzerinden `206/206` ve `442/442` eşit.
- Yürüyüş başlatılınca `toggleWalkPreview()` R1 içinde şu kuralı kullanıyor:
```js
cam.desired.targetX = cam._clamp(focusCenter.x, cam.bounds.minX, cam.bounds.maxX);
cam.desired.targetZ = cam._clamp(focusCenter.z, cam.bounds.minZ, cam.bounds.maxZ);
cam.desired.distance = 22;
cam.desired.pitch = 0.76;
```
- `_buildWalkPreviewSnapshot()` **8 dost + 8 düşman** yürüyen askerin orta koordinatından `focusCenter` üretiyor. Gerçek çıktı `{targetX:0,targetZ:-18.870625,distance:22,yaw:0,pitch:0.76}`. İki ordunun ortasında kimse olmadığından 1440x900 ekranda **boş çimenli orta alan** büyüyor; askerler **sol sidebar, sağ test drawer arkasında veya kadraj dışı** kalıyor. Bu görsel kabul engeli.
- Değişiklik yüzünden otomatik önizlemenin kadraj kalitesi önceki 03A'dan da kötü. Herhangi bir `22/22` sonucu, insanların **yürüyen askerleri göremediği** sorunu geçirmez.

## İSTENEN MİNİMUM DÜZELTME
1. Önizleme kamerasını 16 kişinin iki cephe arasındaki aritmetik orta noktasına değil **gerçekten yakın bir yürüyen kümenin** yanına koy. Örneğin mevcut **8 dost yürüyüşçü (4 pikeman + 4 musketeer)**, ordu verisini değiştirmeden zaten `_buildWalkPreviewSnapshot` içinde seçiliyor. Dost tarafı kameranın birinci görsel hedefi olabilir. Diğer düşman 8'i arka planda hareket etmeye devam etsin; hepsini aynı dar zoom içinde görmeye çalışmak şart değil.
2. Otomatik kamera hedefini `cam.bounds` içinde tut; ancak `distance=22` değerini zorunlu sabit alma. Piyade kümesini ve boylarını ekranda okunur tutacak, fazla genişleyip hepsini nokta yapmayacak uygun RTS kamerayı ayarla. `yaw`, `pitch`, mesafe ve kadrajı gerçek 1440x900 ekranında test ederek seç.
3. **GÖRSEL KABUL ÖLÇÜTÜ:** 1440×900'de üst bar açık, sol bilgi paneli ve sağ test paneli açıkken **en az 6 gerçek yürüyen piyade** iki panel arasındaki engellenmemiş orta alanda (yaklaşık x=365–1000) görüntüde açıkça seçilebilsin. Gerçek kameranın anlık/smooth geçiş hâlini bekleyerek screenshot al. Sadece kameranın hedef koordinatının makul olması YETERLİ DEĞİL. Asker başı/ayakları görünür, sınıf silahları seçilebilir, ekranın ortası boş çimenlikle dolu kalmamalı.
4. Eğer iki panel açıkken kadrajı sağlamak zor ise **yalnızca kamera kompozisyonunu** düzelt; panel içeriğini yeniden tasarlama, hiçbir paneli otomatik gizleme, üst bar butonu veya yeni odak/seçim UI'sı ekleme. Önizleme, mevcut fare/WASD kamera kontrolünü kilitlemesin.
5. `_savedCameraStateBeforeWalk` ile kullanıcı kamerasını doğru koru: Önizleme kapanınca eskiden kaydedilen `targetX,targetZ,distance,yaw,pitch` geri gelsin. Kapatma, sektör/boş veri geçişi, context kaybı ve yeniden başlatma sırasında ghost kamera animasyonu bırakma. Aynı önizlemeyi iki kez başlatınca eski hedef değerleri tekrar overwrite edilmesin.
6. Kodda yalnız `Battle3DPreviewController._buildWalkPreviewSnapshot` içindeki **focusCenter hesaplaması**, `toggleWalkPreview` içindeki kamera hedefi/mesafesi ve zorunlu ise kamera geri yükleme/minimal test değişsin. **Asker snapshot verisine, 16 yürüyen seçimine, offsets/legIndex, model/rig, GPU, diğer sistemlere dokunma.**

## KESİN KORUMA / REGRESYON KAPILARI
- R1 gömülü **22/22** eski test, yeni 22. testin 300 kaynak/preview `viewId` kimlik/aktif silah/ekipman alanı karşılaştırması **değişmeden kalacak**.
- 16 askerin *aynı* `viewId`, `unitClass`, `activeWeapon`, `mountType`, `weaponLoadout`, `armorLoadout`, `side`, `hp`, `state`; yalnız kopya pozisyonları değişir. Swordsman modeli mevcut orduya giydirilmez. `SectorManager` hiçbir zaman mutasyona uğratılmaz.
- `createSoldierPartTemplates()`: 206 model şablonunun tüm parça `prim/mat/localMat[16]` değerleri korunacak; piyade **44/43/41** ve 200 süvari görsel kombinasyonu.
- `createTestBattleData()`: 12 grup ve **442** asker verisi birebir. Merkez **300 (150/150), hiddenAlive 18/12**, batı **62**, doğu **50**, boş veri **0**.
- 7 instanced soldier batch / normal 11 scene draw calls referansı; üç shader LINK_STATUS, glError 0; WebGL context loss/restore, dispose/reinit, `bufferSubData` ve fallback yolları korunur.
- Responsive normal click: `#btnRunTests`, `#btnToggleWalkPreview`, sektörler, kamera kontrolü 1440×900 / 768×900 / 390×844 ekranlarda erişilebilir. Üst menüye yeni düğme koyma.
- Bu dosya **özel FOC_THREE WebGL önizlemesi**, gerçek 2D savaş veya ana FallOfCavalry battle runtime'ına bağlı değildir; entegre olmuş gibi söyleme.

## TEST VE TESLİM
- Eski **22/22 birim testlerini değiştirmeden** çalıştır. Ayrıca yeni **23. kadraj regresyon testi** ekle: aynı 16 hedef seçimi korunurken kamera örnekleri **düşman+dost aritmetik ortasını dar zoom ile hedeflememeli**; minimum 6 dost yürüyen örneğin kamera projeksiyonuyla görünür alanda olduğuna dair ölçüm yapabilir. Bu birim testi tek başına geçmesi yeterli DEĞİL: **gerçek tarayıcı screenshot'ı ile** 6 görünür askeri ayrıca doğrula. Browser verisi mevcut değilse gerçek görsel PASS uydurma.
- Kamera hareketi oturduktan sonra **önce / yürüyüş sırasında / sonra** gerçek tarayıcı görüntülerini değerlendir. Sonra screenshot linkini veya açıklamasını sağla (kullanıcıdan ayrı dosya indirmesi isteme). PNG/gif oluşturup tek HTML teslim kuralını ihlal etme.
- Node JS parse PASS ve tek offline HTML. `file://` bizzat test edilmediyse `DOĞRULANMADI` olarak belirt. FPS ölçmediysen yazma.
- Hangi küçük işlevleri değiştirdiğini ve eski modeller / identity testlerinin aynı kaldığını net açıkla.
- **Yalnız tek indirilebilir HTML:** `FallOfCavalry_G3D03A_R2_KAMERA_KADRAJ_DUZELTILMIS.html`. Harici JS/CSS/assets/ZIP yok.
- `main`, `archive/**`, `GEMINI.md`, checkpoint/BEST kayıtları değiştirilmeyecek; ChatGPT eski sürümleri ve QA'yı yönetir.

**Sadece otomatik yürüyüş kamerasını düzelt ve DUR.** G3D-03B, süvari animasyonları, AI, pathfinding, gerçek savaş entegrasyonu veya dünya/şehir sistemlerine geçme.
