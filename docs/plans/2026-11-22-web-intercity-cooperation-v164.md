# WEB V1.64 — Şehirler Arası Gerçek Ticari İşbirliği

22 Kasım 2026. Yalnız web taslak PR #68; `main` ve Unity korunur.

V1.62 gerçek bölgesel yardım ve V1.63 ertesi gün takip görevi başarıyla teslim edilirse kaynak ve hedef şehirden mevcut **named merchant/artisan** karakterler arasından uygun ikili seçilir. İkisi de gerçek yerleşimlerde, canlı ve uygun meslekte değilse ilişki / yeni görev / avantaj oluşmaz. Önceki iki görevin oyuncunun ödül defterinde bulunması zorunludur. Bu ikili arasında mevcut dünya karakter ilişkisi **+10** artar; normal `worldCharacters.relations` save mekanizmasına yazılır. Yeni örgüt, meslek, NPC veya sahte anlaşma olayı üretilmez.

İlgili iki karakter iki gerçek şehirde görevde ve aralarındaki ilişki negatif değilse 10 oyun günü boyunca **her iki şehirde yalnız buğday satışına +%3** geçici prim uygulanır. V1.60 yerel uzlaşma primiyle toplanır, toplam ek prim %11'i geçmez; alış fiyatı, diğer ürünler ve kalıcı dünya piyasa stokları değişmez. Pazarın gösterdiği satış fiyatıyla fiilen yapılan satış fiyatı aynıdır.

İşbirliğinin ertesi günü kaynak şehrin kontrat panosunda `INTERCITY_TRADE` açılır:
1. Diğer gerçek şehri ziyaret et.
2. O şehrin gerçek pazarına 5 buğday sat (kısmi teslimatlar kaydedilir).
3. Kaynak şehre dön.

Görev tamamlanınca hedef şehir güvenliği +3; ilişkili iki hayattaki gerçek önemli karakterin memnuniyeti +2. Ödül yalnız bir kez; `completedIntercityTrade` ve `regionalCooperation` var olan playerParty kaydıyla saklanır. 10 günlük süre dolunca, ikiliden biri ölür/taşınırsa veya ilişki negatif olursa prim biter.

Test: gerçek iki şehir/ikili, kayıt sonrası geri yükleme, 10 gün, negatif ilişki/ölüm/taşınma, başka şehir ve alış işlemlerinde primin olmaması, artan ilişki, gerçek aşamalı görev, eksik/yanlış teslimat ve ödül tekrarı. Genel Web validation ve Chromium smoke PASS olmadan bitmiş sayılmaz.
