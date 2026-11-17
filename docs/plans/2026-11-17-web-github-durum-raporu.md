# Fall of Cavalry — Web Oyunu GitHub Durum ve Devam Raporu

**İnceleme tarihi:** 17 Kasım 2026  
**Kapsam:** Eski tarayıcı oyunu. Unity sürümünü değiştirmek bu incelemenin kapsamında değildir.  
**GitHub:** https://github.com/zxc28tarik/FallOfCavalry  
**Ana dal:** `main`  
**GitHub HEAD:** `f377c72f0c094f274a72239fa477f996a21af114` — 8 Haziran 2026  
**En son birleşmiş PR:** https://github.com/zxc28tarik/FallOfCavalry/pull/50  
**Ayrı Unity deposu:** https://github.com/zxc28tarik/FallOfCavalry-Unity  
**İnceleme kaynakları:** canlı GitHub depo metadata/commit/PR/dosya içerikleri; kullanıcı tarafından yüklenmiş `foc.zip` (PR #50 öncesi kaynak snapshot); `progress.md`, `CLAUDE.md`, `docs/city-overhaul/*`, proje kaynak kodu.

## A. Yönetici özeti

- Web oyunu ayrı, gerçek bir kaynak deposuna sahip; Vite/Vanilla JS/Canvas 2D, isteğe bağlı Phaser savaş prototipi kullanıyor.
- Ana kod hattı, harita, şehir, ekonomi, asker toplama, savaş, diplomasi, karşılaşma, kaydet/yükle gibi sistemler içeriyor. Ancak hepsi final seviyesinde değil.
- Dünya haritası gerçek binary assetlerle **1995×1504 = 3.000.480 tile** ve 19 faction owner ID'si üzerinden kuruluyor; dönem manifesti `1648-12-31`.
- Kullanıcıya açık başlangıç fraksiyon sayısı proje rehberinde 5: Osmanlı, HRE, İspanya, Polonya, Venedik.
- Son grafik kararı, asset tabanlı dünya haritasında **tek çim biyomu**; uzak zoom ve chunk/cache optimizasyonu mevcut. `MIN_ZOOM = 0.5`; hava efektleri kapalı.
- Şehir V2 işlevsel alan veri modeli ve UI kısmı var; Osmanlı tam şehir `base/overlay` görselleri depo teslim alanlarında yok.
- 34 ticaret malı veri kataloğu var; ekonomi stok/fiyat/alış-satış sistemi var. Derin üretim altyapı-etki döngüsünün önemli bölümü şehir planında bekliyor.
- Mayıs sonunda iki katmanlı encounter akışı, Haziran başında sekiz quest şablonu eklenmiş. Ancak quest objective update/expiry çağrıları başka üretim kodlarında görünmüyor ve `SaveManager` quest listelerini kaydetmiyor: entegrasyon eksikliği.
- Normal savaş, `DEBUG.USE_PHASER_BATTLE=false` olduğundan **eski Canvas motoru**. Yeni Phaser `BattleScene` ve modüler `SoldierContainerPool` ayrı bir geliştirme hattı: modüler katmanlar F10 debug testinde mevcut, ana sektör render hâlâ `VisualSoldierPool` kullanıyor.
- Ana dala birleşmiş son PR #50, 17 dosya/2657 eklenen satır; 8 Haziran 2026.
- Açık PR'ler: #28, #29, #30 — büyük ölçüde #31, #32, #33 ile birleştirilmiş işlerin eski alternatifleri. Açık Issue yok. Bunları otomatik merge etmemek gerekir.
- `main` için GitHub Actions çalışması bulunamadı. Eylül 2026 tarihli `Foundation CI` başarılı kayıtları **`codex/impl-*` dallarında** ve web oyununun `main` test güvencesi olarak kullanılamaz.
- Kullanıcının ZIP arşivinde PR #50 eklediği modüler dosyaların bir kısmı yok. Dolayısıyla geliştirme GitHub `main` üzerinden yapılmalı, ZIP yalnız ek kaynak/yedek olmalı.

## B. Sistem matrisi

| Alan | Elimizde olanlar | Durum | Sonraki doğrulanabilir iş |
|---|---|---|---|
| Başlatma/oyun döngüsü | Start, map, city, battle, encounter, `GameFlowManager`, `ModeManager`; HTML UI | Mevcut | Başlat/yeni oyun/devam/tüm mode dönüşleri smoke testi |
| Dünya haritası | `owner.bin`, `terrain.bin`, manifest, 3M typed-array tile, 19 owner, settlement seed, fog, world map overlay | Mevcut / görsel tartışmalı | Her zoom seviyesinde harita görsel denetimi, köşe ve panning kontrolü |
| Harita grafik/perf | Dimetric renderer, anchor spatial index, terrain chunk cache, biome base, custom grass, far zoom optimizasyonu | Temeli kuvvetli | Düşük/orta donanım benchmark, görsel boşluk/pop-in testleri |
| Dünya varlıkları | Şehir/kale/yerleşim, POI, yol, devriye, kervan, haydut, dünya partileri | Mevcut / kapsam açık | 1648 coğrafya ve spawn/route doğrulaması |
| Şehir V2 | Alan `fill`, building pools, city scene/right panel, sabit iç kale, servis eşleşmesi | Kısmen uygulanmış | Kethüda paneli, kurumsal etkiler, üretim ön koşulları |
| Şehir sanat | Faction klasörleri, manifest şablonları, harita yerleşim sprite'ları | Tam şehir sahne görselleri eksik | Osmanlı base scene ve overlay teslimi; sonra diğer devletler |
| Ticaret | 34 goods, stok, alış-satış fiyatı, piyasa drift, kâr/zarar, taşıma kapasitesi | Mevcut/kısmi | Üretim–stok–tüketim–kervan gerçek döngü entegrasyon testleri |
| İkmal/muhasebe | Erzak, kamp, günlük masraf, moral, ikmal | Mevcut | Çok günlü denge ve negatif kaynak durum testleri |
| Diplomasi/savaş hali | Faction ilişkileri, savaş/barış, savaş puanı, şehir ele geçirme, ticaret/diplomasi etkileri | Mevcut/kısmi | Kaydet/yükle ve şehir sahipliği entegrasyon testleri |
| Dünya AI | Haydut, devriye, kervan, rota davranışları, faction war, event | Mevcut | Oyuncudan bağımsız dünya simülasyonu uzun süre testi |
| Karşılaşmalar | 8 görünür encounter türü, 6 sürpriz tür, koşullu seçenekler, pusu/deploy parametreleri | Mayıs sonunda genişletilmiş | Karşılaşma sonuçlarının harita/ekonomi/orduya yansıması |
| Görevler/kontrat | 8 quest template, gerçek hedef çözümleyici, `QuestManager`, sonuç overlay, eski contract board | Altyapı var, tamamlanmamış | Objective-event bağları, day expiry, SaveManager, UI journal ve E2E |
| Eski Canvas savaş | Formasyon, moral, flank, charge, skirmish, ranged ammo, suppression, AI, loot, yaralı | Varsayılan motor | Battle → aftermath → save/market/diplomasi koşulları regresyon testi |
| Yeni Phaser savaş | `BattleScene`, `SectorManager`, `BattleSimulation`, deploy, sector renderer, `BattleAdapter` | Alternatif geliştirme hattı | Canvas/Phaser geçiş kararı; köprü, casualty/loot/formation karşılaştırması |
| Modüler asker görselleştirme | `SoldierContainer`, pool, frame resolver, F10/F11 testleri | **Debug prototipi**, ana savaşa bağlanmamış | Yeni pool'u sektör çizimine entegre et, gerçek atlas setini hazırla |
| Save/Load | Slotlar, otomatik kayıt, içe/dışa JSON, mevcut oyun verisi | Kısmi | Quest ve yeni savaş/save aktarımı, sürüm migration, roundtrip |
| Kullanıcı deneyimi | Türkçe paneller, HUD, harita overlay, ayarlar, küçük yardım ve codex | Mevcut/kısmi | Tutarlı ekran akışı, responsive/erişilebilirlik/oyuncu onboarding |
| Test/CI | Vitest, ESLint, build scriptleri, smoke checklist | Repo araçları var; **main CI yok** | Web odaklı CI ve tam temiz ortam doğrulaması |

## C. Özellikle karıştırılmaması gerekenler

1. **Unity ve web ayrı.** `FallOfCavalry-Unity` ile `FallOfCavalry` farklı depolar. Eski web deposunda ayrıca `codex/impl-*` Unity temalı dallar bulunuyor; bu dalların başarılı Foundation CI'ları web ana dalı anlamına gelmez.
2. **ZIP tarihsel yedek.** GitHub `main` 8 Haziran PR #50 katman sistemini içerir; ZIP'in dosya listesinde `SoldierContainer.js`, `SoldierContainerPool.js`, `ModularFrameResolver.js`, debug F10 test sahnesi yok.
3. **Mevcut Phaser varsayılan değil.** `js/constants/ui.js` dosyasında `USE_PHASER_BATTLE: false`.
4. **Katman havuzu üretim çiziminde değil.** `BattleScene` `VisualSoldierPool` oluşturuyor; `SectorRenderer` bu havuzla çalışıyor; modüler havuz F10 ayrı testinde.
5. **Quest sürümü bitmiş değil.** `QuestManager.updateObjective` ve `expireQuests` metodları var ama başka üretim JS dosyalarından çağrısı görülmüyor. `SaveManager` quest listelerini işlemiyor. `EncounterManager` bazı UI mesajlarında hâlâ 'Quest system is not implemented yet' diyor fakat alttan görev üretme çağrısı yapıyor.
6. **Harita görünümü önceki HoMM3 aşamasından farklı.** Aktif asset haritası için tek çim biyomu açık, hava efektleri kapalı; Haziran'da özel `main-ground-tile.png` kullanılmış.
7. **City base/overlay teslim alanları boş.** `assets/city-scenes/<faction>/base` ve `overlays` çoğunlukla `.gitkeep`; `assets/settlements/*` haritadaki kale/şehir sprite'ları, tam şehir base scene ile aynı şey değil.

## D. Test ve doğrulama durumu

- `progress.md` son tam eski doğrulamayı **1 Haziran 2026: 502/502 unit PASS**, statik kontrol 0 error / 3 warning, Vite build PASS olarak kaydetmiş; 5–6 Haziran görsel/terrain kontrolleri ayrıca yapılmış.
- **Bu sayılar 8 Haziran PR #50 sonrası güncel `main` için yeni bir doğrulama sonucu değildir.** Web ana dalı için GitHub Actions run bulunamadı.
- Kullanıcı ZIP'ini çalışma ortamına çıkartıp kaynak sözdizimlerini `node --check` ile kontrol ettim: temiz. Conflict marker kontrolü de temiz.
- ZIP'teki mevcut ESLint dosyalarıyla statik kontrol: **0 hata, 6 uyarı**. Bunlar eski ZIP snapshot'ına ait; güncel main'e otomatik taşınamaz.
- Tam Vitest koşusu burada gerçekleştirilemedi: arşivde Windows için paketlenmiş `node_modules` var; Linux gerekli `@rollup/rollup-linux-x64-gnu` modülü yok ve dış internet kapalı. Bu, oyun kodunun test başarısızlığı olarak yorumlanmamalı.

## E. Önerilen web geliştirme sırası

### P0 — Temiz GitHub taban çizgisi (ilk iş)
- [ ] `main` HEAD `f377c72` üzerinden yalnız web için `web/baseline-audit` dalı aç; Unity dallarını karıştırma.
- [ ] Temiz Node/npm kurulumu, `npm ci`, `npm run validate`, `npm test`, smoke E2E çalıştır; kesin PASS/FAIL tutanağı yaz.
- [ ] GitHub Actions'a web CI: lint, tüm unit+adjacent battle tests, Vite build, asset check ekle.
- [ ] Açık eski PR #28–30 için duplicate analizi; gerçek tekrar ise kapat.
- [ ] Kaynak deposundan büyük `tmp/output` ve ham assetlerin durumu/lisansları incelensin; kör silme yapma.

### P1 — Oynanabilir döngüyü kilitle
- [ ] `start -> map -> city -> encounter -> deploy -> battle -> result -> map` otomatik senaryo.
- [ ] Canvas savaş regresyonları; Phaser battle yolu ayrı deneysel feature flag altında.
- [ ] Save/Load roundtrip ve dünya/ordu/ekonomi tutarlılık testleri.

### P2 — Görevler / ekonomi / şehir gerçek entegrasyonu
- [ ] Görev objective güncelleme olaylarını gerçek world eventlerine bağla.
- [ ] Görev süre aşımı, ödül, zincir görev ve quest save/load ekle.
- [ ] Şehir Kethüdası UI + altyapı maliyet/fayda + alan/kurum etki sistemi.
- [ ] Ticaret mallarını üretim/şehir stok/ordu ikmal/kervan akışında kapalı döngüyle test et.

### P3 — Savaş motoru ve modüler asker
- [ ] Canvas savaş ile Phaser savaş arasındaki tek üretim motoru hedefini kararlaştır (öneri: geçişi feature flag ile kademeli test et).
- [ ] Ana `SectorRenderer` ve `BattleSimulation` üzerinde modüler soldier container pipeline entegrasyonu.
- [ ] Gerçek atlas: yön/idle/walk/attack/death + ekipman layer isim standardı + fallback.
- [ ] 150+150 görsel asker, tam katman ve yaralı/ölü animasyonu benchmark.
- [ ] Muharebe sonucu gerçek campaign roster/supply/moral/faction/save üzerine deterministik yansısın.

### P4 — Grafik, şehir sahneleri, dünya
- [ ] İstanbul Osmanlı base scene + overlays; görsel asset manifest ve tıklama alanları.
- [ ] Dünya atlası/çim/orman/nehir/dağ tercihlerini web oyununun kendi hedefi olarak netleştir (Unity'den otomatik kopyalama yok).
- [ ] Kamera zoom, edge pan ve 3M dünya benchmark + görsel kalite.
- [ ] Diğer faction şehir paketleri.

### P5 — Oyun içeriği ve denge
- [ ] Yapay zekâ uzun kampanya simülasyonu, faction savaş ve şehir sahipliği denge.
- [ ] Diplomasi, kontrat, olay, savaş sonrası ekonomi, yenilgi ve campaign bitiş oyun testleri.
- [ ] Rehber, görev günlüğü, kritik HUD uyarıları, UX testi.

### P6 — Web yayın sertleştirmesi
- [ ] Tek tuş production dist + sunucuda test, JS/CSS optimizasyonu, Tailwind CDN yerine yerel derleme.
- [ ] Asset telif/lisans provenance kontrolü: HoMM3/Stronghold ilham/kaynak karışımı tarihçede yer alıyor, ticari dağıtım yetkisi ayrıca doğrulanmalı.
- [ ] Geliştirici menüsü, hata raporu, crash recovery, cross-browser ve düşük performans testi.

## F. Referanslar

- Depo: https://github.com/zxc28tarik/FallOfCavalry
- Web ana dalının son commit'i: https://github.com/zxc28tarik/FallOfCavalry/commit/f377c72f0c094f274a72239fa477f996a21af114
- Modüler savaş PR: https://github.com/zxc28tarik/FallOfCavalry/pull/50
- Yazılı ilerleme: https://github.com/zxc28tarik/FallOfCavalry/blob/main/progress.md
- Oyun rehberi: https://github.com/zxc28tarik/FallOfCavalry/blob/main/CLAUDE.md
- Şehir planı: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/04-implementation-master-plan.md
- Şehir oyun mekaniği: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/05-city-gameplay-mechanics.md
- Savaş geçişi: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/managers/EncounterManager.js
- Modüler asker sahnesi: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/battle/debug/ModularSoldierVisualTest.js
- Asker sektör renderer: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/battle/sector/SectorRenderer.js
- Görev yönetimi: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/managers/QuestManager.js
- Dünya haritası manifesti: https://github.com/zxc28tarik/FallOfCavalry/blob/main/assets/world-map/world-map-manifest.json

**Bu belge yalnızca bir denetim ve önerilen iş sırası kaydıdır. Bu incelemede GitHub koduna/branch'lerine, PR durumuna veya Unity projesine değişiklik yapılmadı.**