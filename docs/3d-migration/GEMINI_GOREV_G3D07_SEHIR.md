# GEMINI G3D-07 — CITY V2 GERÇEK 3D ŞEHİRLER (AYRI GÖREV)

**Zorunlu:** `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`; dünya/savaş dosyaları bu görevin kapsamı değildir. Eski en iyi sürüm kıyaslanmadan yeni kod BEST olmaz.

## Gerçek şehir kaynakları

- `js/systems/city-state.js`: gerçek `cityState.parcels`, `buildingIds`, alan/tier/occupied/locked durumları, yönetim yetkileri.
- `js/data/city-building-catalog.js`: yapının kimliği, kültür/sınıf/yerleşim kısıtları, gerçek servisleri.
- `js/data/city-scene-defs.js`: şehir sahneleri ve faction görünümleri.
- `js/ui/city-services.js`: mevcut şehir UI/servisleri/gerçek pazar ve atölye insan ilişkileri. V1.75 atölye nezaretçi denetimleri ve Character System v2 korunacak.
- Proje oyun stili: 17. yüzyıl Osmanlı dahil tarihî-esinli kültürler. İç kale, ticaret/han/mahalle/atölye vb şehrin mevcut City V2 alanlarına bağlı; 30 rastgele prefab ile şehir uydurma.
- Kullanıcının Three.js RTS örneği HTML 3D'nin yapılabileceğini gösterir; eski AOE kule/ordu/efektleri doğrudan şehir asset'i sayılmaz.

## Kapsam

1. Yeni `js/city3d/` içinde **salt-okunur City V2 parcel -> 3D building plot** görünümü; gerçek şehir ID, parcel ID, building ID ve izinler korunur.
2. Geçerli yerleşime göre 3D surlar, kapı, yollar, iç kale, mahalle, çarşı, han ve üretim tesisleri; kültüre ve doluluk seviyesine göre modüler geometriler. Eksik binayı **placeholder** diye işaretle; oyunda yoksa sahte işletme üretme.
3. Kamera hareketi, yapı seçimi / tooltip ve kullanıcı servis işlemleri mevcut city-state API'sine bağlanmalı. **Görsel tıklama** gerçek stok/altın/üretim/organizasyon durumunu doğrudan değiştiremez; yetkili servis kuralları geçerli.
4. LOD, instancing, görünmeyen parsel culling, sahne aç/kapa bellek boşaltımı, tutarlı mahalle okunabilirliği.
5. 2D şehir UI ve bütün oyuncu ekonomik/karakter/quest/save akışı isteğe bağlı fallback olarak devam eder.

## Teslim ve test

- Ayrı commit'ler: `G3D-07a` gerçek parcel projection + test, `G3D-07b` 3D modüler yapı sahnesi, `G3D-07c` seçim/servis + browser test.
- Reddedilen/eksik parçaları silerek değil, önceki kabul edilmiş en iyi parçayı geri yükleyerek düzelt.
- Eski bütün `npm run validate`, `npm test`, `npm run audit:world` ve gerçek Chromium 2D/3D şehir testleri PASS.
- `docs/3d-migration/checkpoints/G3D-07.md`: exact SHA, öncesi-sonrası kod ve görüntü, şehir parsel kaynak uyumu, kayıpların onarımı, VRAM/FPS ölçümü.
- G3D-06 dünya ve G3D-02 savaş ilerlemelerini değiştirme; main'e merge yok.
