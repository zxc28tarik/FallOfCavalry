# Fall of Cavalry WEB — Character System v2 V1.14: Güvenli Görev Snapshot / Save / Restore

**Tarih:** 19 Kasım 2026 · **Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` WEB oyunu · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68), **DRAFT/UNMERGED**. **O00-06:** UYGULAMADA; **V1.14 teknik alt iş:** QA PASS.

**Bağlayıcı karar:** `FOC-Karar-Defteri-Guncel.md` §7 Character System v2, §8 oyuncu organizasyonu. `CharacterDefinition` kimlik, `NamedCharacterState` değişen değer, `CharacterRoleAssignmentState` görev/atama ayrımı ve ayrı CharacterRules/Save Service ilkeleri korunur. Kullanıcı onayı olmadan otomatik XP, sadakat, şöhret, görev başarı ağırlığı veya önemli kişi uydurulmaz.

## 1. Problem ve çözüm

V1.13, `QuestManager` içinde gerçek görevle yaşayan `NamedCharacter` ve mevcut aktif oyuncu organizasyonu görevi arasında bağ kurdu, sonucu kaydetti; ama **aktif QuestManager görev örneklerinin kendisi save dosyasında bulunmuyordu**. Bu yüzden yükleme sonrası karakter–görev bağlantısı `suspended` kalıyordu.

V1.14, gerçek görev hedefleri ile şablonunu referans alarak yeniden kurulabilen bir **sürüm 1 `questSnapshot`** getirir. Tamamlanma/başarısızlık geçmişi, kimlikleri yeniden kullanmamak için arşivlenir. Kurtarılan gerçek görevle önceden aktif ve hâlâ geçerli karakter görevlendirmesi uyuşursa bağlantı da otomatik geri etkinleşebilir.

## 2. Uygulama ve otorite sınırı

| Alan | Uygulama |
| --- | --- |
| `js/systems/quest-snapshot.js` | `{version:1, active:[], completed:[], failed:[]}` şemasını sınırlar, doğrular, kaydeder ve kanonik şablondan yeniden kurar |
| `QuestGenerator` | Çözdüğü `targetCityId/targetRouteId/targetRegionId/targetFortId/targetCommanderId/nearestCityId/issuerFactionId` hedefleri görev örneğinde açıkça taşır; böylece UI cümlesi veya dünya etkisi metninden ID tahmin edilmez |
| `SaveManager` / `SaveSystem` | `game.questSnapshot` alanı yazılır; yüklemede gerçek yerleşim/ticaret rotası/komutan/bölge referanslarıyla denetlenir ve güvenli görev örnekleri yeniden oluşturulur |
| `character-quest-assignments.js` | Yalnız save'den önce `active` olan bağlantı, **aynı yeniden doğrulanmış aktif görev + aynı NamedCharacter + yaşayan kişi + aynı etkin organizasyon branch/rol/şehir/görev tarihi** varsa `suspended→active` olur |
| `QuestManager` | Tamamlanmış/başarısız görev ID'lerini tekrar göreve sokmaz; geçmiş kayıtlar `archived: true` olur ve yükleme sırasında ödül, failure effect veya zincir görev tetiklemez |
| `character-quest-events.js` | Restore edilmiş arşiv girdileri stat kazanımı için gerçek tamamlanma bildirimi sayılmaz; onaylı görev ödül kataloğu hâlâ **BOŞ** |

### Save'in otoritesi *değildir*

- Görevün gold/itibar/onur ödülü, world effect listesi, completionPath/requiredOutcome kuralları **save'den okunmaz**. Bunlar oyunun kurulu `QUEST_DEFS` dosyasından yeniden kurulur.
- Save'in bildirdiği geçmiş `objectiveClaims` listesi yalnız **bekleyen, doğrulanmamış bilgi** olarak korunur. Runtime `objective.outcome` alanı **sıfırlanır**: eski kayıt "bandits_defeated" yazıyor diye görev otomatik tamamlanabilir hâle gelmez. Oyun içindeki yeni kanıt/olay gerçekleşmeden ödül verilemez.
- Sahte/eksik template, geçersiz şehir veya ticaret rotası, doğrulanamayan komutan/bölge, geleceğe tarihli veya süresi dolmuş aktif görev **etkinleştirilmez**. Sonuç `state.questRestoreReport` içindeki `restored/rejected/acceptedIds/restoredBindings` ile raporlanır.
- Bir save'in eski arşivde "tamamlandı" kaydı taşıması tarihsel kanıt yahut yetkili dünya etkisi değildir. Yükleme tamamlanma/failure observer'larını çağırmaz.
- **Gerçek dünya ID düzeltmesi:** 881 yerleşim dünyasında `settlement.id` tek haneli sayısal **0/1/...** olabilir. İlk Chromium testi `'0'` hedefini yanlışlıkla reddetti; kural gerçek dünya tek-haneli ID'lerini kabul edecek şekilde dar biçimde düzeltildi ve özel regresyon testi eklendi.

## 3. Uyum / açık sınırlar

- **V1.13 veya daha eski save'ler:** `questSnapshot` bulunmadığında boş kabul edilir. Eski `characterQuestBindings` aktif iddiaları, gerçek QuestManager görevi yoksa `suspended` kalır; hiçbir görev/kişi/ödül uydurulmaz.
- **V1.14 save:** Kanonik aktif görevler geri kurulabilir, görevdeki kişi ancak eski atama kanıtıyla ve hâlâ etkin atamayla tekrar bağlanır. Kimliği bilinmeyen veya süresi dolan görevler yeniden başlatılmaz.
- **Sınır:** Objective outcome'un **otomatik doğrulanmaması**, örneğin savaş kazanımının save sonrasında yeniden oynanması/oyun tarafından tekrar belgelenmesi gerekebileceği anlamına gelir. Olay kanıtının uzun süreli, yetkili bir `QuestEventLedger` ile kalıcılaştırılması **açık sonraki mühendislik işidir**; bu aşamada tüm kısmi görev ilerlemesi kesintisiz devam ediyor iddiası yoktur.
- Bu altyapı **görev seçimi/yoldaş görevlendirme UI'sı değildir**. `assignWorldCharacterToQuest` hâlâ doğrulanmış servis API'sidir; oyuncuya açılacak görev-kişi seçimi ve iptal/yeniden atama ekranları ayrı geliştirme konusudur.
- Tüm görev/karakter gelişimi sayıları, önemli tarihsel kişi/aile/hizip katalogları, kesin BaseLoyalty/CurrentInfluence stat kararı, savaş/kriz/tecrübe etkileri hâlâ onay bekler.
- Save doğrulaması bir **oyun mantığı doğrulamasıdır**; kriptografik imza veya gerçek dünyadaki tarihsel kimliği doğrulama sistemi değildir.

## 4. QA / kanıt

**Kod ve test SHA:** `0faa325ec6af7393b57e29a44a37c6a2e8915e61`.

- [Web validation #44496209859](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44496209859) **PASS:** **632/632 unit**, **1044/1045 full Vitest (1 skipped)**, statik/lint/production build/hygiene PASS. Dünya audit 881 yerleşim, 304 yol, 3 nehir, 4 geçit, **0 error / önceden mevcut 1 warning**.
- [Chromium #44496209847](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44496209847) **PASS:** normal dünya boot, NPC üretim/terfi, save/load ve gerçek `canonical-quest-save-resume`: `added:true, bound:true, saved:true, loaded:true, safeSnapshot:true, activeRestored:true, actorRestored:true, claimsAreInert:true, noRewardReplay:true, restoreCount:1, restoredBindings:1`; 0 JS konsol hatası.
- `tests/unit/quest-snapshot.test.js`: **10 yeni test**. Boş/legacy save, kanonik resmî template, gerçek hedef ve bir haneli şehir ID'si, kötü ödül enjeksiyonu, objective claim'in inert kalması, tekrar ödül engeli, expired/forged kayıt reddi, arşiv, gerçek SaveManager+NameCharacter duty save/load, yetkisiz kişi/şehir/rol kaynaklarının reaktivasyon reddi, asker roster uyumu.
- `tools/browser-world-smoke.mjs`: gerçek oyun içinden üretilmiş aktif görevi mevcut `NamedCharacter` aktif görevine bağlayıp quickSave/quickLoad sonrası doğrulama; haksız ödül ve eski objective claim aktivasyonu olmadığının kontrolü.
- İlkteki tarayıcı FAIL olgusu gizlenmedi; tek haneli şehir ID düzeltmesi sonrasında **son kod HEAD'inde iki QA da PASS**. Bu belge commitinden sonra oluşan yeni HEAD için CI tekrarı ayrıca izlenecek.

## 5. Sıradaki mantıklı adımlar

1. **Görev–önemli kişi atama UI:** aktif/uygun görevlerin listesi, uygun Named kişilerin mevcut aktif rol/şehir bilgisi, açık onay ve yetkisiz atama hata açıklaması; atamayı API üzerinden yapma; mevcut organize/karakter ekranı diline uyma.
2. **Yetkili kalıcı görev kanıtı:** `QuestEventLedger`, tamamlanmış objective outcome kaynakları, battle/encounter sonuç doğrulaması, save sonrası kısmi ilerlemenin yeniden doğrulanmadan korunması; yalnız olay kaynakları güvenilir olduğunda ödüle hak kazanma.
3. **Karakter gelişimi:** kullanıcı onayından sonra yavaş stat ilerleme ağırlıkları ve görev başarısı kuralları; statlar için otomatik değer uydurulmaz.

**Durum:** V1.14 teknik alt iş QA PASS; Character System v2 ana paket `O00-06` **UYGULAMADA**. PR #68 taslak ve `main` kullanıcı onayı olmadan değiştirilmeyecek.
