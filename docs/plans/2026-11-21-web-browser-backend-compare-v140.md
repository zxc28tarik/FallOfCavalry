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


## Gerçek sonuç — 21 Kasım 2026, CI #44843343232 (PASS)

- [Web validation #44843343234](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44843343234): **PASS**, 810/810 unit, 1.222/1.222 genel + önceden var olan 1 skip, 881 yerleşim, 304 yol, 0 hata / 1 mevcut dünya uyarısı.
- [Web Chromium #44843343232](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44843343232): **PASS**; önce bütün mevcut gerçek oyun kabul testleri PASS (0 console error), ardından üç bağımsız tarayıcı modunun gerçek dünya haritasında 32 rAF ölçümü tamamlandı.
- **Zorunlu SwiftShader:** `MEASURED`; Chrome renderer `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...), SwiftShader driver-5.0.0)`; ortalama rAF aralığı **154,832 ms**, CDP `TaskDuration` toplamı **3.876 ms**, tracing `SwapBuffers` inclusive toplamı **4.867,077 ms**.
- **Chrome varsayılan:** `MEASURED`; renderer aynı `ANGLE ... SwiftShader`; ortalama **88,710 ms** rAF, CDP `TaskDuration` toplamı **3.098 ms**; `SwapBuffers` trace top listesinde bulunmadığından **null/unavailable** (asla sıfır GPU maliyeti değildir).
- **ANGLE/OpenGL istendi:** `MEASURED`; renderer kimliği `UNKNOWN`; ortalama **88,168 ms**, CDP `TaskDuration` **2.997 ms**, trace `SwapBuffers` top listesinde yok. Kimliği doğrulanmadığından gerçek OpenGL GPU performans kıyası kurulamaz.
- Tüm modlar **881 şehir / 304 yol** ile aynı dünya yapı imzasını üretti. Karşılaştırma otoritesi: **`NO_VERIFIED_DISTINCT_BACKEND`**. Farklı launch argümanlarının aynı/kimliği belirsiz yazılım renderer'ına düşmesi ve CI koşul değişkenleri nedeniyle 88 ms'nin 154 ms'ye göre kanıtlanmış FPS kazancı olduğu **iddia edilmez**.
- V1.40'da beklenmedik ilave ipucu: Yeni başlatılmış dünya sırasında **3.876 / 3.098 / 2.997 ms CDP main-thread `TaskDuration`** toplamları, önceki geç kabul V1.39'da 32 kareye denk gelen yaklaşık **323 ms** değerinden çok büyük. Bu ayrı süreç/harita durumu/ısınma farkı içerir, **doğrudan WorldAI suçu göstermez**.

**V1.41 yönü:** Aynı çalışan Chromium/aynı backend içerisinde farklı gerçek oyun-zamanı pencerelerinde soğuk/ısınmış/kararlı `loop.updateMap`, `WorldAI`, `loop.renderMap`, CDP Task/Script, rAF ve `SwapBuffers` profilini yeniden kıyasla. Baştan tasarlanmış oyun haritasına, oyuncunun görsellerine veya dünya AI kurallarına müdahale etme. Tek seferlik/tekrarlı yük ayrılmadan oyun mantığını optimize etme.

**Son durum:** V1.40 kod/test PASS, tanı verisi sınırlı; üst görev O00-06 devam ediyor; PR #68 taslak, `main` değişmedi.
