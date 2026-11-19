# Fall of Cavalry WEB — Character System v2 V1.20: Gerçek Taktik Zaferden Görev Tamamlama Butonuna

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` (yalnız WEB) · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT / UNMERGED · **O00-06:** UYGULAMADA · **V1.20 alt işi:** PASS.

## Kanıtlanan tam yürütüm zinciri

`tools/browser-world-smoke.mjs` artık tek gerçek Chromium kampanyasında şu akışı uygular:

1. Haritadaki `roadBacked` ticaret yolu ve mevcut `QUEST_DEFS.secure_trade_route` şablonundan yeni **aktif** güvenlik görevi oluşturulur. Hedef yol/şehir aynıdır; göreve dokümansız XP/altın/özel makam eklenmez.
2. `WorldPartyManager.ensureWorldParties` yolun üstünde gerçek `worldAI` haydut partisi doğurur. `WorldSimManager.processWorldAiEncounters` gerçek `wai-<partyId>` encounter kaynağına geçer; `routeId` kimliği eşleşir.
3. `EncounterManager.resolveEncounter('fight')`, `BattleRosterManager.confirmRosterSelection()` ve `confirmBattleDeployment()` olağan oyun akışını çalıştırır.
4. Test kampanyasında sadece **sonucu deterministik kılmak amacıyla geçici aşırı güçlü piyade birimi** kullanılır: bu savaş dengesi veya normal oyuncu kazanabilirliği testi değildir. Buna rağmen olay sonucu **doğrudan atanmamıştır**: `resolveBattle('victory')` veya `updateObjective('bandits_defeated')` sahte şekilde çağrılmaz. Gerçek `BattleManager.updateBattleSimulation` tikleri, hareket, hasar ve bitiş kontrolüyle düşmanları yener. Son test koşusunda **7 düşman, 60 savaş tiki, 628→0 düşman toplam HP**.
5. Oyun gerçek `battle_result` ve kaynaklı `questEventLedger.observed` olayını kaydeder; haritaya dönüş için gerçek kullanıcı **Enter** tuşu kullanılır. Bu sırada `QuestEventMatcher` aynı resmî görevin hedef `routeId` ve `resolve_bandit_threat` objective'ini `bandits_defeated` yapar.
6. Oyun `QuestCompletionOverlay` ekranını açar; Playwright gerçek DOM'da **“Haydutları savaşta yendim”** butonuna tıklar. `QuestManager.completeQuest` resmî `defeat_bandits` path'ini seçer. **Tam 300 altın görev ödülü** gelir ve görev bir defa tamamlanır. Daha önce savaş loot'u kazanıldıysa bu ayrı kalır.
7. Aynı görevi yeniden tamamlama çağrısı reddedilir. `quickSave()` ve `quickLoad()` sonrası tamamlanan görev sadece `archived` kayıt olarak kalır; **ikinci ödül yok**, aktif görev yeniden oluşmaz.
8. Tamamlanmış göreve ait sonradan açılan **eski UI butonu**, geçersiz completion isteğini reddeder; ekranı başarı olmuş gibi kapatmaz, butonu devre dışı bırakır. Bu ilave negatif kullanıcı arayüzü testi de gerçek Chromium'da geçer.

## Bu turdaki kaynak değişiklikleri

- **`js/systems/QuestGenerator.js`**: Mevcut harita yerleşim ID'si **`0`** geçerlidir. Önceki `!resolved.targetCityId` ve `!resolved[key]` gibi doğrulamalar 0'ı yanlış biçimde “eksik” sayarak görevin hedef şehrini sessizce değiştirebiliyordu; artık sadece `null/undefined` (ya da zorunlu hedefte boş string) eksiktir. `_fillPlaceholders` `0` değerini güvenli biçimde doldurur.
- **`tests/unit/quest-system.test.js`**: 0 kimlikli gerçek hedefin başka şehirle değiştirilmediğini ve `{{targetCityId}}` yer tutucusunun `'0'` olarak çözüldüğünü kontrol eden yeni birim testi.
- **`tools/browser-world-smoke.mjs`**: gerçek kaynaklı savaş/loot/haritaya dönüş/quest-completion DOM tıklaması/çift ödeme reddi/Save-Load tarihi ve eski seçenek UI negatif kontrolü.
- **`js/ui/QuestCompletionOverlay.js`**: `QuestManager.completeQuest` `true` dönmediği sürece overlay kapatılmaz/pop edilmez. Artık eski/iptal edilmiş objective seçeneği başarı hissi yaratmadan devre dışı kalır.
- Mevcut V1.16–V1.19 resmî quest kanıtı/Save fail-closed kuralları ve gerçek kaynaklı dünya parti eşleştirmesi korunur.

## CI ve izlenebilir hata geçmişi

**Son doğrulanmış kod HEAD:** `91d7fefb68aa5282d09bb2f43a1fc0a7309177ad`.

- [Web validation #44518043358](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44518043358): **PASS**, **671/671 unit**, **1.083 genel PASS + 1 skipped**, static/build PASS, dünya denetimi **881 settlement / 304 road / 3 river / 4 crossing / 0 errors / eski 1 warning**.
- [Gerçek Chromium #44518043476](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44518043476): **PASS**; `real-engine-quest-battle.result=victory`, `quest-completion-offer-after-enter.overlayVisible=true`, `quest-completion-button-and-save.exactGoldReward=true`, `secondCompletionRejected=true`, `goldAfterLoadUnchanged=true`, `rejected-stale-quest-button.staleButtonDisabled=true`.
- İlk test çağrısında [#44517182837](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44517182837) **FAIL**: gerçek `targetCityId=0` yanlışlıkla otomatik başka şehirle değiştiriliyordu; bu nedenle haydut parti yaratılmadı. Genel kod kontrolü o tur PASS. 0 hedef doğrulama düzeltmesinden sonra [Chromium #44517613160](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44517613160) PASS. En son stale-UI onarımı dahil kod için yukarıdaki iki run PASS.

## Kasten açık kalan sınırlar

- **Kayıt sonrası kısmi objective devamı** yapılmadı: `QuestSnapshot.objectiveClaims` ve `QuestEventLedger.pending` hâlâ inert. Yüklenmiş yerel olayları bağımsız yetkili zafer/ödül kanıtı saymak güvenli değil. Yeni güvenilir dünyasal imza/claim yöntemi ve karar gereklidir.
- **Savaş dengesi veya oyuncunun normal birliğiyle başarı oranı** bu testin kapsamı değildir. Bir defalık QA piyadesi sadece browser-fixture'dır, oyun tasarımı/gerçek karakter sınıfı değildir.
- Gerçek savaş sonucu için `processWorldAiEncounters` test sahnesinde doğrudan çağrılmıştır; oyuncunun haritada kilometrelerce yürüyerek düşmana tesadüfen denk gelmesi ayrıca uçtan uca test edilmemiştir.
- Genel ekonomi/askerî AI shortest-path, komutanın tam ordu yaşam döngüsü, eski sıraya-dayalı görev yolunun görünür migrasyonu, sosyal/organizasyon makam UI ve Character System v2'nin diğer açık modülleri tamamlandı iddiası **yok**.

**Sıradaki V1.21:** yerel save'e güvenmeden kısmi görev devamlılığını ve eski yol hedeflerinin geçiş UX'ini tasarlama/uygulama; sessiz ödül/level/reputation replay kesinlikle yok. **PR #68 kullanıcı onayı olmadan main'e alınmayacak.**
