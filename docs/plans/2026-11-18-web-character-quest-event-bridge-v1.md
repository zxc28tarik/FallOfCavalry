# Fall of Cavalry WEB — Character System v2 / V1.12: şehir profili ve görev-olay köprüsü

**Tarih:** 18 Kasım 2026 · **Repo:** yalnız `zxc28tarik/FallOfCavalry` web oyunu · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) (**DRAFT**, main'e merge yok) · **Ana görev:** O00-06 **UYGULAMADA**; V1.12 **sınırlı teknik alt iş QA PASS**.

**Karar dayanağı:** `FOC-Karar-Defteri-Guncel.md` §7. Özellikle karakterlerin görev, olay/savaş/kriz ve eğitim yoluyla gelişmesi; statların 0–100 aralığı; yavaş/önemli gelişim; görev başarı değerlendirmesinin görev türüne göre değişmesi; sadakat/itibar/memnuniyetin ayrı tutulması. **Stat ağırlıkları ve güncel değer adları henüz kesinleşmediği için** gerçek ödül/XP kuralı icat edilmedi.

## 1. Eski görüntüleme tüketicisinin göçü

`js/ui/city-services.js` içindeki `renderNpcProfile`, **kalıcı** karakterler için `getNamedCharacterState` üzerinden kopya güncel değerleri okur: dokuz mevcut stat, trait, loyalty, satisfaction, reputation, standing ve olay geçmişi. `GeneratedPerson` geçici kişi profili eski görünümü kullanır. Kişi ID'si, ad, kültür, yaş ve konum kimliği eski `getWorldCharacterProfile` üzerinden korunur; UI'da bu verilere yazma yoktur.

Yeni `state-changed` ve `importance` olayları karakter geçmişinde tür, 0–100 önce/sonra, gün ve açık gerekçeyle gösterilir. `event.reason` ve diğer event alanları HTML escape edilir; sahte metin HTML/JS olarak çalıştırılmaz. `tests/unit/world-character-profiles.test.js` mevcut generated profili korurken, named state render ve HTML escape senaryosunu doğrular.

**Sınır:** Henüz bütün eski servisler/AI ve savaş içi karakter kullanımları yeni sözleşmeye taşınmış değildir. Bu adım ilk gerçek **UI okuma tüketicisini** göç ettirir; fiziksel flat-runtime model korunur.

## 2. Gerçek görev tamamlamasından karakter olayına sınır

`js/managers/QuestManager.js` mevcut `completeQuest` yolundan geçerli objective/path sağlandıktan, dünya/oyuncu ödülleri uygulandıktan ve görev `completedQuests` listesine taşındıktan **sonra** salt-okunur `{questId, templateId, pathId, assignedCharacterId}` bildirimi yayar. Görev ikinci kez tamamlanamaz. İsteğe bağlı gözlemcinin hata vermesi mevcut görevün tamamlanmasını, oyuncunun altın/itibar ödülünü veya zincir görev üretimini geri almaz; hata `lastCompletionObserverError` ile tanılanır.

`js/main.js`, gözlemciyi `GameFlowManager.applyVerifiedQuestCharacterOutcome` noktasına bağlar. Buradan `js/systems/character-quest-events.js` çağrılır. **Güvenlik kapıları:**

- Gerçek `QuestManager.completedQuests` içinde aynı ID, aynı resmi `QUEST_DEFS` şablon/yol ve doğru `requiredOutcome` bulunmalı.
- Katılımcı, `quest.assignedCharacterId` ile **açıkça** belirtilmiş **yaşayan NamedCharacter** olmalı; `targetCommanderId`, ad, kültür, devlet veya oyuncu ünü dolayısıyla kişi **tahmin edilmez**.
- Oyuncunun `characterOrganization.assignments` kayıtlarında aynı karaktere ait **aktif**, belirlenmiş role/branch ve varsa gerçek görev hedef şehriyle eşleşen atama bulunmalı.
- Stat yolu `NamedCharacterState`in izin listesinde olmalı; yalnız **güvenilir, kaynak kodunda onaylı** `ruleId/templateId/pathId/assignmentBranch/assignmentRole/metric/delta/reason` kuralı uygulanabilir. `delta` açık, -100..100 tamsayıdır; 0..100 sınır dışına çıkarsa işlem reddedilir, otomatik clip/level formülü yoktur.
- Tekil eşleşmeyen, çoklu çakışan, taslak veya geçersiz ödül kuralı etkisizdir. Tekrar gelen bildirimin aynı karaktere ikinci stat ödülü vermemesi için olay gerekçesindeki quest ID'si ve **son 16 olay içindeki** kayıt karşılaştırılır. Bu sınırlı koruma **tam kalıcı görev ledger'ı** değildir.

**En kritik üretim kararı:** `js/data/character-quest-outcome-rules.js` **KASITLI OLARAK BOŞ** (`[]`). Görev başarı katsayıları, hangi görevde kimin kaç puan kazanacağı, sadakat/itibar etkileri kullanıcı tarafından onaylanmadı. Bu nedenle mevcut oyunun görevleri oyuncuya önceki ödüllerini verirken **hiçbir NPC statı otomatik değişmez**. Testlerdeki `+1 experience` kuralı **sadece açık test fixture'ıdır**, oyuna girmez. `reviewStatus:'approved'` test/geliştirici etiketi tarihsel gerçeklik veya kullanıcı onayının ikamesi değildir.

## 3. Kayıt uyumluluğu

- `NamedCharacterState` için V1.11'de eklenen `state-changed` olayları, mevcut 17 alanlı `packed-v1` ve `seeded-delta-v1` üzerinden saklanmaya devam eder. V1.12 yeni save şeması veya duplicated NPC ledger getirmez.
- Mevcut `QuestManager` oyuncu ödülleri ve `WorldManager` world effect akışı bozulmaz. Eski `QuestGenerator` şablonları otomatik `assignedCharacterId` sağlamaz; tasarım/atama süreci kurulana kadar karakter gelişimi devre dışıdır.
- Aile, hizip, din/mezhep, asker roster, organizasyon üyeliği, önem terfisi ve mekân yetkileri bu görev köprüsü üzerinden kendiliğinden değiştirilmez.

## 4. QA ve kapsam

**Kod/test SHA:** `fae4914ce6b119e2d0f704571d334207da0e0c43`.

- [Web validation #44307736409](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44307736409) **PASS**: **613/613 unit**, **1025/1026 full Vitest (1 skipped)**, statik/lint/build/repo hijyen kapıları başarılı. Dünya bütünlüğü 881 yerleşim, 304 yol, 3 nehir, 4 geçit; **0 error / 1 önceden mevcut warning**.
- [Gerçek Chromium #44307736247](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44307736247) **PASS**: gerçek 1.762 başlangıç NPC, 1.975 işe alım/üretim kaynağı, Named(D)→C, sosyal/organizasyon/save-load ve explicit `state-changed` hattı bozulmadı; 0 JS konsol hatası.
- `tests/unit/character-quest-events.test.js`: **9 test**. Bir görevün yalnız bir kez kapanması, mevcut oyuncu ödüllerinin değişmemesi, sahte/eksik completion reddi, atanmış Named/aktüel görev kapısı, görev hedefinin denetimi, güvenilir fixture kuralıyla bir olayın kaydı ve save roundtrip, çakışan/yanlış/taslak kural reddi, 0–100 sınırı, observer hata izolasyonu ve gerçek GameFlow'un boş policy ile etkisiz kalması.
- `tests/unit/world-character-profiles.test.js`: **1 ek** karakter paneli olayı/HTML escape testi.

## 5. Açık kalan işler

1. Gerçek görevin `assignedCharacterId` alanının **yetkili atama ekranı ve görev sözleşmesinden** gelmesi, ona bağlanmış active assignment üzerinden izlenmesi; henüz oyun şablonlarının hiçbiri bu kaydı kurmuyor.
2. Kullanıcı onayıyla görev türüne göre görev sonucu, eğitim, savaş/kriz stat ağırlıkları, yavaş gelişim ve bunların `CharacterRules` otoritesinde sürümlenmesi.
3. Uzun dönem tam **CharacterEventLedger** / replay ve daha uzun idempotence sözleşmesi; mevcut 16-event ring bir *tam arşiv* değildir.
4. Şehir dışı NPC tüketicilerinin yeni NamedCharacterState sözleşmesine aşamalı taşınması. Özellikle oyuncu/görev yetkilerinin sahte stat değişimi yoluyla sızmaması ayrı entegrasyon kapısıdır.
5. Tarihsel important person/family/clique katalogları, BaseLoyalty/BaseReputation, CurrentInfluence/CurrentStanding isimleri ve nihaî stat denge kuralları **henüz açık**.

**Sonuç:** V1.12 şehir NPC profilini yeni durum sözleşmesine bağladı; QuestManager ile fail-closed gerçek tamamlanma bildirimi altyapısı test edildi. **Görevün tamamlanması otomatik karakter gelişimi değildir.** O00-06 Character System v2 bütünü **UYGULAMADA**.
