# Fall of Cavalry WEB — Character System v2 V1.19: Gerçek Dünya Yol Grafına Bağlı Ticaret Görevleri

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` yalnız WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT/UNMERGED · **O00-06:** UYGULAMADA · **V1.19 yol-topolojisi alt işi:** QA PASS.

## Gerçek veride bulunan ayrım

V1.18'de `EconomyManager.ensureTradeRoutes()`, 881 yerleşimin **liste sırasından 880** ticaret yolu oluşturuyordu. Ancak `WorldGenerator.connectRoads()`, yalnız şehir ve kalelerin en yakın iki komşusunu bağlayan **304 gerçek yol** oluşturuyor; her yolda `{from, to, path}` bulunuyor. Birbirinin ardından listelenen iki yerleşimin mutlaka gerçek bir yol ile birleştiği çıkarımı doğru değildi. Yolun `path` koordinatları **harita karesi (tile)**, oynanıştaki yerleşim `x/y` koordinatları ise **dünya pikseli**.

## Uygulanan V1.19

1. **`js/systems/world-trade-road-topology.js`**: kanonik `WorldGenerator` yollarının `from/to` kimliğini, mevcut iki yerleşimi, iki uçtaki gerçek `path` koordinatlarını ve yönünü doğrulayan saf kaynak. Duplikat, geçersiz bağlantı, dangling settlement ID ve kopuk waypoint reddedilir. Gerçek map dizileri değişmediği sürece `WeakMap` cache kullanılır.
2. **`EconomyManager.ensureTradeRoutes`**: başlangıçta yalnız boş şehir/yol listesi görülmesi sonrası yeniden kurma korunuyor. Gerçek yollar `roadBacked=true` olarak listenin başında **304** kanonik kayıt verir. Eski sıra-temelli rotalar, eski görev/save kimliklerine uyumluluk için tutulur; gerçek yol çakışması varsa tekilleştirilir. Procedural seed 1337 ile **1.165 toplam ticaret kaydı** oluşur (304 gerçek yol, 861 uyumluluk satırı). Yeniden kurmada aynı world map üzerindeki mevcut kalite/hasar modifikasyonları mümkün olduğunda saklanır.
3. **`EconomyManager.pickQuestTargetRoute`**: haritada kanonik yollar varsa yalnız `roadBacked` kayıtlar arasından hedef seçer. Yeni gerçek görev artık liste-komşusu ancak fiziksel olarak bağlı olmayan rotada açılamaz. Geçerli yol bulunmayan yerleşimde görev sessizce uydurulmaz.
4. **`quest-world-party-links.js`**: `registeredTradeRoute` artık haritada `roads` mevcutsa aynı `from/to` gerçek yol bağlantısını da arar. `validBanditRoute` konumunu artık **gerçek yolun polyline'ına** göre sınar; düz şehirler-arası kestirme çizgiyi yol saymaz. Yeni haydut gerçek yolun orta waypoint'i üzerinde üretilir.
5. **`world-ai.js`**: bu tür haydutlar bir sonraki hedefe düz atlamak yerine `roadWorldWaypoints` üzerinden **tile→world pixel** dönüşmüş yol noktalarını takip eder; ters yöndeki devriye desteklenir. Haritasında gerçek `roads` kaydı olmayan eski test/özel dünyalar için kontrollü eski geometri fallback'i bırakıldı.
6. **`tests/unit/world-trade-road-topology.test.js`**: 7 yeni test; kenar kaynak bütünlüğü, gerçek olmayan bağlantıyı reddetme, eski rota alias uyumu, geç yüklenen yol grafı ile yeniden oluşturma, değiştirilmiş route modifier saklama, gerçek yol waypoint/piksel dönüşümü, gerçek devriye yolu.
7. **`tools/browser-world-smoke.mjs`**: gerçek Chromium kampanyasında `generatedRoadCount=304`, `roadRouteCount=304`, `topologyExact=true`, `targetIsRealRoad=true` denetlendi. Aynı aktif `secure_trade_route` görevi, hedef haydut, `samePartyId=true`, `persistedWorldParty=true` ve save/load sonrası bağ doğrulaması geçmeye devam ediyor.

## QA

**Kod HEAD:** `91dbdeaf3aa8aafa96ff39944255375b618dd25c`.

- [Web validation #44512483681](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44512483681) **PASS**: **670/670 birim testi**, **1.082 genel test PASS + 1 skipped**, statik kontrol ve üretim build PASS.
- [Gerçek Chromium #44512483647](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44512483647) **PASS**. İşletilen dünya: **881 settlement, 304 generated roads, 304 road-backed economy routes, 1165 total routes**. Gerçek görev + bağlı bandit + aynı worldAI ID save/restore, Named NPC ve eski QuestSnapshot regresyonu PASS.
- World audit: **881 yerleşim, 304 yol, 3 nehir, 4 geçit, 0 hata, önceden mevcut 1 uyarı**.

## Kasten tamam sayılmayanlar

- **Genel dünya AI rota bulma**: kaynağı doğrulanmış görev haydutları gerçek yol polyline'ını takip eder. Başka hedeflere giden genel karavan/devriye AI'sının `findRoadPath` yaklaşımı hâlâ yol grafı üzerinde tam shortest-path ağı değildir. V1.19 tüm ordu/nav mesh/pathfinding mühendisliğini bitirmiş sayılmaz.
- **Eski save görevi**: geçmiş sıra-komşusu `targetRouteId` bilgisi restore edilebilir ancak yol grafında karşılığı olmayan geçmiş görev **yeni doğrulanmış savaştan kredi alamaz**; otomatik hedef değiştirme/sahte tamamlama yapılmaz. Bu eski görevler için açık migrasyon/iptal-etkinleştirme UX'i ayrıca gereklidir.
- **Kısmi ilerleme save/load**: daha önce kaydedilmiş `QuestSnapshot.objectiveClaims` ve `QuestEventLedger.pending` hâlâ inert. Kaydedilmiş olayları tek başına güvenilir galibiyet gibi işlemek, XP/altın/başarı tekrarı yapmak yasak kalır.
- **Taktik battle→quest completion click-through**: gerçek browser testi rota/parti/quest/save akışını doğrular; savaşta gerçekten galip gelip QuestCompletionOverlay düğmesine basan bağımsız E2E senaryosu henüz yok.
- **Komutan AI yaşam döngüsü**: komutanı kaynaksız üretme yok; mevcut `state.commanders` party bağları varsa doğrulanıyor. Gerçek komutan oluşturma/ordu yönetimi, Organization UI, tarihsel A/B katalog, diplomasi, kapsamlı sosyal sistem alt işleri sürüyor.

**Sıradaki V1.20:** live tactical battle → quest completion click-through; sonra güvenli partial-objective continuation ve legacy yol hedefleri için kullanıcıya görünür ayrım. **PR #68 taslak, main'e kullanıcı onayı olmadan merge edilmez.**
