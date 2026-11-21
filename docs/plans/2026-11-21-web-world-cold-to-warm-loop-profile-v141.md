# Fall of Cavalry WEB — V1.41: Gerçek dünya soğuk başlangıç ve ısınma profili

**Tarih:** 21 Kasım 2026. **Dal:** `codex/web-world-npc-roster-20261118`, PR #68 DRAFT, O00-06 devam ediyor. `main` ve Unity değişmedi.

## Neden

V1.40 PASS çıktı, fakat hiçbir alternatif GPU backend kimliği doğrulanmadı. Zorlanmış SwiftShader ve varsayılan Chrome **aynı** SwiftShader cihazını bildiriyor; ANGLE/OpenGL'nin cihaz kimliği bilinmiyor. Bu yüzden FPS/performans farkına GPU hızı demek yanlış.

Önemli ikinci delil **birbirinden ayrı taze Chrome süreçlerinde** ilk harita karelerinde `Performance.getMetrics` üzerinden 32 kare boyunca `ScriptDuration`: zorlanmış SwiftShader **3.820 ms**, varsayılan Chrome **2.958 ms**, ANGLE/OpenGL denemesi **2.860 ms**. V1.39'un görev zinciri sonundaki 32 karelik ölçümünde bu sayı yalnızca yaklaşık **288–356 ms** idi. Dolayısıyla **ilk harita açılışı / dünya yükünün geçici aşaması** ayrıca sorgulanmalı. Bu fark tek başına WorldAI, GPU veya belli bir render fonksiyonunun kusuru değildir.

## Test düzeni

- Yeni `tools/browser-world-warmup-profile.mjs`: aynı mevcut gerçek dünya; başlangıç UI'sında seed `1337`, ilk fraksiyon, 1366×768, 881 yerleşim ve 304 yol doğrulanır. **Tek başsız Chrome SwiftShader süreci** tüm ölçümler için korunur.
- Oyun çalışırken doğal olarak 24 ısınma karesi; ardından `early` **32 rAF** ve **31 interval**; 64 rAF boşluğu ardından `middle` **32**; 96 rAF boşluğu ardından `late` **32**. Her örnek gerçek oyunun kendi `gameLoop` callback'leri üzerinden alınır. AI, dünya simülasyonu, render, kamera, ekonomi, ticaret veya game clock durdurulmaz / değiştirilmez.
- Her üç pencerede var olan ve V1.38'de test edilmiş `profileLiveWorldLoop`: `loop.updateMap`, `sim.updateMapSimulation`, `sim.worldAI`, `loop.renderMap`, `render.terrain`, HUD ve rAF ölçümlerini gerçek JS `performance.now()` wrapper üzerinden toplar. Wrapper'lar `finally` ile eski fonksiyonlara döner.
- CDP `Performance.getMetrics` before/after: `TaskDuration`, `ScriptDuration`, layout/style, JS heap. **ScriptDuration TaskDuration içinde, WorldAI map update içinde, terrain render içinde:** çift sayım yok.
- `tools/browser-world-warmup-core.mjs` saf tutarlılık denetçisi: her üç pencerenin canlı harita modu ve aynı jenerasyon kimliği; boş veya eksik ölçümler reddedilir. `tests/unit/world-warmup-profile.test.js` dört unit testle doğrular.
- Her pencerenin dünya günü, kamera yerine fiziksel dünya kimliği, canlı WorldAI parti sayısı ve rAF/timing değerleri raporlanır. Rapor: `output/browser-smoke/warmup-profile.json`; kaydedilen QA artifact'ı.
- **Eşit kare sayılı** pencereler arasında early/late ratio sayısal olarak hesaplanır, ancak oyun dünyası bu sırada değiştiği ve CI'de kaynak contention bulunduğu için bunlar oyuncu FPS kazancı iddiası değildir.
- Önce mevcut kabul + V1.38/V1.39 + V1.40 gerçek bağımsız Chrome süreç karşılaştırması PASS olmak zorunda, sonra V1.41 çalışır. Testi gizlemek, skip etmek veya kalite düşürmek yok.

## Karar kapısı

V1.41 gerçek CI sonucunda `WorldAI` veya başka bir world update fonksiyonu gerçekten yüksekse (özellikle first frame) o fonksiyonun içindeki kaynağı **ayrı ölçerek** optimize et; öncesinde oyun semantiğini değiştirme. Gerçek yük yalnız başsız `SwapBuffers` veya CI zamanlaması ise dünya arazisini / AI'ı körlemesine azaltma. PC/Windows donanımı olmadan oyuncu FPS'i konusunda kesin sayı çıkarma.

**Durum:** yeni test ve gözlem entegrasyonu yapıldı; exact commit + Web validation ve Chromium CI sonuçları ayrı bölümde takip edilecek.
