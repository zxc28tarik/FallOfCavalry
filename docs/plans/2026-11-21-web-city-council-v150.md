# WEB V1.50 — Şehir Meclisi: Günlük İdari Kararlar

Tarih: 2026-11-21
Kapsam: Fall of Cavalry WEB, PR #68 draft; Unity ve main kapsam dışında.

## Oynanabilir içerik

Şehir genel bakışında mevcut şehir meclisi arayüzünün parçası olarak üç farklı günlük karar eklenmiştir:

| Oyuncu kararı | Altın | Güvenlik | İtibar |
| --- | ---: | ---: | ---: |
| Mahalle Nöbeti | -120 | +8 | +1 |
| İmarete Erzak | -90 | +4 | +2 |
| Olağanüstü Vergi | +75 | -9 | -2 |

- Aynı şehirde aynı kampanya günü yalnız **bir** karar alınabilir. Ertesi gün yeni karar mümkündür.
- Bütün işlemler gerçek oyuncu altını ve gerçek şehrin güvenliğiyle çalışır. Altın yetmiyorsa işlem engellenir.
- Güvenlik 0–100 aralığında, itibar negatif olmayacak şekilde tutulur.
- Karar alındığında mevcut oyun olay günlüğü güncellenir ve otomatik kayıt tetiklenir.
- `SaveManager` gerçek yerleşimlerin güvenliğini ve son karar günü/türünü `settlementsCivic` alanına yazar, tekrar yükler. Eski kayıtlarda bu alanın yokluğu normal kabul edilir.
- V1.48–V1.49 görevlerinden gelen şehir güvenliği değişiklikleri de artık aynı kayıt alanında korunur.
- Mevcut şehir servisi ekranı kullanılır. Yeni mod, ayrı harita veya sahte şehir üretilmez.

## Test kapsamı
- Oynanabilir üç farklı seçim, bedel/sonuç, maddi yetersizlik, yanlış seçim kimliği, gündelik tekrar kilidi, ertesi gün yenileme, kayıt sonrası JSON koruması, güvenlik ve itibar sınırları.
- Web validation ve gerçek Chromium CI en güncel committe PASS olmadan tamamlandı ilan edilmez.

## Bundan sonraki içerik
Şehir meclisi etkilerinin tüccarlar ve yerel karakterlerin ilgisini artıran gerçek olay zincirlerine dönüştürülmesi; siyasi yönetim ve kuşatma/ordu sonuçlarına bağlanması. Performans optimizasyonu bir sonraki öncelik değildir.
