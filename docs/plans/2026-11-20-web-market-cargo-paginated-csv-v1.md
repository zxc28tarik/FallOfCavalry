# Fall of Cavalry WEB — V1.35: 881 Şehirlik Mal Hareketleri Raporunda Filtre, Sayfalama ve Güvenli CSV

**Tarih:** 20 Kasım 2026  
**Depo/sınır:** `zxc28tarik/FallOfCavalry` yalnız WEB; Unity masaüstü oyunu ayrı projedir, dokunulmadı.  
**Çalışma:** `codex/web-world-npc-roster-20261118`, [PR #68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) **taslak, unmerged**; `main` onay almadan değiştirilmedi.  
**Üst görev:** O00-06 `UYGULAMADA`. **V1.35 alt dilimi:** kod ve gerçek tarayıcı doğrulaması PASS.

## Başlangıç ve korunan kurallar

V1.34 oyuncuya **Mal Hareketleri** panelini açmıştı. Stok uyumsuzluğu, normal alım/satım, günlük pazar hareketi, gerçek eskort kervanının yükü ve haydut ganimeti dört ayrı gözlemsel kategoriydi. Ancak eski panel son 24 kaydı gösteriyordu, geniş dünyada şehirler arası stok sorunları tek sayfada tek tek incelenemiyordu, CSV dışa aktarımı yoktu.

V1.35 **sadece raporu** genişletir. `settlement.marketStock[]` ve `state.markets[id].stocks` tarihsel defterlerinden biri otomatik "doğru" kabul edilmez; `conflict` olduğu gibi gösterilir. Ganimet/ödül/altın/üretim/price ve quest yetkisi **rapordan kazanılmaz**. Dünya varlıklarının, harita ve özgün 2D sanatın yetkili yeniden oluşturulmasına girişilmedi.

## Kodda tamamlananlar

### 1. Rapor veri katmanı — `js/systems/market-cargo-report.js`

- Dört kesin kategori: **`stock`**, **`movements`**, **`escorts`**, **`dispositions`**. Sabit alan listeleri `REPORT_COLUMNS`; `queryMarketCargoReportRows` tek kategoride `itemId`, `type` (stok durumu / işlem türü / akıbet türü veya nedeni), serbest metin (ürün, şehir ID/adı, görev, rota, haydut kimliği) ile filtreler.
- **Deterministik sayfalama**: en çok 100 kayıt/sayfa (UI: 10, 20, 50), pozitif/negatif/geçersiz sayfa verisinde aralığa sınırlandırma. `total`, `first`, `last`, `page`, `pageCount` ayrı. Arayüz hiçbir zaman bütün dünyayı tek DOM metni olarak basmaz.
- `buildMarketCargoReport` genel harita denetiminde eski `auditCampaignMarketStocks` tarafından hesaplanan bütün stok satırlarını **salt okunur sorgulanabilir sonuç** olarak verir; böylece bir şehre giriş yapmadan global 881 yerleşimde filtrelenebilir. `stockAudit` zaten eski iki defteri seçmeden okur.
- Gerçek manifestli `escorts` birimleri ürün başına `reserved, inCaravan, inBandits, inPlayer, atDestination, unrecovered, accounted, gap` olarak açılır. `dispositions` birimleri kaynak `questId/fromId` ile açılır; kaynak kanıtı yoksa şehir uydurulmaz. Muhasebe içeriği **salt rapordur**.
- `marketCargoReportCsv(report, options)`: **yalnız görüntülenen sayfa değil, filtreye uyan bütün kayıtlar** CSV olur; bütün kategorilerin güvenilir sabit başlıkları kullanılır, tırnak ve yeni satır escape edilir. Elektronik tablolarda `=`, `+`, `-`, `@` ile başlayan formül enjeksiyonu nötralize edilir. CSV veri olarak yorumlansın, oyun motoruna geri yüklenen ödül fişi olmasın.
- `movements` hâlâ **en son 160** oturumluk olayla, `dispositions` ise **en son 128** olayla sınırlıdır. Bu kısıt açıkça belirtilir; CSV geçmişi yeniden yaratmaz veya save'e yazmaz.

### 2. Oyuncu arayüzü — `js/ui/CargoMarketReportPanel.js`

- Oyun haritasında/şehirde **Mal Hareketleri** butonundan erişim, dört kategori seçimi ve **şehir / ürün / işlem–durum / serbest metin** filtresi; 10/20/50 sayfa boyutu, **Önceki / Sonraki**, doğru X–Y / toplam / sayfa göstergesi, **CSV indir**, Yenile, Kapat.
- Geniş şehir seçenekleri aynı world-settlements dizisi boyunca **cache'lenerek** tekrar tekrar sıralanmaz. İçerik `textContent` ile yazılır, user-provided city/route adları HTML olarak işletilmez.
- CSV tek kullanıcı tıklamasıyla `Blob` + geçici nesne URL'sinden indirilir (UTF-8 BOM dahil). Dosya adı sadece sabit kategori ve güvenli şehir kimliğinden oluşur. Dışa aktarma **save, trade, world AI veya quest** çağırmaz.
- Önceki V1.34 davranışları (şehir filtresi, ticaret ve kervan ayrımı, mevcut pazar defterinde çelişkileri görme) korunur.

## Doğrulanan gerçek kabul

**Kod SHA:** `1a8426a2cdfd09356a40d377c7d00514e5e81615`.

- [Web validation #44720801594](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44720801594): **PASS — 788 / 788 birim testi** ve **1200 / 1200 genel test + 1 skipped**; lint / build / dünya yapısı PASS. Prosedürel harita QA: **881 yerleşim, 304 yol, 3 nehir, 4 geçiş, 0 hata**, önceki 1 uyarı.
- [Real Chromium #44720801808](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44720801808): **PASS, consoleErrorCount:0**. Gerçek tam oyun haritası **881 şehir** stok denetiminde `missing_market` filtresine uyan **204 kayıt / 21 sayfa** (10'luk sayfa) gösterdi. Önceki/sonraki sayfa **1 → 2 → 1** gerçek UI tıklamalarıyla doğrulandı.
- Aynı Chromium kontrolünde `CSV indir` butonu gerçek tarayıcı indirmesi yaptı: **`foc-mal-hareketleri-stock-tum.csv`**; sabit CSV başlıkları, **204/204 satır**, hepsi **missing_market**, yalnız 10 satırlık mevcut sayfa **değil**. Bu browser disposable QA dosyası repoya veya kullanıcıya yazılmadı.
- Ardından **şehir 599 + `wheat` + `modern_buy` + metin araması** filtresiyle tam **1 gerçek alış** görüntülendi; kaynak/hedef stok ve envanter/altın mutasyonsuz kaldı. Önceki gerçek convoy teslim/ganimet/save-load smoke zinciri de PASS.
- `tests/unit/market-cargo-pagination.test.js` **8 yeni regresyon**: 881 şehirde 1762 tam stok satırının sayfalanması; gerçek global çatışma filtresi ve bütün-filtered CSV; ürün/tür/şehir adı sorgusu; son 160 trade olayından bütün 160'ının dışa aktarılması; özel karakter, CSV tırnak/yeni satır ve formül güvenliği; gerçek eskort yükünün ürün bazlı dökümü; kaynaklı gerçek haydut kaybının `questId/fromId` verisiyle satırlaştırılması; boş/geçersiz sayfa/sekme koruması. İlk testteki fixture değeri (20'lik gerçek yük için 17 beklentisi) düzeltildi; final SHA'da hepsi PASS.

## Tamamlanmayan / açık kalması gereken işler

- **Kalıcı NPC ganimet mülkiyeti** ve geçmiş bütün oturumların değiştirilemez işlem günlüğü tamamlanmış değildir. Dışa aktarılan hareketler yalnız oturumun bounded tutulan olaylarını kapsar. Gerçek 881 şehirden **204 missing_market** satırı QA anında ikinci defteri eksik olan yerleri ifade eder; otomatik **404/kayıp veri bug'ı** veya onarılması gereken çelişki sayılmaz.
- Global `stockAudit.rows` tam liste sorgulamak için bellekte tutulur; arayüz DOM'u sayfalıdır. **Çok büyük, sürekli değişen kıta ekonomisinde indeks/cache/streaming** ayrı performans doğrulaması ve muhtemel V1.36 optimizasyonudur.
- Sahte kayıttan loot, otomatik market authority migration, fiyat veya fraksiyon yaptırım kararı verilmedi. Oyuncu CSV'si game engine'e tekrar ithal edilen bir veri formatı değildir.
- D00/D01 resmî tarihsel coğrafya, G00–G14 özgün 2D sanat ve O00-06 üst seviye görevler açık; Unity/main değişmedi.

## Güvenli sıradaki iş — V1.36 önerisi

881 şehir ve çok sayıda piyasa olayında **rapor hesaplama performansı / bellek profili**, kaynaklı audit için **yerleşim ID indeksleri**, yalnız açık panelde istenen bölümü hesaplayan hafif rapor çağrıları, oturumluk ganimet akıbet listesinin yeni oyun/save-load'da sıfırlanma sınırını tamamlayan testler. Kullanıcının daha önce açıkça onaylamadığı herhangi bir pazar defterini doğru ilan edip veriyi değiştirmeden ilerlenmeli.
