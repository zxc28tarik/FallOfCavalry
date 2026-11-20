# Fall of Cavalry WEB — V1.37: 881 Şehir Tarayıcı Performans Profilini Gözlemleme ve Stok Raporu Tahsislerini Azaltma

**Tarih:** 20 Kasım 2026  
**Depo/kapsam:** `zxc28tarik/FallOfCavalry`, yalnız web oyunu. Unity başka projedir, dokunulmadı.  
**Dal/PR:** `codex/web-world-npc-roster-20261118`, [PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) taslak, **birleştirilmedi**. `main` değiştirilmedi.  
**Üst görev:** O00-06 `UYGULAMADA`. **Bu alt dilim:** V1.37 kod/test/profil kabulü PASS.

## Ölçüm sorusu ve yöntem

Kullanıcının web haritasında 881 yerleşim, 304 yol ve 762.552 yer karosu bulunuyor. V1.36 isteğe bağlı **Mal Hareketleri** panelinin filtreleme/sayfalamada raporu gereksiz yeniden hesaplamasını engelledi. V1.37, *bu panelin gerçek harita akıcılığını kötüleştirip kötüleştirmediğini* ölçmek ve yalnız gözlemsel stok raporu kodunda güvenli tahsis iyileştirmesi yapmak içindir; oyun mekaniği, pazar defteri otoritesi ve dünya sanatına müdahale edilmedi.

**Gerçek çalışan yol:** Vite üretim build → GitHub Actions Chromium headless / ANGLE SwiftShader → normal menüden oyun başlangıcı, bütün mevcut prosedürel dünyayla çalıştırma → gerçek görev, ticaret ve kervan senaryolarının ardından açık harita `map` modunda oyuncu `cargoMarketReportToggle` butonu.

**Ölçüm:** Her koşuda `requestAnimationFrame` ile panel kapalı / açık / yeniden kapalı **48'er kare aralığı** (`estimatedRafFps`, ortalama, p50, p95), Chrome DevTools Protocol `Performance.getMetrics` üzerinden JS heap, `TaskDuration`, `ScriptDuration`, DOM node sayısı ve panel gerçek DOM click/change işlemleri çevresinde `performance.now()`. Sonuçlar `output/browser-smoke/report.json` CI artifact raporuna ve stdout'a eklenir, **sabit FPS bütçesi/uydurma başarı eşiği yok**. Özellikle bu test **GPU'nun kesin çizim throughput'u veya gerçek kullanıcının ekran FPS'i değildir**; `requestAnimationFrame` zamanlaması oyun/CI ana iş parçacığından etkilenir.

## İki gerçek test koşusu ve bulgular

| Metrik | Chromium koşusu A | Chromium koşusu B |
|---|---:|---:|
| Panel kapalı tahmini rAF FPS | 8,52 | 5,34 |
| Panel açık tahmini rAF FPS | 8,50 | 5,34 |
| Panel sonradan kapalı tahmini rAF FPS | 8,37 | 5,25 |
| Paneli açmak, gerçek tıklama (ms) | 292,6 | 537,4 |
| Stok sekmesine geçip bütün şehir defterlerini hesaplamak (ms) | 264,5 | 407,0 |
| 24 ürün/metin arama girişi toplamı (ms) | 30,1 | 20,0 |
| 20 ileri–geri sayfa turu toplamı (ms) | 9,4 | 69,3 |
| CSV click/Blob/dosya tetikleme (ms) | 11,9 | 21,6 |
| Eksik ikinci pazar defteri satırı | 204 | 204 |
| CDP TaskDuration artışı, operasyondan önce/sonra (s) | +1,072 | +1,583 |
| CDP ScriptDuration artışı, operasyondan önce/sonra (s) | +0,955 | +1,523 |
| CDP JSHeapUsedSize farkı, operasyondan önce/sonra | +12.047.712 B | +22.102.660 B |

**Kanıtlar:**
- [A — Chromium #44728582601](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44728582601) **PASS**, SHA `a5cb03589edf01cc5ab6d06552ef1ca48de34cbf` (`profile` + stok tahsis optimizasyonu, birim test dosyasından önce).
- [B — Chromium #44728778136](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44728778136) **PASS**, SHA `33737bf2ad2783927f61a4ed52831cc92d379b30` (kodla birlikte eklenmiş testler).
- [B — Web validation #44728778120](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44728778120) **PASS**, **796/796 unit**, **1.208/1.208 full + 1 skipped**, lint/build/hijyen PASS, 881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata / mevcut 1 dünya uyarısı.

**Yorum:** Her iki koşuda da panel açıkken ölçülen rAF akıcılığı panel kapalıya çok yakın; testler **raporun mevcut ağır haritanın ana akıcılık kaybı kaynağı olduğunu göstermiyor**. Ancak mutlak sonuçlar iki koşu arasında 8,52 ve 5,34 FPS olacak kadar farklıdır; CI paylaşılmış runner/Swi​ftShader ortamında kararlı fiziksel bilgisayar FPS'i ilan edilmez. Açılış/stok hesaplama anlık click maliyetleri ayrı incelenmeye değer; CDP TaskDuration ve kullanılan JS heap farkı **dünya oyununun kendi devam eden hesapları + panel işlemlerinin toplamıdır**, yalnız panele atfedilemez. Operasyonlardan sonraki 48 kare örnekleminde JS heap A'da 108.771.988, B'de 64.081.732 bayttı: daha kısa örneklerde belleğin geri düşmesi gözlendi, **uzun vadeli bellek sızıntısı yoktur** sonucu çıkarılamaz. Chrome `performance.memory` salt istatistiktir.

## Kaydedilen uygulama iyileştirmesi

1. `js/systems/market-cargo-report.js`: `auditCampaignMarketStocks` zaten bağımsız veri satırları üretiyor. Önce tüm `rows` için ekstra `map({...row})` kopyası, `unresolved` ara dizisi ve sonra ayrı `conflicts` filtre geçişi vardı. V1.37 **tek geçişte `unresolvedCount` ve `conflictCount` sayıp zaten detached olan satırları doğrudan snapshot'ta tutar**. 881 şehir/çok ürünli rapor oluştururken gereksiz O(N) ara dizi ve ikinci tam satır tahsisi kaldırıldı. Bu kod değişikliği için **bir önce/sonra mikrobenchmark sonucu yoktur**, bu nedenle doğrulanmamış yüzde hız kazancı iddia edilmez.
2. `tools/browser-market-performance.mjs`: CDP/rAF kullanan tekrar edilebilir sahici Chrome profil modülü. `Performance.enable`, `Performance.getMetrics`, `requestAnimationFrame`, gerçek UI tıklamaları; sayıları gerçek browser testinin JSON raporuna döner. Ölçümün sonunda geçici CDP bağlantısını kapatır, paneli kapatır; gerçek oyuncu envanteri/gold/markets/şehir stoklarını değiştirmemesi **zorunlu assertion**.
3. `tools/browser-world-smoke.mjs`: bu modül gerçek dünya/stock/quest smoke zincirine `real-881-city-market-report-performance` aşaması olarak entegre edildi. Profil dışındaki önceden mevcut 24 birimlik gerçek kervan teslimi, 204 kaydın tümünün CSV indirilebilmesi ve gerçek 4 demir ganimetinin save/load sonucunda durması testleri bozulmadı.
4. `tests/unit/market-cargo-perf-budget.test.js`: **3 yeni regresyon**: bütün 881 şehir/1762 ürün-stok satırının korunması, eksik/çakışan çift pazar sayılarının aynı kalması, rapor kopyasının gerçek `marketStock` nesnelerine bağlı olmaması, `movements` kategorisinde şehir stok tahsisi olmaması. Test adı bütçe içerse de **sabit headless FPS sınırı veya bellek eşiği koymaz**.

## Karar defteri / güvenlik

- **Uygulanan:** Salt okunur rapor verilerinde ara tahsis azaltımı; gerçek browser performans gözlemi; sıfır dünya defteri onarımı.
- **Onaylanmamış:** Oyun FPS'ini sabit hız hedefiyle düşüren değişiklik, rendering mimarisini değiştirme, yeni canvas/Phaser motor kararı, otomatik eski pazar defteri birleştirme, yeni dünya görselleri veya resmî D00/D01 kapsamını değiştirme.
- **Açık:** Haritanın taban akıcılığı, panel açık değilken de aynı ölçekte düşük çıkıyor. Sonraki güvenli V1.38 adayında **`RenderManager` çizim çağrısı, dünyaAI güncelleme ve tile renderer görev süresi ayrıştırılarak** gerçek harita darboğazını önce teşhis etmek ve performansı etkileyen kodu görüntü kimliğini bozmadan sınırlı QA testleriyle incelemek gerekir. Başarı kriteri yalnız oran değil, gerçek Chromium'da aynı sahnenin çizilmesi/oyun mantığının korunması ve eski sonuç ekranı/ticaret testlerinin PASS kalmasıdır.

**Kabul:** Mevcut kod ve testler doğrulandı; V1.37 alt dilimi tamamlanabilir, fakat genel O00-06 görev kartı `UYGULAMADA` kalır. PR taslak; `main` ve Unity'ye aktarım onayı verilmedi.
