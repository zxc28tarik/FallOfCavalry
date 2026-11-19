# Fall of Cavalry WEB — Character System v2 V1.28: Doğrulanmış Çift Pazar Stok Köprüsü

**Tarih:** 19 Kasım 2026 · **Repo:** `zxc28tarik/FallOfCavalry` WEB · **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) **DRAFT / UNMERGED** · **Üst paket:** O00-06 **UYGULAMADA** · **V1.28 ilk stok-köprü dilimi:** **QA PASS**. Unity projesi değişmedi.

## Ön denetim — doğrulanmış iki ayrı veri modeli

- `settlement.marketStock: [{id,qty}]` — eski şehir hizmetlerindeki `EconomyManager.ensureSettlementMarketState/tradeCurrentItem`; V1.27 kaynaklı kervan mal rezervasyonu ve varış stoku.
- `state.markets[settlementId].stocks: {itemId:qty}` — `tradeSystem.initMarket/buy/sell/advanceMarketOneDay`, CityManager/CityServices gelişmiş ticaret ekranı ve talep-momentum-fiyat sistemi.
- Bunların iki ayrı başlangıç üretimi ve ayrı mutation akışları vardı; miktarları her durumda eşit saymak yanlış. Mevcut iki farklı kayıt ayrı ayrı toplanamaz: bu, olmayan malları üretir.
- `EconomyManager.getOrCreateMarketForSettlement` ve günlük `settlementMap` kimlik kontrolü `id=0` için yanlış davranabiliyordu.

## Uygulanan V1.28 teknik çözüm

1. **`js/systems/market-stock-bridge.js`**: kanonik katalogdaki tüm mal kimlikleri için stok doğruluğunu ve iki ledgeri karşılaştıran `auditMarketStockBridge`. Eksik/bozuk/negatif/NaN miktarları geçerli otorite saymaz.
2. **Yalnız güvenilir eşitlikte bağlantı**: yeni üretilmiş market, mevcut ve geçerli şehir stokundan başlatılabilir. Şehir stoku hiç yoksa geçerli market miktarından oluşturulur. Her iki kayıt eski save'de var olup **farklıysa hiçbir miktar overwrite, sum veya otomatik migration yapılmaz**; audit sonucu `conflict` olur.
3. **Kontrollü yazma**: `mirrorMarketStockChange` ve `mirrorCityStockChange` yalnız aynı şehir ID'si, `stockBridge.version===1`, gerçek tek stok satırı, geçerli tamsayı miktarı ve **önceki değer eşitliği** koşullarında ikinci ledgeri günceller. Fark saptanırsa bağ kaldırılır; sahte save alanı tek başına yetki sağlamaz.
4. **Gerçek gameplay entegrasyonları**: `tradeSystem.buy/sell` ve `advanceMarketOneDay` eşlenmiş stokları tek hareketle iki ekranda günceller; eski şehir `tradeCurrentItem`, V1.27 gerçek kervanın çıkış rezervasyonu ve hedefe teslimi de kontrollü write-through kullanır.
5. **Save/Load**: transit kervan henüz save'e authoritative entity olarak yazılmaz. `SaveManager` gerçek ve kaynaklı yükü başlangıç şehri stok **snapshot**'ına geri eklerken, yalnız eşlenmiş ve güncel miktarı hâlâ eşit olan `state.markets` stoğuna da aynısını uygular. Runtime malları/marketler değişmez; farklı legacy kayıtlar keyfî eşitlenmez.
6. **ID=0**: şehir pazar market anahtarı ve günlük pazar güncellemesi sıfır ID'yi geçerli kimlik olarak korur.

## QA ve kanıt

**Doğrulanmış kaynak kod/test SHA:** `c615908459c69228550772316b820020eebad39b`.

- [Web validation #44551966122](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44551966122) **PASS:** **733/733 unit**, **1.145/1.145 full + 1 skipped**, lint, kilitli bağımlılıklar, üretim build ve dünya sayımı başarılı.
- [Gerçek Chromium #44551966136](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44551966136) **PASS:** başlat→tam mevcut dünya, Save/Load ve eski kervan/savaş tarayıcı regresyonları; **consoleErrorCount=0**.
- Yeni `tests/unit/market-stock-bridge.test.js` **7 test**: eşit stok + ID=0, legacy çelişki koruması, oynanmış/forged link reddi, yalnız eksik taraftan başlatma, bozuk stok reddi, gerçek alış/satış/günlük market güncellemesi, transit save snapshot güveni.
- Dünya denetimi: **881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata, önceden mevcut 1 uyarı**.

## Kesin kalan sınırlar — yanlış tamamlandı işaretlenmeyecek

- Bu iki kayıt bu dilimde **fiziksel olarak tek tabloya taşınmadı**: yeni/eşit kayıtlar güvenli biçimde eşleniyor. Farklı eski save ledgeri için otorite seçme, geçiş kararı ve sürümlü migration **kullanıcı onayı olmadan yapılmayacak**.
- `state.markets[].stocks` üzerinden **tam üretim/girdi/çıktı maliyet muhasebesi** ve veri provenance sistemi yok. Bu görev, genel şehir-ekonomi entegrasyonunu kapatmaz.
- Önceden ayrı ilerlemiş iki stok için çakışma raporu var; otomatik onarım veya oyuncuya seçim ekranı yok.
- NPC haydutun V1.27 gerçek mal loot'u hâlâ RAM/WeakMap kaynaklı, yetkili kalıcı ganimet ve pazar satışı değil. Bandit ölümü, save/restart ve ganimet sahibi hakları için ayrı politika/receipt sistemi gerekli.
- Tarayıcı smoke mevcut oyun akışını doğruluyor; **yeni stok eşleme davranışının uçtan uca elle alım→sevk→pazar testi** henüz ayrı browser senaryosu olarak yazılmadı. Yerel unit testi ve genel browser regression PASS farklı kanıtlardır.
- O00-06 **UYGULAMADA**, PR #68 **DRAFT / UNMERGED**; `main`e onaysız birleştirme yok. Unity yok, 2D asker görseli G14 öncesi yok.

## Sıradaki güvenli dilim

1. Yerleşim için iki ledger çakışmasını eksiksiz sayan **read-only campaign audit/CSV**; hem sıfır ID hem legacy save sample'ları.
2. Yeni stok bağlantısı için gerçek Chromium UI alım-satım + canlı kervan kaynak/destination doğrulaması; kullanıcı hareket/harita standartları korunacak.
3. Kullanıcı onayı gerektiren eski save migration otorite kararını ayrı FLAG olarak tut; `ASSISTANT_FILLED` mühendislik protokolünü ana tasarım kararı diye yükseltme.
4. Daha sonra haydut mal provenance, yetkili kazanç/ganimet ve ekonomi stok muhasebesi.
