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
