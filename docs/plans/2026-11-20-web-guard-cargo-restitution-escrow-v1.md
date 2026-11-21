# Fall of Cavalry WEB — V1.31: NPC Muhafızların Kaynaklı Yükü Geri Alması ve Save-Only Escrow

**Tarih:** 20 Kasım 2026  
**Kapsam:** yalnızca web oyunu (`zxc28tarik/FallOfCavalry`), Unity hariç.  
**Uygulama yeri:** `codex/web-world-npc-roster-20261118` / [taslak PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68); `main`'e merge yapılmadı.  
**Üst görev O00-06:** `UYGULAMADA`; bu alt çalışma V1.31 doğrulandı.

## Başlangıç noktası / problem

V1.27 gerçek kaynak şehrin `settlement.marketStock` envanterinden kervana ayrılmış malların yağma sırasında gerçek ve kaynaklı `spawnPartyBandit` haydutuna geçmesini, V1.30 ise yalnız gerçek taktik savaş zaferinde haydudun oyuncu envanterine **tek seferlik** ganimet aktarımını sağladı.

İki eksik kaldı: (1) dünya haritasındaki gerçek NPC muhafızlar haydudu öldürünce ele geçirilen mallar otomatik olarak gerçek kervana geri verilmiyordu; (2) oyuncunun **henüz kazanmadığı** haydut malları sadece RAM içi `WeakMap` otoritesinde olduğundan kaydedilen normal haydut JSON'unda güvenilir şekilde yeniden açılmıyordu. Sıradan kaydedilmiş `loot` metnini yetki olarak kabul etmek sahte ganimet üretebilir.

## Uygulama ve güvenlik çizgisi

- `js/systems/quest-escort-cargo.js`: Haydutun gerçek birim malları `WeakMap` kayıt defterinde korunur. Yeni `claims:Map<liveCaravan,{fromId,questId,routeId,goods:Map}>` alanı, aynı haydutun aynı yolda iki ayrı kervanı yağmalaması halinde her kervanın hakkını ayrı doğrular. Sadece gerçek `reserveEscortCargo` manifestinden daha önce eksilmiş birimler kaydedilir. `bandit.loot`, `cargoManifest` gibi JSON alanları hiçbir zaman bu hakkı oluşturmaz. V1.30 oyuncu zaferi kaydı açıldığında `locked` işareti sonraki baskınların açık zafer fişine yeni mal eklemesini engeller.
- Yeni `returnGuardRecoveredEscortCargo`: canlı ve kaynaklı kervan, aynı kayıtlı yol ve canlı süreçten gelmiş haydut, kanonik görev ve **gerçek NPC ölüm durumu**, o kervan için ayrılmış tam sayı ürün satırları, miktar üst sınırları doğrulanır. Doğrulama tamamlanmadan hiçbir stok değişmez. Başarıda sadece ilgili `claim` düşürülür, aynı kervanın `liveCargo.goods` manifestine gerçek miktarlar geri eklenir, kümülatif `lost` azaltılır, `escortCargo` göstergesi de yükseltilir. Oyuncu envanterine veya kaynak/varış şehri stokuna burada mal eklenmez; son teslimat normal `deliverEscortCargo` üzerinden gerçekleşir.
- `js/systems/quest-escort-npc-guards.js`: `runEscortNpcSkirmish` gerçek NPC vuruşlarıyla bandit HP sıfıra düştüğünde `bandit.alive=false` geçişinin hemen ardından geri alma işlemini çağırır. `returnedCargo` ve `returnedUnits` gerçek NPC skirmish sonucuna eklenir. Tekrarlanan öldürme çağrısı geri alımı çoğaltamaz. NPC zaferi kendi başına yeni görev tamamlama fişi, para veya oyuncu ganimeti üretmez.
- `outstandingEscortCargoForSave`: devam eden kervanın kalan malları yanında, **hâlâ canlı ve runtime kaynaklı haydudun üzerinde bulunan, daha önce oyuncuya/korumaya aktarılmamış mal** da yalnızca SAVE SNAPSHOT'ında kanonik kaynak şehrin stokuna eklenir. Böylece load'da plain-JSON haydutun `WeakMap` kaynağı olmadığı için taşınamayan loot yeni oyuncu ödülüne dönüşmez. Çalışan oyun stokları ve runtime haydut malı **hiç değiştirilmez**. Teslimden sonra da henüz kazanılmamış mal mevcutsa kaynak stokuna safe fallback olarak geri döner. Oyuncunun gerçekten kazandığı mal artık `claimed` olduğu için save escrow'una eklenmez.
- `SaveManager.buildSavePayload` mevcut `settlementsMarkets` ve `snapshotMarketsWithPendingEscorts` yolundan geçer: eşit ve doğrulanmış iki pazar defterine iade yansır; çakışan eski defterler izinsiz birleştirilmez. Gerçek NPC ganimet defteri save payload'a konmaz; plain JSON haydutun iddiası yetki sayılamaz.

## QA / kabul kriterleri

**Doğrulanan kaynak kodu SHA:** `70965936628da6dc3888ebccab3abf1cdb8bd19a`.

- [Web validation #44710563278](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44710563278): PASS. `tests/unit/quest-escort-cargo-escrow.test.js` 7 test ve `tests/unit/quest-caravan-escort.test.js` 1 yeni gerçek `SaveManager.buildSavePayload` testi; gerçek NPC muhafız zaferi, gerçek malın ikinci kez dönememesi, iki kervanın hakkının karışmaması, klon/yanlış yol/yanlış görev/death öncesi red, sadece save'de escrow, iki bağlı deftere restore, oyuncu kazanmışken ikinci iade olmaması.
- [Gerçek Chromium #44710563287](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44710563287): PASS. `route:1:605` gerçek kaynaktan muhafızlar gerçek haydutu 16 NPC döngüsünde yendi; hasar görmüş kervanın yükü %100'e çıktı ve başlangıçta ayrılan **24 gerçek birimin tamamı** 14 oyun hareket tick'i sonra hedef şehre teslim edildi (`fullManifestDelivered=true`). Görev ödülü kanonik buton dışında kendiliğinden üretilmedi; önceki V1.29 ticaret+kervan ve V1.30 oyuncunun demir loot zaferi/save-load testleri de PASS; `consoleErrorCount=0`.
- Ayrı ana dünya haritası doğrulaması hâlâ 881 yerleşim, 304 yol, 3 nehir, 4 geçiş; prosedürel geçici haritadır, resmî D00/D01 verisi değildir.

## Sınırlar / gerekçeler

1. **Kalıcı NPC ganimet mülkiyeti yapılmış değildir.** Normal save plain JSON dünyayı geri oluştururken, kaydedilmiş sahte `loot` alanlarının güvenilir olup olmadığını sunucusuz bir istemcide kanıtlamak mümkün değildir. Güvenli fallback olarak henüz kazanılmamış gerçek mallar yalnız save snapshot'ında gerçek kaynak şehre dönüyor; yüklemeden sonra eski haydut üzerinde kazanılabilir loot taşınmıyor. Bu, NPC ekonomisi içindeki sürekliliğin yerini alan **kayıt güvenliği politikasıdır**. Çok oyunculu/server-authority veya kullanıcı tarafından onaylanan daha gevşek yerel save trust modeli olmadan bunu tam kalıcı NPC envanteri olarak sunma.
2. Muhafız tarafından yenilmiş haydutun farklı kervandan çalınmış ama kazanılmamış malları, başka kervana otomatik aktarılmaz. Haydut purge edilmişse ve kayıt dışı kalmışsa bu kalemler ayrıca muhasebeleştirilmez. Bu risk için gelecekte dünyaAI ölüm/temizleme fişi ve kayıp mal politikası gereklidir.
3. `takeLoot=false`, kaybolmuş haydut, bozuk dünya/veri veya eski çakışan pazar defterleri için oyuncuya otomatik tazminat/ödül yok. Escort savaş denge değerleri değiştirilmedi. D00/D01 harita ve G00–G14 2D sanat kapıları açık; `main` ve Unity değişmedi.

## V1.32 aday iş

WorldAI dünyadan kaldırılırken haydutun gerçek kaynaklı malının kaybolmasına yönelik **muhasebe olayları / yok edilme nedenleri** (muhafız, devriye, savaş, uzaklaşma) ve okuyabilir oyuncu dökümü; gerçek oyun bakiyesi, genel mal muhasebesi ve uzun Save/Load döngüsünde kaynak-hedef adedi değişmezliği. Eski kayıtların hangi stok defterinin otorite olacağı için kullanıcı onayı olmadan migration yok.
