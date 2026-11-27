# Fall of Cavalry WEB — Character System v2 / V1.11: CharacterDefinition ile NamedCharacterState ayrımı

**Tarih:** 18 Kasım 2026 · **Repo:** yalnızca `zxc28tarik/FallOfCavalry` WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) (DRAFT, merge edilmedi). **Görev:** V2 `O00-06` UYGULAMADA; V1.11 **sınırlı teknik alt iş QA PASS**.

**Karar dayanağı:** kullanıcının `FOC-Karar-Defteri-Guncel.md` §7 Character System v2. Karar defteri `CharacterDefinition` (kalıcı tanım), `NamedCharacterState` (değişken oyun durumu), `CharacterRelationState`, `CharacterRoleAssignmentState`, `HouseState`, `CliqueState` ve ayrı save/Rules/Service katmanlarını öngörür. `BaseLoyalty` vs `CurrentLoyalty`, `BaseReputation`, `CurrentStanding/CurrentInfluence` isimleri ve sayısal büyüme ağırlıkları nihai değildir.

## 1. Gerçekleştirilen ayrım

**Önceden:** Authored `CharacterDefinition` V1.10'da kaynak/kimlik tanımı sağlıyordu; ancak oyun içindeki önemli karakterin değişebilir değerleri yalnız düz `worldCharacters.characters[]` aktörü üzerinden görülüyordu. Kimlik ve güncel durumun birbirinden okunabilen ayrı teknik sözleşmeleri yoktu.

**Şimdi:**

| Bileşen | Otorite ve sınır |
| --- | --- |
| `CharacterDefinition` | V1.10'da tanımlanan güvenilir katalog. Kalıcı `personKey`, `characterId`, kaynak, ad, kültür, başlangıç önem/rol/şehir ve başlangıç alanları için asıl kaynak; kampanya save'i burada yeni kişi üretemez |
| `NamedCharacterState` | **Yeni salt-okunur, kopya döndüren durum izdüşümü.** `characterId`, *güncel* önem sınıfı, eski rol profili, 9 mevcut stat, trait, `currentLoyalty`, memnuniyet, `currentReputation`, `currentStanding`, status, location ve olay geçmişi |
| `CharacterRoleAssignmentState` | V1.6'daki bağımsız oyuncu organizasyonu ve görev kayıtları. Bu değişiklik makam, askerî komuta, ticaret/diplomasi yetkisi ya da görev yaratmaz |
| `HouseState` / `CliqueState` | V1.7–V1.9'daki doğrulanmış kaynak ve ilişki kayıtları, bu işlemden etkilenmez |
| `CharacterRelationState` | Mevcut sparse -100..100 ilişki kenarları, stat güncellemeleri tarafından değiştirilmez |

**Önemli teknik dürüstlük:** V1.11, oyun koduna açık, ayrı **mantıksal sözleşmeler** ve güncelleme API'si getirir. Eski UI/servislerin çalışabilmesi için runtime aktörleri şimdilik **düz nesneler** olarak kalır. Fiziksel `definition` ve `state` objelerine tam refaktör yapılmış, yeni bir `NamedCharacterState` save tablosu açılmış ya da mevcut bütün kod göç ettirilmiş **değildir**. Bunu yapmış gibi gösteren bir `DONE` kaydı yoktur.

## 2. Yeni modül ve güvenlik sınırı

`js/systems/named-character-state.js`:

- `getNamedCharacterState(roster, characterId)`: yalnız `NamedCharacter` döndürür. Geçici `GeneratedPerson`, eksik ID veya geçersiz aktör için `null`. Dönen nesne kopyadır; onun statlarını, konumunu ve history'sini mutasyona uğratmak gerçek karaktere yazmaz.
- `changeNamedCharacterMetric(roster, characterId, { metric, value, day, reason })`: yalnız **oyun tarafından açıkça yetkilendirilmiş bir olayın** çağırması gereken dar yazma kapısıdır. **Yaşayan Named** gerekir. 1–10.000.000 oyun günü, 0–100 tamsayı değer, temiz açık gerekçe, tarihte geri gitmeme ve gerçekten yeni bir değer zorunludur.
- İzin verilen metric yolları: mevcut dokuz stat için `stats.intelligence/observation/persuasion/leadership/command/trade/administration/courage/experience` ve yalnız dört eski dinamik alan `loyalty`, `satisfaction`, `reputation`, `standing`. Diğer stat/ID/isim/kültür/yaş/önem/unvan/rol/status/konum alanı bu API ile yazılamaz.
- Her geçerli değişiklik `{day, type:'state-changed', metric, from, to, reason}` olayını saklar; eski 16 olaylık sınırlı ring politikası korunur. Gizli XP artışı, görev başarısı, denge yüzdesi, otomatik deneyim, faction, hane veya hizip etkisi yok.
- `currentLoyalty`, `currentReputation`, `currentStanding` adları mevcut **legacy** `loyalty`, `reputation`, `standing` alanlarının durum görünümüdür. `BaseLoyalty` veya `BaseReputation` henüz yeni hesap alanları olarak kurulmadı. `CurrentStanding` / `CurrentInfluence` kararı verilmedi.

`GameFlowManager.getWorldNamedCharacterState` ve `GameFlowManager.changeWorldCharacterMetric` yeni okuma/komut köprüsüdür. **Olayın işveren/gameplay otoritesiyle bütünleşmesi ayrıca yapılacak**; yöntem kendi başına görevi başarılı saymaz ve kullanıcının oyunsal kararını varsaymaz.

## 3. Save / migrate sözleşmesi

`js/systems/world-characters.js` `normalizeHistory` ve `packWorldCharacters` içinde yeni `state-changed` türünü doğrular ve altı elemanlı `[day, 'state-changed', metric, from, to, reason]` tuple olarak saklar. Sahte metric ve 0–100 dışı değerli event drop edilir.

- **`packed-v1`:** mevcut 17 alanlı kişi tuple'ı ve eski event türleri aynen korunur; yeni event tarihçe alanının içinde kodlanır.
- **`seeded-delta-v1`:** yalnız değişen Named satırı `overrides` olarak saklanır; 1.762 normal NPC tekrar kopyalanmaz; explicit source-produced ve authored kimlikler aynı modelde kalır.
- **Eski save'ler:** `state-changed` event'i bulunmayan kayıtlar otomatik yeni değişiklik uydurulmadan geri yüklenir.
- **Henüz yapılmayan:** stat değişimi için ayrı ikinci save sidecar, büyük olay arşivi, doğrudan geriye dönük fiziksel şema ayrıştırma, dinamik yaşam döngüsü, sahra/esaret lokasyonları. En fazla 16 event tutma kuralı, uzun dönem tam olay arşivi sayılmaz.

## 4. Uygulama ve QA kanıtı

- **Kod ve kapsam SHA:** `ac1d69d11a22a09aa09ea9a328a2c6a109e229d4`.
- [Web validation #44304056848](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44304056848) **PASS**: **603/603 unit**, **1.015/1.016 tam Vitest (1 skipped)**, statik/lint/build/hygiene PASS; dünya audit **881 yerleşim, 304 yol, 3 nehir, 4 geçit; 0 hata, mevcut 1 uyarı**.
- [Gerçek Chromium #44304056626](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44304056626) **PASS**: 1.762 başlangıç NPC, 1.975 üretim kaynağı, Named(D)→C, açık itibar değişimi, `independentCharacterState: true`, `stateRoundtripOk: true`, quickSave/quickLoad, 0 konsol hatası; asker rosterına ve sosyal kayıtlara zarar verilmedi.
- `tests/unit/named-character-state.test.js`: **9 yeni birim testi**; generated/dead/missing kişi reddi, kopya projeksiyon, kimlik ve statların korunması, uygunsuz olayların reddi, authored Named(B) stat değişikliği, packed + seeded-delta history dönüşü, SaveSystem/SaveManager ve eski save uyumu.

## 5. Sonraki gerçek ihtiyaçlar

1. **Base/dinamik alan kararı:** `BaseLoyalty`, `CurrentLoyalty`, `BaseReputation`, `CurrentStanding` / `CurrentInfluence` ve 11 stat vs dokuz legacy stat eşleşmesi onaylanmalı; onay olmadan yeni denge formülü kodlanmaz.
2. **Olay otoritesi:** görev tecrübesi, eğitim, savaş ve kriz sonuçları, yetkili ayrı olay/Rules katmanından `changeWorldCharacterMetric` komutuna bağlanmalı. Şimdilik otomatik büyüme yok.
3. **Önem/yaşam döngüsü:** A/B/C/D geçişleri, yaralanma/esaret/ölüm, trait gelişimi, aile ve hizip sonucu ayrı onaylı kurallarla yürütülmeli. Bu aşamada bunların hiçbirine yeni otomatik etki eklenmedi.
4. **Fiziksel refaktör:** eski düz runtime actor yapısı ve bütün UI/save okuma yüzeyleri `CharacterDefinition` + `NamedCharacterState` kontratına aşamalı taşınmalı; migration planı sonrası mevcut uyum adaptörü kaldırılabilir.
5. **Tarihsel içerik:** gerçek A/B kişileri ve aile bağlantıları için editoryal/kaynak çalışması yapılmadan boş katalog doldurulmaz.

**Durum:** V1.11 sınırlı teknik alt iş QA PASS; `O00-06` Character System v2 **UYGULAMADA**. PR #68 taslak, main'e kullanıcı onayı olmadan merge yapılmaz.
