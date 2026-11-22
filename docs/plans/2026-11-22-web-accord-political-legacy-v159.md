# WEB V1.59 — Uzlaşmanın uzun vadeli şehir siyasetine etkisi

Tarih: 2026-11-22. Yalnız web PR #68 dalında; Unity ve main korunur.

## Oynanabilir içerik
V1.58'de iki gerçek önemli kişinin uzlaşma zincirini başarıyla bitiren oyuncunun kararı artık sonraki şehir meclisi kararlarını da etkiler. Görev ödülünün alınması sırasında mevcut oyuncu kontrat defterine bağlı, küçük bir `accordLegacies` kaydı eklenir: kaynak şehir, oyun günü, iki gerçek kişi ve uzlaşma kimliği. Mevcut `playerParty` save/load verisi korunur ve bu kayıt onun içinde saklanır.

Uzlaşma mirası **tamamlandığı gün ve sonraki 14 gün** etkilidir. Ancak yalnız aynı şehirde hayatta bulunan iki named karakter arasındaki kayıtlı ilişki sıfır veya üstündeyse fayda sağlar. İlişki bozulursa, taraflardan biri ölür veya şehirden ayrılırsa siyasi işbirliği kendiliğinden askıya alınır; geçmiş kaydı silinmez.

- **Mahalle Nöbeti:** normal 120 yerine 100 altın.
- **İmarete Erzak:** normal 90 yerine 70 altın.
- **Olağanüstü Vergi:** kazanılan altın aynı kalır, fakat şehir güvenliği normalde −9 yerine −12 azalır.
- Bu kurallar günlük karar kapısını, altın muhasebesini ve karakterlerin V1.52 tepkilerini korur. Tek günlük karar hakkı aynıdır.
- Meclis ekranında indirim, vergi tepkisi ve mirasın kalan günleri görünür; arka plandaki fiyatla UI fiyatı aynıdır.

Bu, geçmişteki uzlaşmanın oyun içi siyasi-ekonomik etkisini 14 gün boyunca yaşatır. Yeni gruplar, tarihsel makamlar, NPC'ler veya gerçek olmayan olaylar üretilmez.

## Emniyet
Yalnız gerçekten teslim edilen önceki anlaşmazlık görevi ve V1.58 uzlaşma ID'si eşleşirse miras geçerlidir. Çifte kayıt ve yeniden ödül engellenir; kayıt sayısı 64 ile sınırlıdır. İki kişinin aynı şehirde olması ve birbirleriyle gerçek ilişkileri devam etmesi aranır. Ek bir dünya karakter sistemi veya ayrı bir kayıt motoru kurulmaz.

## Doğrulama
Vitest: gerçek kontrat kaynağı, maliyet indirimi, ek vergi zararı, günlük sınır, 14 günlük süre, ölüm/taşınma/negatif ilişki, kayıt dönüşü ve sahte başarı kayıtları. Son HEAD üzerinde Web validation ve Chromium smoke PASS gelmeden tamamlandı ilan edilmez.
