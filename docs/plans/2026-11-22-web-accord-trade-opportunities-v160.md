# WEB V1.60 — Uzlaşma Sonrası Ticari İşbirliği

Tarih: 2026-11-22. Kapsam yalnız WEB taslak PR #68. Unity ve main korunur.

## Oynanabilir içerik
V1.59'un 14 günlük uzlaşma mirasına gerçek ekonomik işbirliği eklendi. Tamamlanmış ve gerçekten teslim edilmiş uzlaşma, aynı yerleşimde yaşayan iki hayattaki önemli kişinin arası hâlâ bozulmamışsa kısa süreli **buğday satış primi** açar:

- Tüccar ve zanaatkâr birlikte uzlaşmışsa yerel buğday SATIŞ fiyatına +%8.
- İkili üyelerinden yalnız biri tüccar veya zanaatkâr ise yerel buğday SATIŞ fiyatına +%4.
- İkisi de bu mesleklerden değilse veya uzlaşma süresi dolmuşsa prim yok.
- Başka şehirde satış, başka ürün, satın alma ve karakterler arası ilişkinin negatife dönmesi prim doğurmaz.

Bu prim fiyat sorgulama sırasında aynı mevcut uzlaşma mirası / karakter ilişkilerinden **yeniden hesaplanır**. Yeni global fiyat katsayısı, stok, para, pazar fırsatı veya ikinci bir kayıt motoru üretilmez. Özel satış fiyatı yalnız ilgili şehrin gerçek pazarındaki başarılı satışlara uygulanır. Fiyat pazardaki görünür satış teklifiyle eşleşir; altın bonusu ayrıca ikinci kez verilmez. Aynı anda eski pazar fırsatları varsa normal fırsat hesabından sonra sınırlı prim uygulanır. Pazar işlemi oyuncunun mevcut envanterini, piyasa stoğunu ve ticaret kar/zarar defterini kullanır.

Mevcut şehir meclisi politika indirimleri, vergi tepkileri ve V1.58 uzlaşma zinciri aynen korunur.

## Doğrulama
Vitest: gerçek tüccar-zanaatkâr +%8; diğer rol +%4; buğday dışı ürün ve alış işleminde sıfır prim; ilişki bozulması/ölüm/şehir değiştirme/14 gün sonu; JSON kaydından dönüş; global piyasa verisinin oynanmaması.

Son HEAD üzerinde Web validation ve Chromium smoke PASS olmadan tamamlandı ilan edilmez.
