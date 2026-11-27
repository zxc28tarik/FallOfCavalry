# FOC-MESH-12 — Yakın plan görsel kalite kusurları ve uygulanacak sıradaki revizyon

**Kaynak:** GitHub Actions 45979567751, gerçek Chrome/ANGLE SwiftShader WebGL.
**Savaş HTML'si:** `FOC-Visual-Sandbox/FallOfCavalry_PLAYABLE_RTS.html`.
**Doğrulanmış görüntüler:** üç savaş sektörü + Osmanlı idle/walk/attack + Avrupa attack.
**Bu dosya görev kaydıdır, henüz tamamlanmış geliştirme değildir.**

## 27 Kasım 2026 — FOC-MESH-12A yüz anatomisi, ilk uygulama

**Durum: IN PROGRESS — görsel kalite onayı bekleniyor.**
**Dal:** `codex/foc-mesh12-face-anatomy-20261127` (FOC-MESH-11 dalından oluşturuldu).

- 24 sabit arketipte `buildFOCFixedHead` halka açısı 40 → 56 örnekleme yükseltildi; göz/kaş/dudak geçişlerine yeni enlem halkaları eklendi.
- Yüzdeki dikdörtgen göz/kaş/bıyık/dudak materyal bantları eğrisel sınırlara dönüştürüldü. Göz çukurundaki sert derinlik hafifletildi. Ayrı göz küresi, baş rig'i veya oyun mantığı eklenmedi.
- `scripts/qa-fixed-mesh-animation.mjs` testine 24 başta yüz materyal kapsaması, gözlerin iki yanda bulunması ve tek sürekli baş yüzeyi kontrolleri eklendi.
- **Yapısal CI:** GitHub Actions `45981454584` PASS — commit `b182f96c39415a34161d9dfc16c162068ea5f5eb`.
- **WebGL kalite kararı:** Mevcut `qa-foc-mesh11-webgl.mjs` smoke koşusu `45981397579` tetiklendi. Başarı ve gerçek ekran görüntüsü incelemesi tamamlanmadan **görsel onay / DONE** denilmeyecek.
- **Ölçülmemiş:** Fiziksel GPU'da FPS, kafa ek poligon bütçesi ile 300 asker performansı. Runner üzerindeki SwiftShader FPS sonucu buna eşdeğer değildir.
- **Sıradaki:** Yeniçeri idle/walk/attack ve Avrupa arkebüzcü attack yakın planlarını önceki FOC-MESH-11 görüntüleriyle karşılaştır. Ardından omuz-gövde, el-dipçik ve diz/çizme iyileştirmelerine ayrı küçük paketler halinde geç.
- **Değişmeyenler:** RTS savaşı, 24 arketip, rig/ekipman, kök web oyun, Unity deposu, strateji/şehir/ekonomi/diplomasi sistemleri.

## 27 Kasım 2026 — FOC-MESH-12B yüz/omuz/tutuş iyileştirme

**Durum: IN PROGRESS — görüntü karşılaştırması bekleniyor.**

- Gerçek görüntü kıyasında ilk yüz geçişinin göz/kaş mozaiklerini küçülttüğü, ancak geniş koyu sakal bandı ve yuvarlak omuzların sürdüğü tespit edildi.
- `buildFOCFixedHead`: sakal bandı kavisli kontura dönüştürüldü, çene üzerinde ara halkalar eklendi; başın karanlık göz alanı için daha yumuşak `faceEye` materyali kullanıldı.
- `buildFOCArmAndGrip`: omuz başlangıcı ve avuç hacmi daraltıldı. Mevcut `FOC_ARM_ANCHORS` ve silah soketi konumları değişmedi.
- Mevcut animasyon/geometri kontrolünün üzerine 8 kol tipinin el yüzeyinin silah soketi merkezine oturduğu sınaması eklendi.
- **CI:** geometri/animasyon iş akışı `45981999491` başarılı (13e/013e model revizyonu); yeni soket testi `45982031534` başarılı (commit `a61bc21f48c94eea9f0d76655b6cdeff0ec52c9f`).
- **WebGL test:** `45981999567` (commit `013e35e70b4efa14f24201b99bbfc112fa64f18c`) başlatıldı; ekran görüntüsü incelenmeden estetik onay verilmez.
- **Açık:** at anatomisi, diz/çizme görünümü, gerçek GPU FPS, 300 asker performansı, 24 profilin her birinin yakın plan görsel incelemesi.

## 27 Kasım 2026 — FOC-MESH-12B gerçek WebGL görüntü kararı

**Yapısal test: PASS. Gerçek WebGL smoke: PASS. Nihai görsel kalite: NOT READY.**

- `45982031534`: 24 sabit arketip ve 8 sabit kol/silah tutuşu kontrolü PASS; yüz tek-parça topolojisi ve yüz materyal bölümleri testleri de PASS.
- `45981999567`: gerçek Chrome / ANGLE SwiftShader / WebGL smoke PASS. Üç savaş sektörü ve dört asker vitrini ekran görüntüsü üretildi; `SHOWCASE:U1`, 24 batch, sıfır tarayıcı hatası, 16 vertex attribute.
- **Artifact:** https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45981999567/artifacts/15189068611
- Görsel karşılaştırma: Yeniçeri yüzündeki önceki geniş dikdörtgen göz/ağız lekeleri küçüldü ve sakal daha eğrisel görünmeye başladı. Buna rağmen omuzlar hâlâ yuvarlak birer kütle, göğüs/gövde hacmi şişkin, avuç/silah birleşimi ve yakın plan yüz detayları henüz hedeflenen anatomik kaliteye ulaşmadı.
- Avrupa saldırı pozu tarayıcının farklı animasyon anında kaydedildiğinden iki ekran görüntüsünü piksel-piksel kalite regresyonu olarak yorumlama. Sabit poz/aynı kamera/timing doğrulaması ileride ayrı QA olarak eklenmeli.
- Yazılım GPU `fpsApprox=1` gerçek donanım FPS verisi değildir.
- **Karar:** Ana dala birleştirme yok. FOC-MESH-12 kalan anatomi ve 300 asker gerçek GPU performansı doğrulaması açık tutulur.

## 27 Kasım 2026 — FOC-MESH-12C gövde / omuz / avuç

**Durum: IN PROGRESS. Teknik regresyon PASS; gerçek ekran kalitesi ve donanım performansı henüz onaylanmadı.**

- Piyade ve süvari sabit gövdelerinde alt göğüs derinliği azaltıldı, zırhın ön yüzü daha düz bir kesite ve daha sınırlı kabartmaya geçti; yaka ve kemer/etek materyal indeksleri, ekipman dönüşümleri korundu.
- 8 kol tipinin omuz kökleri gövdeye doğru içeri ve aşağı çekildi. Aynı loft halka sayısı, rig ve silah soketi korundu. Avuç kesiti hafif köşeli/yassı yapıldı; bağımsız parmaklar ve gerçek kavrama IK henüz yok.
- Model commit: `6be454967c0e668558418164bc5f39ae3db1f840`. Test commit: `874e16400f93798e01b222a6207f3a62a9581ad9`.
- CI `45983042049` PASS: 24 arketip, 1172 parça, 480 geometri, 235636 üçgen, 0 dejenere üçgen; 1728 animasyon pozu / 84384 matris, 7344 diz/hock örneği, 0 hata.
- Yeni test 48 el parçasının gerçek çizilen mesh halkası merkezini iki dönüşümlü skinning ile rig soketine karşı 1440 pozda sınadı. Maksimum sapma 0.0000123932 model birimi (eşik 0.005). Bu, silah yüzeyiyle parmak temasını veya anatomik doğruluğu ispatlamaz.
- Gerçek WebGL smoke: https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45983008344 (model commit'i); sonuç ve ekran görüntüsü kıyaslaması ayrıca kaydedilecek.
- Sırada diz/çizme ve at anatomisi; 24 sabit arketipin görsel kontrolü ve fiziksel GPU üzerinde 300 asker iş yükü açık. Ana dal, Unity, şehir/strateji ve oyun kuralları değiştirilmedi.

## 27 Kasım 2026 — 12C görsel test sonucu ve 12D hazırlığı

- Gerçek Chrome/WebGL koşusu `45983008344` **PASS**, model SHA `6be454967c0e668558418164bc5f39ae3db1f840`. Üç sektör, dört piyade vitrin görüntüsü, 0 tarayıcı hatası, 24 aktif vitrin batch'i. https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45983008344/artifacts/15189219396
- 12B/12C aynı idle Yeniçeri kamera görüntüsünde alt göğüs daha az şişkin ve omuz tepeleri biraz daha alçak. Görsel değişim sınırlı; ellerin gerçek parmak kavraması, kıyafet/omuz geçişleri, yüz ve kaba silah geometrisi hâlâ açık. Estetik onay verilmedi.
- 12D öncesi WebGL testine sabit Sipahi ve Kürassier için idle, walk, çeyrek-yandan idle görüntüsü (toplam 6 yeni çekim) ve doğru mounted template/at geometri varlığı kontrolleri eklendi. Test commit `09eb8decd98644ac232365114cca35f0bbb66bef`; koşu https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45983209975 başlatıldı, henüz PASS denilmiyor.
- Fiziksel GPU FPS ölçülmedi; SwiftShader rAF değeri 1, gerçek donanım performansı değildir. 12C ana dala birleştirilmedi.

## 27 Kasım 2026 — FOC-MESH-12D diz, pantolon, çizme

- 12C mounted WebGL koşusu `45983209975` PASS: üç sektör, dört piyade, altı süvari çekimi, sıfır browser hatası. Sipahi 44, Kürassier 48 aktif batch; her birinde 15 focEquine parçası. Artifact https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45983209975/artifacts/15190725456 . Görüntüde özellikle at omuz/boyun ve arka bacak köklerinde sert birleşimler var; 12E için açık.
- 12D model commit `7e187d0b55701632609e10f578cb1bffea1f7eba`: üç standing leg stili için aynı .46 pivot düzleminde birebir ortak 20 verteksli diz halkası ve ortak normal; üst/alt iç kapaklar çizim indekslerinden çıkarıldı. Halka/verteks düzeni, rig ve animasyon korundu. Pantolon, patella, baldır, ayak bileği ve çizme profilleri düzenlendi.
- Önceki tüm yapısal testler `45985328305` PASS. Yeni verteks bazlı testin ilk koşusu `45985357646` rapor kapsamı ReferenceError ile FAIL; test değişkenleri `18f0a6bf15d90d496085b619067c7ab05b2a44be` ile düzeltildi. Yeni koşunun sonucu ayrıca işlenecek.
- WebGL model koşusu `45985328537`; yakın plan testine dört yeni diz/çizme çekimi eklendi (`6870e8a9457aa7e766123d83c77add9d870ec940`, koşu `45985395577`). QA kamera ve bilgi kartı görünürlüğü yalnızca testte değiştirilir. Görsel kalite onayı henüz yok.
- Ana dal/Unity/oyun mantığı değişmedi. Fiziksel GPU performansı açık.

### 12D teknik doğrulama sonucu

- Düzeltilmiş koşu `45985437703` **PASS**. 24 arketip, 1172 parça, 480 geometri, 235396 üçgen (12C'ye göre 240 az), 0 dejenere üçgen; 7344 joint örneği, 1440 grip örneği.
- Yeni doğrulama: 28 piyade diz çifti, 60480 skinlenmiş verteks çifti, maksimum konum farkı 0 ve yerel seam normal farkı 0. Render edilen iç kapak indeksi yok. Bu, yüzeyin görsel kıvrım/penetrasyon kalitesini veya performansı tek başına ispatlamaz.
- 12E hazırlık: atın mevcut boyun loft kökü (y=1.17,z=.37), gövde ayrı 28 segmentli loft, ön/arka bacak ayrı 20 segmentli loft. Yandan gerçek referansta görülen keskin boyun ve kalça/omuz sınırları, derinlik ve kök bağlantı profili üzerinde çalışılacak; mevcut rig ve koşum koordinatları korunacak.
- WebGL koşuları henüz tamamlanmadı; 12D görsel değerlendirme açık.

## 27 Kasım 2026 — 12D gerçek WebGL sonucu ve FOC-MESH-12E at anatomisi

- 12D model koşusu `45985328537` ve genişletilmiş WebGL koşusu `45985395577` PASS. 17 gerçek ekran görüntüsü, 0 tarayıcı hatası, 4 diz yakın planı ve 6 süvari görünümü. Artifact: https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45985395577/artifacts/15190983220 . Yeniçeri ve zırhlı piyade yakın planında belirgin diz yüzeyi açıklığı görünmüyor; kumaş ve çizme malzeme ayrıntısı hâlâ sade. Yürüyüş ekran görüntüsü tek an olduğundan animasyon kalitesi için video yerine geçmez.
- 12E model commit `8c23f1e0d8ae93f02bc0740b8b98c02e8e9c3d66`: 10 sabit at stilinde göğüs ve sağrı hacmi, boyun kökü, kalça/omuz bacak köklerinin gövde içine alınması, inceltilmiş tendon ve toynak kesitleri. Mevcut koşum ve rig koordinatları korunuyor.
- Ön/arka bacaklarda aynı 20 verteksli eklem çevresi, ortak yerel normal ve iç kapakların kaldırılması. Önceki halka sayısı ve iki rig'li skin ağırlıkları korunuyor. Bu değişiklik atın boyun ve bacak köklerini geometrik olarak tek mesh yapmaz; gövdeyle iç içe geçiş kalitesi ekranda değerlendirilecek.
- Önceki yapısal regresyon `45989318664` PASS. At eklemlerinin tam çevresini animasyon boyunca doğrulayan test commit `918f55890402de9f042a2e55dd785cfae2bbe82b`; sonuç bekleniyor.
- WebGL model koşusu https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45989318436 sürüyor. 12E estetik onayı açık; 12F eyer/binici, 12G gerçek donanım performansı bekliyor. Ana dal ve Unity değişmedi.

## Birinci öncelik: insan anatomisi

1. **Yüz anatomisi:** Yakın plan yeniçeri ve arkebüzcü başlarında göz ve ağız koyu/kare mozaik görünümünde; gerçekçi göz kapakları, dudak kıvrımları, burun-yanak geçişleri gerekli. Var olan tek parça `focHead_*` mesh topolojisi üzerinden çöz; düşük çözünürlüklü koyu bloklarla kapatma.
2. **Omuz/göğüs birleşimi:** Kol başlangıçları belirgin yuvarlak omuz küreleri gibi görünüyor, göğüs zırhı/giysi balonlaşmış. `focArm_*` loft kökü ve `focTorso_*` yüzey derinliğini yeniden değerlendir; rig pivotlarını ve silah el hizasını koru.
3. **El/silah tutuşu:** Eller yuvarlak açık top gibi kalıyor; fitilli tüfek dipçiği ve ön kol tutuşu kinematik olarak daha inandırıcı olmalı. Silah ve elde aynı hareket rig'i muhafaza edilmeli, zaman içinde ayrışma testi eklenmeli.
4. **Alt gövde/diz:** Uzaktan bacaklar silindir gibi görünmekte; pantolon-çizme geçişi ve anatomik diz formu düzeltilebilir. Diz/hock dikiş sürekliliği testini bozma.

## İkinci öncelik: at ve süvari

5. Atın omuz, boyun ve arka bacak konturlarını yakın plan süvari vitrini ile ayrıca doğrula. Başlangıç battle-sector1/2 görüntülerinde atlar görünüyor, fakat anatomik kalitenin tamamlandığı söylenemez.
6. Atlı omuz ve silah tutuşunda eyer-gövde oranlarını yakından karşılaştır. Süvari anatomisinde sabit arketip (ayrı mesh) yaklaşımı korunacak.

## Üçüncü öncelik: performans ve UI

7. Yazılım GPU testinde `fpsApprox=1` *yalnızca sanal SwiftShader browser* ölçümüdür; 150+150 gerçek donanım kıyası yerine geçmez. Gerçek GPU FPS/CPU/GPU iş yükü ve kare süreleri ayrıca ölçülmeli.
8. HUD komuta şeridinde sabit `150 Dost / 150 Düşman` ibaresi ve sektör değişince üst HUD sayıları arasında tutarsızlık gözlendi. Oyun simülasyonu değiştirmeden, yalnızca görünüm/metin kaynağı dikkatle düzeltilmeli.

## Kapatılan somut hata

FOC-MESH-11'de vitrinde hiçbir karakter görünmüyordu. Ana nedeni: aktif savaş motorunun aynı `soldierRegistry`'yi sonraki karelerde tekrar savaş askerleriyle doldurması. Model vitrini açıkken canlı savaşı durduran koşul eklendi. Yeni gerçek tarayıcı testinde `SHOWCASE:U1` kaydı, 24 batch ve 3D yeniçeri görüntüsü doğrulandı. Test: https://github.com/zxc28tarik/FallOfCavalry/actions/runs/45979567751.

## Değişmez kurallar

- Kök web oyunu, şehir/ekonomi/diplomasi ve ayrı Unity deposuna dokunma.
- Bu aşamada doğrudan gerçek oynanabilir RTS HTML'deki asker/at modellerini geliştir.
- 24 sabit asker arketipini ve ekipman tasarımlarını koru; eski primitif modelleri geri getirip "tamamlandı" deme.
- Her köklü görsel revizyonda GitHub Actions geometri/animasyon testi ve Chrome/WebGL yakın plan ekran görüntüsü kıyaslaması yap.
- Ana dala yalnızca gerçek ekrandaki kalite ve çalışırlık denetimleri yeterli olduğunda birleştir.
