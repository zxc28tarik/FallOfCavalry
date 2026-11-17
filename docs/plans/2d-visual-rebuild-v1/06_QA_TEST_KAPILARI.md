# FOC WEB — GÖRSEL KALİTE, TEST VE KABUL SİSTEMİ

**Yalnız önceden hazırlanmış bir PNG veya test dosyasının varlığı PASS değildir.** Kabul için görsel, gerçek runtime sahnesinde doğru state, kadraj, performans ve kullanım hakkıyla doğrulanır.

## 1. Test katmanları

| Seviye | Ne doğrulanır? | Kanıt | Kim? |
|---|---|---|---|
| Q0 Statik | Asset mevcut, PNG açılır, doğru boyut/alpha/köken/ID | Validator raporu | Teknik |
| Q1 Birim | Manifest lookup, pivot, scale, visibility, z-order, deterministic seed | Unit test PASS | Teknik |
| Q2 Bileşen | Asset bir sahneye oturur, scale/LOD/fallback doğru | Scene screenshot / component test | Teknik + kullanıcı |
| Q3 Uçtan uca | Start→map→city→encounter→battle→map + save/load | Browser smoke ve kayıt fixture | Teknik |
| Q4 Görsel inceleme | Stil, siluet, ışık, kompozisyon, birleşim | Önce/sonra ve referans kıyası | Kullanıcı |
| Q5 Performans | FPS, p95 frame, decode, heap, cache, yüklenme | Ölçüm logu, cihaz/browser | Teknik |
| Q6 Hukuk/dağıtım | Asset hakları, kaynak, export, fallback, web yayın | Provenance + build + export logu | Ortak |

Bu seviyeler bir fazda gerekli olduğu ölçüde kullanılır; **karar kapısı** Q4 ve gerekli Q3/Q5 geçmeden kapanmaz.

## 2. Oyun içinde zorunlu sahne test matrisi

### WORLD
- **Harita kayıtları:** Yalnız web main; aynı seed, aynı ownership ve aynı 1648 veri manifesti.
- **Zoom:** Kodun izin verdiği `0.5`, `1.0`, `2.0` ve sınır zoom testleri; zoomdan önce/sonra tile sprite alt noktası kontrol edilir.
- **Kamera:** World haritasında şehir/köy/kale bulunduğu koordinatlara pan, köşe ve kıyı sınırı, düşük ve yüksek prop yoğunluğu.
- **Terrain:** Çim/çim, çim/toprak, su/kara, yol/zemin, kaya/yol geçişi; 16 tile komşuluk maskesi ve 20×20 döşeme tekrar testi.
- **Culling:** Kamera dışında kalan ağaç/yerleşim çizilmemeli, viewporta gelince flicker olmamalı.
- **Fog:** Bilinmeyen bölgenin iç yapısı görünür olamaz; farklı fog seviyeleri aynı kayıttan tutarlı çıkar.
- **Owner:** Devlet sınırları ve sahiplik 19 owner koduna göre; ele geçirilen şehir rengi değiştirmeden taşınmaz.
- **Pointer:** World sprite konumu ile seçme/rota hedefi farklı tile'a işaret etmez.
- **Bellek:** Tam 3M tile map için sıcak/soğuk zoom/pan döngüsü, canvas memory piki, GC yığılması.

### CITY
- **Aile:** İlk Osmanlı; ardından HRE/Venedik/Polonya/İspanya.
- **Sahne sınıfı:** İstanbul başkent, küçük/orta/büyük normal şehir; city tier ve owner'dan türetilen görünürlük.
- **Alanlar:** İç kale, ticaret, han, konut, sağlık, üretim, gıda, kültür; askerî/port pasif.
- **Doluluk:** `empty/low/half/full` — ilgili binanın varlığı ile birebir.
- **Düğme:** Alan hotspot doğru area ID'yi açar; bina seçimi ilgili service ve paneli açar.
- **Varyant:** Aynı şehrin inşa öncesi/sonrası aynı baz sahne üzerinde, yalnız ilgili overlay değişir.
- **UI:** En az 3 viewport ve 2 DPI profili; base/overlay/hotspot içeriği aynı kırpma/ölçek matrisine bağlı.
- **Save/load:** İnşa yapılan bina, oyunu kapatıp açınca doğru görünür ve yok edilmediği sürece kaybolmaz.
- **Özel İstanbul:** İç kale sabit tam; demirci/marangoz/tabakhane/sabunhane üretim seti ve kâğıt ayrı bonus; yanlış alanlarda açılmaz.
- **Fallback:** `baseImage` bulunamaz, overlay kaybolursa oyun çökmez; uyarı + placeholder devam eder.

### VILLAGE / FORT
- Köy iç sahnesi gerçekten **runtime'da yoksa** onu yeni oyun mekaniği gibi gizlice eklemek yasak; ayrı karar.
- Köy ikonları ile köy iç sahneleri farklı test edilir.
- Köy zenginlik/üretim/iklim görünümleri mevcut world/city state bilgisiyle sınırlı.
- Kale dünya ikonu ve yakın plan sur/avlu ailesi farklı asset; sprite büyütme yerine doğru kompozisyon.
- Surların dönüş/köşe/geçit/fog ve label ile tıklama kontrolü.

### BATTLE BACKGROUND / UI
- Phaser/Canvas savaşında kullanılan **eski asker placeholderları** aynı kalır.
- Yeni arka plan askerleri gizlemez; 150+150 görünür sınır senaryosunda komut/hit feedback seçilebilir.
- `main-ground-texture` ortak referansından savaş zemini istemeden bozulmaz.
- Asker dışında VFX ve durum HUD'ı; savaş başlat/sonuç ve `battleComplete` akışına regresyon yok.

## 3. Görsel screenshot çalışma ilkesi

Her screenshot metadata ile tutulur:

```json
{
  "scenarioId": "WORLD_FOREST_CITY_01",
  "gitSha": "<actual sha>",
  "worldSeed": "<actual value>",
  "map": {"tileX": 0, "tileY": 0, "zoom": 1},
  "viewport": {"width": 1920, "height": 1080, "dpr": 1},
  "browser": "<actual version>",
  "artRevision": "<asset bundle rev>",
  "assertions": ["no blank terrain", "label anchor aligns", "no broken alpha"]
}
```

**UYARI:** `tileX:0,tileY:0` örnek dummy; gerçek screenshot'ın tile'ları ölçülmeden kopyalanmaz.

- Golden ekran görüntülerini **özel onay olmadan** yeni resmi kabul etmek için güncelleme.
- Pixel-diff doğru yer: position, seam, clipping, UI bounding box. Şeffaf parçacık ve animasyonda maske veya tolerans gerekir.
- AI estetik değerlendirmesi yardımcıdır; son görsel onay için görseller **oyunun gerçek ölçeğinde** kullanıcıya sunulur.

## 4. Performans hedefi nasıl onaylanacak?

**Mevcut hard-coded facts:** 3.000.480 harita tile; 96 MB dimetric terrain chunk cache; aktif zoom min 0.5. Bunlar total bellek ve FPS değerlerini garanti etmez.

### Önce ölçülecek metrikler
- Ortalama FPS ve **p95/p99 frame time** (ms), 30/60/120 saniye pan-zoom ölçümleri.
- İlk anlamlı world frame ve şehir sahnesi render süreleri.
- Yeni 2D assetların toplam aktarım boyutu, PNG decode duration, GPU/JS cache residency.
- Chunk/cache `buildCount`, `evictions`, miss/visible blank, LOD pop-in.
- HUD/event loop işlenirken input latency ve UI responsiveness.
- 150+150 placeholder askerle background+UI ek yükü.

### Kabul eşikleri — öneri, ölçülmüş değer DEĞİL

| Metrik | Tasarım hedefi önerisi | Not |
|---|---|---|
| Hedef masaüstünde harita | 60 FPS akıcılığı hedefle | Cihaz ve temel baseline görülmeden mutlak karar değil |
| Giriş seviyesi hedefte | 30 FPS altına düzenli düşüş olmayacak | Hedef cihaz kullanıcıyla kesinleşecek |
| p95 frame süresi | 60 FPS hedefte 16.7 ms'e yaklaş; kabul ölçümsel | Tarayıcı/OS etkisi ayrı |
| Terrain chunk cache | Mevcut 96 MB ayarına saygı; toplam cache ayrı hesap | Limit yükseltme kullanıcı kararı |
| Siyah/boş bölge | 0 kritik | Placeholder renkli olabilir, siyah ekran olmamalı |
| Kırık 2D manifest/404 | 0 fatal | Eksik optional asset güvenli raporla |
| Eski save / gameplay | 0 P0/P1 regresyon | Ekonomi, battle result, hareket semantiği değişmez |

Daha iyi olan: G01'de **baseline tablo** çıkarılır; her faz ölçümleri bu tabloyla karşılaştırılır. Performans farkının kabulü sayısal ve kullanıcı kararına bağlıdır. Sabit % performans hedefi rakamı ölçüm olmadan uydurulmaz.

## 5. Her fazın kilit kapanış testi

| Kapı | Zorunlu kanıt paketi |
|---|---|
| G00 | Karar defteri + koruma/rollback kapsamı |
| G01 | Görsel envanter + screenshot kayıtları + gerçek baseline |
| G02 | Onaylı stil kartları, kamera/ölçek/gölge karşılaştırması |
| G03 | Dummy 2D PNG uçtan uca, manifest validate ve 3 viewport |
| G04 | Zemin tile/transition tüm komşuluk + world zoom/pan + bellek |
| G05 | Orman kümeleri + overlap + LOD + shadow + perf |
| G06 | Yol/nehir/bridge ve fog/owner/selection E2E |
| G07 | Yerleşim icon/owner/tier + düşük zoom okunabilirlik |
| G08 | Köy varyantları + rol/çevre + hotspot ve oyun akışı |
| G09 | İstanbul ve üç normal şehir, doluluk matrix, bina inşası/save |
| G10 | Küçük/orta/büyük kale, sur birleşimleri, world icon farkı |
| G11 | Dört faction + fallback ve 19 owner dünya tema eşleşmesi |
| G12 | Battle background+HUD+menüler, 300 placeholder + gameplay smoke |
| G13 | Tam görsel galeri; P0/P1=0; hak, perf, rollback, release readiness |
| G14 | **Sadece son fazda:** asker 2D kimlik/animasyon/atlas, stress+parity + kullanıcı GO |

## 6. Tek görev kabul tutanağı

```text
Task ID:
Önceki durum / kanıt:
Girdi asset ID ve revision:
Değişen dosyalar:
Oyun ekranı + seed + viewport:
Mevcut renderer / branch / commit:
Testler: npm run lint / npm run test:unit / npm run build / browser smoke
Screenshot BEFORE / AFTER:
Visual art reviewer:
Performance delta ve cihaz:
Known issue / risk:
Rollback bağlantısı:
Kabul: EVET/HAYIR; tarih ve onaylayan:
```

**Tamamlanma koşulu:** Yukarıdaki fiş doldurulmadan hiçbir görev `KABUL` olmaz. Hata yeniden üretilemiyorsa `DÜZELTİLDİ` değil `TEKRAR_ÜRETİLEMEDİ` olarak kayıt altına alınır.