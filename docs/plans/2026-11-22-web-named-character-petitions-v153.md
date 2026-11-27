# WEB V1.53 — Önemli karakterlerin kişisel dilekçeleri

Tarih: 2026-11-22. Yalnız WEB taslak PR #68 dalı; Unity ve main değiştirilmez.

## Oynanabilir içerik
Şehirde bulunan hayattaki **named** karakterler, mevcut kimlikleri ve mesleklerine göre oyuncuya bireysel dilekçe sunar. Karakter profili üzerinden iki sonuçlu bir seçim yapılır:

- **Destekle:** karaktere özgü miktarda oyuncunun gerçek hazinesinden altın düşer, aynı kişinin memnuniyeti artar.
- **Reddet:** altın ödenmez ancak kişinin memnuniyeti düşer.

Altı karakter rolü için konu ve maliyet farklıdır: zanaatkâr tezgâhı, tüccar kervan kefaleti, idareci defter-mühür gideri, askerî deneyimli garnizon ikmali, yolcu han desteği, bilgin medrese kitabı. Bu işlemler karaktere resmî makam, askerî rütbe, paralı asker ya da yeni görev türü vermez.

Bir kişi aynı gün bir dilekçeye yalnız bir yanıt alır. Cevap, NamedCharacterState API'sindeki `satisfaction` değişimine ve açıklamalı mevcut karakter geçmişine işlenir. Mevcut worldCharacters kayıt mekanizması ile yüklenir; farklı şehirlerdeki kişiler etkilenmez. 0–100 sınırlarına uyulur. Günlük meclis kararlarının V1.52 tepkileri ayrı kalır.

## Doğrulama kapıları
- Altı role göre önerilerin farklı olması
- Ekran önizlemesinin değişiklik yapmaması
- Destekle seçiminin gerçek altın tüketmesi, yetersiz bakiyede reddedilmesi
- Ret seçiminin gerçek memnuniyet etkisi üretmesi
- Aynı gün tekrar yanıttan ödül/tekrar etki olmaması
- Karakter ve şehir kimliği doğrulama
- Kayıttan sonra karakter durumunun ve yanıt geçmişinin korunması
- Tam web validation ve Chromium PASS gelmeden sürümü tamamlandı ilan etmeme

## Sıradaki genişletme
Karakter taleplerini şehirli gruplar ve karakter-özel görev zincirleriyle birleştirip oyuncunun ilişkilerinin fırsat ve siyasi kararlara yansımasını sağlamak.
