# WEB V1.56 — Şehir koşullarından doğan ekonomik ve asayiş anlaşmazlıkları

Tarih: 2026-11-22. Yalnız WEB taslak PR #68 üzerinde.

## İçerik
V1.55'teki iki önemli kişi arasındaki şehir anlaşmazlığının konusu artık aktif şehirden hesaplanır:
- Güvenlik 40'ın altında: Mahalle Asayişi.
- Güvenlik yeterliyken gerçek buğday stoku 10'un altında: Erzak Paylaşımı.
- Güvenlik ve stok yeterliyken buğday fiyat çarpanı 1.14'ün üzerinde: Pazar İmtiyazı.
- Diğer durumlarda: Şehir Meclisi Kararları.

Oyuncunun önceki üç kararı korunur: birinciyi destekle, ikinciyi destekle, altın ödeyerek uzlaştır. İki önemli karakterin memnuniyet/ilişki etkileri V1.55'teki gibi sürer. Ek olarak gerçek şehrin güvenliğinde sebebe ve tercihe göre değişim oluşur. Erzak ve pazar anlaşmazlıklarında gerçek buğday fiyat çarpanı da değişir: taraf tutmak +0.04; uzlaşmak -0.06 (0.8–1.3 arasında sınırlandırılır). Bu değerler denge amaçlı oyun tasarım kurallarıdır.

Mevcut `settlementsCivic` güvenlik kayıtları ve `settlementsMarkets` pazar çarpanı kayıtları kullanılır. Yeni ekonomi/karakter kayıt mekanizması kurulmaz. Stok hayali olarak artırılmaz; yalnız gerçek pazar durumu etkilenir. Normal NPC'lere makam verilmez, dünya haritasına yeni yer eklenmez.

## Koruma ve sınırlar
- Etki yalnız gerçek aktif şehir nesnesiyle uygulanır.
- Anlaşmazlık yalnız uygun ve hayattaki iki named karakter için geçerlidir.
- Aynı gün ikinci kez karar alınamaz.
- Oyuncunun altını yetersizse uzlaşma reddedilir ve hiçbir sonuç üretilmez.
- UI, anlaşmazlığın nedenini ve iki gerçek kişinin adını gösterir.

## Testler
Yeni Vitest senaryoları farklı nedenlerin sıralamasını, güvenlik ve buğday fiyatı etkilerini, kayıt dönüşünü ve başarısız işlemin durumu değiştirmemesini denetler. Güncel HEAD üzerinde genel web validasyonu ve Chromium başarı vermeden V1.56 tamamlandı ilan edilmez.
