# WEB V1.48 — Şehir İşleri ve Sivil Görev Paketi

**Tarih:** 2026-11-21  
**Kapsam:** WEB oyunu, PR #68 taslak dalı; Unity ve main değiştirilmez.

## Ürün kararı
Kullanıcı isteği doğrultusunda yeni öncelik oyun içeriğidir. V1.47 gözlem/stres çalışmaları tamamlanana kadar performans optimizasyonu bu paketin amacı değildir. Oyun deneyimini bozmadan tek pakette birden çok oynanabilir görev eklenir.

## Oynanabilir içerik
- Şehir hanındaki kontrat panosu üç yerine beş teklif gösterir: mevcut üç iş + şehirler arası **Mühürlü Ferman** ve **Halka Erzak Yardımı**.
- **Mühürlü Ferman:** Gerçek başlangıç şehrinden farklı gerçek hedef şehre gidilir. Yalnız hedefteki gerçek şehir hizmetine giriş `CITY_VISITED` olayıyla görevi tamamlar. Haritaya sahte şehir veya doğrudan tamamlanma olayı eklenmez.
- **Halka Erzak Yardımı:** Düşük güvenlikli gerçek şehir havuzundan seçilen hedefe buğday götürülür. Yalnız başarılı buğday satışı mevcut `DELIVERED` olayıyla ilerleme sağlar. Tekil ödül teslimi, hedef şehrin güvenliğini +3 artırır (en fazla 100).
- Savaş dönemi DEFEND/ASSASSINATE seçimi korunur; sivil işler savaşta da sunulur.
- Kontrat kabulü ve ödül teslimi otomatik kayda bağlanır; görev durumu mevcut SaveManager oyuncu kontratlarında taşınır.
- Önceki BANDIT / SCOUT / ESCORT görev türleri ve ödül mekanikleri korunur.

## Doğrulama kapıları
1. Unit: beş tür, gerçek şehir ID'leri ve 0 ID, doğru şehir ziyaret edilmeden ferman tamamlanmaması.
2. Unit: erzak tesliminin doğru mal ve hedef şehir şartı; JSON save/restore progress; tek seferlik ödül ve şehir güvenliği etkisi.
3. Unit: savaş halinde askeri ve sivil görevlerin aynı panoda bulunması.
4. Lint / tam Vitest / production build / Chromium PASS. Güncel commit test sonuçları gelmeden tamamlandı yazılmaz.

## Sonraki büyük içerik paketi
İkinci etap: şehirler arası kervan ticareti, bölgesel siyasi istekler, önemli karakterlerden özgün görev zincirleri ve savaş/şehir sonuçlarına bağlanan yaşayan dünya haberleri. Bu maddeler henüz V1.48 kodu kapsamında tamamlanmış sayılmaz.
