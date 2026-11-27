# Fall of Cavalry WEB V1.72 — Atölye faaliyeti, gerçek stok tahmini ve finansal sınırlar

**23 Kasım 2026** · Yalnız web oyununda, PR #68 taslak geliştirme dalında.

## Tespit edilen gerçek kapsam

- Şehir V2 `settlement.cityState.parcels[].buildingIds` ve kanonik yapı kataloğu hangi gerçek atölyelerin bulunduğunu biliyor.
- Ticaret otoritesi `state.markets[id].stocks` ve güvenli `settlement.marketStock` stok köprüsü; fiyat otoritesi `trade.getPrice`. Oyuncunun `party.gold` kaydı gerçek altın hesabı.
- `settlement.ownerFactionId` **şehrin bağlı olduğu devleti** gösterir; atölye sahibi karakteri, işveren veya gelir yararlanıcısı değildir.
- Defterhane vergiler ekranı henüz salt bilgi panelidir. Atölye düzeyinde kanonik maaş, bakım tutarı, tahsilat, işletme sahibi karakter veya şehir hazinesi otoritesi yoktur.
- Güncel FOC Karar Defteri, ticaret mallarının sahipliğini **hizbe değil karakterlere** bağlar. Şehir devletini atölyelerin özel sahibi ilan etmek ve oyuncuya otomatik altın dağıtmak bu kararla çelişir.

**Sonuç:** Günlük ücret, gelir, vergi ve bakım altını kendiliğinden tahakkuk ettirilmeyecek. İşletme hesapları şimdilik **gerçek mal ve mevcut fiyatları esas alan, ödeme yaratmayan gözlem** olacak. Bu, ekonomik sistemleri ikinci kez yazmak değil, mevcut otoriteyi gözlemektir.

## Çalışan V1.72 işlevi

### 1. Birleştirilmiş gün içi üretim planı

Yeni `planCityMarketProduction(city, market)` saf, read-only (yan etkisiz) fonksiyon:

1. V1.70/V1.71 kanonik gerçek bina reçetesi ve Kethüda altyapı kapasitesini okur.
2. Mevcut pazar stoklarından bellekte geçici bir gölge stok kopyası oluşturur. Bu kopya kayıt edilmez, kaynak olarak kullanılamaz.
3. Değirmen → Fırın → Tabakhane → Dokuma → Demirci → Marangoz → Kağıt → Nalbant sırasıyla her parti için **tüm gerçek girdileri ve hedef deponun stok tavanını** denetler. Bir önceki atölyenin bu plandaki ara ürünü sonraki atölyeye geçebilir.
4. En fazla gerçek kapasite kadar üretilmesi mümkün parti sayısını hesaplar; kurulmamış bina, hammadde yokluğu, geçersiz ürün stoku ve depo doluluğunu ayrı durumlarla belirtir.

Günlük **gerçek** `advanceCityMarketCycle` de artık üretim adedini bu **aynı plan fonksiyonundan** alır. Daha önceki, ayrı döngüde tekrarlanan koşullara bağımlılık kaldırıldı. Gerçek stok hareketi hâlâ yalnız `changeStock` → `mirrorMarketStockChange` ve `observeMarketMovement` üzerinden yapılır. Pazar gün sonu drift'i bu planın dışındadır ve gerçek üretimden önce gerçekleşir; bu nedenle UI tahmini **kesin üretim sözü değildir**.

### 2. Gerçek pazar fiyatıyla gider/ürün karşılığı

Yeni `getCityWorkshopOperatingReport(city,market,{day})`:

- Sadece planla **gerçekte yapılabilecek** partiler için alış tarafındaki `trade.getPrice` ile hammadde değerini, satış tarafındaki **aynı mevcut fiyat motoru** ile ürün değerini hesaplar.
- Ayrı piyasa formülü icat etmez; `getPrice` legacy alias normalizasyonu yapabileceğinden **detached market copy** üzerinde çalışır. Şehir ve pazar fiyatları/siparişleri/satış kayıtları değişmez.
- Toplam pazar alış karşılığı / pazar satış karşılığı / **brüt fiyat farkı**; her atölyenin `plannedBatches`, `maxBatches`, `blockedReason` değerlerini döndürür.
- Bu, **gerçek kâr ya da işletme geliri değildir**. İşçi ücreti, kira, bakım, vergi ve mülkiyet hesapları verilmediği için `wagesGold=null`, `upkeepGold=null`, `workshopOwnerCharacterId=null`, `monetaryTransactions=0`.
- `ownerFactionId` yalnız şehrin bağlı olduğu devleti şeffaflıkla gösterir; ticari mal sahipliğini ve atölye mülkiyetini değiştirmez.

### 3. UI

Şehir sahnesindeki `Şehir İaşesi — Günlük Pazar Döngüsü` bölümü artık tek ekranda:

- Nüfusun gerçek pazar stokundan günlük gıda tüketimini,
- kurulmuş atölyeler ve kanonik reçete kapasitelerini,
- **mevcut stokla** kaç parti üretilebileceğini,
- hammadde yetersizliği / depo doluluğu nedenlerini,
- üretim için **mevcut pazar fiyatlarıyla** yaklaşık alış ve satış karşılıklarını gösterir.

Başka bir hazine veya hayalî maaş sayacı açılmaz. Pazar daha açılmadıysa fiyat/operasyon hesaplanamaz ve UI açıkça böyle söyler.

## Test kapıları

`tests/unit/city-workshop-accounts-v172.test.js` (7 test):
- read-only tahmin; şehir/market/oyuncu altını değişmez,
- aynı plan gerçek üretim adedini belirler ve stok köprüsü eşit kalır,
- kurulmamış atölye, eksik hammadde ve tam depo birbirinden ayrılır,
- gerçek `getPrice` alım/satım değerleri ve detached market ile tam eşitlik,
- oyuncunun ve farklı devletlerin şehirleri üzerinde hiçbir sahte altın/mülkiyet oluşturulmaz,
- eksik pazarda güvenli biçimde başarısız olur,
- save/load yalnız mevcut gerçek malları ve bir kez/gün kaydını tutar; rapor persist edilmez.

Tam unit, build, dünya bütünlüğü, tek HTML dosyadan Chromium açılışı ve uzun gerçek Chromium dünya smoke son **aynı commit** üzerinde kontrol edilir.

## Bilerek dahil edilmedi

Gerçek işletme mülkiyeti ve işçi ücretleri gerekli olduğunda işletme/karakter varlık ilişkisi, alıcı/hak sahibi, ödeme hesabı, maaş vadesi, ödenemeyen bakım sonucu ve kullanıcı onayı olan oyun dengesine bağlanmalı. Şu an şehir sahibini tüccar gibi varsaymak, vatandaşlardan tek kalem altın kesmek ya da imalattan oyuncuya günlük bedava para göndermek **yasak**.

Yeni belge ve uygulama yalnız **web prototip** içindir; Unity final ticaret/şehir modelinin resmi kapsamını değiştirip onaylamaz. `main` birleştirmesi yok.
