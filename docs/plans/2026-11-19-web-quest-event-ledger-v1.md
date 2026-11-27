# Fall of Cavalry WEB — Character System v2 V1.16: QuestEventLedger (Gerçek Savaş Kaydı / Güvenli Save)

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68), taslak / main'e alınmadı. **O00-06:** UYGULAMADA. **V1.16:** güvenli olay gözlemi altyapısı; görev hedefinin otomatik tamamlanması bu aşamanın kapsamı değil.

## Tasarım ve mevcut gerçek kaynak sınırı

V1.14'te restore edilen kanonik `QuestManager` görevlerinin `objectiveClaims` alanı kasıtlı olarak **inert** tutulmuştu. İncelemede `QuestManager.updateObjective` için üretim içindeki tam doğrulanmış battle/encounter→`targetRouteId` veya `targetCommanderId` bağlayıcısı bulunmadı. `BattleManager.resolveBattle` gerçek savaş sonucu üretiyor, fakat tek başına `routeId` veya görevin komutanını kanıtlamıyor. Bu nedenle “her haydut zaferi ticaret yolu görevi tamamlasın” gibi uydurma semantik kurulmadı.

## Uygulanan alt iş

- `js/systems/quest-event-ledger.js`: `{version:1,observed:[],pending:[]}` ile 1.024 satırlık sınırlı, tekrarı engelleyen, doğrulamalı kayıt. İlk kabul edilen olay `battle_result` ve sonuç yalnız `victory/defeat`.
- `BattleManager.resolveBattle`: `battle.phase === 'result'`, gerçek `battleResult` ile aynı düşman ID/result/winner ve güvenli `resolvedAt` koşulu tutuyorsa olay kaydı. Görev sonucu veya ekstra ödül üretimi **yok**.
- `GameState`, `GameFlowManager.startNewGame`: yeni kampanya boş günlükle başlar. Eski save boş kabul edilir.
- `SaveManager`, `SaveSystem`: `game.questEventLedger` sidecar'ı kayıt altında; **restore edilen `observed` satırlarının tümü `pending` olur**. `QuestManager` hedefine müdahale veya sahte başarı yolu etkinleştirme yok. `questRestoreReport.pendingEventHistory` gözlem, `creditedEvents=0` güvenlik kanıtı.
- `tests/unit/quest-event-ledger.test.js`: eski save uyumu, gerçek ve tekrarlanan battle witness, bozuk/uydurma sonuç, dünyadaki iki noktalı ID, save→pending, tek başına ödül açmama, SaveManager/SaveSystem roundtrip testleri.

## Bilerek açık bırakılan işler

1. **Yetkili hedef eşleştirme**: battle/encounter/trade/army olaylarının, kaynak world entity ID'leri ve gerçek quest objective ile kanıtlı ilişkisi gerekir. Şu anda normal oyun savaşları `QuestEventLedger` tarihçesine girer ancak hiçbir görev objective'ini otomatik açmaz.
2. **Save sonrası gerçek kısmi ilerlemeyi hak edilen şekilde devam ettirme**: kaydedilmiş event yalnız başına güvenilir otorite değildir. Önce dünyadaki kalıcı ve doğrulanabilir `targetRouteId`, `targetCommanderId`, `targetCityId`, event/encounter ID referanslarının bağlanması gerekir. Bu alt iş **henüz tamam değil**.
3. Geniş dünya AI, diploma, stat/XP, görev yeniden atama ve bağımsız organizasyon UI'sı bu alt işe dahil değil.
4. Tarayıcı smoke tüm dünya boot/önceki save+quest restore akışını denetler; bağımsız gerçek savaş→quest event click-through senaryosu ek test olarak bekler.
5. Yerel/offline save sistemi kriptografik olarak dışarıdan doğrulanmış olay kaynağı değildir; sahte imza/anahtar iddiasında bulunulmaz.

## QA kanıtı

Kodun ilk alt paket commit'i `03a2e22a05c6b09d4fb5ede8ba163f32c8f5f85c` için:

- [Web validation #44502248041](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44502248041): PASS — 643/643 unit, 1.055 genel test PASS, 1 skipped; lint/statik/build/regression PASS.
- [Chromium #44502248057](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44502248057): PASS.
- World audit: 881 yerleşim, 304 yol, 3 nehir, 4 geçit, **0 hata / mevcut 1 uyarı**.

**Son kod/dokümantasyon SHA:** `c9c84bc602348c4100014006be0788b1870d1c92`. [Web validation #44502846020](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44502846020) **PASS** — 644/644 unit, 1.056 genel test PASS, 1 skipped, lint/build ve dünya denetimi PASS (0 error, 1 mevcut warning). [Gerçek Chromium #44502846044](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44502846044) **PASS**. İki noktalı dünya party ID regresyonu son test paketine dahildir. Sonuçlar dokümantasyon-only takip commitinden önceki kod HEAD'i içindir.

**Karar:** V1.16 olay kayıt altyapısı uygulanmış; `QuestEventLedger` kaydının tek başına görev ilerlemesini restore etmesine izin **verilmiyor**. O00-06 geniş kapsamda UYGULAMADA. PR #68 taslak; main'e birleştirme kullanıcı onayına bağlı.
