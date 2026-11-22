# WEB V1.57 — Anlaşmazlık sonrası şehir görevleri

Tarih: 2026-11-22. Kapsam yalnız WEB taslak PR #68; Unity ve main korunur.

## Oynanabilir içerik
V1.56'da gerçekten sonuçlandırılmış bir şehir anlaşmazlığı artık karakter geçmişine **seçim ve asıl neden** ile kaydedilir. Bir sonraki gün, gerçek şehir hanındaki kontrat panosunda buna bağlı tek bir `DISPUTE_REMEDY` işi sunulabilir.

| Kaydedilen anlaşmazlık | Gerçek oyun eylemi | Görev sonrası ilave etki |
|---|---|---|
| Mahalle Asayişi | Başka şehrin nöbetini denetle ve geri dön | Kaynak şehir +5 güvenlik |
| Erzak Paylaşımı | Kaynak şehrin gerçek pazarına 8 buğday sat | Kaynak şehir +4 güvenlik, buğday fiyat çarpanı −0.04 |
| Pazar İmtiyazı | Başka şehre gidip geri dön | Kaynak şehir +2 güvenlik, buğday fiyat çarpanı −0.04 |
| Şehir Meclisi Kararları | Başka şehrin usullerini araştırıp geri dön | Kaynak şehir +3 güvenlik |

Görevlerin dayanağı mevcut `worldCharacters` karakter geçmişidir; bugünkü şehrin durumuna bakıp geçmiş olay uydurulmaz. Meslekler, NPC kimlikleri, şehirler ve market alanları olduğu gibi korunur. Seyahat şehir girişinin gerçek `CITY_VISITED`, erzak teslimi gerçek `DELIVERED` olayıyla ilerler.

Oyuncu görevi kabul etmeden ilerleme yoktur. Sıralı ziyaretler ve kısmi erzak satışları oyuncunun halihazırdaki kontratlarında saklanır; ödül ve şehir iyileşmesi yalnız tamamlandıktan sonra tek defa talep edilebilir. Eski tekliflere ek olarak açılır, diğer görev türlerini silmez.

Yeni pazar mekanizması veya paralel save sistemi kurulmaz; güvenlik `settlementsCivic`, buğday çarpanı mevcut şehir pazarı kaydı üzerinden saklanır.

## Doğrulama
Yeni testler dört neden, yanlış şehir/ürün, sıra koşulu, ertesi gün şartı, kayıt sonrası kaldığı yerden devam, ödülün bir kez verilmesi ve tek şehirli haritada hayali rota üretilmemesini denetler.

Son committe genel Web validation ile Chromium smoke PASS olmadan tamamlandı denmez.

## Gelecek içerik
Görevleri tek aşamalı olmaktan çıkarıp kişisel ilişkiler ve şehrin çıkar gruplarıyla bütünleşen çok aşamalı karar zincirlerine bağlamak.
