# Fall of Cavalry WEB — Character System v2 V1.15: Şehir NPC Panelinden Gerçek Göreve Atama

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry`, yalnız WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT/UNMERGED. **O00-06** genel iş: UYGULAMADA. **V1.15** sınırlı arayüz alt işi: QA PASS.

## Bağlam

V1.13 gerçek `QuestManager` görevi–yaşayan `NamedCharacter`–var olan aktif organizasyon görevi arasındaki yetkili köprüyü kurdu. V1.14 `QUEST_DEFS` temelli etkin görev snapshot/restore yaptı; kayıt iddiaları tamamlanma kanıtı değildir. V1.15 bu mevcut API'yi şehirdeki karakter detay panelinden çağırır. Hiçbir karakterin sırf meslek etiketi veya oyuncu arayüzü nedeniyle yetki kazandığı varsayılmaz.

## Yapılan işler

1. `js/ui/character-quest-assignment-view.js`: yan etkisiz görev atama görünümü. Karakterin `named`, yaşayan, ziyaret edilen şehirde ve mevcut etkin `CharacterRoleAssignmentState` ile aynı şehirde olması gerekir. Yalnız `QUEST_DEFS` içindeki bilinen şablonlardan gerçek `QuestManager.activeQuests` listesinde `active` olanları gösterir; atanmış veya daha önce bağlanmış görevlerde atama seçeneği kapalıdır. Tespit yalnız UX ipucudur, nihai yetki denetimi değildir.
2. `js/ui/city-services.js`: mevcut şehir NPC profilinde etkin görevi, uygunluk açıklamasını, görevleri ve kişinin geçmiş atama kayıtlarını gösterir. `Bu göreve ata → gerekçe gir → Atamayı onayla` ile iki adımlı açık oyuncu eylemi; uyumsuzluk durumunda görünür hata mesajı. HTML alanları kaçışlanır; UI seçim durumu SaveData'ya yazılmaz.
3. `js/managers/CityManager.js`: yalnız `GameFlowManager.assignWorldCharacterToQuest` servisinden geçen başarılı sonucu oyun kayıt olayına ve autosave'e bağlar. UI hiçbir doğrudan görev, Named kişi, organizasyon rolü, birlik ya da altın/XP yaratmaz.
4. `tests/unit/character-quest-assignment-view.test.js`: 5 test. Gerçek yerleşim/NPC/duty, sıradan/dead/no-duty reddi, forged template/yanlış şehir/duplicate, görev geçmişi, iki aşamalı UI onayı ve gerekçe aktarımı.

## Kısıtlar / eksik işler

- Bu ilk görünüm **şehirdeki NPC detay panelindedir**; bağımsız, bütün dünyayı kapsayan Companion/Organization ekranı değildir.
- Mevcut aktif organizasyon görevi olmayan kişi buradan **görevlendirilemez**. Makam/organizasyon görevi kurma, yetki tayini, görev iptali ve yeniden atama ayrıca tasarlanacaktır. NPC profilindeki varsayılan `role` bir makam değildir.
- `QuestEventLedger` hâlâ yok. V1.14'ün save kaynaklı objective iddialarını etkisiz tutma emniyet sınırı sürer.
- Karakter XP/stat/din/aile/hizip/sadakat etkileri, tarihî A/B katalogları ve geniş AI diplomasi yaşam döngüsü bu alt işte yapılmaz. Onaylı NPC görev ödül kural kataloğu hâlâ boştur.
- Browser smoke gerçek dünya açılışı ve önceki save/restore akışını sınar; **V1.15 UI buton tıklamaları doğrudan birim testi ile doğrulanmıştır**, bağımsız gerçek tarayıcı click-through senaryosu hâlâ eklenebilir.

## QA

**Kod HEAD:** `5d2eb78a50b73a118d51d8369003002dc401b9d5`.

- [Web validation #44499383039](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44499383039): PASS — 637/637 unit; 1049/1050 genel test (1 eski skipped); lint/statik kontroller, üretim build ve genel regresyon PASS.
- [Gerçek Chromium #44499383050](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44499383050): PASS — dünya boot/save/restore smoke.
- World audit: 881 yerleşim, 304 yol, 3 nehir, 4 geçit; **0 errors, mevcut 1 warning**.
- Önceki ilk V1.15 CI denemesinde 3 fixture hatası gözlendi: kaynak roster ID sıralaması nedeniyle Edirne yerine Bursa sakini seçiliyordu. Düzeltilerek final kod HEAD'inde iki CI PASS sağlandı. Başarısız deneme gizlenmedi.

## Takip

Sonraki akılcı geliştirmeler: (a) yetkili `QuestEventLedger`/save sonrası objective progression; (b) açık izinle organizasyon makamı/kişi seçme ve değiştirme UX; (c) live browser görev atama click-through testleri. Bu alt iş **Character System v2'nin tamamı değildir**. PR #68 kullanıcı onayı olmadan `main`e alınmayacak.
