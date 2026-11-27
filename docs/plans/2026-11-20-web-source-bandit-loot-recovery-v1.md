# Fall of Cavalry WEB — V1.30: Gerçek Haydut Baskın Ganimetinin Tek Kullanımlık Savaş Zaferiyle Oyuncuya Kurtarılması

**Tarih:** 20 Kasım 2026. **Repo:** `zxc28tarik/FallOfCavalry` (WEB). **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) **DRAFT, UNMERGED**. **Ana iş O00-06:** UYGULAMADA. **V1.30 bu alt dilim:** QA PASS. Unity deposu değişmedi.

## Gerçek gözlem ve veri hattı

V1.27, gerçek kaynak şehir `settlement.marketStock` stoğunu bir kervanın RAM içi manifestine ayırmıştı. V1.26 gerçek haydut/koruma skirmish'i kervan yükünün belli miktarını gerçek haydut `WeakMap` ganimetine geçiriyordu. V1.28–V1.29 şehir pazarlarının güvenli stok köprüsünü ve gerçek tarayıcıda çıkış/teslim/iade testini sağladı.

Buna karşılık öldürülen haydudun aldığı malların kalıcı oyuncu envanterine geçişi **yoktu**. V1.30 bu **belirli zinciri** bağlar: kaynak şehir → gerçek NPC kervan → gerçek yol haydudunun ele geçirdiği somut mal → kaynaklı taktik savaşta oyuncu zaferi → oyuncunun mevcut `inventory.items` tablosu → normal oyun Save/Load.

## Uygulananlar

1. **`js/systems/quest-escort-cargo.js`:** Gerçek `spawnPartyBandit` kaynaklı haydut için `banditCargo` artık `{routeId, goods: Map, claimed:false}` tutar. Ürün listesi yalnız katalog ve kervanın gerçek stokundan doğar; `WeakMap` kayıtları JSON save/clone'dan oluşturulmaz. Malı hayduda eklemeden **önce** claimed/route uyuşmazlığı kontrol edilir; reddedilen işlem kervan stoğunu azaltmaz.
2. **`witnessBanditCargoBattleVictory`**: gerçek `BattleManager.resolveBattle('victory')` sonrasında, hâlâ `worldAi.parties` içindeki kaynaklı `isRuntimeRouteBandit` aktörü, gerçek kanonik yol, birebir `wai-${bandit.id}` karşılaşma/harita kaynağı ve tamamlanmış zafer kontrol edilerek savaş nesnesine process-local `WeakMap` kurtarma fişi açılır. JSON ile geri yüklenmiş sahte haydut yükü veya yalnız `battleResult` iddiası başlı başına yeterli değildir.
3. **`recoverWitnessedBanditCargo`**: `BattleManager.exitBattleResultToMap(takeLoot=true)` sırasında gerçek haydut silinmeden önce aynı savaş fişi, aynı haydut nesnesi, aynı dünyaAI roster'ı, aynı düşman kimliği, geçerli tam tamsayı ürün miktarları ve kanonik katalog tekrar denetlenir. Mevcut `playerParty.inventory.items` **tek atomik güncelleme** ile gerçek miktar kadar büyür; birimler kopyalanmaz. Mevcut eşya miktarı bozuksa veya envanter geçerli değilse hiçbir parça verilmez. Başarıdan sonra fiş tüketilir, haydut `WeakMap` ganimeti boşaltılır. İkinci çıkış veya claim aynı malları veremez.
4. **BattleManager UI günlük kaydı**: teslim edilen kaynaklı malların adı/adedi son savaş kayıt mesajına eklenir. Normal savaşın standart rastgele altın/eşya sistemi değiştirilmedi; ganimet kurtarımı ayrıca altın, görev objective'i veya completion receipt üretmez.
5. **Save/Load**: `SaveManager` mevcut envanter tablosunu zaten kaydettiğinden, **gerçekten oyuncuya aktarılmış** mallar olağan save/load ile korunur. Bu alt iş save şeması veya JSON içinde bağımsız hak iddiası yaratmaz; reload edilen haydutun eski `loot` adlı sahte alanından ganimet türetmez. `takeLoot=false` yolunda kurtarma yapılmaz.

## QA — doğrulanan kod SHA ve sonuçlar

**Kaynak kod ve test doğrulanan SHA:** `caa513fde16310d52c22fb0d58057e1f7b834320`.

- [Web validation #44708033949](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44708033949): **PASS**, 749/749 birim, 1.161/1.161 genel + 1 skipped; lint, hijyen, build, tüm dünya yapısı kontrolü başarılı. Mevcut procedural dünya: 762.552 tile, 881 yerleşim, 304 yol, 3 nehir, 4 geçiş; 0 hata, önceki 1 uyarı.
- [Gerçek Chromium #44708033912](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44708033912): **PASS** ve browser consoleErrorCount=0. Gerçek `route:419:423`, gerçek `spawnPartyBandit`, gerçek NPC yağması: kervanın ilk 18 malından yüzdelik hasarla **4 demir** haydutun hafızasındaki yüküne geçti. Oyuncunun QA askerleri gerçek taktik simülasyonda **8 tick** sonra zafer aldı; zaferi test betiği elle yazmadı. Savaş sonuç ekranı öncesi/sonrası envanter farkı yalnız **iron +4**, haydut gerçek dünyadan kaldırıldı, ikinci exit reddedildi, quickSave/quickLoad sonrasında demir miktarı değişmedi, claim ilave altın üretmedi.
- **8 yeni birim testi**: `tests/unit/quest-escort-cargo-recovery.test.js` kanonik ürün aktarımı, aynı fişin tekrarı, klon/sahte savaş, yanlış düşman, ölü/başka yol haydut, eksik katalog, bozuk envanterde atomiklik ve JSON save-reload temsilini sınar.

## Kapsam sınırı: henüz yapılmadı

- **Savaş kazanılmadan önce haydudun çaldığı mallar hâlâ yalnız mevcut JS oturumunda kayıtlıdır.** Save/load öncesinde ele geçirilmemiş NPC ganimeti bir JSON `cargo` alanına güvenilerek tekrar yetkilendirilmez; yükleme sonrası otomatik oyuncu alacağı doğmaz. Bu, güvenli provenance kuralıdır ancak **kalıcı NPC envanter ekonomisinin tamamlandığı anlamına gelmez**.
- **NPC muhafızlar** gerçek haydudu öldürdüğünde ele geçen malın kervana/pazara geri verilmesi veya yağmanın tazmini hâlâ yapılmadı.
- `takeLoot=false` sonucunda bu kaynaklı ganimet talep edilmez. Oyunun zaten savaşı sonuçlandırırken ödüllendirdiği eski standart rastgele ganimet davranışı bu dilimde değiştirilmedi. Sonuç ekranında tür bazlı ayrı ikmal sekmesi henüz yoktur.
- Oyuncu envanterine aktarım mevcut kapasite / aşırı yük taşıma kurallarını kullanır; yeni ağırlık tahsilatı, sigorta, tüccar hakkı, ganimet hukuku ve fraksiyon ilişkileri kararı eklenmedi.
- D00/D01 resmî tarihsel veri, G00–G14 görsel sanat kapıları ve O00-06 ana AI/karakter/organizasyon çalışma kapsamı açık. Unity yok; `main` merge yok.

## Sıradaki güvenli mühendislik dilimi (V1.31 önerisi)

Ganimet için **NPC'de kalıcı hak / escrow / geri alma** zincirinin Save/Load'da sahte sahiplik iddiasına dönüşmeden nasıl temsil edileceğini ayrı yetki modeliyle kurmak; muhafız zaferinde geri kazanım ve oyuncu sonucu ekranında tür/adet görünürlüğü için kanıt/test eklemek. İki eski pazar defteri arasındaki tarihsel stok conflict'ini otomatik çözecek migration kararı alınmadı.
