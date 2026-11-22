# WEB V1.68 — Şehir Kethüdası: gerçek altyapı yatırımı ve karar maliyetlerine etki

**Tarih:** 2026-11-23. **Dal:** `codex/web-world-npc-roster-20261118`, taslak PR #68.
**Hedef:** Şehir V2'nin görünmez altyapı grubunu oynanabilir hale getirmek. Unity ve web `main` korunur.

## Mevcut otorite ve korunan sınırlar

Şehir Kethüdası ayrı bir görünür mimari bölge, 10. bina alanı veya yeni ekonomi motoru değildir. Onaylı dokuz altyapı tanımı, `js/data/city-building-catalog.js` içindeki yerleşik altyapı kataloğundan alınır: kuyu, çeşme, sarnıç, su yolu, ana yol, ara yol, köprü/geçit, drenaj, kanalizasyon. İdarî çekirdek ve gerçek şehir sahnesi, parsel/overlay sisteminden ayrık kalır. Var olmayan yol, bina veya NPC icat edilmez.

## Uygulanan işlev

1. **Kapasite ve nüfus baskısı:** Kethüda, şehir nüfusu ve tier değerinden ihtiyacı; yalnız kurulu katalog altyapıları ve kaydedilmiş iyileştirmelerden kapasiteyi hesaplar. Mevcut başlangıç altyapı kaydı değişmeden korunur.
2. **Dokuz gerçek proje:** Katalogda kurulu değilse inşa; kuruluysa iki kademe iyileştirme. Katalogdaki `buildCostGold` başlangıç fiyatı alınır; ikinci iyileştirme bunun iki katı. Bu katsayılar **ASSISTANT_FILLED / PROVISIONAL oyun denge değerleridir**, tarihî ücret veya kullanıcı tarafından kilitlenmiş karar değildir.
3. **Tek işlem / şehir / gün:** Şehir oyuncuya ait olmalı, geçerli gün ve yeterli gerçek altın bulunmalı, bu gün daha önce iş yapılmamış olmalı. Ret durumunda hiçbir altın veya şehir durumu değişmez.
4. **Gerçek ekonomik sonuç:** Başlangıç altyapısı otomatik bedava indirim vermez. İyileştirilmiş gerçek su/sıhhi tesisat unsurları `granary`, yol/köprü/drenaj ise `patrol` şehir meclisi kararlarının maliyetini kademe başına 5 altın düşürür (toplam en fazla 25 altın). `levy` kararı etkilenmez. Önceden var olan uzlaşma ve bölgesel yardım indirimleriyle aynı kanonik `getEffectiveCivicDecision/applyCivicDecision` fiyat zinciri kullanılır.
5. **Şehir ekranı:** Görünmez altyapı olarak başlığın altında ihtiyaç/kapasite/açık ile açılır-kapanır dokuz proje listesi, etkin maliyet, buton engelleri ve sonuç mesajları gösterilir. Kayıt için yeni uyumsuz callback kurulmadı: başarılı işlemler mevcut `onConstruct` autosave çağrısını kullanır.
6. **Kayıt/yükleme:** Versiyon 1 `cityState.infrastructure` altında yalnız yeni opsiyonel `improvementLevels` ve `lastWorkDay` alanları bulunur. Eski save bunlar olmadan açılır. Yabancı id'ler, geçersiz/negatif kademe ve sahte günler normalleştirilir. `SaveData != RuntimeState` sınırı korunur.

## Uygulama dosyaları

- `js/systems/city-kethuda.js`: hak kontrolü, projeler, ödeme, kapasite, meclis indirimleri.
- `js/systems/city-state.js`: save block whitelist ve eski kayıt uyarlaması.
- `js/systems/city-civic-decisions.js`: kanonik maliyet zincirine gerçek indirim.
- `js/ui/city-services.js`: oyun içi şehir arayüzü, aksiyon, autosave.
- `tests/unit/city-kethuda.test.js`: kaynak doğrulama, kurulma, yükseltme, gerçek fiyat, eski-save, hileli-save, tekrar/gün, maliyet.

## Kabul / eksikler

Kabul şartı: `Web validation`, `Web Chromium browser smoke` ve oyun HTML export kontrolleri **aynı son HEAD** için başarılı olmalı. Test sonucu teyit edilmeden PASS denmez.

**Bilinçli kapsam sınırı:** Su kalitesi, hastalık, asayiş, üretim verimi ve nüfus sağlığı için yeni doğrulanmamış sayısal etkiler uydurulmadı. Şu an ölçülebilen etki altyapı kapasitesi + real şehir meclisi maliyetleridir; mevcut ticaret/stock değişmez. Kethüda NPC olarak üretilmez, şehir görünür bina slotu işgal etmez. Aşama V1.68 şehir sistemi tamamlandı anlamına gelmez; şehir görseli/overlay eksiği devam eder.
