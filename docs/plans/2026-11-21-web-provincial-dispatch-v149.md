# WEB V1.49 — Vilayet yazışması ve şehir ihtiyaçları

Tarih: 2026-11-21
Dal: codex/web-world-npc-roster-20261118 | PR #68 DRAFT

## Oynanabilir içerik
- Şehir kontrat panosunda önceki beş işe ek olarak **Vilayetler Arası Mühürlü Yazışma** bulunur: toplam altı teklif (en az üç gerçek şehir olduğu durumda).
- Üç sıralı aşama: birinci gerçek şehre giriş, ikinci farklı gerçek şehre giriş, başlangıç şehrine dönüş. Yol ve şehirler gerçek haritadan seçilir, sahte hedef yoktur.
- Sıra dışı şehir ziyaretleri, aynı durağın tekrarlanması ve henüz kabul edilmemiş görevler ilerleme sağlamaz.
- Aşama dizisi, aşama sayacı ve şehir kimlikleri mevcut oyuncu kontratı üzerinden JSON kaydında kalır.
- Ödül yalnız oyuncunun kontratı tamamlanmışken bir defa talep edilebilir. Tamamlanmış yazışma; iki hedef ve başlangıç şehrinin güvenliğine +1 (en fazla 100) uygular.
- Şehir kontrat panosu, bulunduğu şehrin güvenlik değerine göre bağlamsal durum satırı ve hedef şehrin gerçek güvenlik derecesini gösterir.
- Önceki beş görev (BANDIT/SCOUT/ESCORT veya savaş işleri, COURIER, RELIEF) ve eski savaş/ekonomi sistemi korunur.

## Doğrulama
- Yeni birim testleri: altı özgün iş, iki farklı hedef, doğru durak sırası, yanlış durak, kayıt dönüşü, tek ödül, az şehirli haritada sahte yolculuk olmaması, savaş döneminde sivil içerik.
- Mevcut contracts.smoke.test.mjs altı teklif kuralına güncellendi.
- Tam CI ve Chromium sonuçları en güncel commit üzerinden kontrol edilene kadar V1.49 PASS olarak ilan edilmez.

## Sonraki büyük içerik
Yaşayan şehir olayları: güvenlik, ekonomi ve savaşın gerçek şehirlerde farklı ihtiyaçlar üretmesi; özgün karakterlerin bu ihtiyaçlara taraf olması; sivil görev sonuçlarının diplomasi/şehir ilişkilerine görünür yansıması. Mevcut paketin tamamlandığı anlamına gelmez.

Bu proje WEB içindir; main ve Unity'ye dokunulmaz.
