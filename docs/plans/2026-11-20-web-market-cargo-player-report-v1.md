# Fall of Cavalry WEB — V1.34: Oyuncu Mal Hareketleri Paneli ve Bağımsız Şehir–Kervan Muhasebesi

**Tarih:** 20 Kasım 2026. **Depo:** `zxc28tarik/FallOfCavalry` (WEB; Unity **ayrı proje**, dokunulmadı).  
**Geliştirme dalı:** `codex/web-world-npc-roster-20261118`; [taslak PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68), **henüz birleştirilmedi**. `main`'de değişiklik yok.  
**Üst görev:** O00-06 `UYGULAMADA`. **V1.34 alt işi:** Kod / birim / gerçek Chromium kabulü tamamlandı.

## Amaç ve karar sınırı

V1.27–V1.33 gerçek kaynak stoktan kervana ayrılmış, hayduta çalınmış, muhafızla geri kazanılmış, oyuncuya savaşta verilmiş, hedefe teslim edilmiş ve kayıp kabul edilmiş malların kaynaklı sürecini kurdu. Ayrıca V1.28–29'da birbirinden bağımsız tarihsel iki pazar stok defteri `settlement.marketStock[]` ve `state.markets[id].stocks` yalnız uyumluysa köprülendi. Kullanıcının gerçek oyun ekranından bu hareketleri incelemesi ve **normal alım/satım/günlük stok değişimini kervan kaynaklı hareketten ayırması** hâlâ eksikti.

V1.34 **gözlemsel / salt okunur** bir rapor ve oyuncu paneli ekler. Ne ticari stok ne kazanılmış altın/ödül ne de görev sonucu rapora bakılarak yeniden hesaplanıp değiştirilir. Kayıtların gözlem otoritesi **o JS oturumunda tamamlanmış gerçek motor çağrılarıdır**, **SAVE yetkisi değildir**.

## Kod ve veri hattı

1. **`js/systems/market-cargo-report.js`:** `observeMarketMovement` tamamlanmış ve sonucu ilgili defterde **gerçekten görülen** hareketlerin `kind, ledger, settlementId, settlementName, itemId, before, after, delta, day, cityQty, marketQty, status, questId, routeId` alanlarını en fazla **160** oturumluk kayda ekler. Yalnız `city` veya `market` defteri gerçek `after` değeri ile uyumluyken kayıt alınır; formül, sahte ürün kimliği, negatif/kesirli sayılar veya yanlış gün reddedilir. İki defter `equal / conflict / missing_city / missing_market` olarak **ayrı** gözlenir. Tek defterin mevcut olması diğerinin miktarını üretmez.
2. **Gerçek giriş noktaları:** `js/systems/trade.js` mevcut normal `buy` / `sell` ve `advanceMarketOneDay` fonksiyonlarında market yazıldıktan sonra gözlem yapar (`modern_buy, modern_sell, day_drift`). `EconomyManager.tradeCurrentItem` eski şehir ticareti için ayrı `legacy_buy/legacy_sell` kaydı alır. `WorldPartyManager`, mevcut **doğrulanmış kaynak şehir rezervasyonu** ve **hedef şehir gerçek teslimatı** sonrası `escort_reserved / escort_delivered` kaydı açar. Hiçbir işlem yeni oyun ekonomi mekanizması veya altın dağıtımı oluşturmaz.
3. **`buildMarketCargoReport` / `EconomyManager.buildCargoMarketReport`:** mevcut gerçek dünya / katalog / şehir / micro-market defterlerini V1.29 `auditCampaignMarketStocks` ile salt okuyup uyumsuzlukları çıkarır. Belirli şehir filtresi veya genel toplam, son N gerçek stok hareketi, canlı kaynaklı kervanların V1.33 korunumu ve V1.32 gerçek haydut akıbet kayıtları aynı **ayrı bölümlü** raporda sunulur. Bir günlük arz değişimi, bir kervanın çalınmış malının yok edilmesiyle "netleştirilip" ekonomiye aktarılmaz.
4. **`js/ui/CargoMarketReportPanel.js`:** haritada / şehirde alt solda oyuncunun açabildiği **“Mal Hareketleri”** butonu, şehir seçici (**tüm şehirler** dahil), **Yenile** ve **Kapat** kontrolleri. Dört bölüm: (a) anlık şehir/pazar defteri eşitlik ve uyumsuzlukları; (b) günlük, alım/satım, kervan ayrım/teslim işlemleri; (c) canlı kervanın ürün/adet bazlı korunumu; (d) gerçek haydut/oyuncu/koruma ganimet akıbetleri. Bütün oyun/adlar satırları DOM `textContent` ile yazılır, HTML kodu işletilmez. Panelde **satın al**, **stok onar**, **ödül al** veya **save değiştir** eylemi **yoktur**.
5. **Oturum sınırı:** `GameFlowManager.startNewGame` yeni oyunda, `SaveManager.applySavePayload` yüklemede bu oturumluk `movements` jurnalini sıfırlar. Journal **save payload'a yazılmaz**; JSON ile doğrulanmamış NPC ganimeti doğmaz. Panel menü/başlangıç ve savaş modunda gizli, oyun haritası/şehir modunda görünür.
6. **Eski veri güvenliği:** ikinci stok defterinin yokluğu veya eski çakışan kayıtlar otomatik migrate edilmez. Rapor genel modda tüm dünya hesap toplamını, şehir seçilince o şehrin tek tek stok satırlarını sunar. En son 24 işlem ve 24 haydut akıbeti görüntülenir; tüm zamanların kalıcı işlem tarihçesi olduğu iddia edilmez.

## Kanıt / doğrulama

**Doğrulanan kod SHA:** `6539ae40ba44e43c3072701799bf0b26d80186a9`.

- [Web validation #44718527496](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44718527496): **PASS**, **780/780** birim, **1192/1192** genel test + 1 skipped; lint, üretim build ve repo hijyeni; procedurally produced world integrity **881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata, 1 önceki uyarı**.
- [Gerçek Chromium #44718527520](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44718527520): **PASS, consoleErrorCount=0**. Gerçek kullanıcı web arayüzü `cargoMarketReportToggle` butonundan açıldı, kaynak şehir filtresi seçildi, rapor yenilendi/kapatıldı: **5 kaynak ve 3 hedef gerçek hareket**, şehir+pazar defterinde çakışma yok, `modern_buy`, `modern_sell`, `escort_reserved`, `escort_delivered` bulundu, açma/yenileme/filtreleme **iki stok defterini, envanteri veya oyuncu altınını değiştirmedi**. Normal QuickSave+QuickLoad sonrası stoklar aynı kaldı ve geçmiş hareketler temizlendi (`journalCleared=true`). Önceki gerçek 24 birim teslim + 4 birim battle ganimeti testi yine PASS.
- **8 yeni birim test:** `tests/unit/market-cargo-report.test.js`; sahte hareket reddi ve değişmemiş deftere kayıt eklememe, gerçek trade buy/sell, linked/çatışan defter, şehir filtresi, günlük stok drift, kaynaklı gerçek kervan, 160 kayıt sınırı/defansif veri kopyası/sıfırlama, geçersiz gün/sayı/ürün reddi.

## Doğruluk sınırı / yapılmayan

- Journal **sadece o aktif JS oturumu** ve son 160 olayı kapsar. Önceki oturumların/dönemlerin muhasebe denetimi ya da sunucuda doğrulanan/tahrif edilemez mali defter değildir; kullanıcı bunu "kalıcı ekonomik işlem geçmişi" sanmamalı.
- Günlük `day_drift` hareketi üretim, tüketim, göç, fiyat dengesi veya etkinliğin **tek başına kesin nedeni** değildir. Bu nedenle raporda gerçek stok farkı ve işlem türü ayrılır; gözlemler üzerinden **fiziksel mal toplamına çift ekleme veya fiyat düzeltmesi yapılmaz**.
- V1.33 `auditLiveEscortCargoConservation` yalnız `WeakMap` tabanlı gerçek kervan manifestini kapsar; kullanıcının serbest ticareti dahil tüm krallık mal korunumuna genellenemez. Ürün ağırlık/taşıma, hukuki ganimet, NPC kalıcı mülkiyeti veya çok oyunculu otorite yok. Eski market defterinin hangisinin authoritative olacağını kullanıcıdan izin almadan değiştirmek yasak.
- O00-06 ana kapsam ve D00/D01 tarihsel dünya / G00–G14 tamamen yeni 2D varlık kapıları açık. Unity değişmedi ve PR `main`'e merge edilmedi.

## V1.35 için güvenli öneri

Raporu **yüksek hacimli dünya için sorgu/sayfalama/CSV denetim çıktıları** ile güçlendirmek ve aktif kervan/şehir ayrımında sayısal toplamların bağımsız kanıtını genişletmek; yapay stok onarımı, yeni save authority veya ekonomik ceza kararı almadan devam etmek.
