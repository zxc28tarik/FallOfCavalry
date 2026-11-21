# Fall of Cavalry WEB — V1.40: Bağımsız Chromium grafik altyapılarını karşılaştırma

**Tarih:** 21 Kasım 2026. **Çalışma:** yalnız web geliştirme dalı `codex/web-world-npc-roster-20261118`, PR #68 DRAFT/UNMERGED, `main` ve Unity değişmez. Üst paket O00-06 devam ediyor.

## Bağlam

V1.39'daki 32 karelik gerçek Chromium CI profili, normal JavaScript çalışma yükünden çok daha uzun olan `SkiaOutputSurfaceImplOnGpu::SwapBuffers` inclusive süreleri ortaya koydu (yaklaşık 4.679 ms / 4.758 ms pencere). Bu veri GPU hesaplama maliyeti değildir; başsız yazılım tabanlı sunum / bekleme ihtimalini güçlendirdi. Oyuncunun Windows FPS değeri henüz ölçülmedi.

## V1.40 ölçüm düzeni

- Mevcut üretim yapısını ve gerçek dünya üreticisini kullanan **üç ayrı Chrome süreci**: `forced-angle-swiftshader` (`--use-gl=angle --use-angle=swiftshader`), `chrome-default` (Chrome'un kendi seçimi), `requested-angle-gl` (`--use-gl=angle --use-angle=gl`). Bunlar **istenen açılış modlarıdır**; gerçekte farklı bir GPU backend çalıştığını ancak Chrome SystemInfo kanıtı gösterebilir.
- Aynı `seed=1337`, başlangıç ekranından aynı ilk fraksiyonun seçilmesi, 1366×768 pencere, `deviceScaleFactor=1`, `24` gerçek ısınma karesi ve `32` gerçek ölçüm karesi. Oyun zamanı, AI, harita çizimleri, kamera veya dünya içeriği dondurulmaz / devre dışı bırakılmaz.
- Her modda `SystemInfo.getInfo` üzerinden gerçek GPU renderer/aygıt tanımı, `Browser.getVersion`, `Performance.getMetrics` toplam ana iş parçacığı süreleri, gerçek rAF 31 aralık, Canvas2D çizim çağrıları ve varsa Tracing'den `SwapBuffers` native trace kaydedilir.
- İki mod sadece farklı **istenen parametreler** taşıdığı için farklı grafik sistemi kabul edilmez. Aynı Chrome GPU kimliğini bildiren iki mod `SAME_BACKEND` olur. Yetersiz SystemInfo `UNKNOWN_BACKEND`, yüklenemeyen mod `UNSUPPORTED`, harita kimliği uymayan mod `SCENE_MISMATCH` olur. Gerçek karşılaştırma için tüm dünya boyutları / yerleşim sayısı / yol / nehir / geçiş / canvas / ilk-son şehir kimliği eşit olmalı.
- Profiller `output/browser-smoke/backend-compare.json` CI artifact'ında tutulur. GitHub Actions'da mevcut tüm oynanış/test/save-load kabulünün **arkasından** ayrı adım olarak çalışır. Eski kabulü geçmeden V1.40 PASS olmaz.
- Testler `tests/unit/world-backend-compare.test.js` içindedir: gerçek backend kimliği, bilinmeyen/muhtemel fallback, harita farkı, hesaplamanın yeterliliği, karşılaştırmanın sınırları.
- Farklı GPU kimliği bulunan, tam uyumlu iki başsız CI koşusu çıksa dahi ölçülen fark **oyuncu FPS'i veya kanıtlanmış performans kazanımı olarak raporlanmaz**. Ayrı süreçler ve CPU contention, AI event/duvar saati farkı, Chromium başsız çizim hâlâ karıştırıcı değişkendir. Aksi hâlde `PASS_NO_VERIFIED_DISTINCT_BACKEND` ile **sonucun sınırlı olduğu açıkça** bildirilir; sahte kıyas veya hızlandırma iddiası yoktur.

## Kabul / sonraki adım

- Zorunlu SwiftShader referansı gerçek map'i başarıyla açmalı, oyun haritası invariant'larını ve 32 rAF / 31 interval / CDP süre kanıtını sağlamalı; eski tam Chrome smoke ve Web validation PASS olmalı.
- Alternatif mod cihazda desteklenmiyorsa CI kırılmadan "unsupported" raporlanır. Bu **iki farklı backend'in ölçüldüğü iddiası değildir**.
- Gerçek oyuncu performansını belirlemek için Windows üzerinde gerçek GPU, varsa ekran sürücüsü, ekran yenileme hızı, Canvas CPU ve compositor/raster dağılımı ayrıca ölçülmelidir.
- Grafik kalitesi düşürülmez, haritadan ağaç/şehir çıkarılmaz, AI cadence / dünya simülasyonu / oyun kuralları değiştirilmez. Darboğaz delili olmadan optimizasyon yok.

**Doğrulama:** CI tamamlanınca exact HEAD commit, her iki workflow linki, varsa grafik mod ayrım ve sınırlamalar burada raporlanır.
