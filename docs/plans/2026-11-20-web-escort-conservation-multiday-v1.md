# Fall of Cavalry WEB — V1.33: Kervan yükü kaynaklı korunumu, çok günlük test ve kaybolan konvoy sınıflandırması

**Tarih:** 20 Kasım 2026. **Depo:** `zxc28tarik/FallOfCavalry` — WEB ONLY. Unity ayrı projedir.  
**Geliştirme dalı:** `codex/web-world-npc-roster-20261118`. [Taslak PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) **unmerged**. `main` güncellenmedi.  
**Üst iş:** O00-06 `UYGULAMADA`; V1.33 alt dilimi gerçek kod/testlerle QA PASS.

## Amaç ve sınır

V1.27–V1.32 kaynak şehir/kervan/haydut/oyuncu/muhafız/hedef şehir arasındaki gerçek mal hareketlerini kurdu. Bu hareketlerin uzun bir görev veya birden fazla oyun günü boyunca eşit miktarı koruduğunu gösteren **ürün bazında** bir denetim yoktu. Ayrıca kaybolmuş/başarısız gerçek konvoyun elindeki mal, salt okunur muhasebede hâlâ "kervanda" gibi görünebiliyordu.

Bu sürüm **tam kıta üretim-tüketim ekonomisi değil**, her bir gerçek escort görevinin yola çıktığı manifestin korunumunun denetimidir. Diğer serbest ticaret, üretim, market drift, fiyat, nüfus ve oyuncunun bağımsız alışverişleri bütün dünya için sabit tutularak iddia edilmiyor.

## Tamamlanan kod

1. `js/systems/quest-escort-cargo.js`: gerçek `reserveEscortCargo` sırasında `initialGoods` kaynakları kopyalanır. Mevcut gerçek `liveCargo.goods`, canlı kaynaklı haydutun **yalnız o kervana ait** `claims` malı, taktik savaş zaferinde oyuncuya tek sefer aktarılan ürün (`playerRecovered`), yetkili dünyadan çıkarılma sonucundaki `unrecovered`, gerçek kervan varışında `deliveredGoods` ayrı izlenir. Tam sayı/ürün ID bazında eşitlik hesaplanır.
2. `auditLiveEscortCargoConservation({caravan,worldAi})`: process-local, **salt okunur** ve oyun dünyasında kanıtlı kervan nesnesine özgü denetim. Her ürün için `reserved, inCaravan, inBandits, inPlayer, atDestination, unrecovered, accounted, gap, status` verir; `gap=0` dengeli, aksi `mismatch`. Kaynağı olmayan JSON klonunda `unverified`. Kullanıcının yerine stok eklemez, fiş üretmez, save verisini migrate etmez.
3. `classifyRetiredEscortCargo`: gerçek kervan `WorldPartyManager.processQuestEscortCaravans` yoluyla **görev iptal/aktif dışı**, **başarısız/terk** veya **haydut baskını başarısızlığı** nedeniyle öldüğünde geri alınmamış gerçek manifesti bir defa `unrecovered` olarak sayar; kervanda mal kalmış gibi sahte denge bildirmez. Şehir stokuna otomatik iade veya oyuncu ganimeti yok. Açıklamasız/başka yolla yok edilen kervan ise açık `mismatch` olarak görünür; kayıp miktar uydurulmaz.
4. `WorldPartyManager.auditEscortCargoConservation(caravan)`: çalışan gerçek oyun oturumunda denetimi okuma yüzeyi. V1.32'nin gerçek devriye/mesafe bandit kaldırma, oyuncu ve muhafız sonuç kayıtları korunur.
5. `tools/browser-world-smoke.mjs`: gerçek `route:599:614` sevkiyatında kaynak şehirden çıkan **24 birimin tamamının** gerçek hedefe teslim edilip ürün bazında `balanced` ve `gap=0` olduğunu kontrol eder. Ayrı gerçek `route:419:423` yağma/oyuncu zaferinde oyuncuya geçen **4 demirin** `inPlayer` olarak sayıldığını, geride açıklanmayan birim kalmadığını ve sonraki Save/Load'da gerçek envanter miktarının korunduğunu doğrular.

## 8 yeni regresyon testi ve temsil kapsamı

`tests/unit/quest-escort-conservation.test.js`:
- **Oyun günleri 4, 5, 6** boyunca gerçek `tickQuestEscortCaravan` yolundaki konvoyun 18 birim kalan + 6 birim canlı haydut malının her gün 24 etmesi; her gün salt save snapshot'ın kaynak şehre **24 gerçek birim** iade etmesi ve runtime stoklarını değiştirmemesi.
- **Gün 7** gerçek road/tick/arrival + `deliverEscortCargo`: hedef stokları +18; canlı haydutta 6, kaynaklı toplam 24; ikinci teslim yok.
- Taktik zafer fişiyle oyuncuya 6 mal aktarımı, **tek claim**, ardından gerçek varışta kalan 18'in hedefe gitmesi; hiçbir ürünün iki defa sayılmaması.
- Gerçek haydut ölümünün `patrol_kill` nedeni ile hayduttan alınamayan 6 birimin `unrecovered` hesabına geçmesi; şehir stoğu değişmez.
- Kanıtsız çıkarılmış haydutun 6 birimlik **mismatch** üretmesi; sahte bandit/kervan klonunun yetki kazanamaması.
- Başarısız gerçek kervanın kalan 18 birimi `escort_failed` kaybına çevirmesi; canlı haydutun 6 biriminin ayrı bulunması.
- Açıklamasız ölümün 24 birim fark olarak açık kalması.
- Aynı gerçek haydutun **iki farklı kaynaklı kervandan** çaldığı malların bir oyuncu zaferinde toplam 12 birim olmasına rağmen **her kervanın riêng 6** olarak denetlenmesi.

**Yalnız izole test senaryolarında** dünya şehir stoklarının başlangıç ve sonuçları ile gerçek `inCaravan + inBandits + inPlayer + unrecovered` toplamı her mal türü için ayrıca karşılaştırıldı; hedefe teslim edilen mal zaten hedef `marketStock` stoğunda olduğundan **ikinci kez eklenmedi**. Gerçek üretim/tüketim veya başka dünya olayları içinde aynı şekilde sabit toplam beklemek doğru olmaz.

## Kesin QA kanıtları

**Kod/Chromium doğrulanan SHA:** `6c6db5d4c53c7f1e6f89fc2f08b7f7560f3b7d37`.

- [Web validation #44715513370](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44715513370): **PASS**, **772/772 unit**, **1184/1184 full + 1 skipped**; lint/build/repo hijyeni PASS. Geçici procedural dünya 881 yerleşim, 304 yol, 3 nehir, 4 geçiş: 0 hata, önceden var olan 1 uyarı.
- [Gerçek Chromium #44715513188](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44715513188): **PASS**, `conservationBalanced=true`, `conservationGap=0` sevkiyatta 24 gerçek mal; `conservedPlayerLoot=true` ve `conservationGap=0` 4 demir oyuncu aktarımında; source-custody doğru, tek defa ödül, gerçek Save/Load, **consoleErrorCount=0**.

## Yapılmayanlar / sonraki güvenli adım

- **Kalıcı, reload sonrası aynı NPC'ye ait çalınmış mal sahipliği** yok; kullanıcı tarafından onaylanmayan otomatik eski save authority seçimi yok. Korunan V1.31 politikası: henüz kazanılmamış gerçek mal yalnız **save snapshot** içinde kaynak stoğa geri dönerek plain JSON bandit'i sahte loot kanıtına dönüştürmez.
- Denetim yalnızca bu JS oturumunun `WeakMap` yetkili manifestleri içindir. Global ekonomi/üretim kapalı defter modeli ve bütün dünya için gerçek mal korunumu sözü değildir. Kervanın başarısız olması `unrecovered` (muhasebeleştirilmiş kayıp) sayılır, fiziksel malın geri kazanıldığı anlamına gelmez.
- V1.33 testinde üç farklı **oyun günü** test edilmiştir; gerçek tarayıcı testindeki kervan bunun aksine hızlandırılmış QA hareketidir. Tüm kıta ve yüzlerce gün boyunca canlı performans, ekonomik trend veya tüm stok değişimlerinin sistemsel kanıtı değildir.
- D00/D01 tam tarihsel dünya, G00–G14 yeni 2D sanat kapıları ve O00-06 genel çalışma açık. Main/Unity yok.

**V1.34 önerisi:** Oyuncuya olay bazlı salt okunur mal akışı ve açıklanamayan farkları birleştiren sorgulanabilir rapor; gerçek şehir ticaretinde üretim/tüketimden doğan meşru stok artışlarının bu eskort muhasebesiyle nasıl ilişkilendiğini, eski stok defterlerinin otoritesine dokunmadan ayrı muhasebe kapısı olarak çalışmak.
