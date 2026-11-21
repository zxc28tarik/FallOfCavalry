# Fall of Cavalry WEB — V1.42: Dünya parti yaşam döngüsü ve tekrarlı ensure maliyeti

**Tarih:** 21 Kasım 2026. **Hedef:** O00-06 / yalnız WEB, taslak PR #68, `codex/web-world-npc-roster-20261118`. `main`, Unity, tüm üretim oyun kodu ve mevcut görseller korunur.

## V1.41'den doğrulanan problem

Gerçek Chromium testinde aynı 881 yerleşim / 304 yol haritasında 32 kare boyunca `loop.updateMap` ~141–146 ms/kare, `WorldPartyManager.ensureWorldParties` ~64–67 ms/çağrı; ölçümlerde 32 kare için en az 40 (profiler ring buffer üst sınırı) ensure çağrısı yakalandı ve dünya `worldAi.parties` anlık fotoğraflarda sıfırdı.

Kaynak kodda `WorldSimManager.updateMapSimulation` (satır ~597) zaten `ensureWorldParties()` çağırıyor; ardından `WorldPartyManager.updateWorldParties(dt)` kendi girişinde **tekrar** `ensureWorldParties()` çağırıyor. Ancak ikinci ensure'un etkisiz olduğu, partilerin üretilip sonra yok edildiği ya da performansın sadece bu çağrıdan kaynaklandığı henüz ispatlanmadı.

## Yeni gerçek tarayıcı ölçümü

- `tools/browser-world-party-lifecycle-profile.mjs` yalnız CI test aracıdır, oyun kaynak kodunda kalıcı değişiklik yapmaz. Tam prod build'den başlat ekranı → seed1337 → orijinal Osmanlı ve **881 yerleşimli gerçek harita** oluşturulur. 24 doğal rAF ısınması ve 32 doğal rAF ölçümü yapılır.
- Her `ensureWorldParties` çağrısında **before / afterBaseWorldParties / afterEnsure** safhasındaki gerçek parti sayısı, canlılar, tür dağılımı, son yeniden doğma günü ve gerçek kimlik-set farkları (yalnız sayı; örnek olarak en fazla 5 geçici kimlik) kayıt altına alınır.
- `ensureBaseWorldParties` doğrudan ES module import'udur. Davranışını değiştirmemek için yalnız `ensureActiveQuestRouteThreats` girişinde **öncesinin bittiği sınır** gözlemlenir; base safhasının inclusive maliyeti `ensure` başlangıcından bu sınıra kadardır.
- `getWorldAiCfg`, `ensureTradeRoutes`, `getCurrentEvents`, `getBanditCapWithEvents`, quest route/escort ensure, `syncVisiblePartiesToWorld`, world AI update, quest route tick, eskort tick ve map simulation fonksiyonları **geçici** wrapper ile zamanlanır; tüm wrapperlar `finally` ile geri alınır.
- `WorldPartyManager.updateWorldParties` öncesi ve sonrası kimlik sayıları ayrıca takip edilir. Aynı karede iki ayrı ensure işleminin parti yaratıp yaratmadığı, gerçek removal var mı, yaratma ve temizleme hangi safhada oluyor soruları kanıtla yanıtlanır.
- Rapor `output/browser-smoke/party-lifecycle-profile.json` olup GitHub Actions browser artifact'ına girer. Mevcut tam oyun kabulü + V1.40 + V1.41 PASS olmadan çalışmaz. **Oyun kuralları, görünür asker adedi, render, save/load ve AI update frekansı bu tanı adımında hiç değiştirilmez.**
- `tools/browser-world-party-lifecycle-core.mjs` ve `tests/unit/world-party-lifecycle-profile.test.js` dört saf unit test taşır. Subcall süreleri üst fonksiyonun içindedir: toplamları iki kez sayılmaz.
- Bu profil kayıtları için ekstra snapshot/Set zamanı eklenir; ölçüm mutlak oynanış FPS'i değil, *hangi safhanın* ağır olduğunu tespit etmek için kullanılır. Başsız Chrome/SwiftShader gerçek Windows GPU performansı değildir.

## V1.42 sonraki kapı

Gerçek CI çıktısı ile en maliyetli **etkisiz** adım saptanırsa, daha sonra en küçük davranış-koruyucu düzeltme (ve görev, worldAI, save/load regresyonları) yapılır. Hiçbir varsayımsal spawn→despawn nedeni kanıtsız iddia edilmez. Birim + tam browser PASS olmadan tamamlandı denmez.

**Doğrulama:** exact HEAD, Web validation, Chromium CI ve sayısal safha kayıtları PASS olduğunda buraya eklenir.


## V1.42 gerçek CI teşhisi — #44846765600 PASS, eski oyun kodu

- [Web validation #44846765611](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44846765611) ve [Chromium #44846765600](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44846765600) **PASS**. Tüm mevcut oyun senaryoları PASS, konsol hata sıfır. Bu ölçüm **düzeltme öncesi** oyun koduyla yapıldı.
- Aynı 32 oyun karesinde tam **64 ensure**, **32 gerçek WorldPartyManager.updateWorldParties**. Her kare başlangıç partisi sıfır. İlk ensure: **10 temel** (4 bandit, 3 patrol, 3 caravan) + **9 ek** (2 refugee, 2 merchant, 2 messenger, 2 villagers, 1 noble) = **19 parti**. İkinci ensure aynı partiler üzerinde yaratma yapmıyor. Normal update iş bitince **19 partinin tamamı çıkarılmış**. Yeni karede tekrar.
- Bir pencere boyunca **320 temel parti kimliği yaratıldı**, **608 parti kimliği silindi**, hiçbiri örnekleme sonunda kalmadı. `worldAi.lastRespawnDay` 1'de kalmasına ve varsayılan `RESPAWN_INTERVAL_DAYS=3` olmasına rağmen **her karede yeniden üretim** meydana geldi. Bu artık varsayım değil; gerçek önce/sonra ID karşılaştırması.
- Ölçülen `ensure` **3.400,9 ms/64 çağrı (ortalama 53,139 ms)**. Bunun **3.395,5 ms**'si ilk `ensureActiveQuestRouteThreats` girişinden önceki **basePhase** bölümünde. Quest-route ensure yalnız 2,3 ms/64 çağrı, quest-caravan 0, görünür parti sync yalnız 2,8 ms/96 çağrı. Oyunun harita simülasyonu **3.704,2 ms/32 kare (~115,76 ms/kare)**, çizim değil.
- Kaynaktaki somut koşul: `js/systems/world-ai.js` içinde `if (elapsed < respawnDays && aiState.parties.length > 0) return;`. Liste her kare sıfıra indiğinden elapsed 0 olsa bile **3 günlük kural atlanıyordu**.

## V1.42 en küçük üretim düzeltmesi

- `js/systems/world-ai.js` içinde yalnız **ilk dünya nüfuslandırmasını** istisna tutan `initialPopulation` koşulu eklendi. `lastRespawnDay=0` ve parti listesi boş olan dünyada aynı bandit/patrol/caravan ilk defa **derhal** üretiliyor. **Sonraki** empty roster durumunda, en erken tanımlı 3 oyun günü sonra yeniden üretiliyor.
- Mevcut faction, spawn adresi/stratejisi, encounter kuralları, loot/quest route doğrulaması, save payload yapısı, worldAI tick frekansı, çizim ve map asset'leri **değiştirilmedi**.
- `tests/unit/world-ai-respawn-cadence.test.js` gerçek `world-ai` fonksiyonlarını kullanarak başlangıç ilk dalga, 50 hızlı tekrar, sonraki günler, JSON save/load, override 0 günlük politika, mevcut canlı partileri koruma ve hareket güncellemesi durumlarını denetliyor.
- Gerçek Chromium `V1.42` ölçümüne davranış regresyon kapısı eklendi: Başlangıç gününde 32 karede **10'dan fazla base-party yaratılırsa CI fail**. Ölçümde 10 bir kez oluşabilir; her kare 10 partilik üretim tekrarlanamaz.
- **Açık konu:** 9 ek görünür parti grubunun özel refill döngüsü hâlâ ayrı incelenmelidir. Bu düzeltme onları veya görünür NPC görev davranışlarını *sessizce* değiştirmez. Sonraki aşamada 3 günlük kural ile ekstra havuzların uyumunun özel kararı/tests gerekecek.
- **Yeni oyun davranışı için gerçek CI sonucu ayrıca zorunlu:** Kod doğrulama ve Chromium PASS olmadan performans iyileşti iddiası yok.

**O00-06 açık, PR #68 taslak/merge yok; Unity ve main değişmedi.**


## Düzeltme sonrası gerçek CI: V1.42 PASS

Düzeltme ve 6 yeni doğrudan oyun AI regresyon testini içeren **kod başlığı**, [Web validation #44847331423](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44847331423) ve [tam Chromium #44847331419](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44847331419), ikisi de **PASS**.

- Birim: **824/824**, genel test: **1.236/1.236** + 1 eski skip, lint/derleme ve gerçek dünya yapısı PASS (881 yerleşim, 304 yol, 3 nehir, 4 geçit, 0 hata / 1 mevcut uyarı).
- Tam Chromium mevcut bütün görev, eskort, ticaret, loot, save/load, encounter ve önceki V1.40/V1.41 kontrollerini geçiyor, 0 oyun konsol hatası.
- Gerçek dünya, aynı seed1337, aynı yazılım Chrome, gerçek 32 rAF örnekleme; aşağıdaki **farklı CI çalıştırmaları** karşılaştırılır. Ayrı runner koşulları nedeniyle birebir kontrollü donanım/oyuncu FPS benchmark'ı değildir.

| V1.42 gözlemi | Düzeltme öncesi CI #44846765600 | Düzeltme sonrası CI #44847331419 |
|---|---:|---:|
| Dünya parti ensure çağrısı | 64 | 64 |
| Dünya parti AI update | 32 | 32 |
| Temel parti üretimi, 32 karede | 320 | **0** |
| AI update sırasında silinen toplam parti | 608 | **288** |
| `ensureWorldParties` toplam (64 çağrı) | 3.400,9 ms | **6,6 ms** |
| Temel ensure safhası toplam | 3.395,5 ms | **3,7 ms** |
| `mapSimulation` toplam (32 kare) | 3.704,2 ms | **273,1 ms** |
| `mapSimulation` ort. ms/kare | 115,756 | **8,534** |
| 32 kare `early` V1.41 `loop.updateMap` | 112,453 ms/kare | **9,331 ms/kare** |
| `early` V1.41 rAF aralığı | 155,371 ms | 143,006 ms |

Bu gözlemler temel parti üretim döngüsünün **ortadan kaldırıldığını** ve aynı oyun fonksiyonu ölçümünde harita güncellemesinin yaklaşık **13,6 kat daha az CPU süresi** tükettiğini gösteriyor. Önceki 3 günlük kuralı izleyen `lastRespawnDay` korunuyor; ilk açılış üretimi ve 0-gün override testle garanti altında. Her güncellemede bulunan **ikinci ensure çağrısı hâlâ devam ediyor**, ancak base fase no-op olduğu için ~0,1 ms/çağrı; gereksiz refactor'a gidilmedi.

**Açık sonraki V1.43 sorunu:** 9 ek görünür parti (refugee, merchant, messenger, villagers, noble) **her karede oluşturulup hemen siliniyor** (32 kare / 288 kimlik). Bu döngünün çalışma maliyeti küçük kalmış (`worldPartyUpdate` ~7,275 ms), ama davranış doğru değil. NPC/quest/encounter sistemini koruyacak şekilde, ayrı kararla ve regresyon testleriyle ekstra havuz ömrünü, sayısını, spawn yerini / despawn politikasını incele. Özellikle oyuncuya yakın dünya parti varlığını ve kaynak bağını doğrulamadan sadece FPS uğruna AI'yı seyrekleştirme.

**Durum:** V1.42 tanı + en küçük gerçek düzeltme + CI PASS; PR #68 DRAFT/UNMERGED, O00-06 açık, main/Unity dokunulmadı. Başsız SwiftShader'ın ~140ms rAF süresi oyuncu FPS tahmini için kullanılamaz.
