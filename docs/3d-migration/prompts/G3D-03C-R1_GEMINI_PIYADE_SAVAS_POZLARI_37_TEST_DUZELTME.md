# GEMINI — G3D-03C-R1: 3 BOZUK PİYADE EYLEM POZU + TEK SEFERLİK DÖNGÜ DÜZELTMESİ

## İstek ve net kaynak
**BAZ AL:** kullanıcının verdiği orijinal `fall_of_cavalry_g3d_03c_piyade_3d_sava_eylem_pozlar.html`. **G3D-03B'ye geri dönüp yeni animasyonları kaybetme!** 03C'de yapılan görsel action altyapısı, demo butonu, test 31–36 ve diğer kazanımlar korunacak; **yalnız tespit edilmiş FAIL'leri düzelt**.
Bu 03C adayının aslı GitHub `archive/gemini-g3d03c-original-20261124`, commit `e19870a0685968e73efcd792683292d7235715c9`, `docs/3d-migration/candidates/G3D-03C/ORIGINAL_GEMINI_G3D03C.html`, SHA256 `eed1bb30ec3a75552518ea3b5229c3188abe44c4238a01956fd3bec6f12d68ac`. **Bağımsız Chromium QA raporu:** `docs/3d-migration/checkpoints/G3D-03C-INCOMING-REJECTED-20261124.md`.

Gerçek tarayıcı (Xvfb + Chromium + SwiftShader, 1440x900) **36 test çalıştırdı, sonuç 33/36 PASS**; **31,32,33 FAIL**. Bütün önceki 1–30 ve yeni 34–36 gerçek testler PASS. Kod `node --check` PASS, 206/206 model parçası bütün `prim/mat/localMat[16]` geometrileri eski G3D-03B ile birebir, 12 grup 442/442 ham asker verisi birebir. Merkez300/batı62/doğu50/boş0, 7 instanced soldier batch, 11 draw calls, 3 shader LINK true, glError0. UI 1440/768/390 responsive PASS. **Bu sürüm HENÜZ KABUL EDİLMEDİ**; onaylı sürüm 03B.

**TEK SONUÇ:** `FallOfCavalry_G3D03C_R1_PIYADE_POZLARI_DUZELTILMIS.html` (tek, indirilebilir, internetsiz HTML). Başka dosya/ZIP/CDN/font/JS/görsel kaynak oluşturma.

## 1. FAIL 31: Mızrak hazırlık ucu yanlış yöne ilerliyor
`runBattle3DUnitTests()` test 31 gerçek `SoldierVisualRegistry.evaluateSoldierPartMatrix(viewId, 43)` üzerinden ölçüyor.
- `actionPhase=0.14` wind-up: mızrak ucu Z **geri** gelmeli: `windupTipMat[14] < restTipMat[14] - 0.15`.
- **Gerçekte `windupZ=3.113, restZ=3.038`**, yani +0.075 ileri gidiyor; test FAIL.
- Pivot/dönüş yönünü, `computeInfantryActionPartLocalMatrix` veya ilgili animasyon matrisini düzelt. Mızrağı sırf test geçsin diye ayrı hareket ettirip iki elin tutuşundan koparma. Uç ve `twoHandPike` rig'inin iki el arası mesafesi korunmalı; `u=0.56` ileri hamle **+0.55'ten büyük**, prepare/recover, 44 parçalı orijinal şablona dönüş koşulları da geçmeli. **Test31'in mevcut assert/thresholdlarını GEVŞETME**.

## 2. FAIL 32: Tüfek doldurma pozu yanlış
`runBattle3DUnitTests()` test 32; `musketeer` ve `arquebusier` iki elli `twoHandMusket` rig (parça31 right hand, parça39 brass muzzle band).
- `u=0.22` nişan: `aimMuzzle[13] > restMuzzle[13]+0.12`.
- `u=0.36` recoil: `recoilMuzzle[14] < aimMuzzle[14]-0.12`.
- **FAIL `u=0.72` reload**: `reloadHand[13] < restHand[13]-0.05` **VE** `reloadMuzzle[13] > aimMuzzle[13]+0.10` birlikte sağlanmalı; gerçek fail raporu: `reloadHandY=1.119` ve 'silah indirilip dikey doldurma açısına getirilmeli'.
- Silahı yarı dik doldurma pozuna indirirken eller, tetik, dipçik ve namlu **birlikte** aynı rijit dönüşüm altında kalsın. Sağ el–namlu göreli mesafesi `1e-4` toleransını karşılasın. Hazır duruş `localMat` geri dönüşünü bozma; yeni saldırı/duman/gerçek reload ekleme. **Test32'nin asıl assertleri değişmeyecek**.

## 3. FAIL 33: Sentetik kılıçlı kalkan doğru yere yükselmiyor
`runBattle3DUnitTests()` test 33 yalnız `SYNTHETIC_TEST:swordsman_1` kılıçlı denemesidir. Gerçek 442 askere swordsman ekleme ya da mızraklı/tüfekçiyi dönüştürme.
- `u=0.18`, `leftArmWeapon` kalkanı (parça30) göğüs merkezine (X azalsın) ve yukarı (Y artsın) getirilmeli:
  `windupShield[12] < restShield[12]-0.08`, `windupShield[13] > restShield[13]+0.05`.
- **Gerçek `shieldX=0.370, restX=0.390`** sadece -0.020. Pivotu/offseti düzelt; gereksiz dönüp kollardan ayrılmasın.
- Aynı testin devamı: kılıç (parça40) hazırlanma yukarı +0.25Y/geri -0.15Z, savuruşu ileri+aşağı, kalkan ayrı kolda guard yüksekliğinde, sağ el–kılıç ucu mesafesi korunmuş, `guard` ayrı çalışıyor, bitişte bütün localMat özgün. Test33'teki kalan assertleri de gerçekte çalıştırıp PASS al. **Eşiği düşürme, testi silme.**

## 4. GÖMÜLÜ TESTİN KAÇIRDIĞI BUG: Eylem sonsuz tekrarlanıyor
Kod: `SoldierVisualRegistry.update(dt)` içinde `rec.actionPhase=(rec.actionPhase+safeDt/cycleDuration)%1`; aynı `state:'attack'` snapshot'ı sürekli kaldığından **tek bir eylem tekrar tekrar otomatik başlıyor**.
Bağımsız gerçek Chromium ispatı: piyade eylem ON, **16/16** `isCombatActing=true` ilk anda; simülasyon **+6 saniye** sonra yine 16, **+13 saniye** sonra yine 16. On/off butonunun kendisi çalışıyor; hata animasyon/intent lifecycle'da.

**Düzeltme:** Tek snapshot `attack` tetiklemesi **tek görsel animasyon oynatsın**. Sınıfa göre tamamlandıktan sonra `actionBlend` yumuşakça sıfıra insin, `actionPhase` sıfırlansın, `isCombatActing=false`; geri dönen matrisler özgün `localMat` ile aynı olsun. Aynı `viewId` için hâlâ aynı `attack` snapshot'ının tekrar `sync` edilmesi yeni kenar (rising-edge) olmadığı sürece eylemi yeniden başlatmasın. `ready` durumuna dönüldükten sonra tekrar `attack` geldiğinde veya kullanıcının preview OFF→ON komutuyla explicit yeni niyet oluşturulduğunda yeniden başlayabilsin. Ayrı `lastActionIntent`/rearm state'i yalnız `SoldierVisualRegistry` içinde tut; **asıl SoldierInstance/SectorManager veya snapshot ID/data değiştirme**. Kamera veya atanmış model değiştirerek cycle bitirme.

Bu demoda kullanıcı “Savaş Pozları” önizlemesini açık bıraktığında bir eylem döngüsü tamamlanır, askerler normale döner; kullanıcı OFF→ON ile yeniden oynatabilir. Ekranda sürekli saldırı göstermek için yapay döngü kurma. 16 aktörün mevcut `viewId` ve silah kimliği korunacak.

## 5. YENİ 37. TEST — gerçek birim ve GL doğrulama
**Önceki 36 testi bozmadan** (özellikle eski 1–30, 34–36) test 37 ekle. 31,32,33 testlerini silme veya kolaylaştırma. **Hedef 37/37**, ama gerçek test geçmediyse o sayıyı YAZMA.
Test37:
- 1 piyade pikeman, 1 musket, 1 synthetic sword actor (ayrı isolated fixtures), her biri `ready`→`attack` tetiklensin;
- `update` simülasyonu 0→6→13 saniye: eylem bir kez oynayıp bitmeli, `isCombatActing=false`, `actionBlend=0`, per-part transform özgün localMat ile eşit;
- *AYNI* attack snapshot'ını tekrar `sync` edince yeni eylem başlamamalı;
- `ready`→`attack` yeni kenarı veya preview OFF→ON yeni açık niyetle bir kez tekrar başlayabilmeli;
- Aynı zamanda `templateKey`, `activeWeapon`, `weaponLoadout`, `armorLoadout`, `hp`, `state` asıl ham veri, `position`, `viewId` değişmesin;
- Önizleme OFF, sektör değiştirme, boş veri, context lost/reinit / dispose → ghost pose, gizli ek soldier, kamerada kalıcı değişim yok.

## 6. Gerçek tarayıcı / test UI doğruluğu
- Yeni dosyanın test panel başlığına statik `(36/36)` veya `(37/37)` yazma; önce gerçek `runBattle3DUnitTests()` sonucu alıp **dinamik `33/36`, `37/37`, FAIL listesi** göster. Başarısız testleri yeşil gibi sunma.
- Gerçek Chromium/WebGL 1440×900 ile test düğmesine normal pointer click. **Hazırlık `u=.14`, tüfek reload `u=.72`, kalkan `u=.18`, atak sonu** ekran görüntüsü / matrix fixture değerlendir; ekrandaki 6+ piyade kamera tarafından görünür olmalı. 768×900, 390×844 düğmeler normal tıklanabilsin; UI tasarımını yeniden yapma.
- GPU 7 asker batch/normal 11 draw call, 3 shader program `LINK_STATUS=true`, `glError=0` doğrula. Dispose→reinit ve `WEBGL_lose_context`→manuel reinit'i **gerçek tarayıcıda ayrı ayrı deneyip** sonucu ver. Önceki bağımsız 03C QA'sında gerçek `#btnDispose` pointer click zaman aşımına uğradı; bu nedenle bunun PASS olduğunu sadece 36. mock testten çıkarma. QA ortamında GPU/GL döngüsü takılıyorsa `DOĞRULANAMADI` yaz.
- Node `node --check` PASS. Gerçek `file://` test etmediysen `file:// TEST EDİLMEDİ`; performans FPS/VRAM hesaplama veya tahmin YOK.

## KESİN KORUMA
- Eski G3D-03B + 03C'nin **206/206 model `prim,mat,localMat[16]`**, 44/43/41 piyade, 200 süvari şablonu, anatomik at ve mevcut binici/silah, **12 grup/442 asker kaynak ordusu** byte-equivalent. Hiçbir model kaldırılmayacak; sahte swordsman gerçek orduya sokulmayacak.
- Piyade yürüyüş, süvari walk/trot gait, at toynakları, `preserveCamera:true` kamera 0→1→2→3 koruması, demo mutual exclusion, 150+150 görünür, hiddenAlive 18/12, batı62/doğu50/boş0, instanced buffer/fallback/GL resource lifecycle korunur.
- Bu hâlâ yalnızca bağımsız **FOC_THREE görsel önizleme**; gerçek battle simülasyonu, hasar, cephane, AI, gerçek reload/atış hitbox, Unity veya gerçek oynanış entegrasyonu DEĞİLDİR.

## Teslim ve DUR
Tek `FallOfCavalry_G3D03C_R1_PIYADE_POZLARI_DUZELTILMIS.html` dosyasını indirilebilir ver. 37 testin gerçek PASS/FAIL sayısını ve bağımsız görsel kontrolde neler doğrulandığını kısa ve doğru raporla. `main`, `archive/**`, `GEMINI.md`, BEST ve eski checkpoint'leri değiştirme; bunları ChatGPT yönetir. **İş bitince DUR.** Yeni G3D-03D süvari savaş animasyonu, oyun AI, gerçek combat/pathfinding/Unity veya şehir aşamasına GEÇME.
