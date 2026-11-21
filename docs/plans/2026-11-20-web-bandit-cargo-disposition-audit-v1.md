# Fall of Cavalry WEB — V1.32: Ganimet Akıbeti Muhasebesi ve Kaynaklı Savaş Dökümü

**Tarih:** 20 Kasım 2026  
**Kapsam:** yalnızca `zxc28tarik/FallOfCavalry` WEB. Unity ayrı projedir, dokunulmadı.  
**Dal:** `codex/web-world-npc-roster-20261118`; [PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) **DRAFT / UNMERGED**. `main`'e birleştirme onayı verilmedi.  
**Üst görev O00-06:** `UYGULAMADA`. **V1.32 alt hedef:** QA PASS, fakat tam ekonomi / kalıcı NPC mülkiyeti tamamlandı iddiası yok.

## Kaynaklı mal hareketinin statüleri

V1.27–31'de kaynak şehir `settlement.marketStock` → kervan `liveCargo` → gerçek `spawnPartyBandit` yağması `banditCargo WeakMap` → gerçek oyuncu savaşı veya muhafız karşılaşması → gerçek envanter/teslimat yolu kuruldu. Bu malların patrolla ölüm, uzaklık sebebiyle silinme veya oyuncunun sonuç ekranında almaması halinde kaybolması, ayrı kanıtlı denetim olayı olarak sınıflandırılmıyordu.

V1.32 mevcut gerçekleşmiş hareketleri **yeni para veya stok eklemeden** gözlemleyerek ayırır:

| Tür | Kaynak/provenans | Kayıt gerekçesi ve gerçek varış |
|---|---|---|
| `guard_returned` | Gerçek NPC muhafız öldürmesi + aynı kervanın `claims` kaydı | O kervanın `liveCargo` manifestine gerçek miktar iade; daha sonra normal kervan varışında hedef stoklarına gider |
| `player_recovered` | Taktik motorun gerçek `victory` fişi + aynı canlı haydut | Kanonik oyuncu `inventory.items` listesine tam miktar tek defa aktarılır; normal Save/Load korur |
| `unrecovered_loss/patrol_kill` | Gerçek `world-ai.updateWorldParties` devriye temizliği | Önce çalınmış, geri alınamamış mal kaybı kayıt edilir. Otomatik iade yok |
| `unrecovered_loss/out_of_range` | DünyaAI'nin gerçek uzaklıktan silinme işlemi | Ulaşılamayan mal kaybı kayıt edilir; otomatik iade yok |
| `unrecovered_loss/escort_guard_kill` | Koruma zaferinde **başka kervanlara** ait hâlâ haydutun üzerinde kalan kaynaklı mallar | Bu kervana veya oyuncuya yanlışlıkla eklenmez; kayıp olarak ayrılır |
| `unrecovered_loss/player_victory_forfeited` | Gerçek savaşın sonuç ekranından ganimeti almadan çıkış (`takeLoot=false`) | Daha önce alınmamış mallar kayıp sayılır; otomatik kazanç yok |

## Kod teslimleri

1. `js/systems/quest-escort-cargo.js`: sınırlı (en fazla 128 satır), **yalnız geçerli JS oturumunda** tutulan `cargoDispositionLedger`. Girişler sıra numarası, haydut ID, rota ID, olay türü/neden, ürün ID/adet ve gerçek kervan/quest/kaynak şehir ilişkisi (`sources`) içerir. `inspectCargoDispositions(limit)` sadece kopya veri döndürür; envanter veya ekonomi yetkisi vermez. Boş limit `[]`, aşırı limit en fazla 128.
2. Aynı modül `disposeLiveBanditCargo`: sadece kaynaklı `WeakSet` haydutunda, tanınan kaldırılma nedeni ve gerçek oyun ölüm durumu / onaylanmış savaş fişi varsa henüz alınmamış malları sınıflandırır ve tekrar sınıflandırılmasını engeller. Oyuncunun gerçekten aldığı mal `player_recovered` kaydını **başarılı tek seferlik envanter aktarımından sonra** üretir.
3. `previewWitnessedBanditCargo(battle)`: yalnız `BattleManager.resolveBattle('victory')` yolunda kaynak doğrulaması yapılmış, gerçek ve henüz tüketilmemiş battle fişinden mal listesini salt okunur döndürür. Result kaydındaki salt metin, **ekonomik ödül kanıtı değildir**.
4. `js/systems/world-ai.js` ve `WorldPartyManager.updateWorldParties`: gerçek devriye öldürmesi veya uzaklık nedeniyle silinmede isteğe bağlı `onBanditRemoved` callback'i, kaynaklı loot yoksa sessizdir. DünyaAI'nin hareket, savaş dengesi, bandit spawn sayısı, harita ve eski kayıtları değiştirilmedi. DünyaManager `inspectBanditCargoDispositions(limit)` sadece rapor erişimi verir.
5. `js/systems/quest-escort-npc-guards.js`: gerçek koruma zaferinde önce yalnız aynı kervana ait çalıntı mallar iade edilir, sonra diğer kervanların haydut üzerinde kalmış malları `escort_guard_kill` kaybı olarak sınıflandırılır.
6. `js/managers/BattleManager.js`: oyuncu savaş çıkışında eski kaynaklı ganimet fişinin `player_victory_claimed` veya `player_victory_forfeited` akıbeti doğrulanır. Zaten teslim edilmiş oyuncu malı ikinci defa yok edilmez / verilmez.
7. `js/managers/EncounterManager.js`: gerçek `Battle Result` metnine **`Recovered caravan goods (collect on Continue)`** başlığıyla yalnız kaynaklı malın **ürün adı ve tam adetleri** eklenir. Önizleme gerçek aktarımı yapmaz; savaş sonucundaki seçim ve kanıtlanmış envanter aktarımı belirleyici kalır.

## Kontroller

**Kaynak kod ve tarayıcı doğrulama SHA:** `aaa3149e060652f96d6155c972b9bd56eecf1f64`.

- [Web validation #44713036976](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44713036976) **PASS**: **764 / 764 birim**, **1.176 / 1.176 genel + 1 skipped**, lint ve üretim derlemesi başarılı.
- [Gerçek Chromium #44713037045](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44713037045) **PASS**: `source-bandit-verified-itemized-battle-result-panel` başlık/goods / aktif panel eşleşmesi doğru; gerçek yol haydutunun çaldığı **4 demir**, gerçek `BattleManager` zafer sonuç panelinde gösterildi, çıkışta bir kez `iron:+4` envanter aldı. Oturumluk muhasebe kaydında `player_recovered`, `player_victory_claimed`, gerçek `questId` ve tam ürün farkı birlikte doğrulandı. QuickSave/QuickLoad kalıcı miktarı bozmadı; **0 console error**.
- Yeni `tests/unit/quest-bandit-cargo-disposition.test.js`: **7 test**. Gerçek devriye/uzaklaşma DünyaAI kaldırılması, multi-kervan aynı haydut, muhafız geri alımı + diğer kervanın kaybı, gerçek battle preview / tek kullanımlık player credit, loot reddi, veri kopyası ve listenin sınırlandırılması.
- Dünya bütünlüğü: 881 yerleşim, 304 yol, 3 nehir, 4 geçiş; **0 yapısal hata**, önceden mevcut 1 uyarı. Bu procedural dünya nihai onaylı D00/D01 atlası değildir.

## Kesin yapılmayanlar / dikkat

- Muhasebe defteri **process-local, bounded ve yalnız gözlemseldir**, kayda yazılmaz. Geçmiş oturumlar arası kesin maliye/ekonomi defteri değildir. Kaydedilmiş haydutun `loot` iddiası doğrulanıp oyuncuya mal verme yetkisi kazanmaz.
- Kayıp mallar, özellikle devriye veya uzaklıktan silinme, sadece izlenir; ayrı kabul edilmiş politika olmadan kaynak şehre otomatik tazminat veya yeni fraksiyon cezası yok. Önceki V1.31'in canlı haydutun kaynaklı malını **save snapshot'ında** güvenli şekilde geri alma kuralı aynen devam eder.
- Kayıtlar bilinen gerçek skirmish, WorldAI normal purge/despawn ve Player BattleManager exit yollarına bağlıdır; başka özel modülün doğrudan party listesini yeniden yazdığı her beklenmedik yol için eksiksiz kanıt garantisi yok.
- `takeLoot=false` yalnız bu **kaynaklı çalıntı malları** bırakır. Mevcut temel battle reward mekanizmasının `resolveBattle` sırasında verdiği standart loot/altın davranışı bu dilimde değiştirilmedi.
- **Kalıcı NPC mal sahipliği, uzun vadeli tam ekonomik muhasebe, fiyat/üretim/tazminat dengesi, eski pazar defterlerinin otorite birleştirmesi, UI'da ayrı kategorili depo paneli** hâlâ ayrı geliştirme ve bazıları kullanıcı onayı gerektiriyor.
- Unity yok; resmî tarihsel veri D00/D01 ile görsel G00–G14 karar kapıları korunuyor.

## Sonraki güvenli iş — V1.33 önerisi

DünyaAI'nin henüz denetlenmeyen kaynaklı parti kaldırılma yerlerini bul ve geçerli kaynaklı sebeplerle sadece gözlemsel kayıtları tamamla. Sonra süreçteki mal korunumunu (kaynak + kervan + haydut + oyuncu + hedef) birim bazında test edecek çok günlük simülasyon denetimi tasarla. Eski kayıt otorite politikası ya da yeni ekonomik yaptırım için onay olmadan iş kuralı değişikliği yapma.
