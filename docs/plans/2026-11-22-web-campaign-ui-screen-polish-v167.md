# V1.67 — Gerçek Chromium Ekranlarından HUD ve Şehir Okunabilirlik İyileştirmesi

Tarih: 2026-11-22. Yalnız web PR #68; Unity ve main korunur.

## Görsel kanıt ve sorunlar
V1.66 Chromium raporunda `screenshots/02-runtime-world.png`, 1366×768 sahne: üst soldaki bilgi paneli yaklaşık 590 px genişliğinde, çok yüksek; hem özet hem İngilizce ayrıntı satırı aynı bilgiyi gösteriyor. Sancak adı kesiliyor; görev kartı kısmen başka HUD elemanları tarafından gölgeleniyor.

`screenshots/04-npc-character-sheet.png`, şehir ekranı: üretim, sağlık, meydan vb alanların uzun etiketleri komşu yapı parsellerine taşıyor; sabit konumlu `Mal Hareketleri` düğmesi şehir servislerinin üstüne biniyor.

## Uygulama
- `hudStats` gerçek verisi silinmeden, varsayılan kapalı yerleşik `details/summary` içine taşındı. Kullanıcı klavye ile açıp kapatabilir; özet altın, ordu, şöhret, sancak ve gün bilgileri açık kalır.
- HUD üst kartı daraltıldı ve boşlukları sıkıştırıldı; sancak adı iki satırda okunabilir; görev kartı daha düşük ve kompakt hale geldi.
- Şehrin gerçek `city-scene-hotspot` butonları korunur. Uzun adlar kutu içinde en çok iki satır gösterilir; tam ad `title` özniteliğinde kalır. Hover/selected katmanları belirginleştirildi.
- Şehir servisleri erişilebilir şekilde kaydırılabilir kalır, aşağı sıkışması azaltıldı.
- Debug/rapor amaçlı sabit `Mal Hareketleri` düğmesi şehir ve savaş ekranları açıkken CSS ile görünmez; dünya haritasında yine kullanılabilir.
- 800/520 piksel ekran uyarlamaları, V1.66 görsel kimliği ve oyun mekaniği korunur.

Bu değişiklikler yalnız `css/ui-polish-v167.css` dosyasında ve `index.html` içindeki HUD ayrıntı sarmalayıcısında bulunur. Eski stillerin üstüne yüklenir, mekanikleri ve canlı sayaç kimliklerini değiştirmez.

## Doğrulama
Yeni Vitest testleri; CSS yükleme sırası, eski canlı sayaç ID'leri, yerleşik detay paneli, gerçek şehir etiketleri ve sabit rapor düğmesinin engellenmesini denetler. CI Web validation ve Chromium browser smoke testlerinin tamamlanması gerekir. Estetik sonuç gerçek ekran görüntülerinden ayrıca gözden geçirilmelidir.
