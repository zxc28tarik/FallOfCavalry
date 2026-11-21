# WEB V1.52 — Şehir Meclisi ve Önemli Karakterlerin Tepkileri

Tarih: 2026-11-22  
Kapsam: WEB taslak PR #68; main ve Unity değiştirilmez.

## Oynanabilir içerik
Şehirde meclis kararından önce oyuncu önemli karakterlerin memnuniyet tepkisini görebilir. Aynı karar uygulandığında gerçek şehirde yaşayan, hayatta olan **named** kişilerin memnuniyet değeri değişir; mevcut NamedCharacterState mekanizması yoluyla gerekçe ve gün ile kişi geçmişine yazılır. Oyun kaydı, mevcut worldCharacters delta formatını kullanır. Yeni, paralel bir NPC kayıt sistemi yoktur.

| Meclis kararı | İdareci | Komutan | Tüccar | Zanaatkâr | Bilgin | Yolcu |
|---|---:|---:|---:|---:|---:|---:|
| Mahalle Nöbeti | +2 | +3 | +1 | +1 | 0 | +1 |
| İmarete Erzak | +2 | 0 | +2 | +3 | +2 | +2 |
| Olağanüstü Vergi | −1 | 0 | −3 | −4 | −2 | −2 |

Bunlar V1.52 için yazılmış açık, deterministik oyun tasarım kurallarıdır; tarihsel gerçeklik veya evrensel davranış modeli olarak sunulmaz. İleride dengelenebilir.

## Sınırlar ve kabul şartları
- Sıradan generated kişiler named sınıfına yükseltilmez; savaş statüsü ve yetki verilmez.
- Oyuncunun aldığı **başarılı** günlük karar dışında hiçbir ekran açılışı veya ön izleme NPC durumunu değiştirmez.
- Sadece karar alınan şehirde bulunan, hayattaki, geçerli named karakterler etkilenir; başka şehirlerin insanları etkilenmez.
- Memnuniyet 0–100 içinde kalır; geçerli gün, izinli özellik ve sebep şartları mevcut NamedCharacterState API'si tarafından korunur.
- Karar günü yeniden verilmediği için aynı olaydan ikinci kez etki/ödül üretilmez.
- Karakter ekranında mevcut toplumsal durum ve geçmiş bölümleri güncel değer ve gerekçeyi gösterir.
- Oyun kaydetme ve geri yükleme mevcut seeded-delta / packed roster mekanizmasına bağlıdır.

## Doğrulama
Yeni birim testi, salt-okunur önizleme, rol bazlı fark, diğer şehirleri ve sıradan NPC'leri hariç tutma, geçersiz olay, sınır değerleri, JSON dönüşü ve NPC geçmişini sınar. Tam web validation ve Chromium testleri en son committe başarılı olmadan paket PASS olarak ilan edilmez.

## Sonraki büyük oyun içeriği
Kişisel ilişki ve görev zincirlerinin yeni karakter tepkileriyle birleşmesi; yerel seçkinler, tüccarlar ve halk taleplerinin şehir/politika kararlarını etkileyen sürdürülebilir oyun mekanikleri. Henüz uygulanmış sayılmaz.
