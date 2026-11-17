# FOC Web — Güncel CI lint kalıntıları ve bağımlılık risk notu (2026-11-17)

## Kaynak / kanıt

Web GitHub Actions çalışması [#44087372705](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44087372705), eski asset ve dev-dışı renderer'lar çıkarıldıktan sonra **501/501 unit PASS**, **913/913 full PASS** (1 test skip) ve Vite build PASS doğruladı; fakat **ESLint 0 error / 7 warning** raporladı. Bu belge o kalıntıların düzeltilmesini kayıt altına alır.

## Yedi uyarının giderilmesi

| Dosya | İşlem |
|---|---|
| `js/entities/units.js` | Kullanılmayan `clamp` import'u ve `engageTarget(dt)` parametresi kaldırıldı, tek çağrı `engageTarget()` oldu |
| `js/game-modes/city-mode.js` | `update(dt)` içindeki kullanılmayan dt parametresi kaldırıldı; metot hâlâ handleInput çağırır |
| `js/game-modes/encounter-mode.js` | Aynı sınıftaki kullanılmayan parametre kaldırıldı |
| `js/managers/EncounterManager.js` | `_buildPhaserArmyData(enemyId)` için kullanılmayan argument/parametre/JSDoc kaydı kaldırıldı; `_launchPhaserBattle(enemyId)` davranışı değişmedi |
| `js/world/pathfinding.js` | Kullanılmayan `coordsToIndex` import'u ve yalnız ilk atamada yazılan `let inOpenSet` düzeltildi (`const`) |

`package.json` içindeki `lint` komutu `eslint js/ tests/ --max-warnings=0` olarak sıkılaştırıldı. Bundan sonra ESLint uyarıları da GitHub CI'yı başarısız yapar.

**Doğrulama:** Bu PR açıldıktan sonra GitHub CI üzerinde güncel SHA için `npm run validate` ve `npm run test` PASS kaydı görülmeden kabul edilmemelidir. Yalnız lint temizliği yapıldı, oyun kuralları ve veri kayıtları değiştirilmedi.

## Ayrı güvenlik riski (otomatik güncellenmedi)

Aynı CI `npm ci` çıktısı, `npm audit` toplamı olarak **16 advisory** (7 moderate, 6 high, 3 critical) bildirdi. **Bu, 16 doğrudan üretim bağımlılığının güvensiz olduğu anlamına gelmez**; transitive ve development bağımlılıkları da sayıma dahildir. Bu çalışma kapsamında otomatik `npm audit fix --force` yapılmaz. Önce `npm audit --omit=dev --json` ile üretim etkisi, `npm audit --json` ile dev toolchain etkisi, güncellenebilir paketler ve kırıcı major sürüm riskleri ayrı raporlanmalıdır. Bu risk hala **AÇIK**.
