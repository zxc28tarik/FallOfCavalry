# WEB V1.62 — Gerçek Komşu Şehir Krizleri ve Yardım Görevleri

Tarih: 2026-11-22. Kapsam yalnız WEB taslak PR #68. Unity ve main korunur.

## Oynanabilir içerik

Oyuncu gerçek bir şehirdeki hizmet/kontrat panosunu açtığında, haritada var olan diğer yerleşimlerin güvenlik ve pazar stoğu verileri kontrol edilir. Yakındaki en uygun şehirde gerçek bir kriz varsa tek bir ek `REGIONAL_AID` görevi açılabilir. Yerleşim, görevin hedef şehri ve tamamlamaya gerekli eylemler sözleşmenin içinde kayıtlıdır; sahte şehir, grup veya savaş olayı üretilmez.

| Gerçek komşu şehir koşulu | Görev | Yardım edilen şehirde sonuç |
|---|---|---|
| Buğday stokunun 10 altına inmesi | Hedef şehrin gerçek pazarına toplam 6 buğday sat | Güvenlik +3; oradaki en fazla 3 mevcut named önemli sakinin memnuniyeti +2 |
| Güvenliğin 40 altına inmesi | Gerçek şehre git, ardından kaynak şehre geri dön | Hedef güvenliği +5; oradaki en fazla 3 mevcut named önemli sakinin memnuniyeti +2 |

Kıtlık ve güvenlik aynı anda varsa erzak krizi önceliklidir. Şehirler gerçek harita koordinatlarına göre mesafelenir; yalnız var olan şehirler seçilir. Güvenlik ve memnuniyet 0–100 arasında tutulur.

Görevler mevcut `CITY_VISITED` ve buğday satışından doğan `DELIVERED` olaylarını kullanır. Oyuncu görevi kabul etmeden ilerlemez; yanlış şehir ve yanlış ürün sonuç doğurmaz. Tamamlama mevcut kontrat teslimi ve altın/itibar ödülü üzerinden ilerler. `completedRegionalAid` görevin ödülünü bir kez alınabilir yapar; aynı kimlik save/load sonrasında tekrar teslim edilemez. Mevcut `playerParty` kayıt sistemi kullanılır.

## Test ve kapsam sınırları

Vitest: yalnız gerçek yakın kriz, kıtlık ve asayiş önceliği, doğru hedefe kısmi buğday teslimi, zorunlu gidiş/dönüş sırası, yanlış şehir/ürün olayları, kayıttan devam, tek ödül, kriz olmadığı veya ikinci şehir bulunmadığı durumda boş teklif.

V1.62 genel test ve Chromium smoke PASS olmadan tamamlanmış kabul edilmez. Daha geniş nüfus hareketleri, tüccar ağları veya siyasal ittifak yetkileri bu aşamada oluşturulmadı.
