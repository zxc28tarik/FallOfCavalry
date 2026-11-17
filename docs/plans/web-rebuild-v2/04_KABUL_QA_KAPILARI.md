# WEB V2 — TEST, KALİTE, UÇTAN UCA OYNANABİLİRLİK VE KABUL KAPILARI

## 1. Doğrulama seviyesi
| Kapı | Doğrulama | Kanıt |
|---|---|---|
| QA0 | npm ci, kaynak lint (0 warning), type/dynamic import/asset path, unit, full Vitest, Vite build | GitHub Actions aynı SHA PASS |
| QA1 | start, new game, seed, map create, political owner, camera, pan/zoom, spawn | Playwright trace + console/network/screenshot |
| QA2 | party move, route, settlement interaction, city area & service, inşa ve ekonomi | Browser state/log + fixture |
| QA3 | encounter, deployment, battle, aftermath, save/autosave/load | Gerçek E2E + deterministik envanter |
| QA4 | PNG manifest, alpha/pivot, renderer, fallback, 404, revision | 2D validator + screenshot |
| QA5 | City area fill/building overlays, 3 viewport/2 DPI, İstanbul özel | Kullanıcı review + hitbox E2E |
| QA6 | Data: stable IDs, mapVersion, owner/river/road graph, seed | MapData snapshot + diffs |
| QA7 | Performans: p95 frametime, heap/cache/decode, atlas, 3 zoom/3 density | Cihaz tarayıcı sürümü ve metrikler |
| QA8 | Lisans, provenance, dependency audit, build/export, release | Onaylı dağıtım ve güvenlik raporu |
| QA9 | G13 kullanıcı GO; P0/P1 kalan hata=0; G14 kapı koşulu | GO/NO-GO imzalı kayıt |

## 2. Asgari tarayıcı senaryoları
1. İlk açılış: dev ve production ayrı; HTTP404, console/pageerror, splash render, yüklenme ilerlemesi.
2. Seçili fraksiyon → yeni seed → dünya: map veri alanları geçerli; prosedürel boot tarihsel atlas sanılmaz.
3. Hareket/camera: 0.5, 1.0, 2.0 ve üst sınır zoom; pan/selection/hitbox worldToScreen uyumu.
4. Yerleşim: şehir açılışı → İç Kale sabit → trade/hans/housing/production alanı → servis → inşa → state değişikliği.
5. Görev: al → objective ilerlet → expire/tamamla → save/reload.
6. Savaş: encounter → ordular → deploy → battle (varsayılan motor) → aftermath → ordunun sayısı, kazanç, zarar.
7. Faction/owner: yeni dünya statik owner gösterimi, AI owner transferi, save.
8. Save: yeni sürüm, bozuk kayıt, eski-map kaydı; her senaryoda anlaşılır sonuç.
9. Assets: yanlış manifest veya 404 görselde crash yok; bozuk PNG kabul edilmez; başkasıyla yanlış map yapılmaz.
10. Release: Vite production, CDN/offline sınırları ve gerçek browser ilk sahne.

## 3. Ekran ve görsel test matrisi
WORLD: zemin geçişi, 20x20 tile, kara/deniz, yol/nehir, köprü, şehir/kale/POI, fog/owner; 3 viewport × 4 zoom × düşük/yüksek yoğunluk.
CITY: İstanbul/küçük-orta-büyük Osmanlı, 4 fill seviyesi, inşa öncesi/sonrası, seçim/hotspot, responsive crop ve farklı DPI.
VILLAGE/FORT: world icon vs scene ayrı, kırsal yaşam, kale/kapı/burç bağlantıları, click target.
BATTLE: açık arazi/yol/kale çevresi, HUD, dust/VFX, placeholder asker topluluğu (sınıf değişmez), aftermath.

## 4. Baseline ve performans
96 MB terrain chunk cache konfigürasyonu toplam belleği ifade etmez. Önce gerçek ölç: ilk etkileşim, p50 ve p95 frame time, JS heap peak, decoded images, cache evictions, network bytes, render object count. Sonra hedef cihazlarla kullanıcı kararına sun; keyfî 60 FPS veya +%10 sınırı gerçek veri yoksa kesin vaat değildir. Her PR ilgili eşik ve pre/post screenshot'u taşır.

## 5. PR kabul formu
Task ID; eski plan ID; BASE_SHA; değişen kaynaklar; kullanıcı karar kategorisi; test run URL ve head SHA; browser trace + screenshot; seed/viewport/zoom/artRevision; save fixture; perf delta; provenance ve licensing; bilinen risk; rollback commit; kullanıcı GO/HOLD; nihai statü.

Uygulama statüleri: PLANLANDI → HAZIR → UYGULAMADA → CI_PASS → RUNTIME_PASS → KABUL. Karar gereken işler ONAY_BEKLIYOR; asker görselleri SON_FAZ_BLOKLU. **KISMI_KANIT_MEVCUT yalnız tarihi kanıt; tam kapanış değil.**
