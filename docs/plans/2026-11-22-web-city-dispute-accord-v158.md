# WEB V1.58 — Üç Aşamalı Şehir Uzlaşma Heyeti

Tarih: 2026-11-22. Geliştirme yalnız taslak PR #68 web dalında; `main` ve Unity değiştirilmez.

## Oynanabilir içerik
V1.57'de bir şehir anlaşmazlığının gerçek devam görevi tamamlanıp ödülü alındıysa, ilgili yerleşimde ikinci bölüm olan **Şehir Uzlaşma Heyeti** görevi açılır. Bu bölüm aynı gerçek iki önemli kişinin anlaşmazlık gününden ve ilk aşamanın oyuncunun kayıtlı `completedDisputeRemedies` defterinden türetilir. Tamamlanmamış bir anlaşmazlık, sıradan NPC, yanlış şehir veya olmayan hedef yer bu bölümü üretmez.

Görev üç ayrı eylem ister:
1. Gerçek, farklı bir şehre seyahat ederek heyet görüşmesini gerçekleştirmek (`CITY_VISITED`).
2. Yalnız bu hedef şehrin gerçek pazarında toplam **4 buğday** satmak (`DELIVERED`); kısmi teslimat sayılır, yanlış ürün ve yanlış şehir sayılmaz.
3. Oyuncunun ilk şehre geri dönmesi (`CITY_VISITED`). Önceki aşamalar olmadan dönüş başarı sağlamaz.

Oyun içi ilerleme `accordStage` ve `accordDelivered` alanlarıyla mevcut `party.contracts` içinde tutulur. Tamamlandığında altın ve itibar ödülüne ek olarak iki gerçek önemli kişinin memnuniyeti +4'er, aralarındaki ilişki +8 ve kaynak şehir güvenliği +4 olur (değerler 0–100 ve -100–100 sınırlarında). Bu karakterlerin kimlikleri, görevleri, makamları ve organizasyon yapıları değiştirilmez.

Teklifin ve ödülün kaynağı gerçek kayıtlı V1.57 görevidir. İkinci bölümün ödülü bir kez alınır; alınan ödülün ID'si `completedDisputeAccords` ile kaydedilip yüklemede geri getirilir. Başarılı görev ekrandaki aynı han kontrat panosundadır.

## Test kapsamı
- Gerçek iki önemli kişi ve önceki görev ödülü olmadan ikinci bölüm oluşmaması
- Farklı hedef şehir gerekliliği
- Üç aşamaya zorunlu uyma, yanlış olayda ilerlememe
- Kısmi buğday teslimatı, kayıt/yükleme ile devam
- Tek ödül, tamamlanan görevi yeniden kabul etmeme
- Tam web validation ve Chromium smoke sonuçlarını son committe doğrulama

Tüm CI testleri PASS olmadan V1.58 tamamlandı sayılmaz. Önceki sürümler ve altı temel kontrat teklifinin davranışı korunur.
