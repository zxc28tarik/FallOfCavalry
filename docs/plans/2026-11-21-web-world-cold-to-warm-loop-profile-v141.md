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


## Gerçek doğrulama ve sonuç — Chromium #44844541780 PASS

- [Web validation #44844541739](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44844541739): **PASS**, 814/814 unit; 1.226/1.226 genel PASS + 1 önceden var olan skip; üretim build, lint PASS; dünya 881 yerleşim, 304 yol, 3 nehir, 4 geçit, 0 hata / 1 mevcut uyarı.
- [Gerçek Chromium #44844541780](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44844541780): **PASS**. Önceki tüm gerçek görev/savaş/karavan/market/save-load senaryoları PASS, console 0. Yeni `early / middle / late` profili `PASS_OBSERVATIONAL`.
- Tam artifact: `chromium-world-browser-report/warmup-profile.json`. Aynı gerçek Chrome süreci, seed 1337, 881 şehir ve 304 yol; her pencerede 32 harita güncelleme ve 31 gerçek rAF interval.

| İşlem | Early | Middle | Late |
|---|---:|---:|---:|
| `loop.updateMap` ort. ms/kare | 145,944 | 146,253 | 141,031 |
| `sim.worldAI` ort. ms/çağrı | 12,828 | 11,766 | 11,853 |
| `sim.ensureWorldParties` ort. ms/çağrı | 67,272 | 66,935 | 63,893 |
| `sim.ensureWorldParties` çağrı adedi | 40 | 40 | 40 |
| `loop.renderMap` ort. ms/kare | 3,628 | 3,562 | 3,641 |
| Ortalama rAF aralığı ms | 162,358 | 162,897 | 161,284 |
| CDP `ScriptDuration` toplam ms / 32 kare | 4.805 | 4.810 | 4.646 |
| CDP `TaskDuration` toplam ms / 32 kare | 4.867 | 4.841 | 4.680 |
| Ölçüm öncesi/sonrası dünya `worldAi.parties` | 0/0 | 0/0 | 0/0 |

**Ana sonuç:** İlk 24 karelik ısınmadan ve ardından 64 + 96 doğal kare ilerlemesinden sonra bile **141–146 ms/kare** dünya güncellemesi devam ediyor. `early/late` update oranı **1,035**, JS Script oranı **1,034**, rAF oranı **1,007**: geçici bir "ilk kare" yükünden ziyade, **bu sahne/dünya koşulunda sürekli tekrarlanan maliyet** olasılığı güçlenmiştir.

En büyük ölçülen alt fonksiyon `WorldPartyManager.ensureWorldParties`, **40 gerçek çağrıda 2.555–2.691 ms** toplam; `WorldAI` update yalnız 11–13 ms/çağrı, çizim yalnız 3,6 ms/kare. Alt süreler inclusive olup çift toplama yapılmaz. Dünya parti sayısının 0/0 olması her karede spawn→despawn olduğu **kanıtı değildir**; yalnız ölçüm pencerelerindeki gözlem. Parti yaşam döngüsünün gerçek pre/post kayıtları ayrıca tutulmalıdır.

### V1.42 kanıta dayalı sonraki görev

`WorldPartyManager.ensureWorldParties` içinde
1. `ensureBaseWorldParties` (spawn), `ensureActiveQuestRouteThreats`, `ensureActiveQuestCaravans`, ekstra görünür parti havuzları ve `syncVisiblePartiesToWorld` maliyetini ayrı ayır.
2. Her çağrıda canlı/ölü party sayısı, yaratılan/silinen gerçek ID sayısı, spawn/despawn gerekçesi ve oyuncu konumu (doğrudan kimlik içermeyen QA değerleri) kaydet; **oyun durumunu değiştirmeden**.
3. Tek karede tekrar eden `ensureWorldParties` çağrıları ve `WorldSimManager.updateMapSimulation` ↔ `WorldPartyManager.updateWorldParties` entegrasyonunu kontrol et. Aynı partinin aynı tick'te tekrar üretilip atıldığı ispatlanmadan cooldown, AI hızı, spawn havuzu veya görünürlüğü değiştirme.
4. Darboğazı kanıtlayan en küçük deterministik/hatasız düzeltmeyi ve save/load, quest-source, invariant, browser regresyonunu ayrı kapıyla uygula. Dünya AI, karşılaşmalar, görev kaynakları, kervan, oyuncu konumu ve görsel kalite korunur.

**V1.41 alt görevi gerçek ölçüm ve CI olarak TAMAMLANDI; O00-06 devam ediyor, PR #68 DRAFT/UNMERGED.** Başsız Chromium/SwiftShader kullanıcı bilgisayarında FPS garantisi değildir.
