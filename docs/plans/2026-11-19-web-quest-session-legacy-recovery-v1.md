# Fall of Cavalry WEB — Character System v2 V1.21: Oturum Kanıtı ve Eski Yol Görevi Kurtarma

**Tarih:** 19 Kasım 2026 · **Kapsam:** Yalnız WEB `zxc28tarik/FallOfCavalry` · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) DRAFT / UNMERGED · **O00-06:** UYGULAMADA · **V1.21 alt işi:** QA PASS.

## Problem ve açık güven sınırı

V1.20 gerçek haydut savaşı→`QuestCompletionOverlay`→tek seferlik ödül zincirini kanıtladı. Ama `SaveManager` aktif bir objective'i bitmiş halde kaydettikten sonra yüklediğinde, V1.14 güvenlik kuralı gereğince outcome yalnız `pendingObjectiveClaims` olurdu. Oyuncu aynı açık tarayıcı sekmesinde **gerçekten kazandığı ve daha ödül düğmesine basmadığı** görevi yeniden savaşmadan seçemezdi. Öte yandan diskteki `observed` olay ve `objectiveClaims` alanları tamamen değiştirilebilir. Yerel bir save, kriptografik veya sunucu kaynaklı zafer kanıtı değildir.

**Karar:** diskteki geçmiş hiçbir zaman tek başına tamamlanma hakkı vermez. Yalnızca halen açık **aynı JS sürecindeki**, daha önce `QuestEventMatcher` tarafından canlı olayla doğrulanan ve diskten bağımsız **RAM-only `WeakMap`** içinde tutulan birebir görev/olay makbuzu, snapshot içindeki aynı sonucu yeniden kanıtlayabilir. Sekme/pencere tümüyle kapatılırsa, sayfa yenilenirse, farklı cihazda save yüklenirse veya yeni kampanya açılırsa bu geçici kanıt **yok olur**. Genel oyun/anti-cheat güvenliği veya çevrimdışı imzalı kayıt sistemi tamamlandı denemez.

## Uygulananlar

1. **`js/systems/quest-event-matcher.js`**: başarılı `creditQuestObjectivesForVerifiedEvent` sırasında `questManager` anahtarlı, dışarı serileştirilmeyen `WeakMap` içine kaynaklı oturum makbuzu konur: exact quest id/template/createdAt/targetCity/targetRoute/targetCommander/objective/outcome/eventId/day. `restoreInSessionQuestObjectives` yalnız etkin, süresi geçmemiş, **kaydedilmiş outcome ile birebir eşleşen** ve bellekte kendi canlı makbuzu bulunan resmî görev hedefini tekrar açar. Yetkisiz route/changed target/changed ID/farklı createdAt/expired/cold session asla kredi alamaz. Geri yükleme ödül/XP/itibar/karakter efekti dağıtmaz; sadece `QuestManager.updateObjective` ile normal görev seçim ekranını yeniden açar.
2. **`QuestManager.completeQuest` + `GameFlowManager`**: tamamlama sonrası bellekteki eski proof devre dışı bırakılır; tamamlanmış görevin eski aktif save'ine dönüş, sessizce hazır objective/reward oluşturmaz. Yeni kampanya başlatılması RAM kanıtlarını sıfırlar.
3. **`SaveManager.applySavePayload`**: `QuestSnapshot` ve inert pending ledger eski güvenlik sırasıyla yüklenir, bir önceki stale completion popup kapatılır; güvenli mode dönüşünden sonra yalnız aynı oturumun makbuzları yeniden eşleştirilir. `questRestoreReport`: `sessionVerified`, `unverifiedClaims`, `pendingEventHistory`; `creditedEvents=0` (saved event satırından asla ödeme yok). Review UI yenilenir.
4. **`quest-snapshot.js`**: yeni gerçek gameplay sonucu bulunan bir objective'in `objectiveClaims` snapshot kaydı, eski pending iddiası yüzünden ezilmez. Her durumda sadece whitelist hedef/outcome alanları kaydedilir; canonical `QUEST_DEFS` ödül/etki yapısı hiçbir zaman save tarafından seçilemez.
5. **`js/systems/legacy-trade-route-recovery.js`**: eski sıralı yerleşimden türemiş ancak gerçek `roads` grafında karşılığı olmayan `secure_trade_route` görevi için yalnız aynı hedef şehirden çıkan `roadBacked=true` yol teklif edilir. Hedef **otomatik değişmez**. Oyuncu onaylarsa görev resmî şablondan, **aynı quest ID ve mevcut agent bağıyla**, yeni gerçek yol ve **onay günü yeniden başlayan süreyle** oluşturulur. Önceki `pendingObjectiveClaims` yalnız inert tarihçe; outcome/reward/status 'completed' yaratılmaz. Doğrulanmış yol yoksa teklif butonu yoktur. İptal/expired/tamamlanabilir durumdaki görev, desteklenmeyen escort ve messenger şablonları veya uydurulmuş route için geçiş yok.
6. **`js/ui/QuestRecoveryPanel.js`**: yükleme sonrasında gerektiğinde açılan küçük `Görev Kayıtları` paneli; kaydedilmiş sonuçların **doğrulanmadığı** açıklanır. Eski yol ve önerilen gerçek yol açıkça gösterilir; **Yeni yol hedefini onayla** düğmesi oyuncu eylemidir. Panel bir tek güvenli hedef değişiminden sonra yeniden hesaplanır; oyun sonuç/ödül butonunu taklit etmez.
7. **`EconomyManager.pickQuestTargetRoute`**: daha önce `0` numerik `targetCityId` için truthy kontrolü yüzünden rota seçmeyen koşul, gerçek şehir ID'sini string/number eşitliğiyle tanıyacak şekilde düzeltildi.

## Canlı tarayıcı doğrulaması

`tools/browser-world-smoke.mjs` ek kontrol yolları:

- Gerçek `BattleManager.updateBattleSimulation` ile prosedürel haydut zaferi sonrası **ödüle basmadan Save/Load**: `same-session-verified-quest-progress-save-resume` => `saved=true, loaded=true, active=true, objective=bandits_defeated, liveSessionVerified=1, savedHistoryCredited=0, noEarlyReward=true, pathOffered=true`. Ardından gerçek DOM görev tamamlanma düğmesine tıklanınca **tam 300 altın bir defa**, ikinci ödeme yok ve archive/save-load PASS.
- Eski `route:0:1` örneği: önce sahte/saved claim ile kayıt yüklenir; **görev hedefi değişmeden** `legacyUnchanged=true`, `claimStillPending=true`, `noReward=true`, gerçek panel teklifi var. Playwright **Yeni yol hedefini onayla** butonuna basar; aynı quest ID korunur, yeni rota `roadBacked=true`, yeni createdAt günle eşleşir; kaydedilmiş iddiadan outcome/altın üretmeden save/load başarılı.
- Eski `questResume` testi hâlâ sayfa içinde kasten elle yazılmış `bandits_defeated` iddiasını **inert** tutar: aynı oyun oturumunda bir canlı witness yoksa `pendingObjectiveClaims` otomatik ödüle dönüşmez.
- Gerçek asker dengesi için test sonucu çıkarılmaz: deterministik chromium QA, birden fazla güçlü geçici test piyadesi kullanır ama **hiçbir şekilde `resolveBattle('victory')` çağırmaz, düşman HP'sini elle sıfırlamaz veya objective sonucu zorla yazmaz**. İlk koşuda tek piyade uzak okçuları yakalayamadığı için [#44519942633](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44519942633) browser FAIL oldu; yalnız fixture daha fazla test piyadesiyle güçlendirildi ve sonraki tüm smoke koşuları PASS.

## Test ve kalite

**Son doğrulanmış kod HEAD:** `99fb898e799369dbab8be90d999327cefb0aa265`.

- [Web validation #44521210578](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44521210578) **PASS** — **687/687 unit**, **1.099 full PASS + 1 skipped**, static/build PASS, world audit **881 settlements / 304 roads / 3 rivers / 4 crossings, 0 error / mevcut 1 warning**.
- [Gerçek Chromium #44521210590](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44521210590) **PASS** — iki yeni uçtan uca save/reissue DOM kanıtı, eski NPC/quest/route ve gerçek savaş completion regresyonu PASS.
- `tests/unit/quest-session-continuation.test.js`: **7** yeni test: RAM kanıtı, cold forged save, farklı görev/route/şehir/zaman, tamamlanan ödül tekrar koruması, yeni kampanya reseti, expired route, eski claim'e karşı yeni gerçek outcome.
- `tests/unit/legacy-trade-route-recovery.test.js`: **9** yeni test: gerçek komşu yol teklifi, açık onay/same quest ID, rewards fail-closed, save/restore, unsupported görev, deadline, missing road, wrong generator, pending report.

## Açık işler (bilinçli)

- **Tam tarayıcı yeniden açılmasında kısmi objective'yi güvenilir devam ettirme** henüz yok: bunu yerel kayıt dosyasına gizli anahtar koyarak yapmak güvenli değildir. Sunucu kanıtı veya tasarımda explicit yeniden doğrulama/yeniden karşılaşma gerekir. Görev pending olarak görünür ve gameplay tekrar doğrulayabilir.
- Yalnız `secure_trade_route` için kullanıcı onaylı yeni hedef vardır; `investigate_missing_caravan`, `escort_first_caravan`, diğer caravan/commander outcomes için gerçek, tamamlanabilir world event makinesi ve ayrı migrasyon UX açık.
- Kaydı kötü niyetle düzenleyen biri uygulamanın genel oyun state'ini de değiştirebilir; burada amaç kaydedilmiş `eventId` veya objective claim satırının **tek başına resmî QuestManager ödülü/XP/karakter efekti açmasını** engellemektir, hileye dayanıklı sunucu otoritesi inşa etmek değildir.
- Karavan/ordu shortest-path, komutanın gerçek yaşam döngüsü, Organization makam UI, tarihî karakter katalogları, tüm sosyal/diplomasi alt işleri `O00-06` kapsamında **açıktır**.

**Sıradaki önerilen V1.22:** eski unsupported rotaların iptal/yeniden görev kabul UX'i ve `escort_first_caravan` için gerçek escort world event/provenance; ayrıca tarayıcı yeniden başlatıldığında pending claim mesajı kontrolü. PR #68 kullanıcı izni olmadan `main`e alınmayacak.
