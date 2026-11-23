# GEMINI G3D-06 — DEVASA 3D DÜNYA HARİTASI (AYRI GÖREV)

**GÖREV AYRIMI: Gemini yalnızca kod adayı üretir. Yedek/önceki BEST kıyası/checkpoint/test doğrulaması/kabul yalnız ChatGPT'ye aittir.**

**Önce zorunlu dosyalar:** `GEMINI.md`, `docs/3d-migration/00_KORUMA_SISTEMI.md`, `01_EN_IYI_PARCA_KAYITLARI.md`. Gemini her alt değişikliği aday kod commit'i olarak teslim eder; **yedekleme, karşılaştırma, bağımsız test ve BEST checkpoint'ini yalnız ChatGPT yapar**. **G3D-02 savaş çalışmasıyla dosya çatıştırma.**

## Kaynak gerçekliği

- `js/world/world-generator.js`: seed'e bağlı gerçek MapData, heightMap, terrain, biome, forest, mountain, settlements, roads, rivers, crossings, POIs.
- `js/world/map-data.js`: typed layer authority, height encoding, fog of war, siyasi owner, kalıcı ID.
- `js/rendering/dimetric/terrain-chunk-cache.js` ve `terrain-scene-renderer.js`: eski çalışan 2D harita çizimi; korunacak fallback.
- `js/world/world-map-asset-loader.js`: historical asset world *removed*; manifest varsa doğrulanır, otomatik eski owner.bin/terrain.bin varsayma. Asıl güncel authoritative world generator ve MapData'dır.
- Güncel seed kontrolünde 881 şehir ve 304 gerçek yol raporlanmış; her yeni sahnede gerçek kaynak kimliğini doğrula, her seed'de aynı sayıyı zorunlu varsayma.
- Kullanıcı tüm harita 3D olsun istiyor; ekrandaki kameranın görmediği alanların render edilmesi gerekmiyor.

## Kapsam

1. Yeni `js/world3d/` dizininde salt-okunur `MapData -> 3D chunk` projection (meshes/height/biome). Bu ilk alt adım kendi test ve commit'ini alır.
2. **Kamera çevresi/LOD/chunk streaming** ve kademeli yükleme. Uzak bölgelerin mesh ve kaplamaları hafif; şehir, yollar, nehir, dağ/orman kaynakları ID ve koordinatları korunarak çizilir. Camera pan/zoom/orbit veya stratejik overview.
3. Yalnız görüntü yüklemesini kıs; uzak kervan/ordu/NPC ekonomisini simülasyondan silme. Fog, owner sınırları, geçit ve yol graph mantığı aynen korunur.
4. Terrain'i birer milyon bağımsız mesh haline getirme, tüm 881 şehri ayrıntılı bina sahnesi olarak tek anda çizme, bütün harita verisini aynı anda VRAM'e yükleme.
5. Önce ayrı preview/feature flag; 2D harita aynı oyunla erişilebilir kalır. Dünya hareketi, quest, save, ticaret, yapay zekâ/diplomasi değişmez.

## Kabul kapısı

- Coğrafi uyum ve ID parity testleri: gerçek kaynak City/road/river/crossing, fog/owner ve chunk sınırı.
- Kamera gider-gelir testi, kaynak nesne sürekliliği; chunk cache memory ve load süreleri **ölçülerek** kaydedilir.
- `npm run validate`, `npm test`, `npm run audit:world`, Chromium/WebGL gerçek test.
- `docs/3d-migration/checkpoints/G3D-06.md` dosyasına **yalnız ChatGPT** eski BEST, yeni teslim SHA, en iyi parçalar, bağımsız görsel kanıt, performans ölçümü, kayıplar ve geri dönüş adresini yazar. Gemini bu dosyaya dokunmaz.
- **Savaş ve City V2 dosyaları ayrı görevdir; başka bir sistemin başarısını kaybetme.**
