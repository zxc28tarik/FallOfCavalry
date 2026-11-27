# Fall of Cavalry WEB — V1.45: Yaşayan bölge, gerçek kaynaklı temel dünya birlikleri

**Tarih:** 21 Kasım 2026 · **Kapsam:** O00-06, yalnız WEB, taslak PR #68, `codex/web-world-npc-roster-20261118` · Unity ve `main` değiştirilmez.

## Önceki gerçek ölçüm ve sorun

[V1.44 Chromium #44851932546](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44851932546) PASS: Seed1337 gerçek dünya haritası **881 şehir, 304 yol, 3 nehir, 4 geçit**. Oyuncu Osmanlı'ya ait gerçek bir şehirde **(21200,14640)** başlıyor; 40 karo içinde **10 kayıtlı şehir** var. İlk 19 dünya partisinin **9 sivil NPC'si oyuncuya yakın** ve sonraki 32 oyun karesinde hayatta. Buna karşılık ilk 4 haydut, 3 devriye ve 3 sıradan kervanın **10'unun tamamı uzak bölgede doğuyor**, 40 karoluk AI etkin mesafesinin dışında kalıp siliniyor. V1.42/V1.43 üç oyun günlük yeniden doğma kuralları nedeniyle bunlar aynı gün geri gelmiyor. Oyun görünür sivil nüfusa sahip olsa bile temel savaş/ekonomi dünya trafiği yok.

## V1.45 politika ve uygulama

- `js/systems/world-ai-local-sources.js`: yalnız dünya kaydında gerçekten var olan `settlements[]` ve geometrisi doğrulanan `canonicalRoadLinks()` kullanılır. **Oyuncu çevresi = mevcut `DESPAWN_DISTANCE` (varsayılan 40 karo) eksi dört karoluk koruma payı**. Yakında yerleşim yoksa eski dünya geneline ilişkin üretim geri dönüşü korunur. Var olmayan şehir/yol eklenmez.
- `js/systems/world-ai.js`: `ensureWorldParties` oyuncunun gerçek konumunu alır; ilk 4 haydut, 3 devriye ve 3 kervan aynı kota ve aynı 3 oyun günlük yenileme zamanlamasıyla **yakındaki gerçek kaynaklardan** oluşturulur. Konum verilmediğinde eski kaynak seçme API davranışı sürer.
- Devriye `factionId` bilgisi, yerel kaynak şehirde kaydedilmiş gerçek sahipten okunur; hedef mümkünse o bölgede gerçek kaynak şehirdir. Uygun gerçek ve bağlantılı yol varsa ilk devriye yürüyüş yolu, o yolun `road.path` kayıtlarından alınır.
- Sıradan kervan aynı gerçek şehir/yol önceliğiyle doğar, hedefi gerçek başka şehir olur. `routeId` ya da görev/kargo kaydı **kendiliğinden uydurulmaz**. İlk yolculukta kanonik yol varsa onun gerçek `road.path` noktaları kullanılır. Bağlantılı yerel yol yoksa eski normal kervan rotası davranışı korunur.
- Rota bağlantılı haydutlar `spawnBanditOnRegisteredRoute` üzerinden **yalnız bir gerçekten kayıtlı ticaret yolunun, gerçekten mevcut `road.path` noktalarında**, etkin oyuncu bölgesinde oluşturulur. Sözde bir rota bağlantısı veya keyfî bir yol çizgisi yoktur. Oyuncunun yaklaşık **8 karo** yakınından geçen tek yol noktası varsa başlangıçta zorunlu çatışma oluşturulmaz: doğrulanmış daha güvenli nokta yoksa haydut, gerçek bölge şehirlerinin kırsalından **rota kimliği taşımayan** normal haydut olur.
- `registeredTradeRoute`: gerçek yol ağı mevcutsa `routeId` mutlaka kanonik yolun kendi gerçek kimliğiyle eşleşir. Hayalî `route:fake:fake` iki doğru şehir kimliğini kullanarak kaynak yetkisi kazanamaz. Eski testin koruduğu kural saklıdır: **`roadBacked:false` gibi kayıt bayraklarından değil gerçek yol geometrisinden yetki türetilir.** Kaynak bağlı aktif görev ve eskort yolları bozulmaz.
- `WorldPartyManager`: yalnız temel `ensureWorldParties` çağrısına gerçek `playerParty` konumunu geçirir. Görev kaynaklı haydutların özel rotası, aktif eskort ticaret/loot yükü, asker davranışı, savaş, render, tur sayısı ve kaydet/yükle şeması dokunulmaz.

## Regresyon ve gerçek tarayıcı kabul kapısı

- `tests/unit/world-ai-local-sources.test.js`: **11 yeni Vitest testi** — 4/3/3 kotası, 40 karo mesafesi, gerçek kanonik yol banditi, uzak hasarlı rota seçimine karşı kaynak koruması, sahte rota ID, agresif yakın doğma engeli, devriye fraksiyon-kaynak tutarlılığı, gerçek şehirler arası kervan ve yol noktaları, üç günlük cooldown/parti kimliği, şehir olmayan bölgenin önceki davranışı, gerçek hareket/karşılaşma, bozuk koordinat.
- `tools/browser-world-geography-profile.mjs` gerçek ilk `LIVE_PRE_CULL` parti dalgasını ve sonra **32 doğal rAF oyun karesini** ölçer; V1.44'ün canlı 9 sivil NPC + gerçek Osmanlı şehri kontrolleri korunur.
- Yeni V1.45 Chromium kapısı: ilk dalga tam **4 haydut, 3 devriye, 3 kervan**, **onunun da** oyuncunun 40 karo çevresinde gerçek `homeCityId` bağlantısı vardır; 32 kare sonra en az **6 temel birlik**, her türden en az biri yaşamaya devam eder. Kanıt `output/browser-smoke/world-geography.json`, önceki yaşam döngüsü raporu `output/browser-smoke/party-lifecycle-profile.json`.
- Mevcut 857+ birim, tüm savaş/görev/ekonomi/eskort/kayıt, tam Chromium oyun kabulü, V1.40–V1.44 testleri PASS olmadan V1.45 tamamlandı denmez. Ayrı CI runner başsız SwiftShader kare aralığı, oyuncunun Windows GPU FPS ölçümü olarak sunulmaz.

## Sınırlar, açık risk ve devam

Bu aşama **başlangıç/yeniden doğma anındaki gerçek aktif bölgeyi** düzeltir; oyuncu gün içinde yüzlerce karo yürüyüp bir başka ülkeye ulaştığında, her bölgenin ayrı kalıcı parti simülasyonu/yeniden doğma algoritmasını otomatik tasarlamıyoruz. Sıradan kervanın ilk bağlı gerçek yolu kanıtlanabilir; ileriki geçişlerde tüm kıta boyunca doğrulanmış çok bağlantılı ticaret yollarını modellemek ayrı konu. Bunları hayalî routeId vererek çözmek yasaktır.

**Sonraki aday V1.46:** Dünya bölgesi değiştiğinde kimliği/görevleri kaybetmeden gerçek yakın şehir/yollar üzerinden etkin parti akışı, kaynaklı çok adımlı kervan ve devriye yönleri, çok fraksiyonlu yol ağının prova testleri. Oyun davranışı ve save/quest değişiklikleri ayrıca kanıtlanmalı.

**CI otoritesi:** Exact HEAD ve en güncel CI sonuçları [PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68)'de tutulur. Bu dosyayı PASS iddiası için geçmiş koşuya bağlamayın. Taslak PR, merge yok, Unity/`main` dokunulmadı.
