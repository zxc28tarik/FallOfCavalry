# FOC WEB — GÖRSEL HASAR TESPİTİ, RİSKLER VE KARAR DEFTERİ

## 1. Kanıt seviyesi ve durum

- **D/GitHub:** 17.11.2026 incelemesinde mevcut web/main kodundan doğrudan doğrulandı.
- **D/ZIP:** Yüklenmiş `foc.zip` arşivindeki dosya ve geçmiş görüntülerden doğrulandı; GitHub HEAD ile aynı olmak zorunda değil.
- **T:** Tarihsel ilerleme notunda var; güncel PASS değildir.
- **R:** Risk veya eksik süreç; **doğrulanmış hata** değildir.
- **Ö:** Bu raporun üretim önerisi; kullanıcı kararı değildir.

## 2. Hasar/teknik borç envanteri

| No | Öncelik | Gözlem | Kanıt | Risk / müdahale | Ne zaman? |
|---|---|---|---|---|---|
| V-H01 | P0 | Mevcut görünüm için güncel tüm görsel ekran baz çizgisi/temiz test raporu henüz alınmadı | R | Göreli kalite ve performans denetlenemez; ekran baseline al | G01 |
| V-H02 | P1 | `main-ground-tile.png` ortak helper ile dünya ve savaş görseline temas edebiliyor | D/GitHub | Dünya zeminini değiştirirken savaş yanlış görünür; profil/fallback | G04/G12 |
| V-H03 | P1 | Dünya 64×32 dimetrik dünya koordinatlarında; şehir hotspotları yüzde koordinatlı | D/GitHub | Ortak koordinat sanılırsa bina kayar; ayrı transform | G02/G03 |
| V-H04 | P1 | `city-scene-defs` içinde `baseImage:null` ve mevcut manifest `status:template` | D/GitHub | Yeni 2D şehir görseli otomatik açılmaz; stage + manifest bağla | G03/G09 |
| V-H05 | P1 | SpriteLoader varsayılan inline boş manifest ile başlatılıyor; dev override var | D/GitHub | Sadece dosya koymak yetmez; registry ve loader bağlantısı | G03 |
| V-H06 | P1 | `WORLD_MAP_FORCE_SINGLE_GRASS_BIOME:true` ayarı aktif | D/GitHub | Sıfırdan çok arazi görseli çizilse bile oyun göstermeyebilir | G04 kullanıcı kararı |
| V-H07 | P1 | Dimetrik terrain cache 96 MB ile sınırlandırılmış | D/GitHub | Daha ağır 2D tile/overlay perf, bellek ve geç açılma riski | G01/G04/G13 |
| V-H08 | P1 | 3 milyon tile'da tekrar eden görsel desen/LOD büyük ölçekte kalite riski | D/R | Yerel güzel texture tüm haritada çirkin tekrar edebilir | G04/G05 |
| V-H09 | P1 | `cityState` area dolulukları ile tekil bina görsel konumu farklı ihtiyaç | D/GitHub | Yanlış `x,y,w,h` eşleştirme; ayrı placement manifest | G09 |
| V-H10 | P1 | İstanbul özel başlangıç ve şehir alanı kararları mevcut | D/GitHub | Yeni artwork yanlış başlangıç binası gösterebilir | G09 |
| V-H11 | P1 | Askerî ve liman şehir alanları pasif | D/GitHub | Sanat üretimi yanlışlıkla mekanikleri aktif edebilir | G09/G13 |
| V-H12 | P1 | Map icon, köy içi sahne ve şehir full scene ayrı sunum yüzeyleri | D/R | Tek varlık skalayarak bütün görünüme koymak yetersiz | G07/G08/G09 |
| V-H13 | P2 | Doğa assetleri mevcut kodda seedli/LOD ayarlarına bağımlı | D/GitHub | Yeni sprite tek başına daha güzel olsa da çok tekrar/overlap yapabilir | G05 |
| V-H14 | P2 | Yol/nehir çizimi path layer ile ilişkili | D/GitHub | Yol sprite'ı path gerçek geometry'den kopabilir | G06 |
| V-H15 | P2 | Mevcut city `backgroundImage` ve hotspotların responsive hizası ayrıca doğrulanmalı | D/R | cover/letterboxing ile hotspot kayabilir; kanıt bekler | G03/G09 |
| V-H16 | P2 | Şehir sanat dokümanı 2D base + overlay + hotspot sözleşmesini belirliyor | D/GitHub | Her şehir tek sabit PNG olarak üretilirse gelişim çalışmaz | G09 |
| V-H17 | P2 | Eski görsellerin köken/lisans bilgileri tekil varlık bazında henüz kapatılmadı | R | Final pakette hak riski; provenance & re-produce | G01/G13 |
| V-H18 | P2 | Güncel web/main için bütün platformlarda canvas/perf smoke kanıtı yok | R | Sanat kaynaklı regression saklanabilir; ekran matrisi | G01/G13 |
| V-H19 | P2 | Köy için ayrı iç sahne akışı doğrulanmadan sözleşme yapılıyor olabilir | R | G08'e yanlışlıkla yeni mekanik kapsamı ekleme | G08 |
| V-H20 | P2 | G12 battle backdrop 2D görünümü, asker sprite G14'ten bağımsız planlanmalı | D/Ö | Erken asker animasyon işi en büyük gecikme kaynağı | G12/G14 |

**Kontrol:** Tablodaki `R` maddeleri henüz kesin hata olarak sayılmaz. G01 denetiminde her risk için **repro adımı, screenshot, ortam, dosya ve öncelik** eklenir; bulunan bug `CONFIRMED` olur.

## 3. Risk matrisi ve erken uyarı

| Risk | Olasılık | Etki | Erken işaret | Önleyici bariyer |
|---|---|---|---|---|
| Her 2D resimde perspektif değişmesi | Yüksek | Çok yüksek | Evin bacası/köşesi farklı açı | G02 perspektif kartı; 2D pilot red/accept |
| Bütün şehir tek PNG'ye gömülmesi | Yüksek | Çok yüksek | Bina yokken görsel kalıyor | G09 base vs overlay ayrımı; cityState visibility |
| Üretilen assetin render yoluna bağlanmaması | Yüksek | Yüksek | Dosya var, oyunda yok | G03 registry+manifest / 404 / fallback |
| UI/hotspotların kayması | Orta | Çok yüksek | Resize sonrası yanlış tıklama | Ortak contentRect transform testi |
| Ağaç, yapı ve yol çakışması | Yüksek | Orta | Yol ağaç altında, köprü havada | Pivot/exclusion/depth-sort QA |
| Haritada 2D sprite boyutunun çığ gibi artması | Yüksek | Yüksek | Zoom/pan p95 kötüleşiyor | LOD+atlas+spatial culling+baseline |
| Dünya sahibi ve faction renklendirme hatası | Orta | Yüksek | Şehir yanlış ülke renginde | ownerId mapping ve save test |
| AI 2D üretiminde kaynak/hak sorunu | Orta | Çok yüksek | Stil başka oyundan kopya | Provenance, hak ve lisans kabul kapısı |
| Gereksiz code refactor ile ekonomi/save bozulması | Orta | Çok yüksek | E2E regresyon, save farklı | Grafik-only PR, rollback, smoke |
| Asker işinin erkenden başlaması | Yüksek | Yüksek | F10 atlas işleri ana plana karışır | G14 bloku + PR checklist |
| Fraksiyonları erken üretip Osmanlı stilini tutturamamak | Orta | Yüksek | 4 kültürde ayrı ayrı stil | G09 kabulünden sonra G11 |
| Sınırlanmamış kapsam artışı | Yüksek | Yüksek | Yeni deniz/liman/kuşatma gameplay istenir | Scope change form ve kullanıcı onayı |

## 4. Kullanıcı tarafından **kararlaştırılanlar**

| ID | Karar | Durum | Tarih / kanıt |
|---|---|---|---|
| K-001 | Web oyununun ayrı GitHub deposu ve geliştirme hattı var | KESİN | Bu konuşma; GitHub depo araması |
| K-002 | Web grafikleri sıfırdan yapılacak; mevcut PNG final olarak alınmayacak | KESİN | Bu konuşma |
| K-003 | Bütün yeni görseller **doğrudan 2D**; 3D üretim planı yok | KESİN | Bu konuşma |
| K-004 | **Asker çizimi kesin en son** | KESİN | Bu konuşma |
| K-005 | Zemin dahil dünya, şehir/köy, çevre, her görsel alan yenilenecek | KESİN | Bu konuşma |
| K-006 | Kullanıcı görsel üretir; teknik entegrasyon asistan/Codex tarafında | KESİN | Bu konuşma |
| K-007 | Önce kapsamlı kontrollü plan ve ilerleme ağaçları hazırlanacak | KESİN | Bu konuşma |
| K-008 | Şehir V2'de İç Kale tek sabit dolu; diğer alanlar doluluk varyantları | KESİN (önceki tasarım) | `docs/city-overhaul/`, kullanıcı yüklediği V2 plan |
| K-009 | Oyuncu görsel yenileme çalışması nedeniyle zorunlu olarak yeni mekanikler almayacak | KORUMA KURALI (öneri) | Bu plan |

## 5. Kullanıcıya açık tutulacak önemli **tasarım karar kapıları**

| Karar ID | Soru | Varsayılan güvenli yaklaşım | Sorulacağı faz |
|---|---|---|---|
| D-01 | Nihai sanat stili ne kadar resimsi / gerçekçi? | HoMM3 esintili fakat özgün, 2D hafif resimsi | G02 |
| D-02 | Görsel biyomları tek çimden çoğaltalım mı? | Önce tek çim alt varyantlarını pilotla; gameplay biome'larını değiştirme | G04 |
| D-03 | Hedef düşük seviye cihaz nedir? | Benchmark al, sonra FPS/MB hedefi kilitle | G01/G04 |
| D-04 | Köy için ayrı iç sahne var mı, yoksa yeni sunum katmanı mı? | Önce mevcut oyunu incele; yeni mode kararı aldır | G08 |
| D-05 | Şehir base sahnesi çizim oranı ve viewportta taşma mı letterbox mı? | Hotspot hizasını koruyacak aspect-safe layout | G03/G09 |
| D-06 | Faction genişlemesi hangi özgün bina ağırlığında? | Önce Osmanlı pilotuna benzeyen ölçekte dört tema | G11 |
| D-07 | Hava, su hareketi, parçacıklar yeniden aktif mi? | Mevcut `false` ayarını değiştirme | G12 |
| D-08 | Tam görsel geçişi eski modu kapatabilir mi? | Performans+E2E+onay gelene kadar legacy fallback | G13 |
| D-09 | Askerde tam atlas mı, modüler mi, hibrit mi? | **Kararsız bırak; kesin G14** | G14 |

## 6. Değişiklik yönetimi

- **Büyük karar:** Perspektif sistemi, görsel biyom modelinin gameplay'e etkisi, şehir/köy UI akışı, battle renderer replacement, save schema değişikliği → kullanıcı onayı olmadan uygulanmaz.
- **Teknik karar:** Dosya gruplama, test betiği, görüntü sıkıştırma, atlas paketleme → varlık görünümünü/oynanışı bozmuyorsa teknik görev kapsamında uygulanabilir.
- **Kırmızı çizgi:** Hedef tasarım başka eserlerin sprite/çizimlerini kopyalamaz; hak bilgisi olmayan varlık final paketine girmez.
- **Rollback:** Yeni görsel feature flag'i kapatınca aynı game state, doğru eski placeholder ile oynanabilir kalır.
- **Plan/uygulama ayrımı:** Bu sürümde yalnızca plan dosyaları hazırlandı; yapılmayan kod değişiklikleri tamamlandı yazılmaz.