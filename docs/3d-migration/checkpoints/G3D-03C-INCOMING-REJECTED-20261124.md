# Fall of Cavalry — G3D-03C / Piyade Savaş Eylem Pozları QA

**Tarih:** 2026-11-24  
**Karar:** **CANDIDATE — REJECTED / NOT ACCEPTED / NOT BEST.** Yeni üç görsel animasyon testinde **31,32,33 FAIL**. Gerçek Chromium/WebGL'de **33/36 PASS**, ayrıca sabit `attack` snapshot'ının animasyonu sonsuza kadar tekrar etmesi tespit edildi. En yakın kabul edilen önizleme **G3D-03B** değişmez; `main` veya korumalı BEST'e merge YOK.

## Orijinal HTML / ayrı ve birebir GitHub arşivi
- Dosya: `fall_of_cavalry_g3d_03c_piyade_3d_sava_eylem_pozlar.html`.
- **410812 bayt**, 8622 mantıksal satır (`wc -l`: 8621; son newline yok).
- SHA256: **`eed1bb30ec3a75552518ea3b5229c3188abe44c4238a01956fd3bec6f12d68ac`**.
- Yerel `git hash-object` = uzak GitHub `fetch_file.sha` **`9cdb4d901f2c654ff7795782bc25de1aa4ad4846`**. Birebir orijinal.
- Arşiv branch: `archive/gemini-g3d03c-original-20261124`; commit **`e19870a0685968e73efcd792683292d7235715c9`**.
- Yol: `docs/3d-migration/candidates/G3D-03C/ORIGINAL_GEMINI_G3D03C.html`.
- Önceki kabul edilen G3D-03B: `archive/gemini-g3d03b-original-20261124`, `docs/3d-migration/checkpoints/G3D-03B-ACCEPTED-20261124.md`. Hiçbir eski arşiv değiştirilmedi.

## Bağımsız R3D-03B → G3D-03C veri ve model regresyon kıyaslaması
Gerçek iki HTML'nin JS'i ayrı ayrı Node VM içinde yürütülerek `createSoldierPartTemplates()` ve `createTestBattleData()` çağrıldı.
- **206/206** şablonun her parça `prim`, `mat`, `localMat[16]` değerleri **birebir**. `modelDifferences=[]`, aynı kanonik JSON SHA256 **`53a907ed47d2cf10a3d06de98a92f932d8e47698ffb3c7b57fe4e97e56d5cafc`**.
- **200 süvari** varyantı, üç piyade sınıfı her iki tarafta, 44/43/41 parça korunuyor.
- **12/12 grup, 442/442** kaynak asker (konum, side, state, hp, aktif silah, equipment/armor dahil her alan) tam JSON eşit.
- Tek inline JS/HTML yapısı, JS `node --check` PASS, CDN'den dış asset yok. Gerçek `file://` çift tıklama testi YOK; HTML başlığındaki 'FILE:// HAZIR' QA kanıtı sayılmaz.

## Gerçek Chromium / Xvfb / SwiftShader QA
- 1440×900, `page.set_content(originalHTML)`, gerçek WebGL `ANGLE_instanced_arrays`. `#btnRunTests` normal pointer click ile çalıştırıldı; `#unitTestSummary` gerçekte **`Sonuç: 33 / 36 doğrulama testi başarıyla geçti.`** yazdı. 36 kayıt alındı, test no 31,32,33 **FAIL**, 1–30 ve 34–36 **PASS**.
- **G3D-03C panel başlığı statik `(36/36)` yazıyor, gerçek başarı oranını temsil ETMİYOR.** QA sonucu dinamik özetle verilmeli.
- Başlangıç/normal render: 300 asker (150 dost / 150 düşman), hiddenAlive 18/12, 7 soldier instanced batch, toplam 11 draw call, 3 shader `LINK_STATUS=true`, `gl.getError()=0`, `pageerror=[]`.
- Gerçek UI sektör tıklaması: merkez **300**, batı **62**, doğu **50**, boş veri **0 asker / 0 soldier batch**, test moduna dönüş **300**, tüm aşamalarda `glError=0`. QA `lifecycle_small.json` (sektör altkümesi).
- 1440×900, 768×900 ve 390×844: sekiz genel kontrolün merkezinde gerçek DOM hit target; sayfa yatay scroll genişlik taşması yok; birim test paneli ve `#btnToggleCombatPreview` normal pointer click ile aç/kapat PASS.
- 1440×900 gerçek GL ekran kanıtı `/mnt/data/foc_03c_qa/combat_initial.png`, `combat_after_6s.png`, önizleme öncesi `before.png`, kapanınca `after.png`. Yakın ön cephe kadrajında piyadeler görünüyor, ancak animasyon doğruluğunun yerini screenshot tek başına alamaz.
- Gerçek bağımsız yaşam döngüsü testinde `#btnDispose` Playwright click **2 saniyelik sürede tamamlanmadı**; daha geniş toplu test de süre aşımına uğradı. Bu nedenle **gerçek dispose/reinit ve context loss uçtan uca PASS iddia edilmiyor**; bunlarla ilgili 36. gömülü mock testi PASS ama gerçek tarayıcı yaşam döngüsü son kapı hâlâ açık. Gerçek fiziksel GPU FPS/VRAM YOK.

## Kesin FAIL 31 — mızraklı geri hazırlık
Gömülü test 31 (`runBattle3DUnitTests`) gerçek `SoldierVisualRegistry.evaluateSoldierPartMatrix` üzerinden 44 parçalı pikeman'ın mızrak ucunu (parça 43) kontrol ediyor.
- `actionPhase=0.14`: hazırlanma anında mızrak ucunun **önce geri gitmesi** gerekir `windupZ < restZ - 0.15`.
- Gerçek ölçülen **`windupZ=3.113, restZ=3.038`**; uç geriye gitmek yerine **ileri** kayıyor. Bu yüzden test 31 FAIL.
- Sonraki ileri hamle `u=0.56`, iki el ile mızrak ucunun göreli uzaklıkları ve statik `localMat`'ye dönüş **aynı test içinde** ayrıca doğrulanmalıdır; testi beklenene göre kolaylaştırma.

## Kesin FAIL 32 — tüfekçi yeniden doldurma
Gömülü test 32 `musketeer/arquebusier` için 43 parçalı silah/iki el pozlarının matrix'ini değerlendiriyor.
- `actionPhase=0.72` aşamasında tüfeğin iki elli tutuşla **el aşağı, namlu daha dik ve yukarı** konumlanması beklenir.
- Bağımsız tarayıcı hata metni: **`Yeniden doldurma fazında silah indirilip dikey doldurma açısına getirilmeli`**, `reloadHandY=1.119` (UI test metni kısa logda kırpıldı). Bu aşamada en az bir beklenen konum/dirsek koşulu gerçekleşmiyor. İki elli tutuşta **el↔namlu uzunluğu korunmalı**.
- Nişan alma `u=0.22`, recoil `u=0.36` ve hazır duruşa dönüş aynı test içinde ayrı assertlere sahip; aşama 3'te durduğu için diğerleri bütünüyle PASS sayılmaz.

## Kesin FAIL 33 — kılıç-kalkanlı koruma pozu
- Ayrı sentetik `SYNTHETIC_TEST:swordsman_1`, gerçek 442 askere yeni swordsman EKLENMİYOR; bu doğru.
- `actionPhase=0.18`: kalkanın hem göğüs merkezine yaklaşması hem de yükselmesi gerekiyor.
- Gerçek `shieldX=0.370`, `restX=0.390`; sadece **0.020** merkeze yaklaşma, asgari **0.080** gerekir. Bu yüzden test 33 FAIL. Kılıcın hazırlık/savuruşu, bağımsız shield guard ve el↔kılıç uzunluğu aynı testin devamında ayrıca doğrulanmalı.

## Testin yakalamadığı YENİ HATA — sabit attack snapshot sürekli animasyon tekrar ediyor
- `SoldierVisualRegistry.update(dt)` içinde aktif piyade: `rec.actionPhase = (rec.actionPhase + safeDt / cycleDuration) % 1.0` ve `rec.isCombatActing=true` olarak kalıyor. `parseSnapshotCombatState(s.state)` her `state:'attack'` snapshot'ında aktif kaldığı için bir defa bitip ready'ye dönmüyor.
- Gerçek Chromium UI ile combat preview ON: 16/16 `isCombatActing=true`; **+6 s** simülasyondan sonra da 16/16, **+13 s** sonra da 16/16; `actionPhase` tekrar tekrar devriyor. **Tek saldırı niyeti tetiklenince tek animasyon döngüsü, sonunda yumuşak ready ve aynı sabit snapshot tekrar gönderilince otomatik yeni eylem başlamaması** istenen güvenlik.
- Kapatınca istenen kamera `desired=(0.1,-3.6,distance46,yaw0,pitch0.88)` geri geliyor, ancak `combat_off` anındaki `combatPosingCount=16` kademeli fade-out başladığı için mümkündür. 1–2 saniye sonrasında 0'a dönüş ek bir test ile kanıtlanmalı; bu tek başına bug olarak kaydedilmedi.
- **Yeni test 37**: ON, başlayan 16 kişi; 1 cycle bitiminden sonra `isCombatActing=false`, blend→0, ilgili per-part matrices tam eski statik poza dönmüş, 6/13 s sonra tekrar döngü yok; aynı `attack` snapshot'ı tekrar edilince edge olmadığından yeniden tetiklenmiyor; OFF→ON veya explicit yeni event ile yeniden tetikleniyor. Düşman AI/oyun hasarı veya silah atışı yok.

## Bir sonraki dar görev
**G3D-03C-R1 yalnız 31/32/33 gerçek animasyon geometrisi ve tek-seferlik action-state + UI özet doğruluğu; gerektiği kadar gerçek browser kapatma testi**. Başka sınıf, model, görsel silah, süvari gait, oyun/AI/HP/cephane/rota veya gerçek battle entegrasyonu ekleme. Orijinal G3D-03B kabulü korunur. Test 1–30 ve 34–36 asgari aynı davranışta PASS, 31–33 düzeltilerek PASS, yeni 37→ **37/37 PASS** ancak gerçek çıktıda doğrulanırsa. Gemini testleri hardcode PASS yapmamalı.
