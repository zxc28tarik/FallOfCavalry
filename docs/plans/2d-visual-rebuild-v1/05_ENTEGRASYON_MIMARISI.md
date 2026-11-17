# FOC WEB — 2D ASSET ENTEGRASYON MİMARİSİ (ÖNERİLEN)

Bu belge bir **gelecek uygulama tasarımıdır**. Aşağıdaki sözleşme, bugünkü runtime'ın tamamında varmış gibi kabul edilmez; dosya yolu ve kod eşlemeleri mevcut GitHub `main` üzerinden doğrulanmıştır.

## 1. Bugünkü kodun korunacak kökleri

| Sorumluluk | Mevcut kod kaynağı | Yeni görsel katman ne yapar? |
|---|---|---|
| Dünya render orchestrator | `js/managers/RenderManager.js` | Yeni `visualTheme=V2` renderer köprüsü, değil ikinci bağımsız oyun |
| Dimetrik projeksiyon | `js/rendering/dimetric/projection.js` | `tileX/Y → screenX/Y`, pivot kalibrasyonu |
| Dünya zemini/cache | `js/rendering/dimetric/terrain-chunk-cache.js` | Yeni 2D terrain atlas/mask, byte/LOD sınırı |
| Dünya doğa | `js/rendering/dimetric/nature-layer.js` ve `anchor-spatial-index.js` | Yeni 2D prop varyantı, dağılım ve sıralama |
| Yollar/su | `js/rendering/dimetric/path-layer.js` | Var olan polylineleri render eder, path gameplay değiştirmez |
| Z-order | `js/rendering/dimetric/depth-sort.js` | Sprite alt-temas noktası ve stable sort |
| Global sprite loader | `js/rendering/sprite-loader.js` | Güvenli manifest/atlas bağlantısı; default boş manifest sorunu kapatılır |
| World map asset | `js/world/world-map-asset-loader.js` | 1648 owner/terrain source korunur |
| City scene definitions | `js/data/city-scene-defs.js` | `sceneId/areaId` otoritesini korur |
| City building catalog | `js/data/city-building-catalog.js` | `buildingId` hangi görsel ve alanda? |
| City UI | `js/ui/city-services.js` | Stage background, image overlays, responsive hotspot |
| City state | `js/systems/city-state.js` | Fill, active buildings, services gerçeğini görünümde uygular |
| Current world ground | `js/rendering/main-ground-texture.js` | Eski shared texture ile battle regression testlerini ayırır |
| Battle debug | `js/battle/BattleScene.js`, `BattleBoot.js` | G12 background (G14 öncesi asker görseline dokunulmaz) |

**Önemli:** `js/rendering/map-renderer.js` eski/legacy path olarak mevcut; görsel işlerin buraya yapılması aktif dünya haritasını değiştirmeyebilir. Her iş doğrudan çağrı zincirini doğrular.

## 2. Önerilen yeni kod modülleri (henüz mevcut değil)

```text
js/visual-v2/
  VisualAssetRegistry.js       # manifest kontrolü, assetId çözümleme, cache
  VisualAssetValidator.js      # runtime dev doğrulama ve tanılama
  WorldSpriteAdapter.js       # world tile → dimetric render konumları
  WorldDecalProvider.js       # seedli zemin ve çevre yerleşimi
  CitySceneRendererV2.js      # base/overlays/dom/hotspot sync
  CityPlacementResolver.js    # area-relative bina konum hesaplayıcısı
  SceneVisibilityResolver.js  # owner/fill/building ve tier bağlayıcısı
  VisualFeatureFlags.js      # aşamalı geçiş / güvenli rollback
  VisualDiagnostics.js       # asset eksik, pivot kayması, frame metrikleri
```

Modüller **ihtiyaç kanıtlanınca** eklenir; gösteriş için her sınıf yaratılmaz. Mevcut `RenderManager`/`CityManager` üzerinden yapılan adaptörler küçük ve test edilebilir olmalı.

## 3. Dünya çizim sırası ve sorumluluk tablosu

Dünya katman sırası **taslak** ve gerçek canvas çağrılarına göre G03/G04 testinde kesinleştirilecektir:

```text
1. background/base terrain
2. terrain transition decals + shoreline
3. road/river masks and crossings
4. object contact shadows
5. low props and settlement base
6. foliage/structures and depth-sorted raised objects
7. faction owner/borders/fog (priority must be visually tested)
8. player/party markers, POI, selection rings
9. labels, HUD, interaction UI
```

Fog'un tam katman yeri bilgi sızıntısını engelleyecek şekilde düzenlenir. Oyuncu/görev işareti görünmeyen dünyada yanlış görünürse düzeltme yapılır. Tüm katmanlar grafik görünümündedir; oyuncunun hareket/çarpışma/ownership state'ini değiştirmez.

## 4. Şehir V2 görünürlük ve bina koordinat algoritması

**Bugünkü gerçek:** `scene.areas[]` ve `cityState.parcels[]` her alanı `id`, `x`,`y`,`w`,`h` (yüzde) ile tarif eder. `parcel.buildingIds[]`, `parcel.fill`, `parcel.state`, `parcel.overlayAsset` gibi alanlar mevcut. `city-services.js` alan hotspotlarını stage'e yüzde konumlarla yerleştirir. **Her tekil binanın kendi koordinatı henüz merkezi yetkili listede hazır değil.**

**Önerilen güvenli veri akışı:**

```text
settlement.id / owner / tier
   │
   ▼
cityState = ensureSettlementCityState(settlement)
   │
   ├─ sceneId → getCitySceneDef(sceneId) → baseImage (yeni 2D)
   ├─ areaId  → parcel.{x,y,w,h, fill, state, buildingIds}
   └─ city visual manifest (yeni) → placement rows
              │
              ▼
        for each placement:
          assert sceneId, areaId, buildingId are known
          visible := fixed OR buildingId in activeBuildings
          if dependent on fill then require matching fill
          frame := registry.get(assetId) OR known placeholder
          imagePos := stageBounds * normalized areaPlacement
          depth := layer + pivotY stable order
          draw/render PNG (noninteractive)
              │
              ▼
        existing hotspot stays above art overlay
```

**Uygulama kısıtları**
1. `areaId` gerçekte katalogda yoksa asset otomatik başka alana kaydırılmaz; validator hata verir.
2. `buildingId` uygun `buildingPoolIds/fixedBuildingIds` içinde değilse uyarı ve reddetme.
3. `baseImage` değişken bina içermemeli. İç Kale **istisna**: sabit ve tam dolu; ister base parçası ister ayrı fixed overlay olabilir; iki kere çizilmez.
4. Birden fazla bina bulunan alan için tek hotspot **alanı** temsil eder. `hotspot` ve `imagePlacement` farklı tablolardır.
5. Kaynak görsel kırpıldığında `pivot` ve `relativePlacement` güncellenir; alan seçim kutusu değişmez.
6. Yeni görsel sistem yalnız **türetilmiş sunumdur**: state JSON içine ağır PNG, base64, sanat `revision` gömülmez.
7. Şehir açılırken asset geç gelir veya hatalıysa mevcut placeholder çizilir; başka şehirde yüklenmiş asset'ın yanlış biçimde kalması önlenir.

### Örnek varsayımsal şehir manifest kaydı (öneri, runtime desteği henüz yok)

```json
{
  "sceneId": "ottoman_city_full",
  "sceneRevision": "vis-v1",
  "baseImage": "assets/visual-v2/scenes/cities/ottoman/base/cityscene_ottoman_full_base.png",
  "placements": [
    {
      "areaId": "trade_area",
      "buildingId": "bedesten",
      "assetId": "city.ottoman.trade_area.bedesten.v1",
      "relativePlacement": {"x": 0.48, "y": 0.37, "scale": 1.0},
      "pivot": {"x": 0.5, "y": 0.94},
      "zLayer": 40,
      "visibility": {"requiresBuilding": "bedesten"}
    }
  ]
}
```

Bu örnekte `relativePlacement` **örnek/sözleşme** değeridir; gerçek Bedesten koordinatı değildir. Gerçek koordinatlar ilk şehir base üzerine görsel işaretlenerek kullanıcı/QA kabulüyle verilir.

## 5. Responsive şehir sahnesi: letterbox/crop problemi

Bugünkü `.city-scene-stage` CSS minimum yüksekliği ve arka plan stilleri var. Tek bir base fotoğrafı `background-size: cover` veya `contain` ile ölçeklemek, hotspotların yüzde koordinatlarına **kırpma farkı** getirebilir. G03'te şu tek sistem tasarlanacak:
- Base scene'in **mantıksal en/boy oranı** sabit.
- Stage içindeki gerçek **görüntü viewportu** (`contentRect`) ayrılır; letterbox gerekiyorsa hotspotlar da `contentRect` içinde ölçeklenir.
- Overlays ve hotspotlar aynı `transform` hesaplamasını paylaşır.
- Kullanıcı ekranı resize ettiğinde bu hesabın tek otoritesi vardır.
- En az 1366×768, 1920×1080 ve daha dar bir viewportta yanlış alan seçimi olmaz; bu ölçüler **test senaryosu önerisi**dir.

## 6. Dünya görsel çeşitlilik ve deterministik yerleştirme

- `owner.bin`, `terrain.bin`, `MapData` ve gerçek keşif/oyuncu hareket kurallarını **değiştirme**.
- Görsel varyantlar `visualSeed = hash(worldSeed, tileX, tileY, assetFamilyRevision)` üzerinden üretilir. Böylece her frame farklı ağaç renk/konumuna kaymaz ve save boyutu artmaz.
- Ağaç/orman yerleşimi `AnchorSpatialIndex` ile sorgulanır; şehir çevresi, yol, kıyı ve seyahat yolu için exclusion masks kullanılır.
- Görsel zenginliği gerektiğinde `WORLD_MAP_FORCE_SINGLE_GRASS_BIOME` boolean’ı kaldırılabilir ama **grafik katmanının** yeni kaynakları ile movement biome’ları ayrı tutulur. Bu tasarım kararı, G04 kullanıcı kapısına konur.
- Yerleşim sınıfına göre world ikon atlası seçilir; icon anchor ve text label ayrı yerleştirilir; fraksiyon owner değişince ikon cinsi ve rengi doğru güncellenir.

## 7. Görsel cache, LOD ve performans

**Daha önce ölçülmüş gerçekler:** Chunk cache için mevcut 96 MB limit bulunuyor; bu **toplam asset bütçesi** olarak kabul edilemez. Yeni texture atlasları CPU/GPU bellek, decode ve network yükü üretir.

- Asset cache key = `(assetId, revision, displayProfile, scaleClass)`. Aynı asset tekrar tekrar yüklenmez.
- Dünya zoom seviyesine göre **low/medium/high** görsel grup seçimi; ekranda görünmeyen varlıkların çizimi kapatılır. LOD değişimi görünür yaprak veya bina pop-in yaratmamalı.
- `ImageBitmap`/canvas/png decode stratejisi test edilmeden yalnız teorik olarak seçilmez; target browser uyumluluğu ölçülür.
- Yüksek zoomda boş tile gizlemek için cache inşası bütçe ile sınırlandırılır ve base layer fallback vardır. Asset yüklenemeyince siyah sahne yoktur.
- Savaş sahnesinde dünya ortak zemin texture helper'a kontrolsüz yeni dosya vererek eski davranışı bozmama.
- Görsel benchmark seed, viewport, cihaz/OS/browser, artRevision, commit, fps mean/p95 frame, heap, cache ve network payload olarak kaydedilir.

## 8. GitHub ve save sınırları

**Önerilen branch:** `codex/web-visual-v2-<phase>-<ticket>`; `main` doğrudan toplu görsel değiştirmek için kullanılmaz. Her PR'de: kod değişiklik listesi, görsel dosya hashleri, manifest diff, test raporu, 3 screenshot, fallback özeti, son kullanıcı onayı.

`SaveManager` için ideal: `world state` olduğu gibi; tema/revision aktif görsel seçimleri mümkün olduğunca runtime config. Oyuncunun bina yaptırdığı state zaten cityState üzerinden kaydediliyorsa görselin bağımsız ve deterministik yeniden oluştuğu test edilir. Save şema değiştirmek sadece grafik için kural değildir; mecburi olursa açık kullanıcı onayı gerekir.

## 9. Final teknik entegrasyon başarısı

- `assetId`lerin %100'ü katalogda ve klasörde var; bulunamayan asset açık raporda.
- Sprite manifest boş olduğu için image görünmüyor hatası yok.
- City `baseImage` ve overlayler doğru ID'lere bağlı; hotspotla aynı kadrajda.
- Aynı seed/şehir save yeniden yüklenince **görsel state eşit**.
- Main'den geri dönüş / eski art flag yolu çalışır.
- Start→map→city→encounter→battle→aftermath→map uçtan uca smoke geçer.
- **G14 hariç hiçbir asker sprite/animasyon dosyası eklenmez veya değiştirilmez.**