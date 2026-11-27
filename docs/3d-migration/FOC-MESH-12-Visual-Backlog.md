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
