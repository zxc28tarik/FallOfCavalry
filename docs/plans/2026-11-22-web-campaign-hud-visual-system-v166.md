# WEB V1.66 — Kampanya Arayüzü Ortak Görsel Kimlik

2026-11-22. Uygulama web taslak PR #68 `codex/web-world-npc-roster-20261118` dalında yapılır. Unity ve `main` etkilenmez.

## Tasarım yönü
1650 tarihî strateji oyununun ekranlarında eski çok katmanlı parlak altın çerçeveler yerine **mürekkep laciverti**, **oksitli bronz**, **fildişi** metin ve **ince askerî harita çizgileri** kullanılır. Farklı modal, menü, şehir, harita ve savaş panellerine ortak malzeme ve tipografi uygulanır. Yeni telifli/sahte görsel ya da ağdan yüklenen resim gerekmez. Mevcut Cinzel başlık / Crimson Text metin fontları korunur.

## Uygulananlar
- Açılış menüsü: hiyerarşik tarihî üst başlık, oyun kimliği ve kısa alt açıklama; tek tip işlevsel butonlar.
- Dünya HUD: önceki `TEMP HIDE` konumundan çıkarılan, üst solda daha kompakt sefer defteri; Sancak, Altın, Ordu, Şöhret ve Gün alanları aynı DOM ID'leriyle gerçek veriyi gösterir. Görev paneli alt solda görünür.
- Sefer araçları: ayrı açılıp kapanan gerçek çekmece; açık/kapalı ARIA durumu, kapat düğmesi, ESC ve dışarı tıklama ile kapatma. Eski kayıt, kontrol ve ayar ID'leri korunur.
- Şehir: aynı malzeme, ince bölümlendirme, servis çipleri, kartlar, günlük karar satırları, güçlü fiyat/işlem kontrastı. Mekanikler değişmez.
- Savaş: daha tutarlı komuta kartı, hız/seçim düğmeleri ve Deploy bölgesi.
- Modal, harita, yardımcı paneller ve tooltip: aynı çerçeve, koyuluk, vurgular, odak kontrastı.
- 1180 / 800 / 520 piksel kırılımları, klavye odak göstergeleri ve reduced-motion tercihi.

`css/ui-theme-v166.css` eski `css/styles.css` ardından yüklenir; orijinal CSS ve tüm oyun mantığı bozulmadan override edilir.

## Kapılar ve kapsam
Yeni DOM kimlikleri dışında eski HUD ID'leri değiştirilmez. Görünüm bileşenleri gerçek state üzerinde çalışır; placeholder görseller eklenmez. Ekranı bütünüyle tarayıcıda elle dolaşmaya eşdeğer, otomatik Chromium smoke sadece yükleme/oyun akışını doğrular; tasarımın estetik onayı için daha sonra gerçek ekran görüntüsü incelemesi gerekir.

Testler: tema son yüklenme, birincil DOM ID'lerinin korunması, araç çekmecesi davranış bağlantıları, menü/şehir/savaş ortak stilleri ve responsive/reduced-motion. `Web validation` ve `Web Chromium browser smoke` PASS olmadan bitmiş denmez.
