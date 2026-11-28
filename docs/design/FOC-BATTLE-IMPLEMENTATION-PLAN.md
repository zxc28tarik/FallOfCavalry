# Fall of Cavalry — KISS uygulama planı (IMP-01–15)
28 Kasım 2026. Ana envanter 247 kayıt, aşama 2 ve KISS karar taslakları korunur. Kullanıcı devam etti. Görsel konseptlerin çelişen unsurları (kalıcı sayaçlar, birlik üstü simgeler/çubuklar, büyük sürekli konsol) kabul edilmez. Asker/at modelleri, animasyon ve malzeme geliştirmeleri dondurulmuştur. Çalışma dalı codex/foc-mesh12-face-anatomy-20261127; main'e otomatik merge yok. Her adımda ilgili davranış ve regresyon testleri, commit ve gerçek sonuç kaydı. Başarısız/bekleyen test tamam sayılmaz.

| ID | İş | Doğrulama kapısı |
|---|---|---|
| IMP-01 | Eski HUD ile yeni canlı HUD altyapısını ayır | Sayaç yok, tek canlı durum yazıcısı, buton çift dispatch yok, geçiş ve geçici konsol |
| IMP-02 | Grup seçimi ve çoklu seçim | GroupId, yaşayan/yetkili, sektör, kutu/ekle/çıkar, kontrol grubu |
| IMP-03 | Emir motoru | Hareket/ateş/target/plan ayrımı, gerçek kabul, iptal, güvenli çekilme, seçilen rakip |
| IMP-04 | Diziliş motoru | Tek slot hesabı, farklı gerçek geometri, hareket ve at/piyade aralığı |
| IMP-05 | Sağ tık menüsü | Yalnız Emirler/Dizilişler, uygun seçim, geçici eski konsol kaldırılır |
| IMP-06 | Hedefleme ve zemin | Gerçek hedef, önizleme, iptal, geçersiz gerekçe, geçici işaret |
| IMP-07 | Birlik/arazi bilgisi | Gerçek kaynak, karışık/bilinmeyen durum, isteğe bağlı |
| IMP-08 | Harita | Aç/kapat, geniş görünüm, kamera/keşif, yanlış emir yok |
| IMP-09 | Sektör/strateji | Gerçek yetki, rapor yaşı, manuel öncelik, ortak zaman; açık mekanik kuralları |
| IMP-10 | Bildirim | Gerçek olay, önem, tekrar birleştirme, geçmiş, ses/metin |
| IMP-11 | Hazırlık | Atama, yerleşim, yedek/komutan, hazır kontrolü |
| IMP-12 | Sonuç | Gerçek tüm sektörler, tek sonuç işlemi, kampanya bağlantısı |
| IMP-13 | Kontrol ve ayarlar | Kısayol çakışması, erişilebilirlik, pause, yardım |
| IMP-14 | KISS uygunluğu | 247 ID'nin durum ve sunum izlenebilirliği, reddedilmiş UI geri gelmez |
| IMP-15 | Genel test | Chrome/WebGL, mekanik regresyon, FPS/performans, gerçek oynanış ve kullanıcı değerlendirmesi |

## IMP-01 — ilk kod ve test kaydı
- HTML commit ee16784adaebc1437be34d9ed0d15b6781f6e2b8; önceki blob b09c4ab2d758a15712fb878054c5728030bf7b67, yeni 99e9033c9d5fccc6363040b946a5cadafde3a8c8.
- Kalıcı üst dost/düşman toplam sayaçları ve süre/status şeridi kaldırıldı; küçük duraklatma, geçici Emir kontrolleri, vitrin, geliştirici erişimi. Geçici konsol canlı savaşta varsayılan kapalı; yeni sağ tık menüsü IMP-05'e kadar eski 8+6 düğme erişilebilir. Canlı birim kartı rozeti gizli; render edilen fiziksel sancaklar/model değişmedi. Mini harita henüz değişmedi.
- FOCBattleHUD gerçek canlı motor durumunu salt okunur projekte eder; mevcut eski asker seçimi sözleşmesini kullanır (otoriter grup seçimi IMP-02). Boş seçimde sahte 150/150 ve 300 yok, 14 düğme devre dışı. Karma emir/diziliş karışık, gerçek kabul edilen değer. Eski önizleme yazıcısı ve düğme listener'ları canlı modda erken çıkar; önizleme davranışı korunur. Savaş giriş/dönüş/sonuç ve pause HUD durumları bağlandı. Savaş/slot/AI/model hesapları değiştirilmedi.
- Test script dfb8d377120473107d3f6ce4bbd09a3606f93667; CI 47460d0bf84ca15b875c6e2f68579b9acf67c5ba. Gerçek tarayıcı sonucu henüz doğrulanmadı. IMP-01 kodu kayıtlı; test kapısı açık. Sonraki adım test sonuçlarını değerlendir, gerekiyorsa düzelt, ardından IMP-02.
