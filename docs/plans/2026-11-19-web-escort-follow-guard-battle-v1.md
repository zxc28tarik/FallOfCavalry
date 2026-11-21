# Fall of Cavalry WEB — Character System v2 V1.24: Dinamik Kervan Takibi ve Gerçek Muhafız Savaşı Sonuçları

**Tarih:** 19 Kasım 2026 · **Kapsam:** yalnız `zxc28tarik/FallOfCavalry` WEB, Unity ayrı projedir · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT / UNMERGED · **O00-06:** UYGULAMADA · **V1.24 alt işi:** testlerde PASS.

## Kullanıcı deneyimi

V1.23'teki `Kervana git` tek seferlik sabit bir hedef atıyordu. Kervan ilerleyince hedef güncellenmiyor, uzun refakat oyuncudan sürekli elle hedef seçmesi bekliyordu. V1.24'te `QuestEscortHud` içine ayrı **Kervanı takip et / Takibi durdur** kontrolü eklendi.

- Takip yalnız oyuncunun **gerçek buton tıklamasıyla** başlar. Hedef, kervanın gerçek mevcut koordinatına güncellenir. `WorldSimManager.updatePlayerParty` normal oyuncu hızı, terrain speed, lojistik, `getMovementContextAt`, geçilemez arazi ve `clampToWorld` kurallarını kullanır. `player.x/y` doğrudan değiştirilmez, ışınlama yoktur.
- Oyuncu kervana yaklaşık **1,35 tile** kadar yaklaşınca hedefi geçici kapatır ancak takip tercihi açık kalır; konvoy uzaklaşınca yeni hedef verir. HUD'da `aria-pressed` ve doğru Türkçe açık/kapalı buton metinleri bulunur.
- Oyuncu haritada yeni bir hedef seçince **manuel komut önceliklidir**: aktif hareket hedefine veya yakınlık nedeniyle geçici olarak hedef kaldırılmış duruma bakılmaksızın otomatik takip iptal edilir, kullanıcı hedefi silinmez.
- Kamp/harita dışı mod, bloklu zemin, kervanın ölmesi veya ortadan kaybolması takip tercihini sıfırlar. Sadece kontrolün kendisinin atadığı hedef `Takibi durdur` sırasında kaldırılabilir, elle atanan hedef asla kaldırılmaz.
- **Sınır:** otomatik takip noktadan noktaya yapılır; çok virajlı arazide oyuncu için kervan yolunun birebir shortest-path takibi veya arazi etrafından dolaşma henüz yok. Gerçek Chromium bu sürümde normal hareket motoruyla **kısa yer değiştirmeyi** doğruladı; tüm Avrupa ölçeğinde normal hızda bir refakatin uçtan uca tamamlandığını iddia etmiyoruz.

## Muhafız savaşının gerçek sonuç zinciri

`js/systems/quest-escort-threat-battle.js` ve `WorldPartyManager.recordEscortGuardBattle` **oyunun gerçek `BattleManager.exitBattleResultToMap`** anında, dünya bandit silinmeden önce bir kaynak eşleştirmesi yapar. Şartları:

- `state.battle.phase=result`, `battle.battleResult` gerçek sonucu, birebir `enemyId`, `winner`, `enemyFactionId=bandits`, `resolvedAt`; sadece `victory` ve `defeat`.
- `worldEncounterPartyByEnemyId[enemyId]` içindeki gerçek dünya parti ID'si; aynı nesne `worldAi.parties` içinde **canlı** ve `WorldAI.spawnPartyBandit` kaynaklı process-local `WeakSet` tarafından tanınmış olmalı.
- `validBanditRoute` gerçek `WorldGenerator.roads` yolunu doğrulamalı. Aynı yolun `escort_first_caravan` görevine bağlı **canlı `quest-escort-` kervanı**, bandite **2,5 tile** yakın olmalı. Kaydedilmiş/klonlanmış parti veya farklı rota bu şartı sağlayamaz.
- Aynı `battleId` için `WeakMap` in-process makbuz kontrolü tekrar muhafız sayımını/etkiyi engeller. Kaydedilen herhangi bir `wonGuardBattles` veya local JSON gözlemi yeni source authority oluşturmaz.

**Gerçek zafer:** kervanda `escortDefended` sayacı bir artırılır; normal `BattleManager` çıkışı gerçek bandit world party'yi siler. Bir sonraki `WorldPartyManager.processQuestEscortCaravans` artık banditi yakın tehdit olarak görmez, kervan normal waypoint yoluna devam eder. Muhafız zaferi **tek başına görev tamamlanması veya 250 altın ödeme üretmez**. Kervan gerçekten varırsa `caravan_arrival` olayından `caravan_delivered` seçeneği açılır ve oyuncu onayladığında normal şablonun 250 altın +2 itibar/trade effect sonucu uygulanır.

**Gerçek yenilgi:** `QuestManager.failQuest(id, 'escort_guard_defeated')` resmî refakat görevini sonlandırır, şablondaki `damage_trade_route amount:2` etkiyi **bir kez** uygular. Kervan süreçten kaldırılır; `BattleManager` bu kaynaklı durumda yenmiş olan banditi **worldAi listesinden silmez**, yalnız geçici savaş projection/encounter kaydını temizler. Görev tamamlanmış sayılmaz, ekstra altın/itibar yoktur. Aynı sonucun tekrar oynatılması görev durumunu veya cezasını çoğaltamaz. Save/Load başarısız görev arşivini ve ticaret yolu hasarını saklar.

## Test edilen gerçek akış

**Son test edilen kod HEAD:** `2b3aa1e983236fce601192811ac3b3012323dd6b`.

- [Web validation #44535083572](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44535083572) **PASS**: **708/708 unit**, **1.120 full PASS + 1 skipped**, statik/build PASS, world integrity **881 settlement, 304 road, 3 river, 4 crossing, 0 error, mevcut 1 warning**.
- [Gerçek Chromium #44535083170](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44535083170) **PASS**:
  - `real-road-live-caravan-escort`: `followPressed=true`, `nativeMove=true` (gerçek `WorldSimManager.updatePlayerParty` kullandı), `manualOverride=true` ve önceki HUD nav/varış/250g tekrar ödeme regresyonları PASS.
  - `real-engine-guarded-caravan-bandit-battle`: aynı gerçek `route:419:423` üzerindeki WorldAI factory banditi tehdidi durdurdu, **8 gerçek taktik tick, 436→0 enemy HP, result=victory**. Sonra `banditRemoved=true`, `defendedOnce=true`, `resumed=true`, kervan varışı ve gerçek `Kervan güvenli ulaştı` DOM tıklamasıyla **250g exact once**; Save/Load sonrası archive.
  - `real-engine-escort-guard-defeat`: yine gerçek factory bandit, bir disposable **1 HP'lik QA muhafızı**, **25 gerçek savaş tick** ile `result=defeat`. `escort-guard-defeat-keeps-bandit-single-route-penalty`: `banditAlive=true`, `archiveOnce=true`, `exactPenalty=true` (2 route damage), `noReward=true`, Save/Load sonrası `samePenaltyAfterLoad=true`, `archiveAfterLoad=true`.
  - V1.23 `real-missing-caravan-route-bandit-recon`, `same-session-save-resume`, real DOM 100g completion, legacy escort retirement ve şehir/granüler NPC testleri aynı koşuda geçer. **Tarayıcı konsol hatası: 0**.
- `tests/unit/quest-escort-guard-battle.test.js`: 6 yeni test: gerçek kaynaklı victory outcome ve replay guard, gerçek defeat/failure/world bandit korunması, klon/fake/wrong ID/far bandit/reward guards, `WorldSimManager` normal oyuncu hareketiyle takip ve manuel override, yakınlıktaki manuel override, engel veya mod değişiminde takip sıfırlama.
- Önce [#44531926202](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44531926202) 1 yanlış unit test varsayımı FAIL oldu: takip yakındayken `hasDestination` kapalı olsa da **follow ON** kalır; test ve manuel override üretim kodu düzeltildi.
- Önceki Chromium denemelerinde [#44532698318](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44532698318) takip hedefi yakınken kullanıcı override sorununu, [#44533087044](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44533087044) testin build'de hash'li modüle yanlış URL ile import girişimini yakaladı; üretim mantığı ve QA fixture düzeltildi. [#44534229672](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44534229672) ve [#44534712218](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44534712218) test sırası/ambient gerçek bandit karşılaşmasının son yenilgi senaryosuna girmesine engel olduğunu gösterdi. Testler gerçek `flee` seçeneğiyle bu aradaki karşılaşmadan çıktı; hiç kimse görev/HP/savaş sonucunu doğrudan set ederek PASS yaratmadı.

## Açık işler, sıradaki V1.25

- Gerçek browser-test kervan yolculuğunda test kervanı kısa yolu seçip hızlandırır ve teslim testi için oyuncuyu her tıkta kervanın yanına QA fixture taşır. V1.24 yeni takip testi **kısa gerçek hareketi** `WorldSimManager.updatePlayerParty` ile kanıtlar, uzun Avrupa rotası boyunca full doğal fare/klavye refakat bitirilmiş değildir. Yüksek engebeli çok virajlı yollar için graph/waypoint pathfinding, takip iptal nedenleri UI ve gecikme sınırları geliştirilmeli.
- `escortDefended` sadece guard-kaynağı sayar; bağımsız **asker muhafız AI**, konvoy HP/yağma/erzak, NPC NPC savaş simülasyonu, ticaret üretim zinciri henüz uygulanmış değildir. Gerçek taktik savaş sadece oyuncu tarafından tetiklenen `bandit` encounter üzerine çalışır.
- `investigate_missing_caravan` yakın source bandit tespitinden öte kervanın kendisinin akıbeti/envanteri/gerçek kayıp nedeni gibi çok aşamalı investigation olaylarını içermez.
- Local save'in soğuk oturumda objective kanıtı olamaması bilinçli güvenlik kuralıdır; sunucu veya oyunda yeniden gerçek karşılaşma gerekir. Yolda kısmi konvoy konumu Save/Load'a kanıt olarak taşınmaz; yeni canlı kervan kaynağından tekrar başlar.
- Genel trade/patrol/ordu shortest-path, commander AI lifecycle, Organization/makam UI, diğer Character System v2 sosyal/diplomasi sistemleri açık.

**Sıradaki V1.25 önerisi:** doğal manuel/otomatik uzun gerçek harita yolu refakat E2E, kıvrımlı yol hedefleme, muhafız AI ve gerçek konvoy envanteri/hasar simülasyonunun ayrı kaynaklı protokolü. **PR #68 DRAFT/UNMERGED; kullanıcı izin vermeden main'e merge yok.**
