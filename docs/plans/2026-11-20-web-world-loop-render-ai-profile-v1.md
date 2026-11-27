# Fall of Cavalry WEB — V1.38: Harita Oyun Döngüsünde Simülasyon, WorldAI, Arazi Çizimi ve Tarayıcı Kare Aralığı Ayrıştırması

**Tarih:** 20 Kasım 2026. **Depo:** `zxc28tarik/FallOfCavalry` yalnız web; Unity masaüstü repo ayrıdır.  
**Geliştirme:** `codex/web-world-npc-roster-20261118`; [taslak PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) **unmerged**, `main` değiştirilmedi.  
**Üst kart:** O00-06 **UYGULAMADA**. **V1.38 alt görevi:** Kodlu kaynak-ayrımlı tanı ve Playwright/Chromium kabulü PASS.

## Problem, yöntem ve kritik güvenlik kararı

V1.37'de gerçek mevcut 881 şehirli geçici prosedürel harita üzerinde rAF ortalaması panel kapalıyken yaklaşık 8,52 ve 5,34 FPS arasında çıktı. Bu değerlerin sabit bir oyuncu FPS hedefi olmadığını raporladık. V1.38'in hedefi FPS'i tahminen yükseltmek **değil**, görüntüyü değiştirmeden CPU oyununun güncelleme ve çizim alt bölümlerini gerçek çağrı üzerinden ölçmektir. **AI'ı kapatarak, çizim pass'lerini atlayarak, LOD/sprite stilini değiştirerek ya da yeni dünya varlığı oluşturarak hız kazanılmadı.**

`tools/browser-world-loop-profile.mjs` gerçek çalışan `gameLoop.updateHandlers.map` / `gameLoop.renderHandlers.map`, `WorldSimManager.updateMapSimulation`, `WorldPartyManager.updateWorldParties`, `RenderManager.renderMap`, arazi / dimetric arazi / overlay / HUD ve gerçek oyun yan çağrılarını geçici `performance.now()` wrappers ile ölçer. Her wrapper eski fonksiyonu **aynı argümanlarla, aynı `this` bağlamında** çağırır, dönüşünü/istisnasını değiştirmez. `try/finally` ile 56 kare bitince **bütün orijinal fonksiyonlar geri yüklenir**.

Oyunun var olan `DimetricPerformanceManager.getTelemetry` sonuçları da yalnız gözlemlenerek alınır; getTelemetry'nin avgFps değeri *iç renderer çizim süresinden* türetilir, tamamlanmış ekran FPS'i değildir. Ölçülen inclusive süreler (örn. `render.map` içinde `render.terrain`) iki defa toplanmaz.

`tools/browser-world-smoke.mjs` bu ölçümü **bütün eski gerçek görev, savaş, eskort, market ve save/load kabul aşamalarından sonra** çalıştırır. İlk prototipte dünya başlangıcından hemen sonra 56 gerçek oyun karesi ilerletildiğinde görev/haydut araştırma senaryosu `not_on_map` olarak değişebiliyordu; bu kod hatasını maskelemek için oyun süresini dondurmak yerine ölçümü kabul senaryolarının sonuna taşıdık. V1.38'in son iki Chromium koşusunda bütün eski oynanış kabulleri ve yeni profil PASS'tir.

## Doğrudan gerçek Chromium bulguları

| Ölçüm | Başlangıçtan hemen sonra, eski/yer değiştirilen koşu* | Sondaki kararlı koşu A | Sondaki kararlı koşu B |
|---|---:|---:|---:|
| Yerleşim sayısı | 881 | 881 | 881 |
| Gerçek RAF örneklem | 56 | 56 | 56 |
| `updateMap` ortalama ms | 214,288 | 5,534 | 6,943 |
| `WorldAI` ortalama ms (update içine dahil) | 15,939 | 3,998 | 5,013 |
| `renderMap` ortalama ms | 9,377 | 2,807 | 4,173 |
| `renderWorldTerrain` ortalama ms (render içine dahil) | 9,148 | 2,650 | 3,986 |
| `renderWorldOverlays` ortalama ms | 0,023 | 0,025 | 0,023 |
| `updateFogFromPlayer` ortalama ms | — | 0,864 | 1,221 |
| rAF aralık ortalama ms | kaydedilmedi | ayrı rAF ölçümü yok | **193,629** |
| rAF tabanlı tahmini FPS | — | — | **5,165** |
| rAF minus update+render ortalama ms | — | — | **182,507** |

*İlk koşu tanı bölümü kendi başına başarılı oldu, ancak sonraki gerçek quest-smoke zincirinde `real-missing-caravan-route-bandit-recon: not_on_map` nedeniyle **tüm browser job FAIL** oldu; bu satır asla genel PASS ilan edilmez. Bu geçici başlangıç koşuluna ait 214 ms, tekrarlanan son kararlı koşulardaki 5–7 ms ile uyuşmadığı için **sürekli oyun simülasyonu darboğazının ispatı değildir**. `worldParties=0` olan ilk koşuyla, sonraki kaynaklı `worldParties=4–8` koşulları da aynı koşulda değildir; anlık yük, JS GC/CI ve başlangıç işi etkileri ayrıştırılmadan nedensellik kurulamaz.

### Son doğrulanmış kararlı ölçüm: B

- 56 gerçek kare; `requestAnimationFrame` zaman damgalarından **55 geçerli aralık**; ortalama 193,629 ms, p95 200,1 ms, tahmini 5,165 rAF/saniye.
- Oyun güncellemesi 6,943 ms, dünya AI alt kümesi 5,013 ms; AI dışında kalan simülasyon toplamı 1,928 ms.
- Arazi çizimi 3,986 ms, overlay 0,023 ms, harita toplam çizimi 4,173 ms. Renderer çağrılarının `dimetricTerrain` ölçümleri nested olduğundan `terrain` ile toplanmaz.
- Gerçek ölçülen JS harita güncellemesi + harita çizimi: **11,122 ms**. rAF'nin arada bıraktığı **182,507 ms** sadece *wrap ile ölçülmeyen süre farkıdır*. Bu değer **GPU rasterization maliyetinin ölçümü değildir**: Chrome compositor/VSYNC, uzun tarayıcı zamanlama aralıkları, CI başka yükü, sayfa event loop ve başka ölçülmemiş işleri içerir.
- `WorldSimManager` yan çağrıları içinde `updateFogFromPlayer` 1,221 ms, HUD `0,098` ms, `getNearestSettlementAt` 0,036 ms, `ensureWorldParties` çağrı başına 0,247 ms. `syncWarStateFromRelations`, POI hint gibi **erişilmeyen/bağlı olmayan** yöntemler sıfır çağrılıdır; onları 0 ms yük/sürekli çalışan darboğaz saymak yanlış olur.
- Sondaki A koşusunda harita update 5,534 ms + çizim 2,807 ms, AI 3,998 ms; aynı profile sonucu 56 karede 8.207,5 ms duvar saati kaydetti, ama henüz ayrı rAF interval array yoktu. A ve B mutlak süre farkından FPS kazanımı veya kaybı iddia edilmez.
- Her iki son koşuda gerçek dünya ekonomisi, eskort/ganimet ve save/load kabul zinciri eksiksiz PASS, **consoleErrorCount=0**.

## Dosya değişiklikleri ve test ispatı

1. `tools/browser-world-loop-profile.mjs` **yeni**. `profileLiveWorldLoop` real Playwright page içinde alt yöntemleri geçici çepeçevre ölçer. Sonuç `stats` altında çağrı sayısı/ortalama/p50/p95/max, `derived` altında nested olmayan özet, `rafIntervals` altında mean/p95/estimatedFPS ve gerçek simülasyon öncesi/sonrası görsel telemetri alanlarını taşır. Ölçüm metodolojisi kullanıcının oyun durumunu değiştirmek için herhangi bir `disable` çağrısı yapmaz. Gerçek simülasyon doğal olarak ölçüm esnasında ilerlediğinden bu QA'nın yeri sonda tutulur.
2. `tools/browser-world-smoke.mjs` kabul sonuna **`full-world-map-update-versus-render-profile`** aşaması ekler; 56 frame, gerçek map/update/terrain callbacks ve 55 geçerli rAF zaman aralığı zorunlu. Profilden sonra console/browser error gate çalışır. Rapor eskisi gibi `output/browser-smoke` altındaki GitHub Actions artifact'ına gider; output depoya commit edilmez.
3. `tests/unit/world-loop-profile.test.js`: **4 yeni Vitest**. Ortalama, medyan/p95/total hesapları, negatif/NaN/sonsuz ölçüm reddi, en çok 400 örneklik sınır, input dizisini değiştirmeme ve boş seri için sahte FPS üretmeme.
4. Oyun `js/core/game-loop.js`, `RenderManager`, `WorldSimManager`, `WorldPartyManager`, `js/systems/world-ai.js`, stok/ganimet veya görsellerinde **hiçbir gameplay/render kodu değiştirilmedi**. Yalnız gerçek QA ölçüm araçları ve onların testleri eklendi.

**Güncel kanıtlar:**
- [Web validation #44733569018](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44733569018): **PASS**, birim **800/800**, full **1.212/1.212 + 1 skipped**, 0 lint/build hatası; dünya yapısı 881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata / mevcut 1 uyarı.
- [Gerçek Chromium #44733568960](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44733568960): **PASS**, gerçek 56 rAF ölçümü, son 55 aralık istatistiği, gerçek map+WorldAI+terrain+HUD sayıları, eski bütün quest/save-load kontrolü, 0 console error. Son doğrulanan kod SHA: `66f04b1370d6ed3db0f70f8ca946648b3ec555ab`.
- Önceki kararlı [Chromium A #44733056237](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44733056237): **PASS**, fonksiyon alt kolları, 56 rAF ve geriye yüklenen ölçüm wrapperları.
- İlk erken ölçümün başarısız bütün iş akışı [#44732551518](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44732551518) ayrıca açıkça işaretlidir; başarısız smokeyi PASS gibi göstermemek bu raporun kabul kuralıdır.

## Karar / V1.39

**KARAR DEĞİL:** “GPU kesin suçlu”, “oyunun temel simülasyonu 214 ms”, “çizim çok hızlı olduğuna göre son kaliteyi düşürelim”, “başsız rAF 5 FPS = kullanıcının Windows oyununda 5 FPS” gibi çıkarımlar **onaylanmadı**. Önceki dünyayı ve özgün sanat hedefini değiştirmiyoruz.

**V1.39 güvenli araştırma önerisi:** Bir Chromium grafik/kompozisyon profiler göreviyle Canvas2D uygulaması, Chromium frame scheduling/raster/compositor süreleri ve `requestAnimationFrame` gecikmesi ayrıştırılabilir. Karşılaştırma için aynı sahne sabit kamera ile birkaç kararlı çevrim ve farklı donanım modunda (headless software GL vs mümkünse Windows gerçek GPU) rapor alınmalı; yalnız başsız CI sonucundan oyuncu FPS'i garanti edilmemeli. Ancak ölçülen teknik suçlu netleşince dar, görsel kaliteyi koruyan optimizasyonu ayrı kod+test kapısıyla uygula. Mevcut **D00/D01 coğrafya** ve **G00–G14 2D sanat** karar kapıları aynen korunur.

**Durum:** V1.38 gözlemsel kök neden ayrıştırması ve kabul PASS; O00-06 UYGULAMADA; draft PR unmerged, main ve Unity değişmedi.
