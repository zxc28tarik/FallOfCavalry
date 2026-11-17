# FOC WEB — SIFIRDAN 2D GÖRSEL KATALOĞU VE ÜRETİM SIRASI

Bu liste **nihai sayıların garanti edildiği sipariş fişi değil**, görsel aile bazında üretim ve tekrar kullanım kataloğudur. Gerçek varlık adetleri G01/G02 pilotlarından ve projedeki mevcut yerleşim/şehir tiplerinden çıkarılarak sabitlenir.

## 1. Üç görsel bağlam

1. **Dünya haritası:** Büyük ölçekli 1995×1504 1648 haritası için tekrar kullanılabilir terrain/decal/prop, world settlement, POI icon.
2. **Yerleşim/şehir sahnesi:** Town, village, capital için bir base kompozisyonu ve kurallı overlay katmanları; dünya ikonlarından bağımsız.
3. **Savaş zemini ve arayüz:** Soldier sprite hariç zemin, arkaplan ve kullanıcıya sinyal veren UI ve efektler.

## 2. Önceliklendirilmiş varlık aileleri

| Üretim sırası | Kategori | Ana 2D setler | Entegrasyon özeti | Gerekli faz |
|---|---|---|---|---|
| 0 | Sanat referansları | Dört stil kartı, tek light/color swatch, perspektif rehberi | Oyun asseti değildir | G02 |
| 1 | Zemin / ana | Çim, toprak, tarla, taş, kurak, çamur | Terrain texture, tile mask | G04 |
| 2 | Zemin / geçiş | Çim–toprak, su–kıyı, yol–zemin, iç/dış köşeler | Neighbor transition atlas | G04 |
| 3 | Dünya su | Deniz/nehir yüzeyi ve bank, sığlık, kıyı | Terrain masks + path layer | G04/G06 |
| 4 | Ağaç | Yapraklı, ibreli, küçük/orta/büyük | Foreground pivot, anchor | G05 |
| 5 | Bitki/dekor | Çalı, kısa ot, taş, kaya, dağ çevresi | Low detail deciduous placement | G05 |
| 6 | Yol/bağ | Ana yol, patika, taş yol, köprü, geçit | Road/river polylines | G06 |
| 7 | Harita işaretleri | Faction border/fog, mouse target, POI/quest symbols | Overlays/HUD | G06 |
| 8 | Yerleşim dünya icon | Köy, kasaba, kent, başkent, hisar, kale | Tier/theme/owner atlas | G07 |
| 9 | Köy sahneleri | Yol, tarla, avlu base; fakir/orta/zengin ev | Small-scene manifest | G08 |
| 10 | Köy üretim | Fırın, ahır, ambar, tarla, ağaç, küçük pazar | Role/state placement | G08 |
| 11 | Osmanlı şehir base | Zemin/şehir planı/surlar/ufuk; değişken binalar yok | City stage base | G09 |
| 12 | Osmanlı iç kale | Sur kapısı, saray, kadılık, cami, medrese, defterhane, reisülküttab, bostancılar | Fixed core | G09 |
| 13 | Ticaret | Pazar, Bedesten, Lonca Konağı, Gümrük | Trade area overlay | G09 |
| 14 | Hanlar | Han, Tüccar Hanı, Kervansaray | Caravan area overlay | G09 |
| 15 | Konut | Fakir, orta, zengin, üst zümre ev/konak mahalleleri | Housing area overlay | G09 |
| 16 | Sağlık | Darüşşifa, Büyük Hamam, Eczane | Health area overlay | G09 |
| 17 | Üretim | Tabakhane, demirci, marangoz, dokuma, boyahane, sabunhane, kâğıt, mumhane, taş ustası, nalbant | Production area overlay | G09 |
| 18 | Gıda | Fırın, Değirmen, Ambar, Kasaphane, Balıkhane | Food area overlay | G09 |
| 19 | Kültür | At Meydanı, Panayır, Anıtsal/Kamusal yapı | Culture overlay | G09 |
| 20 | Özel kale | Hisar, sınır kalesi, büyük fort, sur parçası, köşe, kapı | Fort render and map icon independent | G10 |
| 21 | HRE | Ahşap/taş ev, gotik çatı, kule, meydan, kale motifleri | City scene theme | G11 |
| 22 | Venedik | Taş/su kenarı yapı, çatı, han/pazar, meydan | City scene theme | G11 |
| 23 | Polonya | Ahşap/taş konut, kale, han, kırsal yapılar | City scene theme | G11 |
| 24 | İspanya | Sıva/taş, kiremit, kapı/kule, meydan | City scene theme | G11 |
| 25 | Savaş zemin ve dekor | Arena zemin, kaya, çit/siper, toz, çevre | Battle bg; soldiers remain old placeholder | G12 |
| 26 | UI | Start, HUD, paneller, tooltipler, ikonlar, yükleme | Canvas/DOM | G12 |
| 27 | VFX | Duman, ateş, sis, basit UI/ortam parçacıkları | Selectively enabled; performance-gated | G12 |
| **SON** | **Asker** | **2D karakter/gövde/ekipman/animasyon atlasları** | **Ayrı onay** | **G14** |

## 3. İlk kullanıcıdan isteyeceğimiz somut 2D üretim partisi

**Henüz hemen üretim komutu değildir.** G02 stil + G03 dummy pipeline PASS olduktan sonra teslim listesi açılır.

### Parti A — Zemin pilotu
- `grass_base` (ana çim); `grass_alt_01` ve `grass_alt_02` (yalnız ton/lekelenme farkı).
- `soil_path` (toprak); `rock_dry` (taşlı) ve `water_bank` (kıyı).
- Çim–toprak bağlantısı için **dört kenar, dört dış köşe, dört iç köşe** örnekleri veya mask sisteminin gerektirdiği temel dokular.
- Görseller tek başına değil, **20×20 döşeme testi** çıktısıyla sunulur.

### Parti B — Doğa pilotu
- Yapraklı ağaç küçük/orta/büyük; iğne yapraklı iki boy; iki kaya; iki çalı.
- Her görselde **zemine temas noktası ve şeffaf alpha** kontrol edilir.
- Bir kurulu harita ekranında farklı uzaklıklarda tekrar edilerek değerlendirilir.

### Parti C — Dünya yerleşim pilotu
- `village`, `town`, `fort` için aynı aileden üç 2D dünya ikonu.
- Sadece ikon üretimi; **köy içi sahne henüz yok**.
- En az 0.5 ve 1.0 zoomda sınıflar ayırt edilir.

### Parti D — Osmanlı şehir konsepti pilotu
- Bir şehir **base scene** (zemin/yol/arka plan, bina yerleştirme alanları boş).
- Tek `trade_area` alanı üzerinde Pazar ve Bedesten için **iki ayrı şeffaf overlay**.
- Aynı sahnede `empty` → `low` → `half` gibi en az üç durum screenshot kontrolü.
- Bu pilot geometrik olarak kilitlenmeden İstanbul'un bütün binaları çizilmez.

## 4. Eski çizimlerin akıbeti

Eski çim, ağaç, şehir ikonu, Stronghold benzeri sanat **runtime legacy fallback / kıyas referansı** olabilir. **Yeni nihai görsel kütüphanesine otomatik taşınmaz.** Kullanıcı direkt 2D üretim yoluyla değiştirir ve her kategoride eski görsele karşı kıyas yapılır. Görsel dosya değişimi, gameplay state'i veya 1648 harita katmanını temizleme gerekçesi değildir.

## 5. İstanbul ve diğer şehirlerde tekrarı nasıl önlüyoruz?

- **Sabit** İç Kale: İstanbul için özel ayrıntı; büyük şehirlerde farklı ölçek/temalar için bağlı varyant.
- **Değişken** alan: Bölge/bina bazlı şeffaf overlayler. Bir bina yalnız bir kez çizilse bile farklı şehirde kullanımı için `scale/pivot/area-relative position` manifestte tanımlanır.
- **Boş/az/yarı/tam dolu:** Tek tek dört tam şehir resmi çizmek zorunlu değildir; temel set + değişen alan overlayleri daha sürdürülebilir.
- **Köy varyantı:** Bir köy sahnesi her seferinde sıfırdan üretilmez; sınıf, ekonomi rolü, zenginlik ve ortamın gerçek veri durumuna bağlı modüler set kombinasyonları kullanılır.
- **Diğer fraksiyon:** Yerleşim şemasını korurken mimari 2D dili yerel malzeme ve çatı/siluetlerle yeniden oluşturulur.

## 6. Bilinçli kapsam dışı / karar gerektirenler

- Askerî şehir alanı etkinleştirme, donanma/liman gameplay'i ekleme.
- Günlük/mevsimlik hava efektlerini tekrar açma.
- Köy içi ayrı ekranı yoksa yeni gameplay mode inşa etme.
- Tüm 19 fraksiyon için ayrı tam şehir sahnesi yaratma; şimdilik beş mevcut şehir theme otoritesi var.
- Final tüm sayısal asset adetleri (kaç ev/kaç ağaç varyantı) pilot kalite ve gerçek CPU/GPU ölçümlerinden sonra kilitlenecek.