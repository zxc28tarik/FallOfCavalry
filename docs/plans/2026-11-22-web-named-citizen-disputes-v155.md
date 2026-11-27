# WEB V1.55 — Önemli Karakterler Arasındaki Şehir Anlaşmazlıkları

Tarih: 2026-11-22
Kapsam: yalnız Fall of Cavalry WEB, `codex/web-world-npc-roster-20261118`, taslak PR #68. Masaüstü Unity ve main değiştirilmez.

## Oynanabilir içerik

Aynı gerçek şehirde yaşayan iki **named**, hayatta ve mevcut memnuniyeti 10–90 olan önemli kişinin anlaşmazlığı şehir genel bakışına eklenir. Görüntülenenler gerçekten kaydedilmiş dünya karakterleridir; uydurulmuş görev vereni, yeni klik, aile veya yetki oluşturulmaz.

Oyuncu üç farklı yoldan birini seçer:

| Seçim | 1. kişi memnuniyeti | 2. kişi memnuniyeti | Aralarındaki ilişki | Altın |
|---|---:|---:|---:|---:|
| İlk kişiyi destekle | +6 | -6 | -8 | 0 |
| İkinci kişiyi destekle | -6 | +6 | -8 | 0 |
| Uzlaşma masrafını karşıla | +3 | +3 | +12 | -60 |

Sonuçlar var olan `changeNamedCharacterMetric` ve `setWorldCharacterRelation` API'lerini kullanır. Mevcut personel geçmişine açık gün/gerekçe ile yazılır; kişiler arası ilişkinin değişen değeri zaten var olan worldCharacters snapshot ve seeded-delta kayıtlarında saklanır.

Kararlar yalnız ilgili şehirde iki uygun önemli karakter varsa görünür. Gün içinde bir defa sonuçlandırılır; tekrar tıklama altın ve etki üretmez. Önizleme salt okunurdur. Memnuniyet ve ilişkiler kendi 0–100 ve -100–100 güvenlik sınırlarında kalır. Mevcut CharacterOrganization görev verme/QuestManager sistemi bu şehir ihtilafının sonucu olarak otomatik değişmez.

## Doğrulama
- Gerçek kişilerin tespiti ve farklı şehir/ordinary NPC elemesi
- Üç farklı sonuç ve altın muhasebesi
- Salt okunur önizleme, tekrar kararı engelleme
- NPC memnuniyet geçmişi ve kişiler arası ilişki kayıt dönüşü
- Yetkisiz/geriye dönük gün değişikliklerinin engellenmesi
- Tam web validation + gerçek Chromium testi

Bu iki CI aşaması son committe PASS olmadan V1.55 tamamlandı ilan edilmez.

## Sonraki içerik hedefi
İki kişinin görev ve çıkarlarında somut anlaşmazlık nedenleri, dünyadaki ekonomi, ticaret, güvenlik ve savaş sonuçlarından doğan daha kapsamlı şehir olayları; bir kararın başka karakterlerdeki etkileri. Bu genişletme henüz uygulanmış sayılmaz.
