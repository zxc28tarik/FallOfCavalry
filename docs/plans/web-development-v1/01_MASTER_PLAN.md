# FALL OF CAVALRY — WEB BAĞIMSIZ GELİŞTİRME MASTER PLANI (V1)

**Tarih:** 17 Kasım 2026  
**Kapsam:** Sadece `zxc28tarik/FallOfCavalry` web oyunu; Unity projesi bu planın kapsamı dışındadır.  
**Durum:** Denetim ve planlama belgesi; kod değişikliği yapılmadı.  
**GitHub:** https://github.com/zxc28tarik/FallOfCavalry  
**İncelemede doğrulanan web/main commit:** `f377c72f0c094f274a72239fa477f996a21af114` (8 Haziran 2026).  
**Ayrı Unity deposu:** https://github.com/zxc28tarik/FallOfCavalry-Unity

## 0. Yönetici özeti ve alınmış kararlar

**Kullanıcı tarafından bu oturumda kesinleştirilenler (`USER_DECIDED`):**
1. Web oyununu Unity masaüstü sürümünden **bağımsız** geliştirmek.
2. **Yeni çizim, sprite, görsel kalite ve içerik sanatı** işlerini ertelemek; mevcut geçici görselleri testte kullanmak.
3. Kod değişikliğine başlamadan önce **hasar tespiti, bütüncül plan, ilerleme ağaçları, iş teklifleri ve uygulama yöntemlerini** düzenlemek.

**Henüz kullanıcı tarafından onaylanmamış öneriler (`PROPOSED`):**
- Web için tek geliştirme doğrusu `main` üzerinden dallanan korumalı çalışma dalı; Unity temalı `codex/impl-*` dallarını web üretimine karıştırmama.
- Geçici olarak **Canvas savaşını üretim motoru olarak koruma**, Phaser/modüler savaşını bağımsız deneysel hat olarak olgunlaştırma; parity kanıtı ve açık onay olmadan motoru değiştirmeme.
- Kodun tamamını sıfırdan yazmama; önce mevcut modülleri koru / düzelt / entegre et / gerekiyorsa yeniden yaz sınıflandırması.
- Tam test ve oyun döngüsü geçmeden yeni mekaniğe geçmeme.
- Her paketin sonucunu test kanıtı, commit, bilinen eksik ve ilerleme durumuyla takip etme.

## 1. Kanıt düzeyi, durum sözlüğü ve hasar dereceleri

**Kanıt:** `V` = GitHub ana dalında doğrudan kod/belgeden doğrulandı; `H` = tarihsel ilerleme kaydında doğrulandı, bugünkü davranış kanıtı değil; `R` = şüpheli risk, yeniden test gerekli; `Ö` = tasarım önerisi.

**Durum:**
- `MEVCUT_DOĞRULANDI`: Kaynak ve davranış testleri mevcut / yeniden doğrulanmış.
- `KOD_VAR_TEST_BEKLİYOR`: Kaynak kod var, güncel ana dalda gerçek oyun doğrulaması yok.
- `KISMİ`: Bazı akışlar uygulanmış, uçtan uca bağlantı eksik.
- `AÇIK`: Yapılacak iş.
- `BLOKLU`: Ön koşulu veya kullanıcı kararı var.
- `DONDURULDU`: Çizim ve sanat gibi bilerek ertelenen iş.
- `TAMAMLANDI`: Kabul ölçütü + test/log/PR kanıtı ile kapatıldı.

**Öncelik / şiddet:** `P0` veri kaybı, başlatamama, engelleyici çökme; `P1` oynanabilir döngü/temel sistem bozukluğu; `P2` sistem kısmi, denge veya entegrasyon hatası; `P3` iyileştirme/temizlik. **Risk** ile **doğrulanmış bug** farklıdır; aşağıdaki her satırda bu ayrım korunur.

## 2. Kaynak envanteri ve korunacaklar

| Kaynak | Mevcut durum | Kullanım ilkesi |
|---|---|---|
| `main` | HEAD `f377c72`; PR #50 birleşmiş (V) | Birincil yazılım kaynak sürümü |
| `foc.zip` | PR #50'den önceki snapshot (V) | Referans/yedek; ana dala körü körüne geri yüklenmez |
| `progress.md` | Mayıs–Haziran oyun değişiklikleri, test sonuçları (V/H) | Tarihsel kanıt; bugünkü PASS yerine geçmez |
| `CLAUDE.md` | Web mimarisi, oynanış ve geliştirme rehberi (V) | Mevcut kodun açıklaması; eski bilgiler ayrıca doğrulanır |
| `docs/city-overhaul/` | Şehir V2 tasarım ve yapılacaklar (V) | Şehir işlerinde birincil web kaynakları |
| `docs/regression-checklist.md` | Manuel map→battle, recruit, save, accounting akışları (V) | Smoke senaryolarını otomatikleştirme başlangıcı |
| `assets/world-map/` | 1995×1504, 3.000.480 tile; 19 owner kodu (V) | Performans/konum doğrulama için temel veri |
| `js/battle/` | Phaser deploy/sector/simulation/visual + testler (V) | Deneysel hattın kaynağı; varsayılan olmayan sistem |
| `js/managers/`, `js/systems/` | Yönetim, ekonomi, world AI, eski savaş, görevler (V) | Uyumlu parçaları koru, hata riskini ölç |

## 3. Ana ilerleme ağacı

```text
FOC WEB — TAM OYUN
│
├─ G0  YÖNETİŞİM / KORUMA / KAYNAK OTORİTESİ
│  ├─ G0.1 web-only scope ve branch koruması
│  ├─ G0.2 doküman/karar/tamamlanma kayıtları
│  └─ G0.3 değişiklik ve geri dönüş protokolü
│
├─ T1  GÜVENLİ ÇALIŞTIRMA / TEST / CI                  [G0'a bağlı]
│  ├─ T1.1 temiz kurulum + lint/build/unit/smoke
│  ├─ T1.2 runtime error, network, asset, save audit
│  ├─ T1.3 GitHub Actions web CI ve golden baseline
│  └─ T1.4 deterministik test seed, fixture ve replay
│
├─ F2  UÇTAN UCA OYNANIŞ DÖNGÜSÜ                      [T1'e bağlı]
│  ├─ F2.1 start/map/city/encounter/deploy/battle/result
│  ├─ F2.2 mod ve overlay geri dönüşleri
│  ├─ F2.3 recruit + wage + supplies + day tick
│  └─ F2.4 roundtrip save/load ve yeniden başlatma
│
├─ W3  DÜNYA / HARİTA / WORLD AI                     [T1,F2'ye bağlı]
│  ├─ W3.1 1648 world data, ownership, spawn, road
│  ├─ W3.2 rota, party AI, patrol/caravan/bandit
│  ├─ W3.3 savaş/barış/şehir sahipliği tutarlılığı
│  └─ W3.4 3M tile ve uzun kampanya benchmark
│
├─ E4  EKONOMİ / İKMAL / TİCARET                     [T1,F2'ye bağlı]
│  ├─ E4.1 tek mal ID/katalog & stok tutarlılığı
│  ├─ E4.2 üretim → stok → tüketim → pazar → kervan
│  ├─ E4.3 maliyet, kıtlık, vergi, price/ledger
│  └─ E4.4 askerî erzak, ücret, ekonomik denge
│
├─ C5  ŞEHİR V2 / KURUMSAL ETKİLER                   [F2,E4'e bağlı]
│  ├─ C5.1 alan doluluğu/bina/servis invariants
│  ├─ C5.2 Kethüda görünmez altyapı sistemi ve UI
│  ├─ C5.3 Kadılık/Medrese/Defterhane/Reisülküttab/Bostancı
│  ├─ C5.4 nüfus, gelir, huzur, sağlık, güvenlik, cross-effects
│  └─ C5.5 üretim, açılma koşulu ve stok bağlantıları
│
├─ Q6  KARŞILAŞMA / GÖREV / KONTRAT                  [F2,W3,E4'e bağlı]
│  ├─ Q6.1 görünür + sürpriz encounter yaşam döngüsü
│  ├─ Q6.2 quest hedeflerinin gerçek event'lerle ilerlemesi
│  ├─ Q6.3 süre/aşama/başarısızlık/ödül/tekrar koruması
│  ├─ Q6.4 görevin saklanması, yüklenmesi, UI geçmişi
│  └─ Q6.5 mevcut Contracts ile görev tekrarlarını ayırma
│
├─ D7  DİPLOMASİ / İLİŞKİLER / YAPAY ZEKÂ            [W3,E4,Q6'ya bağlı]
│  ├─ D7.1 faction relations + war state + ownership
│  ├─ D7.2 aksiyon bedeli/sonucu ve trade etki zinciri
│  ├─ D7.3 gözlem/bilgi ve AI dürüstlük kısıtları
│  └─ D7.4 AI uzun kampanya kararlılığı ve denge
│
├─ B8  SAVAŞ / İKİ MOTOR / MODÜLER ASKER             [T1,F2,E4'e bağlı]
│  ├─ B8.1 Canvas golden behavior ve senaryo seti
│  ├─ B8.2 Phaser feature flag, battle data/result köprüsü
│  ├─ B8.3 deploy, sector, emirler, formasyon, pasif sektör
│  ├─ B8.4 SoldierContainer layer+pool ana renderer entegrasyonu
│  ├─ B8.5 sayı/hasar/kayıp/mühimmat/moral sonuç parity
│  └─ B8.6 geçiş kararı (yalnız kanıt + kullanıcı onayı)
│
├─ S9  SAVE / VERİ BÜTÜNLÜĞÜ / İYİLEŞTİRME          [F2, Q6, B8'e kesişen]
│  ├─ S9.1 versiyonlama, backward compatibility, migration
│  ├─ S9.2 save/load tüm authoritative gameplay state
│  ├─ S9.3 kırık/yarım kayıt, storage limit ve recovery
│  └─ S9.4 deterministik roundtrip ve uzun kampanya
│
├─ U10 ARAYÜZ / ERİŞİLEBİLİRLİK / OYUNCU AKIŞI       [F2,C5,Q6,B8'e bağlı]
│  ├─ U10.1 mevcut kontrol/hotkey/overlay doğrulama
│  ├─ U10.2 kritik durum/uyarı/rapor doğru veri gösterimi
│  └─ U10.3 etkileşimsel hata ve kullanışlılık düzeltmesi
│
├─ R11 ÜRETİM / DAĞITIM / KALİTE KAPILARI            [diğerleri stabil]
│  ├─ R11.1 reproducible build + release export
│  ├─ R11.2 cross-browser/performance/memory soak
│  ├─ R11.3 lisans ve asset provenance denetimi
│  └─ R11.4 release candidate ve rollback
│
└─ A12 ÇİZİM / YENİ GÖRSEL / YENİ ANİMASYON          [DONDURULDU]
   └─ Ayrı sanat fazında, kullanıcı kararıyla açılacak.
```

**Kritik yol:** `G0 → T1 → F2 → (W3,E4) → (C5,Q6,D7) → (B8 ve S9) → U10 → R11`. `B8` için erken test/audit yapılabilir ama üretim motoru değişimi kritik yolun sonunda onay kapısına bağlıdır. Sistemlerin bir kısmı paralel yürütülebilir; **tek kaynak veri ve save semantiği** ortak kilittir.

## 4. Hasar tespit defteri — gözlem, kesinlik ve çözüm

| ID | Öncelik | Gözlem/kanıt | Kesinlik | Nasıl kapatılacak? |
|---|---|---|---|---|
| H-01 | P0/P1 | Güncel web `main` dalının tam CI kanıtı yok; son web test logları PR #50 öncesi | V | Temiz `npm ci`, tam test, build, tarayıcı smoke; GitHub Actions |
| H-02 | P1 | `DEBUG.USE_PHASER_BATTLE=false` ve iki battle path var | V | Golden Canvas baseline + yeni motor sözleşmesi, parity planı |
| H-03 | P1 | Phaser `SectorRenderer` `VisualSoldierPool` ile, modüler container F10 debug ile çalışıyor | V | Katmanlı pool'u kontrollü feature flag altında aktif savaş yoluna entegre et |
| H-04 | P1 | `QuestManager.updateObjective/expireQuests` mevcut, normal çağrı yolları ve save entegrasyonu görünmüyor | V | Event subscriber, day tick, persistence, E2E görev testi |
| H-05 | P1/P2 | Şehir master planında Kethüda UI, kurumsal etkiler, nüfus baskısı, cross-effects bekliyor | V | Önce hesaplar + test, ardından çalışan basit UI |
| H-06 | P1 | Battle sonucu roster/loot/moral/warstate/save zincirindeki çoklu yollar veri çift yazımı riski taşıyor | R | Aynı fixture Canvas/Phaser sonucu üzerinden invariant/roundtrip |
| H-07 | P2 | Dünya haritası 3.000.480 hücre ve büyük asset yükü | V | Hedef donanım/fps/bellek ölç, performans regresyonu kur |
| H-08 | P2 | 3 eski açık PR (#28-30); benzeri özellikler #31-33 ile birleşmiş | V | PR diff karşılaştır; kopyayı kapatma önerisi hazırla, izinsiz kapatma |
| H-09 | P2 | `codex/impl-*` Unity temalı dallar web deposunda bulunuyor | V | Branch provenans haritası; hiçbirini web main'e taşımama |
| H-10 | P2 | Şehir `baseImage` ve overlay eksikse placeholder uyarısı üretir | V | Sanat donduruldu; placeholder ile işlev testleri sürer |
| H-11 | P2 | `progress.md` eski test sayısı ve belirsiz son gelişmeleri içerir | V | Canlı durumu tasarım / implementasyon / test ile ayıran ledger |
| H-12 | P2/P3 | Bundle ve Tailwind CDN ile ilgili tarihsel uyarılar var | H | Güncel build boyutu ve konsol doğrulaması; sanat fazı değil altyapı fazında çöz |
| H-13 | P2 | Bazı birimlerin gerçek grafik atlası yok; fallback kullanılıyor | V | Şimdilik mevcut placeholder koru; içerik/sanat fazına kaydet |
| H-14 | P2 | Görev sistemi ve eski Contracts kısmen çakışıyor | R | Birleşik event/contract/quest sözleşmesi tasarla; duplicate reward testi |
| H-15 | P2 | Şehir/ekonomi/ikmal bazı alanları ortak kaynak kullanıyor ancak bütün zincir doğrulanmadı | R | Kaynak conservation: sıfırdan mal yaratma / negatif stok / çift tüketim testleri |
| H-16 | P3 | `tmp/`, `output/`, eski script ve ikincil rendererlar depoda | V | Kullanım ve lisans envanteri, kör silme yok; güvenli temizlik ayrı PR |

**Uyarı:** `H-01`, `H-06` vb. bir riskin varlığı otomatik olarak programın bozuk olduğu anlamına gelmez. İlk audit'te bunlara `OPEN / REPRODUCED / NOT_REPRODUCED / FIXED` kanıt alanı eklenecek.

## 5. Aşama kapıları ve çalışma sırası

### PHASE-00 — Salt-okunur hasar taraması
**İşler:** Repo ağacı, dependences, save payload, state ownership, iki savaş path'i, bütün mod geçişleri, görev/şehir/ekonomi bağları, açık PR ve branch envanteri.  
**Çıktı:** Her tespit için dosya/satır, davranış kanıtı veya test eksiği, şiddet, risk ve sorumlu paket.  
**Bitiş kapısı:** `H-*` kayıtlarının hiçbiri kaynaksız iddia olarak bırakılmaz.

### PHASE-01 — Güvenli teknik temel
**İşler:** Başlangıç commit sabitle, temiz kurulum, CI, smoke ve save fixture.  
**Bitiş kapısı:** CI tüm kodları test eder, tekrar edilebilir smoke raporu çıkar, mevcut ana dalın bozulan noktaları sınıflandırılır.  
**Dikkat:** Test başarısızsa kırık testi silme/skip yapma; önce gerçek nedenini bul.

### PHASE-02 — Oyunun baştan sona oynanması
**İşler:** Menü→harita→şehir→karşılaşma→savaş→sonuç→harita, kayıt ve araya giren overlay'ler.  
**Bitiş kapısı:** Aynı seeded senaryo yenilgi/zafer/geri çekilme ile tamamlanır; kayıt sonrası veriler doğru döner.

### PHASE-03 — Ekonomi + şehir + görev dünya entegrasyonu
**İşler:** gerçek world events, şehir kurumsal simülasyon, Quest event/expiry/save, mal üretim-tüketim zinciri ve para/kaynak muhasebesi.  
**Bitiş kapısı:** Her oyuncu eyleminin doğru kaynaktan ekonomik bedeli ve gözlenebilir sonucu var; tekrar yükleme veya iki kere tıklama kopya ödül üretmez.

### PHASE-04 — AI/diplomasi/kampanya canlılığı
**İşler:** Faction war/ownership, devriye/karavan davranışı, AI kaynak sınırı, olayların sürekliliği.  
**Bitiş kapısı:** Uzun kampanya simülasyonunda invariant bozulmaz; AI dünyada oyuncusuz da çalışır.

### PHASE-05 — İleri savaş mimarisi ve geçiş doğrulama
**İşler:** Tek battle contract, Phaser runtime bağlantı, sektör active/inactive uyumu, modüler görsel pipeline, casualty/ammo/loot reconciliation, bellek/fps benchmark.  
**Bitiş kapısı:** Canvas golden senaryolarına göre Phaser parity raporu, başarısız senaryolar ve performans kıyası; **kullanıcı onayı olmadan üretim motoru değişmez.**

### PHASE-06 — Sağlamlaştırma ve sürüm hazırlığı
**İşler:** Save migration/recovery, kontrol/HUD düzeltmeleri, cross-browser, kaynak lisansı, release export, geri alma testi.  
**Bitiş kapısı:** Tek adımlı derleme, tekrar edilebilir release testleri, bilinen kritik bug=0. **Bu, ticari yayın onayı değil; teknik release candidate kapısıdır.**

### PHASE-ART — Askıya alınan sanat fazı
**İşler:** Şehir base/overlay, modüler atlas gerçek sanat üretimi, yeni biyom/sprite, grafik polish.  
**Şimdilik:** `DONDURULDU`. Bu işlerin **tasarım/kontrat/test altyapısı** yapılabilir; yeni görsel üretimi yapılmaz.

## 6. Sistem bazlı iş teklifleri (kapsam / yöntem / kabul)

| Hat | İş teklifi | Teknik yaklaşım | Kabul kanıtı |
|---|---|---|---|
| G/T | Audit ve CI kur | GitHub kodu + test scripti; main'den feature branch | CI run + kaynak kilidi + hata envanteri |
| F/S | Ana oyun döngüsünü kilitle | `ModeManager` ve `GameFlowManager` etrafında E2E senaryo | New game→battle result→save→load PASS |
| W | Dünya party ve ownership | World data ve party ID/route invariants | Uzun seed koşuları, illegal owner/route yok |
| E | Ekonomi gerçek muhasebe | Atomik stok/para işlemleri; ayrı hesap kuralları | Negatif stok, çift tahsilat/ödül yok |
| C | Şehir V2 simülasyon | `cityState` alan kaynakları, altyapı ve kurum rule layer | Kadılık/medrese vb. senaryolarda beklenen fark |
| Q | Görev yaşam döngüsü | World event→objective update→complete/expire→save | Görevler bir kez tamamlanır; restore tutarlı |
| D | Diplomasi/AI | Aynı state ve kaynak sınırlarından AI kararları | Yeniden oynanabilir seed, rakip de maliyet öder |
| B | Phaser geçiş güvenliği | Feature flag + adaptor + gerçek kaynak mutasyonu testleri | Canvas parity, 150+150 stres ölçümü, kullanıcı kapısı |
| U | Oyuncu bilgi doğruluğu | HUD/rapor verisini doğrudan authoritative state'ten üret | UI'da gösterilen sayı ile save/state eşit |
| R | Paketleme/yayın | Lokal assets, build export, regression | Başka cihaz/tarayıcıda reproducible açılış |

## 7. Ana mimari ilkeler (`PROPOSED`)

1. **Tek kaynak otoritesi:** `World/Player/Army/City/Economy` state alanları tek yerden değişsin; renderer ve HUD karar sahibi olmasın.
2. **Tek game event hattı:** `battle-resolved`, `city-entered`, `goods-delivered`, `day-advanced` vb. olaylar quest/AI/ekonomi sistemlerine kontrollü iletilsin. Henüz karar taslağı, mevcut kod üzerinde uyumlu adaptör şeklinde kurulmalı.
3. **İşlem bütünlüğü:** Bir eylem için doğrulama → işlem → event → UI → save sırası; ödül/hasar/kayıp çift uygulanmasın.
4. **Deterministik testler:** Seed + başlangıç durumu + olay dizisi aynı state'i üretmeli; UI rastgeleliği gameplay RNG'sine sızmamalı.
5. **Uyumlu değişiklik:** Önce tests/adapter; ardından dar kapsamlı modül; tüm sistemi yeniden yazma yasak değil ama son seçenek.
6. **Gizli devreye alma:** Riskli modüllerde feature flag, rollback, kontrollü fixture.
7. **Save versioning:** Her yeni persisted alan için migration/rollback/legacy-fixture ve malformed-save testleri.
8. **Görsel sınır:** Yeni resim/sprite üretmeden placeholder/fallback ile test edilebilir semantik ve teknik kontrat kur.

## 8. Geliştirme paketi sözleşmesi

Her kod paketi açılmadan önce şu başlıklar yazılır:

```text
WORK-ID / Başlık / Hedef / Öncelik / İşe başlama koşulları
Kaynak commit + owner dosya listesi + değiştirilmemesi gereken dosyalar
İnvariantlar + accepted behavior + olası failure modes
Test: unit/integration/E2E/save/replay/performance gerektiğinde
Beklenen dosya ve API sözleşmesi değişimi
Risk ve rollback planı
Done kriterleri (PASS sonuçları, ekran kanıtı gerekiyorsa)
```

Her paketin kapanışı:

```text
WEB repo / Branch / Commit SHA / PR URL
Değişen dosyalar / Yeni contracts / Save migration
Test komutları + exact pass/fail/skip + CI linki
Karşılaşılan buglar, kapanan H-ID'ler, yeni riskler
DONE / PARTIAL / BLOCKED / FAILED
Bir sonraki kilidi açan dependency-ID
```

**Çalışma disiplini:** Bir paketi kapatmadan ardıl paketin içine dağılma; kritik testleri skip/ignore ile geçirme; büyük kullanıcı kararlarını otomatikleştirme. Art fazına bilgi taşı ama işi başlatma.

## 9. Kullanıcı onayı gerektiren stratejik kapılar

| Karar | Tavsiye | Neden kullanıcı kapısı? |
|---|---|---|
| K-01 Web hedefi | Tarayıcı birincil hedef, ekstra masaüstü paketleyici sonra değerlendirilsin | Ürün hedefi değişir |
| K-02 Savaş motoru | Canvas canlı kalır; Phaser parity sonrası ayrı onayla geçer | Kontrol hissi ve oyun kuralları etkilenir |
| K-03 Şehir derinliği | V2 kurum ve gerçek ekonomi bağlantıları tamamlansın; yeni şehir çizimi beklesin | Kapsam ve denge artar |
| K-04 Quest ve Contracts | Tek event altyapısı; tek defa ödül garantisi; UI iki kavramı koruyabilir | Oynanış semantiği etkilenir |
| K-05 Mimari | Mevcut vanilla JS + Phaser korunur, tam rewrite yapılmaz | Teknik maliyet/kapsam kararı |
| K-06 GitHub temizlik | PR ve branch'ler doğrulanana kadar kapatılmaz/silinmez | İş geçmişi kaybedilebilir |
| K-07 Kalite kapısı | Her sistemde test + save + E2E şart; küçük paketlerden ilerle | Hız ile güvenilirlik tercihi |
| K-08 Görsel çalışma | Yeni görsel üretimi dondurulur; yalnız kırılan UI/asset yolu tamiri serbest | Kullanıcının açık öncelik tercihi |

**Not:** K-08'in ilk kısmı kullanıcı kararıdır; geri kalan satırlar tavsiye olarak sunulur. Onay verilene kadar kodla davranış değiştirmeyiz.

## 10. Kaynaklar ve kanıt bağlantıları

- Web depo: https://github.com/zxc28tarik/FallOfCavalry
- GitHub main commit: https://github.com/zxc28tarik/FallOfCavalry/commit/f377c72f0c094f274a72239fa477f996a21af114
- Son PR: https://github.com/zxc28tarik/FallOfCavalry/pull/50
- Oyun rehberi: https://github.com/zxc28tarik/FallOfCavalry/blob/main/CLAUDE.md
- İlerleme kaydı: https://github.com/zxc28tarik/FallOfCavalry/blob/main/progress.md
- Şehir uygulama planı: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/04-implementation-master-plan.md
- Şehir oyun tasarımı: https://github.com/zxc28tarik/FallOfCavalry/blob/main/docs/city-overhaul/05-city-gameplay-mechanics.md
- Sorunlu quest bağlantıları: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/managers/QuestManager.js
- Save: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/managers/SaveManager.js
- İki battle yolu: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/managers/EncounterManager.js
- Modüler renderer: https://github.com/zxc28tarik/FallOfCavalry/blob/main/js/battle/sector/SectorRenderer.js
- Kullanıcı ZIP'i: `foc.zip` (yerel yedek; public URL verilmez)

## 11. Henüz yapılmayan işler

- Bu doküman web GitHub deposuna commit edilmedi.
- Yeni branch/issue/PR açılmadı, kod değiştirilmedi.
- Son `main` için bütün unit testler yeniden koşturulmadı; eski kayıtlar bugünkü PASS sayılmadı.
- Tek bir oyun mekaniği dahi tamamlanmış ilan edilmedi; tüm ilerleme önerileri `TAMAMLANDI` için gerçek kanıt gerektirir.