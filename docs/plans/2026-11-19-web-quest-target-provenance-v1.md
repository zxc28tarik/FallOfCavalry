# Fall of Cavalry WEB — Character System v2 V1.17: Yetkili Görev Hedefi / Olay Eşleştirme

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68), DRAFT / UNMERGED · **O00-06:** UYGULAMADA · **V1.17:** hedef eşleştirme alt işinde QA PASS.

## Neyi çözüyor?

V1.16 gerçek savaş sonuçlarını `game.questEventLedger.observed` listesinde saklıyor ama herhangi bir göreve kredi vermiyordu. V1.17, oyunda gerçekten çözülmüş bir olaydan `QuestManager.updateObjective`'e geçmek için açık, daraltılmış ve kaynakla eşleşen kurallar ekliyor. Ödül ancak oyuncunun açılan resmî completion path'ini seçmesiyle, mevcut `QuestManager.completeQuest` üzerinden verilir; olay eşleştirme doğrudan altın/XP/NPC ödülü dağıtmaz.

## Uygulanan kod

1. `js/systems/quest-event-matcher.js`: yalnız güncel işlemde `ledger.observed` içinde bulunan, görevden önce yaşanmamış, süresi geçmemiş ve `status=active` olan resmî `QUEST_DEFS` görevleri için üç kurallı hedef eşleştirme. Kanonik objective tipi ve completion path outcome ayrıca yeniden doğrulanıyor; bir objective bir defadan fazla ilerletilmiyor.
2. `js/systems/quest-event-ledger.js`: mevcut v1 kayıt şemasına geriye uyumlu `encounter_choice` kanıtı ve yalnız gerçek dünya-partisi kaynaklı `routeId`, `commanderId` kimlikleri eklendi. `pending` geçmiş asla hak edilmiş oyun sonucu yerine geçmiyor.
3. `EncounterManager.resolveEncounter`: yalnız gerçek, canlı `messenger` world party için *başarılı* `seize` (el koyma/yakalama) tercihi sonucu `messenger_caught` kanıtı. Başarısız girişim, `stop`, `read`, `interrogate` ve halen placeholder olan `follow` hiçbir görevi tamamlamaz. `applyEncounterOutcome` başarıda “Messenger detained, message seized”, başarısızlıkta “Messenger escaped with message” sonucu üretir; haberci el koyma artık sıradan +12 altın loot değildir. Karşılaşma kapatılıp haritaya dönüldükten sonra, sadece önceden aktif olan `intercept_messenger` görevi ilerler.
4. `BattleManager.resolveBattle`: gerçek battle result'ı tuttuğu gibi, yenilen partinin `factionId`/ID'si battle result ile aynıysa ve `enemyParty.routeId` gerçekten `EconomyManager.ensureTradeRoutes()` içinde varsa bu *kaynak* bağlantıyı kayda koyar. `enemyParty.commanderId` de ancak `state.commanders` kayıtlarında aynı kişi varsa kaydedilir. Yakın şehir/harita koordinatları rota veya komutan kimliği yerine kullanılamaz.
5. `BattleManager.exitBattleResultToMap`: zaferin olay kaydı map'e geri dönüldüğünde görevle eşleştirilir. `secure_trade_route` için *yalnız* kayda geçmiş aynı `targetRouteId` ve bandit parti; `neutralize_commander` için *yalnız* aynı resmî `targetCommanderId` ve kimliği doğrulanmış komutan. Savaş zaferi, esir alma veya geri çekilme iddiası yaratmaz.
6. `tests/unit/quest-event-matcher.test.js`: 8 yeni test; gerçek `EncounterManager.resolveEncounter` başarı/başarısızlık, hedef rota/komutan olumlu-olumsuz, genel zaferden kredi vermeme, süre, aktif/available ayrımı, duplicate, save pending kaynak reddi.

## Sınırlar — tamamlandı iddiası **yok**

- Dünya AI'sının mevcut `WorldPartyManager` örnekleri her haydut birliğine yetkili `routeId`, her askerî birliğe `commanderId` bağlamıyor. Bu nedenle **normal savaştaki bandit zaferlerinin çoğu kaynak eksikliğinden görev tamamlatmaz**. Bu tasarım bilinçli olarak güvenli varsayılandır; sırf bir yola yakın olmak görevin hedefi değildir.
- Kaydedilen `ledger.observed` ve `QuestSnapshot.objectiveClaims`, sonraki Save/Load'da **inert pending** olarak değerlendirilir. V1.17 gerçek olay yaşanan oturumda ilerler; geçmiş save'i sahte hedef zaferi olarak onaylayan bir yol **yoktur**. Tam ve güvenilir kısmi görev devamlılığı sonraki iştir.
- `follow` hâlâ placeholder; escort/supply/fort/intelligence/komutan esir alındı/retreated hedefleri için yeni uydurma outcome atanmıyor.
- Birim testi gerçek `EncounterManager` eylemini çalıştırır. Chromium smoke hâlâ genel oyun açılışı/save-load yolunu doğrular; bağımsız manuel arayüz tıklamasıyla görev yakalama veya gerçek taktik muharebe→görev browser click-through testi henüz eklenmedi.
- Kayıt yerel tarayıcıda olduğundan kaydedilmiş satır **sunucu imzalı, kriptografik olarak yetkili** kanıt değildir. Yükleme sonrası yeniden oynanmış gibi varsayılmaz.
- Bağımsız organizasyon makam UI, oyuncu kararları, tarihî karakter katalogları ve uzun AI/diplomasi yaşam döngüsü ayrıca açık kalır.

## CI ve hata izleri

- İlk kod commit'i `b2fecee`: browser [#44505105763](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44505105763) PASS; [validation #44505105824](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44505105824) **FAIL** — 2 yeni fixture, `WorldManager.clampToWorld` taklidi eksik. Uygulama hatası değil test düzeneği hatası.
- Test düzeneği düzeltmesi `a8ac79d`: [validation #44505382350](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44505382350) PASS, [browser #44505382469](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44505382469) PASS.
- Anlamlı başarılı yakalama semantiği ve güvenlik kontrolü eklenen kod HEAD `e215095741738ae375b06403b942cf5c77287b58`: [Web validation #44505683827](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44505683827) **PASS: 652/652 unit, 1.064 genel PASS + 1 skipped**. [Chromium #44505683785](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44505683785) **PASS**. World integrity: **881 settlement, 304 road, 3 river, 4 crossing; 0 error / mevcut 1 warning**.

## Sıradaki iş

**V1.18:** yetkili world-party/route patrol ve commander bağları gerçek dünya üretiminde tanımlansın; savunulabilir görev kanıtı ile gerçekten oynanabilir rota/komutan görevleri olsun. Save sonrası kısmi görev ilerlemesi için yerel arşiv iddiasını ödüle dönüştürmeyen ayrı doğrulama yöntemi ve tarayıcı click-through eklensin. **PR #68 kullanıcı izni olmadan `main`e alınmayacak.**
