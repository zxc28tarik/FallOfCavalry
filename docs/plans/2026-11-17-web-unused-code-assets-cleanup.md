# FOC WEB — Eski kod ve lisanssız kaynak görsel temizliği (2026-11-17)

**Hedef depo:** `zxc28tarik/FallOfCavalry` — yalnız web `main`  
**Temel commit:** `eeaa3282713c397554764186d9b04ef1dccc8ffe`  
**Durum:** GitHub kullanım/ref aramasıyla gerekçelendirilmiş kaynak temizliği; çalışma kodu değişmeden çekirdek dışı varlıklar kaldırılır.

## Özet

GitHub `main` ağacında **76 takip edilen dosya** ve **13.830.057 byte (yaklaşık 13.83 MB)** içeriğin kaldırılması öngörülmüştür. Silme, yalnız yeni `main` çalışma ağacını etkiler; önceki commit tarihçesi korunur. Aynı içerik Git geçmişinden (telif/lisans gerekçeleriyle tam silme gerektiği haller dışında) geri alınabilir.

| Sınıf | Dosya | MB | Gerekçe |
|---|---:|---:|---|
| Eski 2D harita/şehir/savaş render zinciri | 11 | 0.22 | Kullanılmayan eski giriş yolu, tekrarlı/superseded sanat havuzu veya artık çağrılmayan üretim aracı |
| Stronghold ve eski yerleşim PNG havuzları | 54 | 8.98 | Kullanılmayan eski giriş yolu, tekrarlı/superseded sanat havuzu veya artık çağrılmayan üretim aracı |
| HoMM3 çıkarılmış görsel verisi ve çıkarma araçları | 3 | 4.55 | Kullanılmayan eski giriş yolu, tekrarlı/superseded sanat havuzu veya artık çağrılmayan üretim aracı |
| Eski materyal ve diagnostik asset'ler | 3 | 0.06 | Kullanılmayan eski giriş yolu, tekrarlı/superseded sanat havuzu veya artık çağrılmayan üretim aracı |
| Tek seferlik eski hata ayıklama araçları | 5 | 0.03 | Kullanılmayan eski giriş yolu, tekrarlı/superseded sanat havuzu veya artık çağrılmayan üretim aracı |
| **TOPLAM** | **76** | **13.83** | |

## Çalıştırma zinciri ve kanıt

1. Aktif oyun giriş dosyası `index.html` / `js/main.js` ve gerçek harita çizim katmanı `js/managers/RenderManager.js` üzerinden ilerler. `CanvasRenderer` sınıfı için GitHub kod aramasında **yalnızca kendi modülü** bulundu. `MapRenderer` yalnız `canvas-renderer.js` içinde, `ChunkManager` yalnız `map-renderer.js` içinde import edilmektedir. Benzer şekilde eski `CityRenderer`, `BattleRenderer`, `SpriteGenerator` zincirinin etkin oyuna import yolu yoktur. `sprite-preview.html` yalnız bu eski SpriteGenerator için bağımsız deneme sayfasıdır.
2. `MinimapSimple` ve `settlement-style.js` dışarıdan çağrılmıyor. `dimetric/prop-style.js` yalnız `tests/unit/dimetric-prop-style.test.js` ile kullanılıyor; çalışma zamanı kodunda kullanılmıyor. Bu modül ve yalnız onu test eden test birlikte çıkarıldı.
3. `assets/settlements/` görselleri dinamik oyunda yüklenmiyor. `RenderManager.init()` sprite manifestini varsayılan olarak boş tutmaktadır (`manifestData: {}`); yerleşim nesneleri güncel sahnede prosedürel çiziliyor. Eski PNG teslim notu bu durumu yansıtmıyordu. Kullanıcının yeni 2D sistemi bunların yerine **sıfırdan** çizim getirecek.
4. `assets/stronghold/world/` eski ithal grafikler için aktif import görünmüyor. Kullanıcı 2D sanatın baştan üretileceğini belirledi; eski ithal kaynaklar final ürüne alınmaz.
5. `js/data/homm3-map-art.json` 4,5 MB'lık çıkarılmış veri: güncel çalışma kodunda import/fetch yok, yalnız eski çıkarma betiği kendisini üretmekte. Ticari kullanıma ilişkin telif riski oluşturabileceği için aktif kaynak ağacından çıkarıldı. `scripts/extract-homm3-*` da artık gerekli değil.
6. `assets/terrain/main-ground-diamond.png` yalnız eski ilerleme belgesinde geçiyor; güncel doku kaynağı `assets/terrain/main-ground-tile.png`. `assets/manifest.json` varsayılan oyunda yüklenmiyor ve mevcut olmayan `units.png/icons.png` dosyalarına başvuruyor; eski bozuk örnek manifest kaldırıldı. `assets/world-map/extraction-diagnostics.json` yalnız jeneratör teşhis çıktısı ve runtime'da okunmuyor.
7. `tools/check_full.cjs`, `find_depth1.cjs`, `find_extra_brace.cjs`, `find_syntax.cjs` belirli satır numaralarında eski `js/main.js` parantez hatası arayan tek seferlik programlardır; CI veya script olarak çağrılmıyor. `tools/generate_settlement_sprites.py` kaldırılan Stronghold sanat kaynaklarını tüketen eski generator olduğu için birlikte çıkarıldı.

**Metin belgeleri:** `docs/stronghold-settlement-prompts.md` silinmedi; `docs/archive/stronghold-settlement-prompts.legacy.md` yoluna *aynı Git blob SHA* ile taşındı. Kullanıcı kararlarının ve geçmiş kayıtların izlenebilirliği korunur.

## KORUNAN aktif içerik

- **Dünya:** `assets/world-map/owner.bin`, `terrain.bin`, `faction-colors.json`, `world-map-manifest.json`, tarihsel harita üretimi için `europe-1700*.png` ve `region-seeds.json`.
- **Zemin ve ağaç:** `assets/terrain/main-ground-tile.png`, `assets/world-map/trees/generated/tree_custom_*.png`, `js/rendering/dimetric/tree-billboard-assets.js`.
- **Savaş:** `assets/battle/tiny_swords_*.png/json`, `js/battle/` Phaser hattının tamamı ve eski Canvas savaş oynanış kodları. Asker görselleri son görsel fazda yeniden ele alınacak.
- **Güncel çizim:** `js/managers/RenderManager.js`, `js/rendering/legacy-world-terrain-renderer.js`, `legacy-world-overlays.js` dahil gerçekten import edilen dosyalar.
- **Şehir V2:** `assets/city-scenes/` boş şablon/manifesteri ve `js/data/city-*.js` veri/etkileşim kodları.
- **Önemli belgeler:** `docs/plans/` ve eski ilerleme kayıtları, arşiv.
- **Web/Unity ayrımı:** Unity dosya ve branch'lerine **hiç dokunulmadı**.

## Denetimler / sınırlar

- GitHub kod araması statik/dinamik import ve kullanım taraması için yapıldı. **Arama indeksinin veya statik taramanın bütün çalışma zamanı davranışlarını eksiksiz bildiği iddia edilmez**; bu nedenle belirsiz aktif parçalara dokunulmadı.
- `js/main.js`, `js/managers/`, `js/battle/`, aktif `js/rendering/dimetric/` (sadece bağımsız eski prop-style hariç), `assets/world-map/owner.bin` gibi çekirdek dosyaların Git SHA'sı değiştirilmedi.
- Kaynak kodun tam `npm run test`, `npm run validate`, tarayıcı smoke testleri yeniden koşulmadan **PASS** etiketi verilmez.
- Silinen belirli dosyalar gerekiyorsa başlangıç commit'inden SHA'yla geri getirilebilir; tarihçe `git reset` veya `git filter-repo` ile yeniden yazılmadı.
- Planlanan sıfırdan 2D asset hattı tamamlanana kadar mevcut harita/kale/şehir *prosedürel* görünümleri kalabilir. Bu temizlik yeni görsel üretim yapmaz.

## Tek tek silinen yollar (76)

- `assets/manifest.json` (631 B)
- `assets/settlements/fort-main-game.png` (316495 B)
- `assets/settlements/fort-main.png` (1022295 B)
- `assets/settlements/generated/README.md` (645 B)
- `assets/settlements/generated/city.png` (317147 B)
- `assets/settlements/generated/factions/ottoman/city.png` (317147 B)
- `assets/settlements/generated/factions/ottoman/fort.png` (942558 B)
- `assets/settlements/generated/factions/ottoman/town.png` (352780 B)
- `assets/settlements/generated/factions/ottoman/village.png` (17941 B)
- `assets/settlements/generated/fort.png` (942558 B)
- `assets/settlements/generated/town.png` (352780 B)
- `assets/settlements/generated/variants/homm/city.png` (371299 B)
- `assets/settlements/generated/variants/homm/fort.png` (515321 B)
- `assets/settlements/generated/variants/homm/town.png` (226228 B)
- `assets/settlements/generated/variants/homm/village.png` (35200 B)
- `assets/settlements/generated/variants/stronghold/city.png` (317147 B)
- `assets/settlements/generated/variants/stronghold/fort.png` (942558 B)
- `assets/settlements/generated/variants/stronghold/town.png` (352780 B)
- `assets/settlements/generated/variants/stronghold/village.png` (17941 B)
- `assets/settlements/generated/village.png` (17941 B)
- `assets/settlements/stronghold/tower-left-v2.png` (73933 B)
- `assets/settlements/stronghold/tower-left.png` (76964 B)
- `assets/settlements/stronghold/tower-right-v2.png` (76905 B)
- `assets/settlements/stronghold/tower-right.png` (69644 B)
- `assets/settlements/stronghold/wall-front-v2.png` (61992 B)
- `assets/settlements/stronghold/wall-front.png` (40301 B)
- `assets/settlements/stronghold/wall-left-v2.png` (49455 B)
- `assets/settlements/stronghold/wall-left.png` (63975 B)
- `assets/settlements/stronghold/wall-only-composite.png` (31284 B)
- `assets/settlements/stronghold/wall-only-plain-source.png` (73540 B)
- `assets/settlements/stronghold/wall-only-source.png` (40301 B)
- `assets/settlements/stronghold/wall-plain-v2.png` (62509 B)
- `assets/settlements/stronghold/wall-plain.png` (73540 B)
- `assets/settlements/stronghold/wall-right-v2.png` (48389 B)
- `assets/settlements/stronghold/wall-right.png` (47092 B)
- `assets/stronghold/world/ground/tile_land3_001.png` (10757 B)
- `assets/stronghold/world/ground/tile_land3_050.png` (7116 B)
- `assets/stronghold/world/ground/tile_land3_120.png` (7862 B)
- `assets/stronghold/world/ground/tile_land8_001.png` (6055 B)
- `assets/stronghold/world/ground/tile_land8_020.png` (6042 B)
- `assets/stronghold/world/ground/tile_land8_040.png` (5260 B)
- `assets/stronghold/world/ground/tile_land8_060.png` (5519 B)
- `assets/stronghold/world/ground/tile_land8_090.png` (5615 B)
- `assets/stronghold/world/ground/tile_land8_120.png` (5344 B)
- `assets/stronghold/world/trees/tree_birch_35.png` (37997 B)
- `assets/stronghold/world/trees/tree_birch_54.png` (78309 B)
- `assets/stronghold/world/trees/tree_chestnut_44.png` (141401 B)
- `assets/stronghold/world/trees/tree_oak_41.png` (117120 B)
- `assets/stronghold/world/trees/tree_pine_103.png` (96339 B)
- `assets/stronghold/world/trees/tree_pine_127.png` (28579 B)
- `assets/stronghold/world/trees/tree_pine_138.png` (14633 B)
- `assets/stronghold/world/trees/tree_pine_42.png` (65948 B)
- `assets/stronghold/world/trees/tree_pine_73.png` (38260 B)
- `assets/stronghold/world/trees/tree_shrub1_20.png` (20959 B)
- `assets/stronghold/world/trees/tree_shrub2_17.png` (11817 B)
- `assets/terrain/main-ground-diamond.png` (3540 B)
- `assets/world-map/extraction-diagnostics.json` (51994 B)
- `js/data/homm3-map-art.json` (4519473 B)
- `js/rendering/battle-renderer.js` (9878 B)
- `js/rendering/canvas-renderer.js` (20950 B)
- `js/rendering/city-renderer.js` (10690 B)
- `js/rendering/dimetric/prop-style.js` (4072 B)
- `js/rendering/map-renderer.js` (62521 B)
- `js/rendering/minimap-simple.js` (6178 B)
- `js/rendering/settlement-style.js` (15290 B)
- `js/rendering/sprite-generator.js` (80660 B)
- `js/world/chunk-manager.js` (4025 B)
- `scripts/extract-homm3-ground-palette.mjs` (10774 B)
- `scripts/extract-homm3-map-art.mjs` (17375 B)
- `sprite-preview.html` (2651 B)
- `tests/unit/dimetric-prop-style.test.js` (2692 B)
- `tools/check_full.cjs` (1344 B)
- `tools/find_depth1.cjs` (1322 B)
- `tools/find_extra_brace.cjs` (2725 B)
- `tools/find_syntax.cjs` (1794 B)
- `tools/generate_settlement_sprites.py` (19961 B)
