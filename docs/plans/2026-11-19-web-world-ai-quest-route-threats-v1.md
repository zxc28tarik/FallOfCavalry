# Fall of Cavalry WEB — Character System v2 V1.18: Normal Dünya AI'sında Gerçek Ticaret Yolu Görevleri

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry`, yalnız WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT/UNMERGED · **O00-06:** UYGULAMADA · **V1.18 alt işi:** QA PASS.

## Neden bu iş?

V1.17 gerçek bir `battle_result` kaydının `secure_trade_route` görevini ilerletmesi için düşman dünya partisinin tam `routeId` ile eşleşmesini zorunlu tuttu. Ancak normal `world-ai` bandit partileri bu alanı üretmiyordu; ayrıca `wai-...` geçici düşman aracısı bağlamı aktarmıyordu. Böylece doğru görev teknik olarak tamamlanabilir olsa da normal oynanışta çoğunlukla gerçek kaynak çıkmıyordu. V1.18 bu darboğazı kaynaklı, sınırlı ve test edilmiş biçimde giderdi.

## Yapılan mühendislik

1. **`js/systems/quest-world-party-links.js`**: Yalnız kayıtlı `EconomyManager.ensureTradeRoutes()` yolunun iki gerçekten var olan, koordinatlı yerleşimi varsa kabul edilir. Haydutun `kind`, `factionId`, `x/y` konumu ve devriye hedefinin yol bağlantı koridoruyla uyumu denetlenir. Sahte hedef, başka şehir, yanlış fraksiyon, geçersiz rota veya save ile keyfî hedef koordinatı bağı yetkilendirmez.
2. **`js/systems/world-ai.js`**: Yeni sıradan haydut partisi, geçerli ticaret rotası varsa rota üzerinde (şehir merkezleri arasındaki bağlantı koridoru) doğar; `routeId` ve hedef uç yerleşim kaydedilir. AI ilgili iki yerleşimin uçları arasında devriye döngüsü kurar. Yetkili rota yoksa eski genel haydut üretim davranışı sürer.
3. **`WorldPartyManager.ensureWorldParties`**: Gerçek, süresi geçmemiş, `status=active`, henüz kanıtlanmamış `secure_trade_route` görevinin hedef yolunda canlı haydut yoksa en fazla **üç farklı aktif hedef rota** için sıradan, prosedürel bir rota haydut grubu oluşturur. Aynı rotada grup varsa ikincisi eklenmez; objective tamamlandıysa ya da görev `available`/geçersiz/expired ise yeni parti üretilmez. Görev kazanımı veya karakter/XP/özel makam icat edilmez.
4. **`WorldPartyManager.syncVisiblePartiesToWorld`**: worldAI parti verisinin `routeId` ve `commanderId` alanları körlemesine görünür savaş düşmanına taşınmaz. Rota yeniden gerçek yerleşim/rota/konum/hareket hedefiyle doğrulanır. `commanderId` yalnız `state.commanders` içinde canlı ve `partyId`/ `worldPartyId` değeri tam eşleşen komutan kaydı varsa üretilir; uydurma komutan yok.
5. **`WorldSimManager.processWorldAiEncounters`**: AI karşılaşmasının `wai-...` geçici düşmanına aynı doğrulanmış kaynak bağını taşır; ardından mevcut V1.17 `BattleManager` ve `QuestEventMatcher` zinciri gerçek zaferi doğru göreve uygulayabilir.
6. **`SaveManager`**: Gerçek otorite kaynağı `this.game.worldManager.worldAi`, `worldManager.enemyParties` ve `worldManager.lastEncounterEndTimeByEnemyId` üzerinden okunur. Önceki yanlış üst düzey `game.worldAi` alanı gerçek oyunda yoktu; bu nedenle save sırasında WorldAI partileri kaybolup load sonrası yeniden üretiliyordu. Şimdi parti **ID ve `routeId` birlikte kaydedilir**, aynı bandit ID'si load sonrası korunur ve bağlantı ayrıca canlı dünya registry'sine göre yeniden doğrulanır. Yerel save bağımsız tamamlanma kanıtı değildir; `QuestEventLedger.pending` ve `QuestSnapshot.objectiveClaims` inert kalır.
7. **`EconomyManager.ensureTradeRoutes`**: AI sistemi dünya açılışında yerleşimler henüz yüklenmeden boş `tradeRoutes=[]` yaratırsa, en az iki gerçek yerleşim gelince yol listesi bir kere doğru biçimde oluşturulur. Önceden boş olmayan, kalite/hasar içeren gerçek rota listesi üzerine yazılmaz. Bu düzeltme olmasaydı tarayıcı smoke'daki V1.14 görev oluşturma da bozuluyordu.

## Testler

- `tests/unit/quest-world-party-links.test.js`: 11 yeni test. Gerçek rota ve iki şehir, sahte/yanlış endpoint, fiziksel uzaklık, devriye hedefi, mevcut AI bandit spawn ve hareket, komutan registry doğrulama, görünür dünya bağlantısı, `wai-` geçici muharebe kaynak aktarımı, resmî görev hedefinde kısıtlı threat spawn, yanlış/expired quest reddi, SaveSystem/SaveManager rota roundtrip.
- `tools/browser-world-smoke.mjs`: gerçek Chromium + 881 yerleşim dünyasında gerçek `QUEST_DEFS` aktif görev → rota ile bağlı haydut → quickSave/quickLoad sonrası **aynı dünya-parti kimliği** ve rota kaynağı → yalnız testin oluşturduğu ek haydut/görev temizliği. Var olan NPC ve görev save regression'ı da korunur.

## QA — gerçek kod HEAD

**Son doğrulanmış kod HEAD:** `8079bf32775a89b6aea2e80a49f52937f18aa122` (önceki görev tehdidi kodu: `c878cd5`).

- [Son kod Web validation #44510118117](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44510118117): **PASS** — 663/663 unit, 1.075 genel PASS + 1 skipped, static checks/build ve world audit başarılı.
- [Son kod Chromium #44510118273](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44510118273): **PASS** — gerçek dünyada 880 ticaret rotası, aktif güvenlik görevi, aynı bandit party ID + routeId save/restore ve test yalıtımı. Log: `samePartyId=true`, `persistedWorldParty=true`, `newParties=1`; önceki NamedCharacter quest restore testi de PASS.
- Önceki kod aşaması: [#44509005635](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44509005635) 662 unit/1.074 general PASS ve [browser #44509005548](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44509005548) PASS. Sonraki gerçek dünya-partisi save kimliği onarımı yukarıdaki son HEAD'de yer alır.
- World audit: **881 yerleşim, 304 yol, 3 nehir, 4 geçit; 0 hata, mevcut 1 uyarı**.

**Hata geçmişi gizlenmedi:** İlk uygulamada tarayıcıda `tradeRoutes=[]` kalma problemi ([run #44507651544](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44507651544)) gerçek başlangıç sırası hatasıydı; `EconomyManager.ensureTradeRoutes` onarıldı. İlk yeni test paketinde 2 yanlış default/named manager import'undan kaynaklanan fixture hatası ([run #44507841352](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44507841352)) giderildi. Save/Load smoke'da `newParties=20` görülmesiyle gerçek `WorldManager.worldAi` yerine boş eski `game.worldAi` alanının yazıldığı tespit edildi. `SaveManager` doğrudan kaynak yöneticisine bağlandı; yeni Chromium testinde aynı parti ID'si korundu ve `newParties=1` görüldü. Son kod HEAD'deki iki QA PASS.

## Açık sınırlar

- Mevcut `EconomyManager.ensureTradeRoutes` bağlantıları yerleşim sıralamasından üretiliyor; dünya haritasındaki gerçek 304 yolun (`worldState.roads`) birebir topolojik eşleştirmesi henüz yok. Burada doğrulanan, oyun motorunun gerçek ticaret yolu *kaydının iki gerçek yerleşimi arasındaki koridordur*. Sokak/yol mesh üzerinde tam mühendislik tamamlandı denemez.
- `state.commanders` pek çok mevcut kampanyada boştur. Komutanı uydurarak görev açmak yerine mevcut kayıtlı komutan varsa kimlik/party bağı kullanılır. Gerçek komutan AI yaşam döngüsü ve askerî görev görünürlüğü açık.
- Gerçek Chromium'da görev tetikleme ve kaynak bağlantısı/save roundtrip kanıtlandı; **canlı tam taktik muharebenin kazanılıp görev completion butonuna tıklanması** bağımsız tam E2E kanıtı değildir.
- `questSnapshot.objectiveClaims` ve `questEventLedger.pending` save'den aktif görev hakkı vermez. Gerçek, yarım kalmış objective ilerlemesini yükleme sonrası ödül sızıntısı olmadan devam ettirmek için ayrıca yetkili world receipt tasarımı gerekir.
- İsimli karakter, aile/örgüt nüfuzu, makam değiştirme UI, diplomasi simülasyonu, tarihsel A/B kataloglar ve tüm Character System v2 **tamamlanmadı**.

**Sıradaki:** V1.19 gerçek rota topolojisi / tam savaş click-through ve güvenli quest objective continuation tasarımı. **PR #68 kullanıcı onayı olmadan `main`e alınmayacak.**
