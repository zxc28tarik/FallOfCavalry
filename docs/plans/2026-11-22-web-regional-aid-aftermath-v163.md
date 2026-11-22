# WEB V1.63 — Bölgesel Yardımların Siyasi Mirası ve Takip Görevleri

Tarih: 2026-11-22. Yalnız taslak PR #68 web dalında; `main` ve Unity korunur.

## Oynanabilir değişiklikler
V1.62'de gerçekten gerçekleştirilen ve ödülü **teslim edilmiş** bir komşu şehir yardımının sonucu artık oyuncu kayıtlarında, kaynak ve hedef yerleşim kimliği, yardım türü ve tamamlanma günüyle tutulur. Bu bilgi `playerParty.regionalAidOutcomes` alanında en fazla 64 somut olay kaydıdır; hayali siyasal teşkilatlar, yeni şehirler veya NPC kimlikleri doğurmaz.

### 7 günlük etkiler
Yalnız gerçek yardımın ulaştığı **hedef şehirde** tamamlanma günü ve takip eden 7 gün geçerlidir:
- Erzak yardımı: İmarete Erzak meclis kararı 90 yerine 80 altın.
- Asayiş yardımı: Mahalle Nöbeti meclis kararı 120 yerine 110 altın.
- Olağanüstü vergi değişmez. Önceki gerçek uzlaşma mirasının indirimi varsa meclis fiyatları birlikte hesaplanır.
- Şehrin mevcut tek karar/gün sınırı, mevcut güvenlik ve memnuniyet etkileri ve karakter karar tepkileri korunur.

Meclis ekranında uygun şehirde kalan süre ve hangi kararın ucuzladığı gösterilir. Etki hesaplaması oyunun asıl `applyCivicDecision` yolundadır; yalnız görüntü değildir.

### Ertesi günün ikinci bölüm görevi
Yardımın **ertesi günü** yardım edilen şehrin mevcut kontrat panosunda, ilk yardımın kimliğine bağlı bir `REGIONAL_RECOVERY` takip görevi görünür:
- Erzak: Yardım eden kaynak şehre gerçek `CITY_VISITED` ziyareti, ardından yardım alan hedef şehrin pazarında toplam 4 gerçek buğday satışı.
- Asayiş: Kaynak şehre gerçek ziyaret, ardından yardım alan hedef şehre dönüş.
- Kısmi buğday teslimatları mevcut kabul edilmiş kontratta saklanır, aşamalar sırayla geçilir. Yanlış şehir veya yanlış ürünle ilerleme olmaz.

Görev teslim edildiğinde gerçek hedef şehrin güvenliğine erzakta +3, asayişte +4 eklenir; orada hayatta olan en fazla iki mevcut önemli sakinin memnuniyeti +2 artar. Gerçek kaynak yerleşim veya önceki teslim edilmiş yardım yoksa ikinci bölüm üretilmez.

### Kayıt, geri uyumluluk ve testler
`completedRegionalAid`, `regionalAidOutcomes`, `completedRegionalRecovery` mevcut oyuncu kayıt alanlarında saklanır. Yeni görevler önceki altı temel kontratı, V1.62 yardım görevini veya diğer görev hatlarını kaldırmaz. Her takip görevi tek kez ödüllendirilebilir ve kayıttan sonra tekrar kabul edilemez.

Vitest: kayıtlı gerçek ödül kaynağı, hedef şehirden bağımsız kaynak kontrolü, 7 gün penceresi, meclis indirimlerinin doğru uygulanması, görev açılma günü, sıralı gerçek seyahat ve buğday teslimi, kayıttan devam, mükerrer ödülün engellenmesi ve olmayan şehirde görev açılmaması.

Son HEAD üzerinde genel web validation ve Chromium smoke doğrulanmadan V1.63 tamamlanmış ilan edilmez.
