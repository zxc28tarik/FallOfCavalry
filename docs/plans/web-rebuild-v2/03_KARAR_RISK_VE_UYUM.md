# WEB V2 — KARAR, RİSK, KAPSAM VE ESKİ PLAN UYUMLULUK DEFTERİ

## A. Kesin kararlar (KABUL EDİLDİ)
- K-01 Web, zxc28tarik/FallOfCavalry; Unity, FallOfCavalry-Unity; kodlar ve GitHub ilerlemeleri ayrı.
- K-02 Yeni final sanat tamamı sıfırdan **doğrudan 2D**; 3D/3D-to-2D yok.
- K-03 HoMM3, Stronghold veya başka oyun görüntülerini kopyalamak/telif şüphesiyle final kullanmak yok.
- K-04 Asker görselleri **kesin son faz G14**; G13 + kullanıcı onayı yoksa başlamaz.
- K-05 PR #61 ile asset dünya haritası, eski ağaçlar, zemin, ham referans ve HoMM3 paleti **kullanılsa bile** silindi. Geri otomatik getirilmez.
- K-06 Her yeni iş/plan/MD ve takip dosyası web GitHub'da kaynak ve PR ile saklanır.
- K-07 Şehir V2 büyük alan: tek sabit tam dolu İç Kale; diğer alanlar empty/low/half/full; base + overlay + area hotspot.
- K-08 İstanbul özel profile; Kethüda altyapı büyük bina gibi çizilmez; askerî/liman alanı etkinliği ayrıca karara bağlı.

## B. İlerlemeyi durduran karar kapıları (TASARIM ÖNERİSİ / KULLANICI ONAYI BEKLİYOR)
| Kod | Karar | Olası seçenekler | Öneri (onay değil) | Kapatılmadığında bloklanan |
|---|---|---|---|---|
| KR-DATA-01 | Nihai dünya kimliği | 1648 tarihsel esinli; statik kurgusal; hibrit | Orijinal lisanslı tarihsel iskelet + procedural görsel çeşitlilik | D00/D01 final |
| KR-DATA-02 | Kaynak geodata otoritesi ve belirsizlik | editör tabanlı; harici lisanslı geodata; üretim scripti | Stable ID ve provenance kuralı ile küçük pilot | Dünya genel atlas |
| KR-DATA-03 | Dünya grid ve paketleme | mevcut MapData adapter; yeni tile/chunk | Adapter + benchmark önce; kökten rewrite sonra | D01 tam |
| KR-SAVE-01 | Eski dünya save'lerinin kaderi | uyumsuzluk ekranı; göç; reset | Açık uyumsuzluk bildirimi + sadece doğrulanabilir göç | Save release |
| KR-ART-01 | Sanat dili, pilot görünümü | 4 referans kart | G02 kullanıcı onayı | Toplu 2D üretim |
| KR-CITY-01 | Askerî, liman gameplay'i | kapalı; daha sonraya plan; aktif | Şimdilik mevcut pasif karar | Yeni gameplay |
| KR-BATTLE-01 | Canvas vs Phaser ana motor | Canvas; Phaser; kontrollü iki mod | Kanıtlı parity ve kullanıcı kararı | Motor değişimi |
| KR-RELEASE-01 | Export/satış platformu | Vite bundle; raw export; paket | Vite öncelikli test, sonra nihai karar | RC |
| KR-SOLDIER-01 | G14 açılma izni | kullanıcı GO/HOLD | G13 tam kabulden sonra GO kapısı | Tüm asker art |

## C. Eski iki planın yeni döneme aktarılması
- **Görsel V1**: G00..G14 = 15 faz, 215 detaylı satır. Eski görev ID'leri korunur. G02..G14 görsel görevleri büyük ölçüde halen geçerlidir; G01, G04, G05, G06 ve G07 kaynak girdisi eski owner.bin/terrain.bin varsayımı yüzünden V2 dünya veri kapısına bağlandı.
- **Web V1**: 72 kayıt; yönetim, temel, oynanabilirlik, ekonomi, şehir, quest, diplomasi, savaş, save, release. Kısmi CI/PR temizliği tamamlandı; ancak 72 CSV'deki çoğu iş gerçekte DONE kaydedilmedi. O00 ve Q00 bu işlerin günlük koordinasyon hattıdır.
- **İcra V2**: 131 toplulaştırılmış paket (ayrı +131 ekstra gameplay/asset sistemi değil). Her paketin eski plan referansı CSV'de tutulur; V1 kararları değiştirilmez, açıkça superseded deltasına göre okunur.
- Eski 1648 tarihsel dünya veri toplamı (1995×1504, 3M tile, 19 owner) **geçmiş planın referans değeridir**; PR #61 sonrası yaşayan asset datası değildir. Bunu yeni harita boyutuna zorunluluk olarak taşımıyoruz.

## D. P0 risk defteri
| ID | Risk | Şu an kanıt | Aksiyon / kapı |
|---|---|---|---|
| R01 | CI yeşil ama browser game black screen/boş dünya | Gerçek Playwright smoke yok | K01 browser E2E + screenshot |
| R02 | Tarihsel harita ve sınırlar fiziksel olarak silindi | PR #61 | D00 kullanıcı atlas kararı + D01 orijinal yeni veri |
| R03 | Eski save farklı dünya topolojisiyle yanlış yüklenebilir | Save göç testi yok | WorldRevision + migration/uyumsuzluk ekranı |
| R04 | SpriteLoader boş manifest; asset dosyası kendi kendine görünmez | RenderManager'da inline manifestData:{} | G03 gerçek registry+pilot |
| R05 | Şehir template baseImage:null | city-scene-defs | G09 base/overlay + QA |
| R06 | Procedural haritada siyasi/şehir/yol/nehir sayımları bilinmiyor | Yalnız kaynak yolu doğrulandı | K01 fixture veri sayımı |
| R07 | İki dağıtım yolu aynı olmayabilir | Vite + raw export | Q00 release comparison |
| R08 | Bağımlılıklarda geçmiş 16 uyarı | Eski CI logu, canlı ayrı audit yapılmadı | Production/dev npm audit |
| R09 | Görsel üretim stil/telif tutarsızlığı | Yeni asset yok | G02 pilot review ve G13 provenance |
| R10 | Fazlar ve 215/72 kayıtları geride kalabilir | Eski V1 statüleri açık | K00 per-PR plan sync |
| R11 | Erken asker üretimi kapsamı şişirir | G14 bloke kararı | CI/PR governance |
| R12 | Eski web Git branch'leri depoda kalabilir | branch audit tarihi eski | ayrı ref temizliği, SHA/PR kontrolü |

## E. Yetki ve uygulama protokolü
Yapay zekâ; kanıt inceleme, refactor, asset validator, fixture, test, arşiv ve PR hazırlamayı mümkün olduğunca kendi yapar. Kullanıcıdan yalnız oyun kimliği ve büyük mimari/estetik/battle/save politika kararlarında onay alınır. Onay verilmemiş karar otomatik onaylanmış gibi işlenmez. Görsel kabul kullanıcıdadır; mekanik ve save üzerindeki büyük değişiklikler de kullanıcıya sorulur. Unity repo dokunulmaz.
