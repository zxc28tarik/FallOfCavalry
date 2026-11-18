# Fall of Cavalry WEB — Character System v2 / V1.13: Gerçek Göreve NamedCharacter Atama ve Sonuç Kaydı

**Tarih:** 18.11.2026 · **Repo:** `zxc28tarik/FallOfCavalry` — yalnızca WEB. **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68), DRAFT / UNMERGED. **Ana görev:** `O00-06` UYGULAMADA. **V1.13:** dar kapsamlı teknik alt iş QA PASS.

**Karar dayanağı:** Kullanıcının `FOC-Karar-Defteri-Guncel.md` §7 Character System v2, §8 Oyuncu Organizasyonu. NamedCharacter önemli kişidir; oyuncu organizasyonuna üyelik ve kişinin **o andaki görevi farklı kayıtlar**dır. Görev başarısı ve tecrübe değerleri göreve özgüdür; ağırlıklar hâlâ açık olduğundan otomatik XP ya da stat artışı eklenmez.

## Neden ayrı bir atama köprüsü?

V1.12, doğrulanmış `QuestManager.completeQuest` sonucunu `NamedCharacterState` olay sistemine bağladı; ancak hiçbir canlı görev şablonu `assignedCharacterId` üretmiyor ve görevle oyuncu organizasyonundaki **gerçek, aktif CharacterRoleAssignmentState** arasında yetkili bağlantı kurmuyordu. V1.13 bu referansın yazılması ve sonucunun kayıt altına alınması için kontrollü, açık API getirir.

## Kodlanan işler

### 1. Yeni `character-quest-assignments.js` ve `characterQuestBindings`

- Sürüm 1 `{version:1, entries:[]}` kaydı. Her satır `questId`, `templateId`, `characterId`, `branch`, `assignmentRole`, `settlementId`, `assignedDay`, `reason`, `status` taşır. Tamamlanınca `pathId+endedDay`; başarısızlıkta `endReason+endedDay` eklenir.
- `bindNamedCharacterToQuest` yalnız gerçek `QuestManager.activeQuests` içinde **aktif**, oyunun resmî `QUEST_DEFS` kataloğunda olan bir şablonu kabul eder. Mevcut `quest.assignedCharacterId` değiştirilmez; aynı quest ID'si ikinci kez bağlanmaz.
- Kişi **gerçek, yaşayan NamedCharacter** olmalıdır; `GeneratedPerson`, hayalî kişi, ölü kişi, yanlış görev ID'si reddedilir. Kaynak/isim/kültür/faction benzerliği ile kişi tahmini yapılmaz.
- `characterOrganization.assignments` içinde ilgili kişinin **var olan aktif görevi** ve gerçek şehir bağlantısı gerekir. Görevin `targetCityId` alanı varsa görev konumuyla aynı yer olmalıdır. **Üyelik, görev rolü, şehir yetkisi veya personel rütbesi otomatik yaratılmaz.**
- `GameFlowManager.assignWorldCharacterToQuest(questId, characterId,{reason})` gerçek `QuestManager` üzerinden çalışır. `getWorldCharacterQuestRecords(characterId)` yalnız Named kişi için kayıt geçmişi döndürür.
- V1.12'nin `applyVerifiedQuestCharacterOutcome` köprüsü, artık **etkin ve aynı ID'li görev bağlantısı** yoksa NPC statına geçmez. Onaylı quest progression kuralları hâlâ `[]`: gerçek oyun stat ödülü **sıfırdır**, test fixture ödülü oyuna sızmaz.

### 2. Sonuç ve hata gözlemcisi

- Görev **gerçekten tamamlandıktan sonra** `QuestManager.onQuestCompleted` bildirimi ile doğru `questId/templateId/pathId/assignedCharacterId` doğrulanır; sonuç kaydı `completed` yapılır.
- `QuestManager.onQuestFailed` bildirimi; görev gerçekten `failedQuests` listesine girdiyse `failed`, neden ve gün kaydı oluşturur. Süresi dolan görevler aynı başarısızlık yolundan geçer.
- Gözlemci hataları mevcut oyuncu altın/itibar ödülünü veya görev kapanışını geriye almaz. Görev tamamlaması **otomatik stat, önem veya organizasyon terfisi değildir**.

### 3. Save uyumluluğu: **aktif görevlerin otomatik restore edilmemesi**

- `SaveManager` yeni `game.characterQuestBindings` sidecar'ını kaydeder; `SaveSystem.normalizePayload` veriyi sınırlar, yinelenen/sahte ID, görev rolü ve şehir girdilerini temizler. `worldCharacters.seeded-delta-v1` ve `characterOrganization` biçimleri değişmez; asker rosterına yazılmaz.
- **Önemli sınır:** Mevcut `QuestManager` **aktif görev örneklerini tam save/load yapmıyor**. Bu nedenle SaveManager yüklemesinde `active` atamalar **`suspended` (etkisiz/beklemede)** olur. Karakter ve görev ID'si, rol, gerekçe kaybolmaz ama ilgili görev otomatik yeniden başlatılmaz ve stat ödülü hak edilmiş sayılmaz. `completed/failed` kayıtları tarifî geçmiş olarak tutulur; kaynak save tek başına oyun içi ödül otoritesi oluşturmaz.
- Henüz etkin görev rehydration ve görev UI seçim akışı yapılmamıştır. Bu nokta sonraki alt işe **açık** kaydedilir. Beklemedeki görevi sessizce tekrar etkinleştirmek yerine ayrı kanonik görev snapshot/migration sistemi tasarlanmalıdır.

## Test ve QA

**Kod + test HEAD:** `0055c3b5176ca0f95bbff2b04581fd1bcd12e5c0`.

- [Web validation #44311505833](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44311505833): **PASS** — 622/622 unit, 1.034/1.035 full Vitest (1 skipped), lint/static/build/hygiene PASS. World integrity: 881 yerleşim, 304 yol, 3 nehir, 4 geçit, **0 errors / 1 mevcut warning**.
- [Gerçek Chromium #44311505768](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44311505768): **PASS** — gerçek dünya boot, 1.762 baseline NPC, karakter üretimi, güncel stat ve eski quick save/load ile yeni **boş görev atama kaydı** korundu, konsol hatası yok.
- `tests/unit/character-quest-assignments.test.js`: **9 test** — boş/legacy kayıt, gerçek aktif görev ve Named+duty bağı, sahte/fiktif görev şablonu ve kişi reddi, completed/failure/expired sonuçları, atama tekrarını engelleme, ödül ayrımı, SaveManager/SaveSystem kayıt ve **suspended restore**, hatalı/çakışan kayıtları temizleme.
- `tools/browser-world-smoke.mjs`: yeni açılışta, save'de ve load sonrası **noInventedQuestBindings** denetimleri. Tarayıcı canlı görev atama UI'sını henüz kullanmıyor; bunun detaylı geçerli/gayrimeşru senaryoları unit testlerinde.

**Sonraki adım:** `QuestManager` aktif görevlerinin gerçek şablon/target/objective/source otoritesi üzerinden **güvenli, sürümlü snapshot ve restore** akışı; bundan sonra end-user `Companion/Organization` görev atama UI'sı; daha sonra kullanıcı onaylı, yavaş ve görev türü ağırlıklı CharacterRules/XP sistemi.

**Sınır:** V1.13 görev–karakter atama servisinin bağlama/kayıt altyapısıdır; **henüz tam oynanabilir NPC görev verme ekranı veya save sonrası aktif görev yeniden başlatma değildir**. Tüm Character System v2 tamamlanmış sayılmaz. PR #68 main'e kullanıcı onayı olmadan merge edilmeyecek.
