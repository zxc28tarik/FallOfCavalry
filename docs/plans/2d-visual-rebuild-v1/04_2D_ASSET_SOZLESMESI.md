# FOC WEB — 2D GÖRSEL ÜRETİM VE TESLİM SÖZLEŞMESİ V1

**Belge amacı:** Kullanıcı veya farklı görsel AI aracından gelen 2D resimlerin birbirini bozmadan web oyununa girme standardı. **3D model, GLB/FBX/OBJ, rig, Blender render hattı bu sözleşmenin dışında**. Asker animasyonu yalnız G14 kapsamındadır.

## A. Girdi ve çalışma rolleri

**Kullanıcı / görsel üretici**
- Görseli **2D olarak** üretir; araç seçimi serbest (Meshy veya diğer araç kullanılabilir, ancak teslim **2D PNG** olmalıdır).
- Görsel türünü, fraksiyonu, hedef alanı/bina adını, varyantını, hak/köken bilgisini belirtir.
- Bina, ağaç, kale, ikon gibi oyun üzerinde üst üste binecek her nesneyi **tercihen şeffaf arka planlı ayrı PNG** verir.
- Şehirlerin tek parçalı **base scene** çıktısını değişken bina içermez şekilde üretir; değişken binaları ayrıca overlay olarak verir.
- Renk/perspektif/ışık uyumu için onaylanan style card'a uyar; alternatif varyantların dosya adlarını karıştırmaz.

**Teknik entegrasyon (ChatGPT/Codex)**
- Asset'i teslim klasöründen doğrular, web asset standardına dönüştürür ve uygun `assetId`, `buildingId`, `areaId`, `faction` ile eşler.
- Gerekli crop/resize/atlas optimizasyonunu yapar; sanat tasarımını izinsiz değiştirmez.
- Dünya haritasında 64×32 tile ve city stage'de yüzde koordinatlı layer doğru görünsün diye pivot/offset hesaplar.
- Sadece tasarım-grafik katmanına dokunur. `save`, `owner`, `economy`, `battle damage`, `quest` veri mantığını değiştirmez.
- Local validation + oyun smoke + 2D kalite ekran görüntüsü + PR/commit kanıtını ekler.

## B. 2D dosya türleri ve teknik standart

| Tür | Tercih edilen kaynak | Nihai runtime | Alpha | Kullanım |
|---|---|---|---|---|
| Zemin tile/decal | Bağımsız 2D PNG parçaları | PNG/atlas | Kenar geçişinde var | Dimetrik dünya haritası |
| Ağaç / kaya / prop | Tek nesne 2D PNG | RGBA PNG / atlas | Zorunlu | Dünya/çevre |
| Köy/şehir dünya ikonu | Küçük, temiz siluet 2D PNG | RGBA PNG / atlas | Zorunlu | Harita settlement |
| Şehir base scene | Değişken bina içermeyen 2D kompozisyon | RGB/RGBA PNG | İsteğe bağlı | City stage base |
| Şehir alan/bina | Bir area/building overlay 2D PNG | RGBA PNG | Zorunlu | City stage overlay |
| Surlar/kale/landmark | 2D ayrı parça veya tek siluet | RGBA PNG | Zorunlu | Dünya veya sahne |
| UI ikon/panel | 2D SVG/PNG veya CSS | PNG/SVG/CSS | İkonlarda var | HUD ve menüler |
| VFX | Doğrudan 2D kare/dizi | PNG/atlas | Zorunlu | Savaş, atmosfer |
| Asker | **G14 dışında üretim yok** | Karara bağlı 2D atlas | Zorunlu | Savaş |

**Giriş validasyonu:** PNG okunuyor mu, dimensions pozitif mi, RGBA gerçekten var mı, alpha kenarında beyaz/siyah halo var mı, boş dosya / aşırı devasa texel var mı, asset ID başka dosyayla çakışıyor mu, kullanılmayan gölge sabit PNG’ye mi gömülü, pivot tanımlı mı, kaynak ve lisans bilgisi var mı. Bu testler JSON metadata ile eşleştirilir.

**Boyut politikası:** İlk pilotlardan önce bütün objeler için keyfî sabit `1024×1024` zorunluluğu koyulmaz. Referans canvas/açı, ekran ölçeği, gerçek oyun zoomu ve tarayıcı performansına göre kategori bazlı **source px → runtime px → LOD** ölçü tabloları G02/G03'te onaylanır. İstisna: Dünya haritasında kullanılan tile geometrisi 64×32’dir; bu **her PNG’nin mutlaka 64×32 olması gerektiği** anlamına gelmez.

**Renk/şeffaflık:** sRGB ile tutarlı görüntü kaydı; tam şeffaf alanlarda halo ve kırpma izleri olmayacak. Çok katmanlı kompozisyonda fiziksel temas gölgesi ayrı taşınabilir; ancak aynı nesne gölgesinin ikinci kez çizilmesi yasak. Gerekli durumlarda kaynağın ham ve optik boyut ölçüleri birlikte tutulacak.

## C. Perspektif ve konum sözleşmeleri

### Dünya haritası
- Hedef `tileX/tileY` koordinatları; `js/rendering/dimetric/projection.js` içindeki **worldToScreen** temel otoritedir.
- Metadatalar: `worldFootprintTiles`, `pivotNormalized`, `offsetPxAtZoom1`, `layer`, `occludes`, `selectionRadius`, `shadowVariant`, `lodGroup`.
- PNG’nin alt orta noktası görsel pivot için **aday** olabilir, **varsayılan doğruluk kabul edilmez**; her varlık tipi pilotla kalibre edilir.
- `owner/terrain` oyunun gerçek verisidir. Görsel, owner tile'ını yeniden üretmez veya komşu ülkeyi boyamaz.
- Kamera zoom değişince eski ve yeni varlığın ayak noktası ayrı yönlere kaymamalı; label ve hitbox, sprite'dan ayrı kalmalıdır.

### Şehir/köy sahnesi
- `areaId`, `buildingId`, `faction`, `variant`, `fill` ayrı alanlar; `scene.baseImage` = sahne zemin/background; `overlay` = değişken bina veya seçili alan görseli.
- City V2'nin mevcut `x/y/w/h` değerleri **0–100 yüzde** ile ifade edilen **alan hotspotlarıdır**. Bunları doğrudan binanın çizim merkezine eşitlemek hatadır.
- Manifestte **ayrı relativePlacement** tutulur: `x`, `y`, `width`, `height`, `pivotX/Y`, `layer`, `cropBox`, `occlusion` (sözleşme teklifidir; runtime parser uygulanana kadar mevcut manifestin yerine konmaz).
- Sahne base ve overlay **aynı kompozisyon referansıyla** üretilmeli. Base bir kareyken overlay başka kamera açısından üretildiyse kesilerek düzeltilmeye çalışılmaz; reddedilir veya yeniden çizilir.
- Boş/az/yarı/tam dolu varyantlarında bir bina yokken gölgesi/çatısı yerde kalmamalı.

### Savaş alanı
- G12’de **sadece arka plan, çevre, HUD, non-soldier efekt**; asker / zırh / silah / animasyon G14’e kadar kapalı.
- Savaş sahnesi `1280×720` Phaser başlangıç canvasını kullanabilir; ancak responsive scaling vardır. Bu ölçü **tüm savaş PNG’lerinin kaynak çözünürlüğü** değildir.

## D. ID, yol ve revizyon standardı — önerilen kayıt biçimi

**Önerilen düzen** (mevcut GitHub runtime’a uygulanmadan önce G03’te test edilir):

```text
assets/visual-v2/
  raw/                     # yayın paketine alınmaz, kaynak bağlantıları + notlar
  world/
    terrain/               # 2D ground + transition masks
    nature/                # tree/rock/shrub/decals
    routes/                # road/river/bridge
    settlements/           # map village/town/city/fort icons
    poi/                   # event, selection, route
  scenes/
    villages/<theme>/      # köy sahneleri ve overlay
    cities/<faction>/base/
    cities/<faction>/overlays/
    cities/<faction>/manifests/
    forts/<theme>/
  battle/backgrounds/      # asker yok
  ui/                      # HUD, menu, icons
  vfx/                     # asker sprite yok
  manifests/visual-v2.json
  provenance/assets.json
```

**UYARI:** Yukarıdaki dizin önerisidir. Bugünkü `assets/city-scenes/<faction>/...` yapısı ve onun mevcut `manifestPath` alanı da gerçektir. G03 sırasında **ya mevcut klasörlere uyumlu entegrasyon ya da geriye dönük güvenli resolver** seçilerek yapılır. Dosya taşıma körü körüne yapılmaz.

Örnek adlandırmalar:
- `world_terrain_grass_base_01.png`
- `world_nature_tree_broadleaf_medium_02.png`
- `world_settlement_ottoman_town_medium_01.png`
- **Mevcut şehir adlandırmasına uyumlu:** `cityscene_ottoman_trade_area_bedesten_overlay.png`
- `cityscene_ottoman_full_base.png`

`assetId` **sabit**, dosya `revision` **artabilir**. Runtime farklı revision yüklendiğinde eski save dosyasını değiştirmez. `assetId` kod ile oyuna bağlanır, sanat aracına/görsel talimatına bağlanmaz.

## E. Kabul/red kriterleri (tekil asset)

| Kontrol | Onay şartı | Red örneği |
|---|---|---|
| Art direction | Onaylı 2D stil kartıyla uyum | 2D illüstrasyon yanında fotogerçek bina |
| Perspektif | Aynı sahne referansıyla aynı yatay/düşey eksen | Bir ev tepeden diğeri cepheden |
| Ölçek | Kategori ölçü bandı ve footprint ile uyum | Köy evi kalenin yarısı kadar |
| Işık | Aynı ışık/gölge yönü | Tek sahnede doğu ve batıya düşen iki gölge |
| Şeffaflık | Kenarlarda renk halosu yok | Beyaz kenarlı kesilmiş bina PNG |
| Kompozisyon | Bağlı alan/hotspotta taşma yok | Bedesten trade_area dışına oturuyor |
| Varyant | Fill/tier/state ile birebir | Şehir boşken pazar kalıntısı ve gölgesi var |
| Performans | Render ve decode bütçesine uyuyor | Zoomda donma ve cache taşması |
| Telif | Hak ve üretim izni belgeli | Kaynağı bilinmeyen oyun rip’i |
| Test | Uçtan uca ve screenshot kanıtı | Yalnız PNG dosyası mevcut |

**Hata etiketi:** `ART_MISMATCH` (stil/perspektif), `BAD_ALPHA`, `WRONG_PIVOT`, `WRONG_SCALE`, `MISSING_ASSET`, `WRONG_AREA`, `STATE_MISMATCH`, `PERF_REGRESSION`, `RIGHTS_UNVERIFIED`, `UNTESTED`.

## F. Teslim formu — tek satır için gerekli alanlar

`assetId`, `category`, `sceneId/world`, `faction/theme`, `areaId` (varsa), `buildingId` (varsa), `variant/fill` (varsa), `file`, `width/height`, `pivot x/y`, `footprint`, `layer`, `source/tool`, `copyright/rights`, `styleCardRev`, `revision`, `visualReference`, `notes`.

**Asker üretimini engelleme:** `category=soldier`, `unit_anim`, `weapon_held`, `modular_body` gibi görseller G14-GATE öncesinde pipeline’a kabul edilmez. Sadece mevcut geçici askerler oyun smoke testlerinde çalışmaya devam eder.