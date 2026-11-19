# Fall of Cavalry WEB — Character System v2 V1.23: Refakat HUD, Yol Tehdidi ve Kayıp Kervan Araştırması

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` yalnız WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT/UNMERGED · **O00-06:** UYGULAMADA · **V1.23 alt işi:** QA PASS.

## Ürün değeri

V1.22 kervanlar için gerçek harita yolu boyunca hareket, oyuncu yakınlığı, varış ve doğru `caravan_arrived` görev kanıtını sağladı. Ancak oyuncu kervanı haritada bulmakta zorlanabilir, kervanın neden beklediğini bilemez, gerçek yol haydutlarıyla konvoy etkileşimi yoktu. Ayrıca `investigate_missing_caravan` görevindeki `bandits_located` sonucu gerçek oyun dünyasından üretilmiyordu. V1.23 bunlar için **dar ve denetlenebilir bir ilk ürün akışı** ekler; tüm kervan savaşı/AI görev sisteminin tamamlandığı iddia edilmez.

## Üretilen işler

### 1. Refakat rehberi — `js/ui/QuestEscortHud.js`

- Haritada canlı aktif kervan varsa küçük HUD açılır: `Kervan Refakati`, başlangıçta bekleme/oyuncudan uzaklaşma/ilerleme/tehdit/varış doğrulama durumu, kervana uzaklık (tile) ve yol waypoint ilerleme oranı.
- `Kervana git` butonu oyuncunun `destX/destY/hasDestination` alanlarına **haritada mevcut kervanın o anki koordinatını** yazar; oyuncuyu ışınlamaz, otomatik takip/teleport üretmez. Hedef bir kere seçilir, kervan hareket ettikçe otomatik yenilenmez. Normal rota ve yeryüzü engelleri oyunun mevcut `WorldSimManager.updatePlayerParty` hareket kontrolüne tabidir.
- Görev tamamlanınca ve konvoy kaybolunca panel kapanır. Kayıt yüklenirken, yeni kampanya başlarken, oyuncu haritadan şehir/karşılaşma/savaş moduna geçerken sahte HUD kalmaz.
- `document.createElement` + `textContent` kullanılır; kayıtlı görev adı herhangi bir HTML koduna dönüştürülmez.

### 2. Yakın gerçek haydut nedeniyle kervanın beklemesi

- `WorldPartyManager.processQuestEscortCaravans` kendi `routeId` yolundaki, `validBanditRoute` tarafından gerçek `WorldGenerator.roads` yolu ve geometri ile doğrulanmış, halen yaşayan `kind=bandit` partilerini kontrol eder.
- Aynı yoldaki bir haydut kervana **2,5 tile** yakınlaşırsa `tickQuestEscortCaravan(... threat:true)` hareketi durdurur; HUD **“Haydut tehdidi: kervan bekliyor”** der. Haydut artık yakında değilse veya sahada bulunmuyorsa konvoy gerçek yol hareketine devam eder. Burada savaşın kazanıldığına ilişkin **yeni reward/objective event yoktur**. Haydutla oyuncu karşılaşması önceki normal WorldAI/BattleManager mekanizmasında kalır.
- Birlik koruma/konvoy HP/yağma/savaş sonucu özel başarısızlık ve otomatik muhafız AI henüz yoktur. Bandit tehdidi durağan bir küresel ceza veya uydurma saldırı üretmez.
- `tests/unit/quest-caravan-escort.test.js` için yeni test: gerçekten kaynaklı yol haydudu konvoy hareketini durdurur; bandit sahadan kaldırılınca ilerleme başlar. `tests/unit/quest-route-recon.test.js` de doğrudan threat parametresini kontrol eder.

### 3. Kayıp kervan araştırma görevi — resmî dünyasal kanıt

- `js/systems/quest-route-recon.js` yeni, `WorldAI.spawnPartyBandit` içinde gerçekten doğan haydut nesnelerini **RAM-only `WeakSet`** ile işaretler. İçe aktarılan save'de kopyalanmış bandit/routeId **tek başına kaynak kanıtı değildir**.
- Yalnız `investigate_missing_caravan` şablonu, `find_caravan_fate` objective, `bandits_identified` path, etkin/süresi dolmamış instance, `quest.targetRouteId` ile eşleşen **gerçek üretilmiş yol** ve `validBanditRoute` fiziksel kaynak şartı geçerlidir.
- İlerleme için oyuncu ya canlı route-bandit grubunu **yakında en az 1,5 saniye gözler** (uzaklaşınca sayaç sıfırlanır), ya da o gerçek banditin `WorldSimManager.processWorldAiEncounters` ile tetiklediği doğrulanmış `wai-<partyId>` karşılaşmaya gerçekten girer. Karşılaşma kaynağı canlı `worldEncounterPartyByEnemyId` ile doğrulanır ve oyuncunun yakınlığı kontrol edilir.
- `WorldPartyManager.ensureActiveQuestRouteThreats` bu görevler için de en fazla üç geçerli yol hedefinde kaynaklı normal bandit hazırlar. Mevcut kurtarılmış fakat proses-dışı bandit, yeni araştırmanın canlı kaynak otoritesi yerine geçirilmez. **V1.18 roadless sentetik güvenlik testleri için uyumluluk fallback'i korunur; araştırma gerçek roads olmadan başlatılmaz.**
- `QuestEventLedger` resmî `route_recon` olayını `recon:<worldPartyId>:<timestamp>`, `questId`, `routeId`, `bandits_located` ile loglar. Olay ancak canlı `WeakSet/WeakMap` gözlemi, aynı nesnenin dünya AI listesinde olması, gerçek yol geometrisi ve sahadaki mesafe sayesinde **observed** olarak yaratılır.
- `QuestEventMatcher` sadece bu kaynağı `investigate_missing_caravan.find_caravan_fate=bandits_located` olarak kredilendirir. Resmî `bandits_identified` seçeneği oyuncuya açılır; **100 altın +1 itibar** ancak normal `QuestCompletionOverlay` butonu tıklandığında, tek kez ödenir.
- Save dosyasına yazılmış `route_recon` `observed` satırı restore sırasında **inert `pending`** olur, soğuk oturumda görev tamamlanmasına izin vermez. V1.21'in tam eşleşen RAM-only canlı objective kanıtı sayesinde **aynı açık sekmede** kaydet/yükle, ödül butonu tıklanmamış görevi güvenle tekrar açabilir.

## Test kanıtları

**Son test edilmiş kod HEAD:** `cfb021eb2a7b2992dc676372ef49d0ec572b4d7c`.

- [Web validation #44529483856](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44529483856): **PASS 702/702 unit**, **1.114 full PASS +1 skipped**, statik/build PASS, world integrity **881 settlements, 304 roads, 3 rivers, 4 crossings, 0 errors, 1 mevcut warning**.
- [Gerçek Chromium #44529484043](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44529484043): **PASS**. Kaynaklı gerçek escort görevi ve 250 altın tek ödeme hâlâ geçer; `hudVisibleWhileWaiting=true`, `hudNavigationWorks=true`, `hudHidesAfterArrival=true`.
- `real-missing-caravan-route-bandit-recon`: gerçek `route:1:616` bağlantısı, canlı `wai-bandit-...` karşılaşması, `route_recon` observed kaynak, `bandits_located` outcome, görev completion butonu görünür, otomatik altın yok, encounter flee→map.
- `same-session-missing-caravan-recon-save-resume`: `saved=true`, `loaded=true`, `witnessedInSession=true`, `savedEventsNotCredited=true`, `optionRestored=true`, `noAutomaticReward=true`.
- `verified-missing-caravan-100-gold-no-replay`: DOM butonu ile `bandits_identified`, tam 100 altın, ikinci ödül yok, Save/Load archive kimliği 1, observeds inert.
- **7 yeni unit test:** 6 adet `tests/unit/quest-route-recon.test.js`, 1 adet `tests/unit/quest-caravan-escort.test.js` fiziksel tehdit; sahte klon/ledger, yanlış ID, gözlem süresi/sıfırlama, yakın encounter source, reward replay kapısı.
- İlk kod sürümünde [Web validation #44528266188](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44528266188) **1 FAIL**: V1.18 sentetik roads içermeyen quest route testine istemeden fiziksel yol şartı eklendi; `ensureActiveQuestRouteThreats` güvenlik görevi fallback'i geri getirilerek düzeltildi. Ardından [#44528924905](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44528924905) ve son [#44529483856](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44529483856) PASS.
- Yükleme sırasında HUD kapanması ve mod geçişi HUD temizliği için **son ufak kaynak commit** `2ffa91d` kod mantığına eklendi. Bu değişiklik öncesinde son QA `cfb021e` PASS; son HEAD için ayrı CI kontrolü ayrıca yapılır.

## Bilinçli açık işler

- Tarayıcı smoke, kervan için **kısa gerçek yolu**, **hızlandırılmış QA konvoyu**, **test koduyla sürekli yakın tutulan oyuncuyu** kullanır; doğal uzun yol/manuel tıklama/klavye refakat başarısı kanıtı değildir. HUD butonuna tarayıcı içinden gerçek DOM click yapılmıştır; sürekli otomatik takip/follow AI yoktur.
- Kayıp kervan araştırma E2E, oyuncuyu haydudun yanına **test kurulumunda konumlandırıp** oyunun gerçek `processWorldAiEncounters` fonksiyonunu çalıştırır. Oyuncunun görüş alanı/tam manuel yürüyüşten doğal encounter, çok adımlı gizli iz sürme ve kamp araştırması ayrıca test edilmedi. `bandits_located` gerçek kaynaklıdır ama tam kayıp mal/kervan envanteri/fate tespiti değildir.
- Haydut tehdidi konvoyu gerçek yolda bekletir. NPC haydutların konvoyu **fiilen saldırıyla soyması, muhafız/ticaret savunması, başarısızlık sonuçları** henüz uygulanmadı. Görev haydutunu zaferle temizlemenin ayrı, uzun yol E2E'si açık.
- Aktif escort'un save yeniden açıldığında tam yol kilometresiyle sürdürülmesi hâlâ mümkün değil; V1.22 karar gereği yeni gerçek source caravan başlangıçtan çıkar. Soğuk sekme `pending` olayları ödeme kaynağı değildir.
- Genel caravan/ordu shortest path, commander AI lifecycle, Organization/makam UI, diğer historical-social/diplomacy alt işleri `O00-06` kapsamında hâlâ açık.

**Sıradaki V1.24 önerisi:** gerçek insan etkileşimiyle uzun yol escort akışı, konvoyun haydut savaş sonuçlarına bağlı güvenlik/kaçış mekanikleri, haritada yönlendirme ve müşteri için görünür görev günlüğü; sonra karmaşık dünya pathfinding ve komutan AI. **PR #68 taslak kalır; kullanıcı onayı olmadan `main` merge edilmez.**
