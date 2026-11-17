# FOC Web — İkinci Tur Derin Kod ve Asset Denetimi

**Tarih:** 17 Kasım 2026  
**Başlangıç HEAD:** `ba9f75386b5151dd572e2dcdf2a1647120b1da5d`  
**Kapsam:** Yalnız `zxc28tarik/FallOfCavalry` web oyunu. Unity deposu incelenmedi/değiştirilmedi.  
**Durum:** **ANALİZ / READ-ONLY** — bu PR oyun kodu, asset veya Git branch'lerini SİLMEZ.

## 1. Kaynağın mevcut hâli

GitHub `main` ağacı: **341 takip edilen dosya, 25.102.898 bayt**. `assets/`: **37 dosya, 19.223.541 bayt**. `js/`: **182 dosya**, `tests/`: **53 dosya**. Önceki #55, #56, #58 ve #59 temizlik PR'ları birleşmiş durumda.

[GitHub Actions #44088344557](https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44088344557) — **PASS**:
- `npm ci`, statik kontroller, `eslint --max-warnings=0`, üretim Vite build
- **501/501** birim testi; **913/913** çalışan tam Vitest testi; **1 test atlanmış**.
- Atlanan dosya: `tests/smoke/runtime-guards.smoke.test.mjs`, tek test `it.skip(...)`.
- CI'da tarayıcıya girip gerçek görsel, save/load, savaş veya şehir etkileşimi doğrulayan E2E yok.

Git ağacı ve GitHub Actions başarısı tek başına, her bağımsız araç veya tüm tarayıcı akışlarının sağlıklı çalıştığını kanıtlamaz.

## 2. Asset envanterinin ayrıştırılması

| Sınıf | Dosya | Byte | Karar |
|---|---:|---:|---|
| Dünya üretim **kaynak girdileri**: `europe-1700*.png`, `region-seeds.json`, `region-defs.json` | 4 | 4.976.848 | **ARŞİVE TAŞIMAYA ADAY**. `scripts/create-final-numbered-boundary-map.js` ve `create-numbered-boundary-template.js` bu yolları okuyor. Dosyayı veya yolu kodu güncellemeden silmek harita üretimini bozar. |
| Aktif harita verisi: `owner.bin`, `terrain.bin`, `faction-colors.json`, `world-map-manifest.json` | 4 | 6.006.155 | **KORU**. `js/world/world-map-asset-loader.js` doğrudan içe aktarıyor. |
| Aktif zemin ve ağaç görselleri: `main-ground-tile.png`, `tree_custom_1..6.png` | 7 | 8.207.900 | **KORU**. `main-ground-texture.js` ve `tree-billboard-assets.js` Vite `?url` import'ları kullanıyor. Yeni 2D görseller geçene kadar kaldırılmaz. |
| Savaş placeholder'ları: `tiny_swords_*.png/json` | 6 | 30.036 | **KORU**. Asker görselleri kullanıcı kararıyla en son aşama. `js/battle/config/visualProfiles.js` tarafından kullanılıyor. |
| Beş fraksiyona ait şehir manifest şablonları / boş klasörler / README | 16 | 2.602 | **KORU**. Sıfırdan 2D şehir üretimi için yer tutucu teslim alanı. |
| **Toplam** | **37** | **19.223.541** | **Aktif / kaynak / planlı dosyalar ayrıldı** |

Diğer kaynak: `reference/legacy/fort-user-raw.png` yaklaşık 2,96 MB. Oyun asset'i değil; kullanıcıdan gelmiş olabilecek ham kaynak olarak önceki temizlikte korunmuş. Kaynağı/lisansı kesinleşmeden topluca silinmez veya yeni görsel olarak kullanılmaz.

## 3. Kullanılmayan, ertelenen ve yarım bağlı kodların ayrımı

### A — Silinmemesi gereken aktif veya gelecek için korunan

- **Phaser savaşı**: `js/constants/ui.js` içindeki `DEBUG.USE_PHASER_BATTLE=false` mevcut varsayılan Canvas savaşını seçiyor. Ancak `EncounterManager.js` ve `InputManager.js` üzerinden dinamik `import('../battle/BattleBoot.js')` mevcut. **Yalnız statik import grafiğine bakarak `js/battle/**` dosyalarını silmek hatalı olur.**
- **Tuning arayüzü**: `TuningManager.js` `import('../ui/tuning-ui.js')` yoluyla geç yüklüyor. Ana dosyada doğrudan import yok diye atıl sayılmaz.
- **Eski isimli dünya renderer'ları**: `RenderManager.js`, `legacy-world-terrain-renderer.js` ve `legacy-world-overlays.js` modüllerini doğrudan içe aktarıyor. Bunlar dev/alternatif kamera durumunda hâlâ gerçek çalışma yoludur. Silinmez.
- **Procedural dünya üreticisi**: `WorldGenManager.js` `WorldGenerator`'ı içe aktarıyor; `?world=procedural` seçeneği tanımlı. `ALLOW_PROCEDURAL_FALLBACK=false` sadece asset yükleme başarısızlığında otomatik fallback davranışını sınırlar. Prosedürel üretici hiçbir zaman çalışmıyor varsayımı yanlış olur.
- **`js/battle/debug/`**: `BattleBoot.js` stres testi ve modüler asker görsel test sahnelerini içe aktarıyor; F tuşlarıyla tanılama iş akışı var. Asker fazından önce silinmez.

### B — Tamamlanmamış ama otomatik silinmemesi gereken sistemler

- **Görevler**: `QuestManager.js` ve `QuestGenerator.js` gerçek oyunda `js/main.js` üzerinden başlatılıyor; `EncounterManager.js` görev oluşturabiliyor. Ancak GitHub kod aramasında `updateObjective(` ve `expireQuests(` çağrıları yalnız `QuestManager.js` içinde görülüyor. `SaveManager.js` içinde `questManager.activeQuests` serileştirmesi tespit edilmedi. **Görünürde yarım entegrasyon**: silmek yerine ilerleme, süre ve save/load testleriyle tamamlanmalı; ürün kapsamı dışındaysa kullanıcı kararı istenmeli.
- **Şehir 2D sahneleri**: `js/data/city-scene-defs.js` `baseImage: null` veriyor. `city-state.js` ve `city-services.js` boş sahnede uyarı/etiket fallback'i sağlıyor. Yeni görseller eksik olduğu için sistemi silmek doğru değil; G09 görsel planı kapsamında tamamlanacak.

### C — Önemli veri akışı riski: varsayılan harita

`js/managers/WorldGenManager.js` asset haritasını yükledikten sonra (satırlar 163–166) `mapData.settlements`, `roads`, `rivers`, `crossings` alanlarını **boş dizilerle** sıfırlıyor. `terrain-scene-renderer.js` sonrasında `map.roads` ve `map.rivers` dizilerini çizim amacıyla dolaşıyor. Diğer giriş noktaları ve kayıt yüklemesi üzerinden sonradan nasıl dolduruldukları **tarayıcı içinde yeniden doğrulanmalı**.

Bu, özellikle sıfırdan 2D yol/nehir/şehir görseli geliştirme işinde kritik olabilir. Veri akışını doğrulamadan “görsel yok” diye asset üretmek doğru teşhis olmayabilir.

## 4. Yayın, test ve bağımlılık altyapısı

- **İki dağıtım yolu**: `npm run build` Vite ile bundle üretir. `npm run build:export` içindeki `tools/export-build.mjs` ise `index.html`, `css/`, `js/`, `assets/` klasörlerini doğrudan kopyalar. **Ayrı çıktı üretimleri**; `BattleBoot.js` `import Phaser from 'phaser'` gibi bare specifier kullanıyor. Bu yüzden elle kopyalanan paketin Phaser etkin olduğunda tarayıcıda aynı çalışacağı garanti değil. Önce karşılaştırmalı E2E, sonra tek yayın hattı.
- **Tarayıcı smoke kopukluğu**: `tools/web_game_playwright_client.mjs` dosyası `import { chromium } from 'playwright'` yapıyor, fakat `package.json` içinde doğrudan Playwright bağımlılığı tanımlı değil. `npm run validate:smoke` GitHub CI'da çağrılmıyor. Playwright kurulumu, browser bağımlılığı, hata/ekran karşılaştırması tamamlanmalı.
- **Atlanmış test**: `tests/smoke/runtime-guards.smoke.test.mjs` gerçek `it.skip` içeriyor. Dosyayı sırf temizlik için silmek değil, çalışır tarayıcı testiyle değiştirmek gerekir.
- **Bağımlılık güvenliği**: `npm ci` CI logu **16 advisory: 7 moderate, 6 high, 3 critical** bildiriyor; bu sayı üretim bağımlılığı sayısı değildir. `npm audit --omit=dev --json` ve tam audit ayrımı yapılmalı. Körlemesine `npm audit fix --force` yapılmamalı.
- **Harici runtime CSS/JS**: `index.html` Tailwind'i `https://cdn.tailwindcss.com` üzerinden yüklüyor. Offline kullanım ve üçüncü taraf bağımlılık açısından ayrı paketleme kararı gerekiyor. Test edilmeden CDN satırı silinirse görünüm bozulabilir.

## 5. Önceliklendirilmiş sonraki kararlar

| Öncelik | İş | Silme kararı | Kabul kanıtı |
|---|---|---|---|
| P0 | Playwright browser smoke kur/CI'ya bağla; başlatma, harita, şehir, savaş, kayıt akışlarını gör | Kod silme yok | Görsel + runtime hata + save/load raporu |
| P0 | Varsayılan asset dünyada yol/nehir/geçit/yerleşim dizilerini test et | Veri silme yok | Yeni oturum ve kayıt yükleme sonrası sayım |
| P1 | Harita üretimi kaynak 4 PNG/JSON girdilerini ayrı `reference/map-sources/` altında tut, script path'lerini değiştir | **Taşı, silme** | İki jeneratör script'i doğrulanmış |
| P1 | İki release yolunu karşılaştır; tek desteklenen build/export kararı ver | Değerlendirme sonrası eski yolu kaldır | Vite ve export çıktı smoke karşılaştırması |
| P1 | Görev ilerleme, son tarih ve save/load entegrasyonunu tamamla | Kullanıcı kararı olmadan silme | Quest E2E ve yeniden yükleme |
| P1 | npm security audit (production/dev ayrı) | Kanıtlanmış gereksiz paketleri kaldır | Audit raporu + eski/yeni CI |
| P2 | Placeholder şehir manifest, prosedürel yerleşim ve asker debug kodlarını gerçek 2D varlıklarla değiştikçe tekrar denetle | **Şimdi koru** | Her asset'in yeni karşılığı gerçek oyunda kanıtlı |
| P2 | Çift kaydedilmiş branch'leri SHA ve bağlı PR bazında temizle | Kod değişikliği değil, ref temizliği | Tam SHA/PR kontrolü, kullanıcı kararı |

## 6. Bu tur için karar

**Hiçbir ek kaynak dosyasının doğrudan, sıfır riskli silme adayı olduğu kanıtlanmadı.** Geriye kalanların bir kısmı **kullanılan**, bir kısmı **planlanan**, bir kısmı **kaynak üretim girdisi**, bir kısmı ise **eksik entegrasyon**. Bir sonraki temizlik çalışması **tarayıcı E2E kanıtı + git SHA/PR + kullanıcı tarafından onaylı mimari seçim** kapısını geçmeli.

**Bu denetim PR'ı yalnız belgedir; oyun kaynak kodunu, assetleri, silinecek Git branch'lerini ve Unity deposunu değiştirmez.**
