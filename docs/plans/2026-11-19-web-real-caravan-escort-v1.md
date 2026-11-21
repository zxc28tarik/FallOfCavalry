# Fall of Cavalry WEB — Character System v2 V1.22: Kaynaklı Kervan Refakati ve Cezasız Eski Görevden Çıkış

**Tarih:** 19 Kasım 2026 · **Kapsam:** yalnız `zxc28tarik/FallOfCavalry` WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT / UNMERGED · **O00-06:** UYGULAMADA · **V1.22 alt işi:** QA PASS.

## Neden?

V1.21, kanıtsız yerel save kayıtları için özel bekleyen-tarihçe koruması ve eski sıra-temelli ticaret yolları için oyuncu onaylı hedef değişimi sağladı. Ama `escort_first_caravan` görevinde gerçek oyundaki kervan partileri bir göreve bağlı değildi, rastgele şehirler arasında dolaşıyordu; `caravan_arrived` gerçek bir kervan varış olayıyla kanıtlanmıyordu. Hedef yol artık gerçek `WorldGenerator.roads` ağıyla doğrulanabildiğine göre bu bağlantı kurulabilir.

## Uygulama

1. **`js/systems/quest-caravan-escort.js`**: yalnız gerçekten aktif, süresi dolmamış, kanonik `escort_first_caravan` görevine ve `registeredTradeRoute(...).road` tarafından doğrulanmış gerçek `from/to/path` yoluna bağlı ayrı kervan oluşturulur. `routeId`, `escortQuestId`, başlangıç/hedef yerleşim ID'si ve tile→world waypoint'leri saklanır. `WeakSet` ile nesnenin **aynı JS oturumunda gerçekten spawn edildiği** doğrulanır; JSON klonu/yerel save kaydı otorite olamaz.
2. **Dünya hareketi**: kervan ilk kaynak şehirde oyuncuyu bekler; oyuncu yaklaşık **5 tile / en az 100 piksel** yakınında bulunmadan ilerlemez. Oyuncu hareket sırasında 5 saniye boyunca uzak kalırsa gerçek `QuestManager.failQuest(..., 'escort_abandoned')` akışı ve şablondaki başarısızlık etkileri uygulanır. Kervan yalnız gerçek yol waypoint'leri üzerinde hareket eder; son waypoint'te varış koordinatı doğrulanır, en az iki waypoint ve bir saniyelik canlı refakat olmadan `caravan_arrived` kabul edilmez. Çok kısa yollar için yol sonunda asgari süre dolana kadar kervan bekler.
3. **`WorldPartyManager` + `world-ai`**: escort partileri en fazla üç yeni aktif görev için gerçek yolun başlangıcına eklenir, standart rastgele karavan roaming/despawn algoritması bunları hareket ettirmez. Kaynak-kontrollü eskort güncellemesi ayrı çalışır. Kervan geldiğinde veya görev süresi dolduğunda bu parti silinir. Görevin hedefi tamamlandıysa tekrar kervan yaratılmaz.
4. **`QuestEventLedger`**: yeni `caravan_arrival` olayı `caravan:<realQuestPartyId>:<resolvedAt>` ile kaydedilir. Sadece canlı nesne, birebir etkin görev ID'si/route ID'si, gerçek kaynak/hedef yerleşimleri, yol sonu, fiziksel varış ve canlı süreç şartları sağlanırsa `observed` olur. Save/Load sırasında `observed` → **inert `pending`**, kendiliğinden ödüle dönüşmez.
5. **`QuestEventMatcher`**: resmi `QUEST_DEFS.escort_first_caravan` içindeki `deliver_caravan_safely` objective ve `caravan_delivered` tamamlanma yolu için yalnız birebir aynı `questId + routeId` kaynağı kredi alır. Kazanılan görev seçeneği otomatik ödül vermez; normal `QuestCompletionOverlay` ve `QuestManager.completeQuest` tarafından kullanıcı onayına sunulur. Başarı seçeneğinin gerçek şablon ödülü **250 altın +2 itibar** ve `improve_trade_route` world effect'tir.
6. **`SaveManager`**: `quest-escort-` ID'li ve `escortQuestId` içeren proses-lokal kervanlar worldAI save'ine yazılmaz ve save'den tekrar **kaynak yetkili kervan** olarak yüklenmez. Aktif görev, gerçek kayıtlı route olduğu sürece yeni oturumda kaynak şehrinden yeniden eskort edilerek tamamlanabilir; kısmi rota ilerlemesi diskten sahte başarı olarak geri getirilmez. V1.21'in yalnız aynı sekmede doğrulanmış canlı objective receipt'leri ve diğer eski güven kapıları korunur.
7. **Eski desteklenmeyen rota görevi UX'i**: `legacy-trade-route-recovery.js` ve `QuestRecoveryPanel.js` artık desteklenmeyen `roadBacked=false` görev için açıkça **“Eski görevi cezasız bırak”** butonu gösterir. `QuestManager.retireLegacyQuest` yalnız kullanıcı bu adımı seçince eski görevi `legacy_route_retired` nedenli arşive taşır; şablonun `failureEffects` listesi uygulanmaz, ödül yok, altın/ekonomi yol hasarı değişmez. Karakter görevi bağlantısı pasif başarısızlık tarihçesiyle sonuçlandırılır. Normal oynanabilir/kanıtlanmış görev otomatik emekliye ayrılmaz.

## QA — doğrulanmış kod

**Kod HEAD:** `89af0c7d311eef91a4a311690989ced73b56e06b`.

- [Web validation #44524473149](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44524473149) **PASS**: **695/695 birim test**, **1.107 genel PASS + 1 skipped**, static/build PASS, world audit **881 settlement / 304 road / 3 river / 4 crossing / 0 error / eski 1 warning**.
- [Gerçek Chromium #44524473366](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44524473366) **PASS**:
  - Gerçek kaynak yol `route:419:423`; convoy başlangıçta oyuncuyu bekledi, `WorldPartyManager.updateWorldParties` 7 simülasyon tikiyle gerçek waypoint'leri geçti, `escortVisitedPoints=2`, `escortArrived=true`, event source=`caravan_arrival`, objective=`caravan_arrived` ve `QuestCompletionOverlay` aktif.
  - Gerçek **“Kervan güvenli ulaştı”** DOM butonu tıklandı: `defeat` değil `caravan_delivered` resmi path, **tam 250 altın** tek ödül, ikinci completion reddi, save/load sonrası sadece archived görev.
  - Eski `route:0:1` üzerinde desteklenmeyen refakat görevi: sayfa, kullanıcı onayı olmadan route'u değiştirmedi; gerçek **“Eski görevi cezasız bırak”** DOM butonu sonrası `legacy_route_retired` arşivi, **altın sabit, route.damage sabit**, save/load ve archive PASS.
- `tests/unit/quest-caravan-escort.test.js`: 6 yeni test. Live origin/player wait, canonical+expired source guards, forged JSON/cold pending event reddi, gerçek waypoint varışı ve 250 altın, oyuncu terk edince başarısızlık, save tarafı yetki devri yapmaması.
- `tests/unit/legacy-trade-route-recovery.test.js`: 2 yeni test. Kullanıcı onaylı cezasız unsupported escort retirement + oynanabilir/expired/fake quest reddi.
- İlk [Chromium #44523521856](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44523521856) FAIL: test sadece waypoint sayısına göre uzak bir kıta yolunu kısa zannetti. Test seçimi **gerçek mesafeye** çevrildi, ayrıca bir tile'lık gerçek yolun minimum bir saniye eskort süresi dolana kadar hedefte beklemesi için kaynak düzeltildi. Son HEAD iki QA PASS.

## Açık sınırlar

- Browser QA geçişi gerçek kervan movement/ledger/DOM completion kullansa da deterministik kalması için **yolu gerçek uzunluğuna göre kısadan seçer, testte kervan hızı geçici olarak artırılır ve oyuncu her tikte test koduyla kervanın yanına taşınır.** Bu, insanın normal fare/klavye ile uzun yolda konvoyu başarılı refakat edebilmesini, zorluk dengesini veya yönlendirme UX'ini kanıtlamaz.
- `WorldAI` genel karavan/ticaret/ordu shortest-path, kervanı düşmanlardan koruma, saldırı sonucu mal/koruyucu etkileri, koruyucu takım AI, yol güvenliği iktisadı henüz **tam bir refakat simulation** değildir. Teste giren kullanıcı kervana yakın durur; bu aşama özel quest path kaynağı ve güvenli ödül zinciri kurar.
- Aktif eskort kervanı kısmi yol konumuyla yüklenmez: yeni sekmede gerçek origin noktasından tekrar eşlik gerekir. Sunucu bağımsızlık/kalıcı yetkili receipt çözümü hâlâ açık.
- `investigate_missing_caravan` için sahte `bandits_located` outcome üretilmedi; dolayısıyla henüz tamamlanabilir world investigation logic yok. Aynı şekilde messenger follow, sahte patron/komutan kaynak, diğer legacy route görevleri otomatik çözülmüyor.
- Character System v2 sosyal, organizasyon makam UI, komutan AI yaşam döngüsü, genel nav/pathfinding kapsamı bitmedi.

**Sıradaki V1.23:** oyuncuya görünür escort başlangıç/konum/bekleme/tehlike HUD, uzun yolda savunma ve actual caravan bandit threat etkileşimi, `investigate_missing_caravan` için gerçek olay zinciri. **PR #68 taslak; kullanıcı izni olmadan `main`e alınmaz.**
