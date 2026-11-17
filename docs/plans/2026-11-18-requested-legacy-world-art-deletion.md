# FOC Web — Kullanıcı onaylı tam eski dünya / görsel asset silme işlemi

**Tarih:** 18 Kasım 2026  
**Kapsam:** `zxc28tarik/FallOfCavalry` web deposu, başlangıç commit'i `91908e2eab888e2f52ada3d3b6ac9c3d5e728326`. **Unity deposuna dokunulmadı.**

## Kesin kullanıcı kararı

Kullanıcı, **aktif olarak kullanılıyor olsalar bile** eski dünya haritasının veri dosyalarını, kaynak harita görüntülerini, ağaç setini, zemin bitmap'ini, referans arşivini ve HoMM3 paletini **silmemizi** istedi. Yeni dünya, zemin ve tüm görselleri sıfırdan üretmek esastır. Bu silme mevcut dünya görünümünü ve eski kayıtların haritayla uyumluluğunu bozabilir; kullanıcı bu değişimi kabul etmiştir. **Asker görsellerini en sona bırakma kararı korunuyor**; mevcut savaş placeholder'larına dokunulmadı.

## Gerçekten kaldırılan yollar

- Tamamı: `assets/world-map/` (owner.bin, terrain.bin, renkler, manifest, Avrupa haritası PNG'leri, bölge kaynakları ve altı ağaç PNG).
- Tamamı: `assets/terrain/` (main-ground-tile.png).
- Tamamı: `reference/` (eski ham kale görseli ve arşiv README).
- `js/data/homm3-ground-palette.json`.
- Eski dünya kaynağı üreten ve artık girdileri bulunmayan üç script: `scripts/extract-ohm-world-map.js`, `scripts/create-final-numbered-boundary-map.js`, `scripts/create-numbered-boundary-template.js`.

**Toplam:** 21 dosya; 22.337.886 bayt (~22.34 MB). İstenen asıl asset/kaynaklar 22.268.312 bayttır. Silme yalnız yeni `main` çalışma ağacına uygulanır; Git geçmişi bu PR'da yeniden yazılmaz.

### Tam dosya envanteri
- `assets/terrain/main-ground-tile.png` — 2.521.345 bayt; orijinal blob `f9e526f39a77ff145e3906f2a171d4d7047d280e`
- `assets/world-map/europe-1700-boundaries.png` — 2.498.802 bayt; orijinal blob `6e46877c984a4794e58bf30321b223f7bdec6eeb`
- `assets/world-map/europe-1700.png` — 2.474.094 bayt; orijinal blob `202ce74bb6967521e70b4965e7230bef8df2ee8c`
- `assets/world-map/faction-colors.json` — 3.347 bayt; orijinal blob `68163737b9b740922d2c5b537e91f994d19c0f84`
- `assets/world-map/owner.bin` — 3.000.480 bayt; orijinal blob `18af7591537068d9b2b9c7eb9a644356e2a54b96`
- `assets/world-map/region-defs.json` — 1.425 bayt; orijinal blob `3daa2763438fbca1f846e02e60b75781bc2e4e94`
- `assets/world-map/region-seeds.json` — 2.527 bayt; orijinal blob `8575397aecea7db1c47a4b9bfd30a433c57557b8`
- `assets/world-map/terrain.bin` — 3.000.480 bayt; orijinal blob `c8feb0fa7f63db982de50cc1e8c81e809841cbab`
- `assets/world-map/trees/generated/tree_custom_1.png` — 877.009 bayt; orijinal blob `9471f2fcf21a06a9e47782eba8d29225b6e663af`
- `assets/world-map/trees/generated/tree_custom_2.png` — 1.025.708 bayt; orijinal blob `cd18cbbd860331d9194cdb2b6b7834327ac2f80a`
- `assets/world-map/trees/generated/tree_custom_3.png` — 1.073.320 bayt; orijinal blob `884027d0dacad70188fe1cfab3c9ff43c6056eed`
- `assets/world-map/trees/generated/tree_custom_4.png` — 850.417 bayt; orijinal blob `69243cf5cb42a1adf4d54f4429a032515a7ff1ce`
- `assets/world-map/trees/generated/tree_custom_5.png` — 1.000.587 bayt; orijinal blob `a6944953b647f75da1b6231a05de205c51332780`
- `assets/world-map/trees/generated/tree_custom_6.png` — 859.514 bayt; orijinal blob `5a13d1411de200d955f5c6eda24b513611e4937d`
- `assets/world-map/world-map-manifest.json` — 1.848 bayt; orijinal blob `bf9a8f402a74a0fbe4ace7de05d983173a1f894f`
- `js/data/homm3-ground-palette.json` — 119.745 bayt; orijinal blob `525a1c2b59d097ebe6fa50f6aa9e154cff40c828`
- `reference/legacy/README.md` — 635 bayt; orijinal blob `37f162b9189df44febe98dbcc2ef17aa35dcb9fc`
- `reference/legacy/fort-user-raw.png` — 2.957.029 bayt; orijinal blob `733b16dde2ad08efdea348ca7b605ce0019f071b`
- `scripts/create-final-numbered-boundary-map.js` — 9.467 bayt; orijinal blob `fb0fd6209a384bc3f948139353f132032921d5f7`
- `scripts/create-numbered-boundary-template.js` — 11.975 bayt; orijinal blob `60402ee860b7695833ad0d714f5fa910f1d3676f`
- `scripts/extract-ohm-world-map.js` — 48.132 bayt; orijinal blob `8c617a7446d03194e9f8c0a83dd288e3f1a7c8dd`

## Bağlantı değişiklikleri ve çalışma durumları

1. `js/constants/world.js`: `WORLD.MAP_SOURCE` **`asset` → `procedural`**. Bu, yeni asset üretmeden oyunun eski prosedürel jeneratörüyle açılması için **geçici teknik tercih**; yeni tasarlanan 2D dünyaya ilişkin bir sanat kararı değildir.
2. `js/world/world-map-asset-loader.js`: silinen PNG/BIN/JSON statik importları kaldırıldı. Genel parser ve test edilebilir API korundu; varsayılan asset URL'leri null, varsayılan manifest geçersiz. Yeni asset seti verilmeden `load()` anlaşılır hata verir. `?world=asset` artık çalışmaz.
3. `js/managers/WorldGenManager.js`: silinen manifestin zorunlu importu kaldırıldı, yalnız tanı amaçlı eski asset modu değişkenleri korundu.
4. `js/rendering/main-ground-texture.js`: eski bitmap yüklemesi kaldırıldı; renderer API'si korunarak renkli primitive fallback'e izin verilir. Bu yeni görsel değildir.
5. `js/rendering/dimetric/tree-billboard-assets.js`: eski ağaç PNG yüklemesi kaldırıldı; mevcut forest glyph fallback çizim yolu kullanılabilir.
6. `package.json`: silinen jeneratörlere ait üç npm komutu kaldırıldı.

## Hedef / kalite kapısı

- GitHub Vite build'inde hiçbir silinmiş asset dosyası unresolved import üretmemelidir.
- GitHub CI: `npm run validate`, `npm run test` PASS; başarısız testleri yorumlayıp gerekçesiz silmek yasaktır.
- Tarayıcıda eski siyasi sınırlar/harita/zemin/ağaç görsellerinin eksilmesi **beklenen sonuçtur**, tamamlanma iddiası değildir.
- Eski kayıtlar yeni prosedürel harita topolojisiyle uyumsuz olabilir; eski save'ler için otomatik veri göçü **yapılmamıştır**.
- Geliştirme ve kalite görevleri `docs/plans/2d-visual-rebuild-v1/` belgesine bağlıdır.

## Geri dönüş
Silinen her dosya, başlangıç commit'i `91908e2eab888e2f52ada3d3b6ac9c3d5e728326` üzerinden orijinal Git blob SHA'sıyla geri getirilebilir. Git geçmişini kalıcı temizleme işlemi **ayrı ve riskli bir iş** olup bu kullanıcı isteğinde uygulanmadı.
