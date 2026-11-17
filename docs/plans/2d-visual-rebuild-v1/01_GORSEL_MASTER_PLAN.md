# FOC WEB — SIFIRDAN 2D GÖRSEL YENİDEN KURULUM MASTER PLANI

**Belge:** V1 · **Tarih:** 17.11.2026 · **Yetkili depo:** https://github.com/zxc28tarik/FallOfCavalry · **İncelenen main HEAD:** `f377c72f0c094f274a72239fa477f996a21af114` (08.06.2026).

## 1. Ne yapıyoruz, ne yapmıyoruz?

**Yapıyoruz:** Tüm oyun içi **nihai görsel içeriği** yeniden, **doğrudan 2D** tasarlıyoruz: dünya zemin dokusu ve geçişler, çevre, su ve yollar, settlement ikonları, köy ve şehir sahneleri, Osmanlı şehir alanları, diğer faction sahneleri, kaleler ve landmarklar, savaşın zemin/çevresi, HUD/menü ve görsel efektler. Ayrı bir son faz olarak asker animasyon ve sprite ailesini ele alıyoruz. Sadece asset değil, onu doğru kadrajda, doğru durumda ve doğru performansla oynatan üretim/entegrasyon sistemini de inşa ediyoruz.

**Yapmıyoruz:** 3D model, 3D kamera, 3D→2D render, Unity/C# portu, dünya sınırlarının baştan çizilmesi, dünya stratejisi/oynanışı kapsamının yeniden yazılması, asker görsellerinin erken üretimi, önceki lisansı belirsiz oyun görsellerinin kopyalanması, yeni resimler sırf güzel diye kayıt ve ekonomi verilerinin değiştirilmesi. Harita sprite’ı ile şehir içi sahne görselini tek dosya sanmıyoruz.

**Kullanıcı tarafından bu konuşmada verilen kararlar:** (K1) web ve Unity bağımsız, (K2) görsel içerik her noktada sıfırdan, (K3) doğrudan 2D, (K4) asker son, (K5) 2D görsel üretimi kullanıcıda ve entegrasyon teknik tarafta, (K6) çok ayrıntılı kontrollü aşamalı plan. **Öneri:** Önce küçük pilot + otomasyon + kontrollü feature flag; mevcut UI/state kimliklerini mümkün olduğunca koru.

**Çelişki çözümü:** Önceki web master planında tüm görseller dondurulmuştu. Kullanıcının daha yeni kararıyla görsel program **planlama ve üretim bakımından yeniden açıldı**, yalnızca **asker görselleri G14’e kadar bloke**. Önceki 72 kayıt silinmez; ilişkili teknik çalışmalar ortak bağımlılık olarak devam eder.

## 2. Projenin gerçek teknik zemini

- Dünya haritası yaklaşık **1995×1504 = 3.000.480 hücre** ve 1648 harita kaynak verisini kullanıyor (`assets/world-map/world-map-manifest.json`). Görsel iş bunun veri doğruluğunu bozmaz.
- Aktif dünya görünümü **64×32 dimetrik tile**, yükseklik parametresi 24 px; `js/rendering/dimetric/projection.js`, `js/managers/RenderManager.js` temel çizim yolu. Gerçekte çalışan renderer ile pasif legacy `js/rendering/map-renderer.js` ayrımı korunur.
- Ana harita şu an zemin görselinde **tek çim biyomu zorlaması** kullanıyor; `WORLD_MAP_FORCE_SINGLE_GRASS_BIOME = true`. Biyom çoğaltma gameplay biome verisini değiştirmek anlamına gelmez. G04’te ayrı görsel katman kararı alınır.
- Dünya zemininin bilinen ana 2D varlığı `assets/terrain/main-ground-tile.png`, runtime bağlantısı `js/rendering/main-ground-texture.js`. Aynı yardımcı savaş zemini için de kullanılıyor; dünya sanatı savaş zemini üzerinde kontrolsüz regresyon yaratmamalı.
- Şehirler `js/data/city-scene-defs.js` içinde 0–100 yüzdeyle ifade edilen **büyük alanlar**, `empty/low/half/full` dolulukları ve `buildingPoolIds` üzerinden tanımlı. Alanların `x,y,w,h` dikdörtgeni hotspot için başlangıçtır, **her binanın nihai piksel pozisyonu değildir**.
- Şehir sahnesi `js/ui/city-services.js` içinde `baseImage` ile background ve parcel hotspotları kullanıyor. `city-scene-defs.js` içindeki `baseImage:null`; mevcut manifestler **şablon**, otomatik gerçek asset entegrasyonu tamamlanmamış.
- `RenderManager.init` SpriteLoader’ı varsayılan **boş inline manifest** ile kuruyor; yeni PNG eklemek görünmesini sağlamaz. G03’te kontrollü kayıt/loader entegrasyonu şart.
- Harita chunk önbelleğinde **96 MB** yapılandırma var. Bu tek başına tüm GPU/JS/image bellek tüketimi sınırı değildir; tarayıcı ölçümü ayrıca gerekir.
- `docs/city-overhaul/04-implementation-master-plan.md` ve `03-faction-art-bible.md` şehir V2 alan düzeninin ve base+overlay+hotspot yaklaşımının kaynağıdır. Askerî/liman alanlarının şimdilik pasifliği korunur.

## 3. Başarı tanımı: “Yüksek kalite” ne demek?

Tek bir güzel PNG değil, aşağıdaki sekiz şartın birlikte sağlanmasıdır:

1. **Kimlik:** 16./17. yüzyıl erken modern Osmanlı/Avrupa atmosferi; karikatür ve fotogerçek arasında tutarlı, hafif resimsi 2D üslup.
2. **Tutarlılık:** Aynı ailede perspektif, ölçek, ışık yönü, nesne gölgesi, renk ve çizgi işçiliği aynı.
3. **Okunabilirlik:** Oyuncu haritada şehir, köy, orman, yol, düşman, seçili işaret ve UI bilgisini arka plandan ayırabiliyor.
4. **Tekrarlanabilirlik:** Tek tek 100 şehir çizmek yerine çok sayıda şehirde doğru yerleştirilebilen 2D asset ve varyant paketi var.
5. **Dinamik doğruluk:** Alan gelişirse yapı görünür, yıkılırsa/gizlenirse doğru durum gösterilir. Görsel ile authoritative game state asla çelişmez.
6. **Teknik güvenlik:** Kırık görsel bozuk save, çökme veya siyah ekran üretmez; fallback var.
7. **Performans:** Geniş haritada pan/zoom, şehirde hotspot ve savaş zemininde yoğunluk ciddi regresyon yaratmaz; gerçek ölçüme dayanır.
8. **Telif / köken:** Üretilen her final asset için kimin, neyle, hangi referanslarla ürettiği, kullanım izni ve revizyonu kayıtlı.

## 4. Üç ayrı kamera / yerleşim sözleşmesi

| Bağlam | Kaynak geometri | 2D yerleşim | Tipik art çıktısı | Yanlış yapılmayacak şey |
|---|---|---|---|---|
| **Dünya haritası** | 64×32 dimetrik tile, 1995×1504 world | tileX/tileY, worldToScreen, pivot/footprint | Zemin/decal, 2D billboard, world icons | Şehir sahnesi piksel konumunu tile sanma |
| **Şehir/köy sahnesi** | `city-scene-defs` yüzdelik area/hotspot, responsive stage | Scene base + bina/alan overlay, `%` veya normalize konum | Ayrı base ve şeffaf overlay PNG | 0–100 area box'u bina `x/y`'si sanma |
| **Savaş alanı** | Mevcut Canvas/Phaser battle kamera kuralları | Battle background/decor, separate UI | Arka plan/decor PNG, parçacık ve ikon | Asker görselini G14 öncesi değiştirme |

Bir ortak **sanat dili** korunacak, fakat üç ekranın resim yerleştirme çözümü bağımsız olacaktır. Bu, 2D’deki en büyük teknik kalite güvencesidir.

## 5. Programın fazları ve zorunlu sırası

| Kapı | Faz | Somut amaç | Faz sonunda teslim | Başlama kuralı |
|---|---|---|---|---|
| G00 | Kapsam ve karar yönetimi | Korumak/yapmak/yapmamak | Karar ve GitHub değişiklik protokolü | İlk |
| G01 | Hasar tespiti | Gerçek aktif görseller ve sorunların kanıtı | Görsel envanter, ekran baz çizgisi, benchmark | G00 |
| G02 | Sanat sözleşmesi | Tek 2D sanat dili | Stil kartları, kamera/pivot/ışık/ölçek kılavuzu | G01 |
| G03 | Asset hattı | PNG→manifest→renderer→test | 2D asset pipeline ve dummy pilot | G02 |
| G04 | **Zemin** | Bütün dünya zeminini sıfırdan 2D kur | Terrain paketleri, transition, cache, smoke | G03 |
| G05 | Doğa | Ağaç/çalı/kaya/orman | Variant/anchor, LOD, küme yerleşimi | G04 |
| G06 | Yol, su, işaret | Dünya geçişlerini tutarlı kıl | Yol/nehir/kıyı/sınır/fog/POI | G05 |
| G07 | Dünya yerleşimleri | Dünya haritası şehir/köy/kale 2D ikonları | Tier/faction/owner durum atlası | G06 |
| G08 | Köy/kasaba sahneleri | Küçük yerleşim görselleri | Köy base, yapı varyantları, hotspot | G07 |
| G09 | **Osmanlı şehir V2** | Tam şehir içi 2D sistemi | Base, 8+ alan setleri, doluluk ve İstanbul | G08 |
| G10 | Kaleler / landmark | Kale/fort/özel yapı ailesi | Küçük/orta/büyük kale ve sur setleri | G09 |
| G11 | Diğer devletler | HRE/Venedik/Polonya/İspanya | 4 tema ve dünya owner fallback’leri | G10 |
| G12 | Savaş arkaplanı, UI, VFX | Asker dışı kalan bütün sanat | Savaş zemini, menüler/HUD, efektler | G11 |
| G13 | Tam kalite/yayın kapısı | Asker dışındaki her ekranı sonlandır | Regresyon, perf, telif, go/no-go | G12 |
| G14 | **Asker — EN SON** | Ayrı onaylı 2D animasyon/atlas | G14 karar sonrası soldier sprites, stress | **G13 kullanıcı kabulü** |

**İlerleme ağacı ve her teslimin tekil görevi:** `03_DETAYLI_GOREV_AGACI.md`. Toplam **215 görev/kapı**, her biri bağımlılık, sorumlu, çıktı ve bitiş kriteriyle tanımlı. Aynı faz içinde bağımsız alt görevler paralel yapılabilir ama **fazın final kabulü** sonraki ana üretimin kapısıdır.

## 6. G00–G03 hazırlık: pahalı başarısızlığı baştan engelle

### G00 / G01: Envanter ve baz çizgi
- Kodun **aktif render yolunu** dondur. Her asset için dosya, hangi ekran, hangi `renderer`, kaç kez yükleniyor, kullanılıyor mu, telif kökeni ne bilgisi toplanır.
- Oyun 1 seed + 3 dünya konumu + `0.5 / 1 / 2` (ve izinli üst zoom) + şehir + kale + savaş arka planında ekran görüntüsü alınır.
- Mevcut görseli neden değiştirdiğimizi **estetik kusur / fonksiyonel bug / teknik borç / telif riski** diye ayır; tahmini sonuç için PASS yazma.
- Verinin korunacağı referans kimlikleri: `settlement.id`, `city.sceneId`, `parcel.id`, `buildingId`, `ownerId`, `tileX/Y`.

### G02: Ortak 2D sanat kitabı
- Harita tile açısı, yapı footprint oranı, en küçük okunabilir siluet, ışık/gölge, malzeme paleti, kalınlık, kenar işleme, perspektif, mevsim/iklim görsel farkları kilitlenir.
- **Dört referans kompozisyonu:** çim+toprak geçişi, orman ve yol, küçük köy, Osmanlı şehir tek alanı. Her biri final resmi olmak zorunda değil; teknik şablonları ve sanat dilini test eder.
- 2D üretim araçlarının marka/formatına bağımlılık yok. Kullanıcı hangi araçta üretirse üretsin **oyuna girecek çıktı 2D PNG ve manifesttir**.
- Şehir/köy ve dünya aynı atmosfer/renk/ışık disiplininde olur, ama tek ortografik perspektife zorlanmaz.

### G03: Görsel montaj hattı
- **Teslim:** kullanıcı 2D PNG, asset ID, kullanım amacı, varsa transparan katmanları, varyant, üretim kaynağı/izin notunu verir.
- **Hazırlık:** dosya adını, RGBA/alpha, boyut, boşluk ve kenar temizliğini, pivot/footprint, outline/gölge standardını doğrula.
- **Yerleşim:** asset manifest → doğru renderer → scene/settlement/parcel ID → correct transform ve z-index → image loader → fallback.
- **Doğrulama:** derleme + birim testi + görsel smoke + save/load + görüntü kıyas + performans. Sorun varsa PR açık, görev `TESTTE` kalır.

**Zorunlu kural:** Dummy PNG ile **ilk tam uçtan uca test** geçmeden gerçek 2D çizimlerin toplu üretimi başlatılmaz.

## 7. G04–G07 dünya yüzeyini gerçekten sıfırdan kur

### G04: Zemin
**İçerik:** Yeşil zemin, kısa/uzun ot varyantları, çıplak toprak, tarım çevresi, kuru/taşlık yüzey, sahil/nehir sınırı, geçişler, yol temasıyla uyumlu boşluklar. Her durumda tile ve chunk sınırları kontrol edilir. Biyom görsel kararı ayrıca verilir; tarihsel owner ve movement bozulmaz. Caching, far-zoom LOD ve temel 96 MB cache kısıtının etkisi ölçülür.

**Kritik örnek:** 20×20 tekrar görseli düzgünse dahi 3 milyon hücrelik sahnede büyük tekrar izleri olabilir. Hem yerel tekrar hem kilometreler ölçeğinde büyük harita görüntüsü zorunlu testtir.

**Kabul:** Yüklemede boş zemin yok; zoomda yırtılma yok; texture seam yok; siyah alan yok; yerleşim işaretleri hâlâ okunuyor; p95 frame süresi ölçülmüş ve mevcut baseline’a göre kabul edilmiş.

### G05: Doğa
**İçerik:** İğne/yapraklı ağaç aileleri, çalı, ot, taş, kaya, orman kenarları, tepe/mountain siluetleri, gölgeler. Bir sprite için çizim kadar **footprint/pivot, z-order, ağaç kümesi dağılımı ve LOD** gerekir.

**Kabul:** Aynı seed aynı ağaçları verir, yollar ve yerleşimler yapraklarla yanlış kapanmaz; üst üste binen canopies gerçek görünecek şekilde sıralanır; uzakta fazla çizim maliyeti üretmez.

### G06: Yollar/su/işaretler
**İçerik:** Ana yol, dar yol, taş yol, iz, köprü, nehir, kıyı, sınır çizgisi, fog of war, seçili nesne/rota, POI ikonları. Gameplay path geometry kendi veri kaynağından gelir.

**Kabul:** Yol bir şehre bitişik fakat görsel olarak kopuk değil; nehir üzerindeki köprü gerçek polylinelara oturuyor; şeffaf owner overlay sınırlar okunuyor; fog bilgi sızdırmıyor.

### G07: Dünya yerleşim ikonları
**İçerik:** Köy, kasaba, küçük/orta/büyük şehir, başkent, kale, karakol; settlement tier ve owner durumuna göre seçilen 2D ikonlar. **Bu ikonlar şehir içi resimlerle aynı şey değildir.**

**Kabul:** 0.5 zoomda şehir ve köy ayrılabiliyor, malik değişince tema yenileniyor, bütün 19 ownerId uygun renk/güvenli fallback alıyor; 5 oynanabilir faction şehir temasından bağımsız.

## 8. G08–G11 yerleşimler ve şehir görseli

### G08: Köy ve kasaba
- Önce oyunda ayrı köy sahnesi akışının bugün **gerçekten var olup olmadığı** doğrulanır. Yoksa grafik görevinin sessizce kapsamlı yeni gameplay ekranı üretmesine izin verilmez; ayrı karar verilir.
- Fakir/orta/zengin; tarım/orman/maden/ticaret gibi roller varsa gerçek oyun verisinden alınır; 2D base, overlay, yol, tarla, çit, fırın/ambar gibi setler yeniden kullanılır.
- Aynı artı 100 köyde kopyalamak yerine 2D kompozisyon varyantları seed ve gerçek role göre kombinlenir; tutarlı ve deterministik olmalıdır.

### G09: Osmanlı şehir V2 — en kapsamlı alt proje
**Korunan yetkili kurallar:**
- İç Kale/yönetim çekirdeği **sabit ve tam dolu**. Surlar, saray, mahkeme/kadılık, cami, medrese, defterhane, reisülküttab, bostancılar.
- Ticaret alanı başlangıçta yalnız **Pazar**; gelişmeyle Bedesten, Lonca Konağı, Gümrük.
- Han alanı başlangıçta yalnız **Han**; tüccar hanı ve kervansaray sonra.
- Konut: fakir/orta/zengin/üst tabaka mahalle setleri.
- Sağlık: Darüşşifa, Büyük Hamam, Eczane.
- Üretim: Tabakhane, Demirci, Marangoz, Dokuma, Boyahane, Sabunhane, Kâğıt, Mumhane, Taş Ustası, Nalbant.
- Gıda: Fırın, Değirmen, Ambar, Kasaphane, Balıkhane. **Kasaphane/Balıkhane üretime dönmez.**
- Meydan/kültür: At Meydanı, Panayır, Anıtsal yapı.
- Askerî alan ve liman/deniz **şimdilik pasif**, sırf PNG çizildi diye oyun kuralı açılmaz.
- Kethüda altyapısı **büyük görsel bina grubu değildir**, arka planda yönetilen sistemdir.
- İstanbul başlangıcı: İç kale tam, üretimde **demirci + marangoz + tabakhane + sabunhane**, kâğıt imalathanesi özel bonus.

**Katman mimarisi:** base scene (yol, zemin, ufuk, sabit çevre) → sabit çekirdek → değişken alan/bina PNG overlayleri → ekran içi işaretleme ve tooltip → hotspot → UI. `areaId` ve `buildingId` eşleşmeleri ortak gerçek veri sözlüğünden alınır. `empty/low/half/full` doluluklar gerçek `cityState` tarafından sürülür. Görsel alanın kendi içindeki X,Y,Z ve pivot verisi ayrıca gerekir; mevcut `x,y,w,h` yalnızca **alan hotspot kutusudur**.

**Örnek uygulama:** `ottoman:trade_area:bedesten:full` asseti yalnız trade_area’da ve Bedesten gerçekten mevcutsa görüntülenir. Şehre girince, binayı yükseltince, savaştan dönünce ve save/load sonrası aynı görünürlük korunur. Başka şehirde aynı Bedesten kullanılabilir ama varsa `scale/offset` şehir varyantına göre manifestten gelir.

**Kabul:** İstanbul + küçük/orta/büyük normal Osmanlı şehri; alan, doluluk, bina görünürlük, hotspot tıklama, servis açılması, save/load ve responsive kadraj geçer.

### G10: Kale/hisar/landmark
Dünya haritası kale **ikon** seti (G07) ile kale **yapı/sahne** seti (G10) ayrıdır. Sur/kule/kapı birleşimleri için 2D köşe ve kenar parçaları üretilecek; sahiplik, kuşatma veya hasar görünümü yalnız mevcut gameplay state tanımlıysa bağlanacak. Hakları belirsiz mevcut Stronghold/HoMM benzeri görseller final üretim olarak kopyalanmaz.

### G11: Diğer devletler
Önce Osmanlı üretim hattı PASS. Sonra HRE, Venedik, Polonya, İspanya temaları; 19-owner harita renkleri ile beş mevcut şehir theme ailesi ayrılır. Eksik özel şehir görünümü olan fraksiyona güvenli 2D fallback teması tanımlanır. Aynı bina aileleri kör kopyalanmaz; malzeme, çatı, kule, aydınlatma korunarak yeniden üretilir.

## 9. G12–G14 son kapılar

**G12 asker hariç:** Savaş alanı zemin/dekoru, savaş arka planı basitleştirme ve HUD, başlangıç ekranı, menü, şehir modalı, ikonografi, hava/ortam efektleri (önceden kapalı olanlar için ayrı kullanıcı kararı). Asker **placeholder** kalır; bu fazda yürüyüş/silah/miğfer/animasyon yapılmaz.

**G13 tam görsel QA:** Her ekran ve 5 tema genel sanat kıyası, 1648 owner ve fog doğruluğu, 3 milyon hücreli harita performansı, kilitli şehir state, screenshot karşılaştırması, asset rights ve rollback testleri. Kullanıcı **GO** demeden G14 açılmaz.

**G14 EN SON asker:** Yalnız önceki kapılar tamamlanınca askerlerin **2D animasyon/katman/atlas** çözümü için ayrı teknik karar; mevcut `SoldierContainer`/Phaser tartışması tekrar burada çözülür. Önce tek asker/tek animasyon pilotu, sonra sınıflar, sonra 300 görünür asker benchmark. Bu master plan askere dair herhangi bir erken üretim yetkisi vermez.

## 10. Çalışma modeli ve proje denetimi

Her görevde sırasıyla: **tasarım görevi → kullanıcı 2D asset teslimi (gerekiyorsa) → format/pivot doğrulama → manifest/entegre → test → ekran görüntüsü kanıtı → kullanıcı kabulü → PR/merge → durum ve karar güncellemesi**.

**Tek iş/tek PR kuralı:** Bir PR mümkünse bir alt özelliği ve onun testini içerir. Devasa asset gönderileri küçük aile paketleri halinde bölünür. Her PR `main` başını ve son test durumunu gösterir. Oyun hiçbir aşamada sadece görsel kod yüzünden açılmaz hale bırakılmaz. Her fazdan sonra en az bir end-to-end oyun smoke ve save/load doğrulaması yeniden yapılır.

**Görev durumları:** PLANLANDI → ÜRETİMDE → ENTEGRASYONDA → TESTTE → KABUL EDİLDİ. Hata: HATA_BULUNDU → DÜZELTİLİYOR → TESTTE. Önkoşul eksikse BLOKLU. Her aşamada kanıt: `artifactId`, `asset revision`, `manifest diff`, `test command`, `test result`, `screenshot`, `commit/pr`, `user acceptance`.

**Projenin bitiş kriteri:** G14 dahil tüm kapsamlı faz kapıları kabul edilmiş; yeni sanat setinde kayıp kritik asset ve kırık hotspot yok; ekranlar tutarlı; gerçek performans kabul edilmiş; lisans kökeni tamam; mevcut oyunun start→map→city→encounter→battle→map döngüsü ve save/load bozulmamış. **Planın tamamlanması, bu projenin fiziksel olarak tamamlandığı anlamına gelmez.**