# FOC-MESH-12 — Yakın plan görsel kalite kusurları ve uygulanacak sıradaki revizyon

**Kaynak:** GitHub Actions 45979567751, gerçek Chrome/ANGLE SwiftShader WebGL.
**Savaş HTML'si:** `FOC-Visual-Sandbox/FallOfCavalry_PLAYABLE_RTS.html`.
**Doğrulanmış görüntüler:** üç savaş sektörü + Osmanlı idle/walk/attack + Avrupa attack.
**Bu dosya görev kaydıdır, henüz tamamlanmış geliştirme değildir.**

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
