# WEB V1.65 — Gerçek Yol ve Üretim Çıktısına Bağlı Kervan

Tarih: 2026-11-22. Kapsam yalnız web taslak PR #68. Unity ve main değiştirilmez.

## Oynanabilir geliştirme
V1.64'ün tamamlanmış bölgesel işbirliği gerçek iki şehri birbirine bağladığında, kaynak şehirde haritada gerçekten mevcut ve uçları doğrulanan **doğrudan yol bağlantısı** varsa yeni `PRODUCTION_CARAVAN` görevi açılabilir. Üretim malı yalnız kaynaktaki **mevcut biyom üretim verisinde** (`MARKET_BIOME_PRODUCTION`) pozitif çıktısı bulunan ve kaynak şehrin **gerçek `marketStock`** tablosunda en az 3 birim olan ticaret mallarından seçilir. Veri yoksa görev doğmaz; envanter veya ürün uydurulmaz. Dünya haritasındaki gerçek yol `canonicalRoadLinks` ile doğrulanır; eski yerleşim listesi sırasına göre yaratılan uyumluluk rotaları gerçek yol sayılmaz.

Üç zorunlu, sıralı aşama:
1. Kaynak şehrin gerçek pazarından belirlenen maldan toplam **3 adet satın al** (`TRADE_GOOD_BOUGHT`, gerçek `trade.buy` sonucu miktarıyla).
2. Hedef şehri ziyaret et (`CITY_VISITED`).
3. Hedef şehrin gerçek pazarında **aynı maldan 3 adet sat** (`TRADE_GOOD_SOLD`, gerçek `trade.sell` sonucu miktarıyla).

Yanlış ürün, şehir, erken satış, başarısız ticaret veya sahte teslimat görevi ilerletmez. Kısmi alış/satışlar kontratta saklanıp yeniden yüklemeden sonra devam eder. Görev teslimi mevcut altın/itibar sistemiyle ödüllendirilir; **yalnız bir kez** alınabilir (`completedProductionCaravans`). Başarı sonrası mevcut `EconomyManager.improveTradeRoute` üzerinden doğrulanmış rotanın kalitesi +1 yükseltilir ve hasarı 1 azalır. Hedef şehir güvenliği +2 olur. Bu gerçek ticaret yolu iyileştirmesidir; sahte bir üretim tesisi, yeni yollar veya ikinci ekonomi motoru kurulmaz.

Eski görev tipleri, şehir meclisi, named karakter bağlantıları, mevcut pazar teklifleri ve alım-satım fiyatları korunur. Bu aşamada bir oyuncunun aldığı malın nereden üretildiğine dair bireysel takip yapılmaz; yalnız pozitif biyom potansiyeli ve gerçek kaynak pazar stoğu kullanılır.

## Doğrulama
Vitest: geometrisi doğrulanmış yol; bozulan yol ve yanlış biyomda görev açılmaması; stok eksikliğinde durma; aynı üründen gerçek alış, hedefe ziyaret, gerçek satış; yanlış ürün/şehir/sıra; kısmi ticaret ve kayıt devamı; tekrar ödül engeli. GitHub Web validation ve Chromium browser smoke PASS olmadan tamamlandı kabul edilmez.
