# Fall of Cavalry WEB — V1.29: Salt-Okunur Eski Stok Denetimi + Gerçek Ticaret/Kervan Chromium QA

**Tarih:** 20 Kasım 2026 · **Kapsam:** yalnız WEB `zxc28tarik/FallOfCavalry`; Unity ayrı projedir. **PR:** [#68](https://github.com/zxc28tarik/FallOfCavalry/pull/68) (DRAFT / UNMERGED). **Üst O00-06:** UYGULAMADA. **V1.29 alt işi:** QA PASS.

## Bulgular ve açık problem

V1.28 iki tarihsel stok defterini yalnız doğrulanmış eşitlikte bağladı:
- `settlement.marketStock[]` — şehir hizmetleri ve kervan yükü;
- `state.markets[id].stocks` — gelişmiş pazar, dinamik fiyatlar, günlük stok hareketi.

Gerçek Chromium regresyonlarında **eski Save/Load'un hiç açılmamış bir şehrin `marketStock` değerini boş `[]` olarak geri yüklediği** saptandı. `ensureSettlementMarketState` boş diziyi başlatılmış stok sanıyordu. Yeni markette gerçek mal varken şehir stoğu boş kalabiliyor, eşit kaynaklar birbirine bağlanamıyordu. Bu hata sırf testte görmezden gelinmedi: **gerçek oyun başlangıç kodu düzeltildi**.

## Yapılan gerçek kod / araç çalışması

1. `js/systems/market-stock-audit.js`: `auditCampaignMarketStocks` ve `auditSavedMarketStocks` **salt okunur** tam kayıt taraması; şehir kimliği sıfır dahil, eşit/çakışan/eksik/bozuk/tekrarlı/öksüz/kanonik katalog dışı satırları şehir+ürün+iki miktarla raporlar. Kullanıcının save verisini yükleyip oyunda çalıştırmaz; stok düzenlemez; kayıt seçim otoritesi vermez.
2. `marketStockAuditCsv`: CSV çıktısı, güvenli metin alıntılama ve `=,+,-,@` formül başlangıcını etkisizleştirme. Varsayılan olarak yalnız sorunlu satırlar; `--all` ile eşitler de görülebilir.
3. `tools/audit-market-stock-save.mjs`: yerel dosyadan `node tools/audit-market-stock-save.mjs --input save.json --output audit.csv`; giriş dosyasını asla değiştirmez. Çıktı konumu verilmezse CSV stdout'a, sayım özeti stderr'a gider. Gerçek kullanıcı kayıtları otomatik olarak taranmadı; kullanıcı dosyası bağlanmadı.
4. `EconomyManager.auditMarketStocks()`: çalışan dünya oturumunda pazarı yaratmadan / stock'u değiştirmeden mevcut iki defteri karşılaştırabilen salt-okunur yüzey.
5. **Gerçek hata düzeltmesi**: `EconomyManager.enterCityServicesForSettlement` şehir stokunu trade micro-market oluşturulmadan önce hazırlar. `ensureSettlementMarketState`, **yalnız `marketStock=[]` ve o şehir için başka pazar kaydı YOKSA** hiç ziyaret edilmemiş şehir stokunu ilk sefer başlatır. Eğer ayrı mikro pazar zaten mevcutsa boş kayıt korunur, otomatik çakışma onarımı yapılmaz. Gerçek eski alışverişte tükense bile `marketStock` satırları `qty=0` olarak tutulduğundan geçerli sold-out stok asla `[]` ile karıştırılmaz.
6. `tools/browser-world-smoke.mjs`: disposible Chromium/Vite'de gerçek `CityServicesUI` butonları için DOM click (panel sürekli yeniden üretildiği için senkron event); kaynaklı gerçek yol görevi, kervan fiziksel ilerleme/varış, iki pazarın miktar eşitliği, transit-save emanet kaydı, varış sonrası Save/Load. QA setup oyuncu altınını yeterli yapar ve kervanı hızlandırır; normal uzun yürüyüş/dinamik dengeyle eşdeğer sayılmaz.

## Doğrulanmış GitHub testleri

**Kod/test doğrulanan SHA:** `4a27b5c23c2e8c07fbe94de2d56ff59e7bbe58bd`.

- [Web validation #44705376871](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44705376871) **PASS**: **741 / 741 unit**, **1.153 / 1.153 full + 1 skipped**, lint/build/repo hijyeni PASS. Dünya yapısı 762.552 tile, 881 yerleşim, 304 yol, 3 nehir, 4 geçiş, **0 hata / önceden mevcut 1 uyarı**.
- [Gerçek Chromium #44705377114](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44705377114) **PASS**. Dünya boot, önceki Character/quest/guard/raid/save regresyonlarına ek **V1.29**:
  - gerçek `route:599:614`, kaynak şehir `599`, hedef `614`; gerçek dünya yol geometrisi 4,414 tile;
  - gerçek şehir ticaret DOM düğmelerinde **buğday 7 → 6 (alım) → 7 (satım)**; `marketStock` ve `markets.stocks` her işlemde aynı miktar;
  - gerçek kervan kaynaklı **24 birim**: `wheat=7`, `flour=8`, `bread=9` kaynak şehirden eksildi, transient save snapshot'ında yalnız kalan gerçek mal kaynak stoğuna iade edilmiş olarak görüldü;
  - oyun motorundaki gerçek kervan takibiyle QA hızında **7 tick** sonra teslim edildi; hedef şehrin iki defterinde aynı gerçek 24 birim artış; kaynak stokları da birbirine eşit;
  - oyuncunun mevcut gerçek `Kervan güvenli ulaştı` düğmesiyle tamamlanma, ardından QuickSave/QuickLoad'da kalan iki pazar miktarları **değişmedi**; **consoleErrorCount=0**.
- **8 yeni regresyon testi:** `tests/unit/market-stock-audit.test.js` 7 test + `tests/unit/market-stock-bridge.test.js` 1 test; read-only, eksik/çakışan/bozuk stok, öksüz mikro-market, güvenli CSV, duplicate/ID=0, boş eski save ve mevcut pazar yetki ayrımı.

## Kesin sınırlar — bilinçli olarak yapılmayanlar

- **Kullanıcının kendi kayıt dosyasında çalışan denetim yapılmadı:** CLI ve sentetik eski-save fixture testleri var; gerçek oyunun Chromium testi disposible/generated dünyada yapıldı.
- Eski, çelişkili iki geçerli stok miktarı **kendiliğinden birleştirilmedi**. Hangi defterin otorite olacağı, otomatik migration, fiyat/üretim maliyeti muhasebesi ve gerçek mal devir politikası için ayrı onay gerekir.
- Tüm dünya için `audit` fonksiyonu vardır; ancak kapalı tarihsel/veri otoritesi açılmadı. `D00/D01` tam tarihsel atlas onay kapıları ve sanat `G00–G14` aynen durur.
- Haydutun V1.27 `WeakMap` ganimeti hâlâ yalnız aynı JS oturumunda kaynaklıdır; kalıcı mal hakları, pazarda satış, teslim fişi ve sahte kaynaklardan Save/Load koruması ayrı iştir. V1.29 bu alanı tamamlamış sayılmaz.
- Tarayıcı testi hızlı QA kervanı, sınırlı rota ve kaynaklı simülasyonla gerçekleşti; bütün kıtayı normal hızda elle yürümek, gerçek yolcu yoğunluğunda NPC denge veya ayrıntılı ekonomi performansı ispatı değildir.

## Sonraki güvenli iş: V1.30

Önce tam dünya stok denetimini **yalnız okuma** ile artan sayı/çakışma sınıfına göre raporla; görselleştirme/oyuncu bildirim alanını ekle. Sonra ganimet için `spawnPartyBandit` kaynaklı gerçek envanter sahipliği, tahribatsız Save/Load geçişi ve bir defalık güvenilir ekonomi aktarımını tasarla/uygula. Mevcut kullanıcı kararı olmadan eski-save otorite birleşimi yapılmaz.

**Geliştirme dalı:** `codex/web-world-npc-roster-20261118`. **main'e merge yok**.
