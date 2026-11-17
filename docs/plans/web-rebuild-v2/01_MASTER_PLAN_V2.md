# FALL OF CAVALRY WEB — YENİDEN KURULUM V2 / KAPSAMLI MASTER PLAN

**Tarih:** 18 Kasım 2026 · **Yetkili GitHub:** https://github.com/zxc28tarik/FallOfCavalry
**İncelenen main:** 1d48e49854385aed1a9aaf1ee12294173f5335b3 · **CI:** https://github.com/zxc28tarik/FallOfCavalry/actions/runs/44183118822 (success).
**Kapsam:** Web/JavaScript/Canvas/Phaser oyunu. Ayrı FallOfCavalry-Unity deposu kapsam dışı.
**Belge statüsü:** İCRA ÖNERİSİ + kullanıcıdan daha önce alınmış KESİN KARARLAR. Planın yazılmış olması yeni mimari kararları onaylanmış yapmaz.

## 0. Yönetici kararı — oyunun hedefi
Sıfırdan özgün **doğrudan 2D** görsel dil, çok büyük ve oynanabilir bir kampanya dünyası, erken modern Osmanlı/Avrupa atmosferi, canlı şehir-ekonomi-ordu/savaş döngüsü, gösterilebilir küçük oynanış kesiti; kapsamlı içerik genişlemesi kontrollü. Starblade vb farklı projeler bu repo ile birleştirilmez. Burada Unity, 3D, 3D-to-2D üretim hattı YOKTUR. Asker 2D karakter/animasyon görselleri kesin en son G14 fazıdır. Eski HoMM3/Stronghold eserleri yeniden dahil edilmez ve kopyalanmaz.

Başarı; yalnız güzel bir ekran değil, **Start → World → Travel → City → Encounter → Deployment/Battle → Aftermath → Save/Load** zincirini oynanabilir ve doğrulanabilir biçimde bitirmek, aynı dünyayı tekrar açtığında tutarlılık, sıfır fatal runtime, doğrulanmış görüntü tutarlılığı ve kullanıcı estetik kabulüdür.

## 1. Güncel gerçek durum (kanıt ayrımı)
- Güncel main: 1d48e49854385aed1a9aaf1ee12294173f5335b3; Git tree 322 blob / 2.774.977 byte ≈ 2,77 MB. Git geçmişi boyutu farklıdır.
- GitHub Actions #44183118822 başarılı: kilitli bağımlılık kurulumu, lint/static, Vitest ve Vite production build. Bu **gerçek tarayıcı E2E ve görsel onay** değildir.
- PR #61 ile 21 dosya/22.337.886 byte kaldırıldı: asset dünya haritasının tüm BIN, siyasi renk, eski manifest ve PNG girdileri; altı ağaç, ana zemin, legacy referans; HoMM3 paleti; üç artık geçersiz üretim scripti.
- Yeni varsayılan WORLD.MAP_SOURCE = procedural. Güncel world generator / MapData var; fakat onaylı tarihsel 1648 world geodata **YOK**. Geçici prosedürel boot nihai harita sanılmamalı. ?world=asset için asset yüklemesi kasıtlı olarak eksik.
- Eski React uygulaması değil, mevcut JS ve Vite projesi: js/managers/WorldGenManager.js, js/world/map-data.js, js/world/world-generator.js, js/managers/RenderManager.js; şehirde js/data/city-scene-defs.js ve js/ui/city-services.js; savaşta mevcut Canvas ve alternatif Phaser, save manager korunmuştur.
- SpriteLoader default inline manifestData boş; city-scene-defs.js baseImage:null; city-scene template dosyaları gerçek PNG değildir.
- assets/battle altında yalnız 6 placeholder atlas/JSON; assets/city-scenes altında 16 şablon/gösterici dosyası kaldı. Bunlar planlı korunuyor.
- Görsel V1 defterinde 215 kayıt = 200 yapılabilir iş + 15 çıkış kapısı; mevcut durum 204 PLANLANDI, 11 EN_SON_BLOKLU. Genel web V1'de 72 kayıt var, 69 AÇIK, 3 DONDURULDU. **V1 statülerini DONE'a çevirmedik.**
- Önceki V1 kaynakta "1648 owner.bin/terrain.bin korunacak" ifadesi bu kullanıcı kararıyla GEÇERSİZDİR. V1 detay ve alan sözleşmesi yaşayan bir tarihsel referanstır, güncel icra otoritesi V2/delta'dır.

## 2. Kesin kararlar / yeni karar kapıları
**KESİN:** Web ≠ Unity; tüm yenilenecek final görseller sıfırdan orijinal ve doğrudan 2D; eski aktif dünya art/datası geri dönmeyecek; asker görsel fazı son; Osmanlı alan mimarisinde İç Kale sabit, diğer alanlar empty/low/half/full; kullanıcı estetik kabulü; her yeni MD/plan GitHub'da commit; source ve CI kanıtı olmadan DONE yazılmaz.

**ONAY BEKLER:** Nihai dünya 1648 tarihsel harita mı, alternatif kurgusal/static world mü, hibrit mi? Kullanıcının önceki erken modern Avrupa/Osmanlı dünya hedefi güçlü tasarım bağlamıdır, fakat eski veri silindiğinden temsil/geometri yöntemi otomatik onaylı sayılamaz. Öneri: **tarihsel esinli, onaylı sınırlar ve yerleşimlerle statik ana coğrafya + kontrollü procedural terrain/prop üretimi**. Kesin tarihsel doğruluk iddiası kaynak/provenance olmadan kurulmaz. Save eski world geometri göç kararı; Canvas/Phaser ana motor kararı; askeri/liman gameplay aktivasyonu; üretim atlas biçimi ve release/export kararı da ayrı kapıdır.

## 3. Yeni teknik mimari: dört otorite + üç görüntü bağlamı
1. **GeographyWorld:** Onaylı kıyı/su/yer şekilleri, koordinat, yol/nehir graph, region/crossing. Üretilmiş desen değildir; küçük bir pilot bölge üzerinden doğrulanır.
2. **Political/SettlementWorld:** factionId, provinceId, ownerId, settlementId, city tier, route graph, başlangıç/konum, tarihsel certainty. Siyasi sınırlar yalnızca görsel sprite ile tutulmaz.
3. **Authoritative Runtime MapData:** js/world/map-data.js ile tipli layer ve save/worldRevision sözleşmesi; hareket, AI, şehir ekonomisi, path ve kampanya logic için tek okunacak otorite. Yeni dünyaya adapter ile bağlanır. SaveManager ağır PNG/veri içine base64 gömmez.
4. **Presentation World V2:** Manifest + özgün 2D tile/atlas/decal/prop; seed + tile + assetRevision determinism; ayrı render/LOD/cache. State'i güncellemez.
**Üç görüntü bağlamı:** Dünya dimetrik 64×32 görünüm; şehir yüzde/normalize alan ve contentRect; savaş kendi kamera zemini/HUD. Birinin piksel koordinatı diğerine körlemesine kopyalanmaz.

**Mimari öneri; onaylanmadı:** Yeni geodata pipeline küçük ve izlenebilir source JSON/geo çizimleri ve generate step üzerinden MapData'ya çevrilsin; gerekiyorsa derleme esnasında chunk-packed veri üretilebilir. Kullanıcı "eski BIN'leri sil" kararını ihlal edecek şekilde aynı eski assetler yeniden commit edilemez. Yeni formatların her biri performans ve provenance karşılaştırmasından sonra seçilecek.

## 4. 18 iş hattı, 131 V2 yürütme paketi
V2 paketleri **eski 215+72 görevin üzerine eklenecek yeni 131 bağımsız iş değildir**; var olan atomik görevleri ve eksik yeni dünya veri hattını kapsayan **yürütme/bağımlılık koordinasyon kayıtlarıdır**. Detaylı G00–G14 görevleri ve eski 72 görev silinmedi. Tek statü otoritesi önce V2 icra satırından bakar, atomik alt işin durumunu kendi orijinal dosyasıyla kanıtlar.

| Hat | Hedef | V2 paket | Ön koşul | Eski plan ilişkisi |
|---|---|---:|---|---|
| K00 | Karar ve plan uzlaştırma | 6 | - | G00 / web G |
| K01 | Oynanabilirlik ve tarayıcı tabanı | 7 | K00 | G01 / web T,F |
| D00 | Yeni dünya verisi karar ve kaynak stratejisi | 9 | K00,K01 | G01,G04,G06,G07 |
| D01 | Harita veri üretim ve runtime adaptörü | 7 | D00 | G04,G06,G07 |
| G02 | Özgün 2D sanat kimliği | 6 | K01 | G02 |
| G03 | 2D asset entegrasyon hattı | 8 | K01,G02 | G03 |
| G04 | Dünya zemin katmanları | 7 | D01,G03 | G04 |
| G05 | Orman, doğa, kaya ve topoğrafya | 6 | G04 | G05 |
| G06 | Su, yollar, geçitler ve sınırlar | 7 | D01,G05 | G06 |
| G07 | Dünya yerleşimleri ve POI | 6 | D01,G06 | G07 |
| G08 | Köy ve kasaba sahneleri | 5 | G07,G03 | G08 |
| G09 | Osmanlı şehir V2 ve İstanbul | 12 | G08,G03 | G09 / city-overhaul |
| G10 | Kale, hisar ve landmark | 5 | G09 | G10 |
| G11 | Diğer medeniyetler | 6 | G10 | G11 |
| G12 | Savaş çevresi, HUD ve VFX — asker hariç | 8 | G11 | G12 |
| O00 | Oynanış ve sistem entegrasyonu | 10 | K01,D01 | web F,E,C,Q,D,B,S,U |
| Q00 | Yayın kalitesi, test ve performans | 10 | K01,D01,G12,O00 | G13 / web R,T |
| G14 | Asker sprite / animasyonları — son faz | 6 | Q00 | G14 |

**Durum dağılımı:** KISMI_KANIT_MEVCUT: 4 · PLANLANDI: 96 · ONAY_BEKLIYOR: 25 · SON_FAZ_BLOKLU: 6. KISMI_KANIT_MEVCUT, kullanıcı kabulü veya faz kapanışı demek değildir.

## 5. Kritik yol / sıralama
**Hemen:** K00 → K01 ve D00 → D01. Bu süre içinde G02 sanat kimliği tasarlanabilir; G03 dummy pilot sanatsal üretimi değil teknik bağlantıyı gösterir. Harita veri D01 ve G03 birlikte hazır olunca G04 zemin yapılır. G04 → G05 → G06 → G07 → G08 → G09 → G10 → G11 → G12 → Q00/G13 → G14.

**Paralel:** O00 oyun mekanikleri K01 veri-fixture kanıtını geçince birden fazla küçük PR'da ilerler. Risk ve CI işi Q00 erken başlar; Q00 nihai kapısı G12/O00 bitince kapanır. Aynı fazın bağımsız kod/data/asset işi birbirini beklemeden işlenebilir; büyük faz kapıları öne çekilmez.

**M1 Stabil başlangıç:** eski dünya silindikten sonraki gerçek oyun açılışı, save ve savaş döngüsü raporu. M2 Dünya veri pilotu: onaylı dünya türü/şema, küçük coğrafya ve MapData adaptörü. M3 2D pipeline: kendi PNG/registry/placement/validator browserda. M4 Görsel dünya: yeni zemin/doğa/su/yol/sınırlar + ikonlar. M5 Şehir: köy ve Osmanlı V2, İstanbul dahil. M6 Genişleme: kaleler, 4 medeniyet, battle bg+UI. M7 Art-freeze+RC: QA, performans ve GO/NO-GO. M8 Soldier **yalnız M7 kullanıcı kabulünden sonra**.

## 6. K00–K01: kaynak ve gerçek oyun başlangıcı
- Main commit, branch/PR borcu, 215/72 plan eşlemesi; yanlış eski kararların yanına superseded işareti; kanıt ve rollback standardı. GitHub doküman zorunluluğu.
- CI başarılı olması boot kalitesini kanıtlamaz: Playwright'ı package-lock ile, Chromium setup/runner ve ekran raporuyla kur. Testte console/pageerror/unhandled rejection/network 404 yakala.
- Start ekranında faction/seed seçimi; prosedürel harita yükleme; hareket, kamera, seçim; city scene, alan tıklama ve inşa; encounter, deployment, battle, aftermath; save/autosave/load; reload. Bu akışı bir CI browser smoke'a dönüştür.
- Yeni harita fixtüründe şehir/owner, biome, river, road, crossing ve path sayımlarını açıkça raporla. Başarılı build'e karşı siyah/boş haritayı kabul etme.
- Ölçüm: JS heap, frame p95, cache MB, texture decode, ilk etkileşime kadar, 3 viewport, ekran görüntüleri. Sayısal performans eşikleri mevcut ölçümden sonra netleştirilir.

## 7. D00–D01: haritayı sıfırdan, veri ve görsel olarak ayrıştır
**Veri üretim yaklaşımı — karar önerisi:** Statik dünya coğrafyası + 17. yüzyıl fraksiyon/şehir/ana yolları katmanı; canlı politika/save bu veriye dayanır. Raster/vektör üretim yöntemi kanıt olmadan kilitlenmez. İstenirse kullanıcının seçtiği tarihsel/kurgusal/hibrit görünümün bütün oyun üzerindeki etkisi test edilir.

Pilot için: bir kara/deniz sınırı, iki devlet, bir şehir, bir köy, bir kale, bir yol, bir nehir, bir geçit, düz/engebeli zemin, kamera ve kayıt. Bu bir **test kapsamı örneği**, nihai dünya kompozisyonunu dayatan karar değildir.

**Data contract:** worldId, worldRevision, projection, width/height/gridScale, sourceVersion, regions, politicalOwners, settlements stable ID, roadGraph, riverGraph, height/terrain/biome layers, fog, seed, checksum/provenance. Kıyı, owner ve gameplay erişilebilirliği birbirinin yerine kullanılmaz. Oyuncu spawn/world faction/şehir kimliği yeni MapData uyarlamasında stabil tutulur.

**Test:** aynı seed ve data tekrar üretim determinism; otorite tek; denizden geçiş kuralları ve POI/şehir owner bağlantısı tutarlı; yalnız görsel değişince hareket/ekonomi state kaymaz. SaveCompat kararı olmadan eski save "uygun" diye bildirilmez.

## 8. G02–G03: sanat ve entegrasyon altyapısı
**G02:** Dünya için dimetrik 2D/oyunsal siluet; şehir için base+overlay sahne; savaş için farklı kamera. HOMM3 yalnız atmosfer/okunabilirlik esinidir; kopya görsel yok. Dört pilot: çim-toprak, orman-yol, köy/kasaba, Osmanlı tek büyük alanı. Aynı ışık/palet/siluet; kullanıcı görsel GO.

**G03 kod adayları:** js/visual-v2/VisualAssetRegistry.js, WorldSpriteAdapter, WorldDecalProvider, CityPlacementResolver, SceneVisibilityResolver ve VisualDiagnostics; bunlar **önerilen sınıf adlarıdır, henüz oluşmuş dosyalar değil**. Gerçek ihtiyaç yoksa ekstra sınıf açılmaz. Manifest assetId, revision, faction, variant, sha, alpha, footprint, pivot, layer, LOD, license, source, placement, visibility taşır. Eksik asset güvenli fallback ve görünür uyarıdır.

**İlk uçtan uca gate:** Tek geçici/test 2D ground, tek prop ve tek bina overlay; PNG → validator → manifest → runtime ekran → 3 viewport/zoom → save/load → CI → screenshot. Bu gate geçmeden binlerce asset seri üretilmez.

## 9. G04–G07: dünya görselleri
**G04 zemin:** grass base/alt, soil/path, rock/dry, tarla, coast/water bank; kenar, dış/iç köşe geçişleri, 20x20 tekrar testleri. Terrain/chunk cache var olan RenderManager üzerinden bağlanır, shader/texture/placeholder seçimi kaliteyle test edilir. Yeni görsel biyom gerçek world data'dan türetilir; tek çim-biomu zorlaması görsel tarafta ayrıca çözülür.

**G05 doğa:** yapraklı/ibreli 2D ağaç aileleri; çalı, çiçek/ot, kaya, dağ, yükselti. Önce 1 aile pilotu; sonra atlas/variant. Seedli anchor ve POI/road/river/kale etrafında exclusion; yakın/uzak LOD, gölge ve depth-sort.

**G06 yollar/su/sınırlar:** Kara-su ve kıyı maskleri; yol/polyline overlay; köprü/geçit ile **gerçek hareket graph'ı** birebir. Owner/territory sınırı, keşif/fog, seçim ringi ve path highlight veriyle bağlanır. Rastgele güzel bir nehir "geçiş var" anlamına gelmez.

**G07 dünya POI/settlement:** Village/town/city/capital/fort/landmark; world icon ayrı, şehir/kale yakın planı ayrı. Tier/owner/religion/culture bilgisi oyun modelinden okunabilir ama sırf grafik için din/siyaset kuralı eklenmez. Label, hitbox, action ve culling.

## 10. G08–G09: şehirler ve köyler
**G08:** Köy iç ekranı zaten varsa ona görsel ekle; yoksa bunu yeni gameplay mode gibi gizlice ekleme. İster widget/hizmet ekrani ister sahne türü kararı verildikten sonra base+ev+tarlalar+ambar+ahır+fırın/pazar ve ekonomik/servis görünürlüğü.

**G09 Osmanlı V2 — mevcut kararların aynısı:**
- İç Kale / yönetim çekirdeği her zaman sabit tam: sur, saray, kadılık, cami, medrese, defterhane, reisülküttab, bostancı.
- Diğer büyük alanlar: Ticaret (Pazar/Bedesten/Lonca/Gümrük); Hanlar (Han/Tüccar Hanı/Kervansaray); Konut (fakir, orta, zengin, konak); Sağlık (Darüşşifa/Hamam/Eczane); Üretim (Tabakhane/Demirci/Marangoz/Dokuma/Boyahane/Sabunhane/Kâğıt/Mumhane/Taş Ustası/Nalbant); Gıda (Fırın/Değirmen/Ambar/Kasaphane/Balıkhane); Kültür (At Meydanı/Panayır/anıtsal yapı).
- Alan state: empty/low/half/full. Tek bir "tam şehir" JPG'siyle bitmiş bina ve olmayan bina aynı anda gösterilmez. **Base yalnız kalıcı coğrafya/çevre; dinamik bina RGBA overlay**. Hotspot alan seçer, bina servis seçim menüsünden yönetilir.
- İstanbul sabit çekirdeği görkemli; üretimde demirci/marangoz/tabakhane/sabunhane, kâğıt özel başlangıcı. Bunlar cityState ve save'den görsele aktarılır; grafikten hak kazanılmış bina doğmaz.
- Alt yapı/Kethüda: kuyu, çeşme, sarnıç, yol, drenaj vs büyük ayrı bina gibi çizilmez; servis/infrastructure state olarak kalır.
- Askerî şehir alanı ve liman başlangıçta pasif. Aktivasyon oyun kapsamı kararıdır, sanat üretimiyle otomatik açılmaz.
- En az İstanbul + büyük/orta/küçük Osmanlı şehir, dört fill seviyesi, 3 viewport, save/reload ve bina inşa öncesi/sonrası görsel kabulü.

## 11. G10–G12: kaleler, fraksiyonlar, savaş
**G10:** Hisar, büyük/sınır kalesi, sur köşesi, kule, kapı ve landmark; harita ikonu ve iç/cephe scene ayrı. Büyüklük/garnizon/owner katmanları data-stable.

**G11:** Osmanlı onayı sonrası HRE, Venedik, Polonya, İspanya; aynı oyun alan şemasına farklı çatı, duvar, taş, su ve kule siluetleri. Diğer owner ID'leri için güvenli generic fallback. Tüm devletlere tam şehir çizimi ilk sürümün koşulu değildir.

**G12:** Aktif Canvas savaşında ve deneysel Phaser hattında asker placeholder'ları dokunulmadan kalır. Yeni zemin/alan background, çevre/siper/duman, deployment HUD, selection/sonuç menüleri; BattleResult, hasar, moral, hitbox, ordunun sayısı oyunsal otorite olarak korunur. Yüksek yoğunlukta readability/perf testleri. Asker görsel çalışma G14 öncesi yasak.

## 12. O00 — paralel oyun sistemi geliştirme
- QuestManager görev üretimini, objective updates, expiry, completion overlay, save/load ile tamamla; eksik linkleri E2E üzerinden kanıtla.
- Şehir gelir/vergi/nüfus/üretim, ticaret/caravan, ordu recruitment/logistics ve diplomasi/AI dünyada doğru çalışmalı. Yeni siyasi haritada owner değişimi GUI/harita sınırına yansır.
- Canvas/Phaser geçişini otomatik yapma: iki motor için savaş sonucu, hasar ve save paritesi; ardından kullanıcı seçimi.
- Save worldRevision uyumluluk veya migrasyon/uyumsuz kayıt ekranı ayrı tasarım kararıdır.
- Publisher gösterimi için küçük ama uçtan uca oynanabilir senaryo, oyun tamamlama iddiasıyla karıştırılmaz.

## 13. Q00/G13 — kalite, güvenlik ve yayın kapısı
- **Q0:** Dosya/manifest/CRC/PNG/alpha/ID/provenance validator.
- **Q1:** Birim/mimarî testleri, determinism, save/world revision.
- **Q2:** Render komponent ve 3 viewport; hotspot/pivot/depth.
- **Q3:** Gerçek Playwright browser E2E: start, world, city, battle, aftermath, save/load.
- **Q4:** Kullanıcı sanat kompozisyonu ve faction tutarlılığı kabulü.
- **Q5:** Gerçek cihazda frame p95/FPS/heap/cache/decode ve zoom/pan yoğunluk ölçümü; sayısal sınırlar ölçüm sonrası.
- **Q6:** Lisans/köken, npm audit üretim-dev ayrımı, build/release ve offline/CDN riskleri.
- **Release kapısı:** P0/P1 kritik hata=0, kullanıcının imzaladığı bilinçli istisnalar dışında eksik temel ekran=0; tek sürüm SHA ve rollback; yapılan işin gerçekte göründüğünü screenshot/test log kanıtlar.
- **G14 asker:** G13/Q00 ve kullanıcı "GO" olmadan hiçbir karakter sprite/atlas üretimi başlamaz.

## 14. İlk dört uygulama paketi — şimdi yürütülecek iş emri
**İş A (K00+K01):** 322 dosya / güncel boot source, profesyonel tarayıcı smoke altyapısı, v1 görev farkı ve risk fişi; smoke console/network; yeni seed ile smoke kayıtları; Unity dışarıda. **Kabul:** E2E fatal=0 veya her hata açık etiketli; temel CSS/asset fallback.
**İş B (D00):** Kullanıcıya *dünya veri/harita türü* için net tasarım ve maliyet karşılaştırması; önerilen statik tarihsel-esinli atlas vs kurgusal vs hibrit. **Kabul:** Karar kaydı ve source provenance.
**İş C (D01):** Küçük world graph/map pilotu, stable IDs, MapData adapter + save fixture. **Kabul:** deterministic load, renderer, spawn, owner/road/river consistency, değişmez gameplay state.
**İş D (G02+G03):** Dört sanat kartı + dummy art pipeline. **Kabul:** Kullanıcı görsel onayı ve ilk PNG'lerin üç görüntü bağlamında testli görünmesi.

Sonraki ana paket **G04 grass/soil/rock first**, ardından G05 doğa. Pilot başarısızsa tüm varlık ailesi seri üretilmez.

## 15. Her PR'nin yönetim şablonu
Task ID + orijinal 215/72 çapraz referansı; BASE_SHA; kapsam ve silinen/eklenen dosyalar; oyun state/save değişikliği varsa açık karar; kullanıcı onayı gerekenler; dosya kökeni/lisansı; test run URL + tam SHA; screenshot+viewport/seed; perf delta; rollback; açık hata; görevin **PLANLANDI → UYGULAMADA → TESTTE → KABUL / BLOKLU** kanıtı. Onaysız kapıları otomatik GEÇTİ yazma.

**Tarih ve süre:** Gerçek ekip kapasitesi, asset teslimleri, hedef cihaz ve ilk benchmark oluşmadan haftalık tahminleri taahhüt gibi sunmuyoruz. Sıra ön koşul ve ölçülebilir teslimata bağlıdır.
