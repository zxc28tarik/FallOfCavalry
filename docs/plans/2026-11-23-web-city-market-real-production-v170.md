# WEB V1.70 — Gerçek girdi stoklu atölyeler ve nüfus iaşesi

**23 Kasım 2026 ·** PR #68 taslak dalı `codex/web-world-npc-roster-20261118`. Web oyununa yöneliktir; Unity/C# tarafı değiştirilmez.

## Amaç ve mevcut otorite

V1.69 kanonik Kethüda altyapısının şehir ihtiyacını ve gerçek bina masrafını hesaplar. V1.70 ise gösterimden farklı olarak **mevcut güncel mikro pazar stoklarından** mal tüketen ve mal çıkaran gerçek günlük şehir üretimi kurar. Yeni şehir para sistemi, sahte fizikî bina, açık olmayan 881 şehrin envanter kaydı veya göz ardı edilen paralel tablo oluşturulmaz.

## Günlük akış

`EconomyManager.processDailyEconomy` → var olan `trade.advanceMarketOneDay` → var olan biyom/deterministik stok kayması → **`advanceCityMarketCycle`**.

Yeni kaynak hakemleri: City V2 `cityState.parcels[].buildingIds` ve kanonik yapı kataloğu, aynı `state.markets[id].stocks` ve `settlement.marketStock` (ancak stok-köprüsü doğrulanmış ise). Her değişiklik ön kontrolden sonra `mirrorMarketStockChange` ile eşlenir ve `observeMarketMovement` tarafından gerçek hareket kaydı olarak gözlenir. Yeni audit türleri: `workshop_input`, `workshop_output`, `population_consumption`.

### Girdi–çıktı reçeteleri

| Gerçek şehir binası | Girdiler (gerçek mikro pazardan) | Çıktı |
| --- | --- | --- |
| `mill` / Değirmen | 2 buğday | 1 un |
| `bakery` / Fırın | 1 un + 1 odun | 1 ekmek |

Başlangıç her kurulu bina için günde 1 parti; sayılacak gerçek binalar bina başına yerleşmiş parsellerle sınırlandırılır. Mevcut Kethüda su altyapısının **gerçek yükseltmesi** ve en az %50 nüfus hizmet kapsamı değirmeni 2 partiye çıkarabilir; fırın için bunun yanında gerçek atık/drenaj altyapısı yükseltmesi ve en az %50 yeterlilik gerekir. İkinci parti de **tam girdi maliyeti** öder, karşılıksız bedava stok yaratmaz. Günlük toplam altı parti üst sınırı korunur.

Tüm reçetelerde **işlem atomiktir**: tek bir girdi eksikse, çıktı kapasitesi doluysa veya stok bozuksa o parti hiç çalışmaz. Stoklar negatif olmaz; stok tavanı korunur. Üretim aynı gün ikinci kere işlemez.

### Halkın gıda talebi / tüketimi

Yerleşim nüfusuna göre mevcut pazarın günlük tüketim temsili `min(5, ceil(population/20000))` birim. Bu, nüfusun toplam tarihî iaşe miktarı değildir; pazar satışı/tüketimi temsil eden **geçici oyun dengesi** oranıdır. Ekmek → un → buğday → peynir → balık → et sıralamasında yalnız **elde gerçekten bulunan** gıda stokundan düşülür. Var olmayan stok harcanmaz, oyuncunun erzak envanteri ve altını değişmez.

Tüketilen malda mevcut `market.demand` artar; varsa kıtlıkta un/ekmek/buğday piyasasındaki aynı mevcut talep göstergesi yükselir. Yeni fiyatlandırma motoru oluşturulmaz: fiyatlar yine `trade.getPrice` içinde stok/demand/momentum ve diğer bağıntılarla belirlenir. Meclis kararları ve mevcut kent güvenliği etkilenmez.

### Kaydet, tekrar yürütme ve boyut

Günlük dönüşüm yalnız açılmış, gerçek nüfusu veya atölyesi bulunan mevcut pazarlara `market.mcDay` adlı **tek kompakt int** koyar. `mcDay` aynı günün ve geçmiş günlerin tekrar işlemesini önler; `snapshotMarketsWithPendingEscorts` ve mevcut save objesinde saklanır. Gün boyu ve şehir bazında 881 ayrı yeni sayaç oluşturulmaz; boş ve hiç etkin olmayan şehirlerde yeni alan yazılmaz.

## Sınırlar / sonradan yapılacak

1. **Üretimin tam endüstri zinciri yok.** Sabun, dokuma, demirci gibi diğer imalathaneler henüz kanonik reçeteye bağlanmadı; bina adı kendi başına bedava üretim yapmaz. Yeni reçeteler kullanıcıyla kararlaştırılabilir.
2. **Bakım ve işçilik bedelleri geçici olarak dahil değil.** Şu an mal girdileri ücretin somut tarafı; günde otomatik hazine kesintisi veya bakım vergisi uygulanmaz. Kethüda hizmetleri fizikî olarak bozulmaz; tam bakım bütçe otoritesi verilmeden kullanıcı altınından düzenli kesinti yaratılmayacak.
3. **Nüfus sağlığı, ölüm, büyüme yok.** Gıdaya erişim açığı mevcut fiyat talebine yansır; demografik sonuç için ayrıca doğrulanmış sağlık ve demografi modeli gerekir.
4. **Tüm oranlar PROVISIONAL / ASSISTANT_FILLED.** Kullanıcı tarafından kesin tarihsel ölçü olarak onaylanmış değildir.
5. **CI kabul kapıları:** aynı final commit'inde Web validation, Chromium browser smoke ve indirilebilir tek HTML üçü de PASS. `main` birleştirilmez.

## Dosyalar

`js/systems/city-market-cycle.js`,
`js/systems/trade.js`,
`js/systems/market-cargo-report.js`,
`js/ui/city-services.js`,
`tests/unit/city-market-cycle-v170.test.js`.
